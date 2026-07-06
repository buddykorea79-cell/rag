"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import MessageBubble, { ChatMessage } from "@/components/MessageBubble";
import TypingIndicator from "@/components/TypingIndicator";
import type { ChatSuccessResponse } from "@/lib/types";

/** 서버 처리(재시도 포함)보다 여유 있게 잡은 클라이언트 대기 상한 */
const CLIENT_TIMEOUT_MS = 60_000;

const EXAMPLE_QUESTIONS = [
  { icon: "🌀", text: "태풍이 올 때 가정에서 어떻게 대비해야 하나요?" },
  { icon: "🔥", text: "산불이 발생하면 어떻게 대피해야 하나요?" },
  { icon: "🏚️", text: "지진이 발생했을 때 행동 요령을 알려주세요." },
] as const;

let nextId = 0;
const createId = () => `msg-${nextId++}`;

export default function ChatWindow() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  async function sendQuestion(question: string) {
    const trimmed = question.trim();
    if (!trimmed || isLoading) return;

    const controller = new AbortController();
    abortRef.current = controller;

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
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(CLIENT_TIMEOUT_MS),
        ]),
      });
      // 새 채팅으로 초기화된 뒤 도착한 응답은 무시한다
      if (controller.signal.aborted) return;

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
      if (controller.signal.aborted) return;
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
      if (abortRef.current === controller) {
        setIsLoading(false);
        inputRef.current?.focus();
      }
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendQuestion(input);
  }

  /** 진행 중인 요청을 중단하고 대화를 처음 상태로 되돌린다 */
  function resetChat() {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setInput("");
    setIsLoading(false);
    inputRef.current?.focus();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-slate-200/80 bg-white/90 px-4 py-3.5 backdrop-blur sm:px-6">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30">
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
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold tracking-tight sm:text-lg">
            생애주기별 안전교육 챗봇
          </h1>
          <p className="truncate text-xs text-slate-500 sm:text-sm">
            안전교육 교재 내용을 근거로 답변해 드립니다
          </p>
        </div>
        <button
          type="button"
          onClick={resetChat}
          disabled={messages.length === 0 && !isLoading}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
          새 채팅
        </button>
      </header>

      <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 to-slate-100/80 px-4 py-4 sm:px-6 sm:py-6">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-8 text-center">
            <div className="flex flex-col items-center gap-4">
              <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-600/30">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-8 w-8"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              </span>
              <div>
                <p className="text-xl font-bold tracking-tight text-slate-800">
                  안전에 대해 무엇이든 물어보세요
                </p>
                <p className="mt-1.5 text-sm text-slate-500">
                  생애주기별 안전교육 교재에서 근거를 찾아 답변해 드립니다.
                </p>
              </div>
            </div>
            <div className="flex w-full max-w-md flex-col gap-2.5">
              {EXAMPLE_QUESTIONS.map(({ icon, text }) => (
                <button
                  key={text}
                  type="button"
                  onClick={() => void sendQuestion(text)}
                  className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
                >
                  <span className="text-lg" aria-hidden="true">
                    {icon}
                  </span>
                  <span className="flex-1">{text}</span>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-blue-500"
                  >
                    <path d="M5 12h14" />
                    <path d="M12 5l7 7-7 7" />
                  </svg>
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
        className="border-t border-slate-200/80 bg-white/90 p-3 backdrop-blur sm:p-4"
      >
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2 py-1.5 shadow-sm transition focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-100">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="질문을 입력하세요"
            maxLength={1000}
            disabled={isLoading}
            className="min-w-0 flex-1 bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-slate-400 disabled:text-slate-400 sm:text-base"
          />
          <button
            type="submit"
            disabled={isLoading || input.trim().length === 0}
            aria-label="전송"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
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
        <p className="mt-2 text-center text-[11px] text-slate-400">
          답변은 생애주기별 안전교육 교재 내용을 근거로 생성됩니다.
        </p>
      </form>
    </div>
  );
}
