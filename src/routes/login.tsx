import { createFileRoute } from "@tanstack/react-router";
import { Cpu, Globe, ShieldCheck, WifiOff } from "lucide-react";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { BrandMark } from "@/components/shell/sidebar";
import { Button } from "@/components/ui/button";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

function Login() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return null;
  if (user) return <RedirectToSignIn to="/chat" />;

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4 py-10 text-ink">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <BrandMark className="h-12 w-12 text-xl" />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Welcome to GrokShell</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Free, open-source AI that runs on <span className="text-ink">your</span> device.
            Sign in to sync conversations across machines.
          </p>
        </div>

        <div className="mt-8 space-y-2.5">
          {authEnabled ? (
            GROK_PROVIDERS.map((p) => (
              <Button
                key={p.providerId}
                variant="secondary"
                className="w-full justify-center rounded-xl py-6 text-[15px]"
                onClick={() => signIn(p.providerId, { callbackURL: "/chat" })}
              >
                <Globe className="h-4 w-4" />
                Continue with {p.label}
              </Button>
            ))
          ) : (
            <p className="text-center text-sm text-faint">Sign-in is disabled on this build.</p>
          )}
        </div>

        <div className="mt-8 space-y-2 rounded-2xl bg-surface p-4 hairline">
          {[
            { icon: <WifiOff className="h-3.5 w-3.5" />, text: "Runs local models via Ollama — no API caps, ever." },
            { icon: <Cpu className="h-3.5 w-3.5" />, text: "Device Adviser scans your hardware and picks models that fit." },
            { icon: <ShieldCheck className="h-3.5 w-3.5" />, text: "Your chats and model weight files stay on your machine." },
          ].map((f) => (
            <div key={f.text} className="flex items-start gap-2.5 text-xs leading-relaxed text-muted">
              <span className="mt-0.5 text-ok">{f.icon}</span>
              {f.text}
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-faint">
          Open-source in spirit: the app itself is free, and every model it
          recommends is free and open source (Apache-2.0, MIT, Llama or Gemma
          terms).
        </p>
      </div>
    </main>
  );
}

export const Route = createFileRoute("/login")({ component: Login });