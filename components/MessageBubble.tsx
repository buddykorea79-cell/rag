import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import SourceBadge from "@/components/SourceBadge";
import type { Source } from "@/lib/types";

export type MessageVariant = "normal" | "rate-limit" | "error" | "source";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  variant?: MessageVariant;
  /** variant가 "source"일 때 상단에 표시할 출처 경로 */
  sourceLabel?: string;
}

const assistantBubbleStyles: Record<MessageVariant, string> = {
  normal: "border-slate-200 bg-white text-slate-900",
  "rate-limit": "border-amber-200 bg-amber-50 text-amber-900",
  error: "border-rose-200 bg-rose-50 text-rose-900",
  source: "border-indigo-200 bg-indigo-50/70 text-slate-900",
};

const markdownStyles =
  "prose prose-sm max-w-none break-words prose-headings:mb-2 prose-headings:mt-3 prose-headings:text-slate-800 prose-p:my-1.5 prose-p:leading-relaxed prose-strong:font-semibold prose-strong:text-slate-900 prose-ol:my-1.5 prose-ol:pl-5 prose-ul:my-1.5 prose-ul:pl-5 prose-li:my-0.5 sm:prose-base [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_table]:block [&_table]:overflow-x-auto";

export default function MessageBubble({
  message,
  onSourceClick,
}: {
  message: ChatMessage;
  onSourceClick?: (source: Source) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-gradient-to-br from-blue-600 to-indigo-600 px-4 py-2.5 text-sm text-white shadow-md shadow-blue-600/20 sm:max-w-[75%] sm:text-base">
          {message.content}
        </div>
      </div>
    );
  }

  const variant = message.variant ?? "normal";
  const renderMarkdown = variant === "normal" || variant === "source";

  return (
    <div className="flex flex-col items-start gap-2">
      <div
        className={`max-w-[85%] rounded-2xl rounded-bl-md border px-4 py-3 text-sm shadow-sm sm:max-w-[75%] sm:text-base ${assistantBubbleStyles[variant]}`}
      >
        {variant === "source" && message.sourceLabel && (
          <p className="mb-2 flex items-center gap-1.5 border-b border-indigo-200/70 pb-2 text-xs font-semibold text-indigo-700 sm:text-sm">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5 shrink-0"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
            </svg>
            교재 원문 — {message.sourceLabel}
          </p>
        )}
        {renderMarkdown ? (
          <div className={markdownStyles}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        ) : (
          <span className="whitespace-pre-wrap break-words">
            {message.content}
          </span>
        )}
      </div>
      {message.sources && message.sources.length > 0 && (
        <div className="flex max-w-[85%] flex-wrap gap-1.5 sm:max-w-[75%]">
          {message.sources.map((source) => (
            <SourceBadge
              key={source.header_path}
              source={source}
              onClick={onSourceClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}
