// transcriptionWorker.js - Runs @xenova/transformers speech-to-text in a dedicated background Web Worker
// Strictly local in-browser processing via CDN script module without external API calls

import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

// Configure transformers environment for browser Web Worker
env.allowLocalModels = false;
env.useBrowserCache = true;

// Singleton pattern to avoid re-allocating the Whisper pipeline
class WhisperPipelineSingleton {
  static model = 'Xenova/whisper-tiny.en';
  static instance = null;

  static async getInstance(progress_callback = null) {
    if (this.instance === null) {
      try {
        this.instance = await pipeline('automatic-speech-recognition', this.model, {
          device: 'webgpu',
          quantized: true,
          progress_callback,
        });
      } catch (err) {
        console.warn('WebGPU acceleration not supported or failed, falling back to CPU:', err);
        this.instance = await pipeline('automatic-speech-recognition', this.model, {
          quantized: true,
          progress_callback,
        });
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

      // Get or load pipeline with download progress callbacks
      const transcriber = await WhisperPipelineSingleton.getInstance((progressData) => {
        self.postMessage({
          type: 'download_progress',
          progressData,
        });
      });

      // Calculate total audio duration in seconds
      const totalDuration = Math.max(0.1, audioData.length / 16000);
      const startTime = performance.now();
      let processedChunks = 0;

      const chunkCallback = (chunk) => {
        processedChunks++;
        let processedSeconds = 0;
        if (chunk && Array.isArray(chunk.timestamp) && typeof chunk.timestamp[1] === 'number') {
          processedSeconds = Math.min(totalDuration, chunk.timestamp[1]);
        } else {
          processedSeconds = Math.min(totalDuration, processedChunks * 30);
        }

        const elapsedMs = performance.now() - startTime;
        const elapsedSeconds = Math.max(0.1, elapsedMs / 1000);
        const percent = Math.min(99, Math.max(1, Math.round((processedSeconds / totalDuration) * 100)));

        // ETA calculation: (elapsedSeconds / processedSeconds) * remainingSeconds
        const rate = elapsedSeconds / Math.max(0.1, processedSeconds);
        const remainingSeconds = Math.max(0, totalDuration - processedSeconds);
        const estimatedTimeRemaining = Math.max(0, Math.round(remainingSeconds * rate));

        self.postMessage({
          type: 'inference_progress',
          percent,
          processedSeconds: Math.round(processedSeconds),
          totalDuration: Math.round(totalDuration),
          elapsedSeconds: Math.round(elapsedSeconds),
          estimatedTimeRemaining: Math.round(estimatedTimeRemaining),
        });
      };

      self.postMessage({
        type: 'status',
        status: 'transcribing',
        message: 'Processing audio buffer locally in background worker...',
      });

      self.postMessage({
        type: 'inference_progress',
        percent: 0,
        processedSeconds: 0,
        totalDuration: Math.round(totalDuration),
        elapsedSeconds: 0,
        estimatedTimeRemaining: Math.round(totalDuration * 0.35),
      });

      // Execute local transcription with quantized pipeline and chunk_callback
      const output = await transcriber(audioData, {
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: true,
        chunk_callback: chunkCallback,
        ...options,
      });

      const totalElapsed = Math.round((performance.now() - startTime) / 1000);
      self.postMessage({
        type: 'inference_progress',
        percent: 100,
        processedSeconds: Math.round(totalDuration),
        totalDuration: Math.round(totalDuration),
        elapsedSeconds: totalElapsed,
        estimatedTimeRemaining: 0,
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
