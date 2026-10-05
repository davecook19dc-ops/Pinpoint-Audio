// public/transcriptionWorker.js - Web Worker for local Whisper speech-to-text inference
// Uses Xenova/whisper-tiny.en with INT8 quantization, 30-second chunking, 5-second overlapping strides,
// and clean WebGPU to WASM (CPU with clamped numThreads) fallback to prevent worker freeze.

import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

// Configure transformers environment for browser Web Worker
env.allowLocalModels = false;
env.useBrowserCache = true;

// Configure ONNX WASM numThreads to prevent CPU throttling / freezing
if (!env.backends) env.backends = {};
if (!env.backends.onnx) env.backends.onnx = {};
if (!env.backends.onnx.wasm) env.backends.onnx.wasm = {};

const defaultConcurrency =
  typeof navigator !== 'undefined' && navigator.hardwareConcurrency
    ? navigator.hardwareConcurrency
    : 4;
const configuredThreads = Math.min(4, Math.max(1, Math.floor(defaultConcurrency / 2)));
env.backends.onnx.wasm.numThreads = configuredThreads;

// Singleton pattern to avoid re-allocating the Whisper pipeline
class WhisperPipelineSingleton {
  static model = 'Xenova/whisper-tiny.en';
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

      // Check if WebGPU is available in current browser environment
      const hasWebGpu = typeof navigator !== 'undefined' && 'gpu' in navigator && !!navigator.gpu;

      if (hasWebGpu) {
        try {
          // Attempt WebGPU with a 12s timeout guard to prevent shader compilation hang
          const webGpuPipelinePromise = pipeline('automatic-speech-recognition', this.model, {
            device: 'webgpu',
            quantized: true,
            progress_callback,
          });

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('WebGPU pipeline initialization timed out')), 12000)
          );

          this.instance = await Promise.race([webGpuPipelinePromise, timeoutPromise]);
          console.log('[Whisper Worker] Initialized with WebGPU acceleration.');
        } catch (err) {
          console.warn(
            '[Whisper Worker] WebGPU initialization failed or unstable, cleanly falling back to WASM (CPU):',
            err
          );
          this.instance = null;
        }
      }

      // Clean fallback to WASM (CPU)
      if (this.instance === null) {
        if (env.backends?.onnx?.wasm) {
          env.backends.onnx.wasm.numThreads = numThreads;
        }
        console.log(`[Whisper Worker] Initializing WASM (CPU) pipeline with ${numThreads} threads...`);
        this.instance = await pipeline('automatic-speech-recognition', this.model, {
          quantized: true,
          progress_callback,
        });
        console.log('[Whisper Worker] WASM (CPU) pipeline initialized successfully.');
      }
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
        message: 'Initializing local quantized Whisper pipeline (Xenova/whisper-tiny.en)...',
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
      const transcriber = await WhisperPipelineSingleton.getInstance((progressData) => {
        self.postMessage({
          type: 'download_progress',
          progressData,
        });
      });

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
        estimatedTimeRemaining: Math.round(totalDuration * 0.25),
        message: `Processing chunk 1 of ${estimatedTotalChunks}...`,
        detail: `Starting transcription across ${estimatedTotalChunks} chunks (30s stride)...`,
      });

      // Execute local transcription with chunking, overlapping strides, and quantized pipeline
      let output;
      try {
        output = await transcriber(float32Array, {
          chunk_length_s: 30, // Forces the model to process in 30-second blocks
          stride_length_s: 5,  // Overlaps chunks by 5 seconds to prevent cutting off words
          language: 'en',
          task: 'transcribe',
          return_timestamps: true,
          chunk_callback: chunkCallback,
          ...options,
        });
      } catch (inferenceErr) {
        console.warn(
          '[Whisper Worker] Inference error occurred. Retrying with WASM (CPU) fallback...',
          inferenceErr
        );
        WhisperPipelineSingleton.instance = null;
        if (env.backends?.onnx?.wasm) {
          const hw =
            typeof navigator !== 'undefined' && navigator.hardwareConcurrency
              ? navigator.hardwareConcurrency
              : 4;
          env.backends.onnx.wasm.numThreads = Math.min(4, Math.max(1, Math.floor(hw / 2)));
        }
        const wasmTranscriber = await pipeline('automatic-speech-recognition', WhisperPipelineSingleton.model, {
          quantized: true,
        });
        WhisperPipelineSingleton.instance = wasmTranscriber;

        output = await wasmTranscriber(float32Array, {
          chunk_length_s: 30,
          stride_length_s: 5,
          language: 'en',
          task: 'transcribe',
          return_timestamps: true,
          chunk_callback: chunkCallback,
          ...options,
        });
      }

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

      self.postMessage({
        type: 'complete',
        result: output,
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
