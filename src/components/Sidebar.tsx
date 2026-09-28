import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Type,
  FileCode,
  Headphones,
  Palette,
  Layers,
  Keyboard,
  ArrowRightLeft,
} from 'lucide-react';
import { AppSettings, Folder, Session, ThemeMode } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface SidebarProps {
  folders: Folder[];
  sessions: Session[];
  activeFolderId: string | 'all';
  currentSessionId: string | null;
  settings: AppSettings;
  storageUsage: { usedBytes: number; quotaBytes: number; percentage: number };
  onSelectFolder: (folderId: string | 'all') => void;
  onSelectSession: (sessionId: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (sessionId: string) => void;
  onCreateFolder: (name: string, color: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onExportStandaloneHtml: () => void;
  onOpenShortcuts: () => void;
  onOpenSync?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  folders,
  sessions,
  activeFolderId,
  currentSessionId,
  settings,
  onSelectFolder,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  onCreateFolder,
  onDeleteFolder,
  onUpdateSettings,
  onExportStandaloneHtml,
  onOpenShortcuts,
  onOpenSync,
}) => {
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#10B981');

  const handleAddFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    onCreateFolder(newFolderName.trim(), newFolderColor);
    setNewFolderName('');
    setIsAddingFolder(false);
  };

  // Filter sessions by active folder
  const visibleSessions =
    activeFolderId === 'all'
      ? sessions
      : sessions.filter((s) => s.folderId === activeFolderId);

  const folderColors = ['#10B981', '#0EA5E9', '#F59E0B', '#EC4899', '#8B5CF6', '#F97316'];

  return (
    <aside className="w-72 md:w-80 h-full flex flex-col bg-[#fcfbf9] dark:bg-stone-900 border-r border-[#e8e4dc] dark:border-stone-800 select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-[#e8e4dc] dark:border-stone-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-2xs">
            <Headphones className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-stone-900 dark:text-white leading-none">
              Pinpoint Audio
            </h1>
          </div>
        </div>

        {/* New Session Action */}
        <button
          onClick={onCreateSession}
          title="Create New Session"
          className="p-1.5 rounded-xl bg-white dark:bg-stone-800 border border-[#e8e4dc] dark:border-stone-700 text-stone-800 dark:text-stone-200 hover:bg-[#f0ece4] dark:hover:bg-stone-700 transition-colors cursor-pointer shadow-2xs"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Main Navigation (Folders & Sessions) */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Folders Section */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              Folders
            </span>
            <button
              onClick={() => setIsAddingFolder(!isAddingFolder)}
              className="text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 text-xs cursor-pointer"
              title="Add Folder"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1">
            {/* All Notes Entry */}
            <button
              onClick={() => onSelectFolder('all')}
              className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                activeFolderId === 'all'
                  ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 shadow-2xs border border-indigo-200/60 dark:border-indigo-800/60'
                  : 'text-stone-700 dark:text-stone-300 hover:bg-[#f0ece4] dark:hover:bg-stone-800'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <Layers className="w-3.5 h-3.5 text-stone-400" />
                <span className="truncate">All Sessions</span>
              </div>
              <span className="text-[10px] text-stone-400 font-mono">{sessions.length}</span>
            </button>

            {/* Folder list */}
            {folders.map((folder) => {
              const count = sessions.filter((s) => s.folderId === folder.id).length;
              const isSelected = activeFolderId === folder.id;
              return (
                <div key={folder.id} className="group relative flex items-center">
                  <button
                    onClick={() => onSelectFolder(folder.id)}
                    className={`flex-1 text-left px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 shadow-2xs border border-indigo-200/60 dark:border-indigo-800/60'
                        : 'text-stone-700 dark:text-stone-300 hover:bg-[#f0ece4] dark:hover:bg-stone-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                        style={{ backgroundColor: folder.color }}
                      />
                      <span className="truncate">{folder.name}</span>
                    </div>
                    <span className="text-[10px] text-stone-400 font-mono">{count}</span>
                  </button>

                  <button
                    onClick={() => onDeleteFolder(folder.id)}
                    title="Delete folder"
                    className="hidden group-hover:block p-1 text-stone-400 hover:text-rose-600 rounded transition-colors mr-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Inline Add Folder Form */}
          {isAddingFolder && (
            <form onSubmit={handleAddFolderSubmit} className="mt-2 p-2.5 bg-white dark:bg-stone-800 rounded-xl border border-[#e8e4dc] dark:border-stone-700 space-y-2 shadow-2xs">
              <input
                type="text"
                autoFocus
                placeholder="Folder name..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="w-full text-xs p-1.5 rounded-lg border border-[#e8e4dc] dark:border-stone-700 bg-[#faf8f5] dark:bg-stone-900 text-stone-900 dark:text-white focus:outline-hidden"
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {folderColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewFolderColor(color)}
                      className={`w-3.5 h-3.5 rounded-full cursor-pointer ${
                        newFolderColor === color ? 'ring-2 ring-indigo-500 scale-110' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingFolder(false)}
                    className="px-2 py-0.5 text-[11px] text-stone-500 hover:text-stone-700 dark:hover:text-stone-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newFolderName.trim()}
                    className="px-2.5 py-0.5 text-[11px] bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Sessions in Folder */}
        <div className="pt-2 border-t border-[#f0ece4] dark:border-stone-800">
          <div className="px-2 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              Recordings ({visibleSessions.length})
            </span>
          </div>

          <div className="space-y-1">
            {visibleSessions.length === 0 ? (
              <p className="px-2 py-3 text-xs text-stone-400 text-center">
                No recordings yet. Click the mic to start!
              </p>
            ) : (
              visibleSessions.map((session) => {
                const isSelected = currentSessionId === session.id;
                return (
                  <div key={session.id} className="group relative flex items-center">
                    <button
                      onClick={() => onSelectSession(session.id)}
                      className={`flex-1 text-left px-2.5 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                          : 'text-stone-800 dark:text-stone-200 hover:bg-[#f0ece4] dark:hover:bg-stone-800'
                      }`}
                    >
                      <div className="truncate pr-2">
                        <p className="truncate leading-snug">{session.title}</p>
                      </div>
                      <span
                        className={`text-[10px] font-mono shrink-0 ${
                          isSelected ? 'text-indigo-100' : 'text-stone-500 dark:text-stone-400'
                        }`}
                      >
                        {new Date(session.updatedAt).toLocaleDateString([], {
                          month: 'numeric',
                          day: 'numeric',
                        })}
                      </span>
                    </button>

                    <button
                      onClick={() => onDeleteSession(session.id)}
                      title="Delete recording"
                      className="hidden group-hover:block p-1 text-stone-400 hover:text-rose-600 rounded transition-colors mr-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Accessibility & Theme Controls Bar */}
      <div className="p-3 border-t border-[#e8e4dc] dark:border-stone-800 bg-[#f7f5f0]/70 dark:bg-stone-950/40 space-y-2.5">
        <div className="space-y-2">
          {/* Typography Toggle: Standard vs OpenDyslexic */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] text-stone-600 dark:text-stone-400 flex items-center gap-1 font-medium">
              <Type className="w-3.5 h-3.5" />
              <span>Dyslexia Font:</span>
            </span>
            <button
              onClick={() =>
                onUpdateSettings({
                  fontMode: settings.fontMode === 'dyslexic' ? 'standard' : 'dyslexic',
                })
              }
              className={`px-2.5 py-0.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer border ${
                settings.fontMode === 'dyslexic'
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200 border-[#e8e4dc] dark:border-stone-700'
              }`}
            >
              {settings.fontMode === 'dyslexic' ? 'Dyslexic ON' : 'Sans'}
            </button>
          </div>

          {/* Theme Toggles */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] text-stone-600 dark:text-stone-400 flex items-center gap-1 font-medium">
              <Palette className="w-3.5 h-3.5" />
              <span>Theme:</span>
            </span>
            <div className="flex items-center gap-1">
              {(['light', 'dark', 'sepia'] as ThemeMode[]).map((theme) => (
                <button
                  key={theme}
                  onClick={() => onUpdateSettings({ theme })}
                  title={`${theme.toUpperCase()} theme`}
                  className={`px-2 py-0.5 rounded-md text-[10px] uppercase font-bold transition-all cursor-pointer ${
                    settings.theme === theme
                      ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900 shadow-2xs'
                      : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-200 bg-white dark:bg-stone-900 border border-[#e8e4dc] dark:border-stone-800'
                  }`}
                >
                  {theme[0]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Standalone HTML, Shortcuts & PWA Install Actions */}
        <div className="pt-2 border-t border-[#e8e4dc] dark:border-stone-800 space-y-1.5">
          <PWAInstallButton variant="sidebar" />

          <button
            onClick={onOpenShortcuts}
            title="Open Keyboard Shortcuts Cheat Sheet (?)"
            className="w-full py-1.5 px-2 bg-white dark:bg-stone-900 hover:bg-[#f0ece4] dark:hover:bg-stone-800 border border-[#e8e4dc] dark:border-stone-700 text-stone-800 dark:text-stone-200 rounded-lg text-[11px] font-semibold flex items-center justify-between transition-colors cursor-pointer shadow-2xs"
          >
            <div className="flex items-center gap-1.5">
              <Keyboard className="w-3.5 h-3.5 text-stone-500" />
              <span>Keyboard Shortcuts</span>
            </div>
            <kbd className="px-1.5 py-0.2 rounded bg-[#f0ece4] dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-[10px] font-mono">?</kbd>
          </button>

          <button
            onClick={onOpenSync}
            title="Open WebRTC Direct P2P Device Sync"
            className="w-full py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 border border-emerald-200/80 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-300 rounded-lg text-[11px] font-semibold flex items-center justify-between transition-colors cursor-pointer shadow-2xs"
          >
            <div className="flex items-center gap-1.5">
              <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>P2P Device Sync</span>
            </div>
            <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-200/80 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200">
              WebRTC
            </span>
          </button>

          <button
            onClick={onExportStandaloneHtml}
            title="Download self-contained offline HTML file"
            className="w-full py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 border border-indigo-200/70 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileCode className="w-3.5 h-3.5 text-indigo-500" />
            <span>Export Standalone HTML</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
