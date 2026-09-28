import { memo, useState } from "react";
import { Copy, Check, RotateCcw, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Markdown } from "./markdown";
import { useChatStore } from "@/lib/chat-store";

export const MessageItem = memo(function MessageItem({
  message,
  index,
}: {
  message: {
    role: "user" | "assistant" | "system";
    content: string;
    reasoning?: string;
  };
  index: number;
}) {
  const streaming = useChatStore((s) => s.streaming);
  const regenerate = useChatStore((s) => s.regenerate);
  const settings = useChatStore((s) => s.settings);
  const autonomy = useChatStore((s) => s.settings.autonomy);
  const isLast = useChatStore((s) => s.messages.length - 1 === index && s.messages.length > 0);
  const [copied, setCopied] = useState<null | "msg" | "raw">(null);
  const [thoughtOpen, setThoughtOpen] = useState(false);

  const copy = async (kind: "msg" | "raw") => {
    const payload =
      kind === "raw"
        ? `${settings.modelId}\n\n${message.content}`
        : message.content;
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      /* clipboard unavailable */
    }
  };

  const onRevert = () => {
    if (autonomy !== "full-auto" && !window.confirm("Revert to this message and regenerate?")) {
      return;
    }
    void regenerate();
  };

  if (message.role === "user") {
    return (
      <div className="group flex animate-fade-up justify-end">
        <div className="max-w-[85%] rounded-lg bg-elevated px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap text-ink">
          {message.content}
        </div>
        <div className="mt-1 ml-2 flex shrink-0 items-start opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            aria-label="Copy message"
            title="Copy message"
            onClick={() => void copy("msg")}
            className="grid h-6 w-6 place-items-center rounded-md text-muted transition-colors hover:bg-hover hover:text-ink"
          >
            {copied === "msg" ? <Check className="h-3 w-3 text-ok" /> : <Copy className="h-3 w-3" />}
          </button>
        </div>
      </div>
    );
  }

  // Streaming placeholder — before any content lands.
  if (!message.content) {
    return (
      <div className="flex animate-fade-up flex-col gap-1.5 text-[12px] text-muted">
        {message.reasoning ? (
          <span className="flex h-5 w-fit items-center gap-1.5 rounded-md bg-elevated px-2">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-faint" />
            Thinking…
            <span className="max-w-md truncate text-faint">{message.reasoning}</span>
          </span>
        ) : (
          <span className="flex h-5 w-fit items-center gap-1.5 rounded-md bg-elevated px-2">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-faint" />
            Thinking…
          </span>
        )}
      </div>
    );
  }

  const thoughtCount = message.reasoning ? 1 : 0;

  return (
    <div className="group flex animate-fade-up flex-col gap-1">
      {/* Meta chips: what produced this */}
      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-faint">
        <span className="rounded-md bg-elevated px-1.5 py-0.5 font-mono">{settings.modelId}</span>
        <span className="rounded-md bg-elevated px-1.5 py-0.5">
          {Math.ceil(message.content.length / 4)} tok
        </span>
        {thoughtCount > 0 && (
          <button
            type="button"
            onClick={() => setThoughtOpen((o) => !o)}
            aria-expanded={thoughtOpen}
            className="flex items-center gap-0.5 rounded-md bg-elevated px-1.5 py-0.5 transition-colors hover:text-ink"
          >
            <ChevronRight
              className={cn("h-2.5 w-2.5 transition-transform", thoughtOpen && "rotate-90")}
            />
            {thoughtCount} Thought
          </button>
        )}
      </div>

      {thoughtOpen && message.reasoning && (
        <div className="scroll-thin max-h-52 overflow-y-auto rounded-md bg-elevated px-3 py-2 text-[12px] whitespace-pre-wrap text-muted">
          {message.reasoning}
        </div>
      )}

      <div className="text-[13px] leading-relaxed text-ink">
        <Markdown>{message.content}</Markdown>
        {streaming && isLast && <span className="stream-caret" />}
      </div>

      {/* Hover actions */}
      <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={() => void copy("msg")}
          className="flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] text-muted transition-colors hover:bg-hover hover:text-ink"
        >
          {copied === "msg" ? <Check className="h-3 w-3 text-ok" /> : <Copy className="h-3 w-3" />}
          {copied === "msg" ? "Copied" : "Copy"}
        </button>
        <button
          type="button"
          onClick={() => void copy("raw")}
          className="flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] text-muted transition-colors hover:bg-hover hover:text-ink"
        >
          {copied === "raw" ? (
            <Check className="h-3 w-3 text-ok" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
          {copied === "raw" ? "Copied" : "Copy response"}
        </button>
        {isLast && !streaming && (
          <button
            type="button"
            onClick={onRevert}
            className="flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] text-muted transition-colors hover:bg-hover hover:text-ink"
          >
            <RotateCcw className="h-3 w-3" />
            Revert message
          </button>
        )}
      </div>
    </div>
  );
});
