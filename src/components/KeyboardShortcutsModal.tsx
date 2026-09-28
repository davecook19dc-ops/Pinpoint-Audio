import React, { useState } from 'react';
import { X, Keyboard, Search, Headphones, FileText, Compass, Eye } from 'lucide-react';
import { modifierKey } from '../utils/platform';

interface ShortcutItem {
  keys: string[];
  description: string;
  category: 'audio' | 'notes' | 'navigation' | 'accessibility';
}

const SHORTCUTS: ShortcutItem[] = [
  // Audio & Playback
  {
    keys: ['Space'],
    description: 'Play or pause audio playback (when not editing notes)',
    category: 'audio',
  },
  {
    keys: ['Shift', '←'],
    description: 'Rewind audio by 5 seconds (-5s)',
    category: 'audio',
  },
  {
    keys: ['Shift', '→'],
    description: 'Fast-forward audio by 5 seconds (+5s)',
    category: 'audio',
  },
  {
    keys: ['['],
    description: 'Decrease playback speed (e.g. 1.25x → 1.0x → 0.75x)',
    category: 'audio',
  },
  {
    keys: [']'],
    description: 'Increase playback speed (e.g. 1.0x → 1.25x → 1.5x → 2.0x)',
    category: 'audio',
  },
  {
    keys: ['Shift', 'E'],
    description: 'Toggle Enhance Audio (Web Audio API voice boost, compressor & EQ)',
    category: 'audio',
  },
  {
    keys: ['Shift', 'T'],
    description: 'Transcribe current audio recording locally with Whisper (in-browser Web Worker)',
    category: 'audio',
  },
  {
    keys: ['Shift', '↑'],
    description: 'Increase audio volume (+10%)',
    category: 'audio',
  },
  {
    keys: ['Shift', '↓'],
    description: 'Decrease audio volume (-10%)',
    category: 'audio',
  },

  // Note Taking & Capture
  {
    keys: [modifierKey, 'M'],
    description: 'Capture timestamped note linked to current audio playback second',
    category: 'notes',
  },
  {
    keys: ['Enter'],
    description: 'Save current note (inside note composer)',
    category: 'notes',
  },
  {
    keys: ['Shift', 'Enter'],
    description: 'Insert line break inside note composer without saving',
    category: 'notes',
  },
  {
    keys: ['Alt', '1 - 4'],
    description: 'Quick-switch callout style (1: Note, 2: Task, 3: Key Point, 4: Question to Ask)',
    category: 'notes',
  },

  // Navigation & Search
  {
    keys: ['/'],
    description: 'Focus search bar across notes and timestamps',
    category: 'navigation',
  },
  {
    keys: ['Esc'],
    description: 'Close active modal, cancel editing, or clear selection',
    category: 'navigation',
  },

  // Accessibility & Display
  {
    keys: ['?'],
    description: 'Open or close this keyboard shortcuts cheat sheet',
    category: 'accessibility',
  },
  {
    keys: [modifierKey, 'D'],
    description: 'Toggle OpenDyslexic accessible font mode ON / OFF',
    category: 'accessibility',
  },
  {
    keys: [modifierKey, 'B'],
    description: 'Cycle display themes (Light → Dark → Sepia)',
    category: 'accessibility',
  },
];

const CATEGORIES = [
  { id: 'all', label: 'All Shortcuts', icon: Keyboard },
  { id: 'audio', label: 'Audio & Playback', icon: Headphones },
  { id: 'notes', label: 'Notes & Callouts', icon: FileText },
  { id: 'navigation', label: 'Navigation', icon: Compass },
  { id: 'accessibility', label: 'Accessibility', icon: Eye },
];

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  if (!isOpen) return null;

  const filteredShortcuts = SHORTCUTS.filter((sc) => {
    const matchesCategory = activeCategory === 'all' || sc.category === activeCategory;
    const q = filterQuery.toLowerCase();
    const matchesQuery =
      !filterQuery.trim() ||
      sc.description.toLowerCase().includes(q) ||
      sc.keys.some((k) => k.toLowerCase().includes(q));
    return matchesCategory && matchesQuery;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white leading-tight">
                Keyboard Shortcuts Cheat Sheet
              </h3>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Speed up note-taking and audio control without leaving the keyboard
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter & Category Pills */}
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 space-y-3 bg-white dark:bg-neutral-900">
          {/* Quick Filter Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              autoFocus
              placeholder="Search shortcuts (e.g. 'playback', 'Ctrl+M', 'font')..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isSelected = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-2xs font-semibold'
                      : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Shortcuts List Table */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredShortcuts.length === 0 ? (
            <div className="py-8 text-center text-xs text-neutral-400">
              No shortcuts found matching &quot;{filterQuery}&quot;.
            </div>
          ) : (
            filteredShortcuts.map((sc, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2.5 rounded-lg border border-neutral-100 dark:border-neutral-800/80 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors"
              >
                <span className="text-xs text-neutral-700 dark:text-neutral-300 pr-4">
                  {sc.description}
                </span>

                {/* Keyboard Badge Sequence */}
                <div className="flex items-center gap-1 shrink-0">
                  {sc.keys.map((key, kIdx) => (
                    <React.Fragment key={kIdx}>
                      <kbd className="px-2 py-1 text-[11px] font-mono font-semibold text-neutral-800 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-md shadow-2xs">
                        {key}
                      </kbd>
                      {kIdx < sc.keys.length - 1 && (
                        <span className="text-[10px] text-neutral-400 font-mono">+</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer Note */}
        <div className="px-6 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-950/40 flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
          <span>
            Pro-tip: Press <kbd className="px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 font-mono">?</kbd> anywhere to toggle this cheat sheet.
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 rounded-md font-medium text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
