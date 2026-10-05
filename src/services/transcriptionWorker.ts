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

      // Calculate total audio duration in seconds (16,000 samples per second)
      const totalDuration = Math.max(0.1, float32Array.length / 16000);
      const startTime = performance.now();

      self.postMessage({
        type: 'status',
        status: 'transcribing',
        message: 'Transcribing speech to text with Moonshine...',
      });

      // Track chunk processing for progress reporting and prevent OOM
      const chunkLengthS = 30;
      const strideLengthS = 5;
      const effectiveChunkS = chunkLengthS - strideLengthS;
      const estimatedTotalChunks = Math.max(1, Math.ceil(totalDuration / effectiveChunkS));
      let processedChunks = 0;

      const chunkCallback = (chunk: any) => {
        processedChunks++;
        const elapsedSeconds = Math.round((performance.now() - startTime) / 1000);
        const percent = Math.min(
          99,
          Math.max(15, Math.round((processedChunks / estimatedTotalChunks) * 80) + 15)
        );
        const processedSeconds = Math.min(Math.round(totalDuration), processedChunks * effectiveChunkS);
        const avgSecondsPerChunk = elapsedSeconds / Math.max(1, processedChunks);
        const remainingChunks = Math.max(0, estimatedTotalChunks - processedChunks);
        const estimatedTimeRemaining = Math.round(remainingChunks * avgSecondsPerChunk);

        self.postMessage({
          type: 'inference_progress',
          percent,
          chunkIndex: processedChunks,
          totalChunks: estimatedTotalChunks,
          processedSeconds,
          totalDuration: Math.round(totalDuration),
          elapsedSeconds,
          estimatedTimeRemaining,
          message: `Transcribing chunk ${processedChunks} of ${estimatedTotalChunks}...`,
          detail: `Processed ${processedSeconds}s of ${Math.round(totalDuration)}s audio`,
          chunk,
        });
      };

      self.postMessage({
        type: 'inference_progress',
        percent: 15,
        chunkIndex: 0,
        totalChunks: estimatedTotalChunks,
        processedSeconds: 0,
        totalDuration: Math.round(totalDuration),
        elapsedSeconds: 0,
        estimatedTimeRemaining: Math.max(1, Math.round(totalDuration * 0.1)),
        message: 'Transcribing speech to text with Moonshine...',
        detail: `Starting transcription of ${Math.round(totalDuration)}s audio (${estimatedTotalChunks} chunks)...`,
      });

      // Filter out Whisper-specific parameters (e.g. language: 'en', task: 'transcribe')
      const { language, task, ...cleanOptions } = options || {};

      // Execute Moonshine with chunking to prevent std::bad_alloc OOM on long audio
      const output = await transcriber(float32Array, {
        chunk_length_s: 30,
        stride_length_s: 5,
        chunk_callback: chunkCallback,
        ...cleanOptions,
      });

      const totalElapsed = Math.round((performance.now() - startTime) / 1000);
      self.postMessage({
        type: 'inference_progress',
        percent: 100,
        chunkIndex: Math.max(processedChunks, estimatedTotalChunks),
        totalChunks: Math.max(processedChunks, estimatedTotalChunks),
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
