/**
 * Hardware probing — runs entirely in the visitor's browser. Everything is
 * best-effort: web platform APIs report what they can and nothing else.
 */

export interface GpuInfo {
  kind: "webgpu" | "webgl" | "none";
  name: string | null;
  architecture: string | null;
  vendor: string | null;
  description: string | null;
}

export interface HardwareProbe {
  ramGB: number | null;
  ramEstimated: boolean;
  cores: number | null;
  gpu: GpuInfo;
  storage: { availableGB: number | null; quotaGB: number | null };
  network: { online: boolean; effectiveType: string };
  platform: string;
  mobile: boolean;
  touch: boolean;
  battery: { charging: boolean; level: number } | null;
  secureContext: boolean;
  webgpuSupported: boolean;
}

function parsePlatform(): string {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  if (/Mac OS X/.test(ua)) return "macOS";
  if (/Windows/.test(ua)) return "Windows";
  if (/Android/.test(ua)) return "Android";
  if (/iPhone|iPad/.test(ua)) return "iOS";
  if (/Linux/.test(ua)) return "Linux";
  return "Unknown";
}

export async function probeGpu(): Promise<GpuInfo> {
  // WebGPU — the real deal, gives vendor/architecture.
  try {
    const gpu = (navigator as unknown as { gpu?: { requestAdapter?: () => Promise<unknown> } }).gpu;
    if (gpu?.requestAdapter) {
      const adapter = (await gpu.requestAdapter()) as {
        requestAdapterInfo?: () => Promise<{
          vendor?: string;
          architecture?: string;
          device?: string;
          description?: string;
        }>;
      } | null;
      if (adapter) {
        const info = await adapter.requestAdapterInfo?.().catch(() => undefined);
        return {
          kind: "webgpu",
          vendor: info?.vendor ?? null,
          architecture: info?.architecture ?? null,
          name: info?.device ?? null,
          description: info?.description ?? null,
        };
      }
    }
  } catch {
    /* fall through to WebGL */
  }

  // WebGL fallback — gives a renderer string, no real guarantees.
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (gl) {
      const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
      const renderer = debugInfo
        ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL))
        : String(gl.getParameter(gl.RENDERER));
      return {
        kind: "webgl",
        name: renderer || null,
        architecture: null,
        vendor: null,
        description: renderer || null,
      };
    }
  } catch {
    /* no GL */
  }

  return { kind: "none", name: null, architecture: null, vendor: null, description: null };
}

function estimateRamFromCores(cores: number | null): { ramGB: number; estimated: boolean } {
  if (cores == null) return { ramGB: 8, estimated: true };
  // Conservative mapping — better to under-promise than recommend a model
  // that swaps. Desktops report many cores; assume 8GB floor unless clearly
  // a big machine or a phone-class device with 4 cores.
  if (cores >= 32) return { ramGB: 32, estimated: true };
  if (cores >= 24) return { ramGB: 24, estimated: true };
  if (cores >= 16) return { ramGB: 16, estimated: true };
  if (cores >= 10) return { ramGB: 12, estimated: true };
  if (cores >= 6) return { ramGB: 8, estimated: true };
  if (cores >= 4) return { ramGB: 6, estimated: true };
  return { ramGB: 4, estimated: true };
}

export async function probeHardware(): Promise<HardwareProbe> {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    getBattery?: () => Promise<{ charging: boolean; level: number }>;
  };

  const rawRam = typeof nav.deviceMemory === "number" ? nav.deviceMemory : null;
  const cores = nav.hardwareConcurrency ?? null;

  const gpu = await probeGpu();

  let storage: HardwareProbe["storage"] = { availableGB: null, quotaGB: null };
  try {
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      storage = {
        availableGB: est.quota != null ? est.quota / 1024 ** 3 : null,
        quotaGB: est.quota != null ? est.quota / 1024 ** 3 : null,
      };
    }
  } catch {
    /* storage estimate not available */
  }

  let battery: HardwareProbe["battery"] = null;
  try {
    if (nav.getBattery) battery = await nav.getBattery();
  } catch {
    /* battery API unavailable */
  }

  const ram =
    rawRam ??
    (cores != null ? estimateRamFromCores(cores).ramGB : 8);

  return {
    ramGB: ram,
    ramEstimated: rawRam == null,
    cores,
    gpu,
    storage,
    network: {
      online: navigator.onLine,
      effectiveType: (navigator as unknown as { connection?: { effectiveType?: string } }).connection
        ?.effectiveType ?? "unknown",
    },
    platform: parsePlatform(),
    mobile: /Mobi|Android|iPhone|iPad/.test(navigator.userAgent),
    touch: "ontouchstart" in window || navigator.maxTouchPoints > 0,
    battery,
    secureContext: window.isSecureContext,
    webgpuSupported: gpu.kind === "webgpu",
  };
}