import ChatWindow from "@/components/ChatWindow";

export default function HomePage() {
  return (
    <main className="mx-auto flex h-dvh max-w-3xl flex-col sm:px-4 sm:py-6">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white ring-slate-900/5 sm:rounded-3xl sm:shadow-2xl sm:shadow-slate-900/10 sm:ring-1">
        <ChatWindow />
      </div>
    </main>
  );
}
