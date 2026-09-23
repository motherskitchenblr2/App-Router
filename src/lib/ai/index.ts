import type { ChatProvider, ProviderId, ProviderInfo } from "./types";
import { OllamaProvider } from "./providers/ollama";
import { OpenAiCompatibleProvider } from "./providers/openai-compatible";
import { WebGpuProvider } from "./providers/webgpu";
import { XaiProvider } from "./providers/xai";

const _providers: Record<ProviderId, ChatProvider> = {
  ollama: new OllamaProvider(),
  "openai-compatible": new OpenAiCompatibleProvider(),
  webgpu: new WebGpuProvider(),
  xai: new XaiProvider(),
};

export function getProvider(id: ProviderId): ChatProvider {
  return _providers[id];
}

export const ALL_PROVIDER_INFOS: ProviderInfo[] = Object.values(_providers).map((p) => p.info);

const SETTINGS_KEY = "grok-ai:settings";

export interface AiSettings {
  providerId: ProviderId;
  modelId: string;
  contextLength: number;
  /** User must explicitly enable the capped cloud path. */
  cloudEnabled: boolean;
}

export const DEFAULT_SETTINGS: AiSettings = {
  providerId: "ollama",
  modelId: "llama3.2:3b",
  contextLength: 8192,
  cloudEnabled: false,
};

export function loadSettings(): AiSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AiSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: AiSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* private mode */
  }
}