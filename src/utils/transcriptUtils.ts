// src/utils/transcriptUtils.ts - Punctuation-agnostic paragraph chunker for timestamp-anchored interactive transcripts

export interface FormattedParagraph {
  id: string;
  speaker: string;
  startTime: number;
  endTime: number;
  text: string;
}

export function formatSecondsToTime(seconds: number): string {
  if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function splitIntoThoughtUnits(text: string): string[] {
  const clean = text.trim();
  if (!clean) return [];

  // Split by punctuation if available (. ! ?)
  const punctuated = clean.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g);
  const units: string[] = [];

  if (punctuated && punctuated.length > 1) {
    for (const p of punctuated) {
      const words = p.trim().split(/\s+/);
      if (words.length > 25) {
        for (let i = 0; i < words.length; i += 18) {
          units.push(words.slice(i, i + 18).join(' '));
        }
      } else if (p.trim()) {
        units.push(p.trim());
      }
    }
  } else {
    // Fallback for unpunctuated Moonshine Tiny output:
    // Force slice into natural phrase lengths of ~16 words
    const words = clean.split(/\s+/);
    for (let i = 0; i < words.length; i += 16) {
      const slice = words.slice(i, i + 16).join(' ');
      if (slice.trim()) {
        units.push(slice.trim());
      }
    }
  }
  return units;
}

export function groupChunksIntoParagraphs(
  chunks?: { timestamp: [number, number]; text: string; speaker?: string }[],
  rawTranscript?: string
): FormattedParagraph[] {
  const sourceChunks: { timestamp: [number, number]; text: string; speaker?: string }[] =
    chunks && chunks.length > 0 ? [...chunks] : [];

  // Fallback: parse rawTranscript string if structured chunks array is missing
  if (sourceChunks.length === 0 && rawTranscript) {
    const rawLines = rawTranscript.split(/\r?\n+/).filter((l) => l.trim().length > 0);
    let currentTimeCounter = 0;

    for (const line of rawLines) {
      const tsMatch = line.match(/\[(\d{1,2}:\d{2}(?::\d{2})?)/);
      if (tsMatch) {
        const parts = tsMatch[1].split(':').map(Number);
        currentTimeCounter =
          parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0] * 3600 + parts[1] * 60 + parts[2];
      }
      const speakerMatch = line.match(/\*\*\[(.*?)\]/);
      const speaker = speakerMatch ? speakerMatch[1] : 'Speaker 1';
      const cleanText = line
        .replace(/^\*\*\[.*?\](?:\s*\(.*?\))?:\*\*\s*/, '')
        .replace(/^\[\d{1,2}:\d{2}(?::\d{2})?(?:\s*-\s*\d{1,2}:\d{2}(?::\d{2})?)?\]\s*/, '')
        .trim();

      if (cleanText) {
        sourceChunks.push({
          timestamp: [currentTimeCounter, currentTimeCounter + 15],
          text: cleanText,
          speaker,
        });
        currentTimeCounter += 15;
      }
    }
  }

  if (sourceChunks.length === 0) return [];

  interface SubUnit {
    text: string;
    startTime: number;
    endTime: number;
    speaker: string;
  }

  const allUnits: SubUnit[] = [];

  for (const chunk of sourceChunks) {
    const [cStart, cEnd] = chunk.timestamp;
    const dur = Math.max(1, (cEnd ?? cStart + 15) - cStart);
    const thoughtUnits = splitIntoThoughtUnits(chunk.text);
    if (thoughtUnits.length === 0) continue;

    const totalChars = thoughtUnits.reduce((acc, u) => acc + u.length, 0);
    let accumulated = 0;

    for (const unitText of thoughtUnits) {
      const startFrac = totalChars > 0 ? accumulated / totalChars : 0;
      accumulated += unitText.length;
      const endFrac = totalChars > 0 ? accumulated / totalChars : 1;

      allUnits.push({
        text: unitText,
        startTime: cStart + startFrac * dur,
        endTime: cStart + endFrac * dur,
        speaker: chunk.speaker || 'Speaker 1',
      });
    }
  }

  const paragraphs: FormattedParagraph[] = [];
  let currentGroup: SubUnit[] = [];
  let currentWords = 0;

  const flush = () => {
    if (currentGroup.length === 0) return;
    const first = currentGroup[0];
    const last = currentGroup[currentGroup.length - 1];

    paragraphs.push({
      id: `para-${first.startTime.toFixed(2)}-${Math.random().toString(36).substring(2, 6)}`,
      speaker: first.speaker,
      startTime: first.startTime,
      endTime: last.endTime,
      text: currentGroup.map((u) => u.text).join(' '),
    });

    currentGroup = [];
    currentWords = 0;
  };

  for (const unit of allUnits) {
    const count = unit.text.split(/\s+/).length;
    const speakerChanged = currentGroup.length > 0 && currentGroup[0].speaker !== unit.speaker;
    const wordCeilingReached = currentWords + count > 38;
    const unitCountReached = currentGroup.length >= 3;

    if (speakerChanged || wordCeilingReached || unitCountReached) {
      flush();
    }

    currentGroup.push(unit);
    currentWords += count;
  }

  flush();
  return paragraphs;
}
