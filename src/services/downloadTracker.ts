import { DownloadRecord } from '../types';

const STORAGE_KEY = 'pinpoint_audio_downloads_history';

export const downloadTracker = {
  getDownloads(): DownloadRecord[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  },

  addDownload(
    item: Omit<DownloadRecord, 'id' | 'timestamp'> & { id?: string; timestamp?: number }
  ): DownloadRecord {
    const record: DownloadRecord = {
      id: item.id || `dl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      sessionId: item.sessionId,
      title: item.title,
      format: item.format,
      fileName: item.fileName,
      timestamp: item.timestamp || Date.now(),
      sizeBytes: item.sizeBytes,
      status: item.status || 'completed',
    };
    try {
      const current = this.getDownloads();
      const updated = [record, ...current.filter((d) => d.id !== record.id)].slice(0, 100);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
    return record;
  },

  removeDownload(id: string): void {
    try {
      const current = this.getDownloads();
      const updated = current.filter((d) => d.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  },

  clearDownloads(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  },
};
