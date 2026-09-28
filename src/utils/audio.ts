import { dbService } from '../services/db';
import { Folder, Note, Session } from '../types';

/**
 * Formats time in seconds to mm:ss or hh:mm:ss.
 * Strictly guards against Infinity, NaN, and negative numbers.
 */
export function formatTime(totalSeconds: number): string {
  if (
    typeof totalSeconds !== 'number' ||
    isNaN(totalSeconds) ||
    !isFinite(totalSeconds) ||
    totalSeconds < 0
  ) {
    return '00:00';
  }
  const rounded = Math.round(totalSeconds);
  const hrs = Math.floor(rounded / 3600);
  const mins = Math.floor((rounded % 3600) / 60);
  const secs = Math.floor(rounded % 60);

  const mm = mins.toString().padStart(2, '0');
  const ss = secs.toString().padStart(2, '0');

  if (hrs > 0) {
    const hh = hrs.toString().padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

/**
 * Synthesizes a soothing 45-second ambient audio track into a WAV Blob
 * entirely locally using the Web Audio API (OfflineAudioContext).
 * No external network requests needed!
 */
export async function generateSampleAudioBlob(durationSeconds: number = 42): Promise<Blob> {
  const sampleRate = 44100;
  const numChannels = 1;
  const totalSamples = sampleRate * durationSeconds;

  const offlineCtx = new (window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext)(
    numChannels,
    totalSamples,
    sampleRate
  );

  // Create gentle rhythmic harmonic chord progression
  const baseFreqs = [220, 261.63, 329.63, 392.0]; // A minor 7th chord tones
  const chordTimes = [0, 8, 16, 24, 32];

  chordTimes.forEach((startTime, idx) => {
    const chordRoot = [220, 196, 174.61, 164.81, 220][idx % 5];
    const freqs = [chordRoot, chordRoot * 1.25, chordRoot * 1.5, chordRoot * 1.875];

    freqs.forEach((freq, fIdx) => {
      const osc = offlineCtx.createOscillator();
      const gain = offlineCtx.createGain();

      osc.type = fIdx === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      const noteDuration = 7.5;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.08 / (fIdx + 1), startTime + 0.8);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + noteDuration);

      osc.connect(gain);
      gain.connect(offlineCtx.destination);

      osc.start(startTime);
      osc.stop(startTime + noteDuration);
    });

    // Add gentle pulse tick each 2 seconds
    for (let t = startTime; t < startTime + 8 && t < durationSeconds; t += 2) {
      const tickOsc = offlineCtx.createOscillator();
      const tickGain = offlineCtx.createGain();

      tickOsc.type = 'sine';
      tickOsc.frequency.setValueAtTime(880, t);
      tickGain.gain.setValueAtTime(0.03, t);
      tickGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);

      tickOsc.connect(tickGain);
      tickGain.connect(offlineCtx.destination);

      tickOsc.start(t);
      tickOsc.stop(t + 0.15);
    }
  });

  const renderedBuffer = await offlineCtx.startRendering();
  return audioBufferToWavBlob(renderedBuffer);
}

/**
 * Converts AudioBuffer to standard PCM WAV format Blob
 */
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const samples = buffer.getChannelData(0);
  const dataSize = samples.length * bytesPerSample;
  const bufferSize = 44 + dataSize;
  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // write the PCM samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([view], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Seeds initial database data if empty
 */
export async function seedInitialDataIfNeeded(): Promise<Session> {
  const existingSessions = await dbService.getAllSessions();
  if (existingSessions.length > 0) {
    return existingSessions[0];
  }

  // Create initial folders
  const defaultFolders: Folder[] = [
    { id: 'folder-1', name: 'Work & Projects', color: '#6366F1' },
    { id: 'folder-2', name: 'Interviews & Debriefs', color: '#0EA5E9' },
    { id: 'folder-3', name: 'Lectures & Research', color: '#10B981' },
    { id: 'folder-4', name: 'Personal Reflections', color: '#F59E0B' },
  ];

  for (const f of defaultFolders) {
    await dbService.saveFolder(f);
  }

  // Generate demo sample audio
  const sampleBlob = await generateSampleAudioBlob(42);

  const sampleSessionId = 'session-welcome';
  const sampleSession: Session = {
    id: sampleSessionId,
    title: 'Product Strategy & Architecture Review',
    folderId: 'folder-1',
    createdAt: Date.now() - 3600000 * 2,
    updatedAt: Date.now() - 3600000 * 2,
    duration: 42,
    audioBlob: sampleBlob,
    audioMimeType: 'audio/wav',
    audioFileName: 'architecture_review_sample.wav',
  };

  await dbService.saveSession(sampleSession);

  // Create structured timestamped notes with visual callout boxes
  const sampleNotes: Note[] = [
    {
      id: 'note-1',
      sessionId: sampleSessionId,
      timestamp: 3,
      content: 'Kickoff: Discussing high-reliability offline architecture. All data and audio Blobs are securely handled in local IndexedDB without any external telemetry.',
      calloutType: 'note',
      createdAt: Date.now() - 3600000 * 2 + 3000,
      updatedAt: Date.now() - 3600000 * 2 + 3000,
    },
    {
      id: 'note-2',
      sessionId: sampleSessionId,
      timestamp: 10,
      content: 'Key Insight: IndexedDB quota easily holds gigabytes of raw voice recordings, whereas localStorage crashes at 5MB.',
      calloutType: 'key_point',
      createdAt: Date.now() - 3600000 * 2 + 10000,
      updatedAt: Date.now() - 3600000 * 2 + 10000,
    },
    {
      id: 'note-3',
      sessionId: sampleSessionId,
      timestamp: 18,
      content: 'Accessibility verification: Test switching to OpenDyslexic font and toggle high-contrast light/dark modes.',
      calloutType: 'task',
      completed: true,
      dueDate: Date.now() + 86400000 * 2,
      createdAt: Date.now() - 3600000 * 2 + 18000,
      updatedAt: Date.now() - 3600000 * 2 + 18000,
    },
    {
      id: 'note-4',
      sessionId: sampleSessionId,
      timestamp: 26,
      content: 'Pro-tip: Press Ctrl+M or Cmd+M anywhere while playing audio to instantly capture a note linked to that exact second.',
      calloutType: 'key_point',
      createdAt: Date.now() - 3600000 * 2 + 26000,
      updatedAt: Date.now() - 3600000 * 2 + 26000,
    },
    {
      id: 'note-5',
      sessionId: sampleSessionId,
      timestamp: 34,
      content: 'Export checklist: Validate offline MP3 downloads and standalone HTML export with embedded audio and structured callout metadata.',
      calloutType: 'task',
      completed: false,
      dueDate: Date.now() + 86400000 * 5,
      createdAt: Date.now() - 3600000 * 2 + 34000,
      updatedAt: Date.now() - 3600000 * 2 + 34000,
    },
    {
      id: 'note-6',
      sessionId: sampleSessionId,
      timestamp: 42,
      content: 'Question: Should we add multi-track recording or stay focused on single-track clarity?',
      calloutType: 'question_to_ask',
      createdAt: Date.now() - 3600000 * 2 + 42000,
      updatedAt: Date.now() - 3600000 * 2 + 42000,
    },
  ];

  for (const n of sampleNotes) {
    await dbService.saveNote(n);
  }

  return sampleSession;
}

/**
 * Loads lamejs library dynamically from CDN if not already present on window.
 */
function getLameJs(): Promise<any> {
  if (typeof window !== 'undefined' && (window as any).lamejs) {
    return Promise.resolve((window as any).lamejs);
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="lamejs"]');
    if (existing) {
      existing.addEventListener('load', () => resolve((window as any).lamejs));
      existing.addEventListener('error', () => reject(new Error('Failed to load lamejs')));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js';
    script.onload = () => {
      if ((window as any).lamejs) {
        resolve((window as any).lamejs);
      } else {
        reject(new Error('lamejs not available on window object'));
      }
    };
    script.onerror = () => reject(new Error('Could not load lamejs CDN'));
    document.head.appendChild(script);
  });
}

/**
 * Converts an audio Blob to an MP3 file client-side using lamejs and triggers native download.
 */
export async function downloadAudioAsMp3(
  audioBlob: Blob,
  rawFileName: string = 'recording'
): Promise<void> {
  const lame = await getLameJs();
  const arrayBuffer = await audioBlob.arrayBuffer();

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioCtx();

  let decodedBuffer: AudioBuffer;
  try {
    decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  } finally {
    if (audioCtx.state !== 'closed') {
      audioCtx.close().catch(() => {});
    }
  }

  const numChannels = decodedBuffer.numberOfChannels;
  const sampleRate = decodedBuffer.sampleRate;
  const kbps = 128;
  const mp3encoder = new lame.Mp3Encoder(numChannels >= 2 ? 2 : 1, sampleRate, kbps);
  const mp3Data: any[] = [];

  const leftChannel = decodedBuffer.getChannelData(0);
  const rightChannel = numChannels >= 2 ? decodedBuffer.getChannelData(1) : null;

  // Convert Float32Array to Int16Array
  const leftInt16 = new Int16Array(leftChannel.length);
  for (let i = 0; i < leftChannel.length; i++) {
    const s = Math.max(-1, Math.min(1, leftChannel[i]));
    leftInt16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  let rightInt16: Int16Array | null = null;
  if (rightChannel) {
    rightInt16 = new Int16Array(rightChannel.length);
    for (let i = 0; i < rightChannel.length; i++) {
      const s = Math.max(-1, Math.min(1, rightChannel[i]));
      rightInt16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
  }

  const sampleBlockSize = 1152;
  for (let i = 0; i < leftInt16.length; i += sampleBlockSize) {
    const leftChunk = leftInt16.subarray(i, i + sampleBlockSize);
    let mp3buf: Int8Array | Uint8Array;
    if (rightInt16) {
      const rightChunk = rightInt16.subarray(i, i + sampleBlockSize);
      mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
    } else {
      mp3buf = mp3encoder.encodeBuffer(leftChunk);
    }
    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf.buffer.slice(mp3buf.byteOffset, mp3buf.byteOffset + mp3buf.byteLength));
    }
  }

  const mp3buf = mp3encoder.flush();
  if (mp3buf.length > 0) {
    mp3Data.push(mp3buf.buffer.slice(mp3buf.byteOffset, mp3buf.byteOffset + mp3buf.byteLength));
  }

  const mp3Blob = new Blob(mp3Data, { type: 'audio/mp3' });
  const downloadUrl = URL.createObjectURL(mp3Blob);

  const cleanTitle = rawFileName
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .toLowerCase();

  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = `${cleanTitle || 'recording'}.mp3`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);
}

