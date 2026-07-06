import OpenAI from "openai";
import {
  CHAT_MODEL,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  REQUEST_TIMEOUT_MS,
  getBizRouterClient,
  getOpenRouterClient,
  getSupabaseClient,
} from "@/lib/clients";
import type { ChatSuccessResponse, MatchedDocument, Source } from "@/lib/types";

/** RAG 파이프라인 단계 — 로그에서 실패 지점을 구분하는 용도 (사용자에게는 노출하지 않음) */
export type RagStage = "rewrite" | "embed" | "search" | "answer";

export class RagError extends Error {
  constructor(
    readonly stage: RagStage,
    message: string,
    readonly isRateLimit = false,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = "RagError";
  }
}

/** 검색 결과 개수 */
const MATCH_COUNT = 5;
/** 임베딩 호출 최대 시도 횟수 (최초 1회 + 재시도 2회) */
const EMBED_MAX_ATTEMPTS = 3;
/** 429 발생 시 재시도 전 대기 시간 (ms) */
const RATE_LIMIT_RETRY_DELAY_MS = 2_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isRateLimitError(err: unknown): boolean {
  if (err instanceof OpenAI.APIError) return err.status === 429;
  return (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    (err as { status?: unknown }).status === 429
  );
}

/** 로그용 요약 — 스택 전체 대신 핵심만 남긴다 */
function summarizeError(err: unknown): string {
  if (err instanceof OpenAI.APIError) return `status=${err.status} ${err.message}`;
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}

/**
 * 1단계 — 사용자 질문을 벡터 검색에 적합한 쿼리로 재작성한다.
 * 재작성이 실패해도 파이프라인 전체를 중단할 이유는 없으므로,
 * 실패 시 로그만 남기고 원본 질문을 그대로 사용한다.
 */
export async function rewriteQuery(question: string): Promise<string> {
  try {
    const completion = await getBizRouterClient().chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        {
          role: "system",
          content:
            "사용자의 질문을 안전교육 교재 벡터 검색에 적합한 한국어 검색 쿼리로 재작성하세요. " +
            "핵심 키워드는 보존하고, 대명사는 구체적인 명사로 바꾸고, 불필요한 표현은 제거하세요. " +
            "재작성한 검색 쿼리 한 줄만 출력하세요. 설명이나 따옴표는 붙이지 마세요.",
        },
        { role: "user", content: question },
      ],
    });

    const rewritten = completion.choices[0]?.message?.content
      ?.trim()
      .replace(/^["']|["']$/g, "");
    if (!rewritten) throw new Error("빈 재작성 결과");

    console.log(`[RAG:rewrite] "${question}" -> "${rewritten}"`);
    return rewritten;
  } catch (err) {
    console.error(`[RAG:rewrite] 쿼리 재작성 실패, 원본 질문으로 검색 진행: ${summarizeError(err)}`);
    return question;
  }
}

/**
 * 2단계 — 재작성된 쿼리를 OpenRouter 무료 임베딩 모델로 임베딩한다.
 * - 429: 2초 대기 후 1회만 재시도, 그래도 429면 즉시 rate-limit 에러로 반환
 * - 그 외 오류: 총 3회까지 시도 (최초 1회 + 재시도 2회)
 */
export async function embedQuery(text: string): Promise<number[]> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= EMBED_MAX_ATTEMPTS; attempt++) {
    try {
      const response = await getOpenRouterClient().embeddings.create({
        model: EMBEDDING_MODEL,
        input: text,
      });

      const embedding = response.data[0]?.embedding;
      if (!embedding || embedding.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(
          `임베딩 차원 불일치: expected=${EMBEDDING_DIMENSIONS}, got=${embedding?.length ?? "none"}`
        );
      }
      return embedding;
    } catch (err) {
      lastError = err;

      if (isRateLimitError(err)) {
        if (attempt >= 2) {
          // 이미 한 번 기다렸다 재시도한 뒤에도 429 — 사용자에게 혼잡 안내
          throw new RagError("embed", "OpenRouter 임베딩 rate limit (재시도 후에도 429)", true, err);
        }
        console.warn(`[RAG:embed] 429 rate limit — ${RATE_LIMIT_RETRY_DELAY_MS}ms 대기 후 1회 재시도`);
        await sleep(RATE_LIMIT_RETRY_DELAY_MS);
        continue;
      }

      if (attempt >= EMBED_MAX_ATTEMPTS) break;
      console.warn(`[RAG:embed] 시도 ${attempt}/${EMBED_MAX_ATTEMPTS} 실패, 재시도: ${summarizeError(err)}`);
      await sleep(500 * attempt);
    }
  }

  throw new RagError("embed", `임베딩 실패: ${summarizeError(lastError)}`, false, lastError);
}

/** 3단계 — Supabase match_documents RPC로 코사인 유사도 상위 청크를 검색한다. */
export async function searchDocuments(embedding: number[]): Promise<MatchedDocument[]> {
  const { data, error } = await getSupabaseClient()
    .rpc("match_documents", {
      query_embedding: embedding,
      match_count: MATCH_COUNT,
      filter: {},
    })
    .abortSignal(AbortSignal.timeout(REQUEST_TIMEOUT_MS));

  if (error) {
    throw new RagError("search", `Supabase 검색 실패: ${error.message}`, false, error);
  }
  return (data ?? []) as MatchedDocument[];
}

/** 4단계 — 검색된 청크를 header_path와 함께 LLM 컨텍스트 문자열로 구성한다. */
export function buildContext(documents: MatchedDocument[]): string {
  return documents
    .map(
      (doc, index) =>
        `[문서 ${index + 1}] 출처: ${doc.header_path}\n${doc.content}`
    )
    .join("\n\n---\n\n");
}

/** 5단계 — 컨텍스트만 근거로 답변을 생성한다. */
export async function generateAnswer(question: string, context: string): Promise<string> {
  try {
    const completion = await getBizRouterClient().chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        {
          role: "system",
          content:
            "당신은 생애주기별 안전교육 교재를 안내하는 챗봇입니다. " +
            "반드시 제공된 컨텍스트에 있는 내용만 근거로 답변하고, " +
            "컨텍스트에 없는 내용은 모른다고 답하세요. " +
            "답변 끝에 참고한 출처(header_path)를 표기하세요. " +
            "한국어로 명확하고 간결하게 답변하세요.",
        },
        {
          role: "user",
          content: `컨텍스트:\n${context}\n\n질문: ${question}`,
        },
      ],
    });

    const answer = completion.choices[0]?.message?.content?.trim();
    if (!answer) throw new Error("빈 답변");
    return answer;
  } catch (err) {
    if (err instanceof RagError) throw err;
    throw new RagError("answer", `답변 생성 실패: ${summarizeError(err)}`, isRateLimitError(err), err);
  }
}

/** 같은 header_path가 여러 청크로 검색된 경우 가장 높은 유사도 하나만 남긴다. */
function toSources(documents: MatchedDocument[]): Source[] {
  const byPath = new Map<string, Source>();
  for (const doc of documents) {
    const existing = byPath.get(doc.header_path);
    if (!existing || doc.similarity > existing.similarity) {
      byPath.set(doc.header_path, {
        header_path: doc.header_path,
        similarity: doc.similarity,
      });
    }
  }
  return Array.from(byPath.values());
}

/** 전체 RAG 파이프라인: 재작성 → 임베딩 → 검색 → 컨텍스트 구성 → 답변 생성 */
export async function answerQuestion(question: string): Promise<ChatSuccessResponse> {
  const searchQuery = await rewriteQuery(question);
  const embedding = await embedQuery(searchQuery);
  const documents = await searchDocuments(embedding);

  if (documents.length === 0) {
    return {
      answer:
        "죄송합니다. 교재에서 질문과 관련된 내용을 찾지 못했습니다. 질문을 조금 더 구체적으로 바꿔서 다시 시도해주세요.",
      sources: [],
    };
  }

  const context = buildContext(documents);
  const answer = await generateAnswer(question, context);

  return { answer, sources: toSources(documents) };
}
