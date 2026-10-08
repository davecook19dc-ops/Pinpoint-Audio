import React from 'react';
import {
  Folder as FolderIcon,
  Mic,
  Download,
  ArrowLeftRight,
  Eye,
  Trash2,
  HardDrive,
  Upload,
  Plus,
  HelpCircle,
  Database,
  X,
} from 'lucide-react';
import { AppSettings, MainNavView } from '../types';
import { BrandLogo } from './BrandLogo';

export interface NavigationSidebarProps {
  activeNavView: MainNavView;
  onSelectNavView: (view: MainNavView) => void;
  folderCount: number;
  recordingCount: number;
  downloadsCount: number;
  storageUsage: { usedBytes: number; quotaBytes: number; percentage: number };
  deletedSessionsCount: number;
  onSelectBin: () => void;
  isBinActive?: boolean;
  onOpenAccessibility: () => void;
  settings: AppSettings;
  onImportAudioClick: () => void;
  onSelectLocalFolder: () => void;
  localDirName: string | null;
  onOpenSync: () => void;
  isFsSupported: boolean;
  onOpenCreateFolderModal?: () => void;
  onOpenShortcuts?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const NavigationSidebar: React.FC<NavigationSidebarProps> = ({
  activeNavView,
  onSelectNavView,
  folderCount,
  recordingCount,
  downloadsCount,
  storageUsage,
  deletedSessionsCount,
  onSelectBin,
  isBinActive = false,
  onOpenAccessibility,
  settings,
  onImportAudioClick,
  onSelectLocalFolder,
  localDirName,
  onOpenSync,
  isFsSupported,
  onOpenCreateFolderModal,
  onOpenShortcuts,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const currentTheme = settings.theme || 'light';
  const currentFont =
    settings.readingFont || (settings.fontMode === 'dyslexic' ? 'dyslexic' : 'sans');

  const navItems = [
    {
      id: 'folders' as MainNavView,
      label: 'Folders',
      icon: FolderIcon,
      count: folderCount,
      description: 'Categories & workspaces',
    },
    {
      id: 'all-recordings' as MainNavView,
      label: 'All Recordings',
      icon: Mic,
      count: recordingCount,
      description: 'Unified library & search',
    },
    {
      id: 'downloads' as MainNavView,
      label: 'Downloads',
      icon: Download,
      count: downloadsCount,
      description: 'Exported notes & audio',
    },
    {
      id: 'import-export' as MainNavView,
      label: 'Import / Export',
      icon: ArrowLeftRight,
      description: 'Folder sync & backups',
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-2xs md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-45 w-64 md:w-68 flex flex-col bg-[#fcfbf9] dark:bg-stone-900 border-r border-[#e8e4dc] dark:border-stone-800 transition-transform duration-200 ease-in-out md:translate-x-0 select-none ${
          isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        {/* Top Brand Zone */}
        <div className="p-4 md:p-5 border-b border-[#e8e4dc] dark:border-stone-800 flex items-center justify-between shrink-0">
          <BrandLogo size="md" />

          {/* Close button on mobile */}
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 md:hidden cursor-pointer"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Primary Navigation Items (Exact Order: Folders, All Recordings, Downloads, Import/Export) */}
        <div className="p-3 space-y-1.5 flex-1 overflow-y-auto">
          <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
            Workspace
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = !isBinActive && activeNavView === item.id;

            return (
              <div key={item.id} className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    onSelectNavView(item.id);
                    onCloseMobile?.();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-xs font-semibold transition-colors cursor-pointer group ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-xs font-bold'
                      : 'text-stone-700 dark:text-stone-300 hover:bg-[#f2eee6] dark:hover:bg-stone-800/70'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-transform ${
                        isActive
                          ? 'text-white'
                          : 'text-stone-500 dark:text-stone-400 group-hover:scale-105'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.count !== undefined && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono shrink-0 ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-stone-200/80 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>

                {/* Sub-actions for Import/Export if active or quick access */}
                {item.id === 'import-export' && isActive && (
                  <div className="pl-4 pr-1 py-1 space-y-1 text-xs animate-in fade-in duration-100">
                    <button
                      type="button"
                      onClick={onImportAudioClick}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-stone-600 dark:text-stone-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-stone-100 dark:hover:bg-stone-800/50 transition-colors cursor-pointer text-[11px]"
                    >
                      <Upload className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Import Audio File</span>
                    </button>

                    {isFsSupported && (
                      <button
                        type="button"
                        onClick={onSelectLocalFolder}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-stone-600 dark:text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-stone-100 dark:hover:bg-stone-800/50 transition-colors cursor-pointer text-[11px]"
                      >
                        <HardDrive className="w-3.5 h-3.5 text-amber-500" />
                        <span className="truncate">
                          {localDirName ? `Folder: /${localDirName}` : 'Set Local Folder'}
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={onOpenSync}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-stone-600 dark:text-stone-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-stone-100 dark:hover:bg-stone-800/50 transition-colors cursor-pointer text-[11px]"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-500" />
                      <span>WebRTC P2P Sync</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Quick Create Folder Shortcut in Navigation */}
          {onOpenCreateFolderModal && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  onOpenCreateFolderModal();
                  onCloseMobile?.();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-2xl text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 border border-dashed border-indigo-200 dark:border-indigo-900/60 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>New Folder</span>
              </button>
            </div>
          )}

          {/* Soft-delete Bin shortcut */}
          <div className="pt-3">
            <button
              type="button"
              onClick={() => {
                onSelectBin();
                onCloseMobile?.();
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-2xl text-xs font-semibold transition-colors cursor-pointer ${
                isBinActive
                  ? 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300'
                  : 'text-stone-500 dark:text-stone-400 hover:bg-[#f2eee6] dark:hover:bg-stone-800/70'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Trash2 className="w-4 h-4 text-stone-400" />
                <span>Trash Bin</span>
              </div>
              {deletedSessionsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-100 dark:bg-rose-900/80 text-rose-700 dark:text-rose-300 font-mono">
                  {deletedSessionsCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Bottom Dock / Footer */}
        <div className="p-3 border-t border-[#e8e4dc] dark:border-stone-800 bg-[#f8f6f0]/70 dark:bg-stone-900/90 shrink-0 space-y-2.5">
          {/* Accessibility Features Button (eye / accessibility icon) */}
          <button
            type="button"
            onClick={onOpenAccessibility}
            title="Open Accessibility & Display Settings (Theme, Font, Comfort)"
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl bg-white dark:bg-stone-800/90 border border-stone-200 dark:border-stone-700/80 text-stone-800 dark:text-stone-200 hover:border-indigo-400 hover:bg-stone-50 dark:hover:bg-stone-800 text-xs font-semibold shadow-2xs transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Eye className="w-3.5 h-3.5" />
              </div>
              <span>Accessibility</span>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] font-mono text-stone-400">
              <span className="capitalize">{currentTheme}</span>
              <span>•</span>
              <span className="capitalize">{currentFont}</span>
            </div>
          </button>

          {/* Storage Indicator */}
          <div className="px-2 py-1">
            <div className="flex items-center justify-between text-[10px] font-medium text-stone-500 dark:text-stone-400 mb-1">
              <span className="flex items-center gap-1">
                <Database className="w-3 h-3 text-stone-400" />
                <span>IndexedDB Storage</span>
              </span>
              <span>
                {(storageUsage.usedBytes / (1024 * 1024)).toFixed(1)} MB ({storageUsage.percentage}%)
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  storageUsage.percentage > 85
                    ? 'bg-rose-500'
                    : storageUsage.percentage > 60
                    ? 'bg-amber-500'
                    : 'bg-indigo-600'
                }`}
                style={{ width: `${Math.max(2, Math.min(100, storageUsage.percentage))}%` }}
              />
            </div>
          </div>

          {/* Keyboard Shortcuts Trigger link */}
          {onOpenShortcuts && (
            <div className="flex items-center justify-between px-2 pt-1 text-[11px] text-stone-400 dark:text-stone-500">
              <button
                type="button"
                onClick={onOpenShortcuts}
                className="hover:text-stone-700 dark:hover:text-stone-300 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <HelpCircle className="w-3 h-3" />
                <span>Shortcuts</span>
              </button>
              <kbd className="px-1 py-0.2 rounded bg-stone-200 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-[9px] font-mono">
                ?
              </kbd>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
