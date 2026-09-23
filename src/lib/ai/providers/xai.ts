import type { ChatMessage, ChatOptions, ChatProvider, ChatResult, ModelEntry, ProviderInfo } from "../types";
import { xaiChat, xaiStatus } from "@/lib/server/cloud";

/**
 * xAI cloud provider — OPT-IN and rate-capped. Listed last, clearly labelled,
 * and only used when the user explicitly selects it. Guardrails: max_tokens
 * capped server-side, no automatic calls, flagged as non-open-source.
 */
export class XaiProvider implements ChatProvider {
  readonly info: ProviderInfo = {
    id: "xai",
    label: "Grok cloud (xAI)",
    kind: "cloud",
    uncapped: false,
    needsSetup: false,
    setupHint: "Premium cloud fallback — rate-limited, spends the app owner's quota. Local models above are free.",
    openSource: false,
  };

  async isAvailable(): Promise<{ ok: boolean; reason?: string }> {
    const status = await xaiStatus();
    if (status.configured) return { ok: true };
    return { ok: false, reason: "Cloud AI is not configured on this deployment." };
  }

  async listModels(): Promise<ModelEntry[]> {
    const status = await xaiStatus();
    return [
      {
        id: status.model,
        name: status.model,
        family: "xAI",
        params: "—",
        license: "Proprietary",
        sizeGB: 0,
        minRamGB: 0,
        context: 131072,
        modalities: ["text"],
        tags: ["cloud", "reasoning"],
        gguf: false,
        webgpu: false,
        recommendedQuant: "—",
        description: "Cloud reasoning model (paid, rate-limited). Only used when you choose it.",
      },
    ];
  }

  async chat(
    model: string,
    messages: ChatMessage[],
    onChunk: (delta: string) => void,
    options?: ChatOptions,
  ): Promise<ChatResult> {
    const result = await xaiChat({
      data: { messages, maxTokens: options?.maxTokens ?? 512 },
    });
    if (!result.ok) throw new Error(result.error);
    onChunk(result.text);
    return { text: result.text, model, provider: "xai" };
  }
}