// public/summarizerWorker.js - Web Worker for local client-side summarization
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers';

// Configure transformers environment for browser Web Worker
env.allowLocalModels = false;
env.useBrowserCache = true;

class SummarizerSingleton {
  static model = 'Xenova/distilbart-cnn-6-6';
  static instance = null;

  static async getInstance(progress_callback = null) {
    if (this.instance === null) {
      this.instance = await pipeline('summarization', this.model, {
        quantized: true,
        progress_callback,
      });
    }
    return this.instance;
  }
}

// Simple chunking function to stay within the model's token limits (typically 1024 tokens, roughly 3000-4000 characters)
function chunkText(text, maxChars = 3000) {
  const paragraphs = text.split(/\n+/);
  const chunks = [];
  let currentChunk = '';

  for (const para of paragraphs) {
    if ((currentChunk + '\n' + para).length > maxChars) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = para;
    } else {
      currentChunk = currentChunk ? currentChunk + '\n' + para : para;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

self.addEventListener('message', async (event) => {
  const { type, text } = event.data;

  if (type === 'summarize') {
    if (!text || !text.trim()) {
      self.postMessage({ type: 'error', error: 'Empty transcript text provided.' });
      return;
    }

    try {
      self.postMessage({
        type: 'status',
        status: 'init',
        message: 'Initializing local Bart summarizer pipeline (Xenova/distilbart-cnn-6-6)...',
      });

      const summarizer = await SummarizerSingleton.getInstance((progressData) => {
        if (progressData.status === 'progress') {
          self.postMessage({
            type: 'download_progress',
            percent: Math.round(progressData.loaded / progressData.total * 100),
            file: progressData.file,
          });
        }
      });

      self.postMessage({
        type: 'status',
        status: 'summarizing',
        message: 'Extracting key takeaways locally in background worker...',
      });

      const chunks = chunkText(text);
      const summaries = [];

      for (let i = 0; i < chunks.length; i++) {
        self.postMessage({
          type: 'status',
          status: 'processing_chunk',
          message: `Summarizing section ${i + 1} of ${chunks.length}...`,
          percent: Math.round(((i) / chunks.length) * 100),
        });

        // Bart summarization call
        const res = await summarizer(chunks[i], {
          max_length: 120,
          min_length: 30,
          chunk_size: 512,
        });

        if (res && res[0] && res[0].summary_text) {
          summaries.push(res[0].summary_text);
        }
      }

      const combinedSummary = summaries.join('\n');

      self.postMessage({
        type: 'done',
        summary: combinedSummary,
      });

    } catch (err) {
      console.error('Error inside summarizer worker:', err);
      self.postMessage({ type: 'error', error: err.message || 'Error occurred during summarization.' });
    }
  }
});
