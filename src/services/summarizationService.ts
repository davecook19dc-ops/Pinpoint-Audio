// src/services/summarizationService.ts - Service for local offline study takeaway generation
import { CalloutType, Note } from '../types';

export interface SummarizationProgress {
  stage: 'loading_model' | 'downloading' | 'processing' | 'done' | 'error';
  percent: number;
  message: string;
}

export interface ExtractedStudyTakeaways {
  keyPoints: string[];
  actionItems: string[];
  studyQuestions: string[];
}

class SummarizationService {
  private worker: Worker | null = null;
  private isProcessing = false;

  private getWorker(): Worker {
    if (!this.worker) {
      try {
        this.worker = new Worker('/summarizerWorker.js', { type: 'module' });
      } catch (err) {
        console.warn('Failed to initialize summarizer module worker, fallback to standard Worker:', err);
        this.worker = new Worker('/summarizerWorker.js');
      }
    }
    return this.worker;
  }

  public async generateTakeaways(
    transcript: string,
    onProgress: (prog: SummarizationProgress) => void
  ): Promise<ExtractedStudyTakeaways> {
    if (this.isProcessing) {
      throw new Error('Another summarization task is currently in progress.');
    }

    this.isProcessing = true;
    const worker = this.getWorker();

    return new Promise<ExtractedStudyTakeaways>((resolve, reject) => {
      const handleMessage = (e: MessageEvent) => {
        const { type, status, percent, message, summary, error } = e.data;

        if (type === 'status') {
          if (status === 'init') {
            onProgress({
              stage: 'loading_model',
              percent: 0,
              message: message || 'Loading summarization model...',
            });
          } else if (status === 'summarizing') {
            onProgress({
              stage: 'processing',
              percent: 50,
              message: message || 'Extracting core takeaways...',
            });
          } else if (status === 'processing_chunk') {
            onProgress({
              stage: 'processing',
              percent: percent || 75,
              message: message || 'Processing transcript segments...',
            });
          }
        } else if (type === 'download_progress') {
          onProgress({
            stage: 'downloading',
            percent: percent || 0,
            message: `Downloading AI study model...`,
          });
        } else if (type === 'done') {
          cleanup();
          const takeaways = this.parseSummaryToTakeaways(summary || '', transcript);
          resolve(takeaways);
        } else if (type === 'error') {
          cleanup();
          reject(new Error(error || 'Summarization failed.'));
        }
      };

      const cleanup = () => {
        worker.removeEventListener('message', handleMessage);
        this.isProcessing = false;
      };

      worker.addEventListener('message', handleMessage);
      worker.postMessage({ type: 'summarize', text: transcript });
    });
  }

  /**
   * Helper to turn Bart summaries and original text into structured study materials
   */
  private parseSummaryToTakeaways(summary: string, transcript: string): ExtractedStudyTakeaways {
    // If the model didn't return any text, fall back to high-quality parsing of the transcript
    const sourceText = summary.trim() || transcript.trim();
    const sentences = sourceText
      .split(/[.!?]+\s+/)
      .map((s) => s.trim().replace(/^-\s*/, ''))
      .filter((s) => s.length > 15);

    const keyPoints: string[] = [];
    const actionItems: string[] = [];
    const studyQuestions: string[] = [];

    // Categorize or generate structured outputs from sentences
    sentences.forEach((sentence, idx) => {
      // 1. Clean the text
      const cleaned = sentence.charAt(0).toUpperCase() + sentence.slice(1);

      // Distribute sentences into study takeaways
      if (idx % 3 === 0) {
        keyPoints.push(cleaned);
      } else if (idx % 3 === 1) {
        // Create an action item by converting to active verbs
        let action = cleaned;
        if (!cleaned.toLowerCase().startsWith('review') && !cleaned.toLowerCase().startsWith('study') && !cleaned.toLowerCase().startsWith('verify')) {
          const verbs = ['Review the concepts regarding', 'Study the details of', 'Verify practical understanding of', 'Analyze the core principles of'];
          const prefix = verbs[idx % verbs.length];
          action = `${prefix} ${cleaned.charAt(0).toLowerCase() + cleaned.slice(1)}`;
        }
        actionItems.push(action);
      } else {
        // Formulate a study question from the statement
        let question = cleaned;
        if (!cleaned.endsWith('?')) {
          const questionPrefixes = [
            'What are the key implications of',
            'How should we understand',
            'Why is it critical to analyze',
            'What is the standard procedure for',
          ];
          const prefix = questionPrefixes[idx % questionPrefixes.length];
          question = `${prefix} ${cleaned.charAt(0).toLowerCase() + cleaned.slice(1)}${cleaned.endsWith('.') ? '' : '.'}?`;
          question = question.replace(/\.\?$/, '?');
        }
        studyQuestions.push(question);
      }
    });

    // Handle fallback if empty
    if (keyPoints.length === 0) {
      keyPoints.push('Review the main concepts and structure of this lecture session.');
    }
    if (actionItems.length === 0) {
      actionItems.push('Review recorded audio and slide annotations for this lecture.');
    }
    if (studyQuestions.length === 0) {
      studyQuestions.push('What are the primary definitions and core themes of today\'s discussion?');
    }

    return {
      keyPoints: keyPoints.slice(0, 8),
      actionItems: actionItems.slice(0, 6),
      studyQuestions: studyQuestions.slice(0, 6),
    };
  }
}

export const summarizationService = new SummarizationService();
