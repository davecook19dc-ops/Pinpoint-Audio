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
 * Loads lamejs library dynamically from CDN if not already present on window.
 */
function getLameJs(): Promise<any> {
  if (typeof window !== 'undefined' && (window as any).lamejs) {
    return Promise.resolve((window as any).lamejs);
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="lamejs"]');
    if (existing) {
      existing.addEventListener('load', () => resolve((window as any).lamejs));
      existing.addEventListener('error', () => reject(new Error('Failed to load lamejs')));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js';
    script.onload = () => {
      if ((window as any).lamejs) {
        resolve((window as any).lamejs);
      } else {
        reject(new Error('lamejs not available on window object'));
      }
    };
    script.onerror = () => reject(new Error('Could not load lamejs CDN'));
    document.head.appendChild(script);
  });
}

/**
 * Converts an audio Blob to an MP3 file client-side using lamejs and triggers native download.
 */
export async function downloadAudioAsMp3(
  audioBlob: Blob,
  rawFileName: string = 'recording'
): Promise<void> {
  const lame = await getLameJs();
  const arrayBuffer = await audioBlob.arrayBuffer();

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioCtx();

  let decodedBuffer: AudioBuffer;
  try {
    decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  } finally {
    if (audioCtx.state !== 'closed') {
      audioCtx.close().catch(() => {});
    }
  }

  const numChannels = decodedBuffer.numberOfChannels;
  const sampleRate = decodedBuffer.sampleRate;
  const kbps = 128;
  const mp3encoder = new lame.Mp3Encoder(numChannels >= 2 ? 2 : 1, sampleRate, kbps);
  const mp3Data: any[] = [];

  const leftChannel = decodedBuffer.getChannelData(0);
  const rightChannel = numChannels >= 2 ? decodedBuffer.getChannelData(1) : null;

  // Convert Float32Array to Int16Array
  const leftInt16 = new Int16Array(leftChannel.length);
  for (let i = 0; i < leftChannel.length; i++) {
    const s = Math.max(-1, Math.min(1, leftChannel[i]));
    leftInt16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  let rightInt16: Int16Array | null = null;
  if (rightChannel) {
    rightInt16 = new Int16Array(rightChannel.length);
    for (let i = 0; i < rightChannel.length; i++) {
      const s = Math.max(-1, Math.min(1, rightChannel[i]));
      rightInt16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
  }

  const sampleBlockSize = 1152;
  for (let i = 0; i < leftInt16.length; i += sampleBlockSize) {
    const leftChunk = leftInt16.subarray(i, i + sampleBlockSize);
    let mp3buf: Int8Array | Uint8Array;
    if (rightInt16) {
      const rightChunk = rightInt16.subarray(i, i + sampleBlockSize);
      mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
    } else {
      mp3buf = mp3encoder.encodeBuffer(leftChunk);
    }
    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf.buffer.slice(mp3buf.byteOffset, mp3buf.byteOffset + mp3buf.byteLength));
    }
  }

  const mp3buf = mp3encoder.flush();
  if (mp3buf.length > 0) {
    mp3Data.push(mp3buf.buffer.slice(mp3buf.byteOffset, mp3buf.byteOffset + mp3buf.byteLength));
  }

  const mp3Blob = new Blob(mp3Data, { type: 'audio/mp3' });
  const downloadUrl = URL.createObjectURL(mp3Blob);

  const cleanTitle = rawFileName
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .toLowerCase();

  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = `${cleanTitle || 'recording'}.mp3`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);
}

