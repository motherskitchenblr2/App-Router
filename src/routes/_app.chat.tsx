import { useEffect, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Cpu } from "lucide-react";
import { useChatStore } from "@/lib/chat-store";
import { MessageItem } from "@/components/chat/message-item";
import { Composer } from "@/components/chat/composer";
import { ModelPicker } from "@/components/chat/model-picker";
import { BrandMark } from "@/components/shell/sidebar";

const SUGGESTIONS = [
  "Summarize this document in 5 bullets",
  "Explain how neural networks learn",
  "Help me debug an error message",
  "Draft a polite follow-up email",
];

function EmptyState() {
  const send = useChatStore((s) => s.send);
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center px-4 text-center">
      <BrandMark className="mb-5 h-12 w-12 text-xl" />
      <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        How can I help?
      </h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
        Free open-source models run on your own hardware — no accounts on AI
        clouds, no usage caps. Pick a model, or let the Device Adviser find the
        best fit for this machine.
      </p>
      <div className="mt-8 grid w-full gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => void send(s)}
            className="group flex items-center justify-between gap-2 rounded-xl bg-surface px-4 py-3 text-left text-sm text-muted hairline transition-colors hover:bg-elevated hover:text-ink"
          >
            <span className="min-w-0 truncate">{s}</span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        ))}
      </div>
      <Link
        to="/device-adviser"
        className="mt-6 flex items-center gap-2 rounded-full bg-accent-soft px-4 py-2 text-xs font-medium text-accent transition-colors hover:bg-accent hover:text-accent-ink"
      >
        <Cpu className="h-3.5 w-3.5" />
        Scan my hardware
      </Link>
    </div>
  );
}

function ChatPage() {
  const messages = useChatStore((s) => s.messages);
  const conversations = useChatStore((s) => s.conversations);
  const activeId = useChatStore((s) => s.activeId);
  const ready = useChatStore((s) => s.ready);
  const streaming = useChatStore((s) => s.streaming);
  const refresh = useChatStore((s) => s.refreshConversations);
  const open = useChatStore((s) => s.openConversation);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Boot: load the list, then open the most recent conversation.
  useEffect(() => {
    void (async () => {
      await refresh();
      const state = useChatStore.getState();
      if (!state.activeId && state.conversations.length > 0) {
        void state.openConversation(state.conversations[0].id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streaming, activeId]);

  // Show the empty state whenever there is no thread to render — including an
  // auto-opened conversation with no messages (e.g. a send that never got to
  // save before the tab closed). Gating on `!activeId` left those visitors on a
  // permanently blank chat area with no greeting and no suggestions.
  const showEmpty = messages.length === 0 && !streaming;

  return (
    <div className="flex h-full flex-col">
      {/* Desktop model row */}
      <div className="hidden h-14 shrink-0 items-center border-b border-line px-4 md:flex">
        <ModelPicker />
        <div className="ml-auto text-[11px] text-faint">
          {messages.length} message{messages.length === 1 ? "" : "s"}
          {activeId ? " · saved to your account" : ""}
          {!ready && conversations.length === 0 ? " · loading…" : ""}
        </div>
      </div>

      <div ref={scrollRef} className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-4 py-6">
          {showEmpty ? (
            <EmptyState />
          ) : (
            <div className="flex flex-col gap-6 pb-4">
              {messages.map((m, i) => (
                <MessageItem key={`${i}-${m.role}`} message={m} index={i} />
              ))}
            </div>
          )}
        </div>
      </div>

      <Composer />
    </div>
  );
}

export const Route = createFileRoute("/_app/chat")({ component: ChatPage });