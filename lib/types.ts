/** 검색된 청크의 출처 정보 (프론트 배지 표시 + 클릭 시 원문 열람용) */
export interface Source {
  header_path: string;
  similarity: number;
  /** 해당 출처에서 검색된 청크 원문 (같은 출처의 청크는 유사도순으로 이어붙임) */
  content: string;
}

/** POST /api/chat 성공 응답 */
export interface ChatSuccessResponse {
  answer: string;
  sources: Source[];
}

/** POST /api/chat 실패 응답 */
export interface ChatErrorResponse {
  error: string;
}

/** Supabase match_documents RPC가 반환하는 행 */
export interface MatchedDocument {
  id: number;
  content: string;
  header_path: string;
  metadata: Record<string, unknown>;
  similarity: number;
}
