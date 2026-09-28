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
}

export interface Folder {
  id: string;
  name: string;
  color: string;
}

export type ThemeMode = 'light' | 'dark' | 'sepia' | 'midnight';
export type FontMode = 'standard' | 'dyslexic';

export interface AppSettings {
  theme: ThemeMode;
  fontMode: FontMode;
  playbackRate: number;
  volume: number;
  isAudioEnhanced?: boolean;
}

export interface ExportDataPayload {
  version: number;
  exportedAt: string;
  appName: string;
  folders: Folder[];
  sessions: Array<Omit<Session, 'audioBlob'> & { audioBase64?: string }>;
  notes: Note[];
}
