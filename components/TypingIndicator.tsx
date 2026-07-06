export default function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <span className="flex items-center gap-1" aria-label="답변 작성 중">
          <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400 [animation-delay:0ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400 [animation-delay:150ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400 [animation-delay:300ms]" />
        </span>
      </div>
    </div>
  );
}
