// public/transcriptionWorker.js - Web Worker for ultra-fast local Moonshine speech-to-text inference
// Uses onnx-community/moonshine-tiny-ONNX with Q4 quantization, running on WASM (CPU) with 30s chunking and 5s stride.

import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers';

// Configure transformers environment for browser Web Worker
env.allowLocalModels = false;
env.useBrowserCache = true;

// Configure ONNX WASM numThreads to optimize CPU throughput
if (!env.backends) env.backends = {};
if (!env.backends.onnx) env.backends.onnx = {};
if (!env.backends.onnx.wasm) env.backends.onnx.wasm = {};

const defaultConcurrency =
  typeof navigator !== 'undefined' && navigator.hardwareConcurrency
    ? navigator.hardwareConcurrency
    : 4;
const configuredThreads = Math.min(4, Math.max(1, Math.floor(defaultConcurrency / 2)));
env.backends.onnx.wasm.numThreads = configuredThreads;

// Singleton pattern to avoid re-allocating the Moonshine pipeline
class MoonshinePipelineSingleton {
  static model = 'onnx-community/moonshine-tiny-ONNX';
  static instance = null;

  static async getInstance(progress_callback = null) {
    if (this.instance === null) {
      const concurrency =
        typeof navigator !== 'undefined' && navigator.hardwareConcurrency
          ? navigator.hardwareConcurrency
          : 4;
      const numThreads = Math.min(4, Math.max(1, Math.floor(concurrency / 2)));

      if (env.backends?.onnx?.wasm) {
        env.backends.onnx.wasm.numThreads = numThreads;
      }

      console.log(`[Moonshine Worker] Initializing Moonshine pipeline with ${numThreads} threads on WASM...`);
      this.instance = await pipeline('automatic-speech-recognition', this.model, {
        dtype: 'q4', // Quantization for maximum speed
        device: 'wasm', // Runs incredibly fast on CPU
        quantized: true,
        progress_callback,
      });

      console.log('Model loaded on:', this.instance.device || 'wasm');
    }
    return this.instance;
  }
}

self.addEventListener('message', async (event) => {
  const { type, audioData, options } = event.data;

  if (type === 'transcribe') {
    try {
      self.postMessage({
        type: 'status',
        status: 'init',
        message: 'Initializing Moonshine model (onnx-community/moonshine-tiny-ONNX)...',
      });

      // Ensure audioData is a valid 16kHz Float32Array
      let float32Array;
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
      const transcriber = await MoonshinePipelineSingleton.getInstance((progressData) => {
        self.postMessage({
          type: 'download_progress',
          progressData,
        });
      });

      console.log('Model loaded on:', transcriber.device || 'wasm');

      // Calculate total audio duration in seconds (16,000 samples per second)
      const totalDuration = Math.max(0.1, float32Array.length / 16000);
      const chunkLengthS = 30; // 30-second blocks
      const strideLengthS = 5;  // 5-second overlap
      const effectiveStep = chunkLengthS - strideLengthS; // 25s progress per chunk
      const estimatedTotalChunks = Math.max(1, Math.ceil(totalDuration / effectiveStep));

      const startTime = performance.now();
      let processedChunks = 0;

      const chunkCallback = (chunk) => {
        processedChunks++;
        const currentChunk = processedChunks;
        const totalChunks = Math.max(processedChunks, estimatedTotalChunks);

        let processedSeconds = 0;
        if (chunk && Array.isArray(chunk.timestamp) && typeof chunk.timestamp[1] === 'number') {
          processedSeconds = Math.min(totalDuration, chunk.timestamp[1]);
        } else {
          processedSeconds = Math.min(totalDuration, processedChunks * effectiveStep);
        }

        const elapsedMs = performance.now() - startTime;
        const elapsedSeconds = Math.max(0.1, elapsedMs / 1000);
        const percent = Math.min(99, Math.max(1, Math.round((currentChunk / totalChunks) * 100)));

        // ETA calculation based on chunk processing rate
        const timePerChunk = elapsedSeconds / currentChunk;
        const remainingChunks = Math.max(0, totalChunks - currentChunk);
        const estimatedTimeRemaining = Math.max(0, Math.round(remainingChunks * timePerChunk));

        self.postMessage({
          type: 'inference_progress',
          percent,
          chunkIndex: currentChunk,
          totalChunks,
          processedSeconds: Math.round(processedSeconds),
          totalDuration: Math.round(totalDuration),
          elapsedSeconds: Math.round(elapsedSeconds),
          estimatedTimeRemaining,
          message: `Processing chunk ${currentChunk} of ${totalChunks}...`,
          detail: `Chunk ${currentChunk} of ${totalChunks} • ${Math.round(processedSeconds)}s of ${Math.round(totalDuration)}s audio`,
        });
      };

      self.postMessage({
        type: 'status',
        status: 'transcribing',
        message: `Processing chunk 1 of ${estimatedTotalChunks}...`,
      });

      self.postMessage({
        type: 'inference_progress',
        percent: 0,
        chunkIndex: 0,
        totalChunks: estimatedTotalChunks,
        processedSeconds: 0,
        totalDuration: Math.round(totalDuration),
        elapsedSeconds: 0,
        estimatedTimeRemaining: Math.round(totalDuration * 0.15),
        message: `Processing chunk 1 of ${estimatedTotalChunks}...`,
        detail: `Starting Moonshine transcription across ${estimatedTotalChunks} chunks (30s stride)...`,
      });

      // Filter out Whisper-specific parameters (e.g. language: 'en', task: 'transcribe')
      const { language, task, ...cleanOptions } = options || {};

      // Execute local transcription with chunking and stride (without Whisper-specific parameters)
      const output = await transcriber(float32Array, {
        chunk_length_s: 30, // Forces the model to process in 30-second blocks
        stride_length_s: 5,  // Overlaps chunks by 5 seconds to prevent cutting off words
        chunk_callback: chunkCallback,
        ...cleanOptions,
      });

      const totalElapsed = Math.round((performance.now() - startTime) / 1000);
      self.postMessage({
        type: 'inference_progress',
        percent: 100,
        chunkIndex: estimatedTotalChunks,
        totalChunks: estimatedTotalChunks,
        processedSeconds: Math.round(totalDuration),
        totalDuration: Math.round(totalDuration),
        elapsedSeconds: totalElapsed,
        estimatedTimeRemaining: 0,
        message: 'Finalizing transcript...',
      });

      let normalizedResult = output;
      if (Array.isArray(output) && output.length > 0) {
        normalizedResult = output[0];
      }
      if (typeof normalizedResult === 'string') {
        normalizedResult = { text: normalizedResult };
      }

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
