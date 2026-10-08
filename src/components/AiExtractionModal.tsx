// src/components/AiExtractionModal.tsx - Multi-Template AI Extraction Modal
import React, { useState } from 'react';
import {
  X,
  Sparkles,
  BookOpen,
  Users,
  Layers,
  Briefcase,
  Copy,
  Check,
  BookmarkPlus,
  Loader2,
  FileText,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  ListTodo,
  TrendingUp,
  Tag,
  ArrowRight,
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

interface AiExtractionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSession: Session | null;
  onAddNote: (content: string, timestamp: number, calloutType: CalloutType) => void;
  onRefreshSession?: () => void;
}

export const AiExtractionModal: React.FC<AiExtractionModalProps> = ({
  isOpen,
  onClose,
  currentSession,
  onAddNote,
  onRefreshSession,
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<ExtractionTemplate>('lecture');
  const [customPrompt, setCustomPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [result, setResult] = useState<ExtractionOutput | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [savedSection, setSavedSection] = useState<string | null>(null);

  if (!isOpen) return null;

  const templates: {
    id: ExtractionTemplate;
    label: string;
    icon: React.ElementType;
    description: string;
    color: string;
  }[] = [
    {
      id: 'lecture',
      label: 'Lecture Study Guide',
      icon: BookOpen,
      description: 'Study Notes, Concept Definitions, Exam Topics & Questions',
      color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800',
    },
    {
      id: 'meeting',
      label: 'Meeting Brief',
      icon: Users,
      description: 'Decisions Made, Action Items Checklist, Discussions & Blockers',
      color: 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800',
    },
    {
      id: 'flashcards',
      label: 'Study Flashcards',
      icon: Layers,
      description: 'Concept-based Q&A revision cards extracted from speech',
      color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
    },
    {
      id: 'executive',
      label: 'Executive Summary',
      icon: Briefcase,
      description: '3-bullet Brief, Numerical Data Points & Key Takeaway',
      color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
    },
  ];

  const handleRunExtraction = async () => {
    if (!currentSession?.transcript) return;
    setLoading(true);
    setProgressMsg('Initiating AI extraction engine...');

    try {
      const output = await aiService.extractTemplate({
        template: selectedTemplate,
        transcript: currentSession.transcript,
        sessionTitle: currentSession.title,
        customPrompt: customPrompt.trim() || undefined,
        onProgress: (msg) => setProgressMsg(msg),
      });
      setResult(output);
    } catch (err) {
      console.error('AI Extraction failed:', err);
      setProgressMsg(err instanceof Error ? err.message : 'Extraction failed.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, sectionKey: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedSection(sectionKey);
      setTimeout(() => setCopiedSection(null), 2000);
    });
  };

  const notifySaved = (sectionKey: string) => {
    setSavedSection(sectionKey);
    setTimeout(() => setSavedSection(null), 2500);
    if (onRefreshSession) onRefreshSession();
  };

  // Convert sections to markdown and save to notes handlers
  const handleSaveLectureSection = (
    type: 'studyNotes' | 'keyConcepts' | 'examTopics' | 'questions' | 'all',
    data: LectureResult
  ) => {
    if (type === 'studyNotes' || type === 'all') {
      data.studyNotes.forEach((note, idx) => {
        onAddNote(note, Math.max(0, idx * 5), 'key_point');
      });
    }
    if (type === 'keyConcepts' || type === 'all') {
      data.keyConcepts.forEach((c, idx) => {
        onAddNote(`**${c.term}**: ${c.definition}`, Math.max(0, idx * 5 + 2), 'key_point');
      });
    }
    if (type === 'examTopics' || type === 'all') {
      data.examTopics.forEach((topic, idx) => {
        onAddNote(`🎯 Exam Topic: ${topic}`, Math.max(0, idx * 5 + 4), 'key_point');
      });
    }
    if (type === 'questions' || type === 'all') {
      data.unansweredQuestions.forEach((q, idx) => {
        onAddNote(`❓ Study Question: ${q}`, Math.max(0, idx * 5 + 6), 'question_to_ask');
      });
    }
    notifySaved(type);
  };

  const handleSaveMeetingSection = (
    type: 'decisions' | 'actionItems' | 'discussions' | 'blockers' | 'all',
    data: MeetingResult
  ) => {
    if (type === 'decisions' || type === 'all') {
      data.decisionsMade.forEach((d, idx) => {
        onAddNote(`✅ Decision: ${d}`, Math.max(0, idx * 5), 'key_point');
      });
    }
    if (type === 'actionItems' || type === 'all') {
      data.actionItems.forEach((item, idx) => {
        const ownerTag = item.owner ? ` [@${item.owner}]` : '';
        const deadlineTag = item.deadline ? ` [Due: ${item.deadline}]` : '';
        onAddNote(`[Action Item] ${item.task}${ownerTag}${deadlineTag}`, Math.max(0, idx * 5 + 2), 'task');
      });
    }
    if (type === 'discussions' || type === 'all') {
      data.keyDiscussions.forEach((disc, idx) => {
        onAddNote(`💬 Discussion: ${disc}`, Math.max(0, idx * 5 + 4), 'key_point');
      });
    }
    if (type === 'blockers' || type === 'all') {
      data.blockers.forEach((b, idx) => {
        onAddNote(`⚠️ Blocker: ${b}`, Math.max(0, idx * 5 + 6), 'task');
      });
    }
    notifySaved(type);
  };

  const handleSaveFlashcards = (data: FlashcardsResult) => {
    data.cards.forEach((card, idx) => {
      onAddNote(`🃏 Q: ${card.question}\nA: ${card.answer}`, Math.max(0, idx * 5), 'question_to_ask');
    });
    notifySaved('flashcards');
  };

  const handleSaveExecutive = (data: ExecutiveResult) => {
    onAddNote(`📌 Executive Key Takeaway: ${data.keyTakeaway}`, 0, 'key_point');
    data.executiveSummary.forEach((point, idx) => {
      onAddNote(`• ${point}`, (idx + 1) * 3, 'key_point');
    });
    data.numericalDataPoints.forEach((point, idx) => {
      onAddNote(`📊 Data Point: ${point}`, (idx + 4) * 3, 'key_point');
    });
    notifySaved('executive');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-stone-800 bg-slate-50/50 dark:bg-stone-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-indigo-500 to-sky-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Multi-Template AI Extraction
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                  v2.0
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Extract rich, structured study and work takeaways from session transcript
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Transcript Alert */}
          {!currentSession?.transcript ? (
            <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold">No transcript found for this session</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  Please transcribe the audio first using the speech-to-text engine before extracting structured takeaways.
                </p>
              </div>
            </div>
          ) : null}

          {/* Template Selection Pills */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Select Extraction Template
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {templates.map((tpl) => {
                const isSelected = selectedTemplate === tpl.id;
                const Icon = tpl.icon;
                return (
                  <button
                    key={tpl.id}
                    onClick={() => setSelectedTemplate(tpl.id)}
                    className={`flex flex-col text-left p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/30 shadow-xs'
                        : 'border-slate-200 dark:border-stone-800 hover:border-slate-300 dark:hover:border-stone-700 bg-white dark:bg-stone-900/40'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1.5">
                      <div className={`p-1.5 rounded-lg border ${tpl.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      {isSelected && (
                        <div className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                      )}
                    </div>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {tpl.label}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-tight line-clamp-2">
                      {tpl.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Prompt Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Custom Instructions <span className="font-normal text-slate-400">(Optional)</span>
              </label>
              <span className="text-[11px] text-slate-400">e.g. Focus on software architecture or key dates</span>
            </div>
            <input
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g. Focus exclusively on technical architecture and blockers..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-stone-800 bg-slate-50 dark:bg-stone-950/50 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Action Trigger */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {currentSession?.transcript
                ? `Ready to extract from ${(currentSession.transcript.split(/\s+/).length)} words`
                : 'Session transcript needed'}
            </span>
            <button
              onClick={handleRunExtraction}
              disabled={loading || !currentSession?.transcript}
              className="px-5 py-2.5 rounded-xl bg-linear-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 disabled:opacity-50 text-white text-sm font-semibold shadow-md shadow-indigo-600/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Extracting...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Run Structured Extraction</span>
                </>
              )}
            </button>
          </div>

          {/* Progress or status */}
          {loading && (
            <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20 flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 animate-spin" />
              <span className="text-sm text-indigo-900 dark:text-indigo-200 font-medium">
                {progressMsg || 'Processing AI extraction...'}
              </span>
            </div>
          )}

          {/* Results Visual Renderers */}
          {result && (
            <div className="space-y-6 pt-4 border-t border-slate-200 dark:border-stone-800">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Extraction Results
                </h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-stone-800 font-semibold text-slate-600 dark:text-slate-300 capitalize">
                  Template: {result.template}
                </span>
              </div>

              {/* LECTURE RENDERER */}
              {result.template === 'lecture' && (
                <div className="space-y-4">
                  {/* Comprehensive Study Notes */}
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4" /> Comprehensive Study Notes
                      </h4>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            const md = result.studyNotes.map((n) => `• ${n}`).join('\n');
                            copyToClipboard(md, 'lecture-notes');
                          }}
                          className="px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-stone-700 bg-slate-50 dark:bg-stone-800 hover:bg-slate-100 dark:hover:bg-stone-700 text-slate-700 dark:text-slate-300 flex items-center gap-1"
                        >
                          {copiedSection === 'lecture-notes' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                          Copy Markdown
                        </button>
                        <button
                          onClick={() => handleSaveLectureSection('studyNotes', result)}
                          className="px-2 py-1 text-xs rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 flex items-center gap-1 font-medium"
                        >
                          {savedSection === 'studyNotes' ? <Check className="w-3 h-3" /> : <BookmarkPlus className="w-3 h-3" />}
                          Save to Notes
                        </button>
                      </div>
                    </div>
                    <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                      {result.studyNotes.map((note, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 shrink-0" />
                          <span>{note}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Key Concepts & Definitions */}
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                        <Tag className="w-4 h-4" /> Key Concepts & Definitions
                      </h4>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            const md = result.keyConcepts.map((c) => `**${c.term}**: ${c.definition}`).join('\n');
                            copyToClipboard(md, 'lecture-concepts');
                          }}
                          className="px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-stone-700 bg-slate-50 dark:bg-stone-800 text-slate-700 dark:text-slate-300 flex items-center gap-1"
                        >
                          {copiedSection === 'lecture-concepts' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                          Copy Markdown
                        </button>
                        <button
                          onClick={() => handleSaveLectureSection('keyConcepts', result)}
                          className="px-2 py-1 text-xs rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 hover:bg-sky-100 flex items-center gap-1 font-medium"
                        >
                          {savedSection === 'keyConcepts' ? <Check className="w-3 h-3" /> : <BookmarkPlus className="w-3 h-3" />}
                          Save to Notes
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {result.keyConcepts.map((concept, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-lg border border-sky-100 dark:border-sky-950 bg-sky-50/40 dark:bg-sky-950/20 space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-sky-800 dark:text-sky-300">
                              {concept.term}
                            </span>
                            {concept.contextRef && (
                              <span className="text-[10px] text-slate-400">{concept.contextRef}</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-300">{concept.definition}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Exam Topics & Unanswered Questions */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Exam Topics */}
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                          <TrendingUp className="w-4 h-4" /> Exam Topics
                        </h4>
                        <button
                          onClick={() => handleSaveLectureSection('examTopics', result)}
                          className="px-2 py-1 text-xs rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 hover:bg-amber-100 flex items-center gap-1 font-medium"
                        >
                          {savedSection === 'examTopics' ? <Check className="w-3 h-3" /> : <BookmarkPlus className="w-3 h-3" />}
                          Save
                        </button>
                      </div>
                      <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                        {result.examTopics.map((topic, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="px-1.5 py-0.5 rounded-sm bg-amber-100 dark:bg-amber-900/50 text-[10px] font-bold text-amber-700 dark:text-amber-300 shrink-0">
                              YIELD
                            </span>
                            <span>{topic}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Unanswered Questions */}
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                          <HelpCircle className="w-4 h-4" /> Unanswered Questions
                        </h4>
                        <button
                          onClick={() => handleSaveLectureSection('questions', result)}
                          className="px-2 py-1 text-xs rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 hover:bg-purple-100 flex items-center gap-1 font-medium"
                        >
                          {savedSection === 'questions' ? <Check className="w-3 h-3" /> : <BookmarkPlus className="w-3 h-3" />}
                          Save
                        </button>
                      </div>
                      <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                        {result.unansweredQuestions.map((q, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <HelpCircle className="w-3.5 h-3.5 text-purple-500 mt-0.5 shrink-0" />
                            <span>{q}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* MEETING RENDERER */}
              {result.template === 'meeting' && (
                <div className="space-y-4">
                  {/* Decisions Made */}
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" /> Decisions Made
                      </h4>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            const md = result.decisionsMade.map((d) => `• [Decision] ${d}`).join('\n');
                            copyToClipboard(md, 'meeting-decisions');
                          }}
                          className="px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-stone-700 bg-slate-50 dark:bg-stone-800 text-slate-700 dark:text-slate-300 flex items-center gap-1"
                        >
                          {copiedSection === 'meeting-decisions' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                          Copy Markdown
                        </button>
                        <button
                          onClick={() => handleSaveMeetingSection('decisions', result)}
                          className="px-2 py-1 text-xs rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 flex items-center gap-1 font-medium"
                        >
                          {savedSection === 'decisions' ? <Check className="w-3 h-3" /> : <BookmarkPlus className="w-3 h-3" />}
                          Save to Notes
                        </button>
                      </div>
                    </div>
                    <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                      {result.decisionsMade.map((decision, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                          <span className="font-medium">{decision}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Action Items Checklist */}
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                        <ListTodo className="w-4 h-4" /> Action Items & Next Steps
                      </h4>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            const md = result.actionItems
                              .map((a) => `- [ ] ${a.task} (Owner: ${a.owner || 'Team'}, Due: ${a.deadline || 'ASAP'})`)
                              .join('\n');
                            copyToClipboard(md, 'meeting-actions');
                          }}
                          className="px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-stone-700 bg-slate-50 dark:bg-stone-800 text-slate-700 dark:text-slate-300 flex items-center gap-1"
                        >
                          {copiedSection === 'meeting-actions' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                          Copy Checklist
                        </button>
                        <button
                          onClick={() => handleSaveMeetingSection('actionItems', result)}
                          className="px-2 py-1 text-xs rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 hover:bg-sky-100 flex items-center gap-1 font-medium"
                        >
                          {savedSection === 'actionItems' ? <Check className="w-3 h-3" /> : <BookmarkPlus className="w-3 h-3" />}
                          Save to Notes
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {result.actionItems.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-lg border border-slate-200 dark:border-stone-800 bg-slate-50/50 dark:bg-stone-950/30 flex items-start justify-between gap-3"
                        >
                          <div className="flex items-start gap-2.5">
                            <input
                              type="checkbox"
                              defaultChecked={false}
                              className="mt-1 rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm text-slate-800 dark:text-slate-200">{item.task}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {item.owner && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                                @{item.owner}
                              </span>
                            )}
                            {item.deadline && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200 dark:bg-stone-800 text-slate-700 dark:text-slate-300">
                                {item.deadline}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Discussions & Blockers */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                        <Users className="w-4 h-4" /> Key Discussions
                      </h4>
                      <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                        {result.keyDiscussions.map((disc, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                            <span>{disc}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-950 bg-rose-50/30 dark:bg-rose-950/20 space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4" /> Blockers & Bottlenecks
                      </h4>
                      <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                        {result.blockers.map((b, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="px-1.5 py-0.5 rounded-sm bg-rose-100 dark:bg-rose-900/50 text-[10px] font-bold text-rose-700 dark:text-rose-300 shrink-0">
                              BLOCKER
                            </span>
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* FLASHCARDS RENDERER */}
              {result.template === 'flashcards' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      {result.cards.length} Revision Flashcards Extracted
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const md = result.cards
                            .map((c, i) => `### Card ${i + 1} (${c.category || 'General'})\n**Q**: ${c.question}\n**A**: ${c.answer}\n`)
                            .join('\n');
                          copyToClipboard(md, 'flashcards-md');
                        }}
                        className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-stone-700 bg-slate-50 dark:bg-stone-800 text-slate-700 dark:text-slate-300 flex items-center gap-1"
                      >
                        {copiedSection === 'flashcards-md' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        Copy Markdown
                      </button>
                      <button
                        onClick={() => handleSaveFlashcards(result)}
                        className="px-2.5 py-1 text-xs rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 flex items-center gap-1 font-semibold"
                      >
                        {savedSection === 'flashcards' ? <Check className="w-3 h-3" /> : <BookmarkPlus className="w-3 h-3" />}
                        Save All to Notes
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {result.cards.map((card, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl border border-slate-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 shadow-2xs space-y-2 hover:border-emerald-300 dark:hover:border-emerald-800 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                            {card.category || `Card ${idx + 1}`}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">#{idx + 1}</span>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white mb-1">
                            {card.question}
                          </p>
                          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-stone-950/50 border border-slate-100 dark:border-stone-800/80">
                            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                              {card.answer}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* EXECUTIVE RENDERER */}
              {result.template === 'executive' && (
                <div className="space-y-4">
                  {/* Single Key Takeaway Highlight */}
                  <div className="p-5 rounded-xl border border-amber-300 dark:border-amber-800 bg-linear-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 space-y-2 shadow-xs">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-700 dark:text-amber-300">
                      Primary Bottom-Line Takeaway
                    </span>
                    <p className="text-base font-bold text-slate-900 dark:text-white leading-snug">
                      "{result.keyTakeaway}"
                    </p>
                  </div>

                  {/* 3-Bullet Executive Summary */}
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Briefcase className="w-4 h-4 text-amber-500" /> 3-Bullet Executive Summary
                      </h4>
                      <button
                        onClick={() => {
                          const md = [
                            `### Key Takeaway\n${result.keyTakeaway}\n`,
                            `### Executive Summary\n${result.executiveSummary.map((b) => `• ${b}`).join('\n')}\n`,
                            `### Numerical & Data Points\n${result.numericalDataPoints.map((n) => `• ${n}`).join('\n')}`,
                          ].join('\n');
                          copyToClipboard(md, 'exec-md');
                        }}
                        className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-stone-700 bg-slate-50 dark:bg-stone-800 text-slate-700 dark:text-slate-300 flex items-center gap-1"
                      >
                        {copiedSection === 'exec-md' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        Copy Markdown
                      </button>
                    </div>
                    <div className="space-y-2.5">
                      {result.executiveSummary.map((bullet, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-stone-950/40 border border-slate-100 dark:border-stone-800/80"
                        >
                          <span className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <span className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                            {bullet}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Major Numerical & Data Points */}
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4" /> Major Numerical & Data Points
                      </h4>
                      <button
                        onClick={() => handleSaveExecutive(result)}
                        className="px-2.5 py-1 text-xs rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 hover:bg-amber-100 flex items-center gap-1 font-semibold"
                      >
                        {savedSection === 'executive' ? <Check className="w-3 h-3" /> : <BookmarkPlus className="w-3 h-3" />}
                        Save All to Notes
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {result.numericalDataPoints.map((point, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-lg bg-sky-50/40 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-950 text-xs text-slate-700 dark:text-slate-300 font-mono"
                        >
                          {point}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-stone-800 bg-slate-50/50 dark:bg-stone-900/50">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {result ? 'Structured takeaways extracted' : 'Choose a template above to begin'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-stone-700 bg-white dark:bg-stone-800 hover:bg-slate-100 dark:hover:bg-stone-700 text-sm font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
