import type { Source } from "@/lib/types";

export default function SourceBadge({ source }: { source: Source }) {
  const similarityPercent = Math.round(source.similarity * 100);

  return (
    <span
      title={source.header_path}
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs text-blue-800"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3 w-3 shrink-0"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
      </svg>
      <span className="truncate">{source.header_path}</span>
      <span className="shrink-0 text-blue-400">{similarityPercent}%</span>
    </span>
  );
}
