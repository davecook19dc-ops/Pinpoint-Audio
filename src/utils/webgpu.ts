// src/utils/webgpu.ts - WebGPU capability and hardware adapter detection

/**
 * Checks for WebGPU hardware adapter access in the current browser/device.
 */
export async function checkWebGPUSupport(): Promise<boolean> {
  const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
  if (!nav || !nav.gpu) return false;
  try {
    const adapter = await nav.gpu.requestAdapter();
    return !!adapter;
  } catch (e) {
    return false;
  }
}
