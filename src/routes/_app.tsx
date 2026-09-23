import { useState } from "react";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { Toaster } from "sonner";
import { BrandMark, SidebarContent } from "@/components/shell/sidebar";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { ModelPicker } from "@/components/chat/model-picker";

function Splash() {
  return (
    <div className="grid h-dvh place-items-center bg-canvas">
      <div className="flex animate-pulse flex-col items-center gap-3">
        <BrandMark className="h-10 w-10 text-lg" />
        <span className="text-sm text-faint">GrokShell</span>
      </div>
    </div>
  );
}

function AppLayout() {
  const [mobileNav, setMobileNav] = useState(false);
  const { user, isPending } = useCurrentUserState();

  // Gate: wait for the session to resolve, then redirect signed-out visitors.
  if (isPending) return <Splash />;
  if (!user) return <RedirectToSignIn />;

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas text-ink">
      {/* Desktop sidebar */}
      <aside className="hidden w-72 shrink-0 border-r border-line md:block">
        <SidebarContent />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-line px-3 md:hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Open menu"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-ink"
              onClick={() => setMobileNav(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <BrandMark className="h-7 w-7 text-sm" />
            <span className="text-sm font-semibold">GrokShell</span>
          </div>
          <ModelPicker />
        </header>

        <main className="min-h-0 min-w-0 flex-1">
          <Outlet />
        </main>
      </div>

      {/* Mobile drawer */}
      {mobileNav && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileNav(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-line bg-canvas">
            <div className="flex justify-end p-2">
              <button
                type="button"
                aria-label="Close menu"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-ink"
                onClick={() => setMobileNav(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <SidebarContent onNavigate={() => setMobileNav(false)} />
          </div>
        </div>
      )}

      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "#17171a",
            color: "#f4f4f5",
            border: "1px solid #212125",
            borderRadius: "12px",
          },
        }}
      />
    </div>
  );
}

export const Route = createFileRoute("/_app")({ component: AppLayout });