import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/lib/chat-store";
import { useUiStore, type Theme } from "@/lib/ui-store";
import { ALL_PROVIDER_INFOS, getProvider, type AiSettings } from "@/lib/ai";
import { getOllamaBase, setOllamaBase } from "@/lib/ai/providers/ollama";
import type { ModelEntry } from "@/lib/ai/types";

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 py-4">
      <div className="text-[13px] font-medium text-ink">{title}</div>
      {hint && <p className="-mt-1 text-[11px] text-faint">{hint}</p>}
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex w-fit rounded-md bg-elevated p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded px-2.5 py-1 text-[11px] transition-colors",
            value === o.value
              ? "bg-surface font-medium text-ink shadow-sm"
              : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SettingsDialog() {
  const open = useUiStore((s) => s.settingsOpen);
  const setOpen = useUiStore((s) => s.setSettingsOpen);
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const settings = useChatStore((s) => s.settings);
  const update = useChatStore((s) => s.updateSettings);

  const [models, setModels] = useState<ModelEntry[]>([]);
  const [ollamaUrl, setOllamaUrl] = useState(getOllamaBase());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getProvider(settings.providerId)
      .listModels()
      .then((m) => !cancelled && setModels(m))
      .catch(() => !cancelled && setModels([]));
    return () => {
      cancelled = true;
    };
  }, [open, settings.providerId]);

  const set = (partial: Partial<AiSettings>) => update(partial);

  const saveUrl = () => {
    setOllamaBase(ollamaUrl.trim() || "http://localhost:11434");
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/20 backdrop-blur-[1px] data-[state=open]:animate-fade-up" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[85vh] w-[min(560px,92vw)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg bg-surface hairline shadow-2xl focus:outline-none">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-4 py-3">
            <Dialog.Title className="text-[13px] font-medium text-ink">Settings</Dialog.Title>
            <Dialog.Close
              aria-label="Close"
              className="grid h-6 w-6 place-items-center rounded-md text-muted hover:bg-hover hover:text-ink"
            >
              <X className="h-3.5 w-3.5" />
            </Dialog.Close>
          </div>

          <div className="divide-y divide-line px-4">
            <Section title="Appearance" hint="Theme applies instantly and is remembered.">
              <Segmented<Theme>
                value={theme}
                onChange={setTheme}
                options={[
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                ]}
              />
            </Section>

            <Section title="Provider" hint="Local providers are uncapped — your hardware is the limit.">
              <div className="flex flex-wrap gap-1.5">
                {ALL_PROVIDER_INFOS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => set({ providerId: p.id })}
                    className={cn(
                      "rounded-md px-2.5 py-1.5 text-[11px] transition-colors hairline",
                      settings.providerId === p.id
                        ? "bg-ink font-medium text-canvas border-ink"
                        : "bg-surface text-muted hover:text-ink",
                    )}
                  >
                    {p.label}
                    {p.kind === "cloud" && (
                      <span className="ml-1 text-[9px] opacity-70">
                        {p.uncapped ? "" : "capped"}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Model">
              <div className="flex flex-col gap-1">
                {models.length === 0 && (
                  <div className="text-[11px] text-faint">Loading models…</div>
                )}
                {models.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => set({ modelId: m.id })}
                    className={cn(
                      "flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs transition-colors",
                      settings.modelId === m.id
                        ? "bg-elevated text-ink"
                        : "text-muted hover:bg-hover hover:text-ink",
                    )}
                  >
                    <span className="min-w-0 truncate font-mono">{m.id}</span>
                    {settings.modelId === m.id && <Check className="h-3.5 w-3.5 shrink-0" />}
                  </button>
                ))}
              </div>
            </Section>

            <Section
              title="Thinking level"
              hint="Sent to reasoning models; models without reasoning fall back automatically."
            >
              <Segmented<AiSettings["thinking"]>
                value={settings.thinking}
                onChange={(thinking) => set({ thinking })}
                options={[
                  { value: "off", label: "Off" },
                  { value: "low", label: "Low" },
                  { value: "medium", label: "Medium" },
                  { value: "high", label: "High" },
                ]}
              />
            </Section>

            <Section
              title="Autonomy"
              hint="How often the app asks you before acting on a session."
            >
              <div className="flex flex-col gap-1.5">
                {(
                  [
                    ["ask-critical", "Ask on critical", "Confirm deletes only; everything else just runs."],
                    ["always-ask", "Always ask", "Confirm deletes, forks and regenerations."],
                    ["full-auto", "Full auto", "Never confirm — act immediately."],
                  ] as Array<[AiSettings["autonomy"], string, string]>
                ).map(([value, label, desc]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => set({ autonomy: value })}
                    className={cn(
                      "flex items-start gap-2 rounded-md px-2.5 py-2 text-left transition-colors hairline",
                      settings.autonomy === value ? "bg-elevated" : "hover:bg-hover",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border",
                        settings.autonomy === value
                          ? "border-ink bg-ink"
                          : "border-line-strong",
                      )}
                    >
                      {settings.autonomy === value && (
                        <span className="h-1.5 w-1.5 rounded-full bg-canvas" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs text-ink">{label}</span>
                      <span className="block text-[11px] text-faint">{desc}</span>
                    </span>
                  </button>
                ))}
              </div>
            </Section>

            <Section
              title="Context length"
              hint={`${settings.contextLength.toLocaleString()} tokens sent to the model.`}
            >
              <input
                type="range"
                min={2048}
                max={32768}
                step={2048}
                value={settings.contextLength}
                onChange={(e) => set({ contextLength: Number(e.target.value) })}
                className="w-full accent-ink"
              />
            </Section>

            <Section
              title="Ollama server"
              hint="Where this app talks to your local Ollama daemon."
            >
              <div className="flex gap-1.5">
                <input
                  value={ollamaUrl}
                  onChange={(e) => setOllamaUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveUrl()}
                  spellCheck={false}
                  className="h-8 min-w-0 flex-1 rounded-md bg-canvas px-2.5 font-mono text-xs text-ink hairline focus:border-line-strong focus:outline-none"
                />
                <button
                  type="button"
                  onClick={saveUrl}
                  className="h-8 shrink-0 rounded-md bg-ink px-3 text-xs font-medium text-canvas transition-opacity hover:opacity-90"
                >
                  {saved ? "Saved" : "Save"}
                </button>
              </div>
            </Section>
          </div>

          <div className="border-t border-line px-4 py-3 text-[11px] text-faint">
            Data stays on this device — sessions are stored locally, models run on your own
            hardware.
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
