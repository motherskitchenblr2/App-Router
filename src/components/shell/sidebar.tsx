import { useEffect } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Cpu, MessageSquare, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/lib/chat-store";
import { Button } from "@/components/ui/button";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid h-8 w-8 place-items-center rounded-xl bg-accent font-sans text-base font-black text-accent-ink",
        className,
      )}
    >
      ◆
    </span>
  );
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const conversations = useChatStore((s) => s.conversations);
  const activeId = useChatStore((s) => s.activeId);
  const ready = useChatStore((s) => s.ready);
  const refresh = useChatStore((s) => s.refreshConversations);
  const open = useChatStore((s) => s.openConversation);
  const remove = useChatStore((s) => s.removeConversation);
  const newConv = useChatStore((s) => s.newConversation);
  const location = useLocation();
  const { user, isPending } = useCurrentUserState();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const navigate = () => onNavigate?.();

  const itemCls = (active: boolean) =>
    cn(
      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
      active ? "bg-elevated text-ink" : "text-muted hover:bg-surface hover:text-ink",
    );

  return (
    <div className="flex h-full w-full flex-col gap-2 p-3">
      <div className="flex items-center gap-2.5 px-2 pb-2 pt-1">
        <BrandMark />
        <div className="leading-tight">
          <div className="text-[15px] font-semibold text-ink">GrokShell</div>
          <div className="text-[10px] tracking-wide text-faint">FREE LOCAL AI</div>
        </div>
      </div>

      <Button variant="primary" className="justify-start gap-2 rounded-xl" onClick={() => void newConv()}>
        <Plus className="h-4 w-4" />
        New chat
      </Button>

      <nav className="mt-1 flex flex-col gap-1">
        <Link to="/chat" className={itemCls(location.pathname === "/chat")} onClick={navigate}>
          <MessageSquare className="h-4 w-4" />
          Chat
        </Link>
        <Link
          to="/device-adviser"
          className={itemCls(location.pathname === "/device-adviser")}
          onClick={navigate}
        >
          <Cpu className="h-4 w-4" />
          Device Adviser
        </Link>
      </nav>

      <div className="mt-3 flex items-center justify-between px-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-faint">
          Conversations
        </span>
        {ready && conversations.length > 0 && (
          <span className="text-[11px] text-faint">{conversations.length}</span>
        )}
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        {!ready ? (
          <div className="space-y-2 px-1 pt-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-9 animate-pulse rounded-xl bg-surface" />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <p className="px-2 pt-2 text-xs leading-relaxed text-faint">
            No conversations yet. Start chatting or let the Device Adviser pick a
            model for your hardware.
          </p>
        ) : (
          <div className="space-y-1 px-1 pt-1">
            {conversations.map((c) => (
              <div
                key={c.id}
                className={cn(
                  "group flex items-center gap-1 rounded-xl pl-3 pr-1 py-2 transition-colors",
                  c.id === activeId ? "bg-elevated" : "hover:bg-surface",
                )}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 cursor-pointer truncate text-left text-sm text-muted group-hover:text-ink"
                  onClick={() => {
                    void open(c.id);
                    navigate();
                  }}
                  title={c.title}
                >
                  {c.title}
                </button>
                <button
                  type="button"
                  aria-label="Delete conversation"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-faint opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                  onClick={() => void remove(c.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-line pt-2">
        {isPending ? (
          <div className="h-9 animate-pulse rounded-full bg-surface" />
        ) : (
          <>
            <SignedIn>
              <UserButton />
            </SignedIn>
            <SignedOut>
              <Link
                to="/login"
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted transition-colors hover:bg-surface hover:text-ink"
              >
                <ShieldCheck className="h-4 w-4" />
                Sign in to sync chats
              </Link>
            </SignedOut>
          </>
        )}
      </div>
    </div>
  );
}