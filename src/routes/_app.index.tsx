import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Plus, MessageSquare, Cpu, Settings, HelpCircle, ArrowRight, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/lib/chat-store";
import { useUiStore } from "@/lib/ui-store";

export const Route = createFileRoute("/_app/")({ component: Home });

function dayGroup(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days <= 7) return "Previous 7 days";
  if (days <= 30) return "Previous 30 days";
  return "Older";
}

function Home() {
  const conversations = useChatStore((s) => s.conversations);
  const ready = useChatStore((s) => s.ready);
  const refresh = useChatStore((s) => s.refreshConversations);
  const open = useChatStore((s) => s.openConversation);
  const newConversation = useChatStore((s) => s.newConversation);
  const newEphemeral = useChatStore((s) => s.newEphemeralConversation);
  const openTab = useUiStore((s) => s.openTab);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const [mounted, setMounted] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    void refresh();
    setMounted(true);
  }, [refresh]);

  const startNew = () => {
    openTab("new");
    void newConversation();
    void navigate({ to: "/chat" });
  };

  const startIncognito = () => {
    openTab("new");
    void newEphemeral();
    void navigate({ to: "/chat" });
  };

  const openSession = (id: string) => {
    openTab(id);
    void open(id);
    void navigate({ to: "/chat" });
  };

  const groups: Array<[string, typeof conversations]> = [];
  for (const c of conversations) {
    const g = dayGroup(c.updated_at);
    const found = groups.find(([k]) => k === g);
    if (found) found[1].push(c);
    else groups.push([g, [c]]);
  }

  return (
    <div className="scroll-thin flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:py-14">
        {/* Heading */}
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-medium tracking-tight text-ink">Projects</h1>
          <p className="text-[13px] text-muted">
            Local models on your own hardware — no cloud accounts, no usage caps.
          </p>
        </div>

        {/* Project cards */}
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={startNew}
            className="group flex flex-col gap-2 rounded-lg bg-surface p-4 text-left hairline transition-colors hover:border-line-strong"
          >
            <span className="flex items-center justify-between">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-elevated text-ink">
                <MessageSquare className="h-3.5 w-3.5" />
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-faint opacity-0 transition-opacity group-hover:opacity-100" />
            </span>
            <span className="text-[13px] font-medium text-ink">New session</span>
            <span className="text-[11px] text-muted">
              Start a fresh chat with your local Ollama models.
            </span>
          </button>

          <Link
            to="/device-adviser"
            className="group flex flex-col gap-2 rounded-lg bg-surface p-4 text-left hairline transition-colors hover:border-line-strong"
          >
            <span className="flex items-center justify-between">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-elevated text-ink">
                <Cpu className="h-3.5 w-3.5" />
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-faint opacity-0 transition-opacity group-hover:opacity-100" />
            </span>
            <span className="text-[13px] font-medium text-ink">Device Adviser</span>
            <span className="text-[11px] text-muted">
              Probe this machine and find the best model it can run.
            </span>
          </Link>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={startIncognito}
            className="flex h-8 items-center gap-1.5 rounded-md bg-surface px-3 text-xs text-muted hairline transition-colors hover:text-ink"
          >
            <EyeOff className="h-3.5 w-3.5" />
            Incognito session
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="flex h-8 items-center gap-1.5 rounded-md bg-surface px-3 text-xs text-muted hairline transition-colors hover:text-ink"
          >
            <Settings className="h-3.5 w-3.5" />
            Settings
          </button>
          <a
            href="https://opencode.ai/docs"
            target="_blank"
            rel="noreferrer"
            className="flex h-8 items-center gap-1.5 rounded-md bg-surface px-3 text-xs text-muted hairline transition-colors hover:text-ink"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            Help
          </a>
        </div>

        {/* Sessions by day */}
        <div className="flex flex-col gap-3">
          <div className="text-[11px] font-medium tracking-wide text-faint uppercase">
            Recent sessions
          </div>
          {mounted && !ready && <div className="text-[12px] text-faint">Loading…</div>}
          {ready && conversations.length === 0 && (
            <div className="rounded-lg bg-surface px-4 py-6 text-center text-[12px] text-faint hairline">
              No sessions yet — start one above and it will show up here.
            </div>
          )}
          {groups.map(([label, items]) => (
            <div key={label} className="flex flex-col gap-1">
              <div className="text-[10px] text-faint">{label}</div>
              <div className="flex flex-col gap-1">
                {items.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => openSession(c.id)}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-md bg-surface px-3 py-2 text-left hairline transition-colors",
                      "hover:border-line-strong",
                    )}
                  >
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-elevated font-mono text-[9px] text-muted">
                      R
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12px] text-ink">
                      {c.title}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-faint">root</span>
                    <ArrowRight className="h-3 w-3 shrink-0 text-faint opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-line pt-4 text-[11px] text-faint">
          Tip: press <kbd className="rounded bg-elevated px-1 py-0.5 font-mono text-[10px]">/</kbd>{" "}
          in the composer for commands, or open{" "}
          <kbd className="rounded bg-elevated px-1 py-0.5 font-mono text-[10px]">@</kbd> for
          context.
        </div>
      </div>
    </div>
  );
}
