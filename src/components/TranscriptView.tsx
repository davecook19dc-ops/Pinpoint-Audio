// src/components/TranscriptView.tsx - Timestamp-Anchored Interactive Transcript Viewer with Punctuation-Agnostic Cards
import React, { useMemo, useEffect, useRef, useState } from 'react';
import { Play, Plus, Copy, Check } from 'lucide-react';
import { TranscriptionChunk, SpeakerMapping } from '../types';
import { formatSecondsToTime, groupChunksIntoParagraphs, FormattedParagraph } from '../utils/transcriptUtils';

export interface TranscriptViewProps {
  chunks?: TranscriptionChunk[];
  rawTranscript?: string;
  currentTime: number;
  onSeek: (timeInSeconds: number) => void;
  onInsertToNotes?: (markdownQuote: string) => void;
  speakerMapping?: SpeakerMapping;
  autoScroll?: boolean;
}

export const TranscriptView: React.FC<TranscriptViewProps> = ({
  chunks,
  rawTranscript,
  currentTime,
  onSeek,
  onInsertToNotes,
  speakerMapping,
  autoScroll = true,
}) => {
  const paragraphs = useMemo(
    () => groupChunksIntoParagraphs(chunks, rawTranscript),
    [chunks, rawTranscript]
  );

  const activeElementRef = useRef<HTMLDivElement | null>(null);
  const [copiedParaId, setCopiedParaId] = useState<string | null>(null);

  // Active paragraph identification for synchronized auto-scrolling
  const activeParagraph = useMemo(() => {
    return paragraphs.find(
      (p) => currentTime >= p.startTime && currentTime <= p.endTime + 0.5
    );
  }, [paragraphs, currentTime]);

  const activeParaId = activeParagraph?.id;

  // Auto-scroll the active container smoothly into view when active paragraph changes
  useEffect(() => {
    if (autoScroll && activeParaId && activeElementRef.current) {
      activeElementRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [activeParaId, autoScroll]);

  const handleCopyQuote = (para: FormattedParagraph, speakerName: string) => {
    const formatted = `> **[${formatSecondsToTime(para.startTime)}]** *${speakerName}:* "${para.text}"\n\n`;
    navigator.clipboard.writeText(formatted).then(() => {
      setCopiedParaId(para.id);
      setTimeout(() => setCopiedParaId(null), 2000);
    });
  };

  if (paragraphs.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-stone-400">
        No transcript lines to display.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3.5 py-2 px-1 max-w-3xl mx-auto w-full select-text">
      {paragraphs.map((para) => {
        const isActive = currentTime >= para.startTime && currentTime <= para.endTime + 0.5;
        const displayName =
          (para.speaker && speakerMapping?.[para.speaker]) || para.speaker || 'Speaker';

        return (
          <div
            key={para.id}
            ref={isActive ? activeElementRef : null}
            className={`group flex items-start gap-3.5 p-4 rounded-2xl border transition-all ${
              isActive
                ? 'bg-indigo-50/90 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 shadow-xs'
                : 'bg-white dark:bg-stone-900/70 border-stone-200/80 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 shadow-2xs'
            }`}
          >
            {/* Left Timestamp & Speaker Badge */}
            <div className="flex flex-col items-start gap-1 shrink-0 pt-0.5 select-none w-18 sm:w-20">
              <button
                type="button"
                onClick={() => onSeek(para.startTime)}
                title={`Jump audio to ${formatSecondsToTime(para.startTime)}`}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-mono text-[11px] font-bold transition-colors cursor-pointer shadow-2xs ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-indigo-600 dark:hover:bg-indigo-500 dark:hover:text-white'
                }`}
              >
                <Play className="w-2.5 h-2.5 fill-current" />
                <span>{formatSecondsToTime(para.startTime)}</span>
              </button>
              <span className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider truncate max-w-full pl-0.5">
                {displayName}
              </span>
            </div>

            {/* Right Text Content */}
            <div className="flex-1 min-w-0 pt-0.5">
              <p
                onClick={() => onSeek(para.startTime)}
                className="text-xs sm:text-sm text-stone-800 dark:text-stone-200 leading-relaxed font-normal cursor-pointer hover:text-stone-950 dark:hover:text-white"
              >
                {para.text}
              </p>
            </div>

            {/* Hover Actions: Copy Quote & Insert to Notes */}
            <div className="flex items-center gap-1 shrink-0 select-none">
              <button
                type="button"
                onClick={() => handleCopyQuote(para, displayName)}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-all text-xs cursor-pointer"
                title="Copy quotation markdown"
              >
                {copiedParaId === para.id ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>

              {onInsertToNotes && (
                <button
                  type="button"
                  onClick={() =>
                    onInsertToNotes(
                      `> **[${formatSecondsToTime(para.startTime)}]** *${displayName}:* "${para.text}"\n\n`
                    )
                  }
                  title="Add as quote to notes feed"
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-indigo-600 transition-all cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
