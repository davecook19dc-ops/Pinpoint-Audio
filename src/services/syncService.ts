import Peer, { DataConnection } from 'peerjs';
import { dbService } from './db';
import { Folder, Note, Session } from '../types';

export type SyncStatus =
  | 'idle'
  | 'host_waiting'
  | 'connecting'
  | 'connected'
  | 'transferring'
  | 'success'
  | 'error';

export interface SyncProgress {
  current: number;
  total: number;
  stage: string;
}

export interface SyncMessage {
  type: 'MANIFEST' | 'FOLDERS' | 'NOTES' | 'SESSION_ITEM' | 'SYNC_COMPLETE' | 'ACK' | 'ERROR';
  payload?: any;
  session?: Session;
  progress?: SyncProgress;
  error?: string;
  sessionIndex?: number;
  totalSessions?: number;
  audioBuffer?: ArrayBuffer;
  audioMimeType?: string;
}

class WebRTCSyncService {
  private peer: Peer | null = null;
  private activeConn: DataConnection | null = null;
  private statusCallback: ((status: SyncStatus, message: string, progress?: SyncProgress) => void) | null = null;
  private dataReceivedCallback: (() => void) | null = null;

  /**
   * Generates a clean, human-readable 6-character Pairing Code format: VOCAL-XXXX
   */
  public generatePairingCode(): string {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = 'VOCAL-';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Sets up Host device (e.g. Desktop). Listens for incoming WebRTC client connections.
   */
  public startHost(
    customCode?: string,
    onStatusUpdate?: (status: SyncStatus, message: string, progress?: SyncProgress) => void,
    onDataReceived?: () => void
  ): { pairingCode: string; destroy: () => void } {
    this.destroy();
    this.statusCallback = onStatusUpdate || null;
    this.dataReceivedCallback = onDataReceived || null;

    const pairingCode = customCode || this.generatePairingCode();

    this.notifyStatus('host_waiting', `Host active. Waiting for pairing code: ${pairingCode}`);

    try {
      this.peer = new Peer(pairingCode, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
          ],
        },
      });

      this.peer.on('open', (id) => {
        this.notifyStatus('host_waiting', `Host initialized with Code: ${id}`);
      });

      this.peer.on('connection', (conn) => {
        this.activeConn = conn;
        this.setupConnectionHandlers(conn);
      });

      this.peer.on('error', (err) => {
        console.error('Host Peer Error:', err);
        this.notifyStatus(
          'error',
          `Host peer error: ${err.message || 'Connection failed'}. Please retry.`
        );
      });
    } catch (err: any) {
      this.notifyStatus('error', `Failed to start host: ${err.message || String(err)}`);
    }

    return {
      pairingCode,
      destroy: () => this.destroy(),
    };
  }

  /**
   * Connects client device (e.g. Mobile) to host device via Pairing Code.
   */
  public connectToHost(
    pairingCode: string,
    onStatusUpdate?: (status: SyncStatus, message: string, progress?: SyncProgress) => void,
    onDataReceived?: () => void
  ): void {
    this.destroy();
    this.statusCallback = onStatusUpdate || null;
    this.dataReceivedCallback = onDataReceived || null;

    const cleanedCode = pairingCode.trim().toUpperCase();
    if (!cleanedCode) {
      this.notifyStatus('error', 'Please enter a valid Pairing Code.');
      return;
    }

    this.notifyStatus('connecting', `Connecting to host ${cleanedCode}...`);

    try {
      this.peer = new Peer({
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
          ],
        },
      });

      this.peer.on('open', () => {
        if (!this.peer) return;
        const conn = this.peer.connect(cleanedCode, { reliable: true });
        this.activeConn = conn;
        this.setupConnectionHandlers(conn);
      });

      this.peer.on('error', (err) => {
        console.error('Client Peer Error:', err);
        let msg = `Connection error: ${err.message || 'Failed to reach peer'}`;
        if (err.type === 'peer-unavailable' || err.type === 'unavailable-id') {
          msg = `Pairing Code "${cleanedCode}" not found. Verify the host device code is active and both devices are online.`;
        }
        this.notifyStatus('error', msg);
      });
    } catch (err: any) {
      this.notifyStatus('error', `Connection error: ${err.message || String(err)}`);
    }
  }

  /**
   * Wire WebRTC connection handlers for data receiving and status tracking.
   */
  private setupConnectionHandlers(conn: DataConnection) {
    conn.on('open', () => {
      this.notifyStatus('connected', 'Direct WebRTC DataChannel established!');
    });

    conn.on('data', (data: any) => {
      this.handleIncomingMessage(data);
    });

    conn.on('close', () => {
      this.notifyStatus('idle', 'P2P Connection closed.');
    });

    conn.on('error', (err) => {
      console.error('Connection error:', err);
      this.notifyStatus('error', `DataChannel error: ${err.message || 'Transmission failed'}`);
    });
  }

  /**
   * Processes incoming WebRTC packets and safely merges into local IndexedDB storage.
   */
  private async handleIncomingMessage(msg: SyncMessage) {
    if (!msg || !msg.type) return;

    try {
      switch (msg.type) {
        case 'MANIFEST': {
          this.notifyStatus(
            'transferring',
            `Receiving data... (${msg.payload?.totalSessions || 0} sessions)`
          );
          break;
        }

        case 'FOLDERS': {
          if (Array.isArray(msg.payload)) {
            for (const folder of msg.payload as Folder[]) {
              await dbService.saveFolder(folder);
            }
          }
          break;
        }

        case 'NOTES': {
          if (Array.isArray(msg.payload)) {
            for (const note of msg.payload as Note[]) {
              await dbService.saveNote(note);
            }
          }
          break;
        }

        case 'SESSION_ITEM': {
          const { session, audioBuffer, audioMimeType, sessionIndex, totalSessions } = msg;
          if (session) {
            let reconstructedBlob: Blob | undefined = undefined;
            if (audioBuffer && audioBuffer.byteLength > 0) {
              reconstructedBlob = new Blob([audioBuffer], {
                type: audioMimeType || session.audioMimeType || 'audio/webm',
              });
            }

            const incomingSession: Session = {
              ...session,
              audioBlob: reconstructedBlob || session.audioBlob,
            };

            // Safely merge: check existing local session
            const existing = await dbService.getSession(incomingSession.id);
            if (!existing || incomingSession.updatedAt >= existing.updatedAt || !existing.audioBlob) {
              await dbService.saveSession(incomingSession);
            }
          }

          if (sessionIndex !== undefined && totalSessions) {
            this.notifyStatus(
              'transferring',
              `Syncing sessions (${sessionIndex + 1}/${totalSessions})...`,
              {
                current: sessionIndex + 1,
                total: totalSessions,
                stage: `Merging session ${sessionIndex + 1} of ${totalSessions}`,
              }
            );
          }
          break;
        }

        case 'SYNC_COMPLETE': {
          this.notifyStatus('success', 'P2P Library Sync complete! All records merged successfully.');
          if (this.activeConn && this.activeConn.open) {
            this.activeConn.send({ type: 'ACK' });
          }
          if (this.dataReceivedCallback) {
            this.dataReceivedCallback();
          }
          break;
        }

        case 'ACK': {
          this.notifyStatus('success', 'Remote device confirmed full sync reception!');
          if (this.dataReceivedCallback) {
            this.dataReceivedCallback();
          }
          break;
        }

        case 'ERROR': {
          this.notifyStatus('error', msg.error || 'Remote device reported sync error.');
          break;
        }

        default:
          break;
      }
    } catch (err: any) {
      console.error('Error handling sync message:', err);
      this.notifyStatus('error', `Data merge failed: ${err.message || String(err)}`);
    }
  }

  /**
   * Pushes entire local IndexedDB library over WebRTC DataChannel to connected peer.
   */
  public async sendLocalLibrary(
    onProgress?: (current: number, total: number, stage: string) => void
  ): Promise<void> {
    if (!this.activeConn || !this.activeConn.open) {
      this.notifyStatus('error', 'No active WebRTC peer connection.');
      return;
    }

    try {
      this.notifyStatus('transferring', 'Extracting local IndexedDB library...');

      const folders = await dbService.getAllFolders();
      const sessions = await dbService.getAllSessions();

      // Fetch notes for all sessions
      const allNotes: Note[] = [];
      for (const sess of sessions) {
        const notes = await dbService.getNotesBySession(sess.id);
        allNotes.push(...notes);
      }

      const totalSessions = sessions.length;

      // 1. Send Manifest
      this.activeConn.send({
        type: 'MANIFEST',
        payload: {
          totalFolders: folders.length,
          totalNotes: allNotes.length,
          totalSessions,
        },
      });

      // 2. Send Folders
      this.activeConn.send({
        type: 'FOLDERS',
        payload: folders,
      });

      // 3. Send Notes
      this.activeConn.send({
        type: 'NOTES',
        payload: allNotes,
      });

      // 4. Send Sessions with Audio Buffers
      for (let i = 0; i < sessions.length; i++) {
        const sess = sessions[i];
        let audioBuffer: ArrayBuffer | undefined = undefined;
        let mimeType = sess.audioMimeType || 'audio/webm';

        if (sess.audioBlob) {
          audioBuffer = await sess.audioBlob.arrayBuffer();
          mimeType = sess.audioBlob.type || mimeType;
        }

        // Strip Blob reference from session object payload before sending
        const sessionMeta = { ...sess, audioBlob: undefined };

        this.activeConn.send({
          type: 'SESSION_ITEM',
          session: sessionMeta,
          audioBuffer,
          audioMimeType: mimeType,
          sessionIndex: i,
          totalSessions,
        });

        const stageStr = `Transferring session ${i + 1} of ${totalSessions} ("${sess.title}")`;
        this.notifyStatus('transferring', stageStr, {
          current: i + 1,
          total: totalSessions,
          stage: stageStr,
        });

        if (onProgress) {
          onProgress(i + 1, totalSessions, stageStr);
        }

        // Small delay between large transfers to avoid WebRTC buffer congestion
        await new Promise((r) => setTimeout(r, 60));
      }

      // 5. Send Complete Signal
      this.activeConn.send({
        type: 'SYNC_COMPLETE',
      });

      this.notifyStatus('success', 'All local records successfully sent to peer!');
    } catch (err: any) {
      console.error('Error sending local library:', err);
      this.notifyStatus('error', `Failed to send data: ${err.message || String(err)}`);
    }
  }

  /**
   * Helper to trigger status callback
   */
  private notifyStatus(status: SyncStatus, message: string, progress?: SyncProgress) {
    if (this.statusCallback) {
      this.statusCallback(status, message, progress);
    }
  }

  /**
   * Tear down active WebRTC peer connection & instances
   */
  public destroy() {
    if (this.activeConn) {
      try {
        this.activeConn.close();
      } catch (e) {}
      this.activeConn = null;
    }
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch (e) {}
      this.peer = null;
    }
  }
}

export const syncService = new WebRTCSyncService();
