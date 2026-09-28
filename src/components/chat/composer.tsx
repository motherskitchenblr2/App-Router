import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Square, Plus, AtSign, Paperclip, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useChatStore } from "@/lib/chat-store";
import { useUiStore, NEW_TAB } from "@/lib/ui-store";
import { ModelPicker } from "@/components/chat/model-picker";
import { cn } from "@/lib/utils";

interface Attachment {
  name: string;
  text: string;
}

const THOUGHT_LEVELS = ["off", "low", "medium", "high"] as const;

export function Composer() {
  const [text, setText] = useState("");
  const [menu, setMenu] = useState<null | "slash" | "at">(null);
  const [cursor, setCursor] = useState(0);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const send = useChatStore((s) => s.send);
  const stop = useChatStore((s) => s.stop);
  const streaming = useChatStore((s) => s.streaming);
  const streamError = useChatStore((s) => s.streamError);
  const settings = useChatStore((s) => s.settings);
  const updateSettings = useChatStore((s) => s.updateSettings);
  const conversations = useChatStore((s) => s.conversations);
  const newConversation = useChatStore((s) => s.newConversation);
  const newEphemeral = useChatStore((s) => s.newEphemeralConversation);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const openTab = useUiStore((s) => s.openTab);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const resize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  useEffect(resize, [text]);

  // Close menus when the trigger token is gone.
  useEffect(() => {
    if (menu === "slash" && !text.startsWith("/")) setMenu(null);
    if (menu === "at" && !text.startsWith("@")) setMenu(null);
  }, [text, menu]);

  const commands = useMemo(
    () => [
      {
        cmd: "/new",
        desc: "Start a fresh session",
        run: () => {
          openTab(NEW_TAB);
          void newConversation();
          void navigate({ to: "/chat" });
        },
      },
      {
        cmd: "/incognito",
        desc: "Session that is never saved",
        run: () => {
          openTab(NEW_TAB);
          void newEphemeral();
          void navigate({ to: "/chat" });
        },
      },
      {
        cmd: "/settings",
        desc: "Open settings",
        run: () => setSettingsOpen(true),
      },
      {
        cmd: "/device",
        desc: "Open the Device Adviser",
        run: () => void navigate({ to: "/device-adviser" }),
      },
      {
        cmd: "/model",
        desc: "Switch the active model",
        run: () => document.getElementById("composer-model-button")?.click(),
      },
    ],
    [navigate, newConversation, newEphemeral, openTab, setSettingsOpen],
  );

  const filteredCommands = text.startsWith("/")
    ? commands.filter((c) => c.cmd.startsWith(text.split(/\s/)[0].toLowerCase()))
    : [];

  const atMatches = text.startsWith("@")
    ? conversations.filter((c) =>
        c.title.toLowerCase().includes(text.slice(1).split(/\s/)[0].toLowerCase()),
      )
    : [];

  const runCommand = (run: () => void) => {
    setText("");
    setMenu(null);
    setCursor(0);
    requestAnimationFrame(resize);
    run();
  };

  const mentionSession = (title: string) => {
    const rest = text.slice(1);
    setText(`@${title}${rest.slice(rest.search(/\s/) === -1 ? rest.length : rest.search(/\s/))} `);
    setMenu(null);
    textareaRef.current?.focus();
  };

  const attachFiles = async (files: FileList | null) => {
    if (!files) return;
    const next: Attachment[] = [];
    for (const f of Array.from(files).slice(0, 4)) {
      if (f.size > 512 * 1024) continue;
      const textContent = await f.text().catch(() => "");
      if (textContent) next.push({ name: f.name, text: textContent });
    }
    setAttachments((a) => [...a, ...next].slice(0, 6));
  };

  const submit = () => {
    if (streaming) return;
    if (menu === "slash" && filteredCommands.length > 0 && cursor === 0) {
      runCommand(filteredCommands[0].run);
      return;
    }
    const trimmed = text.trim();
    if (!trimmed) return;
    const body =
      attachments.length > 0
        ? `${trimmed}\n\n${attachments
            .map((a) => `File: ${a.name}\n\`\`\`\n${a.text.slice(0, 8000)}\n\`\`\``)
            .join("\n\n")}`
        : trimmed;
    void send(body);
    setText("");
    setAttachments([]);
    setMenu(null);
    setCursor(0);
    requestAnimationFrame(resize);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const menuOpen =
      (menu === "slash" && filteredCommands.length > 0) || (menu === "at" && atMatches.length > 0);
    if (menuOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => (c + 1) % (menu === "slash" ? filteredCommands.length : atMatches.length));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) =>
          c === 0
            ? (menu === "slash" ? filteredCommands.length : atMatches.length) - 1
            : c - 1,
        );
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (menu === "slash") runCommand(filteredCommands[cursor]?.run ?? filteredCommands[0].run);
        else mentionSession(atMatches[cursor]?.title ?? atMatches[0].title);
        return;
      }
      if (e.key === "Escape") {
        setMenu(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const onInput = (v: string) => {
    setText(v);
    setCursor(0);
    if (v.startsWith("/")) setMenu("slash");
    else if (v.startsWith("@")) setMenu("at");
    else setMenu(null);
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-3 pb-4">
      {streamError && (
        <div className="mb-2 rounded-md bg-danger/10 px-3 py-2 text-[11px] text-danger">
          {streamError}
        </div>
      )}

      {/* Slash / mention menus */}
      {menu === "slash" && filteredCommands.length > 0 && (
        <div className="mb-1.5 overflow-hidden rounded-md bg-surface py-1 hairline shadow-lg">
          <div className="px-2.5 pt-1 pb-1 text-[10px] font-medium tracking-wide text-faint uppercase">
            Commands
          </div>
          {filteredCommands.map((c, i) => (
            <button
              key={c.cmd}
              type="button"
              onMouseEnter={() => setCursor(i)}
              onClick={() => runCommand(c.run)}
              className={cn(
                "flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left text-xs transition-colors",
                i === cursor ? "bg-elevated text-ink" : "text-muted hover:text-ink",
              )}
            >
              <span className="w-20 shrink-0 font-mono">{c.cmd}</span>
              <span className="min-w-0 truncate text-faint">{c.desc}</span>
            </button>
          ))}
        </div>
      )}
      {menu === "at" && atMatches.length > 0 && (
        <div className="mb-1.5 overflow-hidden rounded-md bg-surface py-1 hairline shadow-lg">
          <div className="px-2.5 pt-1 pb-1 text-[10px] font-medium tracking-wide text-faint uppercase">
            Mention a session
          </div>
          {atMatches.slice(0, 6).map((c, i) => (
            <button
              key={c.id}
              type="button"
              onMouseEnter={() => setCursor(i)}
              onClick={() => mentionSession(c.title)}
              className={cn(
                "flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left text-xs transition-colors",
                i === cursor ? "bg-elevated text-ink" : "text-muted hover:text-ink",
              )}
            >
              <span className="min-w-0 truncate">{c.title}</span>
              <span className="ml-auto shrink-0 font-mono text-[10px] text-faint">root</span>
            </button>
          ))}
        </div>
      )}

      {/* Attachment chips */}
      {attachments.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {attachments.map((a, i) => (
            <span
              key={`${a.name}-${i}`}
              className="flex items-center gap-1 rounded-md bg-elevated py-1 pr-1 pl-2 text-[11px] text-muted"
            >
              <Paperclip className="h-3 w-3" />
              <span className="max-w-40 truncate">{a.name}</span>
              <button
                type="button"
                aria-label={`Remove ${a.name}`}
                onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                className="grid h-4 w-4 place-items-center rounded hover:bg-pressed"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="rounded-lg bg-surface p-2 hairline shadow-sm transition-colors focus-within:border-line-strong">
        <textarea
          ref={textareaRef}
          value={text}
          rows={1}
          onChange={(e) => onInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask anything, / for commands, @ for context…"
          className="scroll-thin max-h-50 w-full resize-none bg-transparent px-1.5 py-1 text-[13px] leading-relaxed text-ink placeholder:text-faint focus:outline-none"
        />

        <div className="mt-1 flex items-center gap-1">
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".txt,.md,.json,.csv,.ts,.tsx,.js,.jsx,.py,.html,.css,.yml,.yaml,.toml,.log"
            className="hidden"
            onChange={(e) => {
              void attachFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            aria-label="Add files"
            title="Add files"
            onClick={() => fileRef.current?.click()}
            className="grid h-7 w-7 place-items-center rounded-md text-muted transition-colors hover:bg-hover hover:text-ink"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>

          <ModelPicker />

          {/* Thinking level */}
          <button
            type="button"
            title="Thinking level"
            onClick={() => {
              const idx = THOUGHT_LEVELS.indexOf(settings.thinking);
              const next = THOUGHT_LEVELS[(idx + 1) % THOUGHT_LEVELS.length];
              updateSettings({ thinking: next });
            }}
            className={cn(
              "flex h-7 items-center gap-1 rounded-md px-2 text-[11px] transition-colors hover:bg-hover",
              settings.thinking === "off" ? "text-muted" : "text-ink",
            )}
            suppressHydrationWarning
          >
            <span aria-hidden>◐</span>
            <span suppressHydrationWarning>
              {settings.thinking === "off" ? "No think" : settings.thinking}
            </span>
          </button>

          <div className="flex-1" />

          <span className="hidden font-mono text-[10px] text-faint sm:inline">
            {text.trim() ? `${Math.ceil(text.length / 4)} tok` : ""}
          </span>

          {streaming ? (
            <button
              type="button"
              aria-label="Stop"
              title="Stop"
              onClick={stop}
              className="grid h-7 w-7 place-items-center rounded-md bg-ink text-canvas transition-opacity hover:opacity-90"
            >
              <Square className="h-3 w-3 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              aria-label="Send"
              title="Send"
              onClick={submit}
              disabled={!text.trim()}
              className="grid h-7 w-7 place-items-center rounded-md bg-ink text-canvas transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-30"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-1.5 flex items-center justify-center gap-1 text-[10px] text-faint">
        <AtSign className="h-2.5 w-2.5" />
        <span>Local models run on your own machine — responses stay on-device.</span>
      </div>
    </div>
  );
}
