// src/services/fileSystemService.ts - File System Access API helper
// Allows Chromium browsers (Chrome, Edge, Opera) to automatically save recordings to a chosen local directory.

const DIR_HANDLE_KEY = 'pinpoint_save_dir_handle';

export const fileSystemService = {
  isSupported(): boolean {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  },

  async selectDirectory(): Promise<FileSystemDirectoryHandle | null> {
    if (!this.isSupported()) return null;
    try {
      const handle = await (window as any).showDirectoryPicker({
        id: 'pinpoint-recordings',
        mode: 'readwrite',
      });
      // Store handle in IndexedDB
      await this.saveStoredHandle(handle);
      return handle;
    } catch (err: any) {
      if (err.name !== 'AbortError') console.error('Directory selection failed:', err);
      return null;
    }
  },

  async verifyPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
    const options = { mode: 'readwrite' as const };
    try {
      if ((await (handle as any).queryPermission(options)) === 'granted') return true;
      if ((await (handle as any).requestPermission(options)) === 'granted') return true;
    } catch {
      return false;
    }
    return false;
  },

  async saveFileToDirectory(fileName: string, blob: Blob): Promise<boolean> {
    const handle = await this.getStoredHandle();
    if (!handle) return false;
    try {
      const hasPerm = await this.verifyPermission(handle);
      if (!hasPerm) return false;

      const fileHandle = await (handle as any).getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (err) {
      console.error('Failed to write file to local folder:', err);
      return false;
    }
  },

  // Store handle in IndexedDB settings table
  async saveStoredHandle(handle: FileSystemDirectoryHandle): Promise<void> {
    return new Promise((resolve) => {
      const req = indexedDB.open('PinpointAudioDB');
      req.onsuccess = () => {
        const db = req.result;
        if (db.objectStoreNames.contains('settings')) {
          const tx = db.transaction('settings', 'readwrite');
          tx.objectStore('settings').put({ key: DIR_HANDLE_KEY, value: handle });
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } else {
          resolve();
        }
      };
      req.onerror = () => resolve();
    });
  },

  async getStoredHandle(): Promise<FileSystemDirectoryHandle | null> {
    return new Promise((resolve) => {
      const req = indexedDB.open('PinpointAudioDB');
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('settings')) return resolve(null);
        const tx = db.transaction('settings', 'readonly');
        const getReq = tx.objectStore('settings').get(DIR_HANDLE_KEY);
        getReq.onsuccess = () => resolve(getReq.result?.value || null);
        getReq.onerror = () => resolve(null);
      };
      req.onerror = () => resolve(null);
    });
  },

  async clearStoredHandle(): Promise<void> {
    return new Promise((resolve) => {
      const req = indexedDB.open('PinpointAudioDB');
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('settings')) return resolve();
        const tx = db.transaction('settings', 'readwrite');
        tx.objectStore('settings').delete(DIR_HANDLE_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      };
      req.onerror = () => resolve();
    });
  },
};
