import React, { useEffect } from 'react';
import { AlertTriangle, Trash2, X, Clock, FileAudio } from 'lucide-react';
import { Session } from '../types';
import { formatTime } from '../utils/audio';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  session: Session | null;
  isPermanent?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  session,
  isPermanent = false,
  onConfirm,
  onCancel,
}) => {
  // Handle keyboard navigation (Escape to cancel, Enter to confirm)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen || !session) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-rose-50/60 dark:bg-rose-950/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-600/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <h3
                id="delete-modal-title"
                className="text-sm font-bold text-neutral-900 dark:text-white leading-tight"
              >
                {isPermanent ? 'Delete Permanently' : 'Move to Bin'}
              </h3>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                {isPermanent ? 'Permanent IndexedDB removal' : 'Retained for 90 days'}
              </p>
            </div>
          </div>

          <button
            onClick={onCancel}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Cancel (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
            {isPermanent
              ? 'Are you sure you want to permanently delete this session? All recorded audio and associated notes will be wiped immediately and cannot be recovered.'
              : 'Move this session to the Bin? It will be hidden from your main library and can be restored anytime within the next 90 days before permanent deletion.'}
          </p>

          {/* Session Details Card */}
          <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/60 space-y-2">
            <h4 className="font-semibold text-xs text-neutral-900 dark:text-white truncate">
              {session.title}
            </h4>

            <div className="flex flex-wrap items-center gap-4 text-[11px] text-neutral-500 dark:text-neutral-400 font-mono">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                <span>{formatTime(session.duration)}</span>
              </span>
              {session.audioFileName && (
                <span className="flex items-center gap-1.5 truncate max-w-[200px]">
                  <FileAudio className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span className="truncate">{session.audioFileName}</span>
                </span>
              )}
            </div>
          </div>

          {/* Warning Banner */}
          <div
            className={`flex items-start gap-2.5 p-3 rounded-xl text-xs leading-snug border ${
              isPermanent
                ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/50 text-rose-800 dark:text-rose-300'
                : 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300'
            }`}
          >
            <AlertTriangle
              className={`w-4 h-4 shrink-0 mt-0.5 ${
                isPermanent ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'
              }`}
            />
            <span>
              {isPermanent
                ? 'This action cannot be undone. Local IndexedDB storage for this session will be permanently cleared.'
                : 'Deleted sessions are stored in the Bin and will be automatically purged after 90 days.'}
            </span>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="px-5 py-3.5 bg-neutral-50 dark:bg-neutral-950/40 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-medium rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer shadow-xs"
          >
            {isPermanent ? 'Delete Permanently' : 'Move to Bin'}
          </button>
        </div>
      </div>
    </div>
  );
};
