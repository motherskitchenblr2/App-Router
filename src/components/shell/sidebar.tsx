import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  Cpu,
  MessageSquare,
  Plus,
  Settings,
  HelpCircle,
  Trash2,
  GitFork,
  Pencil,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useChatStore, type ConversationSummary } from "@/lib/chat-store";
import { useUiStore } from "@/lib/ui-store";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid h-8 w-8 place-items-center rounded-lg bg-ink font-sans text-base font-bold text-canvas",
        className,
      )}
    >
      ◆
    </span>
  );
}

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

function groupByDay(list: ConversationSummary[]): Array<[string, ConversationSummary[]]> {
  const order: Array<[string, ConversationSummary[]]> = [];
  for (const c of list) {
    const g = dayGroup(c.updated_at);
    const found = order.find(([k]) => k === g);
    if (found) found[1].push(c);
    else order.push([g, [c]]);
  }
  return order;
}

function SessionRow({ conv }: { conv: ConversationSummary }) {
  const activeId = useChatStore((s) => s.activeId);
  const open = useChatStore((s) => s.openConversation);
  const remove = useChatStore((s) => s.removeConversation);
  const fork = useChatStore((s) => s.forkConversation);
  const rename = useChatStore((s) => s.renameConversation);
  const autonomy = useChatStore((s) => s.settings.autonomy);
  const openTab = useUiStore((s) => s.openTab);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(conv.title);

  const active = activeId === conv.id;

  const confirmFirst = (label: string, critical: boolean, run: () => void) => {
    if (autonomy === "full-auto" || (autonomy === "ask-critical" && !critical)) {
      run();
      return;
    }
    if (window.confirm(label)) run();
  };

  const go = () => {
    openTab(conv.id);
    void open(conv.id);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 px-2">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              void rename(conv.id, draft);
              setEditing(false);
            }
            if (e.key === "Escape") setEditing(false);
          }}
          className="h-7 min-w-0 flex-1 rounded-md bg-surface px-2 text-xs text-ink hairline focus:border-line-strong focus:outline-none"
        />
        <button
          type="button"
          className="h-7 rounded-md px-1.5 text-[11px] text-muted hover:text-ink"
          onClick={() => {
            void rename(conv.id, draft);
            setEditing(false);
          }}
        >
          Save
        </button>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={go}
      onKeyDown={(e) => e.key === "Enter" && go()}
      className={cn(
        "group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
        active ? "bg-elevated text-ink" : "text-muted hover:bg-hover hover:text-ink",
      )}
    >
      <MessageSquare className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{conv.title}</span>
      <span className="hidden shrink-0 font-mono text-[10px] text-faint group-hover:hidden md:inline">
        root
      </span>
      <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          aria-label="Rename"
          title="Rename"
          onClick={(e) => {
            e.stopPropagation();
            setDraft(conv.title);
            setEditing(true);
          }}
          className="grid h-5 w-5 place-items-center rounded hover:bg-pressed"
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button
          type="button"
          aria-label="Fork"
          title="Fork session"
          onClick={(e) => {
            e.stopPropagation();
            confirmFirst("Fork this session?", false, () => void fork(conv.id));
          }}
          className="grid h-5 w-5 place-items-center rounded hover:bg-pressed"
        >
          <GitFork className="h-3 w-3" />
        </button>
        <button
          type="button"
          aria-label="Delete"
          title="Delete"
          onClick={(e) => {
            e.stopPropagation();
            confirmFirst(`Delete "${conv.title}"? This cannot be undone.`, true, () =>
              void remove(conv.id),
            );
          }}
          className="grid h-5 w-5 place-items-center rounded text-danger hover:bg-pressed"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </span>
    </div>
  );
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const conversations = useChatStore((s) => s.conversations);
  const ready = useChatStore((s) => s.ready);
  const refresh = useChatStore((s) => s.refreshConversations);
  const newConversation = useChatStore((s) => s.newConversation);
  const newEphemeral = useChatStore((s) => s.newEphemeralConversation);
  const settings = useChatStore((s) => s.settings);
  const openTab = useUiStore((s) => s.openTab);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [query, setQuery] = useState("");

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = query
    ? conversations.filter((c) => c.title.toLowerCase().includes(query.toLowerCase()))
    : conversations;
  const groups = groupByDay(filtered);

  const startNew = () => {
    openTab("new");
    void newConversation();
    onNavigate?.();
    void navigate({ to: "/chat" });
  };

  const startIncognito = () => {
    openTab("new");
    void newEphemeral();
    onNavigate?.();
    void navigate({ to: "/chat" });
  };

  return (
    <div className="flex h-full w-full flex-col gap-3 overflow-y-auto p-2">
      {/* Header */}
      <div className="flex items-center gap-2 px-1.5">
        <BrandMark className="h-6 w-6 text-xs" />
        <span className="flex-1 text-[13px] font-medium text-ink">opencode</span>
        <span className="font-mono text-[10px] text-faint">v2</span>
      </div>

      {/* New session */}
      <button
        type="button"
        onClick={startNew}
        className="flex h-8 items-center justify-between rounded-md bg-ink px-2.5 text-xs font-medium text-canvas transition-opacity hover:opacity-90"
      >
        New session
        <Plus className="h-3.5 w-3.5" />
      </button>

      <div className="relative">
        <Search className="absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search sessions…"
          className="h-8 w-full rounded-md bg-surface pr-2 pl-7 text-xs text-ink hairline focus:border-line-strong focus:outline-none"
        />
      </div>

      {/* Projects */}
      <div className="flex flex-col gap-0.5">
        <div className="px-1.5 pb-1 text-[10px] font-medium tracking-wide text-faint uppercase">
          Projects
        </div>
        <Link
          to="/chat"
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
            location.pathname === "/chat"
              ? "bg-elevated text-ink"
              : "text-muted hover:bg-hover hover:text-ink",
          )}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Chat
        </Link>
        <Link
          to="/device-adviser"
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
            location.pathname === "/device-adviser"
              ? "bg-elevated text-ink"
              : "text-muted hover:bg-hover hover:text-ink",
          )}
        >
          <Cpu className="h-3.5 w-3.5" />
          Device Adviser
        </Link>
      </div>

      {/* Sessions by day */}
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="px-1.5 text-[10px] font-medium tracking-wide text-faint uppercase">
          Sessions
        </div>
        {!ready && <div className="px-1.5 text-[11px] text-faint">Loading…</div>}
        {ready && filtered.length === 0 && (
          <div className="px-1.5 text-[11px] text-faint">
            {query ? "No matches." : "No sessions yet."}
          </div>
        )}
        {groups.map(([label, items]) => (
          <div key={label} className="flex flex-col gap-0.5">
            <div className="px-1.5 pb-0.5 text-[10px] text-faint">{label}</div>
            {items.map((c) => (
              <SessionRow key={c.id} conv={c} />
            ))}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-auto flex flex-col gap-0.5 border-t border-line pt-2">
        <button
          type="button"
          onClick={startIncognito}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted transition-colors hover:bg-hover hover:text-ink"
        >
          <span className="grid h-3.5 w-3.5 place-items-center rounded-full border border-line-strong text-[8px] leading-none">
            ∅
          </span>
          Incognito session
        </button>
        <button
          type="button"
          onClick={() => {
            setSettingsOpen(true);
            onNavigate?.();
          }}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted transition-colors hover:bg-hover hover:text-ink"
        >
          <Settings className="h-3.5 w-3.5" />
          Settings
        </button>
        <a
          href="https://opencode.ai/docs"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted transition-colors hover:bg-hover hover:text-ink"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          Help
        </a>
        {!isPending && user && (
          <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-faint">
            <span className="grid h-4 w-4 place-items-center rounded-full bg-elevated text-[9px] text-muted">
              {(user.primaryEmail ?? user.displayName ?? "U")[0]?.toUpperCase() ?? "U"}
            </span>
            <span className="min-w-0 truncate">{user.primaryEmail ?? user.displayName ?? "user"}</span>
          </div>
        )}
      </div>
    </div>
  );
}
