import React, { useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Upload,
  HardDrive,
  Folder as FolderIcon,
  FileCode,
  Download,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  HelpCircle,
  Database,
  ArrowRight,
} from 'lucide-react';
import { Folder } from '../types';

interface ImportExportViewProps {
  folders: Folder[];
  onImportAudio: (file: File) => void;
  onAudioUploadedInFolder: (folderId: string, file: File) => void;
  localDirName: string | null;
  onSelectLocalFolder: () => void;
  onRemoveLocalFolder?: () => void;
  isFsSupported: boolean;
  onOpenSync: () => void;
  onExportStandaloneHtml: () => void;
  onShowToast?: (msg: string) => void;
}

export const ImportExportView: React.FC<ImportExportViewProps> = ({
  folders,
  onImportAudio,
  onAudioUploadedInFolder,
  localDirName,
  onSelectLocalFolder,
  onRemoveLocalFolder,
  isFsSupported,
  onOpenSync,
  onExportStandaloneHtml,
  onShowToast,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedTargetFolder, setSelectedTargetFolder] = useState<string>(
    folders[0]?.id || ''
  );
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (selectedTargetFolder) {
      onAudioUploadedInFolder(selectedTargetFolder, file);
    } else {
      onImportAudio(file);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10 max-w-4xl mx-auto w-full">
      {/* Header */}
      <div className="mb-8 pb-4 border-b border-[#e8e4dc] dark:border-stone-800">
        <h1 className="text-2xl font-bold text-stone-900 dark:text-white flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <ArrowLeftRight className="w-4.5 h-4.5" />
          </div>
          <span>Import, Export & Sync</span>
        </h1>
        <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
          Manage local filesystem integration, audio file imports, and P2P peer-to-peer data sync
        </p>
      </div>

      <div className="space-y-6">
        {/* 1. Import Audio Files */}
        <div className="p-6 rounded-3xl bg-white dark:bg-stone-900 border border-[#e8e4dc] dark:border-stone-800 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Upload className="w-4.5 h-4.5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-stone-900 dark:text-white">
                  Import Existing Audio
                </h2>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Upload recorded lectures, voice notes, or meetings (.webm, .mp3, .wav, .m4a)
                </p>
              </div>
            </div>

            {folders.length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-stone-500">Destination:</span>
                <select
                  value={selectedTargetFolder}
                  onChange={(e) => setSelectedTargetFolder(e.target.value)}
                  className="px-2.5 py-1 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 text-xs focus:outline-hidden"
                >
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Drag & Drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`p-8 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30'
                : 'border-stone-200 dark:border-stone-800 hover:border-indigo-400 hover:bg-[#faf8f5] dark:hover:bg-stone-800/40'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/webm, audio/mp4, audio/mp3, audio/wav, audio/*"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3">
              <Upload className="w-5 h-5" />
            </div>
            <div className="text-xs font-semibold text-stone-800 dark:text-stone-200">
              Click to select an audio file, or drag and drop here
            </div>
            <div className="text-[11px] text-stone-400 mt-1">
              Supports WebM, MP3, WAV, M4A, AAC. Automatic local waveform analysis.
            </div>
          </div>
        </div>

        {/* 2. Set Local Folder / File System Directory Configuration */}
        <div className="p-6 rounded-3xl bg-white dark:bg-stone-900 border border-[#e8e4dc] dark:border-stone-800 shadow-2xs">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-amber-50 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <HardDrive className="w-4.5 h-4.5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-stone-900 dark:text-white flex items-center gap-2">
                  <span>Local Folder Auto-Save</span>
                  {localDirName && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
                      Connected
                    </span>
                  )}
                </h2>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                  Write recordings and exported notes directly to a folder on your computer (File System Access API)
                </p>
              </div>
            </div>

            <div>
              {isFsSupported ? (
                <button
                  type="button"
                  onClick={onSelectLocalFolder}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-xs ${
                    localDirName
                      ? 'bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/70 dark:hover:bg-amber-900 text-amber-900 dark:text-amber-100'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  <HardDrive className="w-3.5 h-3.5" />
                  <span>{localDirName ? 'Change Folder' : 'Pick Local Folder'}</span>
                </button>
              ) : (
                <div className="px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-400 text-xs font-medium">
                  Chrome / Edge required
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-stone-100 dark:border-stone-800/80 text-xs text-stone-600 dark:text-stone-400 space-y-1.5">
            {localDirName ? (
              <div className="flex items-center justify-between bg-amber-50/50 dark:bg-amber-950/30 p-3 rounded-2xl border border-amber-200/60 dark:border-amber-900/40">
                <div className="flex items-center gap-2 text-stone-800 dark:text-stone-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Current directory:</span>
                  <span className="font-mono font-bold text-amber-800 dark:text-amber-300">
                    /{localDirName}
                  </span>
                </div>
                {onRemoveLocalFolder && (
                  <button
                    type="button"
                    onClick={onRemoveLocalFolder}
                    className="text-[11px] text-stone-400 hover:text-rose-600 transition-colors cursor-pointer"
                  >
                    Disconnect
                  </button>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-stone-400 leading-relaxed">
                When active, your audio files and notes are continuously saved directly to disk in the folder of your choice without requiring manual download prompts.
              </p>
            )}
          </div>
        </div>

        {/* 3. WebRTC P2P Sync */}
        <div className="p-6 rounded-3xl bg-white dark:bg-stone-900 border border-[#e8e4dc] dark:border-stone-800 shadow-2xs">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <ArrowLeftRight className="w-4.5 h-4.5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-stone-900 dark:text-white">
                  WebRTC P2P Device Sync
                </h2>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                  Direct peer-to-peer sync with your phone or laptop. No cloud accounts or central servers.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenSync}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>Open P2P Sync</span>
            </button>
          </div>
        </div>

        {/* 4. Standalone HTML Backup */}
        <div className="p-6 rounded-3xl bg-white dark:bg-stone-900 border border-[#e8e4dc] dark:border-stone-800 shadow-2xs">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <FileCode className="w-4.5 h-4.5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-stone-900 dark:text-white">
                  Standalone HTML Offline Backup
                </h2>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                  Exports a single self-contained .html file with notes, waveforms, and offline player
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onExportStandaloneHtml}
              className="px-4 py-2 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-2xs transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Standalone HTML</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
