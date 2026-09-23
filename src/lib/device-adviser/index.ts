import { probeHardware, type HardwareProbe } from "./probe";
import { recommend, type AdviserOutput } from "./match";

export type { HardwareProbe, GpuInfo } from "./probe";
export type { AdviserOutput } from "./match";
export type { Recommendation } from "@/lib/ai/types";
export { computeTier } from "./tiers";

let _cached: AdviserOutput | null = null;
let _cachedProbe: HardwareProbe | null = null;

/** Run the Device Adviser: probe this machine and recommend models. */
export async function runDeviceAdviser(force = false): Promise<AdviserOutput> {
  if (_cached && !force) return _cached;
  const probe = await probeHardware();
  const output = recommend(probe);
  _cached = output;
  _cachedProbe = probe;
  return output;
}

export async function getProbe(force = false): Promise<HardwareProbe> {
  if (_cachedProbe && !force) return _cachedProbe;
  const probe = await probeHardware();
  _cachedProbe = probe;
  return probe;
}