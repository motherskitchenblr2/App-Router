import { useEffect, useRef } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Home, Plus, X, Settings, Sun, Moon, PanelLeft, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/lib/chat-store";
import { NEW_TAB, useUiStore } from "@/lib/ui-store";

function tabTitle(id: string): string {
  if (id === NEW_TAB) return "New session";
  const conv = useChatStore.getState().conversations.find((c) => c.id === id);
  return conv?.title || "Session";
}

export function Titlebar({ onOpenMobileNav }: { onOpenMobileNav?: () => void }) {
  const openTabs = useUiStore((s) => s.openTabs);
  const activeTab = useUiStore((s) => s.activeTab);
  const openTab = useUiStore((s) => s.openTab);
  const closeTab = useUiStore((s) => s.closeTab);
  const activateTab = useUiStore((s) => s.activateTab);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);

  const conversations = useChatStore((s) => s.conversations);
  const activeId = useChatStore((s) => s.activeId);
  const ephemeral = useChatStore((s) => s.ephemeral);
  const openConversation = useChatStore((s) => s.openConversation);
  const newConversation = useChatStore((s) => s.newConversation);

  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync the store with the class applied at module load (post-hydration only,
  // so the toggle icon can't mismatch the server render).
  useEffect(() => {
    const t = document.documentElement.classList.contains("dark") ? "dark" : "light";
    if (useUiStore.getState().theme !== t) useUiStore.setState({ theme: t });
  }, []);

  // A session that just got its server id replaces the "new" sentinel tab.
  useEffect(() => {
    if (activeId && activeTab === NEW_TAB && !ephemeral) {
      useUiStore.setState((s) => ({
        openTabs: s.openTabs.map((t) => (t === NEW_TAB ? activeId : t)),
        activeTab: activeId,
      }));
    }
  }, [activeId, activeTab, ephemeral]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [openTabs.length]);

  const activate = (id: string) => {
    activateTab(id);
    if (id === NEW_TAB) {
      void newConversation();
    } else {
      void openConversation(id);
    }
    void navigate({ to: "/chat" });
  };

  const startNew = () => {
    if (!openTabs.includes(NEW_TAB)) openTab(NEW_TAB);
    else activateTab(NEW_TAB);
    void newConversation();
    void navigate({ to: "/chat" });
  };

  const onCloseTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const wasActive = activeTab === id;
    const idx = openTabs.indexOf(id);
    closeTab(id);
    if (wasActive) {
      const next =
        openTabs.filter((t) => t !== id)[Math.max(0, idx - 1)] ?? openTabs.filter((t) => t !== id)[0];
      activate(next ?? NEW_TAB);
      if (next && next !== NEW_TAB) void openConversation(next);
      else void newConversation();
      if (!next) void navigate({ to: "/" });
    }
  };

  return (
    <header className="flex h-9 shrink-0 items-center gap-1 border-b border-line bg-canvas pr-1.5 pl-1">
      <button
        type="button"
        aria-label="Home"
        title="Home"
        onClick={() => void navigate({ to: "/" })}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-icon transition-colors hover:bg-hover"
      >
        <Home className="h-3.5 w-3.5" />
      </button>

      <button
        type="button"
        aria-label="Toggle sidebar"
        title="Toggle sidebar"
        onClick={() => {
          if (window.innerWidth < 768) onOpenMobileNav?.();
          else toggleSidebar();
        }}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-hover hover:text-ink"
      >
        <PanelLeft className="h-3.5 w-3.5" />
      </button>

      {/* Session tabs */}
      <div className="relative min-w-0 flex-1">
        <div
          ref={scrollRef}
          className="scroll-thin flex items-center gap-0.5 overflow-x-auto"
          style={{ scrollbarWidth: "none" }}
        >
          {openTabs.map((id) => {
            const active = id === activeTab;
            return (
              <div
                key={id}
                role="tab"
                tabIndex={0}
                aria-selected={active}
                onClick={() => activate(id)}
                onKeyDown={(e) => e.key === "Enter" && activate(id)}
                className={cn(
                  "group flex h-7 max-w-48 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-xs transition-colors",
                  active
                    ? "bg-elevated font-medium text-ink"
                    : "text-muted hover:bg-hover hover:text-ink",
                )}
              >
                <span className="truncate">{tabTitle(id)}</span>
                <button
                  type="button"
                  aria-label="Close tab"
                  onClick={(e) => onCloseTab(e, id)}
                  className="grid h-4 w-4 shrink-0 place-items-center rounded opacity-0 transition-opacity group-hover:opacity-100 hover:bg-pressed"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
        {/* Right fade so overflowing tabs read as scrollable */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-canvas to-transparent" />
      </div>

      <button
        type="button"
        aria-label="New session"
        title="New session"
        onClick={startNew}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-hover hover:text-ink"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>

      <div className="flex shrink-0 items-center gap-0.5">
        <Link
          to="/device-adviser"
          aria-label="Device Adviser"
          title="Device Adviser"
          className="hidden h-7 w-7 place-items-center rounded-md text-muted transition-colors hover:bg-hover hover:text-ink sm:grid"
        >
          <Zap className="h-3.5 w-3.5" />
        </Link>
        <button
          type="button"
          aria-label="Toggle theme"
          title={theme === "light" ? "Switch to dark" : "Switch to light"}
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          className="grid h-7 w-7 place-items-center rounded-md text-muted transition-colors hover:bg-hover hover:text-ink"
        >
          {theme === "light" ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          aria-label="Settings"
          title="Settings"
          onClick={() => setSettingsOpen(true)}
          className="grid h-7 w-7 place-items-center rounded-md text-muted transition-colors hover:bg-hover hover:text-ink"
        >
          <Settings className="h-3.5 w-3.5" />
        </button>
        <span className="ml-1 hidden h-5 items-center rounded-md bg-elevated px-1.5 font-mono text-[10px] text-muted sm:flex">
          root
        </span>
      </div>
    </header>
  );
}
