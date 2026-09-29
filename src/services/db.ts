import { AppSettings, Folder, Note, Session, ExportDataPayload } from '../types';

const DB_NAME = 'PinpointAudioDB';
const DB_VERSION = 1;

class IndexedDBStorage {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Sessions store (holds audio Blobs directly, no size limits)
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sessionStore.createIndex('folderId', 'folderId', { unique: false });
          sessionStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        // Notes store
        if (!db.objectStoreNames.contains('notes')) {
          const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
          notesStore.createIndex('sessionId', 'sessionId', { unique: false });
          notesStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Folders store
        if (!db.objectStoreNames.contains('folders')) {
          db.createObjectStore('folders', { keyPath: 'id' });
        }

        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  // --- Sessions ---
  async getAllSessions(): Promise<Session[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sessions', 'readonly');
      const store = tx.objectStore('sessions');
      const request = store.getAll();
      request.onsuccess = () => {
        const sessions: Session[] = request.result || [];
        sessions.sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(sessions);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getSession(id: string): Promise<Session | undefined> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sessions', 'readonly');
      const store = tx.objectStore('sessions');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveSession(session: Session): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sessions', 'readwrite');
      const store = tx.objectStore('sessions');
      const request = store.put(session);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async updateSessionTitle(sessionId: string, newTitle: string): Promise<Session | undefined> {
    const session = await this.getSession(sessionId);
    if (!session) return undefined;
    const updated: Session = {
      ...session,
      title: newTitle.trim() || 'Untitled Session',
      updatedAt: Date.now(),
    };
    await this.saveSession(updated);
    return updated;
  }

  async updateSlideAnnotation(
    sessionId: string,
    slideId: string,
    annotationDataUrl?: string
  ): Promise<Session | undefined> {
    const session = await this.getSession(sessionId);
    if (!session || !session.images) return undefined;
    const updatedImages = session.images.map((img) =>
      img.id === slideId ? { ...img, annotationDataUrl } : img
    );
    const updated: Session = {
      ...session,
      images: updatedImages,
      updatedAt: Date.now(),
    };
    await this.saveSession(updated);
    return updated;
  }

  async deleteSession(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['sessions', 'notes'], 'readwrite');
      const sessionStore = tx.objectStore('sessions');
      const notesStore = tx.objectStore('notes');
      
      sessionStore.delete(id);

      // Also clean up all notes belonging to this session
      const index = notesStore.index('sessionId');
      const request = index.getAllKeys(id);
      request.onsuccess = () => {
        const keys = request.result;
        for (const key of keys) {
          notesStore.delete(key);
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Notes ---
  async getNotesBySession(sessionId: string): Promise<Note[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('notes', 'readonly');
      const store = tx.objectStore('notes');
      const index = store.index('sessionId');
      const request = index.getAll(sessionId);
      request.onsuccess = () => {
        const notes: Note[] = request.result || [];
        notes.sort((a, b) => a.timestamp - b.timestamp);
        resolve(notes);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveNote(note: Note): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('notes', 'readwrite');
      const store = tx.objectStore('notes');
      const request = store.put(note);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteNote(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('notes', 'readwrite');
      const store = tx.objectStore('notes');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // --- Folders ---
  async getAllFolders(): Promise<Folder[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('folders', 'readonly');
      const store = tx.objectStore('folders');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async ensureDefaultFolder(): Promise<Folder[]> {
    const folders = await this.getAllFolders();
    if (folders.length === 0) {
      const defaultFolder: Folder = {
        id: 'lectures-default',
        name: 'Lectures',
        color: '#10B981',
      };
      await this.saveFolder(defaultFolder);
      return [defaultFolder];
    }
    return folders;
  }

  async saveFolder(folder: Folder): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('folders', 'readwrite');
      const store = tx.objectStore('folders');
      const request = store.put(folder);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteFolder(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('folders', 'readwrite');
      const store = tx.objectStore('folders');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // --- Settings ---
  async getSettings(): Promise<AppSettings> {
    const defaultSettings: AppSettings = {
      theme: 'light',
      fontMode: 'standard',
      playbackRate: 1,
      volume: 1,
    };
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction('settings', 'readonly');
        const store = tx.objectStore('settings');
        const request = store.get('app_settings');
        request.onsuccess = () => {
          if (request.result && request.result.value) {
            resolve({ ...defaultSettings, ...request.result.value });
          } else {
            resolve(defaultSettings);
          }
        };
        request.onerror = () => resolve(defaultSettings);
      });
    } catch {
      return defaultSettings;
    }
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readwrite');
      const store = tx.objectStore('settings');
      const request = store.put({ key: 'app_settings', value: settings });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // --- Export and Import ---
  async exportAllData(): Promise<ExportDataPayload> {
    const folders = await this.getAllFolders();
    const sessions = await this.getAllSessions();
    
    // Convert audio blobs and slide image blobs to base64 for portable JSON export
    const serializableSessions = await Promise.all(
      sessions.map(async (sess) => {
        let audioBase64: string | undefined = undefined;
        if (sess.audioBlob) {
          audioBase64 = await blobToBase64(sess.audioBlob);
        }

        let serializedImages: any[] | undefined = undefined;
        if (sess.images && sess.images.length > 0) {
          serializedImages = await Promise.all(
            sess.images.map(async (img) => {
              const imageBase64 = await blobToBase64(img.blob);
              return {
                id: img.id,
                name: img.name,
                timestamp: img.timestamp,
                createdAt: img.createdAt,
                imageBase64,
                mimeType: img.blob.type || 'image/jpeg',
                annotationDataUrl: img.annotationDataUrl,
              };
            })
          );
        }

        return {
          id: sess.id,
          title: sess.title,
          folderId: sess.folderId,
          createdAt: sess.createdAt,
          updatedAt: sess.updatedAt,
          duration: sess.duration,
          audioMimeType: sess.audioMimeType,
          audioFileName: sess.audioFileName,
          transcript: sess.transcript,
          audioBase64,
          images: serializedImages,
        };
      })
    );

    const db = await this.getDB();
    const allNotes: Note[] = await new Promise((resolve, reject) => {
      const tx = db.transaction('notes', 'readonly');
      const store = tx.objectStore('notes');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      appName: 'Pinpoint Audio',
      folders,
      sessions: serializableSessions,
      notes: allNotes,
    };
  }

  async importData(payload: ExportDataPayload): Promise<void> {
    if (!payload || !Array.isArray(payload.sessions)) {
      throw new Error('Invalid backup file format.');
    }

    const db = await this.getDB();
    const tx = db.transaction(['folders', 'sessions', 'notes'], 'readwrite');
    const folderStore = tx.objectStore('folders');
    const sessionStore = tx.objectStore('sessions');
    const noteStore = tx.objectStore('notes');

    if (Array.isArray(payload.folders)) {
      for (const folder of payload.folders) {
        folderStore.put(folder);
      }
    }

    for (const rawSession of payload.sessions) {
      let audioBlob: Blob | undefined = undefined;
      if (rawSession.audioBase64) {
        audioBlob = base64ToBlob(rawSession.audioBase64, rawSession.audioMimeType || 'audio/webm');
      }

      let restoredImages: any[] | undefined = undefined;
      if (rawSession.images && Array.isArray(rawSession.images)) {
        restoredImages = rawSession.images.map((rawImg) => {
          const imgBlob = rawImg.imageBase64
            ? base64ToBlob(rawImg.imageBase64, rawImg.mimeType || 'image/jpeg')
            : new Blob();
          return {
            id: rawImg.id,
            name: rawImg.name,
            timestamp: rawImg.timestamp,
            createdAt: rawImg.createdAt,
            blob: imgBlob,
            annotationDataUrl: rawImg.annotationDataUrl,
          };
        });
      }

      const session: Session = {
        id: rawSession.id,
        title: rawSession.title,
        folderId: rawSession.folderId || 'default',
        createdAt: rawSession.createdAt || Date.now(),
        updatedAt: rawSession.updatedAt || Date.now(),
        duration: rawSession.duration || 0,
        audioBlob,
        audioMimeType: rawSession.audioMimeType,
        audioFileName: rawSession.audioFileName,
        transcript: (rawSession as { transcript?: string }).transcript,
        images: restoredImages,
      };
      sessionStore.put(session);
    }

    if (Array.isArray(payload.notes)) {
      for (const note of payload.notes) {
        noteStore.put(note);
      }
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async estimateStorageUsage(): Promise<{ usedBytes: number; quotaBytes: number; percentage: number }> {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage || 0;
      const quota = estimate.quota || 1024 * 1024 * 500;
      return {
        usedBytes: used,
        quotaBytes: quota,
        percentage: Math.min(100, Math.round((used / quota) * 100)),
      };
    }
    return { usedBytes: 0, quotaBytes: 0, percentage: 0 };
  }

  /**
   * Requests persistent storage from the browser.
   * If granted, the browser will not automatically clear IndexedDB under storage pressure.
   */
  async requestPersistentStorage(): Promise<boolean> {
    if (typeof window !== 'undefined' && navigator.storage && navigator.storage.persist) {
      try {
        const isPersisted = await navigator.storage.persist();
        console.log(
          `[Pinpoint Storage] Persistent storage: ${
            isPersisted ? 'GRANTED (data protected from eviction)' : 'NOT PERSISTED'
          }`
        );
        return isPersisted;
      } catch (err) {
        console.warn('[Pinpoint Storage] Error requesting persistent storage:', err);
        return false;
      }
    }
    return false;
  }

  async isStoragePersisted(): Promise<boolean> {
    if (typeof window !== 'undefined' && navigator.storage && navigator.storage.persisted) {
      try {
        return await navigator.storage.persisted();
      } catch {
        return false;
      }
    }
    return false;
  }
}

// Helpers for Blob <-> Base64 conversion
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = reader.result as string;
      resolve(res);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const parts = base64.split(';base64,');
  const raw = parts.length > 1 ? atob(parts[1]) : atob(parts[0]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);

  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }

  return new Blob([uInt8Array], { type: mimeType });
}

export const dbService = new IndexedDBStorage();
