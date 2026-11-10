// src/utils/transcriptUtils.ts - Formatting and smart sentence-level paragraph splitting for timestamp-anchored interactive transcripts

export interface FormattedParagraph {
  id: string;
  speaker?: string;
  startTime: number;
  endTime: number;
  text: string;
}

export function formatSecondsToTime(seconds: number): string {
  if (typeof seconds !== 'number' || isNaN(seconds) || !isFinite(seconds) || seconds < 0) {
    return '00:00';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

interface SentenceUnit {
  text: string;
  startTime: number;
  endTime: number;
  speaker?: string;
}

/**
 * Breaks raw transcription chunks into individual sentences with interpolated timestamps,
 * then groups them into short, 2-3 sentence paragraphs (max ~45 words).
 */
export function groupChunksIntoParagraphs(
  chunks: { timestamp: [number, number]; text: string; speaker?: string }[]
): FormattedParagraph[] {
  if (!chunks || chunks.length === 0) return [];

  const sentences: SentenceUnit[] = [];

  // Step 1: Split every chunk into individual sentences and estimate timestamps
  for (const chunk of chunks) {
    const [chunkStart, chunkEnd] = chunk.timestamp;
    const chunkDuration = Math.max(0.1, chunkEnd - chunkStart);
    const cleanText = chunk.text.trim();
    if (!cleanText) continue;

    // Regex to split on full stops, question marks, and exclamation marks while keeping punctuation
    const rawSentences = cleanText.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || [cleanText];
    const validSentences = rawSentences.map((s) => s.trim()).filter(Boolean);

    const totalChars = validSentences.reduce((acc, s) => acc + s.length, 0);
    let accumulatedChars = 0;

    for (const sentence of validSentences) {
      const sentenceStartRatio = totalChars > 0 ? accumulatedChars / totalChars : 0;
      accumulatedChars += sentence.length;
      const sentenceEndRatio = totalChars > 0 ? accumulatedChars / totalChars : 1;

      sentences.push({
        text: sentence,
        startTime: chunkStart + sentenceStartRatio * chunkDuration,
        endTime: chunkStart + sentenceEndRatio * chunkDuration,
        speaker: chunk.speaker || 'Speaker 1',
      });
    }
  }

  // Step 2: Assemble sentences into bite-sized paragraphs (2-3 sentences or ~40 words max)
  const paragraphs: FormattedParagraph[] = [];
  let currentSentences: SentenceUnit[] = [];
  let currentWordCount = 0;

  const flushParagraph = () => {
    if (currentSentences.length === 0) return;
    const first = currentSentences[0];
    const last = currentSentences[currentSentences.length - 1];

    paragraphs.push({
      id: `para-${first.startTime.toFixed(2)}`,
      speaker: first.speaker,
      startTime: first.startTime,
      endTime: last.endTime,
      text: currentSentences.map((s) => s.text).join(' '),
    });

    currentSentences = [];
    currentWordCount = 0;
  };

  for (const sentence of sentences) {
    const wordCount = sentence.text.split(/\s+/).length;
    const isFirstInBatch = currentSentences.length === 0;
    const speakerChanged = !isFirstInBatch && currentSentences[0].speaker !== sentence.speaker;
    const wouldExceedWordLimit = currentWordCount + wordCount > 45;
    const hitSentenceLimit = currentSentences.length >= 3;

    if (speakerChanged || wouldExceedWordLimit || hitSentenceLimit) {
      flushParagraph();
    }

    currentSentences.push(sentence);
    currentWordCount += wordCount;
  }

  flushParagraph();
  return paragraphs;
}
