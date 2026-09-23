import type { ChatMessage, ChatOptions, ChatProvider, ChatResult, ModelEntry, ProviderInfo } from "../types";
import { MODEL_CATALOG } from "../catalog";
import { probeGpu } from "@/lib/device-adviser/probe";

/**
 * In-browser inference via transformers.js (ONNX Runtime Web with WebGPU when
 * available, WASM otherwise). Zero install, zero server cost, zero caps — the
 * model runs on the visitor's own GPU. Limited to the smaller catalog entries
 * that have ONNX weights (`webgpu: true`).
 *
 * The runtime is dynamic-imported so the initial bundle stays small.
 */
export class WebGpuProvider implements ChatProvider {
  readonly info: ProviderInfo = {
    id: "webgpu",
    label: "In-browser (WebGPU)",
    kind: "browser",
    uncapped: true,
    needsSetup: false,
    setupHint: "Runs small open models directly in this tab via WebGPU — nothing to install.",
    openSource: true,
  };

  async isAvailable(): Promise<{ ok: boolean; reason?: string }> {
    const gpu = await probeGpu();
    if (gpu.kind === "webgpu") return { ok: true };
    if (gpu.kind === "webgl") {
      return { ok: true, reason: "No WebGPU here — falling back to slower CPU inference." };
    }
    return { ok: false, reason: "This browser can't run on-device models (no WebGPU/WebGL2)." };
  }

  async listModels(): Promise<ModelEntry[]> {
    return MODEL_CATALOG.filter((m) => m.webgpu);
  }

  async chat(
    model: string,
    messages: ChatMessage[],
    onChunk: (delta: string) => void,
    options?: ChatOptions,
  ): Promise<ChatResult> {
    const entry = MODEL_CATALOG.find((m) => m.id === model) ?? MODEL_CATALOG.find((m) => m.webgpu);
    if (!entry?.hfRepo) throw new Error(`No in-browser weights registered for ${model}.`);

    const mod = await import("@huggingface/transformers");
    const gpu = await probeGpu();
    const device = gpu.kind === "webgpu" ? "webgpu" : "wasm";

    const generator = await mod.pipeline("text-generation", entry.hfRepo, {
      dtype: "q4",
      device,
      progress_callback: (info: unknown) => {
        const p = info as { file?: string; progress?: number };
        if (p.file === "onnx_model.safetensors" && typeof p.progress === "number") {
          // Surface download progress through a lightweight event.
          window.dispatchEvent(
            new CustomEvent("grok-webgpu-progress", { detail: Math.round(p.progress * 100) }),
          );
        }
      },
    });

    const textMesages = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }));

    const maxTokens = options?.maxTokens ?? 512;
    const output = (await generator(textMesages, {
      max_new_tokens: maxTokens,
      temperature: options?.temperature ?? 0.7,
      do_sample: true,
    })) as unknown as Array<{ generated_text?: string }>;

    const text = String(output?.[0]?.generated_text ?? "").trim();
    onChunk(text);
    return { text, model: entry.id, provider: "webgpu" };
  }
}