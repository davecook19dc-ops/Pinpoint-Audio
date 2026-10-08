import React, { useState } from 'react';
import {
  Sparkles,
  Loader2,
  Award,
  ListTodo,
  HelpCircle,
  Check,
  Copy,
  BookOpen,
  Users,
  Layers,
  Briefcase,
  BookmarkPlus,
  Maximize2,
  Tag,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { Session, CalloutType } from '../types';
import {
  aiService,
  ExtractionTemplate,
  ExtractionOutput,
  LectureResult,
  MeetingResult,
  FlashcardsResult,
  ExecutiveResult,
} from '../services/aiService';
import { AiExtractionModal } from './AiExtractionModal';

interface KeyPointsPanelProps {
  currentSession: Session | null;
  onAddNote: (
    content: string,
    timestamp: number,
    calloutType: CalloutType
  ) => void;
  onRefreshSession?: () => void;
}

export const KeyPointsPanel: React.FC<KeyPointsPanelProps> = ({
  currentSession,
  onAddNote,
  onRefreshSession,
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<ExtractionTemplate>('lecture');
  const [customPrompt, setCustomPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [result, setResult] = useState<ExtractionOutput | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const templates: {
    id: ExtractionTemplate;
    label: string;
    icon: React.ElementType;
    badge: string;
  }[] = [
    { id: 'lecture', label: 'Lecture', icon: BookOpen, badge: 'Study Notes & Concepts' },
    { id: 'meeting', label: 'Meeting', icon: Users, badge: 'Decisions & Tasks' },
    { id: 'flashcards', label: 'Flashcards', icon: Layers, badge: 'Q&A Cards' },
    { id: 'executive', label: 'Executive', icon: Briefcase, badge: '3 Bullets & Data' },
  ];

  const handleExtract = async () => {
    if (!currentSession || !currentSession.transcript) return;

    setLoading(true);
    setProgressMessage(`Extracting structured ${selectedTemplate} takeaways...`);

    try {
      const output = await aiService.extractTemplate({
        template: selectedTemplate,
        transcript: currentSession.transcript,
        sessionTitle: currentSession.title,
        customPrompt: customPrompt.trim() || undefined,
        onProgress: (msg) => setProgressMessage(msg),
      });

      setResult(output);
    } catch (err) {
      console.error('Study takeaways generation error:', err);
    } finally {
      setLoading(false);
      setProgressMessage('');
    }
  };

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    });
  };

  const markSaved = (key: string) => {
    setSavedKey(key);
    setTimeout(() => setSavedKey(null), 2000);
    if (onRefreshSession) onRefreshSession();
  };

  if (!currentSession) {
    return (
      <div className="p-6 text-center text-stone-500 dark:text-stone-400">
        Please load or record a lecture session to generate study guides.
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-stone-200 dark:border-stone-800 p-5 bg-white/60 dark:bg-stone-900/40 backdrop-blur-md shadow-2xs space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Sparkles className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-stone-900 dark:text-white leading-none">
                AI Knowledge Extraction
              </h4>
              <p className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5">
                Multi-template structured takeaway engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsModalOpen(true)}
              className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 transition-colors cursor-pointer"
              title="Open full extraction dialog"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Main Body */}
        {!currentSession.transcript ? (
          <div className="text-center py-4 bg-stone-50 dark:bg-stone-950/20 rounded-xl border border-dashed border-stone-200 dark:border-stone-800 p-4">
            <HelpCircle className="w-8 h-8 text-stone-400 mx-auto mb-2" />
            <p className="text-xs text-stone-600 dark:text-stone-400">
              You must transcribe the session audio before extracting AI Study Takeaways.
            </p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {/* Template Selector Pills */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                Extraction Mode
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {templates.map((tpl) => {
                  const isSelected = selectedTemplate === tpl.id;
                  const Icon = tpl.icon;
                  return (
                    <button
                      key={tpl.id}
                      onClick={() => setSelectedTemplate(tpl.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 shadow-2xs'
                          : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 text-stone-600 dark:text-stone-400 hover:border-stone-300'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{tpl.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Prompt Input */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Custom instruction (optional, e.g. focus on key dates)..."
                className="flex-1 px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950/50 text-xs text-stone-900 dark:text-white placeholder:text-stone-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
              <button
                onClick={handleExtract}
                disabled={loading}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-xs transition-all shrink-0 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Extracting...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Extract</span>
                  </>
                )}
              </button>
            </div>

            {/* Progress Bar */}
            {loading && (
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl flex items-center gap-2 text-xs text-indigo-700 dark:text-indigo-300">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>{progressMessage || 'Processing extraction...'}</span>
              </div>
            )}

            {/* Results Renderers */}
            {result && !loading && (
              <div className="space-y-3 pt-2">
                {/* LECTURE MODE RESULTS */}
                {result.template === 'lecture' && (
                  <div className="space-y-3">
                    {/* Key Concepts Chips */}
                    <div className="p-3 rounded-xl border border-sky-100 dark:border-sky-950 bg-sky-50/30 dark:bg-sky-950/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-sky-800 dark:text-sky-300 flex items-center gap-1">
                          <Tag className="w-3.5 h-3.5" /> Key Concepts & Definitions
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              const md = result.keyConcepts.map((c) => `**${c.term}**: ${c.definition}`).join('\n');
                              copyText(md, 'kc');
                            }}
                            className="text-[10px] px-1.5 py-0.5 rounded border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 flex items-center gap-1"
                          >
                            {copiedKey === 'kc' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                            Copy
                          </button>
                          <button
                            onClick={() => {
                              result.keyConcepts.forEach((c, i) => onAddNote(`**${c.term}**: ${c.definition}`, i * 4, 'key_point'));
                              markSaved('kc');
                            }}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 flex items-center gap-1 font-medium"
                          >
                            {savedKey === 'kc' ? <Check className="w-3 h-3" /> : <BookmarkPlus className="w-3 h-3" />}
                            Save
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {result.keyConcepts.map((c, i) => (
                          <div
                            key={i}
                            className="px-2 py-1 rounded-md bg-white dark:bg-stone-900 border border-sky-200 dark:border-sky-800 text-xs"
                          >
                            <span className="font-bold text-sky-900 dark:text-sky-200">{c.term}: </span>
                            <span className="text-stone-600 dark:text-stone-300">{c.definition}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Study Notes */}
                    <div className="p-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1">
                          <BookOpen className="w-3.5 h-3.5 text-indigo-500" /> Study Notes
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              const md = result.studyNotes.map((n) => `• ${n}`).join('\n');
                              copyText(md, 'sn');
                            }}
                            className="text-[10px] px-1.5 py-0.5 rounded border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 flex items-center gap-1"
                          >
                            {copiedKey === 'sn' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                            Copy
                          </button>
                          <button
                            onClick={() => {
                              result.studyNotes.forEach((n, i) => onAddNote(n, i * 4, 'key_point'));
                              markSaved('sn');
                            }}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 flex items-center gap-1 font-medium"
                          >
                            {savedKey === 'sn' ? <Check className="w-3 h-3" /> : <BookmarkPlus className="w-3 h-3" />}
                            Save
                          </button>
                        </div>
                      </div>
                      <ul className="space-y-1 text-xs text-stone-700 dark:text-stone-300 list-disc pl-4">
                        {result.studyNotes.map((note, i) => (
                          <li key={i}>{note}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* MEETING MODE RESULTS */}
                {result.template === 'meeting' && (
                  <div className="space-y-3">
                    {/* Action Items Checklist */}
                    <div className="p-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-sky-700 dark:text-sky-300 flex items-center gap-1">
                          <ListTodo className="w-3.5 h-3.5" /> Action Items Checklist
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              const md = result.actionItems
                                .map((a) => `- [ ] ${a.task} (@${a.owner || 'Team'})`)
                                .join('\n');
                              copyText(md, 'ai');
                            }}
                            className="text-[10px] px-1.5 py-0.5 rounded border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 flex items-center gap-1"
                          >
                            {copiedKey === 'ai' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                            Copy
                          </button>
                          <button
                            onClick={() => {
                              result.actionItems.forEach((a, i) => onAddNote(`[Task] ${a.task} (@${a.owner || 'Team'})`, i * 4, 'task'));
                              markSaved('ai');
                            }}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 flex items-center gap-1 font-medium"
                          >
                            {savedKey === 'ai' ? <Check className="w-3 h-3" /> : <BookmarkPlus className="w-3 h-3" />}
                            Save
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        {result.actionItems.map((item, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between gap-2 p-2 rounded-lg bg-stone-50 dark:bg-stone-950/40 border border-stone-100 dark:border-stone-800 text-xs"
                          >
                            <span className="text-stone-800 dark:text-stone-200 font-medium">
                              ☐ {item.task}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 shrink-0">
                              @{item.owner || 'Team'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Decisions Made */}
                    <div className="p-3 rounded-xl border border-emerald-100 dark:border-emerald-950 bg-emerald-50/30 dark:bg-emerald-950/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Decisions Made
                        </span>
                        <button
                          onClick={() => {
                            result.decisionsMade.forEach((d, i) => onAddNote(`✅ ${d}`, i * 4, 'key_point'));
                            markSaved('dm');
                          }}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 flex items-center gap-1 font-medium"
                        >
                          {savedKey === 'dm' ? <Check className="w-3 h-3" /> : <BookmarkPlus className="w-3 h-3" />}
                          Save
                        </button>
                      </div>
                      <ul className="space-y-1 text-xs text-stone-700 dark:text-stone-300">
                        {result.decisionsMade.map((d, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-emerald-500 font-bold">✓</span>
                            <span>{d}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* FLASHCARDS RESULTS */}
                {result.template === 'flashcards' && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5" /> {result.cards.length} Revision Flashcards
                      </span>
                      <button
                        onClick={() => {
                          result.cards.forEach((c, i) => onAddNote(`🃏 Q: ${c.question}\nA: ${c.answer}`, i * 4, 'question_to_ask'));
                          markSaved('fc');
                        }}
                        className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 flex items-center gap-1 font-medium"
                      >
                        {savedKey === 'fc' ? <Check className="w-3 h-3" /> : <BookmarkPlus className="w-3 h-3" />}
                        Save All Cards
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {result.cards.slice(0, 4).map((c, i) => (
                        <div
                          key={i}
                          className="p-2.5 rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 text-xs space-y-1"
                        >
                          <span className="font-bold text-stone-900 dark:text-white block">Q: {c.question}</span>
                          <span className="text-stone-600 dark:text-stone-400 block text-[11px]">A: {c.answer}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* EXECUTIVE RESULTS */}
                {result.template === 'executive' && (
                  <div className="space-y-2.5">
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                      <span className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-300">
                        Bottom Line:
                      </span>
                      <p className="text-xs font-bold text-stone-900 dark:text-white mt-0.5">
                        {result.keyTakeaway}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-stone-800 dark:text-stone-200">
                          3-Bullet Executive Summary
                        </span>
                        <button
                          onClick={() => {
                            onAddNote(`📌 ${result.keyTakeaway}`, 0, 'key_point');
                            result.executiveSummary.forEach((b, i) => onAddNote(`• ${b}`, (i + 1) * 3, 'key_point'));
                            markSaved('ex');
                          }}
                          className="text-[10px] px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 flex items-center gap-1 font-medium"
                        >
                          {savedKey === 'ex' ? <Check className="w-3 h-3" /> : <BookmarkPlus className="w-3 h-3" />}
                          Save to Notes
                        </button>
                      </div>
                      <ul className="space-y-1 text-xs text-stone-700 dark:text-stone-300 list-disc pl-4">
                        {result.executiveSummary.map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Full Modal for Deep Extraction */}
      <AiExtractionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentSession={currentSession}
        onAddNote={onAddNote}
        onRefreshSession={onRefreshSession}
      />
    </>
  );
};
