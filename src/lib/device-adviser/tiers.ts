import type { HardwareProbe } from "./probe";

export interface DeviceTier {
  id: "tiny" | "lite" | "standard" | "plus" | "pro" | "max";
  label: string;
  blurb: string;
  /** How much RAM a running chat model can realistically claim (GB). */
  modelBudgetGB: number;
  /** Rule of thumb for KV-cache — a small DB-class budget covering 8k–16k ctx. */
  kvOverheadGB: number;
  storageHeadroomGB: number;
}

/**
 * Compute how much memory a language model can actually use on this device,
 * and bucket it into a tier.
 *
 * The formula is deliberately conservative and documented:
 *   budget  = max(0.75, ramGB − reserve)          — reserve covers OS + browser
 *   fit     = modelSizeGB + kvOverheadGB + 0.4   — 0.4GB working set slack
 *   smooth  = fit ≤ budget
 *
 * `ramGB` may come from `navigator.deviceMemory` or a core-count estimate when
 * the platform hides it (marked with `ramEstimated` in the probe).
 */
export function computeTier(probe: HardwareProbe): {
  tier: DeviceTier;
  budgetGB: number;
  gpuAccel: "webgpu" | "webgl" | "none";
} {
  const ram = probe.ramGB ?? 8;
  const reserve = probe.mobile ? 1.2 : 1.6;
  const budget = Math.max(0.75, ram - reserve);

  let id: DeviceTier["id"];
  if (budget >= 40) id = "max";
  else if (budget >= 24) id = "pro";
  else if (budget >= 14) id = "plus";
  else if (budget >= 6.5) id = "standard";
  else if (budget >= 2.5) id = "lite";
  else id = "tiny";

  const labels: Record<DeviceTier["id"], { label: string; blurb: string }> = {
    tiny: { label: "Tiny", blurb: "Phones and minimal laptops — on-device chat models only." },
    lite: { label: "Lite", blurb: "Entry laptops and tablets — small models run smoothly." },
    standard: { label: "Standard", blurb: "8GB-class machines — 7B–9B chat models are comfortable." },
    plus: { label: "Plus", blurb: "16GB-class machines — 14B models and code assistants." },
    pro: { label: "Pro", blurb: "24–32GB machines — 24B–32B models and MoE." },
    max: { label: "Max", blurb: "Workstations — 70B-class models and heavy RAG." },
  };

  const kvOverhead = id === "tiny" || id === "lite" ? 0.3 : id === "standard" ? 0.6 : 1.2;

  return {
    tier: {
      id,
      label: labels[id].label,
      blurb: labels[id].blurb,
      modelBudgetGB: budget,
      kvOverheadGB: kvOverhead,
      storageHeadroomGB: Math.max(0, (probe.storage.availableGB ?? budget * 2) - 2),
    },
    budgetGB: budget,
    gpuAccel: probe.webgpuSupported ? "webgpu" : probe.gpu.kind === "webgl" ? "webgl" : "none",
  };
}