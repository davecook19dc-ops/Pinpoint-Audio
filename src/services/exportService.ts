import { Note, Session } from '../types';
import { dbService } from './db';
import { formatTime } from '../utils/audio';

/**
 * Generates the raw Markdown string of session notes and transcript without triggering a download.
 */
export function generateMarkdownString(session: Session, notes: Note[]): string {
  let md = `# ${session.title}\n\n`;
  md += `**Date:** ${new Date(session.createdAt).toLocaleDateString()}\n\n`;
  if (notes.length > 0) {
    md += `## Notes\n\n`;
    notes.forEach(n => {
      md += `- [${n.calloutType.toUpperCase()}] **${formatTime(n.timestamp)}**: ${n.content}\n`;
    });
    md += `\n`;
  }
  if (session.transcript) {
    md += `## Transcript\n\n${session.transcript}\n`;
  }
  return md;
}

/**
 * Checks if a session has any exportable content (notes, transcript, or chunks).
 */
export function hasSessionExportableContent(
  session: Session | null | undefined,
  notes: Note[] = []
): boolean {
  if (!session) return false;
  const hasNotes = notes.length > 0;
  const hasTranscript = !!session.transcript && session.transcript.trim().length > 0;
  const hasChunks = !!session.chunks && session.chunks.length > 0;
  return hasNotes || hasTranscript || hasChunks;
}

/**
 * Compiles a session's metadata, AI takeaways, user notes, and transcript into formatted Markdown.
 */
export function compileSessionToMarkdown(session: Session, notes: Note[] = []): string {
  const title = session.title?.trim() || 'Lecture-Notes';
  const recordedDate = session.createdAt ? new Date(session.createdAt) : new Date();
  const dateFormatted = recordedDate.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeFormatted = recordedDate.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const sections: string[] = [];

  // 1. # {Session Title} and Date
  sections.push(`# ${title}\n`);
  sections.push(`*Recorded on ${dateFormatted} at ${timeFormatted}*${session.duration > 0 ? ` • Duration: ${formatTime(session.duration)}` : ''}\n`);

  // 2. ## AI Study Takeaways (loop through Key Points, Action Items, Questions)
  const keyPoints = notes.filter((n) => n.calloutType === 'key_point');
  const actionItems = notes.filter((n) => n.calloutType === 'task');
  const questions = notes.filter((n) => n.calloutType === 'question_to_ask');
  const hasTakeaways = keyPoints.length > 0 || actionItems.length > 0 || questions.length > 0;

  sections.push('## AI Study Takeaways\n');
  if (hasTakeaways) {
    if (keyPoints.length > 0) {
      sections.push('### Key Points\n');
      keyPoints.forEach((kp) => {
        sections.push(`- **[${formatTime(kp.timestamp)}]** ${kp.content.trim()}`);
      });
      sections.push('');
    }

    if (actionItems.length > 0) {
      sections.push('### Action Items\n');
      actionItems.forEach((ai) => {
        const checkbox = ai.completed ? '[x]' : '[ ]';
        const dueStr = ai.dueDate ? ` *(Due: ${new Date(ai.dueDate).toLocaleDateString()})*` : '';
        sections.push(`- ${checkbox} **[${formatTime(ai.timestamp)}]** ${ai.content.trim()}${dueStr}`);
      });
      sections.push('');
    }

    if (questions.length > 0) {
      sections.push('### Questions\n');
      questions.forEach((q) => {
        sections.push(`- **[${formatTime(q.timestamp)}]** ❓ ${q.content.trim()}`);
      });
      sections.push('');
    }
  } else {
    sections.push('*No AI study takeaways generated for this session.*\n');
  }

  // 3. ## My Notes (loop through any manually typed notes)
  const userNotes = notes.filter((n) => n.calloutType === 'note');
  sections.push('## My Notes\n');
  if (userNotes.length > 0) {
    userNotes.forEach((n) => {
      sections.push(`- **[${formatTime(n.timestamp)}]** ${n.content.trim()}`);
    });
    sections.push('');
  } else {
    sections.push('*No manual notes recorded for this session.*\n');
  }

  // 4. ## Full Transcript (loop through the transcript chunks, formatting timestamps as [MM:SS] Text)
  sections.push('## Full Transcript\n');
  if (session.chunks && session.chunks.length > 0) {
    session.chunks.forEach((chunk) => {
      const startSec = Array.isArray(chunk.timestamp) ? chunk.timestamp[0] : 0;
      sections.push(`**[${formatTime(startSec)}]** ${chunk.text.trim()}\n`);
    });
  } else if (session.transcript && session.transcript.trim().length > 0) {
    sections.push(`${session.transcript.trim()}\n`);
  } else {
    sections.push('*No audio transcript available for this session.*\n');
  }

  return sections.join('\n');
}

/**
 * Compiles and triggers browser download of session notes as a Markdown (.md) file.
 */
export async function exportSessionToMarkdown(
  session: Session,
  providedNotes?: Note[]
): Promise<void> {
  // If notes were not passed in, load them directly from IndexedDB
  let notes = providedNotes;
  if (!notes) {
    try {
      notes = await dbService.getNotesBySession(session.id);
    } catch {
      notes = [];
    }
  }

  const markdownString = compileSessionToMarkdown(session, notes);

  // Blob Download Generation
  const blob = new Blob([markdownString], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  // Sanitize filename for download
  const safeTitle = (session.title || 'Lecture-Notes')
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim() || 'Lecture-Notes';
  const downloadFileName = `${safeTitle}.md`;

  const link = document.createElement('a');
  link.href = url;
  link.download = downloadFileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
