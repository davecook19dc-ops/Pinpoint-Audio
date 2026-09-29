import React, { useEffect, useState } from 'react';
import { ShieldAlert, HardDrive, AlertTriangle, Check, X, Download } from 'lucide-react';

interface OnboardingWarningProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const OnboardingWarning: React.FC<OnboardingWarningProps> = ({
  isOpen: controlledIsOpen,
  onClose: controlledOnClose,
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState<boolean>(false);

  // Check localStorage for first-time onboarding flag
  useEffect(() => {
    try {
      const hasSeen = localStorage.getItem('hasSeenOnboarding');
      if (!hasSeen) {
        setInternalIsOpen(true);
      }
    } catch (e) {
      // In case localStorage is blocked in private browsing
      setInternalIsOpen(true);
    }
  }, []);

  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  const handleDismiss = () => {
    try {
      localStorage.setItem('hasSeenOnboarding', 'true');
    } catch (e) {
      console.warn('Failed to save onboarding flag to localStorage:', e);
    }
    setInternalIsOpen(false);
    if (controlledOnClose) {
      controlledOnClose();
    }
  };

  // Keyboard navigation: Escape or Enter to dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        handleDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={handleDismiss}
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Accent */}
        <div className="px-6 py-5 border-b border-stone-200 dark:border-stone-800 bg-amber-50/70 dark:bg-amber-950/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-400/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 ring-1 ring-amber-500/20">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3
                id="onboarding-title"
                className="text-base font-bold text-stone-900 dark:text-white leading-tight"
              >
                Your Data Stays on Your Device
              </h3>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80 font-medium">
                Offline-First &amp; Private Storage Notice
              </p>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200/50 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            title="Dismiss notice"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 text-stone-700 dark:text-stone-300">
          <p className="text-sm leading-relaxed">
            <strong>Pinpoint Audio</strong> is a fully private, offline-first app. Your recordings
            and transcripts are saved directly in your browser&apos;s storage, not in the cloud. Do
            not clear your browser site data or cache, or your recordings will be permanently
            deleted.
          </p>

          {/* Key Facts Callouts */}
          <div className="space-y-2.5 pt-1">
            <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700/70 flex items-start gap-3 text-xs">
              <HardDrive className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-stone-900 dark:text-stone-100 block">
                  Zero Cloud Uploads
                </span>
                <span className="text-stone-500 dark:text-stone-400">
                  Audio files and notes never leave your computer or phone.
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">
                  Cache Clearing Deletes Audio
                </span>
                <span className="text-amber-800/90 dark:text-amber-300/90">
                  &quot;Clear Browsing Data / Storage&quot; in browser settings will erase all
                  local sessions.
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 flex items-start gap-3 text-xs text-emerald-900 dark:text-emerald-200">
              <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">
                  Recommended: Export Backups
                </span>
                <span className="text-emerald-800/90 dark:text-emerald-300/90">
                  Always download your MP3s and export notes to standalone HTML for permanent backups.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="px-6 py-4 border-t border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-950/40 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleDismiss}
            className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm shadow-indigo-600/20 active:scale-98"
          >
            <Check className="w-4 h-4" />
            <span>I Understand</span>
          </button>
        </div>
      </div>
    </div>
  );
};
