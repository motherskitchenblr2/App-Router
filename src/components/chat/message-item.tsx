import { memo } from "react";
import { Copy, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Markdown } from "./markdown";
import { useChatStore } from "@/lib/chat-store";
import { Badge } from "@/components/ui/badge";

export const MessageItem = memo(function MessageItem({
  message,
  index,
}: {
  message: { role: "user" | "assistant" | "system"; content: string };
  index: number;
}) {
  const streaming = useChatStore((s) => s.streaming);
  const regenerate = useChatStore((s) => s.regenerate);
  const settings = useChatStore((s) => s.settings);
  const isLast = useChatStore(
    (s) => s.messages.length - 1 === index && s.messages.length > 0,
  );

  if (message.role === "user") {
    return (
      <div className="flex justify-end animate-fade-up">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-elevated px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap hairline">
          {message.content}
        </div>
      </div>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
    } catch {
      /* noop */
    }
  };

  return (
    <div className="group flex gap-3 animate-fade-up">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg bg-accent-soft font-mono text-[11px] font-bold text-accent">
        AI
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xs font-medium text-muted">{settings.modelId}</span>
          <span className="text-[10px] text-faint">{settings.providerId}</span>
        </div>
        <div className="text-ink">
          {message.content ? (
            <Markdown>{message.content}</Markdown>
          ) : (
            <span className="text-faint">Thinking…</span>
          )}
          {isLast && streaming && message.content !== "" && <span className="stream-caret" />}
        </div>
        {message.content && (
          <div
            className={cn(
              "mt-1 flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100",
              streaming && isLast && "opacity-0",
            )}
          >
            <button
              type="button"
              onClick={copy}
              aria-label="Copy answer"
              className="flex h-7 w-7 items-center justify-center rounded-md text-faint transition-colors hover:bg-surface hover:text-ink"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => void regenerate()}
              aria-label="Regenerate answer"
              className="flex h-7 w-7 items-center justify-center rounded-md text-faint transition-colors hover:bg-surface hover:text-ink"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <Badge tone="neutral" className="ml-auto">
              {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
});