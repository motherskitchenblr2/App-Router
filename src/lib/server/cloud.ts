import { createServerFn } from "@tanstack/react-start";
import type { ChatMessage } from "@/lib/ai/types";

/**
 * OPT-IN cloud bridge. Uses the app's injected XAI_API_KEY (present in both
 * preview and the deployed app). It is the app owner's personal key: every
 * call spends their quota, so this is NEVER called automatically — only when
 * the user explicitly picks the cloud model, and capped with max_tokens.
 */
const CLOUD_MODEL = "grok-4.5";

export const xaiStatus = createServerFn({ method: "GET" }).handler(async () => {
  const configured = Boolean(process.env.XAI_API_KEY);
  return { configured, model: CLOUD_MODEL };
});

export const xaiChat = createServerFn({ method: "POST" })
  .validator(
    (input: { messages: ChatMessage[]; maxTokens?: number }) => input,
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "Cloud AI is not configured on this deployment." };
    }
    const maxTokens = Math.min(data.maxTokens ?? 512, 1024);
    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: CLOUD_MODEL,
          messages: data.messages,
          max_tokens: maxTokens,
          stream: false,
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        return { ok: false as const, error: `Cloud API error ${res.status}: ${detail.slice(0, 160)}` };
      }
      const body = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const text = body.choices?.[0]?.message?.content ?? "";
      return { ok: true as const, text };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "Cloud request failed",
      };
    }
  });