// src/services/transcriptionWorker.ts - Web Worker for ultra-fast local Moonshine speech-to-text inference
// Uses onnx-community/moonshine-tiny-ONNX with Q4 quantization, running on WASM (CPU) with 30s chunking and 5s stride.

import { env, pipeline } from '@huggingface/transformers';

// Configure transformers environment for browser Web Worker
env.allowLocalModels = false;
env.useBrowserCache = true;

// Allow ONNX to use up to 4 threads (or half the logical cores)
if (!env.backends) (env as any).backends = {};
if (!env.backends.onnx) (env.backends as any).onnx = {};
if (!env.backends.onnx.wasm) (env.backends.onnx as any).wasm = {};
env.backends.onnx.wasm.numThreads = Math.max(1, Math.floor((navigator?.hardwareConcurrency || 4) / 2));

console.log("Multi-threading enabled:", typeof SharedArrayBuffer !== 'undefined');

// Singleton pattern to avoid re-allocating the Moonshine pipeline
class MoonshinePipelineSingleton {
  static model = 'onnx-community/moonshine-tiny-ONNX';
  static instance: any = null;

  static async getInstance(progress_callback: any = null) {
    if (this.instance === null) {
      const numThreads = Math.max(1, Math.floor((navigator?.hardwareConcurrency || 4) / 2));

      if (env.backends?.onnx?.wasm) {
        env.backends.onnx.wasm.numThreads = numThreads;
      }

      console.log(`[Moonshine Worker] Initializing Moonshine pipeline with ${numThreads} threads on WASM...`);
      this.instance = await pipeline('automatic-speech-recognition', this.model, {
        dtype: 'q4', // Quantization for maximum speed
        device: 'wasm', // Runs incredibly fast on CPU
        progress_callback,
      });

      console.log('Model loaded on:', this.instance.device || 'wasm');
    }
    return this.instance;
  }
}

self.addEventListener('message', async (event: MessageEvent) => {
  const { type, audioData, options } = event.data;

  if (type === 'transcribe') {
    try {
      self.postMessage({
        type: 'status',
        status: 'init',
        message: 'Initializing Moonshine model (onnx-community/moonshine-tiny-ONNX)...',
      });

      // Ensure audioData is a valid 16kHz Float32Array
      let float32Array: Float32Array;
      if (audioData instanceof Float32Array) {
        float32Array = audioData;
      } else if (audioData && audioData.buffer) {
        float32Array = new Float32Array(audioData.buffer);
      } else if (Array.isArray(audioData)) {
        float32Array = new Float32Array(audioData);
      } else {
        throw new Error('Invalid audio data received by worker. Expected Float32Array.');
      }

      // Get or load pipeline with download progress callbacks
      const transcriber = await MoonshinePipelineSingleton.getInstance((progressData: any) => {
        self.postMessage({
          type: 'download_progress',
          progressData,
        });
      });

      console.log('Model loaded on:', transcriber.device || 'wasm');

      // Audio cleaning before model ingestion: dynamic range normalization (-1.0 dBFS)
      const maxPeak = float32Array.reduce((max, s) => Math.max(max, Math.abs(s)), 0);
      let cleanedArray = float32Array;
      if (maxPeak > 1e-4) {
        const targetPeak = Math.pow(10, -1.0 / 20); // ~0.89125 (-1.0 dBFS)
        const gain = targetPeak / maxPeak;
        cleanedArray = new Float32Array(float32Array.length);
        for (let i = 0; i < float32Array.length; i++) {
          cleanedArray[i] = Math.max(-1.0, Math.min(1.0, float32Array[i] * gain));
        }
      }

      // Calculate total audio duration in seconds (16,000 samples per second)
      const totalDuration = Math.max(0.1, cleanedArray.length / 16000);
      const startTime = performance.now();

      self.postMessage({
        type: 'status',
        status: 'transcribing',
        message: 'Transcribing speech to text with Moonshine...',
      });

      // Strided sliding window chunking:
      // 30s slice with 1.5s overlap between consecutive slices (stride = 28.5s)
      const chunkDuration = 30; // 30 seconds
      const strideDuration = 28.5; // 28.5 seconds stride (1.5s overlap)
      const sampleRate = 16000;
      const chunkSamples = Math.round(chunkDuration * sampleRate);
      const strideSamples = Math.round(strideDuration * sampleRate);

      const estimatedTotalChunks = Math.max(
        1,
        cleanedArray.length <= chunkSamples
          ? 1
          : Math.ceil((cleanedArray.length - chunkSamples) / strideSamples) + 1
      );

      // Boundary deduplication trim helper
      const mergeWithDeduplication = (prevText: string, nextText: string): string => {
        if (!prevText || !prevText.trim()) return (nextText || '').trim();
        if (!nextText || !nextText.trim()) return prevText.trim();

        const prevWords = prevText.trim().split(/\s+/);
        const nextWords = nextText.trim().split(/\s+/);
        const clean = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/gi, '');

        // Search for repeating boundary overlap up to 8 words
        const maxCheck = Math.min(8, prevWords.length, nextWords.length);
        let bestOverlap = 0;

        for (let k = maxCheck; k >= 1; k--) {
          const tail = prevWords.slice(-k).map(clean);
          const head = nextWords.slice(0, k).map(clean);
          if (tail.length === head.length && tail.every((w, i) => w === head[i] && w.length > 0)) {
            bestOverlap = k;
            break;
          }
        }

        if (bestOverlap > 0) {
          const trimmedNext = nextWords.slice(bestOverlap).join(' ');
          return trimmedNext ? `${prevText.trim()} ${trimmedNext}` : prevText.trim();
        }

        return `${prevText.trim()} ${nextText.trim()}`;
      };

      let accumulatedText = '';
      let processedChunks = 0;
      const { language, task, chunk_length_s, stride_length_s, chunk_callback, ...cleanOptions } = options || {};

      for (let start = 0; start < cleanedArray.length; start += strideSamples) {
        const end = Math.min(cleanedArray.length, start + chunkSamples);
        const chunkArray = cleanedArray.slice(start, end);

        // Run model on the 30-second slice
        const output = await transcriber(chunkArray, cleanOptions);
        const rawChunkText = Array.isArray(output) ? output[0]?.text : (output?.text || (typeof output === 'string' ? output : ''));
        const chunkText = (rawChunkText || '').trim();

        if (chunkText) {
          accumulatedText = mergeWithDeduplication(accumulatedText, chunkText);
        }

        processedChunks++;
        const elapsedSeconds = (performance.now() - startTime) / 1000;
        const timePerChunk = elapsedSeconds / processedChunks;

        // Report progress to the UI
        self.postMessage({
          type: 'inference_progress',
          percent: Math.min(100, Math.round((processedChunks / estimatedTotalChunks) * 100)),
          chunkIndex: processedChunks,
          totalChunks: estimatedTotalChunks,
          processedSeconds: Math.round(end / sampleRate),
          totalDuration: Math.round(totalDuration),
          elapsedSeconds: Math.round(elapsedSeconds),
          estimatedTimeRemaining: Math.max(0, Math.round((estimatedTotalChunks - processedChunks) * timePerChunk)),
          message: `Processing chunk ${processedChunks} of ${estimatedTotalChunks}...`,
        });

        // Break if we've reached or exceeded end of audio
        if (end >= cleanedArray.length) {
          break;
        }
      }

      // Final normalized transcript
      const normalizedResult = { text: accumulatedText.trim() };

      const totalElapsed = Math.round((performance.now() - startTime) / 1000);
      self.postMessage({
        type: 'complete',
        result: normalizedResult,
        totalElapsed,
      });
    } catch (error) {
      console.error('Transcription worker error:', error);
      self.postMessage({
        type: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
});
