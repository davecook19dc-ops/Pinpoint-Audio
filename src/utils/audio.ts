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
