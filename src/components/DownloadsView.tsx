import React, { useState, useEffect } from 'react';
import {
  Download,
  FileText,
  FileAudio,
  CheckCircle2,
  Clock,
  Trash2,
  ExternalLink,
  HardDrive,
  FileCode,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { DownloadRecord, Session } from '../types';
import { downloadTracker } from '../services/downloadTracker';

interface DownloadsViewProps {
  sessions: Session[];
  onOpenSession: (sessionId: string) => void;
  onExportNotes: (session: Session) => void;
  onDownloadAudio?: (session: Session) => void;
  localDirName?: string | null;
  onShowToast?: (msg: string) => void;
}

export const DownloadsView: React.FC<DownloadsViewProps> = ({
  sessions,
  onOpenSession,
  onExportNotes,
  onDownloadAudio,
  localDirName,
  onShowToast,
}) => {
  const [downloads, setDownloads] = useState<DownloadRecord[]>([]);

  const reloadDownloads = () => {
    setDownloads(downloadTracker.getDownloads());
  };

  useEffect(() => {
    reloadDownloads();
  }, []);

  const handleClearHistory = () => {
    downloadTracker.clearDownloads();
    reloadDownloads();
    onShowToast?.('Downloads history cleared');
  };

  const handleRemoveItem = (id: string) => {
    downloadTracker.removeDownload(id);
    reloadDownloads();
  };

  const activeSessions = sessions.filter((s) => !s.deletedAt);

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-4 border-b border-[#e8e4dc] dark:border-stone-800">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-white flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Download className="w-4.5 h-4.5" />
            </div>
            <span>Export & Downloads</span>
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Track exported Markdown notes, audio files, and local file system auto-saves
          </p>
        </div>

        {downloads.length > 0 && (
          <button
            type="button"
            onClick={handleClearHistory}
            className="text-xs text-stone-500 hover:text-rose-600 dark:text-stone-400 dark:hover:text-rose-400 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear History</span>
          </button>
        )}
      </div>

      {/* Local Auto-Save Banner if configured */}
      {localDirName && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-amber-900 dark:text-amber-200">
                Direct Local Folder Active: <span className="font-mono">/{localDirName}</span>
              </div>
              <div className="text-[11px] text-amber-700 dark:text-amber-400">
                All newly recorded sessions and exports auto-save to disk via File System Access API.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Download History List */}
      <div className="mb-10">
        <h2 className="text-sm font-bold text-stone-800 dark:text-stone-200 mb-3 flex items-center justify-between">
          <span>Export History ({downloads.length})</span>
        </h2>

        {downloads.length === 0 ? (
          <div className="p-8 text-center rounded-2xl border border-[#e8e4dc] dark:border-stone-800 bg-[#faf8f5]/40 dark:bg-stone-900/30">
            <div className="w-10 h-10 rounded-xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center mx-auto text-stone-400 mb-2.5">
              <Download className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-stone-700 dark:text-stone-300">
              No exports recorded yet
            </p>
            <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-1 max-w-sm mx-auto">
              Export notes or download audio from the sessions below. Your download history and file statuses will be tracked here.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {downloads.map((item) => {
              const dateStr = new Date(item.timestamp).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              const isAudio = item.format === 'webm' || item.format === 'mp3';
              const isMd = item.format === 'md';
              const isHtml = item.format === 'html';

              return (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl bg-white dark:bg-stone-900 border border-[#e8e4dc] dark:border-stone-800 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        isAudio
                          ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400'
                          : isMd
                          ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                          : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {isAudio ? (
                        <FileAudio className="w-4 h-4" />
                      ) : isMd ? (
                        <FileText className="w-4 h-4" />
                      ) : (
                        <FileCode className="w-4 h-4" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="font-semibold text-stone-900 dark:text-white truncate">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-stone-400 dark:text-stone-500 flex items-center gap-2 truncate font-mono">
                        <span>{item.fileName}</span>
                        <span>•</span>
                        <span>{dateStr}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {/* Format Badge */}
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                      .{item.format}
                    </span>

                    {/* Status Badge */}
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span className="capitalize">{item.status}</span>
                    </span>

                    {/* Quick remove from history */}
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="p-1 rounded-lg text-stone-300 hover:text-rose-500 dark:text-stone-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                      title="Remove from history"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Export Session Center */}
      <div>
        <h2 className="text-sm font-bold text-stone-800 dark:text-stone-200 mb-3">
          Available Sessions for Quick Export
        </h2>
        {activeSessions.length === 0 ? (
          <p className="text-xs text-stone-400">No sessions recorded yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeSessions.slice(0, 8).map((session) => (
              <div
                key={session.id}
                className="p-3.5 rounded-2xl bg-white dark:bg-stone-900 border border-[#e8e4dc] dark:border-stone-800 flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-stone-900 dark:text-white truncate">
                    {session.title}
                  </div>
                  <div className="text-[11px] text-stone-400">
                    {session.transcript ? 'Transcript available' : 'Audio recording'}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      onExportNotes(session);
                      downloadTracker.addDownload({
                        sessionId: session.id,
                        title: session.title,
                        format: 'md',
                        fileName: `${(session.title || 'Session').replace(/[^a-zA-Z0-9_-]/g, '_')}.md`,
                        status: 'completed',
                      });
                      reloadDownloads();
                    }}
                    title="Export Notes as Markdown (.md)"
                    className="px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-semibold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <FileText className="w-3 h-3" />
                    <span>.md</span>
                  </button>

                  {session.audioBlob && onDownloadAudio && (
                    <button
                      type="button"
                      onClick={() => {
                        onDownloadAudio(session);
                        downloadTracker.addDownload({
                          sessionId: session.id,
                          title: session.title,
                          format: 'webm',
                          fileName: `${(session.title || 'Audio').replace(/[^a-zA-Z0-9_-]/g, '_')}.webm`,
                          status: 'completed',
                        });
                        reloadDownloads();
                      }}
                      title="Download Audio (.webm)"
                      className="px-2.5 py-1 rounded-xl bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-semibold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <FileAudio className="w-3 h-3" />
                      <span>Audio</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onOpenSession(session.id)}
                    title="Open Session"
                    className="p-1 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
