export type CalloutType = 'note' | 'task' | 'key_point' | 'question_to_ask';

export interface Note {
  id: string;
  sessionId: string;
  timestamp: number; // in seconds
  content: string;
  calloutType: CalloutType;
  dueDate?: number; // timestamp in ms
  completed?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface SessionImage {
  id: string;
  blob: Blob;
  name: string;
  timestamp?: number; // linked audio timestamp in seconds
  createdAt: number;
  annotationDataUrl?: string; // canvas drawing overlay layer
}

export interface TranscriptionChunk {
  timestamp: [number, number]; // [startSec, endSec]
  text: string;
}

export interface Session {
  id: string;
  title: string;
  folderId: string;
  createdAt: number;
  updatedAt: number;
  duration: number; // in seconds
  audioBlob?: Blob;
  audioMimeType?: string;
  audioFileName?: string;
  transcript?: string;
  chunks?: TranscriptionChunk[];
  images?: SessionImage[];
  deletedAt?: number; // timestamp in ms when moved to bin (soft-deleted)
}

export interface Folder {
  id: string;
  name: string;
  color: string;
}

export type ThemeMode = 'light' | 'dark' | 'sepia';
export type FontMode = 'standard' | 'dyslexic';

export interface AppSettings {
  theme: ThemeMode;
  fontMode: FontMode;
  playbackRate: number;
  volume: number;
  isAudioEnhanced?: boolean;
}

export interface SerializedSessionImage {
  id: string;
  name: string;
  timestamp?: number;
  createdAt: number;
  imageBase64?: string;
  mimeType?: string;
  annotationDataUrl?: string;
}

export interface ExportDataPayload {
  version: number;
  exportedAt: string;
  appName: string;
  folders: Folder[];
  sessions: Array<
    Omit<Session, 'audioBlob' | 'images'> & {
      audioBase64?: string;
      images?: SerializedSessionImage[];
    }
  >;
  notes: Note[];
}
