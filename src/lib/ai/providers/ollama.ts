import type { ChatMessage, ChatOptions, ChatProvider, ChatResult, ModelEntry, ProviderInfo } from "../types";
import { MODEL_CATALOG, catalogById } from "../catalog";

export const DEFAULT_OLLAMA_BASE = "http://localhost:11434";
const BASE_KEY = "grok-ai:ollama-base";

export function getOllamaBase(): string {
  if (typeof window === "undefined") return DEFAULT_OLLAMA_BASE;
  try {
    return window.localStorage.getItem(BASE_KEY) || DEFAULT_OLLAMA_BASE;
  } catch {
    return DEFAULT_OLLAMA_BASE;
  }
}

export function setOllamaBase(url: string): void {
  try {
    window.localStorage.setItem(BASE_KEY, url.replace(/\/+$/, ""));
  } catch {
    /* private mode */
  }
}

interface OllamaTag {
  name: string;
  size?: number;
  details?: { parameter_size?: string; quantization_level?: string };
}

/**
 * Ollama daemon provider — the local, zero-cap workhorse.
 *
 * Talks straight to the user's own Ollama server (default localhost:11434).
 * Ollama answers CORS from any origin by default, so this works from the app
 * wherever the user opens it, as long as the daemon runs on their machine.
 */
export class OllamaProvider implements ChatProvider {
  readonly info: ProviderInfo = {
    id: "ollama",
    label: "Ollama (local)",
    kind: "local",
    uncapped: true,
    needsSetup: true,
    setupHint: "Install Ollama (ollama.com) and start it — models run on your own hardware, forever free.",
    openSource: true,
  };

  private base(): string {
    return getOllamaBase();
  }

  async isAvailable(): Promise<{ ok: boolean; reason?: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
      const res = await fetch(`${this.base()}/api/tags`, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return { ok: false, reason: `Ollama answered with HTTP ${res.status}.` };
      return { ok: true };
    } catch (err) {
      clearTimeout(timer);
      const name = err instanceof Error ? err.name : "";
      if (name === "AbortError") return { ok: false, reason: "Ollama did not respond in time. Is it running?" };
      return { ok: false, reason: "No Ollama server detected at " + this.base() + ". Install it or check the address." };
    }
  }

  async listModels(): Promise<ModelEntry[]> {
    try {
      const res = await fetch(`${this.base()}/api/tags`);
      if (!res.ok) return [];
      const body = (await res.json()) as { models?: OllamaTag[] };
      const ids = new Set((body.models ?? []).map((m) => m.name));
      // Merge installed tags into the catalog; catalog entries stay canonical.
      const installed = [...ids].map((id) => {
        const known = catalogById(id);
        if (known) return known;
        return {
          id,
          name: id,
          family: "Installed",
          params: "—",
          license: "Unknown",
          sizeGB: 0,
          minRamGB: 0,
          context: 8192,
          modalities: ["text"] as const,
          tags: ["installed"],
          gguf: true,
          webgpu: false,
          recommendedQuant: "—",
          description: `Installed Ollama model ${id}.`,
        } satisfies ModelEntry;
      });
      const knownOnly = MODEL_CATALOG.filter(
        (m) => m.gguf && m.id.split(":").every((part) => part !== "latest"),
      );
      const merged = new Map<string, ModelEntry>();
      for (const m of [...knownOnly, ...installed]) merged.set(m.id, m);
      return [...merged.values()];
    } catch {
      return MODEL_CATALOG.filter((m) => m.gguf);
    }
  }

  /** Models confirmed installed — one tags lookup per model, then zero overhead. */
  private verified = new Set<string>();

  /**
   * Resolve the requested model against what is actually installed, so a
   * missing model never produces a failing first request. Positive results are
   * cached; a pending model is re-checked every send, so pulling it later just
   * starts working without a restart.
   */
  private async preflight(requested: string): Promise<string> {
    if (this.verified.has(requested)) return requested;
    try {
      const res = await fetch(`${this.base()}/api/tags`);
      if (!res.ok) return requested;
      const body = (await res.json()) as { models?: OllamaTag[] };
      const names = (body.models ?? []).map((m) => m.name);
      if (!names.includes(requested)) return names[0] ?? requested;
      this.verified.add(requested);
      return requested;
    } catch {
      return requested; // tags unreachable — let chat() surface the real error
    }
  }

  /** First installed model that isn't `current` — used when a configured model is missing. */
  private async resolveInstalledModel(current: string): Promise<string | null> {
    try {
      const res = await fetch(`${this.base()}/api/tags`);
      if (!res.ok) return null;
      const body = (await res.json()) as { models?: OllamaTag[] };
      const names = (body.models ?? []).map((m) => m.name);
      return names.find((n) => n !== current) ?? null;
    } catch {
      return null;
    }
  }

  async chat(
    model: string,
    messages: ChatMessage[],
    onChunk: (delta: string) => void,
    options?: ChatOptions,
  ): Promise<ChatResult> {
    // `off` must be sent explicitly as `false` — reasoning models (deepseek-r1)
    // think by default when the parameter is absent entirely.
    const think: false | string =
      options?.thinking && options.thinking !== "off" ? options.thinking : false;
    let usedModel = await this.preflight(model);
    let withThink = true;
    const doFetch = (target: string, useThink: boolean) =>
      fetch(`${this.base()}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: target,
          messages,
          stream: true,
          ...(useThink ? { think } : {}),
          options: {
            temperature: options?.temperature ?? 0.7,
            num_predict: options?.maxTokens ?? 1024,
            num_ctx: options?.contextLength ?? 8192,
          },
        }),
        signal: options?.signal,
      });

    let res = await doFetch(usedModel, withThink);
    // Recoverable mismatches, retried in place:
    //  - model without reasoning support rejects `think` -> send without it;
    //  - configured model not installed -> fall back to an installed one.
    for (let attempt = 0; attempt < 3 && !res.ok; attempt++) {
      const errText = await res.text().catch(() => "");
      if (
        res.status === 400 &&
        withThink &&
        errText.includes("does not support thinking")
      ) {
        withThink = false;
        res = await doFetch(usedModel, false);
        continue;
      }
      if (res.status === 404 && errText.includes("not found")) {
        const alt = await this.resolveInstalledModel(usedModel);
        if (alt) {
          usedModel = alt;
          res = await doFetch(usedModel, withThink);
          continue;
        }
      }
      throw new Error(`Ollama error ${res.status}: ${errText.slice(0, 200)}`);
    }
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      throw new Error(`Ollama error ${res.status}: ${text.slice(0, 200)}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line) continue;
        try {
          const chunk = JSON.parse(line) as {
            message?: { content?: string; reasoning?: string; thinking?: string };
            done?: boolean;
            error?: string;
          };
          if (chunk.error) throw new Error(chunk.error);
          // Ollama streams the reasoning trace as `message.thinking` (some
          // versions use `reasoning`) — both feed the Thought chip.
          const thought = chunk.message?.thinking ?? chunk.message?.reasoning;
          if (thought && options?.onReasoning) {
            options.onReasoning(thought);
          }
          if (chunk.message?.content) {
            full += chunk.message.content;
            onChunk(chunk.message.content);
          }
          if (chunk.done) return { text: full, model: usedModel, provider: "ollama" };
        } catch (err) {
          if (err instanceof SyntaxError) continue;
          throw err;
        }
      }
    }
    return { text: full, model: usedModel, provider: "ollama" };
  }
}