import type { ChatMessage, ChatOptions, ChatProvider, ChatResult, ModelEntry, ProviderInfo } from "../types";
import { MODEL_CATALOG } from "../catalog";

export const DEFAULT_COMPAT_BASE = "http://localhost:1234";
const BASE_KEY = "grok-ai:compat-base";

export function getCompatBase(): string {
  if (typeof window === "undefined") return DEFAULT_COMPAT_BASE;
  try {
    return window.localStorage.getItem(BASE_KEY) || DEFAULT_COMPAT_BASE;
  } catch {
    return DEFAULT_COMPAT_BASE;
  }
}

export function setCompatBase(url: string): void {
  try {
    window.localStorage.setItem(BASE_KEY, url.replace(/\/+$/, ""));
  } catch {
    /* private mode */
  }
}

/**
 * OpenAI-compatible local servers — llama.cpp `server`, LM Studio, Jan,
 * LocalAI, vLLM, KoboldCpp. One adapter covers them all because they speak the
 * same wire protocol. Also usable with free-tier cloud APIs (OpenRouter, HF)
 * when the user adds their own key — still rate-limited, so the UI labels it.
 */
export class OpenAiCompatibleProvider implements ChatProvider {
  readonly info: ProviderInfo = {
    id: "openai-compatible",
    label: "Local AI server",
    kind: "local",
    uncapped: true,
    needsSetup: true,
    setupHint: "Point me at any OpenAI-compatible server (LM Studio, llama.cpp, Jan, LocalAI…).",
    openSource: true,
  };

  private base(): string {
    return getCompatBase();
  }

  async isAvailable(): Promise<{ ok: boolean; reason?: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
      const res = await fetch(`${this.base()}/v1/models`, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return { ok: false, reason: `Server answered with HTTP ${res.status}.` };
      return { ok: true };
    } catch (err) {
      clearTimeout(timer);
      const name = err instanceof Error ? err.name : "";
      if (name === "AbortError") return { ok: false, reason: "Server did not respond in time." };
      return { ok: false, reason: "No reachable AI server at " + this.base() + "." };
    }
  }

  async listModels(): Promise<ModelEntry[]> {
    try {
      const res = await fetch(`${this.base()}/v1/models`);
      if (!res.ok) return [];
      const body = (await res.json()) as { data?: { id: string }[] };
      const ids = (body.data ?? []).map((m) => m.id);
      const known = MODEL_CATALOG.filter((m) => m.gguf);
      const merged = new Map<string, ModelEntry>();
      for (const m of known) merged.set(m.id, m);
      for (const id of ids) {
        if (!merged.has(id)) {
          merged.set(id, {
            id,
            name: id,
            family: "Installed",
            params: "—",
            license: "Unknown",
            sizeGB: 0,
            minRamGB: 0,
            context: 8192,
            modalities: ["text"],
            tags: ["installed"],
            gguf: true,
            webgpu: false,
            recommendedQuant: "—",
            description: `Model served by an OpenAI-compatible local server (${id}).`,
          });
        }
      }
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
    const res = await fetch(`${this.base()}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 1024,
      }),
      signal: options?.signal,
    });
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      throw new Error(`AI server error ${res.status}: ${text.slice(0, 200)}`);
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
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") return { text: full, model, provider: "openai-compatible" };
        try {
          const json = JSON.parse(payload) as {
            choices?: { delta?: { content?: string } }[];
            error?: { message?: string };
          };
          if (json.error?.message) throw new Error(json.error.message);
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) {
            full += delta;
            onChunk(delta);
          }
        } catch (err) {
          if (err instanceof SyntaxError) continue;
          throw err;
        }
      }
    }
    return { text: full, model, provider: "openai-compatible" };
  }
}