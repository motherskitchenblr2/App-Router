import { getOllamaBase } from "./providers/ollama";

export interface PullProgress {
  status: string;
  completed: number;
  total: number;
  percent: number;
  digest?: string;
}

/**
 * Stream an `ollama pull` for a model. Used by the Device Adviser's download
 * buttons — progress arrives line-by-line from the daemon.
 */
export async function pullOllamaModel(
  model: string,
  onProgress: (p: PullProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  const base = getOllamaBase();
  const res = await fetch(`${base}/api/pull`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, stream: true }),
    signal,
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`Pull failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      let json: {
        status?: string;
        completed?: number;
        total?: number;
        digest?: string;
        error?: string;
      };
      try {
        json = JSON.parse(line);
      } catch {
        continue;
      }
      if (json.error) throw new Error(json.error);
      const total = json.total ?? 0;
      const completed = json.completed ?? 0;
      onProgress({
        status: json.status ?? "working",
        completed,
        total,
        percent: total > 0 ? Math.round((completed / total) * 100) : 0,
        digest: json.digest,
      });
    }
  }
}