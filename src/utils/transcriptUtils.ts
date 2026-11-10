// src/utils/transcriptUtils.ts - Formatting and grouping for timestamp-anchored interactive transcripts

export interface FormattedParagraph {
  id: string;
  speaker?: string;
  startTime: number;
  endTime: number;
  text: string;
}

/**
 * Formats time in seconds to mm:ss format.
 */
export function formatSecondsToTime(seconds: number): string {
  if (typeof seconds !== 'number' || isNaN(seconds) || !isFinite(seconds) || seconds < 0) {
    return '00:00';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Groups raw slices into readable paragraphs based on silence gaps (> 2.0s) and speaker continuity.
 */
export function groupChunksIntoParagraphs(
  chunks: { timestamp: [number, number]; text: string; speaker?: string }[]
): FormattedParagraph[] {
  if (!chunks || chunks.length === 0) return [];

  const paragraphs: FormattedParagraph[] = [];
  let currentGroup: {
    speaker?: string;
    startTime: number;
    endTime: number;
    texts: string[];
  } | null = null;

  for (const chunk of chunks) {
    const [start, end] = chunk.timestamp;
    const speaker = chunk.speaker || 'Speaker 1';

    // Start a new paragraph if speaker changes or silence gap > 2 seconds
    const isNewSpeaker = currentGroup && currentGroup.speaker !== speaker;
    const isSignificantPause = currentGroup && start - currentGroup.endTime > 2.0;

    if (!currentGroup || isNewSpeaker || isSignificantPause) {
      if (currentGroup) {
        paragraphs.push({
          id: `para-${currentGroup.startTime}`,
          speaker: currentGroup.speaker,
          startTime: currentGroup.startTime,
          endTime: currentGroup.endTime,
          text: currentGroup.texts.join(' ').trim(),
        });
      }
      currentGroup = {
        speaker,
        startTime: start,
        endTime: end,
        texts: [chunk.text.trim()],
      };
    } else {
      currentGroup.endTime = end;
      currentGroup.texts.push(chunk.text.trim());
    }
  }

  if (currentGroup) {
    paragraphs.push({
      id: `para-${currentGroup.startTime}`,
      speaker: currentGroup.speaker,
      startTime: currentGroup.startTime,
      endTime: currentGroup.endTime,
      text: currentGroup.texts.join(' ').trim(),
    });
  }

  return paragraphs;
}
