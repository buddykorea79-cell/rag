# 생애주기별 안전교육 챗봇 (Advanced RAG)

생애주기별 안전교육 교재를 근거로 답변하는 RAG(Retrieval-Augmented Generation) 기반 챗봇 서비스입니다.
교재의 청킹·임베딩·적재(색인)는 별도 파이프라인(Colab)에서 완료되어 Supabase에 저장되어 있으며,
이 프로젝트는 그 색인을 조회해 답변을 생성하는 **질의응답 웹 서비스**를 담당합니다.

## 동작 방식

```
사용자 질문
   │
   ▼
① 쿼리 재작성 ──── BizRouter (openai/gpt-5.4-mini)
   │                검색에 적합한 형태로 질문을 재작성
   ▼
② 임베딩 ────────── OpenRouter (nvidia/llama-nemotron-embed-vl-1b-v2:free, 2048차원)
   │                429 발생 시 2초 대기 후 1회 재시도
   ▼
③ 유사도 검색 ──── Supabase RPC match_documents (코사인 유사도, 상위 5개)
   │
   ▼
④ 컨텍스트 구성 ── 검색된 청크를 header_path(출처)와 함께 구성
   │
   ▼
⑤ 답변 생성 ────── BizRouter (openai/gpt-5.4-mini)
                    컨텍스트에 있는 내용만 근거로 답변, 출처 표기
```

## 기술 스택

- **Next.js 14** (App Router, TypeScript) — Vercel 서버리스 배포 기준 (Node.js 런타임)
- **Tailwind CSS** — 채팅 UI 스타일링
- **@supabase/supabase-js** — `match_documents` RPC 호출
- **openai** SDK — BizRouter/OpenRouter 두 개의 OpenAI 호환 클라이언트 생성

## 프로젝트 구조

```
app/
  page.tsx              # 채팅 UI 메인 페이지
  api/chat/route.ts     # RAG 파이프라인 API 라우트 (POST)
lib/
  clients.ts            # BizRouter/OpenRouter/Supabase 클라이언트, 환경변수 검증
  rag.ts                # 재작성 → 임베딩 → 검색 → 컨텍스트 → 답변 생성
  types.ts              # 공용 타입
components/
  ChatWindow.tsx        # 채팅 창 (메시지 목록 + 입력창)
  MessageBubble.tsx     # 사용자/봇 말풍선
  SourceBadge.tsx       # 출처(header_path) 배지
  TypingIndicator.tsx   # 로딩 타이핑 인디케이터
```

## 로컬 개발 환경 설정

1. 의존성 설치

   ```bash
   npm install
   ```

2. 환경변수 파일 생성 — `.env.local.example`을 복사해 `.env.local`을 만들고 값을 채웁니다.
   (발급/등록 방법은 별도로 관리하며 이 문서에서는 다루지 않습니다.)

   ```bash
   cp .env.local.example .env.local
   ```

   필요한 환경변수 이름:

   | 이름 | 용도 |
   | --- | --- |
   | `BIZROUTER_API_KEY` | 채팅/답변 생성 (BizRouter) |
   | `OPENROUTER_API_KEY` | 쿼리 임베딩 (OpenRouter) |
   | `SUPABASE_URL` | Supabase 프로젝트 URL |
   | `SUPABASE_SERVICE_KEY` | Supabase 서비스 키 (서버 전용) |

   > 환경변수가 하나라도 비어 있으면 첫 요청 시 서버 로그에 누락 목록이 출력됩니다.

3. 개발 서버 실행

   ```bash
   npm run dev
   ```

   `http://localhost:3000` 에 접속해 질문을 입력하면 동작을 확인할 수 있습니다.

## API 사용법

### `POST /api/chat`

**요청**

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "영유아 계단 안전 수칙을 알려줘"}'
```

**성공 응답 (200)**

```json
{
  "answer": "영유아가 계단을 이용할 때는 ... 출처: 영유아기 > 생활안전 > 계단 안전",
  "sources": [
    { "header_path": "영유아기 > 생활안전 > 계단 안전", "similarity": 0.87 },
    { "header_path": "영유아기 > 생활안전 > 실내 안전", "similarity": 0.81 }
  ]
}
```

**에러 응답**

| 상태 코드 | 응답 예시 | 의미 |
| --- | --- | --- |
| `400` | `{ "error": "질문을 입력해주세요." }` | 잘못된 요청 (질문 누락/초과) |
| `429` | `{ "error": "지금 사용자가 많아 잠시 후 다시 시도해주세요." }` | 임베딩 모델 rate limit (재시도 후에도 초과) |
| `500` | `{ "error": "답변을 생성하는 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요." }` | 내부 오류 (실패 단계는 서버 로그에만 기록) |

## 에러 처리 정책

- OpenRouter 임베딩 429: 서버에서 2초 대기 후 1회 재시도, 실패 시 `429`로 응답하고 프론트가 혼잡 안내 메시지를 구분 표시
- 그 외 임베딩 실패: 총 3회까지 시도 후 실패 처리
- BizRouter / OpenRouter / Supabase 실패는 서버 로그에 `[RAG:rewrite]` `[RAG:embed]` `[RAG:search]` `[RAG:answer]` 접두사로 구분 기록되며, 사용자에게는 일반 안내 메시지만 노출
- 외부 API 호출당 20초 타임아웃
