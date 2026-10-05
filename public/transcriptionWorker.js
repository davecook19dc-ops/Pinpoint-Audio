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

// Allow ONNX to use up to 4 threads (or half the logical cores)
env.backends.onnx.wasm.numThreads = Math.max(1, Math.floor((navigator.hardwareConcurrency || 4) / 2));

console.log("Multi-threading enabled:", typeof SharedArrayBuffer !== 'undefined');

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
      const startTime = performance.now();

      self.postMessage({
        type: 'status',
        status: 'transcribing',
        message: 'Transcribing speech to text with Moonshine...',
      });

      const chunkDuration = 30; // 30 seconds
      const sampleRate = 16000;
      const stepSamples = chunkDuration * sampleRate;
      const estimatedTotalChunks = Math.ceil(float32Array.length / stepSamples);

      let results = [];
      let processedChunks = 0;
      const { language, task, chunk_length_s, stride_length_s, chunk_callback, ...cleanOptions } = options || {};

      for (let start = 0; start < float32Array.length; start += stepSamples) {
        const end = Math.min(float32Array.length, start + stepSamples);
        const chunkArray = float32Array.slice(start, end);

        // Run model on the small 30-second slice
        const output = await transcriber(chunkArray, cleanOptions);
        const text = Array.isArray(output) ? output[0].text : output.text;
        if (text) results.push(text.trim());

        processedChunks++;
        const elapsedSeconds = (performance.now() - startTime) / 1000;
        const timePerChunk = elapsedSeconds / processedChunks;

        // Report progress to the UI
        self.postMessage({
          type: 'inference_progress',
          percent: Math.round((processedChunks / estimatedTotalChunks) * 100),
          chunkIndex: processedChunks,
          totalChunks: estimatedTotalChunks,
          processedSeconds: Math.round(end / sampleRate),
          totalDuration: Math.round(totalDuration),
          elapsedSeconds: Math.round(elapsedSeconds),
          estimatedTimeRemaining: Math.round((estimatedTotalChunks - processedChunks) * timePerChunk),
          message: `Processing chunk ${processedChunks} of ${estimatedTotalChunks}...`,
        });
      }

      // Join all chunks together into the final string
      const normalizedResult = { text: results.join(' ') };

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
