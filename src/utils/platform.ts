// src/utils/platform.ts - OS Platform Detection for Keyboard Shortcuts

export const isApplePlatform =
  typeof navigator !== 'undefined' &&
  (navigator.platform?.startsWith('Mac') ||
    navigator.platform === 'iPhone' ||
    navigator.platform === 'iPad' ||
    navigator.platform === 'iPod' ||
    /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent || ''));

export const modifierKey = isApplePlatform ? '⌘' : 'Ctrl';

export const getModifierKey = (): string => modifierKey;

export const isModifierPressed = (e: KeyboardEvent | React.KeyboardEvent): boolean => {
  return isApplePlatform ? e.metaKey : e.ctrlKey;
};
