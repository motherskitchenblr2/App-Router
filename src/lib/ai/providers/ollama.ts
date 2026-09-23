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

  async chat(
    model: string,
    messages: ChatMessage[],
    onChunk: (delta: string) => void,
    options?: ChatOptions,
  ): Promise<ChatResult> {
    const res = await fetch(`${this.base()}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        options: {
          temperature: options?.temperature ?? 0.7,
          num_predict: options?.maxTokens ?? 1024,
          num_ctx: options?.contextLength ?? 8192,
        },
      }),
      signal: options?.signal,
    });
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
          const chunk = JSON.parse(line) as { message?: { content?: string }; done?: boolean; error?: string };
          if (chunk.error) throw new Error(chunk.error);
          if (chunk.message?.content) {
            full += chunk.message.content;
            onChunk(chunk.message.content);
          }
          if (chunk.done) return { text: full, model, provider: "ollama" };
        } catch (err) {
          if (err instanceof SyntaxError) continue;
          throw err;
        }
      }
    }
    return { text: full, model, provider: "ollama" };
  }
}