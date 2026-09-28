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

function createInlineMp3Worker(): Worker {
  const code = `
    try {
      importScripts('https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js');
    } catch (e) {}

    self.onmessage = function (e) {
      const { leftChannel, rightChannel, numChannels, sampleRate, kbps = 128 } = e.data;
      if (!self.lamejs && typeof lamejs !== 'undefined') {
        self.lamejs = lamejs;
      }
      if (!self.lamejs || !self.lamejs.Mp3Encoder) {
        self.postMessage({ type: 'error', error: 'lamejs encoder library is not available in worker.' });
        return;
      }
      try {
        const leftFloat = new Float32Array(leftChannel);
        const rightFloat = rightChannel ? new Float32Array(rightChannel) : null;

        const mp3encoder = new self.lamejs.Mp3Encoder(numChannels >= 2 ? 2 : 1, sampleRate, kbps);
        const mp3Data = [];

        const leftInt16 = new Int16Array(leftFloat.length);
        for (let i = 0; i < leftFloat.length; i++) {
          const s = Math.max(-1, Math.min(1, leftFloat[i]));
          leftInt16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        let rightInt16 = null;
        if (rightFloat && rightFloat.length > 0) {
          rightInt16 = new Int16Array(rightFloat.length);
          for (let i = 0; i < rightFloat.length; i++) {
            const s = Math.max(-1, Math.min(1, rightFloat[i]));
            rightInt16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }
        }

        const sampleBlockSize = 1152;
        const totalSamples = leftInt16.length;

        for (let i = 0; i < totalSamples; i += sampleBlockSize) {
          const leftChunk = leftInt16.subarray(i, i + sampleBlockSize);
          let mp3buf;
          if (rightInt16) {
            const rightChunk = rightInt16.subarray(i, i + sampleBlockSize);
            mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
          } else {
            mp3buf = mp3encoder.encodeBuffer(leftChunk);
          }
          if (mp3buf.length > 0) {
            mp3Data.push(mp3buf.buffer.slice(mp3buf.byteOffset, mp3buf.byteOffset + mp3buf.byteLength));
          }
          if ((i / sampleBlockSize) % 100 === 0) {
            self.postMessage({ type: 'progress', progress: Math.min(1, i / totalSamples) });
          }
        }

        const mp3buf = mp3encoder.flush();
        if (mp3buf.length > 0) {
          mp3Data.push(mp3buf.buffer.slice(mp3buf.byteOffset, mp3buf.byteOffset + mp3buf.byteLength));
        }

        const mp3Blob = new Blob(mp3Data, { type: 'audio/mp3' });
        self.postMessage({ type: 'complete', blob: mp3Blob });
      } catch (err) {
        self.postMessage({ type: 'error', error: err.message || 'MP3 encoding failed' });
      }
    };
  `;
  const blob = new Blob([code], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob));
}

/**
 * Converts an audio Blob to an MP3 file client-side using a background Web Worker
 * to prevent UI freezes, then triggers native download via Blob URL.
 */
export async function downloadAudioAsMp3(
  audioBlob: Blob,
  rawFileName: string = 'recording',
  onProgress?: (progress: number) => void
): Promise<void> {
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
  const leftChannel = decodedBuffer.getChannelData(0);
  const rightChannel = numChannels >= 2 ? decodedBuffer.getChannelData(1) : null;

  // Clone channel data ArrayBuffers for zero-copy transferable postMessage
  const leftBuffer = leftChannel.buffer.slice(
    leftChannel.byteOffset,
    leftChannel.byteOffset + leftChannel.byteLength
  );
  let rightBuffer: ArrayBuffer | null = null;
  const transferables: Transferable[] = [leftBuffer];

  if (rightChannel) {
    rightBuffer = rightChannel.buffer.slice(
      rightChannel.byteOffset,
      rightChannel.byteOffset + rightChannel.byteLength
    );
    transferables.push(rightBuffer);
  }

  return new Promise<void>((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker('/mp3EncoderWorker.js');
    } catch {
      worker = createInlineMp3Worker();
    }

    worker.onmessage = (e) => {
      const { type, blob, progress, error } = e.data;
      if (type === 'progress') {
        if (onProgress) onProgress(progress);
      } else if (type === 'complete' && blob) {
        try {
          const downloadUrl = URL.createObjectURL(blob);
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
          resolve();
        } catch (err) {
          reject(err);
        } finally {
          worker.terminate();
        }
      } else if (type === 'error') {
        worker.terminate();
        reject(new Error(error || 'MP3 encoding failed in background worker'));
      }
    };

    worker.onerror = (err) => {
      worker.terminate();
      reject(new Error(err.message || 'MP3 encoder worker error'));
    };

    worker.postMessage(
      {
        leftChannel: leftBuffer,
        rightChannel: rightBuffer,
        numChannels,
        sampleRate,
        kbps: 128,
      },
      transferables
    );
  });
}

