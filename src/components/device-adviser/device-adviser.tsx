import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  BatteryCharging,
  Check,
  Cpu,
  Download,
  Gauge,
  HardDrive,
  Loader2,
  MemoryStick,
  MonitorSmartphone,
  Network,
  RefreshCw,
  Sparkles,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import type { AdviserOutput, Recommendation } from "@/lib/device-adviser";
import { runDeviceAdviser } from "@/lib/device-adviser";
import { pullOllamaModel, type PullProgress } from "@/lib/ai/ollama-pull";
import { getOllamaBase, setOllamaBase } from "@/lib/ai/providers/ollama";
import { useChatStore } from "@/lib/chat-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function Stat({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-surface p-4 hairline">
      <span className="mt-0.5 text-faint">{icon}</span>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-faint">{label}</div>
        <div className="mt-0.5 truncate text-sm font-medium text-ink" title={value}>
          {value}
        </div>
        {hint && <div className="mt-0.5 text-[11px] text-faint">{hint}</div>}
      </div>
    </div>
  );
}

function RecommendationCard({
  rec,
  ollamaOk,
  onUse,
}: {
  rec: Recommendation;
  ollamaOk: boolean;
  onUse: (rec: Recommendation) => void;
}) {
  const [pulling, setPulling] = useState(false);
  const [progress, setProgress] = useState<PullProgress | null>(null);

  const pull = async () => {
    setPulling(true);
    setProgress(null);
    try {
      await pullOllamaModel(rec.model.id, setProgress);
      toast.success(`${rec.model.name} downloaded`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    } finally {
      setPulling(false);
      setProgress(null);
    }
  };

  const canPull = ollamaOk && rec.model.gguf;
  const webgpuReady = rec.model.webgpu;

  return (
    <div
      className={cn(
        "rounded-2xl bg-surface p-4 hairline transition-colors",
        rec.runsSmoothly ? "border-line-strong" : "opacity-80",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-semibold text-ink">{rec.model.name}</h3>
            {rec.runsSmoothly ? (
              <Badge tone="ok">recommended</Badge>
            ) : (
              <Badge tone="warn">heavy for this device</Badge>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-faint">
            <span>{rec.model.params}</span>
            <span>~{rec.model.sizeGB}GB · {rec.model.recommendedQuant}</span>
            <span>{rec.model.license}</span>
            <span>{rec.model.gguf ? "GGUF ✓" : ""} {rec.model.webgpu ? "Safetensors ✓" : ""}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-sm text-muted">{rec.model.id}</div>
          <div className="text-[10px] text-faint">Ollama tag</div>
        </div>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-muted">{rec.model.description}</p>
      <p className={cn("mt-2 text-[11px]", rec.runsSmoothly ? "text-ok" : "text-warn")}>
        {rec.fitReason}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="primary" onClick={() => onUse(rec)}>
          <Zap className="h-3.5 w-3.5" /> Use this model
        </Button>
        {canPull && (
          <Button size="sm" variant="secondary" onClick={() => void pull()} disabled={pulling}>
            {pulling ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            {pulling ? (progress?.status === "success" ? "Done" : "Downloading…") : `Download (${rec.model.sizeGB}GB)`}
          </Button>
        )}
        {webgpuReady && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              useChatStore.getState().updateSettings({
                providerId: "webgpu",
                modelId: rec.model.id,
              });
              toast.success(`${rec.model.name} set as in-browser model`);
            }}
          >
            <MonitorSmartphone className="h-3.5 w-3.5" /> Run in browser
          </Button>
        )}
      </div>

      {pulling && progress && (
        <div className="mt-3">
          <div className="flex justify-between text-[11px] text-faint">
            <span className="truncate">{progress.status}</span>
            <span>{progress.percent}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-elevated">
            <div
              className="h-full rounded-full bg-accent transition-all duration-200"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function DeviceAdviser() {
  const [output, setOutput] = useState<AdviserOutput | null>(null);
  const [running, setRunning] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ollamaOk, setOllamaOk] = useState<boolean | null>(null);

  const scan = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const result = await runDeviceAdviser(true);
      setOutput(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hardware scan failed");
    } finally {
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    void scan();
  }, [scan]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${getOllamaBase()}/api/tags`, { signal: AbortSignal.timeout(2500) });
        if (!cancelled) setOllamaOk(res.ok);
      } catch {
        if (!cancelled) setOllamaOk(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const useModel = (rec: Recommendation) => {
    useChatStore.getState().updateSettings({
      providerId: rec.provider,
      modelId: rec.model.id,
    });
    toast.success(`${rec.model.name} selected`);
  };

  const p = output?.probe;

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl px-4 py-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-soft">
                <Cpu className="h-4.5 w-4.5 text-accent" />
              </span>
              <h1 className="text-xl font-semibold tracking-tight text-ink">Device Adviser</h1>
            </div>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
              Scans this device and recommends free, open-source AI models that
              will actually run smoothly on it — GGUF quantizations for Ollama,
              safetensors for in-browser WebGPU, plus RAG-ready embeds. Nothing
              is uploaded; the scan runs locally in your browser.
            </p>
          </div>
          <Button variant="secondary" onClick={() => void scan()} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {running ? "Scanning…" : "Re-scan"}
          </Button>
        </div>

        {running && !output && (
          <div className="mt-8 grid place-items-center rounded-2xl bg-surface py-16 hairline">
            <div className="flex flex-col items-center gap-3 text-muted">
              <Loader2 className="h-6 w-6 animate-spin text-accent" />
              <span className="text-sm">Probing CPU, memory, GPU and storage…</span>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-8 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">
            {error}
          </div>
        )}

        {output && p && (
          <>
            {/* Tier + stats */}
            <div className="mt-6 rounded-2xl bg-elevated p-5 hairline">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Gauge className="h-5 w-5 text-accent" />
                  <div>
                    <div className="text-base font-semibold text-ink">
                      Your device: {output.tierLabel} tier
                    </div>
                    <div className="text-xs text-muted">{output.tierBlurb}</div>
                  </div>
                </div>
                <Badge tone={output.gpuAccel === "webgpu" ? "ok" : "neutral"}>
                  {output.gpuAccel === "webgpu" ? "WebGPU acceleration" : output.gpuAccel === "webgl" ? "WebGL (CPU fallback)" : "No GPU inference"}
                </Badge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat
                  icon={<MemoryStick className="h-4 w-4" />}
                  label="Memory"
                  value={`${p.ramGB} GB${p.ramEstimated ? " (est.)" : ""}`}
                  hint={`≈ ${output.budgetGB.toFixed(1)} GB usable for models`}
                />
                <Stat
                  icon={<Cpu className="h-4 w-4" />}
                  label="CPU threads"
                  value={p.cores != null ? String(p.cores) : "unknown"}
                />
                <Stat
                  icon={<HardDrive className="h-4 w-4" />}
                  label="Storage"
                  value={
                    p.storage.availableGB != null
                      ? `${p.storage.availableGB.toFixed(0)} GB (${output.storageHeadroomGB.toFixed(0)} GB free-ish)`
                      : "unknown"
                  }
                />
                <Stat
                  icon={<Network className="h-4 w-4" />}
                  label="Network"
                  value={
                    p.network.online
                      ? `online · ${p.network.effectiveType}`
                      : "offline"
                  }
                  hint={p.gpu.name ? p.gpu.name.slice(0, 42) : undefined}
                />
              </div>
              {p.gpu.name && (
                <div className="mt-3 flex items-center gap-2 text-[11px] text-faint">
                  {p.battery ? (
                    <>
                      <BatteryCharging className="h-3.5 w-3.5" />
                      {Math.round(p.battery.level * 100)}% battery
                      {p.battery.charging ? " (charging)" : ""} ·
                    </>
                  ) : null}
                  GPU: {p.gpu.name} {p.gpu.architecture ? `· ${p.gpu.architecture}` : ""}
                </div>
              )}
            </div>

            {/* Ollama status */}
            <div
              className={cn(
                "mt-4 flex flex-wrap items-center gap-2 rounded-xl px-4 py-3 text-sm hairline",
                ollamaOk === true && "text-ok",
                ollamaOk === false && "text-warn",
              )}
            >
              {ollamaOk === true ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
              {ollamaOk === true ? (
                <span>
                  Ollama is running at <code className="font-mono text-xs">{getOllamaBase()}</code> — you can
                  download and chat with these models right away.
                </span>
              ) : ollamaOk === false ? (
                <span>
                  Ollama isn't reachable at <code className="font-mono text-xs">{getOllamaBase()}</code>.
                  Install it from <span className="text-ink">ollama.com</span> and start it — downloads below
                  will then work.
                </span>
              ) : (
                <span>Checking for Ollama…</span>
              )}
              <button
                type="button"
                className="ml-auto rounded-full bg-surface px-3 py-1 text-[11px] text-muted hairline transition-colors hover:text-ink"
                onClick={() => {
                  const url = prompt("Ollama server URL", getOllamaBase());
                  if (url) {
                    setOllamaBase(url);
                    window.location.reload();
                  }
                }}
              >
                Change address
              </button>
            </div>

            {/* Recommendations */}
            <h2 className="mt-8 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-faint">
              <Sparkles className="h-4 w-4 text-accent" />
              Recommended for this device
            </h2>
            <div className="mt-3 grid gap-3">
              {output.recommendations.map((rec) => (
                <RecommendationCard
                  key={rec.model.id}
                  rec={rec}
                  ollamaOk={ollamaOk === true}
                  onUse={useModel}
                />
              ))}
            </div>

            {/* RAG section */}
            <h2 className="mt-8 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-faint">
              <Zap className="h-4 w-4 text-ok" />
              RAG readiness
            </h2>
            <div className="mt-3 rounded-2xl bg-surface p-4 hairline">
              <p className="text-sm leading-relaxed text-muted">{output.rag.summary}</p>
              {output.rag.supported && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {output.rag.embedding.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className="flex items-center gap-1.5 rounded-full bg-elevated px-3 py-1.5 text-xs text-muted transition-colors hover:text-ink hairline"
                      onClick={() => {
                        useChatStore.getState().updateSettings({ modelId: m.id });
                        toast.success(`Embedding model ${m.name} selected`);
                      }}
                    >
                      <Check className="h-3 w-3 text-ok" />
                      {m.name} · {m.sizeGB}GB
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Format explainer */}
            <h2 className="mt-8 text-sm font-semibold uppercase tracking-wider text-faint">
              About the formats
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-surface p-4 hairline">
                <div className="flex items-center gap-2 text-sm font-medium text-ink">
                  <Download className="h-4 w-4 text-accent" /> GGUF
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">
                  The standard quantized format for Ollama and llama.cpp servers.
                  Q4_K_M / Q5_K_M balance size and quality — that is what the
                  size estimates above assume.
                </p>
              </div>
              <div className="rounded-2xl bg-surface p-4 hairline">
                <div className="flex items-center gap-2 text-sm font-medium text-ink">
                  <MonitorSmartphone className="h-4 w-4 text-ok" /> Safetensors + WebGPU
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">
                  ONNX/Safetensors weights that transformers.js can run inside
                  the browser on your GPU — zero install, works on this page.
                </p>
              </div>
            </div>

            <div className="mt-6 pb-4 text-center">
              <Link
                to="/chat"
                className="text-xs text-muted underline-offset-4 hover:text-ink hover:underline"
              >
                ← Back to chat
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}