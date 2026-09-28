import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Send,
  Trash2,
  Edit2,
  Check,
  X,
  Play,
  Clock,
  Sparkles,
  FileText,
  AlignLeft,
  Copy,
  CheckCheck,
  FileAudio,
  Download,
  RotateCcw,
  Calendar,
  Image as ImageIcon,
  CheckCircle2,
  ArrowRight,
  Plus,
  ListTodo,
  Lightbulb,
  HelpCircle,
} from 'lucide-react';
import { CalloutType, Note, Session } from '../types';
import { formatTime } from '../utils/audio';
import { CALLOUT_CONFIGS, CalloutTag } from './CalloutBadge';
import { SlidesViewer } from './SlidesViewer';

interface NotesFeedProps {
  currentSession: Session | null;
  notes: Note[];
  currentTime: number;
  onSeek: (time: number) => void;
  onAddNote: (
    content: string,
    timestamp: number,
    calloutType: CalloutType,
    dueDate?: number
  ) => void;
  onUpdateNote: (note: Note) => void;
  onDeleteNote: (id: string) => void;
  isQuickAddRequested: boolean;
  onResetQuickAdd: () => void;
  onTranscribeAudio?: () => void;
  isTranscribing?: boolean;
  onSaveTranscript?: (transcript: string) => void;
  onBackToRecording?: () => void;
  onUploadSlide?: (file: File, timestamp?: number) => void;
  onDeleteSlide?: (slideId: string) => void;
  onUpdateSlideTimestamp?: (slideId: string, timestamp?: number) => void;
}

export const NotesFeed: React.FC<NotesFeedProps> = ({
  currentSession,
  notes,
  currentTime,
  onSeek,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  isQuickAddRequested,
  onResetQuickAdd,
  onTranscribeAudio,
  isTranscribing = false,
  onBackToRecording,
  onUploadSlide,
  onDeleteSlide,
  onUpdateSlideTimestamp,
}) => {
  // Active right panel view: 'notes' | 'transcript' | 'slides'
  const [activeTab, setActiveTab] = useState<'notes' | 'transcript' | 'slides'>('notes');

  // Floating Overlay Composer state
  const [isComposerOpen, setIsComposerOpen] = useState(false);

  // Input state
  const [content, setContent] = useState('');
  const [selectedCallout, setSelectedCallout] = useState<CalloutType>('note');
  const [dueDate, setDueDate] = useState('');
  const [lockedTimestamp, setLockedTimestamp] = useState<number | null>(null);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [hideCompletedTasks, setHideCompletedTasks] = useState(false);

  // Editing state
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editCallout, setEditCallout] = useState<CalloutType>('note');
  const [editDueDate, setEditDueDate] = useState<string>('');

  // Copy feedback state for transcript
  const [hasCopiedTranscript, setHasCopiedTranscript] = useState(false);

  // Floating Selection & Transfer State for Transcript
  const [selectionMenu, setSelectionMenu] = useState<{
    text: string;
    timestamp: number;
    x: number;
    y: number;
  } | null>(null);
  const [transferToast, setTransferToast] = useState<{
    type: CalloutType;
    text: string;
    timestamp: number;
  } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const transcriptContainerRef = useRef<HTMLDivElement | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  const CALLOUT_TYPES: CalloutType[] = [
    'note',
    'task',
    'key_point',
    'question_to_ask',
  ];

  // Focus textarea when shortcut or quick add triggers
  useEffect(() => {
    if (isQuickAddRequested) {
      setActiveTab('notes');
      setLockedTimestamp(currentTime);
      setIsComposerOpen(true);
      onResetQuickAdd();
    }
  }, [isQuickAddRequested, currentTime, onResetQuickAdd]);

  // Focus textarea automatically whenever composer opens
  useEffect(() => {
    if (isComposerOpen) {
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isComposerOpen]);

  // Global keyboard shortcuts (Escape to close, '/' to search, Alt+1..4 for callouts)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isComposerOpen) {
        e.preventDefault();
        setIsComposerOpen(false);
        return;
      }

      if (
        e.key === '/' &&
        !isComposerOpen &&
        activeTab === 'notes' &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const types: CalloutType[] = ['note', 'task', 'key_point', 'question_to_ask'];
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= 4) {
          e.preventDefault();
          const targetType = types[num - 1];
          setSelectedCallout(targetType);
          if (!isComposerOpen) {
            setLockedTimestamp(currentTime);
            setActiveTab('notes');
            setIsComposerOpen(true);
          }
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isComposerOpen, activeTab, currentTime]);

  const effectiveTimestamp = lockedTimestamp !== null ? lockedTimestamp : currentTime;

  const handleCreateNote = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!content.trim()) return;

    const dueDateTimestamp =
      selectedCallout === 'task' && dueDate
        ? new Date(dueDate + 'T00:00:00').getTime()
        : undefined;

    onAddNote(content.trim(), effectiveTimestamp, selectedCallout, dueDateTimestamp);
    setContent('');
    setDueDate('');
    setLockedTimestamp(null);
    setIsComposerOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCreateNote();
    }
  };

  const startEditing = (note: Note) => {
    setEditingNoteId(note.id);
    setEditContent(note.content);
    setEditCallout(note.calloutType);
    setEditDueDate(
      note.dueDate ? new Date(note.dueDate).toISOString().split('T')[0] : ''
    );
  };

  const saveEdit = (note: Note) => {
    if (!editContent.trim()) return;
    const dueDateTimestamp =
      editCallout === 'task' && editDueDate
        ? new Date(editDueDate + 'T00:00:00').getTime()
        : undefined;

    onUpdateNote({
      ...note,
      content: editContent.trim(),
      calloutType: editCallout,
      dueDate: dueDateTimestamp,
      updatedAt: Date.now(),
    });
    setEditingNoteId(null);
    setEditDueDate('');
  };

  const cancelEdit = () => {
    setEditingNoteId(null);
    setEditContent('');
    setEditDueDate('');
  };

  const parseTimestampToSeconds = (timeStr: string): number => {
    const parts = timeStr.split(':');
    if (parts.length === 2) {
      return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    }
    if (parts.length === 3) {
      return (
        parseInt(parts[0], 10) * 3600 +
        parseInt(parts[1], 10) * 60 +
        parseInt(parts[2], 10)
      );
    }
    return 0;
  };

  const renderFormattedContent = (
    text: string,
    onSeekTime: (t: number) => void,
    textClass: string
  ) => {
    const timestampRegex = /\[(\d{1,2}:\d{2}(?::\d{2})?)(?:\s*-\s*\d{1,2}:\d{2}(?::\d{2})?)?\]/g;
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = timestampRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        elements.push(text.slice(lastIndex, match.index));
      }

      const timeStr = match[1];
      const seconds = parseTimestampToSeconds(timeStr);
      const fullLabel = match[0];
      const matchIndex = match.index;

      elements.push(
        <button
          key={`ts-${matchIndex}`}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSeekTime(seconds);
          }}
          title={`Click to jump audio to ${timeStr}`}
          className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded-md bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-mono text-[11px] font-semibold hover:bg-indigo-600 hover:text-white transition-colors cursor-pointer shadow-2xs"
        >
          <Play className="w-2.5 h-2.5 fill-current" />
          <span>{fullLabel}</span>
        </button>
      );

      lastIndex = timestampRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      elements.push(text.slice(lastIndex));
    }

    return <p className={`${textClass} whitespace-pre-wrap leading-relaxed`}>{elements}</p>;
  };

  const handleCopyTranscript = () => {
    if (!currentSession?.transcript) return;
    navigator.clipboard.writeText(currentSession.transcript).then(() => {
      setHasCopiedTranscript(true);
      setTimeout(() => setHasCopiedTranscript(false), 2000);
    });
  };

  const handleDownloadTranscript = () => {
    if (!currentSession?.transcript) return;
    const blob = new Blob([currentSession.transcript], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentSession.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_transcript.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleTranscriptSelectionChange = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setSelectionMenu(null);
      return;
    }

    const rawText = selection.toString().trim();
    if (!rawText || rawText.length < 2) {
      setSelectionMenu(null);
      return;
    }

    if (
      transcriptContainerRef.current &&
      !transcriptContainerRef.current.contains(selection.anchorNode)
    ) {
      setSelectionMenu(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Look for a timestamp inside selected text or immediately before it
    let detectedTimestamp = currentTime;
    const directMatch = rawText.match(/\[(\d{1,2}:\d{2}(?::\d{2})?)/);
    if (directMatch) {
      detectedTimestamp = parseTimestampToSeconds(directMatch[1]);
    } else if (currentSession?.transcript) {
      const fullText = currentSession.transcript;
      const idx = fullText.indexOf(rawText);
      if (idx > 0) {
        const preceding = fullText.substring(Math.max(0, idx - 300), idx);
        const lastTsMatch = [...preceding.matchAll(/\[(\d{1,2}:\d{2}(?::\d{2})?)/g)].pop();
        if (lastTsMatch) {
          detectedTimestamp = parseTimestampToSeconds(lastTsMatch[1]);
        }
      }
    }

    const cleanedText = rawText.replace(/^\[\d{1,2}:\d{2}(?::\d{2})?(?:\s*-\s*\d{1,2}:\d{2}(?::\d{2})?)?\]\s*/, '');
    const menuWidth = 340;
    const x = Math.max(12, Math.min(window.innerWidth - menuWidth - 12, rect.left + rect.width / 2 - menuWidth / 2));
    const y = Math.max(12, rect.top - 52);

    setSelectionMenu({
      text: cleanedText,
      timestamp: detectedTimestamp,
      x,
      y,
    });
  };

  const handleTransferSnippet = (text: string, timestamp: number, type: CalloutType) => {
    const clean = text.trim().replace(/^\[\d{1,2}:\d{2}(?::\d{2})?(?:\s*-\s*\d{1,2}:\d{2}(?::\d{2})?)?\]\s*/, '');
    if (!clean) return;

    onAddNote(clean, timestamp, type);

    const cfg = CALLOUT_CONFIGS[type];
    setTransferToast({
      type,
      text: `Added as ${cfg.label}!`,
      timestamp,
    });

    if (window.getSelection()) {
      window.getSelection()?.removeAllRanges();
    }
    setSelectionMenu(null);

    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = window.setTimeout(() => {
      setTransferToast(null);
    }, 2800);
  };

  // Structured transcript line parser for interactive segment cards
  interface ParsedSegment {
    id: string;
    raw: string;
    text: string;
    timestamp: number;
    timeLabel?: string;
  }

  const getParsedTranscriptSegments = (transcript: string): ParsedSegment[] => {
    if (!transcript) return [];
    const rawLines = transcript.split(/\r?\n+/).filter((l) => l.trim().length > 0);
    return rawLines.map((line, idx) => {
      const match = line.match(/^\[(\d{1,2}:\d{2}(?::\d{2})?)(?:\s*-\s*\d{1,2}:\d{2}(?::\d{2})?)?\]\s*(.*)$/);
      if (match) {
        return {
          id: `seg-${idx}`,
          raw: line,
          timeLabel: match[1],
          timestamp: parseTimestampToSeconds(match[1]),
          text: match[2] || line,
        };
      }
      const embedded = line.match(/\[(\d{1,2}:\d{2}(?::\d{2})?)/);
      return {
        id: `seg-${idx}`,
        raw: line,
        timeLabel: embedded ? embedded[1] : undefined,
        timestamp: embedded ? parseTimestampToSeconds(embedded[1]) : currentTime,
        text: line,
      };
    });
  };

  // Filter notes
  const filteredNotes = notes.filter((note) => {
    const matchesSearch =
      !searchQuery.trim() ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType =
      filterType === 'all' ||
      (filterType === 'task_pending'
        ? note.calloutType === 'task' && !note.completed
        : note.calloutType === filterType);

    const matchesCompletion =
      !hideCompletedTasks || !(note.calloutType === 'task' && note.completed);

    return matchesSearch && matchesType && matchesCompletion;
  });

  const activeCalloutConfig = CALLOUT_CONFIGS[selectedCallout] || CALLOUT_CONFIGS.note;
  const ActiveCalloutIcon = activeCalloutConfig.icon;

  return (
    <div className="relative h-full flex flex-row overflow-hidden bg-[#fcfbf9] dark:bg-stone-900">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden p-4 min-w-0">
        {/* Mobile Header: Back to Recording Space */}
        {onBackToRecording && (
          <div className="flex md:hidden items-center justify-between pb-3 mb-3 border-b border-[#e8e4dc] dark:border-stone-800 shrink-0">
            <button
              type="button"
              onClick={onBackToRecording}
              className="py-2 px-3.5 rounded-xl bg-[#f0ece4] dark:bg-stone-800 hover:bg-[#e4ded5] dark:hover:bg-stone-700 text-stone-900 dark:text-stone-100 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-2xs border border-[#e0d9cf] dark:border-stone-700 active:scale-95"
            >
              <span>🎧</span>
              <span>Back to Recording Space</span>
            </button>
            <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold px-2 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
              <Clock className="w-3 h-3 text-indigo-500" />
              <span>{formatTime(currentTime)}</span>
            </div>
          </div>
        )}

        {activeTab === 'notes' ? (
          /* ========================================================================= */
          /* NOTES VIEW (Full-Height List)                                             */
          /* ========================================================================= */
          <>
            {/* Search & Filter Header Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-3 shrink-0">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search timestamped notes... (Press /)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-8 py-2 text-xs rounded-xl border border-[#e8e4dc] dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 shadow-2xs"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="text-xs py-2 px-3 rounded-xl border border-[#e8e4dc] dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-2xs font-semibold"
                >
                  <option value="all">All Note Types ({notes.length})</option>
                  <option value="note">Standard Notes</option>
                  <option value="task">Tasks</option>
                  <option value="task_pending">Pending Tasks</option>
                  <option value="key_point">Key Points</option>
                  <option value="question_to_ask">Questions to Ask</option>
                </select>
              </div>
            </div>

            {/* Feed Stats Header */}
            <div className="flex items-center justify-between mb-2.5 text-xs text-stone-600 dark:text-stone-400 shrink-0 px-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-stone-900 dark:text-stone-200">
                  Notes ({filteredNotes.length})
                </span>
                {filterType !== 'all' && (
                  <span className="text-[11px] bg-[#f0ece4] dark:bg-stone-800 px-1.5 py-0.5 rounded-md font-semibold">
                    Filtered
                  </span>
                )}
              </div>

              <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-medium hover:text-stone-900 dark:hover:text-stone-200">
                <input
                  type="checkbox"
                  checked={hideCompletedTasks}
                  onChange={(e) => setHideCompletedTasks(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-emerald-600 cursor-pointer"
                />
                <span>Hide completed tasks</span>
              </label>
            </div>

            {/* Chronological Notes Feed (100% of Available Space) */}
            <div
              id="notesContainer"
              className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0"
            >
              {filteredNotes.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-[#e4ded5] dark:border-stone-800 rounded-2xl p-6 text-center bg-[#faf8f5]/60 dark:bg-stone-900/30">
                  <Sparkles className="w-8 h-8 text-indigo-500 mb-2.5 opacity-80" />
                  <p className="text-sm font-bold text-stone-900 dark:text-stone-100 mb-1">
                    No notes match your filter
                  </p>
                  <p className="text-xs text-stone-600 dark:text-stone-400 max-w-sm mb-4 leading-relaxed">
                    Click any pastel callout icon in the right toolbar or press{' '}
                    <kbd className="px-1.5 py-0.5 bg-[#f0ece4] dark:bg-stone-800 rounded text-[11px] font-mono font-semibold">
                      ⌘M
                    </kbd>{' '}
                    to capture a timestamped note right now.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setLockedTimestamp(currentTime);
                      setIsComposerOpen(true);
                    }}
                    className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                  >
                    <span>+ Add Note at {formatTime(currentTime)}</span>
                  </button>
                </div>
              ) : (
                filteredNotes.map((note) => {
                  const isPlayingThisNote = Math.abs(currentTime - note.timestamp) < 2.5;
                  const cfg = CALLOUT_CONFIGS[note.calloutType] || CALLOUT_CONFIGS.note;
                  const isEditing = editingNoteId === note.id;

                  return (
                    <div
                      key={note.id}
                      className={`relative rounded-2xl border transition-all duration-150 p-4 shadow-2xs ${cfg.borderClass} ${cfg.bgClass} ${
                        isPlayingThisNote
                          ? 'ring-2 ring-indigo-500/80 shadow-md translate-x-0.5'
                          : 'hover:shadow-xs'
                      }`}
                    >
                      {/* Note Card Header */}
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onSeek(note.timestamp)}
                            title={`Jump audio to ${formatTime(note.timestamp)}`}
                            className="group flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-mono text-xs font-bold hover:bg-indigo-600 dark:hover:bg-indigo-500 dark:hover:text-white transition-colors cursor-pointer tabular-nums shadow-2xs"
                          >
                            <Play className="w-2.5 h-2.5 fill-current opacity-80 group-hover:opacity-100" />
                            <span>{formatTime(note.timestamp)}</span>
                          </button>

                          <CalloutTag type={note.calloutType} />
                        </div>

                        {/* Note Action Buttons */}
                        <div className="flex items-center gap-1 text-stone-500">
                          <button
                            onClick={() => startEditing(note)}
                            title="Edit note"
                            className="p-1 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteNote(note.id)}
                            title="Delete note"
                            className="p-1 hover:text-rose-600 hover:bg-rose-100/50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Note Content / Inline Edit Form */}
                      {isEditing ? (
                        <div className="space-y-2.5 mt-2">
                          <textarea
                            rows={3}
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full text-xs p-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                          />

                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="flex items-center gap-1">
                                <span className="text-[11px] text-stone-500">Type:</span>
                                <select
                                  value={editCallout}
                                  onChange={(e) => setEditCallout(e.target.value as CalloutType)}
                                  className="text-xs py-1 px-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 font-semibold"
                                >
                                  {CALLOUT_TYPES.map((t) => (
                                    <option key={t} value={t}>
                                      {CALLOUT_CONFIGS[t].label}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {editCallout === 'task' && (
                                <div className="flex items-center gap-1 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 px-2 py-0.5 rounded-lg">
                                  <Calendar className="w-3 h-3 text-emerald-600 shrink-0" />
                                  <span className="text-[11px] text-stone-500">Due:</span>
                                  <input
                                    type="date"
                                    value={editDueDate}
                                    onChange={(e) => setEditDueDate(e.target.value)}
                                    className="text-xs bg-transparent text-stone-800 dark:text-stone-200 focus:outline-hidden cursor-pointer"
                                  />
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={cancelEdit}
                                className="px-2.5 py-1 text-xs text-stone-600 hover:text-stone-900 dark:text-stone-300 rounded-lg hover:bg-black/5"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => saveEdit(note)}
                                className="px-3 py-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold flex items-center gap-1 shadow-2xs"
                              >
                                <Check className="w-3 h-3" />
                                <span>Save</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-1">
                          {note.calloutType === 'task' ? (
                            <div className="flex items-start gap-2.5">
                              <input
                                type="checkbox"
                                checked={!!note.completed}
                                onChange={(e) =>
                                  onUpdateNote({
                                    ...note,
                                    completed: e.target.checked,
                                    updatedAt: Date.now(),
                                  })
                                }
                                className="mt-0.5 w-4 h-4 rounded border-emerald-400 dark:border-emerald-600 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <div
                                  className={`text-xs transition-all ${
                                    note.completed
                                      ? 'line-through text-slate-400 dark:text-slate-500 opacity-60'
                                      : cfg.textClass
                                  }`}
                                >
                                  {renderFormattedContent(
                                    note.content,
                                    onSeek,
                                    note.completed
                                      ? 'line-through text-slate-400 dark:text-slate-500 opacity-60'
                                      : cfg.textClass
                                  )}
                                </div>

                                {note.dueDate && (
                                  <div className="mt-1.5 flex items-center gap-1.5">
                                    <span
                                      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border shadow-2xs ${
                                        note.completed
                                          ? 'bg-stone-100 dark:bg-stone-800/60 text-stone-400 dark:text-stone-500 border-stone-200 dark:border-stone-700 line-through'
                                          : 'bg-emerald-100/70 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50'
                                      }`}
                                    >
                                      <Calendar className="w-3 h-3 shrink-0" />
                                      <span>
                                        Due:{' '}
                                        {new Date(note.dueDate).toLocaleDateString(undefined, {
                                          month: 'short',
                                          day: 'numeric',
                                          year: 'numeric',
                                        })}
                                      </span>
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs">
                              {renderFormattedContent(note.content, onSeek, cfg.textClass)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : activeTab === 'transcript' ? (
          /* ========================================================================= */
          /* DEDICATED TRANSCRIPT VIEW                                                 */
          /* ========================================================================= */
          <div className="flex-1 flex flex-col h-full overflow-hidden min-h-0">
            {/* Transcript View Header */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#e8e4dc] dark:border-stone-800 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400">
                  <AlignLeft className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-stone-900 dark:text-white truncate">
                    Audio Transcript
                  </h3>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate font-mono">
                    {currentSession ? currentSession.title : 'Active Session'}
                  </p>
                </div>
              </div>

              {currentSession?.transcript && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={handleCopyTranscript}
                    title="Copy full transcript"
                    className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-white dark:bg-stone-800 border border-[#e8e4dc] dark:border-stone-700 text-stone-800 dark:text-stone-200 hover:bg-[#f0ece4] transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                  >
                    {hasCopiedTranscript ? (
                      <>
                        <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                          Copied!
                        </span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleDownloadTranscript}
                    title="Download transcript (.txt)"
                    className="p-1.5 rounded-xl bg-white dark:bg-stone-800 border border-[#e8e4dc] dark:border-stone-700 text-stone-700 hover:text-stone-900 dark:text-stone-300 hover:bg-[#f0ece4] transition-colors cursor-pointer shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>

                  {onTranscribeAudio && currentSession.audioBlob && (
                    <button
                      onClick={onTranscribeAudio}
                      disabled={isTranscribing}
                      title="Re-run Whisper speech-to-text"
                      className="p-1.5 rounded-xl bg-white dark:bg-stone-800 border border-[#e8e4dc] dark:border-stone-700 text-stone-700 hover:text-indigo-600 hover:bg-[#f0ece4] transition-colors cursor-pointer shadow-2xs"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${isTranscribing ? 'animate-spin' : ''}`} />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Transcript Body Area */}
            {currentSession?.transcript ? (
              <div
                ref={transcriptContainerRef}
                onMouseUp={handleTranscriptSelectionChange}
                onTouchEnd={handleTranscriptSelectionChange}
                onKeyUp={handleTranscriptSelectionChange}
                className="flex-1 overflow-y-auto pr-2 space-y-3 min-h-0 relative select-text"
              >
                {/* Tip Header Banner */}
                <div className="p-2.5 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/60 text-xs text-indigo-900 dark:text-indigo-200 flex items-center justify-between gap-2 shadow-2xs select-none">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">✨</span>
                    <span>
                      <strong className="font-semibold">Click-to-Transfer:</strong> Highlight any text or click the quick tags next to sentences to send snippets directly to your Notes.
                    </span>
                  </div>
                  {transferToast && (
                    <span className="shrink-0 px-2 py-0.5 rounded-md bg-emerald-600 text-white font-mono text-[10px] font-bold animate-pulse">
                      {transferToast.text}
                    </span>
                  )}
                </div>

                {/* Parsed Interactive Segments */}
                <div className="space-y-2">
                  {getParsedTranscriptSegments(currentSession.transcript).map((seg) => (
                    <div
                      key={seg.id}
                      className="group p-3 rounded-2xl bg-[#faf8f5] dark:bg-stone-900/60 hover:bg-white dark:hover:bg-stone-900 border border-[#e8e4dc] dark:border-stone-800 hover:border-indigo-200 dark:hover:border-indigo-900/80 transition-all shadow-2xs relative"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        {/* Sentence / Segment Text */}
                        <div className="flex-1 min-w-0 flex items-start gap-2">
                          {seg.timeLabel && (
                            <button
                              type="button"
                              onClick={() => onSeek(seg.timestamp)}
                              title={`Jump audio to ${seg.timeLabel}`}
                              className="mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-mono text-[11px] font-semibold hover:bg-indigo-600 hover:text-white transition-colors cursor-pointer shrink-0 shadow-2xs"
                            >
                              <Play className="w-2.5 h-2.5 fill-current" />
                              <span>[{seg.timeLabel}]</span>
                            </button>
                          )}
                          <p className="text-sm text-stone-900 dark:text-stone-100 leading-relaxed font-normal whitespace-pre-wrap select-text">
                            {seg.text}
                          </p>
                        </div>

                        {/* Quick Transfer Actions (Visible on hover on desktop, always accessible) */}
                        <div className="flex items-center gap-1 shrink-0 pt-1 sm:pt-0 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity select-none">
                          <button
                            type="button"
                            onClick={() => handleTransferSnippet(seg.text, seg.timestamp, 'note')}
                            title="Add entire sentence as Note"
                            className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-[#faf8f5] hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 border border-stone-300 dark:border-stone-700 transition-colors shadow-2xs flex items-center gap-0.5 cursor-pointer active:scale-95"
                          >
                            <span>📝</span>
                            <span>Note</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleTransferSnippet(seg.text, seg.timestamp, 'key_point')}
                            title="Add entire sentence as Key Point"
                            className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-[#fef3c7] hover:bg-[#fde68a] dark:bg-amber-950/70 dark:hover:bg-amber-900 text-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-800 transition-colors shadow-2xs flex items-center gap-0.5 cursor-pointer active:scale-95"
                          >
                            <span>💡</span>
                            <span>Key</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleTransferSnippet(seg.text, seg.timestamp, 'task')}
                            title="Add entire sentence as Task"
                            className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-[#dcfce7] hover:bg-[#bbf7d0] dark:bg-emerald-950/70 dark:hover:bg-emerald-900 text-emerald-950 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 transition-colors shadow-2xs flex items-center gap-0.5 cursor-pointer active:scale-95"
                          >
                            <span>✅</span>
                            <span>Task</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleTransferSnippet(seg.text, seg.timestamp, 'question_to_ask')}
                            title="Add entire sentence as Question"
                            className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-[#f3e8ff] hover:bg-[#e9d5ff] dark:bg-purple-950/70 dark:hover:bg-purple-900 text-purple-950 dark:text-purple-200 border border-purple-300 dark:border-purple-800 transition-colors shadow-2xs flex items-center gap-0.5 cursor-pointer active:scale-95"
                          >
                            <span>❓</span>
                            <span>Q</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Floating Selection Popover Menu */}
                {selectionMenu && (
                  <div
                    id="transcript-floating-menu"
                    style={{ top: `${selectionMenu.y}px`, left: `${selectionMenu.x}px` }}
                    className="fixed z-50 flex items-center gap-1 p-1 bg-stone-900/95 dark:bg-stone-100/95 text-white dark:text-stone-900 rounded-xl shadow-2xl border border-stone-700/60 dark:border-stone-200 backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 select-none"
                  >
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-stone-800 dark:bg-stone-200 text-stone-300 dark:text-stone-700">
                      {formatTime(selectionMenu.timestamp)}
                    </span>
                    <div className="w-px h-3.5 bg-stone-700 dark:bg-stone-300 mx-0.5" />

                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleTransferSnippet(selectionMenu.text, selectionMenu.timestamp, 'note');
                      }}
                      className="px-2 py-1 rounded-lg text-[11px] font-bold bg-[#faf8f5] hover:bg-stone-200 text-stone-900 border border-stone-300 transition-colors flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95"
                      title="Add snippet as Note"
                    >
                      <span>📝</span>
                      <span>Note</span>
                    </button>

                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleTransferSnippet(selectionMenu.text, selectionMenu.timestamp, 'key_point');
                      }}
                      className="px-2 py-1 rounded-lg text-[11px] font-bold bg-[#fef3c7] hover:bg-[#fde68a] text-amber-950 border border-amber-300 transition-colors flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95"
                      title="Add snippet as Key Point"
                    >
                      <span>💡</span>
                      <span>Key Point</span>
                    </button>

                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleTransferSnippet(selectionMenu.text, selectionMenu.timestamp, 'task');
                      }}
                      className="px-2 py-1 rounded-lg text-[11px] font-bold bg-[#dcfce7] hover:bg-[#bbf7d0] text-emerald-950 border border-emerald-300 transition-colors flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95"
                      title="Add snippet as Task"
                    >
                      <span>✅</span>
                      <span>Task</span>
                    </button>

                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleTransferSnippet(selectionMenu.text, selectionMenu.timestamp, 'question_to_ask');
                      }}
                      className="px-2 py-1 rounded-lg text-[11px] font-bold bg-[#f3e8ff] hover:bg-[#e9d5ff] text-purple-950 border border-purple-300 transition-colors flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95"
                      title="Add snippet as Question"
                    >
                      <span>❓</span>
                      <span>Question</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-[#e4ded5] dark:border-stone-800 rounded-2xl bg-[#faf8f5]/60 dark:bg-stone-900/30">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3 shadow-2xs">
                  <AlignLeft className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100 mb-1">
                  No transcript available
                </h4>
                <p className="text-xs text-stone-600 dark:text-stone-400 max-w-sm mb-5 leading-relaxed">
                  Generate an accurate, timestamped transcript of this recording.
                </p>

                {onTranscribeAudio && currentSession?.audioBlob ? (
                  <button
                    onClick={onTranscribeAudio}
                    disabled={isTranscribing}
                    className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{isTranscribing ? 'Transcribing...' : 'Transcribe Audio'}</span>
                  </button>
                ) : (
                  <div className="text-xs text-stone-500 flex items-center gap-1.5 font-mono">
                    <FileAudio className="w-3.5 h-3.5" />
                    <span>Record or upload audio to transcribe</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* ========================================================================= */
          /* SLIDES & IMAGES VIEW                                                      */
          /* ========================================================================= */
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <SlidesViewer
              currentSession={currentSession}
              currentTime={currentTime}
              onSeek={onSeek}
              onUploadSlide={(file, timestamp) => {
                if (onUploadSlide) onUploadSlide(file, timestamp);
              }}
              onDeleteSlide={(slideId) => {
                if (onDeleteSlide) onDeleteSlide(slideId);
              }}
              onUpdateSlideTimestamp={(slideId, timestamp) => {
                if (onUpdateSlideTimestamp) onUpdateSlideTimestamp(slideId, timestamp);
              }}
            />
          </div>
        )}
      </div>

      {/* Persistent Slim Vertical Toolbar Docked to Far Right Edge */}
      <div className="w-12 border-l border-[#e8e4dc] dark:border-stone-800 bg-[#f7f5f0]/80 dark:bg-stone-950/50 flex flex-col items-center py-3 gap-1.5 shrink-0 select-none z-10">
        {/* Notes View Toggle */}
        <button
          type="button"
          onClick={() => setActiveTab('notes')}
          title="Notes & Callouts View"
          className={`p-2 rounded-xl transition-all cursor-pointer relative ${
            activeTab === 'notes'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-[#edeae3] dark:hover:bg-stone-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          {notes.length > 0 && (
            <span
              className={`absolute -top-1 -right-1 min-w-[14px] h-3.5 px-1 rounded-full text-[9px] font-bold flex items-center justify-center ${
                activeTab === 'notes'
                  ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900'
                  : 'bg-indigo-600 text-white'
              }`}
            >
              {notes.length}
            </span>
          )}
        </button>

        {/* Dedicated Transcript View Toggle */}
        <button
          type="button"
          onClick={() => setActiveTab('transcript')}
          title="Dedicated Transcript View"
          className={`p-2 rounded-xl transition-all cursor-pointer relative ${
            activeTab === 'transcript'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-[#edeae3] dark:hover:bg-stone-800'
          }`}
        >
          <AlignLeft className="w-4 h-4" />
          {currentSession?.transcript && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-[#fcfbf9] dark:ring-stone-900" />
          )}
        </button>

        {/* Slides & Images View Toggle */}
        <button
          type="button"
          onClick={() => setActiveTab('slides')}
          title="Lecture Slides & Attached Visuals"
          className={`p-2 rounded-xl transition-all cursor-pointer relative ${
            activeTab === 'slides'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-[#edeae3] dark:hover:bg-stone-800'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          {currentSession?.images && currentSession.images.length > 0 && (
            <span
              className={`absolute -top-1 -right-1 min-w-[14px] h-3.5 px-1 rounded-full text-[9px] font-bold flex items-center justify-center ${
                activeTab === 'slides'
                  ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900'
                  : 'bg-emerald-600 text-white'
              }`}
            >
              {currentSession.images.length}
            </span>
          )}
        </button>

        {/* Separator */}
        <div className="w-6 h-px bg-[#e0d9cf] dark:bg-stone-800 my-1.5" />

        {/* Persistent Callout Quick-Add Action Icons with Vibrant Chalk Pastel styling */}
        {CALLOUT_TYPES.map((type, idx) => {
          const cfg = CALLOUT_CONFIGS[type];
          const Icon = cfg.icon;
          const isSelectedInComposer = isComposerOpen && selectedCallout === type;

          return (
            <button
              key={type}
              type="button"
              onClick={() => {
                setSelectedCallout(type);
                setLockedTimestamp(currentTime);
                setActiveTab('notes');
                setIsComposerOpen(true);
              }}
              title={`Add ${cfg.label} (Alt+${idx + 1})`}
              className={`p-2 rounded-xl transition-all cursor-pointer flex items-center justify-center relative ${
                isSelectedInComposer
                  ? `${cfg.badgeBg} ring-2 ring-indigo-500 dark:ring-indigo-400 shadow-sm scale-110`
                  : 'text-stone-600 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-[#edeae3] dark:hover:bg-stone-800'
              }`}
            >
              <Icon className="w-4 h-4" />
            </button>
          );
        })}
      </div>

      {/* Floating Overlay Composer Modal */}
      {isComposerOpen && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsComposerOpen(false);
            }
          }}
        >
          <div
            className="w-full max-w-lg bg-[#fcfbf9] dark:bg-stone-900 rounded-2xl shadow-2xl border border-[#e8e4dc] dark:border-stone-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="composer-modal-title"
          >
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-[#e8e4dc] dark:border-stone-800 flex items-center justify-between bg-[#f7f5f0] dark:bg-stone-950/50">
              <div className="flex items-center gap-2.5">
                <div className={`p-1.5 rounded-xl flex items-center justify-center ${activeCalloutConfig.badgeBg}`}>
                  <ActiveCalloutIcon className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3
                      id="composer-modal-title"
                      className="text-xs font-bold text-stone-900 dark:text-white"
                    >
                      New {activeCalloutConfig.label}
                    </h3>
                    <span className="text-[11px] font-mono px-1.5 py-0.5 rounded-md bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-bold tabular-nums">
                      {formatTime(effectiveTimestamp)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Callout Format Quick Selectors */}
              <div className="flex items-center gap-1 bg-[#ebe5da] dark:bg-stone-800/80 p-1 rounded-xl">
                {CALLOUT_TYPES.map((type, idx) => {
                  const cfg = CALLOUT_CONFIGS[type];
                  const isSelected = selectedCallout === type;
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setSelectedCallout(type)}
                      title={`${cfg.label} (Alt+${idx + 1})`}
                      className={`p-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
                        isSelected
                          ? `${cfg.badgeBg} ring-1 ring-black/10 font-bold shadow-xs scale-105`
                          : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-200'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setIsComposerOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                title="Close without saving (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Textarea Body */}
            <div className="p-4 space-y-3">
              <textarea
                ref={textareaRef}
                autoFocus
                rows={4}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Type your ${activeCalloutConfig.label.toLowerCase()} at ${formatTime(
                  effectiveTimestamp
                )}... (Enter to save, Shift+Enter for newline)`}
                className="w-full text-xs p-3 rounded-xl border border-[#e8e4dc] dark:border-stone-700 bg-white dark:bg-stone-800/60 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 resize-none leading-relaxed"
              />

              {/* Modal Bottom Controls Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (lockedTimestamp === null) {
                        setLockedTimestamp(currentTime);
                      } else {
                        setLockedTimestamp(null);
                      }
                    }}
                    title="Click to lock/unlock to current audio timestamp"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 font-mono text-[11px] font-semibold border border-[#e8e4dc] dark:border-stone-700 cursor-pointer shadow-2xs"
                  >
                    <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span>{formatTime(effectiveTimestamp)}</span>
                    <span className="text-[10px] text-stone-400 font-sans">
                      {lockedTimestamp !== null ? '(Locked)' : '(Live)'}
                    </span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {/* Due Date UI: only if selectedCallout === 'task' */}
                  {selectedCallout === 'task' && (
                    <div className="flex items-center gap-1.5 bg-white dark:bg-stone-800 border border-[#e8e4dc] dark:border-stone-700 px-2.5 py-1 rounded-xl shadow-2xs">
                      <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <label htmlFor="task-due-date" className="text-[11px] font-semibold text-stone-600 dark:text-stone-300 whitespace-nowrap">
                        Due:
                      </label>
                      <input
                        id="task-due-date"
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="text-xs text-stone-800 dark:text-stone-200 bg-transparent focus:outline-hidden cursor-pointer"
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsComposerOpen(false)}
                    className="px-3 py-1.5 text-xs font-semibold text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white rounded-xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                  >
                    Cancel (Esc)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCreateNote()}
                    disabled={!content.trim()}
                    className={`px-4 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                      content.trim()
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                        : 'bg-[#edeae3] dark:bg-stone-800 text-stone-400 cursor-not-allowed'
                    }`}
                  >
                    <span>Save Note</span>
                    <Send className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
