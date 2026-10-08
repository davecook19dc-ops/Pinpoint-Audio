import React, { useState } from 'react';
import {
  Search,
  Mic,
  Clock,
  Play,
  Trash2,
  FileDown,
  Folder as FolderIcon,
  Filter,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Folder, Session } from '../types';
import { formatTime } from '../utils/audio';

interface AllRecordingsViewProps {
  sessions: Session[];
  folders: Folder[];
  onOpenSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onExportNotes?: (session: Session) => void;
  onCreateNewRecording?: () => void;
}

export const AllRecordingsView: React.FC<AllRecordingsViewProps> = ({
  sessions,
  folders,
  onOpenSession,
  onDeleteSession,
  onExportNotes,
  onCreateNewRecording,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolderFilter, setSelectedFolderFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'duration' | 'title'>('recent');

  // Filter out soft-deleted sessions
  const activeSessions = sessions.filter((s) => !s.deletedAt);

  const folderMap = new Map(folders.map((f) => [f.id, f]));

  const filteredSessions = activeSessions
    .filter((s) => {
      if (selectedFolderFilter !== 'all' && s.folderId !== selectedFolderFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = s.title.toLowerCase().includes(q);
        const matchesTranscript = s.transcript?.toLowerCase().includes(q);
        return matchesTitle || matchesTranscript;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'recent') {
        return (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt);
      }
      if (sortBy === 'duration') {
        return (b.duration || 0) - (a.duration || 0);
      }
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      return 0;
    });

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-4 border-b border-[#e8e4dc] dark:border-stone-800">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-white flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Mic className="w-4.5 h-4.5" />
            </div>
            <span>All Recordings</span>
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Search, filter, and organize all audio recordings across your folders
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onCreateNewRecording && (
            <button
              onClick={onCreateNewRecording}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Record New</span>
            </button>
          )}
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search by title, transcript, or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-[#e8e4dc] dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-900 dark:text-white placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>

        {/* Filter by Folder & Sort */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-stone-600 dark:text-stone-400">
            <Filter className="w-3.5 h-3.5 text-stone-400" />
            <select
              value={selectedFolderFilter}
              onChange={(e) => setSelectedFolderFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-xl border border-[#e8e4dc] dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200 focus:outline-hidden cursor-pointer"
            >
              <option value="all">All Folders ({activeSessions.length})</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({activeSessions.filter((s) => s.folderId === f.id).length})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-stone-600 dark:text-stone-400">
            <span className="text-stone-400">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-2.5 py-1.5 text-xs rounded-xl border border-[#e8e4dc] dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200 focus:outline-hidden cursor-pointer"
            >
              <option value="recent">Most Recent</option>
              <option value="duration">Longest Duration</option>
              <option value="title">Alphabetical (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid of Recordings */}
      {filteredSessions.length === 0 ? (
        <div className="py-16 text-center rounded-3xl border-2 border-dashed border-[#e8e4dc] dark:border-stone-800 p-8 bg-[#faf8f5]/50 dark:bg-stone-900/40">
          <div className="w-12 h-12 rounded-2xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center mx-auto text-stone-400 mb-3">
            <Mic className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-stone-800 dark:text-stone-200">
            {searchQuery ? 'No recordings match your search' : 'No recordings saved yet'}
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? 'Try modifying your search term or clearing the folder filter.'
              : 'Record your first audio lecture or import an audio file to start building your library.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSessions.map((session) => {
            const folder = folderMap.get(session.folderId);
            const formattedDate = new Date(session.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });

            return (
              <div
                key={session.id}
                onClick={() => onOpenSession(session.id)}
                className="group p-4.5 rounded-2xl bg-white dark:bg-stone-900 border border-[#e8e4dc] dark:border-stone-800 hover:border-indigo-500/50 dark:hover:border-indigo-400/50 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  {/* Top row: Folder chip & Duration */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    {folder ? (
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white truncate max-w-[140px]"
                        style={{ backgroundColor: folder.color }}
                      >
                        <FolderIcon className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{folder.name}</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-stone-100 dark:bg-stone-800 text-stone-500">
                        General
                      </span>
                    )}

                    <span className="flex items-center gap-1 text-[11px] font-mono text-stone-500 dark:text-stone-400">
                      <Clock className="w-3 h-3 text-stone-400" />
                      <span>{formatTime(session.duration || 0)}</span>
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-sm font-bold text-stone-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                    {session.title || 'Untitled Session'}
                  </h3>

                  {/* Transcript snippet or metadata */}
                  {session.transcript ? (
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1.5 line-clamp-2 leading-relaxed">
                      {session.transcript}
                    </p>
                  ) : (
                    <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-1.5 italic">
                      No transcript generated yet
                    </p>
                  )}
                </div>

                {/* Bottom row: Date & Actions */}
                <div className="flex items-center justify-between pt-3 mt-3 border-t border-stone-100 dark:border-stone-800/80 text-xs">
                  <span className="text-[10px] text-stone-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>{formattedDate}</span>
                  </span>

                  <div className="flex items-center gap-1">
                    {onExportNotes && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onExportNotes(session);
                        }}
                        title="Export Notes (.md)"
                        className="p-1 rounded-lg text-stone-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                      >
                        <FileDown className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSession(session.id);
                      }}
                      title="Move to Bin"
                      className="p-1 rounded-lg text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <div className="p-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors ml-1">
                      <Play className="w-3 h-3 fill-current" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
