import type { HardwareProbe } from "./probe";
import type { RagFeasibility, Recommendation } from "@/lib/ai/types";
import { MODEL_CATALOG } from "@/lib/ai/catalog";
import { computeTier } from "./tiers";

const PERMISSIVE_LICENSES = new Set(["Apache-2.0", "MIT"]);

export interface AdviserOutput {
  probe: HardwareProbe;
  tierId: string;
  tierLabel: string;
  tierBlurb: string;
  budgetGB: number;
  gpuAccel: "webgpu" | "webgl" | "none";
  storageHeadroomGB: number;
  recommendations: Recommendation[];
  rag: RagFeasibility;
  ranAt: string;
}

/**
 * Rank the catalog for this specific device. Scoring:
 *   fit        — model + KV + slack fits the memory budget (hard gate)
 *   license    — Apache-2.0 / MIT get +3 (commercial-free forever)
 *   size       — prefer the biggest model that still fits (+2 per tier class)
 *   installed? — unknown here, the view merges that in
 *
 * The "runs smoothly" flag is the hard gate: sizeGB + kv + 0.4 ≤ budget, AND
 * storage has room for the download.
 */
export function recommend(probe: HardwareProbe): AdviserOutput {
  const { tier, budgetGB, gpuAccel } = computeTier(probe);
  const storageHeadroom = tier.storageHeadroomGB;

  const candidateModels = MODEL_CATALOG.filter((m) => m.modalities.includes("text") && m.gguf);

  const scored = candidateModels.map((m) => {
    const needed = m.sizeGB + tier.kvOverheadGB + 0.4;
    const fitsRam = needed <= budgetGB;
    const fitsStorage = m.sizeGB <= storageHeadroom;
    const runsSmoothly = fitsRam && fitsStorage;

    let score = 0;
    if (fitsRam) {
      score += 10;
      // Size class bonus — bigger within budget is better.
      if (m.params.includes("70") || m.params.includes("32")) score += 7;
      else if (m.params.includes("24") || m.params.includes("46")) score += 6;
      else if (m.params.includes("14")) score += 5;
      else if (m.params.includes("9") || m.params.includes("11")) score += 4;
      else if (m.params.includes("7") || m.params.includes("8")) score += 3;
      else if (m.params.includes("3") || m.params.includes("2")) score += 2;
      else score += 1;
    }
    if (PERMISSIVE_LICENSES.has(m.license)) score += 3;
    if (m.tags.includes("reasoning")) score += 1;

    return { model: m, score, runsSmoothly };
  });

  scored.sort((a, b) => b.score - a.score || b.model.minRamGB - a.model.minRamGB);
  // Keep a healthy spread: top 6 overall sorted by score, plus any small
  // model that would still work as a fallback on a tiny device.
  const top = scored.slice(0, 6);
  const fallback = scored.find((s) => !top.includes(s) && s.model.minRamGB <= 2);
  const list = fallback ? [...top, fallback] : top;

  const recommendations: Recommendation[] = list
    .filter((s) => s.score > 0)
    .map((s) => {
      const budgetNote = s.runsSmoothly
        ? `Fits your ≈${budgetGB.toFixed(1)}GB usable memory with KV-cache headroom.`
        : s.model.sizeGB > storageHeadroom
          ? "Not enough free storage to download comfortably."
          : "Needs more memory than this device has for smooth streaming.";
      return {
        model: s.model,
        score: s.score,
        runsSmoothly: s.runsSmoothly,
        quant: s.model.recommendedQuant,
        fitReason: budgetNote,
        provider: "ollama",
      };
    });

  // ── RAG feasibility — retrieval is a separate budget from chat ────────────
  const embeddings = MODEL_CATALOG.filter((m) => m.modalities.includes("embedding"));
  const vectorBudget = Math.max(0.5, budgetGB * 0.15);
  const feasibleEmbeddings = embeddings.filter((e) => e.sizeGB <= vectorBudget + 0.2);
  const ragSupported = feasibleEmbeddings.length > 0 && budgetGB >= 1.5;

  const embeddingSorted = [...embeddings]
    .filter((e) => e.tags.includes("rag"))
    .sort((a, b) => a.minRamGB - b.minRamGB);

  const rag: RagFeasibility = {
    supported: ragSupported,
    embedding: ragSupported ? embeddingSorted : [],
    vectorBudgetGB: vectorBudget,
    summary: ragSupported
      ? `Your device can hold ${feasibleEmbeddings.length} local embedding model(s) (budget ≈${vectorBudget.toFixed(1)}GB). Pick a chat model above plus an embedding model below to run private RAG.`
      : "Not enough free memory for local retrieval — keep RAG to small, manual docs.",
  };

  return {
    probe,
    tierId: tier.id,
    tierLabel: tier.label,
    tierBlurb: tier.blurb,
    budgetGB: budgetGB,
    gpuAccel,
    storageHeadroomGB: storageHeadroom,
    recommendations,
    rag,
    ranAt: new Date().toISOString(),
  };
}