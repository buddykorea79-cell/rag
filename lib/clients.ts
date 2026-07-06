import OpenAI from "openai";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** 채팅/답변 생성 모델 (BizRouter) */
export const CHAT_MODEL = "openai/gpt-5.4-mini";
/** 임베딩 모델 (OpenRouter, 2048차원) */
export const EMBEDDING_MODEL = "nvidia/llama-nemotron-embed-vl-1b-v2:free";
/** documents.embedding 벡터 차원 수 */
export const EMBEDDING_DIMENSIONS = 2048;

/** 외부 API 호출당 타임아웃 (ms) */
export const REQUEST_TIMEOUT_MS = 20_000;

const REQUIRED_ENV_VARS = [
  "BIZROUTER_API_KEY",
  "OPENROUTER_API_KEY",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_KEY",
] as const;

/** 환경변수 누락 시 던지는 에러 — 라우트에서 구분 처리한다 */
export class EnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvError";
  }
}

/**
 * 필수 환경변수를 한 번에 검사한다. 하나라도 없으면 누락 목록 전체를
 * 담은 EnvError를 던져, 첫 요청 시점에 무엇이 빠졌는지 바로 알 수 있게 한다.
 */
export function assertRequiredEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new EnvError(
      `필수 환경변수가 설정되지 않았습니다: ${missing.join(", ")} — ` +
        `.env.local(로컬) 또는 배포 환경의 환경변수를 확인하세요.`
    );
  }
}

function requireEnv(name: (typeof REQUIRED_ENV_VARS)[number]): string {
  const value = process.env[name];
  if (!value) {
    throw new EnvError(`필수 환경변수가 설정되지 않았습니다: ${name}`);
  }
  return value;
}

// 클라이언트들은 빌드 시점(환경변수가 없는 환경)에 모듈 로드만으로 실패하지 않도록
// 첫 사용 시점에 생성해 캐시한다.
let bizRouterClient: OpenAI | null = null;
let openRouterClient: OpenAI | null = null;
let supabaseClient: SupabaseClient | null = null;

/** BizRouter — 채팅/답변 생성용 OpenAI 호환 클라이언트 */
export function getBizRouterClient(): OpenAI {
  if (!bizRouterClient) {
    bizRouterClient = new OpenAI({
      apiKey: requireEnv("BIZROUTER_API_KEY"),
      baseURL: "https://api.bizrouter.ai/v1",
      timeout: REQUEST_TIMEOUT_MS,
      maxRetries: 1,
    });
  }
  return bizRouterClient;
}

/** OpenRouter — 임베딩용 OpenAI 호환 클라이언트 (재시도는 rag.ts에서 직접 제어) */
export function getOpenRouterClient(): OpenAI {
  if (!openRouterClient) {
    openRouterClient = new OpenAI({
      apiKey: requireEnv("OPENROUTER_API_KEY"),
      baseURL: "https://openrouter.ai/api/v1",
      timeout: REQUEST_TIMEOUT_MS,
      maxRetries: 0,
    });
  }
  return openRouterClient;
}

/** Supabase — documents 테이블/match_documents RPC 접근용 (service key, 서버 전용) */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_KEY"),
      { auth: { persistSession: false } }
    );
  }
  return supabaseClient;
}
