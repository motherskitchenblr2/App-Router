#!/usr/bin/env sh
# GrokShell — restart contract. Idempotent: exits 0 if the preview is healthy,
# starts only what is down, backgrounds everything so this returns fast.
set -e

PROBE_URL="http://127.0.0.1:8080/"

if curl -fsS --max-time 2 "$PROBE_URL" >/dev/null 2>&1; then
  echo "grok-ollama-app: preview already healthy"
  exit 0
fi

echo "grok-ollama-app: starting dev server on 0.0.0.0:8080"
( npm run dev >/tmp/grok-ollama-app-dev.log 2>&1 & )
echo "grok-ollama-app: booting in background"