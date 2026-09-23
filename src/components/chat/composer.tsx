import { ArrowUp, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useChatStore } from "@/lib/chat-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PLACEHOLDERS = [
  "Ask anything…",
  "Ask a question about your code…",
  "Summarize this page for me…",
  "Explain a concept like I'm new…",
];

export function Composer() {
  const [text, setText] = useState("");
  const [placeholder, setPlaceholder] = useState(0);
  const send = useChatStore((s) => s.send);
  const stop = useChatStore((s) => s.stop);
  const streaming = useChatStore((s) => s.streaming);
  const streamError = useChatStore((s) => s.streamError);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setPlaceholder((p) => (p + 1) % PLACEHOLDERS.length), 4000);
    return () => clearInterval(timer);
  }, []);

  const resize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  const submit = () => {
    if (!text.trim() || streaming) return;
    void send(text);
    setText("");
    requestAnimationFrame(resize);
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-4">
      {streamError && (
        <div className="mb-2 rounded-lg bg-accent-soft px-3 py-2 text-xs text-accent">
          {streamError}
        </div>
      )}
      <div className="rounded-3xl bg-surface p-2 hairline shadow-[0_8px_40px_rgba(0,0,0,0.5)] transition-colors focus-within:border-line-strong">
        <textarea
          ref={textareaRef}
          value={text}
          rows={1}
          onChange={(e) => {
            setText(e.target.value);
            resize();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={PLACEHOLDERS[placeholder]}
          className="scroll-thin max-h-[200px] w-full resize-none bg-transparent px-3 py-2 text-[15px] leading-relaxed text-ink placeholder:text-faint focus:outline-none"
        />
        <div className="flex items-center justify-between px-1 pb-0.5">
          <span className="px-2 text-[11px] text-faint">
            Enter to send · Shift+Enter for a new line
          </span>
          <Button
            variant="primary"
            size="icon"
            aria-label={streaming ? "Stop generating" : "Send message"}
            onClick={() => (streaming ? stop() : submit())}
            className={cn(
              "h-9 w-9 rounded-full transition-all",
              streaming && "bg-ink text-canvas hover:bg-ink/90",
            )}
          >
            {streaming ? <Square className="h-3.5 w-3.5" /> : <ArrowUp className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}