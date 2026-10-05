// src/services/speechService.ts - Web Speech API live dictation service
// Provides real-time speech recognition using the browser's native engine.

export interface SpeechServiceCallbacks {
  onInterimResult?: (interimText: string) => void;
  onFinalResult?: (finalText: string, timestampSeconds: number) => void;
  onError?: (error: string) => void;
  onStatusChange?: (status: 'idle' | 'listening' | 'stopped') => void;
}

export class SpeechService {
  private recognition: any = null;
  private isListening = false;
  private shouldRestart = false;
  private callbacks: SpeechServiceCallbacks = {};
  private getTimestampSeconds: () => number = () => 0;

  constructor() {
    this.initRecognition();
  }

  public isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return !!(
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    );
  }

  private initRecognition() {
    if (!this.isSupported()) return;
    try {
      const SpeechRecognitionClass =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          const transcriptText = item[0]?.transcript || '';
          if (item.isFinal) {
            const trimmed = transcriptText.trim();
            if (trimmed) {
              const timeSec = this.getTimestampSeconds();
              this.callbacks.onFinalResult?.(trimmed, timeSec);
            }
          } else {
            interim += transcriptText;
          }
        }
        this.callbacks.onInterimResult?.(interim);
      };

      recognition.onerror = (event: any) => {
        // Ignorable transient events
        if (event.error === 'no-speech' || event.error === 'aborted') {
          return;
        }
        console.warn('SpeechRecognition error:', event.error);
        this.callbacks.onError?.(event.error);
      };

      recognition.onend = () => {
        // If we are still supposed to be listening (e.g. Chrome 60-second cutoff), restart automatically
        if (this.shouldRestart && this.isListening) {
          try {
            recognition.start();
          } catch (e) {
            // Already started or restarting
          }
        } else {
          this.isListening = false;
          this.callbacks.onStatusChange?.('stopped');
        }
      };

      this.recognition = recognition;
    } catch (e) {
      console.warn('Could not initialize SpeechRecognition:', e);
    }
  }

  public start(
    callbacks: SpeechServiceCallbacks,
    getTimestampSeconds: () => number = () => 0
  ) {
    if (!this.isSupported()) {
      callbacks.onError?.('Web Speech API is not supported in this browser.');
      return;
    }

    this.callbacks = callbacks;
    this.getTimestampSeconds = getTimestampSeconds;
    this.shouldRestart = true;
    this.isListening = true;

    if (!this.recognition) {
      this.initRecognition();
    }

    try {
      this.recognition.start();
      this.callbacks.onStatusChange?.('listening');
    } catch (e) {
      // If already started or aborting, stop and retry
      try {
        this.recognition.stop();
        setTimeout(() => {
          if (this.shouldRestart) {
            try {
              this.recognition.start();
              this.callbacks.onStatusChange?.('listening');
            } catch (err) {
              console.warn('Failed to restart SpeechRecognition:', err);
            }
          }
        }, 150);
      } catch (err) {
        console.warn('SpeechRecognition start failed:', err);
      }
    }
  }

  public stop() {
    this.shouldRestart = false;
    this.isListening = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {}
    }
    this.callbacks.onInterimResult?.('');
    this.callbacks.onStatusChange?.('stopped');
  }
}

export const speechService = new SpeechService();
