# GrokShell — Free, uncapped AI chat

A dark, Grok-style AI chat app where the AI runs on **your own hardware** —
free open-source models, no usage caps, no AI-cloud accounts.

- **Chat** with streaming answers from local models — Ollama daemon
  (`localhost:11434`), any OpenAI-compatible local server (LM Studio, llama.cpp,
  Jan, LocalAI, vLLM), or in-browser WebGPU inference with zero install.
- **Device Adviser** scans the visitor's device (memory, CPU threads, GPU via
  WebGPU/WebGL, storage, network, battery) and recommends GGUF quantizations
  that will actually run smoothly — plus RAG-ready embedding models.
- **Accounts** (Better Auth, Google / X / email+password) with per-user
  conversations saved to Postgres (Neon) — or local PGLite in preview.
- **Privacy**: hardware scan and model weights never leave the device; local
  inference is genuinely rate-cap–free.
- The cloud xAI model exists only as an **opt-in, capped** fallback labelled as
  paid — never the default path.

## Stack

TanStack Start (React 19, file routes) · Tailwind v4 · zustand · Better Auth ·
Postgres/PGLite · Hugging Face Transformers.js (WebGPU) · react-markdown.

## Development

```bash
npm install
npm run dev        # dev server on 0.0.0.0:8080 (route through .grok/app-env.json)
npm run typecheck
npm run build      # production build + DB migrations
npm run preview:restart   # serve the build on 127.0.0.1:8081
```

`startup.sh` is the restart contract: idempotent, boots `npm run dev` on
`0.0.0.0:8080`, exits immediately if the preview is already healthy.

## Notes

- Local providers talk straight from the browser to the user's own daemon; no
  app server involved. Cloud calls (xAI) are proxied server-side only.
- Model catalog in `src/lib/ai/catalog.ts` — free OSS models only
  (Apache-2.0 / MIT / Llama Community / Gemma terms), with approximate Q4_K_M
  sizes used by the Device Adviser's fit formula.