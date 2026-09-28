/* global importScripts, self */
try {
  importScripts('https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js');
} catch (e) {
  console.error('Failed to import lamejs in Web Worker:', e);
}

self.onmessage = function (e) {
  const { leftChannel, rightChannel, numChannels, sampleRate, kbps = 128 } = e.data;

  if (!self.lamejs && typeof lamejs !== 'undefined') {
    self.lamejs = lamejs;
  }

  if (!self.lamejs || !self.lamejs.Mp3Encoder) {
    self.postMessage({
      type: 'error',
      error: 'lamejs encoder library is not available in worker.',
    });
    return;
  }

  try {
    const leftFloat = new Float32Array(leftChannel);
    const rightFloat = rightChannel ? new Float32Array(rightChannel) : null;

    const mp3encoder = new self.lamejs.Mp3Encoder(numChannels >= 2 ? 2 : 1, sampleRate, kbps);
    const mp3Data = [];

    // Convert Float32Array to Int16Array in worker thread
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

      // Periodically notify progress
      if ((i / sampleBlockSize) % 100 === 0) {
        self.postMessage({
          type: 'progress',
          progress: Math.min(1, i / totalSamples),
        });
      }
    }

    const mp3buf = mp3encoder.flush();
    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf.buffer.slice(mp3buf.byteOffset, mp3buf.byteOffset + mp3buf.byteLength));
    }

    const mp3Blob = new Blob(mp3Data, { type: 'audio/mp3' });
    self.postMessage({ type: 'complete', blob: mp3Blob });
  } catch (err) {
    self.postMessage({
      type: 'error',
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
