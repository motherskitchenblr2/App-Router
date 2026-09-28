import { useState } from "react";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { X } from "lucide-react";
import { Toaster } from "sonner";
import { BrandMark, SidebarContent } from "@/components/shell/sidebar";
import { Titlebar } from "@/components/shell/titlebar";
import { SettingsDialog } from "@/components/shell/settings-dialog";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useUiStore } from "@/lib/ui-store";
import { cn } from "@/lib/utils";

function Splash() {
  return (
    <div className="grid h-dvh place-items-center bg-canvas">
      <div className="flex animate-pulse flex-col items-center gap-3">
        <BrandMark className="h-10 w-10 text-lg" />
        <span className="text-[13px] text-faint">Loading…</span>
      </div>
    </div>
  );
}

function AppLayout() {
  const [mobileNav, setMobileNav] = useState(false);
  const { user, isPending } = useCurrentUserState();
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);

  // Gate: wait for the session to resolve, then redirect signed-out visitors.
  if (isPending) return <Splash />;
  if (!user) return <RedirectToSignIn />;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-canvas text-ink">
      <Titlebar onOpenMobileNav={() => setMobileNav(true)} />

      <div className="flex min-h-0 flex-1">
        {/* Desktop sidebar */}
        <aside
          className={cn(
            "hidden w-60 shrink-0 border-r border-line transition-[width] duration-150 md:block",
            !sidebarOpen && "md:hidden",
          )}
        >
          <SidebarContent />
        </aside>

        {/* Mobile drawer */}
        {mobileNav && (
          <div className="fixed inset-0 z-40 flex md:hidden">
            <div
              className="absolute inset-0 bg-ink/30"
              role="presentation"
              onClick={() => setMobileNav(false)}
            />
            <aside className="relative flex h-full w-72 flex-col border-r border-line bg-canvas">
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setMobileNav(false)}
                className="absolute top-2 right-2 z-10 grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-hover hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
              <SidebarContent onNavigate={() => setMobileNav(false)} />
            </aside>
          </div>
        )}

        <main className="flex min-w-0 flex-1 flex-col">
          <Outlet />
        </main>
      </div>

      <SettingsDialog />
      <Toaster position="top-center" />
    </div>
  );
}

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});
