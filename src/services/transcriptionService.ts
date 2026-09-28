// src/services/transcriptionService.ts - Service for running local Whisper speech-to-text in a Web Worker

export interface TranscriptionChunk {
  timestamp: [number, number]; // [startSec, endSec]
  text: string;
}

export interface TranscriptionResult {
  text: string;
  chunks?: TranscriptionChunk[];
}

export interface TranscriptionProgress {
  stage: 'preparing_audio' | 'loading_model' | 'downloading' | 'transcribing' | 'done' | 'error';
  percent?: number;
  message: string;
  detail?: string;
  elapsedTime?: number;
  estimatedTimeRemaining?: number;
}

class TranscriptionService {
  private worker: Worker | null = null;
  private isProcessing = false;

  /**
   * Resamples and downmixes an arbitrary audio Blob to a 16,000 Hz, mono Float32Array
   * suitable for the Whisper model.
   */
  async prepareAudioBuffer(audioBlob: Blob): Promise<Float32Array> {
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

    const targetSampleRate = 16000;
    const targetLength = Math.max(1, Math.round(decodedBuffer.duration * targetSampleRate));

    // Resample to 16kHz mono using native OfflineAudioContext
    const offlineCtx = new OfflineAudioContext(1, targetLength, targetSampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = decodedBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);

    const renderedBuffer = await offlineCtx.startRendering();
    return renderedBuffer.getChannelData(0);
  }

  /**
   * Initializes or reuses the background Web Worker
   */
  private getWorker(): Worker {
    if (!this.worker) {
      try {
        // Attempt to instantiate same-origin worker from /transcriptionWorker.js
        this.worker = new Worker('/transcriptionWorker.js', { type: 'module' });
      } catch (err) {
        console.warn('Failed to initialize module worker from static path, attempting fallback:', err);
        // Fallback: create blob worker with dynamic import
        const fallbackScript = `
          import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';
          env.allowLocalModels = false;
          env.useBrowserCache = true;
          let transcriber = null;

          self.addEventListener('message', async (e) => {
            const { type, audioData, options } = e.data;
            if (type === 'transcribe') {
              try {
                if (!transcriber) {
                  self.postMessage({ type: 'status', status: 'init', message: 'Loading Whisper-tiny.en model...' });
                  try {
                    transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
                      device: 'webgpu',
                      quantized: true,
                      progress_callback: (p) => self.postMessage({ type: 'download_progress', progressData: p }),
                    });
                  } catch (webGpuErr) {
                    console.warn('WebGPU init failed, using CPU fallback:', webGpuErr);
                    transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
                      quantized: true,
                      progress_callback: (p) => self.postMessage({ type: 'download_progress', progressData: p }),
                    });
                  }
                }
                self.postMessage({ type: 'status', status: 'transcribing', message: 'Transcribing speech to text...' });

                const totalDuration = audioData.length / 16000;
                const startTime = performance.now();
                let processedChunks = 0;

                const chunk_callback = (chunk) => {
                  processedChunks++;
                  let processedSeconds = processedChunks * 30;
                  if (chunk && chunk.timestamp && Array.isArray(chunk.timestamp) && typeof chunk.timestamp[1] === 'number') {
                    processedSeconds = Math.max(processedSeconds, chunk.timestamp[1]);
                  }
                  processedSeconds = Math.min(totalDuration, processedSeconds);

                  const elapsedTime = (performance.now() - startTime) / 1000;
                  const remainingAudio = Math.max(0, totalDuration - processedSeconds);
                  const estimatedTimeRemaining = processedSeconds > 0 ? (elapsedTime / processedSeconds) * remainingAudio : 0;
                  const percentage = Math.min(99, Math.max(1, Math.round((processedSeconds / Math.max(1, totalDuration)) * 100)));

                  self.postMessage({
                    type: 'inference_progress',
                    percentage,
                    elapsedTime: Math.round(elapsedTime),
                    estimatedTimeRemaining: Math.round(estimatedTimeRemaining),
                  });
                };

                const res = await transcriber(audioData, {
                  chunk_length_s: 30,
                  stride_length_s: 5,
                  return_timestamps: true,
                  chunk_callback,
                  ...options,
                });
                self.postMessage({ type: 'complete', result: res });
              } catch (err) {
                self.postMessage({ type: 'error', error: err.message || String(err) });
              }
            }
          });
        `;
        const blob = new Blob([fallbackScript], { type: 'application/javascript' });
        this.worker = new Worker(URL.createObjectURL(blob), { type: 'module' });
      }
    }
    return this.worker;
  }

  /**
   * Transcribes an audio blob using local Whisper-tiny.en inside the Web Worker
   */
  async transcribe(
    audioBlob: Blob,
    onProgress: (progress: TranscriptionProgress) => void
  ): Promise<TranscriptionResult> {
    if (this.isProcessing) {
      throw new Error('Transcription already in progress.');
    }

    this.isProcessing = true;

    try {
      // Step 1: Resample & prepare audio buffer on main thread via native AudioContext
      onProgress({
        stage: 'preparing_audio',
        percent: 5,
        message: 'Preparing audio buffer (16kHz PCM)...',
      });

      const audioFloat32 = await this.prepareAudioBuffer(audioBlob);

      onProgress({
        stage: 'loading_model',
        percent: 15,
        message: 'Loading Whisper speech-to-text model...',
        detail: 'Model: Xenova/whisper-tiny.en',
      });

      const worker = this.getWorker();

      return await new Promise<TranscriptionResult>((resolve, reject) => {
        const fileProgressMap = new Map<string, number>();

        const cleanup = () => {
          this.isProcessing = false;
          worker.removeEventListener('message', handleMessage);
          worker.removeEventListener('error', handleError);
        };

        const handleError = (event: ErrorEvent) => {
          cleanup();
          reject(new Error(`Web Worker error: ${event.message}`));
        };

        const handleMessage = (event: MessageEvent) => {
          const data = event.data;

          if (data.type === 'download_progress') {
            const p = data.progressData;
            if (p.file) {
              if (p.status === 'progress' && typeof p.progress === 'number') {
                fileProgressMap.set(p.file, p.progress);
              } else if (p.status === 'done') {
                fileProgressMap.set(p.file, 100);
              }
            }

            // Estimate aggregate progress across downloaded files
            let avgProgress = 20;
            if (fileProgressMap.size > 0) {
              const values = Array.from(fileProgressMap.values());
              const sum = values.reduce((acc, v) => acc + v, 0);
              avgProgress = Math.min(85, Math.round(20 + (sum / values.length) * 0.65));
            }

            onProgress({
              stage: 'downloading',
              percent: avgProgress,
              message: 'Loading Whisper model weights...',
              detail: p.file
                ? `${p.file.split('/').pop()} ${p.progress ? `(${Math.round(p.progress)}%)` : ''}`
                : undefined,
            });
          } else if (data.type === 'inference_progress') {
            onProgress({
              stage: 'transcribing',
              percent: data.percentage,
              message: 'Transcribing speech with local Whisper...',
              detail: 'Processing chunks locally in background Web Worker',
              elapsedTime: data.elapsedTime,
              estimatedTimeRemaining: data.estimatedTimeRemaining,
            });
          } else if (data.type === 'status') {
            if (data.status === 'transcribing') {
              onProgress({
                stage: 'transcribing',
                percent: 20,
                message: 'Transcribing audio buffer locally in Web Worker...',
                detail: 'No data sent to cloud servers',
              });
            } else {
              onProgress({
                stage: 'loading_model',
                percent: 25,
                message: data.message || 'Initializing model...',
              });
            }
          } else if (data.type === 'complete') {
            cleanup();
            onProgress({
              stage: 'done',
              percent: 100,
              message: 'Transcription complete!',
            });
            resolve(data.result as TranscriptionResult);
          } else if (data.type === 'error') {
            cleanup();
            reject(new Error(data.error || 'Transcription failed in worker'));
          }
        };

        worker.addEventListener('message', handleMessage);
        worker.addEventListener('error', handleError);

        // Transfer audio buffer to worker with zero copy
        worker.postMessage(
          {
            type: 'transcribe',
            audioData: audioFloat32,
            options: {},
          },
          [audioFloat32.buffer]
        );
      });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Cancel ongoing transcription and terminate worker to free memory
   */
  cancel() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.isProcessing = false;
  }
}

export const transcriptionService = new TranscriptionService();
