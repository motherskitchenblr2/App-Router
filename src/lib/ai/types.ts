/**
 * Core AI abstractions for GrokShell.
 *
 * Two worlds, one interface:
 *  - LOCAL providers (Ollama daemon, OpenAI-compatible local servers, in-browser
 *    WebGPU) — run on the user's own device, truly uncapped, zero server cost.
 *  - CLOUD providers (xAI, OpenRouter free tier) — routed through this app's
 *    server, OPT-IN, and honestly labelled with their rate caps.
 */

export type ProviderId = "ollama" | "openai-compatible" | "webgpu" | "xai";

export type ProviderKind = "local" | "browser" | "cloud";

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  kind: ProviderKind;
  /** True when there is genuinely no rate cap (your hardware is the limit). */
  uncapped: boolean;
  /** True when the user must install/configure something first. */
  needsSetup: boolean;
  setupHint: string;
  /** Free / open-source by default. */
  openSource: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  /** Model's private reasoning stream, when the backend returns one. */
  reasoning?: string;
}

/** Reasoning effort for thinking-capable models. "off" omits the parameter. */
export type ThinkingLevel = "off" | "low" | "medium" | "high";

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  contextLength?: number;
  signal?: AbortSignal;
  thinking?: ThinkingLevel;
  /** Streams the model's reasoning tokens, when it produces any. */
  onReasoning?: (delta: string) => void;
}

export interface ChatResult {
  text: string;
  model: string;
  provider: ProviderId;
}

/**
 * A streaming chat provider. `onChunk` is called as text arrives; the returned
 * promise resolves with the full assembled result.
 */
export interface ChatProvider {
  readonly info: ProviderInfo;
  listModels(): Promise<ModelEntry[]>;
  isAvailable(): Promise<{ ok: boolean; reason?: string }>;
  chat(
    model: string,
    messages: ChatMessage[],
    onChunk: (delta: string) => void,
    options?: ChatOptions,
  ): Promise<ChatResult>;
}

export type ModelModality = "text" | "vision" | "code" | "embedding";

export interface ModelEntry {
  /** Canonical id — an Ollama tag for GGUF models, or an HF repo for WebGPU. */
  id: string;
  name: string;
  family: string;
  params: string;
  license: string;
  /** Approx. download size for the recommended quant (GB). */
  sizeGB: number;
  /** Device RAM needed for it to run smoothly (GB). */
  minRamGB: number;
  context: number;
  modalities: ModelModality[];
  tags: string[];
  /** Available as a GGUF via Ollama (and OpenAI-compatible local servers). */
  gguf: boolean;
  /** Runnable in-browser on the WebGPU path (transformers.js / ONNX). */
  webgpu: boolean;
  /** Hugging Face repo id used by the WebGPU path, when it exists. */
  hfRepo?: string;
  recommendedQuant: string;
  description: string;
}

export interface Recommendation {
  model: ModelEntry;
  score: number;
  runsSmoothly: boolean;
  quant: string;
  fitReason: string;
  provider: ProviderId;
}

export interface RagFeasibility {
  supported: boolean;
  embedding: ModelEntry[];
  vectorBudgetGB: number;
  summary: string;
}