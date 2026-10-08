// src/utils/audio.ts - Audio utilities: formatting, extension detection, and native instantaneous audio export

/**
 * Formats time in seconds to mm:ss or hh:mm:ss.
 * Strictly guards against Infinity, NaN, and negative numbers.
 */
export function formatTime(totalSeconds: number): string {
  if (
    typeof totalSeconds !== 'number' ||
    isNaN(totalSeconds) ||
    !isFinite(totalSeconds) ||
    totalSeconds < 0
  ) {
    return '00:00';
  }
  const rounded = Math.round(totalSeconds);
  const hrs = Math.floor(rounded / 3600);
  const mins = Math.floor((rounded % 3600) / 60);
  const secs = Math.floor(rounded % 60);

  const mm = mins.toString().padStart(2, '0');
  const ss = secs.toString().padStart(2, '0');

  if (hrs > 0) {
    const hh = hrs.toString().padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

/**
 * Detects the appropriate audio file extension based on Blob MIME type.
 * Returns .webm for Chrome/Firefox, .m4a for Safari, or original audio type.
 */
export function getAudioFileExtension(blob: Blob): string {
  const type = (blob.type || '').toLowerCase();
  if (type.includes('webm')) return 'webm';
  if (type.includes('mp4') || type.includes('m4a') || type.includes('aac')) return 'm4a';
  if (type.includes('mp3') || type.includes('mpeg')) return 'mp3';
  if (type.includes('wav')) return 'wav';
  if (type.includes('ogg')) return 'ogg';
  if (type.includes('flac')) return 'flac';
  return 'webm';
}

/**
 * Instantly downloads native audio Blob without CPU-intensive encoding.
 * Creates an object URL, triggers a download with the detected extension, and cleans up.
 */
export function downloadNativeAudio(audioBlob: Blob, rawFileName: string): void {
  const ext = getAudioFileExtension(audioBlob);
  const cleanTitle = (rawFileName || 'recording')
    .replace(/\.[^/.]+$/, '')
    .trim()
    .replace(/[^a-zA-Z0-9_\-\s]/g, '')
    .replace(/\s+/g, '_')
    .toLowerCase();

  const fileName = `${cleanTitle || 'recording'}.${ext}`;
  const downloadUrl = URL.createObjectURL(audioBlob);

  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Revoke object URL after click
  setTimeout(() => {
    URL.revokeObjectURL(downloadUrl);
  }, 1000);
}

/**
 * Backwards compatibility alias for downloadNativeAudio.
 */
export async function downloadAudioAsMp3(
  audioBlob: Blob,
  rawFileName: string
): Promise<void> {
  downloadNativeAudio(audioBlob, rawFileName);
}

/**
 * Dynamic range normalization for 16 kHz Float32 PCM arrays.
 * Scales max peak to -1.0 dBFS (~0.89125) so quiet speakers are clearly audible
 * to the speech-to-text model without clipping.
 */
export function normalizeAudioBuffer(samples: Float32Array): Float32Array {
  if (!samples || samples.length === 0) return samples;

  let maxPeak = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > maxPeak) {
      maxPeak = abs;
    }
  }

  // If silent or near zero, return original samples to avoid amplifying background noise
  if (maxPeak < 1e-4) {
    return samples;
  }

  // -1.0 dBFS = 10^(-1.0 / 20) ~= 0.891250938
  const targetPeak = Math.pow(10, -1.0 / 20);
  const gain = targetPeak / maxPeak;

  const normalized = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const scaled = samples[i] * gain;
    normalized[i] = Math.max(-1.0, Math.min(1.0, scaled));
  }

  return normalized;
}

/**
 * Pre-conditions audio data for speech-to-text models:
 * 1. Applies a DC offset removal & basic 80Hz high-pass filter (removes low-end rumble/handling noise)
 * 2. Normalizes peak amplitude to -1.0 dBFS (~0.89) to lift quiet speakers without clipping
 */
export function preProcessAudioForTranscription(
  inputBuffer: Float32Array,
  sampleRate = 16000
): Float32Array {
  if (!inputBuffer || inputBuffer.length === 0) return inputBuffer;
  const output = new Float32Array(inputBuffer.length);

  // 1. Single-pole high-pass filter (~80 Hz cutoff) to eliminate DC bias and mic thumps
  const rc = 1.0 / (2 * Math.PI * 80);
  const dt = 1.0 / sampleRate;
  const alpha = rc / (rc + dt);
  let prevInput = inputBuffer[0];
  let prevOutput = 0;

  let maxPeak = 0;

  for (let i = 0; i < inputBuffer.length; i++) {
    const current = inputBuffer[i];
    const filtered = alpha * (prevOutput + current - prevInput);
    prevInput = current;
    prevOutput = filtered;
    output[i] = filtered;

    const absVal = Math.abs(filtered);
    if (absVal > maxPeak) maxPeak = absVal;
  }

  // 2. Peak normalization (target 0.89 / -1.0 dBFS)
  if (maxPeak > 0.001) {
    const gain = Math.min(0.89 / maxPeak, 10.0); // Cap gain at 10x to prevent amplifying pure silence/noise floor
    for (let i = 0; i < output.length; i++) {
      output[i] = Math.max(-1.0, Math.min(1.0, output[i] * gain));
    }
  }

  return output;
}
