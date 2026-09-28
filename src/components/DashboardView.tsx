import React, { useState } from 'react';
import {
  Folder as FolderIcon,
  Plus,
  Play,
  Clock,
  Trash2,
  Upload,
  ArrowLeft,
  Search,
  Download,
  Loader2,
  ArrowRightLeft,
} from 'lucide-react';
import { Folder, Session } from '../types';
import { formatTime, downloadAudioAsMp3 } from '../utils/audio';

interface DashboardViewProps {
  folders: Folder[];
  sessions: Session[];
  selectedFolderId: string | null;
  storageUsage: { usedBytes: number; quotaBytes: number; percentage: number };
  onSelectFolder: (folderId: string | null) => void;
  onOpenSession: (sessionId: string) => void;
  onCreateFolder: (name: string, color: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onCreateSessionInFolder: (folderId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onAudioUploadedInFolder: (folderId: string, file: File) => void;
  onExportStandaloneHtml: () => void;
  onOpenShortcuts: () => void;
  onOpenSync?: () => void;
}

function formatDateTime(timestamp: number): string {
  if (!timestamp || isNaN(timestamp)) return '';
  const date = new Date(timestamp);
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date).replace(',', ' •');
  } catch {
    return date.toLocaleDateString();
  }
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  folders,
  sessions,
  selectedFolderId,
  onSelectFolder,
  onOpenSession,
  onCreateFolder,
  onDeleteFolder,
  onCreateSessionInFolder,
  onDeleteSession,
  onAudioUploadedInFolder,
  onOpenShortcuts,
  onOpenSync,
}) => {
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#10B981');
  const [folderSearchQuery, setFolderSearchQuery] = useState('');
  const [downloadingMp3SessionId, setDownloadingMp3SessionId] = useState<string | null>(null);

  const fileUploadInputRef = React.useRef<HTMLInputElement | null>(null);

  // Vibrant Chalk Pastel color options for folder creation
  const folderColors = [
    '#10B981', // Mint Green
    '#0EA5E9', // Powder Sky Blue
    '#F59E0B', // Sunny Amber
    '#EC4899', // Fuchsia Rose
    '#8B5CF6', // Chalk Violet
    '#F97316', // Bright Coral
  ];

  const handleCreateFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    onCreateFolder(newFolderName.trim(), newFolderColor);
    setNewFolderName('');
    setIsCreatingFolder(false);
  };

  const handleUploadAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedFolderId) {
      onAudioUploadedInFolder(selectedFolderId, file);
      e.target.value = '';
    }
  };

  const handleDownloadMp3 = async (session: Session) => {
    if (!session.audioBlob) return;
    try {
      setDownloadingMp3SessionId(session.id);
      await downloadAudioAsMp3(session.audioBlob, session.title || 'recording');
    } finally {
      setDownloadingMp3SessionId(null);
    }
  };

  const activeFolder = folders.find((f) => f.id === selectedFolderId) || null;
  const folderSessions = selectedFolderId
    ? sessions.filter((s) => s.folderId === selectedFolderId)
    : [];

  const filteredFolders = folders.filter((f) =>
    f.name.toLowerCase().includes(folderSearchQuery.toLowerCase())
  );

  // DRILLDOWN VIEW: Single Folder Active
  if (selectedFolderId && activeFolder) {
    return (
      <div className="flex-1 overflow-y-auto p-6 md:p-10 max-w-5xl mx-auto w-full">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-[#e8e4dc] dark:border-stone-800">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onSelectFolder(null)}
              className="p-2 rounded-xl bg-white dark:bg-stone-900 border border-[#e8e4dc] dark:border-stone-800 hover:bg-[#f7f5f0] dark:hover:bg-stone-800 text-stone-800 dark:text-stone-200 transition-colors cursor-pointer shadow-2xs"
              title="Back to All Folders"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-2xs"
                style={{ backgroundColor: activeFolder.color }}
              >
                <FolderIcon className="w-4 h-4 fill-current/30" />
              </div>
              <h2 className="text-xl font-bold text-stone-900 dark:text-white">
                {activeFolder.name}
              </h2>
            </div>
          </div>

          {/* Folder Action Buttons */}
          <div className="flex items-center gap-2">
            {onOpenSync && (
              <button
                onClick={onOpenSync}
                title="Open WebRTC P2P Device Sync"
                className="py-2 px-3 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="hidden sm:inline">P2P Sync</span>
              </button>
            )}

            <button
              onClick={() => fileUploadInputRef.current?.click()}
              className="py-2 px-3.5 bg-white dark:bg-stone-900 border border-[#e8e4dc] dark:border-stone-700 hover:bg-[#f7f5f0] dark:hover:bg-stone-800 text-stone-800 dark:text-stone-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Upload Audio</span>
            </button>
            <input
              ref={fileUploadInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={handleUploadAudioChange}
            />

            <button
              onClick={() => onCreateSessionInFolder(selectedFolderId)}
              className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Recording</span>
            </button>
          </div>
        </div>

        {/* Sessions List */}
        {folderSessions.length === 0 ? (
          <div className="p-12 text-center border-2 border-dashed border-[#e4ded5] dark:border-stone-800 rounded-2xl bg-[#faf8f5] dark:bg-stone-900/40">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3 shadow-2xs">
              <FolderIcon className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 mb-1">
              No recordings yet. Click the mic to start!
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 mb-5">
              Upload an audio file or record a new voice memo to get started.
            </p>
            <button
              onClick={() => onCreateSessionInFolder(selectedFolderId)}
              className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record First Session</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {folderSessions.map((session) => {
              const formattedDate = formatDateTime(session.createdAt || session.updatedAt);
              const durationStr = formatTime(session.duration);

              return (
                <div
                  key={session.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenSession(session.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onOpenSession(session.id);
                    }
                  }}
                  className="flex flex-col w-full p-4 mb-3 text-left transition-all border rounded-lg shadow-sm bg-white border-slate-200 hover:border-slate-300 hover:shadow-md dark:bg-slate-800 dark:border-slate-700 dark:hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer group"
                >
                  {/* Top Row: Title & Action Controls */}
                  <div className="flex items-center justify-between gap-3 min-w-0">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <Play className="w-3.5 h-3.5 fill-current" />
                      </div>
                      <h4 className="font-semibold text-slate-900 dark:text-slate-100 truncate text-sm sm:text-base group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {session.title}
                      </h4>
                    </div>

                    {/* Quick Action Buttons */}
                    <div
                      className="flex items-center gap-1.5 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => onOpenSession(session.id)}
                        className="py-1 px-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-600 hover:text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Open Editor
                      </button>

                      {/* Download MP3 Button */}
                      <button
                        onClick={() => handleDownloadMp3(session)}
                        disabled={!session.audioBlob || downloadingMp3SessionId === session.id}
                        title={
                          downloadingMp3SessionId === session.id
                            ? 'Converting to MP3 in background worker...'
                            : session.audioBlob
                            ? 'Download recording as MP3'
                            : 'No audio available'
                        }
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                      >
                        {downloadingMp3SessionId === session.id ? (
                          <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                      </button>

                      {/* Delete Session Button */}
                      <button
                        onClick={() => onDeleteSession(session.id)}
                        title="Delete recording"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Bottom Row: Metadata (Date/Time Left, Duration Right) */}
                  <div className="flex justify-between items-center mt-2 text-sm text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5 truncate">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{formattedDate}</span>
                    </div>

                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300 font-mono text-xs font-bold border border-slate-200 dark:border-slate-600/60 shrink-0 tabular-nums">
                      {durationStr}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // DEFAULT HOME: Folder-First Grid
  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10 max-w-6xl mx-auto w-full">
      {/* Dashboard Top Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#e8e4dc] dark:border-stone-800">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-white">
            Audio Notebooks
          </h2>
          <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
            Organize recordings and timestamped notes by category
          </p>
        </div>

        {/* Global Dashboard Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onOpenShortcuts}
            className="py-2 px-3 bg-white dark:bg-stone-900 border border-[#e8e4dc] dark:border-stone-700 hover:bg-[#f7f5f0] dark:hover:bg-stone-800 text-stone-700 dark:text-stone-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <span>Shortcuts</span>
            <kbd className="px-1 py-0.2 rounded bg-[#f0ece4] dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-[10px] font-mono">
              ?
            </kbd>
          </button>

          <button
            onClick={() => setIsCreatingFolder(true)}
            className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Folder</span>
          </button>
        </div>
      </div>

      {/* Filter / Search Folders */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="relative max-w-sm w-full">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search folders..."
            value={folderSearchQuery}
            onChange={(e) => setFolderSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-[#e8e4dc] dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Grid of Folder Cards in Chalk Pastel Palette */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredFolders.map((folder) => {
          const folderSess = sessions.filter((s) => s.folderId === folder.id);
          const totalDuration = folderSess.reduce((acc, s) => acc + (s.duration || 0), 0);
          const lastUpdated =
            folderSess.length > 0 ? Math.max(...folderSess.map((s) => s.updatedAt)) : null;

          return (
            <div
              key={folder.id}
              onClick={() => onSelectFolder(folder.id)}
              className="group relative bg-[#faf8f5] dark:bg-stone-900/90 rounded-2xl border border-[#e5e0d8] dark:border-stone-800 p-5 shadow-2xs hover:shadow-md hover:border-stone-400 dark:hover:border-stone-700 transition-all cursor-pointer flex flex-col justify-between"
            >
              <div>
                {/* Folder Top Row: Icon & Delete */}
                <div className="flex items-center justify-between mb-4">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-2xs transition-transform group-hover:scale-105"
                    style={{ backgroundColor: folder.color }}
                  >
                    <FolderIcon className="w-5 h-5 fill-current/30" />
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteFolder(folder.id);
                    }}
                    title="Delete folder"
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-all cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Title & Recording Stats */}
                <h3 className="text-base font-bold text-stone-900 dark:text-white mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                  {folder.name}
                </h3>
                <p className="text-xs text-stone-600 dark:text-stone-400">
                  {folderSess.length} {folderSess.length === 1 ? 'recording' : 'recordings'}
                  {totalDuration > 0 && ` · ${formatTime(totalDuration)}`}
                </p>
              </div>

              {/* Card Footer: Last updated & Open Arrow */}
              <div className="pt-4 mt-4 border-t border-[#ede7dd] dark:border-stone-800/80 flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
                <span className="text-[11px] font-mono">
                  {lastUpdated
                    ? new Date(lastUpdated).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                      })
                    : 'Empty'}
                </span>
                <span className="text-indigo-600 dark:text-indigo-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-1 text-[11px]">
                  <span>Open</span>
                  <span>→</span>
                </span>
              </div>
            </div>
          );
        })}

        {/* Create New Folder Card */}
        {isCreatingFolder ? (
          <form
            onSubmit={handleCreateFolderSubmit}
            className="bg-white dark:bg-stone-900 rounded-2xl border-2 border-indigo-500/50 p-5 shadow-md flex flex-col justify-between"
          >
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-2 block">
                Create New Folder
              </span>
              <input
                type="text"
                autoFocus
                placeholder="Folder name (e.g. Brainstorming)..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-[#e8e4dc] dark:border-stone-700 bg-[#faf8f5] dark:bg-stone-800 text-stone-900 dark:text-white focus:outline-hidden mb-3"
              />

              <div className="flex items-center gap-2 mb-3">
                <span className="text-[11px] text-stone-500 mr-1">Color:</span>
                {folderColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewFolderColor(color)}
                    className={`w-4 h-4 rounded-full transition-transform cursor-pointer ${
                      newFolderColor === color ? 'scale-125 ring-2 ring-indigo-500' : ''
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#f0ece4] dark:border-stone-800">
              <button
                type="button"
                onClick={() => setIsCreatingFolder(false)}
                className="px-3 py-1.5 text-xs text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newFolderName.trim()}
                className="px-3.5 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold cursor-pointer disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setIsCreatingFolder(true)}
            className="group rounded-2xl border-2 border-dashed border-[#e0d9cf] dark:border-stone-800 hover:border-indigo-500 dark:hover:border-indigo-400 p-6 flex flex-col items-center justify-center text-center transition-all bg-[#faf8f5]/60 dark:bg-stone-900/30 hover:bg-indigo-50/20 dark:hover:bg-indigo-950/10 cursor-pointer min-h-[160px]"
          >
            <div className="w-10 h-10 rounded-xl bg-white dark:bg-stone-800 border border-[#e8e4dc] dark:border-stone-700 text-stone-600 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center mb-2.5 transition-colors shadow-2xs">
              <Plus className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
              Create New Folder
            </h4>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 max-w-[180px] mt-0.5">
              Add a category for your recordings
            </p>
          </button>
        )}
      </div>
    </div>
  );
};
