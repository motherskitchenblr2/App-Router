import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowDown, Eye } from "lucide-react";
import { useChatStore } from "@/lib/chat-store";
import { MessageItem } from "@/components/chat/message-item";
import { Composer } from "@/components/chat/composer";

const SUGGESTIONS = [
  "Summarize this document in 5 bullets",
  "Explain how neural networks learn",
  "Help me debug an error message",
  "Draft a polite follow-up email",
];

function EmptyState() {
  const send = useChatStore((s) => s.send);
  const settings = useChatStore((s) => s.settings);
  const ephemeral = useChatStore((s) => s.ephemeral);
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center px-4 text-center">
      <span className="mb-4 grid h-9 w-9 place-items-center rounded-lg bg-ink text-sm font-bold text-canvas">
        ◆
      </span>
      <h1 className="text-[15px] font-medium tracking-tight text-ink">How can I help?</h1>
      {/* modelId comes from localStorage, which SSR can't see — tell React the
          text legitimately differs at hydration instead of regenerating. */}
      <p
        className="mt-1.5 max-w-md text-[12px] leading-relaxed text-muted"
        suppressHydrationWarning
      >
        {ephemeral
          ? "Incognito session — nothing here is saved. Ask anything."
          : `Running ${settings.modelId} locally through Ollama — no cloud, no caps.`}
      </p>
      <div className="mt-6 grid w-full gap-1.5 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => void send(s)}
            className="group flex items-center justify-between gap-2 rounded-md bg-surface px-3 py-2 text-left text-[12px] text-muted hairline transition-colors hover:border-line-strong hover:text-ink"
          >
            <span className="min-w-0 truncate">{s}</span>
            <ArrowDown className="h-3 w-3 shrink-0 -rotate-90 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        ))}
      </div>
    </div>
  );
}

function ChatPage() {
  const messages = useChatStore((s) => s.messages);
  const streaming = useChatStore((s) => s.streaming);
  const ready = useChatStore((s) => s.ready);
  const ephemeral = useChatStore((s) => s.ephemeral);
  const activeId = useChatStore((s) => s.activeId);
  const refresh = useChatStore((s) => s.refreshConversations);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Keep pinned to the bottom while messages stream in.
  useEffect(() => {
    if (atBottom && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, atBottom]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAtBottom(dist < 48);
  };

  const jumpToLatest = () => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    setAtBottom(true);
  };

  const showEmpty = messages.length === 0 && !streaming;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* Session meta strip */}
      <div className="flex h-7 shrink-0 items-center gap-2 border-b border-line px-3 text-[11px] text-faint">
        <Eye className="h-3 w-3" />
        <span className="truncate">
          {ephemeral
            ? "Incognito — not saved"
            : activeId
              ? "Session saved locally"
              : "New session"}
        </span>
        <span className="ml-auto font-mono text-[10px]">{messages.length} messages</span>
      </div>

      {showEmpty ? (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <EmptyState />
        </div>
      ) : (
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="scroll-thin min-h-0 flex-1 overflow-y-auto"
        >
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
            {messages.map((m, i) => (
              <MessageItem key={`${m.role}-${i}`} message={m} index={i} />
            ))}
            <div className="h-4" />
          </div>
        </div>
      )}

      {/* Jump to latest */}
      {!atBottom && !showEmpty && (
        <button
          type="button"
          onClick={jumpToLatest}
          className="absolute bottom-32 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-[11px] text-muted hairline shadow-lg transition-colors hover:text-ink"
        >
          <ArrowDown className="h-3 w-3" />
          Jump to latest
        </button>
      )}

      {/* Composer */}
      <div className="shrink-0 border-t border-line bg-canvas">
        <Composer />
      </div>
      {!ready && (
        <div className="absolute inset-x-0 top-0 h-0.5 animate-pulse bg-elevated" />
      )}
    </div>
  );
}

export const Route = createFileRoute("/_app/chat")({
  component: ChatPage,
});
