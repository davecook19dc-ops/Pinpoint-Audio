import React from 'react';
import {
  X,
  Eye,
  Sun,
  Moon,
  Palette,
  Check,
  Type,
  Maximize2,
  Sliders,
  Sparkles,
  Contrast,
  Gauge,
  RotateCcw,
} from 'lucide-react';
import { AppSettings, ReadingFont, ThemeMode } from '../types';

interface AccessibilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
}

export const AccessibilityModal: React.FC<AccessibilityModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  if (!isOpen) return null;

  const currentTheme = settings.theme || 'light';
  // Map fontMode to readingFont if readingFont not yet set
  const currentFont: ReadingFont =
    settings.readingFont || (settings.fontMode === 'dyslexic' ? 'dyslexic' : 'sans');
  const uiScale = settings.uiScale || 100;
  const highContrast = !!settings.highContrast;
  const reducedMotion = !!settings.reducedMotion;

  const handleFontChange = (font: ReadingFont) => {
    onUpdateSettings({
      readingFont: font,
      fontMode: font === 'dyslexic' ? 'dyslexic' : 'standard',
    });
  };

  const handleResetDefaults = () => {
    onUpdateSettings({
      theme: 'light',
      fontMode: 'standard',
      readingFont: 'sans',
      uiScale: 100,
      highContrast: false,
      reducedMotion: false,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-stone-900 rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-stone-100 dark:border-stone-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200/80 dark:border-indigo-800/80 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900 dark:text-white leading-tight">
                Accessibility & Display
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Tailor reading comfort, visual contrast, and typography
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            aria-label="Close accessibility settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* 1. Visual Theme */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-indigo-500" />
                <span>Visual Theme</span>
              </label>
              <span className="text-[11px] font-medium text-stone-400 capitalize">
                {currentTheme} mode
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {/* Light */}
              <button
                type="button"
                onClick={() => onUpdateSettings({ theme: 'light' })}
                className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all text-center cursor-pointer ${
                  currentTheme === 'light'
                    ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 dark:border-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-200 ring-2 ring-indigo-500/20 font-semibold'
                    : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800/50 text-stone-700 dark:text-stone-300'
                }`}
              >
                <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shadow-2xs">
                  <Sun className="w-4 h-4" />
                </div>
                <div className="text-xs">
                  <div className="font-semibold">Light</div>
                  <div className="text-[10px] text-stone-400 dark:text-stone-500">Daytime clarity</div>
                </div>
                {currentTheme === 'light' && (
                  <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                )}
              </button>

              {/* Dark */}
              <button
                type="button"
                onClick={() => onUpdateSettings({ theme: 'dark' })}
                className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all text-center cursor-pointer ${
                  currentTheme === 'dark'
                    ? 'border-indigo-500 bg-indigo-950/50 text-indigo-100 ring-2 ring-indigo-500/30 font-semibold'
                    : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800/50 text-stone-700 dark:text-stone-300'
                }`}
              >
                <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center text-indigo-300 shadow-2xs">
                  <Moon className="w-4 h-4" />
                </div>
                <div className="text-xs">
                  <div className="font-semibold">Dark</div>
                  <div className="text-[10px] text-stone-400 dark:text-stone-500">Low eye strain</div>
                </div>
                {currentTheme === 'dark' && (
                  <Check className="w-3.5 h-3.5 text-indigo-400" />
                )}
              </button>

              {/* Sepia */}
              <button
                type="button"
                onClick={() => onUpdateSettings({ theme: 'sepia' })}
                className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all text-center cursor-pointer ${
                  currentTheme === 'sepia'
                    ? 'border-amber-700 bg-amber-100/70 text-amber-950 ring-2 ring-amber-600/30 font-semibold'
                    : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800/50 text-stone-700 dark:text-stone-300'
                }`}
              >
                <div className="w-8 h-8 rounded-xl bg-[#e5dac1] flex items-center justify-center text-amber-800 shadow-2xs">
                  <Palette className="w-4 h-4" />
                </div>
                <div className="text-xs">
                  <div className="font-semibold">Sepia</div>
                  <div className="text-[10px] text-stone-500">Warm paper tone</div>
                </div>
                {currentTheme === 'sepia' && (
                  <Check className="w-3.5 h-3.5 text-amber-800" />
                )}
              </button>
            </div>
          </div>

          {/* 2. Typography / Reading Font */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5 text-indigo-500" />
                <span>Typography / Reading Font</span>
              </label>
              <span className="text-[11px] font-medium text-stone-400 uppercase">
                {currentFont}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Sans */}
              <button
                type="button"
                onClick={() => handleFontChange('sans')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  currentFont === 'sans'
                    ? 'border-indigo-600 bg-indigo-50/50 dark:border-indigo-500 dark:bg-indigo-950/30'
                    : 'border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 bg-stone-50/40 dark:bg-stone-800/30'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-stone-900 dark:text-white">Sans-Serif</span>
                  {currentFont === 'sans' && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                </div>
                <div className="text-sm font-sans text-stone-600 dark:text-stone-300 truncate">
                  Clean & Modern (Plus Jakarta)
                </div>
                <div className="text-[11px] text-stone-400 mt-1 font-sans">
                  The quick brown fox jumps over the lazy dog.
                </div>
              </button>

              {/* Serif */}
              <button
                type="button"
                onClick={() => handleFontChange('serif')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  currentFont === 'serif'
                    ? 'border-indigo-600 bg-indigo-50/50 dark:border-indigo-500 dark:bg-indigo-950/30'
                    : 'border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 bg-stone-50/40 dark:bg-stone-800/30'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-stone-900 dark:text-white">Editorial Serif</span>
                  {currentFont === 'serif' && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                </div>
                <div className="text-sm font-serif text-stone-600 dark:text-stone-300 truncate">
                  Classic Book (Georgia)
                </div>
                <div className="text-[11px] text-stone-400 mt-1 font-serif">
                  The quick brown fox jumps over the lazy dog.
                </div>
              </button>

              {/* Mono */}
              <button
                type="button"
                onClick={() => handleFontChange('mono')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  currentFont === 'mono'
                    ? 'border-indigo-600 bg-indigo-50/50 dark:border-indigo-500 dark:bg-indigo-950/30'
                    : 'border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 bg-stone-50/40 dark:bg-stone-800/30'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-stone-900 dark:text-white">Monospace</span>
                  {currentFont === 'mono' && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                </div>
                <div className="text-sm font-mono text-stone-600 dark:text-stone-300 truncate">
                  Technical Code (JetBrains)
                </div>
                <div className="text-[11px] text-stone-400 mt-1 font-mono">
                  The quick brown fox jumps 01234.
                </div>
              </button>

              {/* OpenDyslexic */}
              <button
                type="button"
                onClick={() => handleFontChange('dyslexic')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  currentFont === 'dyslexic'
                    ? 'border-indigo-600 bg-indigo-50/50 dark:border-indigo-500 dark:bg-indigo-950/30 ring-1 ring-indigo-500'
                    : 'border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 bg-stone-50/40 dark:bg-stone-800/30'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-stone-900 dark:text-white">OpenDyslexic</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200 font-semibold">
                      A11y
                    </span>
                  </div>
                  {currentFont === 'dyslexic' && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                </div>
                <div className="text-sm font-dyslexic text-stone-600 dark:text-stone-300 truncate">
                  Weighted Bottoms
                </div>
                <div className="text-[11px] text-stone-400 mt-1 font-dyslexic">
                  Reduces letter swapping & crowding.
                </div>
              </button>
            </div>
          </div>

          {/* 3. Additional Comfort Controls */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 flex items-center gap-1.5 mb-3">
              <Sliders className="w-3.5 h-3.5 text-indigo-500" />
              <span>Comfort & Visual Ergonomics</span>
            </label>

            <div className="space-y-3.5 bg-stone-50 dark:bg-stone-800/40 p-4 rounded-2xl border border-stone-200/70 dark:border-stone-800">
              {/* UI Scale Slider */}
              <div>
                <div className="flex items-center justify-between text-xs font-medium text-stone-700 dark:text-stone-300 mb-2">
                  <span className="flex items-center gap-1.5">
                    <Maximize2 className="w-3.5 h-3.5 text-stone-400" />
                    <span>Interface Scale / Base Font Size</span>
                  </span>
                  <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                    {uiScale}%
                  </span>
                </div>
                <input
                  type="range"
                  min="90"
                  max="125"
                  step="5"
                  value={uiScale}
                  onChange={(e) => onUpdateSettings({ uiScale: Number(e.target.value) })}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-stone-400 mt-1 font-mono">
                  <span>90% (Compact)</span>
                  <span>100% (Standard)</span>
                  <span>125% (Large)</span>
                </div>
              </div>

              <div className="pt-2 border-t border-stone-200 dark:border-stone-700/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Contrast className="w-4 h-4 text-stone-500 dark:text-stone-400" />
                  <div>
                    <div className="text-xs font-semibold text-stone-900 dark:text-white">
                      High-Contrast Borders
                    </div>
                    <div className="text-[10px] text-stone-500 dark:text-stone-400">
                      Strengthens component borders for enhanced visibility
                    </div>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={highContrast}
                    onChange={(e) => onUpdateSettings({ highContrast: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-stone-300 peer-focus:outline-hidden rounded-full peer dark:bg-stone-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600" />
                </label>
              </div>

              <div className="pt-2 border-t border-stone-200 dark:border-stone-700/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-stone-500 dark:text-stone-400" />
                  <div>
                    <div className="text-xs font-semibold text-stone-900 dark:text-white">
                      Reduced Motion
                    </div>
                    <div className="text-[10px] text-stone-500 dark:text-stone-400">
                      Disables non-essential animations and transitions
                    </div>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reducedMotion}
                    onChange={(e) => onUpdateSettings({ reducedMotion: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-stone-300 peer-focus:outline-hidden rounded-full peer dark:bg-stone-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600" />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900 shrink-0">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="text-xs text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset to defaults</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
