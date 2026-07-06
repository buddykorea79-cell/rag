"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import MessageBubble, { ChatMessage } from "@/components/MessageBubble";
import TypingIndicator from "@/components/TypingIndicator";
import type { ChatSuccessResponse } from "@/lib/types";

/** 서버 처리(재시도 포함)보다 여유 있게 잡은 클라이언트 대기 상한 */
const CLIENT_TIMEOUT_MS = 60_000;

const EXAMPLE_QUESTIONS = [
  "영유아가 계단을 이용할 때 지켜야 할 안전 수칙은?",
  "심폐소생술은 어떤 순서로 해야 하나요?",
  "노인 낙상 사고를 예방하는 방법을 알려주세요.",
];

let nextId = 0;
const createId = () => `msg-${nextId++}`;

export default function ChatWindow() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  async function sendQuestion(question: string) {
    const trimmed = question.trim();
    if (!trimmed || isLoading) return;

    setMessages((prev) => [
      ...prev,
      { id: createId(), role: "user", content: trimmed },
    ]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
        signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        const isRateLimit = response.status === 429;
        setMessages((prev) => [
          ...prev,
          {
            id: createId(),
            role: "assistant",
            content:
              body?.error ??
              (isRateLimit
                ? "지금 사용자가 많아 잠시 후 다시 시도해주세요."
                : "답변을 생성하는 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요."),
            variant: isRateLimit ? "rate-limit" : "error",
          },
        ]);
        return;
      }

      const data = (await response.json()) as ChatSuccessResponse;
      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: "assistant",
          content: data.answer,
          sources: data.sources,
        },
      ]);
    } catch (err) {
      const timedOut = err instanceof DOMException && err.name === "TimeoutError";
      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: "assistant",
          content: timedOut
            ? "응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요."
            : "네트워크 연결에 문제가 있습니다. 연결 상태를 확인한 뒤 다시 시도해주세요.",
          variant: "error",
        },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendQuestion(input);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-slate-100">
      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
            <div>
              <p className="text-lg font-medium text-slate-700">
                안전에 대해 무엇이든 물어보세요
              </p>
              <p className="mt-1 text-sm text-slate-500">
                생애주기별 안전교육 교재에서 근거를 찾아 답변해 드립니다.
              </p>
            </div>
            <div className="flex w-full max-w-md flex-col gap-2">
              {EXAMPLE_QUESTIONS.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => void sendQuestion(question)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-left text-sm text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {isLoading && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-slate-200 bg-white p-3 sm:p-4"
      >
        <div className="flex items-end gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="질문을 입력하세요"
            maxLength={1000}
            disabled={isLoading}
            className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 sm:text-base"
          />
          <button
            type="submit"
            disabled={isLoading || input.trim().length === 0}
            aria-label="전송"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
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
              <path d="M22 2 11 13" />
              <path d="M22 2 15 22l-4-9-9-4z" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
