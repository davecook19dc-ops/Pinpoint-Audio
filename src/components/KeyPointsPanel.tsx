import React, { useState } from 'react';
import { Sparkles, Loader2, Award, ListTodo, HelpCircle, Check, Copy } from 'lucide-react';
import { Session, Note, CalloutType } from '../types';
import { summarizationService, SummarizationProgress } from '../services/summarizationService';

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
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<SummarizationProgress | null>(null);
  const [copied, setCopied] = useState(false);

  // Takeaways are saved inside session or can be kept in state.
  // We'll also support storing generated study takeaways in a local state fallback
  // if they aren't persisted on the Session object yet, or read from currentSession!
  const [localTakeaways, setLocalTakeaways] = useState<{
    keyPoints: string[];
    actionItems: string[];
    studyQuestions: string[];
  } | null>(null);

  const handleExtract = async () => {
    if (!currentSession || !currentSession.transcript) return;

    setLoading(true);
    setProgress({
      stage: 'loading_model',
      percent: 0,
      message: 'Warming up local AI STUDY pipeline...',
    });

    try {
      const takeaways = await summarizationService.generateTakeaways(
        currentSession.transcript,
        (p) => {
          setProgress(p);
        }
      );

      setLocalTakeaways(takeaways);

      // Now, automatically render these into the structured Notes Feed!
      // Add key points
      takeaways.keyPoints.forEach((kp, idx) => {
        onAddNote(kp, Math.max(0, idx * 5), 'key_point');
      });

      // Add action items
      takeaways.actionItems.forEach((ai, idx) => {
        onAddNote(ai, Math.max(0, idx * 5), 'task');
      });

      // Add study questions
      takeaways.studyQuestions.forEach((sq, idx) => {
        onAddNote(sq, Math.max(0, idx * 5), 'question_to_ask');
      });

      if (onRefreshSession) {
        onRefreshSession();
      }
    } catch (err) {
      console.error('Study takeaways generation error:', err);
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const handleCopy = () => {
    const takeaways = localTakeaways;
    if (!takeaways) return;

    const text = [
      `📚 Study Guide for: ${currentSession?.title || 'Active Session'}\n`,
      `✨ KEY POINTS:`,
      ...takeaways.keyPoints.map((kp) => `• ${kp}`),
      `\n✅ ACTION ITEMS:`,
      ...takeaways.actionItems.map((ai) => `• ${ai}`),
      `\n❓ STUDY QUESTIONS:`,
      ...takeaways.studyQuestions.map((sq) => `• ${sq}`),
    ].join('\n');

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!currentSession) {
    return (
      <div className="p-6 text-center text-stone-500 dark:text-stone-400">
        Please load or record a lecture session to generate study guides.
      </div>
    );
  }

  const takeaways = localTakeaways;

  return (
    <div className="rounded-2xl border border-stone-200 dark:border-stone-800 p-5 bg-white/50 dark:bg-stone-900/40 backdrop-blur-md shadow-2xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-stone-900 dark:text-white">
              AI Study Takeaways
            </h4>
            <p className="text-[10px] text-stone-500 dark:text-stone-400 font-mono">
              Offline-first Bart study companion
            </p>
          </div>
        </div>

        {takeaways && (
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 transition-colors cursor-pointer"
            title="Copy study guide"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Main Body */}
      {!currentSession.transcript ? (
        <div className="text-center py-4 bg-stone-50 dark:bg-stone-950/20 rounded-xl border border-dashed border-stone-200 dark:border-stone-800 p-4">
          <HelpCircle className="w-8 h-8 text-stone-400 mx-auto mb-2" />
          <p className="text-xs text-stone-600 dark:text-stone-400">
            You must transcribe the session audio before extracting AI Study Takeaways.
          </p>
        </div>
      ) : loading ? (
        <div className="py-6 space-y-4 text-center">
          <div className="flex justify-center">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-stone-800 dark:text-stone-200">
              {progress?.message || 'Processing study notes...'}
            </p>
            {progress && (
              <div className="w-full max-w-xs mx-auto bg-stone-100 dark:bg-stone-800 rounded-full h-2 overflow-hidden shadow-inner">
                <div
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            )}
            <p className="text-[10px] text-stone-500 dark:text-stone-400 font-mono">
              {progress ? `${progress.percent}% Completed` : 'Starting...'}
            </p>
          </div>
        </div>
      ) : takeaways ? (
        <div className="space-y-3.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>Successfully generated and added study notes to the feed!</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Key Points */}
            <div className="p-3.5 rounded-xl border border-stone-150 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-950/20 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                <Award className="w-3.5 h-3.5" />
                <span>Key Points</span>
              </div>
              <ul className="space-y-1 text-xs text-stone-700 dark:text-stone-300 list-disc pl-4 leading-relaxed">
                {takeaways.keyPoints.map((kp, i) => (
                  <li key={i}>{kp}</li>
                ))}
              </ul>
            </div>

            {/* Action Items */}
            <div className="p-3.5 rounded-xl border border-stone-150 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-950/20 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                <ListTodo className="w-3.5 h-3.5" />
                <span>Action Items</span>
              </div>
              <ul className="space-y-1 text-xs text-stone-700 dark:text-stone-300 list-disc pl-4 leading-relaxed">
                {takeaways.actionItems.map((ai, i) => (
                  <li key={i}>{ai}</li>
                ))}
              </ul>
            </div>

            {/* Study Questions */}
            <div className="p-3.5 rounded-xl border border-stone-150 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-950/20 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-400">
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Study Questions</span>
              </div>
              <ul className="space-y-1 text-xs text-stone-700 dark:text-stone-300 list-disc pl-4 leading-relaxed">
                {takeaways.studyQuestions.map((sq, i) => (
                  <li key={i}>{sq}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-4 text-center">
          <button
            onClick={handleExtract}
            className="py-2.5 px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 mx-auto shadow-md hover:shadow-lg hover:scale-[1.02] transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-300 fill-current" />
            <span>Extract Key Takeaways</span>
          </button>
          <p className="text-[10px] text-stone-500 dark:text-stone-400 mt-2.5 max-w-sm mx-auto">
            Runs a quantized study notes Bart model locally in your web browser. No audio or text leaves your device.
          </p>
        </div>
      )}
    </div>
  );
};
