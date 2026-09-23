import { useEffect, useState } from "react";
import { Cpu, Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/lib/chat-store";
import {
  ALL_PROVIDER_INFOS,
  getProvider,
  type AiSettings,
} from "@/lib/ai";
import type { ModelEntry } from "@/lib/ai/types";
import { Badge } from "@/components/ui/badge";

export function ModelPicker() {
  const settings = useChatStore((s) => s.settings);
  const updateSettings = useChatStore((s) => s.updateSettings);
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [availability, setAvailability] = useState<Record<string, "ok" | "down">>({});

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const provider = getProvider(settings.providerId);
    provider
      .listModels()
      .then((m) => {
        if (cancelled) return;
        setModels(m);
        const fallback =
          m.find((x) => x.id === settings.modelId) ??
          m.find((x) => x.modalities.includes("text")) ??
          m[0];
        if (fallback && fallback.id !== settings.modelId) {
          updateSettings({ modelId: fallback.id });
        }
      })
      .catch(() => {
        if (!cancelled) setModels([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    provider
      .isAvailable()
      .then((r) => {
        if (!cancelled) setAvailability((a) => ({ ...a, [settings.providerId]: r.ok ? "ok" : "down" }));
      })
      .catch(() => {
        if (!cancelled) setAvailability((a) => ({ ...a, [settings.providerId]: "down" }));
      });
    return () => {
      cancelled = true;
    };
  }, [open, settings.providerId, settings.modelId, updateSettings]);

  const pickProvider = (id: AiSettings["providerId"]) => {
    if (id === settings.providerId) return;
    updateSettings({ providerId: id, modelId: "" });
  };

  const activeInfo = ALL_PROVIDER_INFOS.find((p) => p.id === settings.providerId);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-9 max-w-[220px] items-center gap-2 rounded-full bg-surface px-3.5 text-sm font-medium text-ink hairline transition-colors hover:bg-elevated",
        )}
      >
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            availability[settings.providerId] === "down"
              ? "bg-danger"
              : availability[settings.providerId] === "ok"
                ? "bg-ok"
                : "bg-faint",
          )}
        />
        <span className="truncate">{settings.modelId || "Select a model"}</span>
        <span className="hidden text-[11px] text-faint sm:inline">
          · {activeInfo?.label ?? settings.providerId}
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] rounded-2xl bg-elevated p-2 hairline shadow-[0_16px_60px_rgba(0,0,0,0.6)]">
            <div className="flex flex-wrap gap-1.5 px-1 pb-2 pt-1">
              {ALL_PROVIDER_INFOS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pickProvider(p.id)}
                  title={p.setupHint}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    settings.providerId === p.id
                      ? "bg-accent text-accent-ink"
                      : "bg-surface text-muted hairline hover:bg-overlay hover:text-ink",
                  )}
                >
                  {p.label}
                  {!p.uncapped && <span className="ml-1 opacity-70">(capped)</span>}
                </button>
              ))}
            </div>

            <div className="max-h-72 overflow-y-auto scroll-thin px-1 pb-1">
              {loading ? (
                <div className="flex items-center gap-2 px-2 py-4 text-xs text-faint">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading models…
                </div>
              ) : models.length === 0 ? (
                <div className="px-2 py-4 text-xs text-faint">
                  No models found for this source.
                </div>
              ) : (
                models.map((m) => {
                  const active = m.id === settings.modelId;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => updateSettings({ modelId: m.id })}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition-colors",
                        active ? "bg-surface hairline" : "hover:bg-surface/60",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-ink">{m.name}</span>
                          {m.license === "Apache-2.0" || m.license === "MIT" ? (
                            <Badge tone="ok">free</Badge>
                          ) : null}
                          {m.tags.includes("vision") && <Badge tone="accent">vision</Badge>}
                        </div>
                        <div className="truncate text-[11px] text-faint">
                          {m.params} · ~{m.sizeGB}GB · {m.license}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <Link
              to="/device-adviser"
              onClick={() => setOpen(false)}
              className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs text-muted transition-colors hover:bg-surface hover:text-ink hairline"
            >
              <Cpu className="h-3.5 w-3.5" />
              Device Adviser — find models that fit this machine
            </Link>
          </div>
        </>
      )}
    </div>
  );
}