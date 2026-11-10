// src/components/TranscriptView.tsx - Timestamp-Anchored Interactive Transcript Viewer with Synchronized Playback
import React, { useMemo, useEffect, useRef, useState } from 'react';
import { TranscriptionChunk } from '../types';
import { groupChunksIntoParagraphs, formatSecondsToTime, FormattedParagraph } from '../utils/transcriptUtils';
import { Play, Copy, Check, Quote } from 'lucide-react';

export interface TranscriptViewProps {
  chunks: TranscriptionChunk[];
  currentTime: number;
  onSeek: (timeInSeconds: number) => void;
  onInsertToNotes?: (markdownQuote: string) => void;
  speakerMapping?: Record<string, string>;
  autoScroll?: boolean;
  className?: string;
}

export const TranscriptView: React.FC<TranscriptViewProps> = ({
  chunks,
  currentTime,
  onSeek,
  onInsertToNotes,
  speakerMapping,
  autoScroll = true,
  className = '',
}) => {
  const paragraphs = useMemo(() => groupChunksIntoParagraphs(chunks), [chunks]);
  const activeElementRef = useRef<HTMLDivElement | null>(null);
  const [copiedParaId, setCopiedParaId] = useState<string | null>(null);

  // Identify currently active paragraph for auto-scrolling
  const activeParagraph = useMemo(() => {
    return paragraphs.find((p) => currentTime >= p.startTime && currentTime < p.endTime);
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

  if (!chunks || chunks.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center p-8 text-center text-slate-400 dark:text-slate-500 ${className}`}>
        <Quote className="w-8 h-8 mb-2 opacity-40" />
        <p className="text-xs font-medium">No timestamped transcript chunks available.</p>
        <p className="text-[11px] opacity-75 mt-0.5">Record audio or run transcription to generate speech-to-text.</p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 py-2 px-1 max-w-3xl mx-auto ${className}`}>
      {paragraphs.map((para) => {
        const isActive = currentTime >= para.startTime && currentTime < para.endTime;
        const speakerKey = para.speaker || 'Speaker 1';
        const displayName = (speakerMapping && speakerMapping[speakerKey]) || speakerKey;

        return (
          <div
            key={para.id}
            ref={isActive ? activeElementRef : null}
            className={`group relative flex items-start gap-4 p-3.5 rounded-xl transition-all border mb-4 ${
              isActive
                ? 'bg-sky-50/80 dark:bg-sky-950/40 border-sky-300 dark:border-sky-800 shadow-sm ring-1 ring-sky-300/40 dark:ring-sky-800/40'
                : 'bg-white dark:bg-slate-900/60 border-slate-100 dark:border-slate-800/80 hover:border-slate-200 dark:hover:border-slate-700'
            }`}
          >
            {/* Left Timestamp & Speaker Badge (anchored at top-left) */}
            <div className="flex flex-col items-start gap-1 shrink-0 w-24">
              <button
                type="button"
                onClick={() => onSeek(para.startTime)}
                className={`font-mono text-xs font-semibold px-2 py-0.5 rounded transition-colors flex items-center gap-1 cursor-pointer ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-sky-100 hover:text-sky-700 dark:hover:bg-sky-900'
                }`}
                title="Jump audio to this timestamp"
              >
                {isActive && <Play className="w-2.5 h-2.5 fill-current animate-pulse" />}
                <span>{formatSecondsToTime(para.startTime)}</span>
              </button>
              <span
                className="text-[11px] font-medium text-slate-400 dark:text-slate-500 truncate max-w-full"
                title={displayName}
              >
                {displayName}
              </span>
            </div>

            {/* Right Text Content */}
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <p
                onClick={() => onSeek(para.startTime)}
                className="text-[14px] leading-relaxed tracking-normal text-slate-700 dark:text-slate-200 select-text cursor-pointer hover:text-slate-900 dark:hover:text-white"
              >
                {para.text}
              </p>
            </div>

            {/* Hover Actions: Send to Notes & Copy Quote */}
            <div className="flex items-center gap-1 self-start shrink-0">
              <button
                type="button"
                onClick={() => handleCopyQuote(para, displayName)}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-xs cursor-pointer"
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
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-slate-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-slate-800 transition-all text-xs font-semibold cursor-pointer flex items-center gap-0.5"
                  title="Add quotation to notes"
                >
                  <span>+</span>
                  <span>Note</span>
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
