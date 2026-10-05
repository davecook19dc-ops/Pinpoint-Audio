// src/services/transcriptionWorker.ts - Web Worker for local Whisper speech-to-text inference
// Uses Xenova/whisper-tiny.en with INT8 quantization, 30-second chunking, and 5-second overlapping strides

// @ts-ignore
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

// Configure transformers environment for browser Web Worker
env.allowLocalModels = false;
env.useBrowserCache = true;

// Singleton pattern to avoid re-allocating the Whisper pipeline
class WhisperPipelineSingleton {
  static model = 'Xenova/whisper-tiny.en';
  static instance: any = null;

  static async getInstance(progress_callback: any = null) {
    if (this.instance === null) {
      try {
        // Try WebGPU acceleration first for fastest execution
        this.instance = await pipeline('automatic-speech-recognition', this.model, {
          device: 'webgpu',
          quantized: true,
          progress_callback,
        });
      } catch (err) {
        console.warn('WebGPU acceleration not supported or failed, falling back to CPU quantized INT8:', err);
        this.instance = await pipeline('automatic-speech-recognition', this.model, {
          quantized: true,
          progress_callback,
        });
      }
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
        message: 'Initializing local quantized Whisper pipeline (Xenova/whisper-tiny.en)...',
      });

      // Get or load pipeline with download progress callbacks
      const transcriber = await WhisperPipelineSingleton.getInstance((progressData: any) => {
        self.postMessage({
          type: 'download_progress',
          progressData,
        });
      });

      // Calculate total audio duration in seconds
      const totalDuration = Math.max(0.1, audioData.length / 16000);
      const chunkLengthS = 30; // 30-second blocks
      const strideLengthS = 5;  // 5-second overlap
      const effectiveStep = chunkLengthS - strideLengthS; // 25s progress per chunk
      const estimatedTotalChunks = Math.max(1, Math.ceil(totalDuration / effectiveStep));

      const startTime = performance.now();
      let processedChunks = 0;

      const chunkCallback = (chunk: any) => {
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
      const output = await transcriber(audioData, {
        chunk_length_s: 30, // Forces the model to process in 30-second blocks
        stride_length_s: 5,  // Overlaps chunks by 5 seconds to prevent cutting off words
        language: 'en',
        task: 'transcribe',
        return_timestamps: true,
        chunk_callback: chunkCallback,
        ...options,
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
