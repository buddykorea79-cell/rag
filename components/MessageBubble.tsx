import SourceBadge from "@/components/SourceBadge";
import type { Source } from "@/lib/types";

export type MessageVariant = "normal" | "rate-limit" | "error";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  variant?: MessageVariant;
}

const assistantBubbleStyles: Record<MessageVariant, string> = {
  normal: "border-slate-200 bg-white text-slate-900",
  "rate-limit": "border-amber-200 bg-amber-50 text-amber-900",
  error: "border-rose-200 bg-rose-50 text-rose-900",
};

export default function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-blue-600 px-4 py-2.5 text-sm text-white shadow-sm sm:max-w-[75%] sm:text-base">
          {message.content}
        </div>
      </div>
    );
  }

  const variant = message.variant ?? "normal";

  return (
    <div className="flex flex-col items-start gap-2">
      <div
        className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-bl-md border px-4 py-2.5 text-sm shadow-sm sm:max-w-[75%] sm:text-base ${assistantBubbleStyles[variant]}`}
      >
        {message.content}
      </div>
      {message.sources && message.sources.length > 0 && (
        <div className="flex max-w-[85%] flex-wrap gap-1.5 sm:max-w-[75%]">
          {message.sources.map((source) => (
            <SourceBadge key={source.header_path} source={source} />
          ))}
        </div>
      )}
    </div>
  );
}
