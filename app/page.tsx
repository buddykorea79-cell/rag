import ChatWindow from "@/components/ChatWindow";

export default function HomePage() {
  return (
    <main className="mx-auto flex h-dvh max-w-3xl flex-col">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:rounded-b-none sm:px-6">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold sm:text-lg">
            생애주기별 안전교육 챗봇
          </h1>
          <p className="truncate text-xs text-slate-500 sm:text-sm">
            안전교육 교재 내용을 근거로 답변해 드립니다
          </p>
        </div>
      </header>
      <ChatWindow />
    </main>
  );
}
