import { NextRequest, NextResponse } from "next/server";
import { EnvError, assertRequiredEnv } from "@/lib/clients";
import { RagError, answerQuestion } from "@/lib/rag";
import type { ChatErrorResponse } from "@/lib/types";

export const runtime = "nodejs";
// 임베딩 429 재시도(2초 대기 포함)와 LLM 호출 2회를 감안한 함수 실행 상한
export const maxDuration = 60;

const MAX_QUESTION_LENGTH = 1_000;

const GENERIC_ERROR_MESSAGE =
  "답변을 생성하는 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.";
const RATE_LIMIT_MESSAGE = "지금 사용자가 많아 잠시 후 다시 시도해주세요.";

function errorResponse(message: string, status: number) {
  return NextResponse.json<ChatErrorResponse>({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  // 환경변수 누락은 조용히 넘어가지 않고 첫 요청에서 바로 드러낸다.
  try {
    assertRequiredEnv();
  } catch (err) {
    if (err instanceof EnvError) {
      console.error(`[ENV] ${err.message}`);
      return errorResponse(GENERIC_ERROR_MESSAGE, 500);
    }
    throw err;
  }

  let question: unknown;
  try {
    const body = await request.json();
    question = body?.question;
  } catch {
    return errorResponse("요청 형식이 올바르지 않습니다.", 400);
  }

  if (typeof question !== "string" || question.trim().length === 0) {
    return errorResponse("질문을 입력해주세요.", 400);
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return errorResponse(`질문은 ${MAX_QUESTION_LENGTH}자 이내로 입력해주세요.`, 400);
  }

  try {
    const result = await answerQuestion(question.trim());
    return NextResponse.json(result);
  } catch (err) {
    // 어느 단계(rewrite/embed/search/answer)에서 실패했는지는 서버 로그에만 남기고,
    // 사용자에게는 일반적인 안내 메시지만 반환한다.
    if (err instanceof RagError) {
      console.error(`[RAG:${err.stage}] ${err.message}`, err.cause ?? "");
      if (err.isRateLimit) {
        return errorResponse(RATE_LIMIT_MESSAGE, 429);
      }
    } else {
      console.error("[RAG:unknown] 예기치 못한 오류:", err);
    }
    return errorResponse(GENERIC_ERROR_MESSAGE, 500);
  }
}
