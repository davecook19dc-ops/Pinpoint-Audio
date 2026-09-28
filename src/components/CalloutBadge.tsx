import React from 'react';
import {
  CheckSquare,
  Sparkles,
  HelpCircle,
  FileText,
} from 'lucide-react';
import { CalloutType } from '../types';

interface CalloutConfig {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  borderClass: string;
  bgClass: string;
  textClass: string;
  badgeBg: string;
}

export const CALLOUT_CONFIGS: Record<CalloutType, CalloutConfig> = {
  note: {
    label: 'Note',
    icon: FileText,
    borderClass: 'border-[#e4ded5] dark:border-stone-800',
    bgClass: 'bg-[#faf8f5] dark:bg-stone-900/90',
    textClass: 'text-stone-900 dark:text-stone-100 font-normal',
    badgeBg: 'bg-[#ebe5da] dark:bg-stone-800 text-stone-900 dark:text-stone-200',
  },
  task: {
    label: 'Task',
    icon: CheckSquare,
    borderClass: 'border-[#b4edd0] dark:border-emerald-800/60',
    bgClass: 'bg-[#eaf8f1] dark:bg-emerald-950/30',
    textClass: 'text-slate-900 dark:text-emerald-100 font-normal',
    badgeBg: 'bg-[#bbf7d0] dark:bg-emerald-900/70 text-slate-900 dark:text-emerald-100 font-semibold',
  },
  key_point: {
    label: 'Key Point',
    icon: Sparkles,
    borderClass: 'border-[#fde68a] dark:border-amber-800/60',
    bgClass: 'bg-[#fffbeb] dark:bg-amber-950/30',
    textClass: 'text-slate-900 dark:text-amber-100 font-normal',
    badgeBg: 'bg-[#fde68a] dark:bg-amber-900/70 text-slate-900 dark:text-amber-100 font-semibold',
  },
  question_to_ask: {
    label: 'Question to Ask',
    icon: HelpCircle,
    borderClass: 'border-[#e9d5ff] dark:border-purple-800/60',
    bgClass: 'bg-[#faf5ff] dark:bg-purple-950/30',
    textClass: 'text-slate-900 dark:text-purple-100 font-normal',
    badgeBg: 'bg-[#e9d5ff] dark:bg-purple-900/70 text-slate-900 dark:text-purple-100 font-semibold',
  },
};

export const CalloutTag: React.FC<{ type: CalloutType; size?: 'sm' | 'md' }> = ({
  type,
  size = 'sm',
}) => {
  const config = CALLOUT_CONFIGS[type] || CALLOUT_CONFIGS.note;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold rounded-md border border-black/5 dark:border-white/10 ${config.badgeBg} ${
        size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-1 text-xs'
      }`}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      <span>{config.label}</span>
    </span>
  );
};
