import React, { useState, useEffect, useRef, useCallback } from 'react';
import { dbService } from './services/db';
import { transcriptionService, TranscriptionProgress } from './services/transcriptionService';
import { AppSettings, CalloutType, Folder, FontMode, Note, Session, SessionImage, ThemeMode, TranscriptionChunk } from './types';
import { formatTime } from './utils/audio';
import { isApplePlatform, modifierKey } from './utils/platform';
import { generateStandaloneHtml } from './utils/exportHtml';
import { parsePdfSlides } from './utils/pdfParser';
import { Sidebar } from './components/Sidebar';
import { AudioPlayer } from './components/AudioPlayer';
import { NotesFeed } from './components/NotesFeed';
import { DashboardView } from './components/DashboardView';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { ConfirmDeleteModal } from './components/ConfirmDeleteModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { SyncPanel } from './components/SyncPanel';
import { OnboardingWarning } from './components/OnboardingWarning';
import {
  Menu,
  Plus,
  Headphones,
  Sparkles,
  Check,
  AlertCircle,
  Keyboard,
  ArrowLeft,
  Folder as FolderIcon,
  Sun,
  Moon,
  Palette,
  Type,
  Edit2,
  ArrowRightLeft,
  FileDown,
  Upload,
  HardDrive,
} from 'lucide-react';
import { exportSessionToMarkdown, generateMarkdownString, hasSessionExportableContent } from './services/exportService';
import { fileSystemService } from './services/fileSystemService';

export default function App() {
  // App Navigation View: 'dashboard' (folder-first grid) vs 'workspace' (split-screen editor)
  const [currentView, setCurrentView] = useState<'dashboard' | 'workspace'>('dashboard');
  const [selectedFolderForDrilldown, setSelectedFolderForDrilldown] = useState<string | null | 'bin'>(null);

  // Local File System Access state (Chromium auto-save to disk)
  const [localDirName, setLocalDirName] = useState<string | null>(null);
  const [isFsSupported, setIsFsSupported] = useState<boolean>(false);

  useEffect(() => {
    const supported = fileSystemService.isSupported();
    setIsFsSupported(supported);
    if (supported) {
      fileSystemService.getStoredHandle().then((handle) => {
        if (handle) {
          setLocalDirName(handle.name);
        }
      });
    }
  }, []);

  const handleSelectLocalFolder = async () => {
    if (!fileSystemService.isSupported()) return;
    const handle = await fileSystemService.selectDirectory();
    if (handle) {
      setLocalDirName(handle.name);
      showToast('Local save directory configured!');
    }
  };

  // Manual note export: writes silently to local folder if configured and permitted, else triggers browser download
  const handleExportNotes = async (sessionToExport?: Session) => {
    const sess = sessionToExport || currentSession;
    if (!sess) return;

    let sessNotes = notes;
    if (!sessNotes || sessNotes.length === 0 || (currentSession && sess.id !== currentSession.id)) {
      try {
        sessNotes = await dbService.getNotesBySession(sess.id);
      } catch {
        sessNotes = [];
      }
    }

    if (fileSystemService.isSupported()) {
      const handle = await fileSystemService.getStoredHandle();
      if (handle) {
        const hasPerm = await fileSystemService.verifyPermission(handle);
        if (hasPerm) {
          const mdString = generateMarkdownString(sess, sessNotes);
          const mdBlob = new Blob([mdString], { type: 'text/markdown;charset=utf-8' });
          const safeTitle = (sess.title || 'Lecture-Notes')
            .replace(/[\\/:*?"<>|]/g, '_')
            .trim() || 'Lecture-Notes';
          const mdFileName = `${safeTitle}.md`;
          const saved = await fileSystemService.saveFileToDirectory(mdFileName, mdBlob);
          if (saved) {
            showToast(`Saved notes to local folder: ${mdFileName}`);
            return;
          }
        }
      }
    }

    // Fall back to browser download
    await exportSessionToMarkdown(sess, sessNotes);
  };

  // Database entities
  const [folders, setFolders] = useState<Folder[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | 'all' | 'bin'>('all');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessionPendingDeletion, setSessionPendingDeletion] = useState<string | null>(null);
  const [isHardDeletePending, setIsHardDeletePending] = useState<boolean>(false);

  // App settings & theme
  const [settings, setSettings] = useState<AppSettings>({
    theme: 'light',
    fontMode: 'standard',
    playbackRate: 1,
    volume: 1,
  });

  // Audio Playback state
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Storage usage
  const [storageUsage, setStorageUsage] = useState({ usedBytes: 0, quotaBytes: 0, percentage: 0 });

  // Local In-Browser Transcription state (Transformers.js Whisper Web Worker)
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [transcriptionProgress, setTranscriptionProgress] = useState<number>(0);
  const [transcriptionStatus, setTranscriptionStatus] = useState<string>('');
  const [transcriptionDetail, setTranscriptionDetail] = useState<string>('');
  const [transcriptionElapsed, setTranscriptionElapsed] = useState<number | undefined>(undefined);
  const [transcriptionEta, setTranscriptionEta] = useState<number | undefined>(undefined);

  // Quick note trigger state (e.g. from Ctrl+M)
  const [quickAddTriggered, setQuickAddTriggered] = useState<boolean>(false);
  const [showMobileNotes, setShowMobileNotes] = useState<boolean>(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);
  const [isSyncOpen, setIsSyncOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const mainAudioImportRef = useRef<HTMLInputElement | null>(null);

  // Audio element ref
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Web Audio API DSP pipeline nodes for Enhance Audio (Auto-Leveling & Vocal EQ)
  const playbackAudioContextRef = useRef<AudioContext | null>(null);
  const mediaElementSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const highpassNodeRef = useRef<BiquadFilterNode | null>(null);
  const vocalEQNodeRef = useRef<BiquadFilterNode | null>(null);
  const compressorNodeRef = useRef<DynamicsCompressorNode | null>(null);
  const makeupGainNodeRef = useRef<GainNode | null>(null);

  // Initialize or resume Web Audio DSP pipeline
  const ensureWebAudioPipeline = () => {
    if (!audioRef.current) return;
    if (!playbackAudioContextRef.current) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();

      const source = ctx.createMediaElementSource(audioRef.current);

      // 1. High-pass filter (80Hz rumble rolloff)
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = settings.isAudioEnhanced ? 80 : 10;

      // 2. Vocal EQ boost (2.5kHz peaking filter)
      const vocal = ctx.createBiquadFilter();
      vocal.type = 'peaking';
      vocal.frequency.value = 2500;
      vocal.Q.value = 1.0;
      vocal.gain.value = settings.isAudioEnhanced ? 6.5 : 0;

      // 3. Dynamics Compressor (auto-leveling)
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = settings.isAudioEnhanced ? -28 : 0;
      comp.knee.value = 10;
      comp.ratio.value = settings.isAudioEnhanced ? 12 : 1;
      comp.attack.value = 0.003;
      comp.release.value = 0.25;

      // 4. Makeup Gain
      const gain = ctx.createGain();
      gain.gain.value = settings.isAudioEnhanced ? 1.8 : 1.0;

      // Chain: source -> hp -> vocal -> comp -> gain -> destination
      source.connect(hp);
      hp.connect(vocal);
      vocal.connect(comp);
      comp.connect(gain);
      gain.connect(ctx.destination);

      playbackAudioContextRef.current = ctx;
      mediaElementSourceRef.current = source;
      highpassNodeRef.current = hp;
      vocalEQNodeRef.current = vocal;
      compressorNodeRef.current = comp;
      makeupGainNodeRef.current = gain;
    }

    if (playbackAudioContextRef.current.state === 'suspended') {
      playbackAudioContextRef.current.resume().catch(() => {});
    }
  };

  // Dynamically update DSP parameters when isAudioEnhanced changes
  useEffect(() => {
    if (
      playbackAudioContextRef.current &&
      highpassNodeRef.current &&
      vocalEQNodeRef.current &&
      compressorNodeRef.current &&
      makeupGainNodeRef.current
    ) {
      const ctx = playbackAudioContextRef.current;
      const isEnhanced = !!settings.isAudioEnhanced;
      const now = ctx.currentTime;

      highpassNodeRef.current.frequency.setTargetAtTime(isEnhanced ? 80 : 10, now, 0.04);
      vocalEQNodeRef.current.gain.setTargetAtTime(isEnhanced ? 6.5 : 0, now, 0.04);
      compressorNodeRef.current.threshold.setTargetAtTime(isEnhanced ? -28 : 0, now, 0.04);
      compressorNodeRef.current.ratio.setTargetAtTime(isEnhanced ? 12 : 1, now, 0.04);
      makeupGainNodeRef.current.gain.setTargetAtTime(isEnhanced ? 1.8 : 1.0, now, 0.04);
    }
  }, [settings.isAudioEnhanced]);

  // Show temporary toast notification
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // 1. Initialize data on mount
  useEffect(() => {
    let isMounted = true;

    async function initialize() {
      try {
        // Request persistent storage from browser to prevent eviction under storage pressure
        await dbService.requestPersistentStorage();

        const loadedSettings = await dbService.getSettings();
        if (isMounted) setSettings(loadedSettings);

        // Ensure default 'Lectures' folder exists
        const loadedFolders = await dbService.ensureDefaultFolder();
        const loadedSessions = await dbService.getAllSessions();

        if (isMounted) {
          setFolders(loadedFolders);
          setSessions(loadedSessions);

          const targetSessionId = loadedSessions[0]?.id || null;
          setCurrentSessionId(targetSessionId);

          if (targetSessionId) {
            const sessionNotes = await dbService.getNotesBySession(targetSessionId);
            setNotes(sessionNotes);
          }

          const usage = await dbService.estimateStorageUsage();
          setStorageUsage(usage);
        }
      } catch (err) {
        console.error('Initialization error:', err);
      }
    }

    initialize();

    return () => {
      isMounted = false;
    };
  }, []);

  // Current session object
  const currentSession = sessions.find((s) => s.id === currentSessionId) || null;

  // 2. Setup audio blob URL when session changes
  useEffect(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }

    if (currentSession?.audioBlob) {
      const url = URL.createObjectURL(currentSession.audioBlob);
      setAudioUrl(url);
      setCurrentTime(0);
      const safeDuration =
        currentSession.duration && isFinite(currentSession.duration) && currentSession.duration > 0
          ? currentSession.duration
          : 0;
      setDuration(safeDuration);
      setIsPlaying(false);
    } else {
      setAudioUrl(null);
      setCurrentTime(0);
      setDuration(0);
      setIsPlaying(false);
    }

    // Load notes for current session
    if (currentSessionId) {
      dbService.getNotesBySession(currentSessionId).then((sessNotes) => {
        setNotes(sessNotes);
      });
    } else {
      setNotes([]);
    }
  }, [currentSessionId]);

  // Sync audio element volume & playbackRate
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = settings.playbackRate;
      audioRef.current.volume = settings.volume;
    }
  }, [settings.playbackRate, settings.volume]);

  // 3. Audio player controls
  const handlePlayPause = () => {
    if (!audioRef.current || !audioUrl) return;

    ensureWebAudioPipeline();

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch((err) => {
          console.error('Playback failed:', err);
        });
    }
  };

  const handleToggleAudioEnhanced = () => {
    ensureWebAudioPipeline();
    setSettings((prev) => {
      const nextVal = !prev.isAudioEnhanced;
      const updated = { ...prev, isAudioEnhanced: nextVal };
      dbService.saveSettings(updated);
      showToast(
        nextVal
          ? 'Enhance Audio ON: Dynamics Compressor & Vocal EQ active'
          : 'Enhance Audio OFF: Normal playback'
      );
      return updated;
    });
  };

  const handleSeek = (time: number) => {
    ensureWebAudioPipeline();
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
      if (audioRef.current.paused) {
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    } else {
      setCurrentTime(time);
    }
  };

  const handleRateChange = (rate: number) => {
    setSettings((prev) => {
      const updated = { ...prev, playbackRate: rate };
      dbService.saveSettings(updated);
      return updated;
    });
  };

  const handleVolumeChange = (vol: number) => {
    setSettings((prev) => {
      const updated = { ...prev, volume: vol };
      dbService.saveSettings(updated);
      return updated;
    });
  };

  // 4. Session & Audio Management
  const handleStartRecording = async (mode: 'mic' | 'meeting' = 'mic'): Promise<string> => {
    // If currentSession is already a placeholder without audio, reuse it directly!
    if (currentSession && !currentSession.audioBlob) {
      if (mode === 'meeting' && currentSession.title.startsWith('Recording ')) {
        const updated = {
          ...currentSession,
          title: currentSession.title.replace(/^Recording /, 'Meeting '),
        };
        await dbService.saveSession(updated);
        setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      }
      return currentSession.id;
    }

    // Otherwise, generate a unique sessionId
    const newSessionId = `session-${Date.now()}`;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = new Date().toLocaleDateString([], { month: 'short', day: 'numeric' });
    const folderId = activeFolderId !== 'all' ? activeFolderId : (folders[0]?.id || 'lectures-default');
    const titlePrefix = mode === 'meeting' ? 'Meeting' : 'Recording';

    const newSession: Session = {
      id: newSessionId,
      title: `${titlePrefix} ${dateStr} (${timestamp})`,
      folderId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      duration: 0,
    };

    // Create the initial database and UI entry using this ID
    await dbService.saveSession(newSession);
    const updatedSessions = await dbService.getAllSessions();
    setSessions(updatedSessions);
    setCurrentSessionId(newSessionId);
    setNotes([]);
    setDuration(0);
    setCurrentTime(0);

    return newSessionId;
  };

  const handleAudioRecorded = async (
    blob: Blob,
    recDuration: number,
    fileName: string,
    targetSessionId?: string
  ) => {
    const safeDuration = isFinite(recDuration) && recDuration > 0 ? Math.round(recDuration) : 1;
    const sessionIdToUpdate = targetSessionId || currentSessionId;

    if (sessionIdToUpdate) {
      // Find the existing session entry (either from state or IndexedDB)
      const existingSession =
        sessions.find((s) => s.id === sessionIdToUpdate) ||
        (await dbService.getSession(sessionIdToUpdate));

      if (existingSession) {
        // Update the existing database entry that matches the sessionId.
        // Do NOT use the function that adds a new recording.
        const updatedSession: Session = {
          ...existingSession,
          duration: safeDuration,
          audioBlob: blob,
          audioMimeType: blob.type,
          audioFileName: fileName,
          updatedAt: Date.now(),
        };

        await dbService.saveSession(updatedSession);

        // Refresh the UI so the existing placeholder is updated with playable audio
        setSessions((prev) =>
          prev.map((s) => (s.id === updatedSession.id ? updatedSession : s))
        );
        setCurrentSessionId(updatedSession.id);
        setDuration(safeDuration);

        // Revoke previous audioUrl if any and set new one
        if (audioUrl) {
          URL.revokeObjectURL(audioUrl);
        }
        const newUrl = URL.createObjectURL(blob);
        setAudioUrl(newUrl);

        const usage = await dbService.estimateStorageUsage();
        setStorageUsage(usage);

        // Auto-save recording and notes directly to disk if local folder configured
        const savedLocally = await fileSystemService.saveFileToDirectory(fileName, blob);
        if (savedLocally) {
          const mdString = generateMarkdownString(updatedSession, notes);
          const mdBlob = new Blob([mdString], { type: 'text/markdown;charset=utf-8' });
          await fileSystemService.saveFileToDirectory(fileName.replace(/\.[^/.]+$/, ".md"), mdBlob);
          showToast(`Saved to local folder: ${fileName}`);
        } else {
          showToast('Voice recording saved to IndexedDB!');
        }
        return;
      }
    }

    // Fallback: create new session only if no existing session found
    const newSessionId = `session-${Date.now()}`;
    const newSession: Session = {
      id: newSessionId,
      title: `Recording ${new Date().toLocaleDateString([], { month: 'short', day: 'numeric' })} (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
      folderId: activeFolderId !== 'all' ? activeFolderId : (folders[0]?.id || 'lectures-default'),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      duration: safeDuration,
      audioBlob: blob,
      audioMimeType: blob.type,
      audioFileName: fileName,
    };

    await dbService.saveSession(newSession);
    const updatedSessions = await dbService.getAllSessions();
    setSessions(updatedSessions);
    setCurrentSessionId(newSessionId);
    setDuration(safeDuration);

    const usage = await dbService.estimateStorageUsage();
    setStorageUsage(usage);

    // Auto-save recording and notes directly to disk if local folder configured
    const savedLocally = await fileSystemService.saveFileToDirectory(fileName, blob);
    if (savedLocally) {
      const mdString = generateMarkdownString(newSession, notes);
      const mdBlob = new Blob([mdString], { type: 'text/markdown;charset=utf-8' });
      await fileSystemService.saveFileToDirectory(fileName.replace(/\.[^/.]+$/, ".md"), mdBlob);
      showToast(`Saved to local folder: ${fileName}`);
    } else {
      showToast('Voice recording saved to IndexedDB!');
    }
  };

  const handleDiscardAudio = async () => {
    if (!currentSession) return;
    const updatedSession: Session = {
      ...currentSession,
      audioBlob: undefined,
      audioMimeType: undefined,
      audioFileName: undefined,
      duration: 0,
      transcript: undefined,
      updatedAt: Date.now(),
    };
    await dbService.saveSession(updatedSession);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setCurrentTime(0);
    setDuration(0);
    const updatedSessions = await dbService.getAllSessions();
    setSessions(updatedSessions);
    showToast('Recording discarded. Ready for new recording.');
  };

  const handleReloadLibrary = async () => {
    const updatedSessions = await dbService.getAllSessions();
    const updatedFolders = await dbService.getAllFolders();
    setSessions(updatedSessions);
    setFolders(updatedFolders);
    const usage = await dbService.estimateStorageUsage();
    setStorageUsage(usage);
    showToast('P2P Library Sync complete! Records merged.');
  };

  const handleAudioUploaded = async (file: File) => {
    // Read audio duration using temporary audio element or Web Audio decodeAudioData
    const tempUrl = URL.createObjectURL(file);
    const tempAudio = new Audio(tempUrl);

    tempAudio.onloadedmetadata = async () => {
      let audioDuration =
        isFinite(tempAudio.duration) && tempAudio.duration > 0
          ? Math.round(tempAudio.duration)
          : 0;

      // If duration is 0 or Infinity (e.g. untagged WebM), calculate accurately using Web Audio API
      if (audioDuration === 0) {
        try {
          const buffer = await file.arrayBuffer();
          const actx = new (window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
          const decoded = await actx.decodeAudioData(buffer);
          audioDuration = Math.round(decoded.duration);
          actx.close().catch(() => {});
        } catch {
          audioDuration = 0;
        }
      }
      URL.revokeObjectURL(tempUrl);

      // If current session is an existing placeholder without audio, update it rather than creating duplicate
      if (currentSession && !currentSession.audioBlob) {
        const updatedSession: Session = {
          ...currentSession,
          title: file.name.replace(/\.[^/.]+$/, ''),
          duration: audioDuration,
          audioBlob: file,
          audioMimeType: file.type,
          audioFileName: file.name,
          updatedAt: Date.now(),
        };

        await dbService.saveSession(updatedSession);
        setSessions((prev) =>
          prev.map((s) => (s.id === updatedSession.id ? updatedSession : s))
        );
        setCurrentSessionId(updatedSession.id);
        setDuration(audioDuration);
        setCurrentView('workspace');
        setShowMobileNotes(false);

        if (audioUrl) {
          URL.revokeObjectURL(audioUrl);
        }
        const newUrl = URL.createObjectURL(file);
        setAudioUrl(newUrl);

        const usage = await dbService.estimateStorageUsage();
        setStorageUsage(usage);
        showToast(`Imported "${file.name}" into session!`);
        return;
      }

      const newSessionId = `session-${Date.now()}`;
      const title = file.name.replace(/\.[^/.]+$/, '');
      const newSession: Session = {
        id: newSessionId,
        title,
        folderId: activeFolderId !== 'all' ? activeFolderId : (folders[0]?.id || 'lectures-default'),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        duration: audioDuration,
        audioBlob: file,
        audioMimeType: file.type,
        audioFileName: file.name,
      };

      await dbService.saveSession(newSession);
      const updatedSessions = await dbService.getAllSessions();
      setSessions(updatedSessions);
      setCurrentSessionId(newSessionId);
      setDuration(audioDuration);
      setCurrentView('workspace');
      setShowMobileNotes(false);

      const usage = await dbService.estimateStorageUsage();
      setStorageUsage(usage);
      showToast(`Imported "${file.name}" into new session!`);
    };

    tempAudio.onerror = () => {
      URL.revokeObjectURL(tempUrl);
      showToast('Could not load audio file. Please check format.');
    };
  };

  const handleCreateSession = async () => {
    const newSessionId = `session-${Date.now()}`;
    const newSession: Session = {
      id: newSessionId,
      title: `Untitled Session ${sessions.length + 1}`,
      folderId: activeFolderId !== 'all' ? activeFolderId : (folders[0]?.id || 'lectures-default'),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      duration: 0,
    };

    await dbService.saveSession(newSession);
    const updatedSessions = await dbService.getAllSessions();
    setSessions(updatedSessions);
    setCurrentSessionId(newSessionId);
    showToast('New session created.');
  };

  const handleOpenSessionFromDashboard = (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setShowMobileNotes(false);
    setCurrentView('workspace');
  };

  const handleCreateSessionInFolder = async (folderId: string) => {
    const newSessionId = `session-${Date.now()}`;
    const targetFolder = folders.find((f) => f.id === folderId);
    const newSession: Session = {
      id: newSessionId,
      title: `Recording in ${targetFolder ? targetFolder.name : 'Folder'}`,
      folderId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      duration: 0,
    };

    await dbService.saveSession(newSession);
    const updatedSessions = await dbService.getAllSessions();
    setSessions(updatedSessions);
    setCurrentSessionId(newSessionId);
    setShowMobileNotes(false);
    setCurrentView('workspace');
    showToast('Workspace opened. Click "Record Mic" to capture audio.');
  };

  const handleAudioUploadedInFolder = async (folderId: string, file: File) => {
    const tempUrl = URL.createObjectURL(file);
    const tempAudio = new Audio(tempUrl);

    tempAudio.onloadedmetadata = async () => {
      let audioDuration =
        isFinite(tempAudio.duration) && tempAudio.duration > 0
          ? Math.round(tempAudio.duration)
          : 0;

      if (audioDuration === 0) {
        try {
          const buffer = await file.arrayBuffer();
          const actx = new (window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
          const decoded = await actx.decodeAudioData(buffer);
          audioDuration = Math.round(decoded.duration);
          actx.close().catch(() => {});
        } catch {
          audioDuration = 0;
        }
      }
      URL.revokeObjectURL(tempUrl);

      const newSessionId = `session-${Date.now()}`;
      const title = file.name.replace(/\.[^/.]+$/, '');
      const newSession: Session = {
        id: newSessionId,
        title,
        folderId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        duration: audioDuration,
        audioBlob: file,
        audioMimeType: file.type,
        audioFileName: file.name,
      };

      await dbService.saveSession(newSession);
      const updatedSessions = await dbService.getAllSessions();
      setSessions(updatedSessions);
      setCurrentSessionId(newSessionId);
      setDuration(audioDuration);
      setCurrentView('workspace');

      const usage = await dbService.estimateStorageUsage();
      setStorageUsage(usage);
      showToast(`Uploaded "${file.name}" to folder!`);
    };

    tempAudio.onerror = () => {
      URL.revokeObjectURL(tempUrl);
      showToast('Could not load audio file. Please check format.');
    };
  };

  // Open confirmation modal for soft deletion (move to bin)
  const handleDeleteSession = (sessionId: string) => {
    setIsHardDeletePending(false);
    setSessionPendingDeletion(sessionId);
  };

  // Open confirmation modal for permanent hard deletion
  const handleHardDeleteSession = (sessionId: string) => {
    setIsHardDeletePending(true);
    setSessionPendingDeletion(sessionId);
  };

  // Restore session from Bin back to active folder
  const handleRestoreSession = async (sessionId: string) => {
    await dbService.restoreSession(sessionId);
    const updatedSessions = await dbService.getAllSessions();
    setSessions(updatedSessions);
    showToast('Session restored to folder.');
  };

  // Empty all expired/deleted sessions from Bin
  const handleEmptyBin = async () => {
    const deleted = sessions.filter((s) => !!s.deletedAt);
    if (deleted.length === 0) return;
    for (const s of deleted) {
      await dbService.hardDeleteSession(s.id);
    }
    const updatedSessions = await dbService.getAllSessions();
    setSessions(updatedSessions);
    const usage = await dbService.estimateStorageUsage();
    setStorageUsage(usage);
    showToast('Bin emptied successfully.');
  };

  const handleConfirmDeleteSession = async () => {
    if (!sessionPendingDeletion) return;
    const sessionId = sessionPendingDeletion;
    const wasPermanent = isHardDeletePending;

    if (wasPermanent) {
      await dbService.hardDeleteSession(sessionId);
    } else {
      await dbService.deleteSession(sessionId);
    }

    const updatedSessions = await dbService.getAllSessions();
    setSessions(updatedSessions);

    if (currentSessionId === sessionId) {
      const activeRemaining = updatedSessions.filter((s) => !s.deletedAt);
      setCurrentSessionId(activeRemaining[0]?.id || null);
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }
      setDuration(0);
      setCurrentTime(0);
    }

    const usage = await dbService.estimateStorageUsage();
    setStorageUsage(usage);
    setSessionPendingDeletion(null);
    setIsHardDeletePending(false);
    showToast(wasPermanent ? 'Session permanently deleted.' : 'Session moved to Bin (90-day retention).');
  };

  const handleCancelDeleteSession = () => {
    setSessionPendingDeletion(null);
    setIsHardDeletePending(false);
  };

  // 5. Notes management
  const handleAddNote = async (
    content: string,
    timestamp: number,
    calloutType: CalloutType,
    dueDate?: number
  ) => {
    if (!currentSessionId) return;

    const newNote: Note = {
      id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      sessionId: currentSessionId,
      timestamp: Math.round(timestamp),
      content,
      calloutType,
      dueDate,
      completed: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await dbService.saveNote(newNote);
    const updatedNotes = await dbService.getNotesBySession(currentSessionId);
    setNotes(updatedNotes);

    // Update session updatedAt timestamp
    if (currentSession) {
      const updatedSess = { ...currentSession, updatedAt: Date.now() };
      await dbService.saveSession(updatedSess);
      const allSess = await dbService.getAllSessions();
      setSessions(allSess);
    }
  };

  const handleUpdateNote = async (updatedNote: Note) => {
    await dbService.saveNote(updatedNote);
    if (currentSessionId) {
      const updatedNotes = await dbService.getNotesBySession(currentSessionId);
      setNotes(updatedNotes);
    }
  };

  const handleDeleteNote = async (id: string) => {
    await dbService.deleteNote(id);
    if (currentSessionId) {
      const updatedNotes = await dbService.getNotesBySession(currentSessionId);
      setNotes(updatedNotes);
    }
  };

  const handleSaveTranscript = async (
    transcriptText: string,
    chunks?: TranscriptionChunk[],
    sessionId?: string
  ) => {
    const targetId = sessionId || currentSessionId;
    if (!targetId) return;

    const targetSession = sessions.find((s) => s.id === targetId);
    if (!targetSession) return;

    const updatedSession: Session = {
      ...targetSession,
      transcript: transcriptText,
      chunks: chunks || targetSession.chunks,
      updatedAt: Date.now(),
    };

    await dbService.saveSession(updatedSession);
    setSessions((prev) =>
      prev.map((s) => (s.id === updatedSession.id ? updatedSession : s))
    );
  };

  const handleUploadSlide = async (file: File, timestamp?: number) => {
    if (!currentSessionId) return;
    const session = sessions.find((s) => s.id === currentSessionId);
    if (!session) return;

    const targetTimestamp =
      typeof timestamp === 'number'
        ? timestamp
        : currentTime > 0
        ? Math.round(currentTime)
        : undefined;

    const isPdf =
      file.name.toLowerCase().endsWith('.pdf') ||
      file.type === 'application/pdf';

    if (isPdf) {
      showToast(`Extracting pages from PDF "${file.name}"...`);
      try {
        const extracted = await parsePdfSlides(file);
        if (extracted.length === 0) {
          showToast('No pages found in PDF.');
          return;
        }

        const newSlides: SessionImage[] = extracted.map((s, idx) => ({
          id: `slide-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
          blob: s.blob,
          name: s.name,
          timestamp: targetTimestamp,
          createdAt: Date.now() + idx,
        }));

        const currentImages = session.images || [];
        const updatedSession: Session = {
          ...session,
          images: [...currentImages, ...newSlides],
          updatedAt: Date.now(),
        };

        await dbService.saveSession(updatedSession);
        setSessions((prev) =>
          prev.map((s) => (s.id === updatedSession.id ? updatedSession : s))
        );
        showToast(`Imported ${newSlides.length} PDF page${newSlides.length > 1 ? 's' : ''}!`);
        return;
      } catch (err) {
        console.error('Failed to parse PDF:', err);
        showToast('Could not extract pages from PDF.');
        return;
      }
    }

    const newSlide: SessionImage = {
      id: `slide-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      blob: file,
      name: file.name,
      timestamp: targetTimestamp,
      createdAt: Date.now(),
    };

    const currentImages = session.images || [];
    const updatedSession: Session = {
      ...session,
      images: [...currentImages, newSlide],
      updatedAt: Date.now(),
    };

    await dbService.saveSession(updatedSession);
    setSessions((prev) =>
      prev.map((s) => (s.id === updatedSession.id ? updatedSession : s))
    );
    showToast(`Attached slide "${file.name}"`);
  };

  const handleDeleteSlide = async (slideId: string) => {
    if (!currentSessionId) return;
    const session = sessions.find((s) => s.id === currentSessionId);
    if (!session || !session.images) return;

    const updatedImages = session.images.filter((img) => img.id !== slideId);
    const updatedSession: Session = {
      ...session,
      images: updatedImages,
      updatedAt: Date.now(),
    };

    await dbService.saveSession(updatedSession);
    setSessions((prev) =>
      prev.map((s) => (s.id === updatedSession.id ? updatedSession : s))
    );
    showToast('Slide removed');
  };

  const handleUpdateSlideTimestamp = async (slideId: string, timestamp?: number) => {
    if (!currentSessionId) return;
    const session = sessions.find((s) => s.id === currentSessionId);
    if (!session || !session.images) return;

    const updatedImages = session.images.map((img) =>
      img.id === slideId ? { ...img, timestamp } : img
    );
    const updatedSession: Session = {
      ...session,
      images: updatedImages,
      updatedAt: Date.now(),
    };

    await dbService.saveSession(updatedSession);
    setSessions((prev) =>
      prev.map((s) => (s.id === updatedSession.id ? updatedSession : s))
    );
    if (typeof timestamp === 'number') {
      showToast(`Slide linked to ${formatTime(timestamp)}`);
    } else {
      showToast('Slide unlinked from timestamp');
    }
  };

  const handleUpdateSlideAnnotation = async (slideId: string, annotationDataUrl?: string) => {
    if (!currentSessionId) return;
    const updated = await dbService.updateSlideAnnotation(currentSessionId, slideId, annotationDataUrl);
    if (updated) {
      setSessions((prev) =>
        prev.map((s) => (s.id === currentSessionId ? updated : s))
      );
    }
  };

  const handleUpdateSessionTitle = async (sessionId: string, newTitle: string) => {
    const updated = await dbService.updateSessionTitle(sessionId, newTitle);
    if (updated) {
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? updated : s))
      );
      showToast(`Renamed to "${updated.title}"`);
    }
  };

  // Local In-Browser Transcription Handler (Transformers.js Whisper via Web Worker)
  const handleTranscribeAudio = async () => {
    if (!currentSession?.audioBlob) {
      showToast('Please record or upload an audio track first.');
      return;
    }

    if (isTranscribing) {
      showToast('Transcription already running in background...');
      return;
    }

    setIsTranscribing(true);
    setTranscriptionProgress(0);
    setTranscriptionStatus('Initializing Moonshine model...');
    setTranscriptionDetail('Loading onnx-community/moonshine-tiny-ONNX via Web Worker (Q4 WASM)...');
    setTranscriptionElapsed(0);
    setTranscriptionEta(undefined);

    try {
      const result = await transcriptionService.transcribe(
        currentSession.audioBlob,
        (progress: TranscriptionProgress) => {
          setTranscriptionProgress(progress.percent || 0);
          setTranscriptionStatus(progress.message);
          if (progress.detail) {
            setTranscriptionDetail(progress.detail);
          }
          if (typeof progress.elapsedTime === 'number') {
            setTranscriptionElapsed(progress.elapsedTime);
          }
          if (typeof progress.estimatedTimeRemaining === 'number') {
            setTranscriptionEta(progress.estimatedTimeRemaining);
          }
        }
      );

      // Format transcription chunks with timestamps
      let formattedTranscript = '';
      if (result.chunks && result.chunks.length > 0) {
        const lines = result.chunks
          .map((chunk) => {
            const startSec = Math.round(chunk.timestamp[0]);
            const endSec = Math.round(chunk.timestamp[1]);
            const startStr = formatTime(startSec);
            const endStr = formatTime(endSec);
            const cleanText = chunk.text.trim();
            if (!cleanText) return null;
            return `[${startStr} - ${endStr}] ${cleanText}`;
          })
          .filter(Boolean);

        if (lines.length > 0) {
          formattedTranscript = lines.join('\n\n');
        } else {
          formattedTranscript = `[00:00] ${(result.text || '').trim() || 'No clear speech detected.'}`;
        }
      } else {
        const cleanText = (result.text || '').trim() || 'No recognizable speech detected.';
        formattedTranscript = `[00:00] ${cleanText}`;
      }

      // Save directly to session transcript and chunks
      await handleSaveTranscript(formattedTranscript, result.chunks);

      showToast('Audio transcribed successfully! Saved to transcript tab.');
    } catch (err: unknown) {
      console.error('Transcription error:', err);
      const msg = err instanceof Error ? err.message : 'Transcription failed.';
      showToast(`Transcription error: ${msg}`);
    } finally {
      setIsTranscribing(false);
      setTranscriptionProgress(0);
      setTranscriptionStatus('');
      setTranscriptionDetail('');
      setTranscriptionElapsed(undefined);
      setTranscriptionEta(undefined);
    }
  };

  const handleCancelTranscription = () => {
    transcriptionService.cancel();
    setIsTranscribing(false);
    setTranscriptionProgress(0);
    setTranscriptionStatus('');
    setTranscriptionDetail('');
    setTranscriptionElapsed(undefined);
    setTranscriptionEta(undefined);
    showToast('Transcription cancelled.');
  };

  // 6. Folders management
  const handleCreateFolder = async (name: string, color: string) => {
    const newFolder: Folder = {
      id: `folder-${Date.now()}`,
      name,
      color,
    };
    await dbService.saveFolder(newFolder);
    const updated = await dbService.getAllFolders();
    setFolders(updated);
    setActiveFolderId(newFolder.id);
  };

  const handleDeleteFolder = async (folderId: string) => {
    await dbService.deleteFolder(folderId);
    const updated = await dbService.getAllFolders();
    setFolders(updated);
    if (activeFolderId === folderId) {
      setActiveFolderId('all');
    }
  };

  // 7. Settings update
  const handleUpdateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...newSettings };
      dbService.saveSettings(next);
      return next;
    });
  };

  // 8. Standalone HTML Export feature
  const handleExportStandaloneHtml = async () => {
    if (!currentSession) {
      showToast('Please select a session first.');
      return;
    }

    try {
      const folder = folders.find((f) => f.id === currentSession.folderId);
      const folderName = folder ? folder.name : 'General';
      const htmlContent = await generateStandaloneHtml(currentSession, notes, folderName);
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentSession.title.replace(/\s+/g, '_')}_Offline.html`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Standalone single-file HTML exported!');
    } catch (err) {
      console.error('Standalone HTML export error:', err);
      showToast('HTML export error.');
    }
  };

  // Global keyboard shortcuts listener
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isInputFocused =
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement;

      // 1. Toggle Shortcuts Cheat Sheet: '?' (Shift+/) or Cmd/Ctrl + /
      if ((e.key === '?' || (e.shiftKey && e.key === '/')) && !isInputFocused) {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
        return;
      }

      // 2. Escape: dismiss modal or mobile drawer
      if (e.key === 'Escape') {
        if (isShortcutsOpen) {
          e.preventDefault();
          setIsShortcutsOpen(false);
          return;
        }
        if (isMobileSidebarOpen) {
          e.preventDefault();
          setIsMobileSidebarOpen(false);
          return;
        }
      }

      // Modifier key check based on OS platform
      const isModifierPressed = isApplePlatform ? e.metaKey : e.ctrlKey;

      // 3. Ctrl+M or Cmd+M: capture timestamped note
      if (isModifierPressed && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        setShowMobileNotes(true);
        setQuickAddTriggered(true);
        return;
      }

      // 4. Toggle Dyslexic font mode: Ctrl+D or Cmd+D
      if (isModifierPressed && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setSettings((prev) => {
          const nextFont: FontMode = prev.fontMode === 'dyslexic' ? 'standard' : 'dyslexic';
          const updated = { ...prev, fontMode: nextFont };
          dbService.saveSettings(updated);
          showToast(nextFont === 'dyslexic' ? 'OpenDyslexic font enabled' : 'Standard font enabled');
          return updated;
        });
        return;
      }

      // 5. Toggle theme: Ctrl+B or Cmd+B
      if (isModifierPressed && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setSettings((prev) => {
          const themes: ThemeMode[] = ['light', 'dark', 'sepia'];
          const currentIndex = themes.indexOf(prev.theme);
          const nextTheme = themes[(currentIndex !== -1 ? currentIndex + 1 : 0) % themes.length];
          const updated = { ...prev, theme: nextTheme };
          dbService.saveSettings(updated);
          showToast(`Theme: ${nextTheme.toUpperCase()}`);
          return updated;
        });
        return;
      }

      // Audio & Playback controls (active only when not typing in text fields)
      if (!isInputFocused) {
        // Space: Toggle Play / Pause
        if (e.key === ' ' || e.code === 'Space') {
          e.preventDefault();
          handlePlayPause();
          return;
        }

        // Shift + E: Toggle Enhance Audio (Dynamics Compressor & Vocal EQ)
        if (e.shiftKey && e.key.toLowerCase() === 'e') {
          e.preventDefault();
          handleToggleAudioEnhanced();
          return;
        }

        // Shift + T: Transcribe current audio recording locally with Whisper
        if (e.shiftKey && e.key.toLowerCase() === 't') {
          e.preventDefault();
          handleTranscribeAudio();
          return;
        }

        // Shift + Left Arrow: Rewind 5 seconds
        if (e.shiftKey && e.key === 'ArrowLeft') {
          e.preventDefault();
          if (audioRef.current) {
            handleSeek(Math.max(0, audioRef.current.currentTime - 5));
          }
          return;
        }

        // Shift + Right Arrow: Fast forward 5 seconds
        if (e.shiftKey && e.key === 'ArrowRight') {
          e.preventDefault();
          if (audioRef.current) {
            handleSeek(Math.min(duration, audioRef.current.currentTime + 5));
          }
          return;
        }

        // Shift + Up Arrow: Volume up
        if (e.shiftKey && e.key === 'ArrowUp') {
          e.preventDefault();
          handleVolumeChange(Math.min(1, parseFloat((settings.volume + 0.1).toFixed(2))));
          return;
        }

        // Shift + Down Arrow: Volume down
        if (e.shiftKey && e.key === 'ArrowDown') {
          e.preventDefault();
          handleVolumeChange(Math.max(0, parseFloat((settings.volume - 0.1).toFixed(2))));
          return;
        }

        // Decrease playback speed: '['
        if (e.key === '[') {
          e.preventDefault();
          const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
          const curIdx = speeds.indexOf(settings.playbackRate);
          const newIdx = Math.max(0, (curIdx === -1 ? 2 : curIdx) - 1);
          handleRateChange(speeds[newIdx]);
          showToast(`Playback speed: ${speeds[newIdx]}x`);
          return;
        }

        // Increase playback speed: ']'
        if (e.key === ']') {
          e.preventDefault();
          const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
          const curIdx = speeds.indexOf(settings.playbackRate);
          const newIdx = Math.min(speeds.length - 1, (curIdx === -1 ? 2 : curIdx) + 1);
          handleRateChange(speeds[newIdx]);
          showToast(`Playback speed: ${speeds[newIdx]}x`);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [
    isShortcutsOpen,
    isMobileSidebarOpen,
    isPlaying,
    duration,
    settings.volume,
    settings.playbackRate,
    settings.theme,
    settings.fontMode,
  ]);

  // Sync root element classes with global theme state
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'sepia');
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else if (settings.theme === 'sepia') {
      root.classList.add('sepia');
    }
  }, [settings.theme]);

  // Theme styling classes
  const themeClasses: Record<ThemeMode, string> = {
    light: 'bg-neutral-50 text-neutral-900',
    dark: 'dark bg-neutral-950 text-neutral-100',
    sepia: 'sepia bg-[#F4ECD8] text-[#272016]',
  };

  const fontClass = settings.fontMode === 'dyslexic' ? 'font-dyslexic' : 'font-standard';

  return (
    <div
      data-theme={settings.theme}
      className={`w-screen h-screen flex flex-col overflow-hidden ${
        themeClasses[settings.theme] || themeClasses.light
      } ${fontClass}`}
    >
      {/* Hidden audio element for persistent playback */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={() => {
            if (audioRef.current && isFinite(audioRef.current.currentTime)) {
              setCurrentTime(audioRef.current.currentTime);
            }
          }}
          onDurationChange={() => {
            if (
              audioRef.current &&
              isFinite(audioRef.current.duration) &&
              audioRef.current.duration > 0
            ) {
              setDuration(audioRef.current.duration);
            }
          }}
          onLoadedMetadata={() => {
            const audio = audioRef.current;
            if (!audio) return;

            if (!isFinite(audio.duration) || audio.duration === Infinity) {
              // Standard seeking hack for Chromium MediaRecorder WebM blobs without duration headers:
              // Temporarily seek to 1e101 to force browser to parse cluster timestamps to EOF,
              // wait for seeked event to get true duration, then instantly reset currentTime back to 0.
              const onSeeked = () => {
                audio.removeEventListener('seeked', onSeeked);
                const trueDuration =
                  isFinite(audio.duration) && audio.duration > 0
                    ? audio.duration
                    : currentSession?.duration || 0;

                setDuration(trueDuration);
                audio.currentTime = 0;

                // Sync resolved duration back to IndexedDB if session was missing it
                if (
                  currentSession &&
                  (!currentSession.duration || currentSession.duration <= 0) &&
                  trueDuration > 0
                ) {
                  const updated = { ...currentSession, duration: Math.round(trueDuration) };
                  dbService.saveSession(updated).then(() => {
                    setSessions((prev) =>
                      prev.map((s) => (s.id === updated.id ? updated : s))
                    );
                  });
                }
              };

              audio.addEventListener('seeked', onSeeked, { once: true });
              audio.currentTime = 1e101;
            } else if (audio.duration > 0) {
              setDuration(audio.duration);
            } else if (currentSession?.duration) {
              setDuration(currentSession.duration);
            }
          }}
          onEnded={() => setIsPlaying(false)}
        />
      )}

      {/* Top Bar Contract (Clean 1-row, 3-zone) */}
      <header className="h-13 border-b border-[#e8e4dc] dark:border-stone-800 bg-[#fcfbf9] dark:bg-stone-900 px-4 md:px-6 flex items-center justify-between shrink-0 select-none z-20">
        {/* Zone 1: Brand / Navigation Trigger */}
        <div className="flex items-center gap-2 sm:gap-3">
          {currentView === 'workspace' ? (
            <button
              onClick={() => setCurrentView('dashboard')}
              title="Return to Folder Dashboard"
              className="py-1.5 px-3 rounded-xl bg-white dark:bg-stone-800 hover:bg-[#f0ece4] dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-[#e8e4dc] dark:border-stone-700 shadow-2xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Folders</span>
            </button>
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-2xs">
                <Headphones className="w-4 h-4" />
              </div>
              <div>
                <span className="text-base font-bold tracking-tight text-stone-900 dark:text-white leading-tight">
                  Pinpoint Audio
                </span>
              </div>
            </div>
          )}

          {currentView === 'workspace' && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-stone-500 border-l border-[#e8e4dc] dark:border-stone-700 pl-3 ml-1">
              <span className="font-semibold text-stone-900 dark:text-stone-200 truncate max-w-[200px]">
                {currentSession ? currentSession.title : 'Active Session'}
              </span>
            </div>
          )}
        </div>

        {/* Zone 2: Clean Center Indicator */}
        <div className="hidden md:flex items-center gap-2 text-xs font-medium text-stone-600 dark:text-stone-400">
          {currentView === 'workspace' ? (
            <span>
              {notes.length} {notes.length === 1 ? 'note' : 'notes'}
            </span>
          ) : (
            <>
              <span>{folders.length} Folders</span>
              <span aria-hidden="true" className="text-stone-300 dark:text-stone-700">·</span>
              <span>{sessions.filter((s) => !s.deletedAt).length} Recordings</span>
            </>
          )}
        </div>

        {/* Zone 3: Quick Action & Accessibility Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Typography Toggle: Standard vs OpenDyslexic */}
          <button
            onClick={() =>
              handleUpdateSettings({
                fontMode: settings.fontMode === 'dyslexic' ? 'standard' : 'dyslexic',
              })
            }
            title="Toggle OpenDyslexic Font"
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs ${
              settings.fontMode === 'dyslexic'
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 border-[#e8e4dc] dark:border-stone-700 hover:bg-[#f0ece4]'
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {settings.fontMode === 'dyslexic' ? 'Dyslexic ON' : 'Sans'}
            </span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={() => {
              const themes: ThemeMode[] = ['light', 'dark', 'sepia'];
              const currentIndex = themes.indexOf(settings.theme);
              const nextTheme = themes[(currentIndex !== -1 ? currentIndex + 1 : 0) % themes.length];
              handleUpdateSettings({ theme: nextTheme });
            }}
            title="Cycle Theme (Light → Dark → Sepia)"
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-[#e8e4dc] dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:bg-[#f0ece4] dark:hover:bg-stone-700 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
          >
            {settings.theme === 'dark' ? (
              <Moon className="w-3.5 h-3.5 text-indigo-400" />
            ) : settings.theme === 'sepia' ? (
              <Palette className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
            ) : (
              <Sun className="w-3.5 h-3.5 text-amber-500" />
            )}
            <span className="hidden sm:inline capitalize">{settings.theme}</span>
          </button>

          {/* Import Audio Action in Header */}
          <button
            onClick={() => mainAudioImportRef.current?.click()}
            title="Import Audio File (.webm, .m4a, .mp3, .wav)"
            className="px-2.5 py-1.5 rounded-xl border border-[#e8e4dc] dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:bg-[#f0ece4] dark:hover:bg-stone-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
          >
            <Upload className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span className="hidden sm:inline">Import Audio</span>
          </button>
          <input
            ref={mainAudioImportRef}
            type="file"
            accept="audio/webm, audio/mp4, audio/mp3, audio/wav, audio/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleAudioUploaded(e.target.files[0]);
                e.target.value = '';
              }
            }}
          />

          {/* Local Folder Auto-Save Button (Chrome/Edge File System Access API) */}
          {isFsSupported ? (
            <button
              onClick={handleSelectLocalFolder}
              title={
                localDirName
                  ? `Recordings auto-save directly to local folder /${localDirName}. Click to change folder.`
                  : 'Pick a folder on your computer to auto-save recordings to disk (File System Access API)'
              }
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs ${
                localDirName
                  ? 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                  : 'border-[#e8e4dc] dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:bg-[#f0ece4] dark:hover:bg-stone-700'
              }`}
            >
              <HardDrive className={`w-3.5 h-3.5 ${localDirName ? 'text-amber-600 dark:text-amber-400' : 'text-indigo-600 dark:text-indigo-400'}`} />
              <span className="hidden sm:inline">
                {localDirName ? `📁 Saving to: /${localDirName}` : 'Set Local Folder'}
              </span>
            </button>
          ) : (
            <div
              title="Direct local folder writing requires Chrome, Edge, or Opera (File System Access API)"
              className="px-2.5 py-1.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-100 dark:bg-stone-800/60 text-stone-400 dark:text-stone-500 text-xs font-medium flex items-center gap-1.5 cursor-not-allowed select-none opacity-80"
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Local Folder (Chrome/Edge only)</span>
            </div>
          )}

          {/* WebRTC P2P Device Sync Button */}
          <button
            onClick={() => setIsSyncOpen(true)}
            title="Open WebRTC P2P Device Sync"
            className="px-2.5 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-800/80 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden sm:inline">P2P Sync</span>
          </button>

          {/* PWA Install Button */}
          <PWAInstallButton variant="header" />

          {/* Keyboard Shortcuts Trigger Button */}
          <button
            onClick={() => setIsShortcutsOpen(true)}
            title="Keyboard Shortcuts Cheat Sheet (?)"
            className="px-2.5 py-1.5 rounded-xl border border-[#e8e4dc] dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:bg-[#f0ece4] dark:hover:bg-stone-700 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
          >
            <Keyboard className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
            <kbd className="px-1 py-0.2 rounded bg-[#f0ece4] dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-[10px] font-mono">
              ?
            </kbd>
          </button>

          {currentView === 'workspace' && currentSession && (
            <button
              onClick={() => handleExportNotes(currentSession)}
              disabled={!hasSessionExportableContent(currentSession, notes)}
              title={
                hasSessionExportableContent(currentSession, notes)
                  ? 'Export session notes & transcript as Markdown (.md)'
                  : 'No notes or transcript available to export'
              }
              className="px-2.5 py-1.5 rounded-xl border border-[#e8e4dc] dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:bg-[#f0ece4] dark:hover:bg-stone-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FileDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="hidden sm:inline">Export Notes</span>
            </button>
          )}

          {currentView === 'workspace' && (
            <button
              onClick={() => {
                setShowMobileNotes(true);
                setQuickAddTriggered(true);
              }}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Add Note</span>
              <kbd className="hidden lg:inline text-[10px] bg-indigo-700/80 px-1 py-0.2 rounded font-sans">
                {modifierKey}M
              </kbd>
            </button>
          )}
        </div>
      </header>

      {/* Main App Content: Dashboard View vs Workspace View */}
      {currentView === 'dashboard' ? (
        <DashboardView
          folders={folders}
          sessions={sessions}
          selectedFolderId={selectedFolderForDrilldown}
          storageUsage={storageUsage}
          onSelectFolder={(folderId) => setSelectedFolderForDrilldown(folderId)}
          onOpenSession={handleOpenSessionFromDashboard}
          onCreateFolder={handleCreateFolder}
          onDeleteFolder={handleDeleteFolder}
          onCreateSessionInFolder={handleCreateSessionInFolder}
          onDeleteSession={handleDeleteSession}
          onRestoreSession={handleRestoreSession}
          onHardDeleteSession={handleHardDeleteSession}
          onEmptyBin={handleEmptyBin}
          onAudioUploadedInFolder={handleAudioUploadedInFolder}
          onImportAudio={handleAudioUploaded}
          onExportStandaloneHtml={handleExportStandaloneHtml}
          onOpenShortcuts={() => setIsShortcutsOpen(true)}
          onOpenSync={() => setIsSyncOpen(true)}
          localDirName={localDirName}
          onSelectLocalFolder={handleSelectLocalFolder}
          onShowToast={showToast}
        />
      ) : (
        /* Workspace View: Split-Screen Editor on Desktop, Tabbed Switcher on Mobile */
        <div className="flex-1 flex overflow-hidden relative">
          {/* Left Panel: Audio Interface & Scrubber */}
          <div className={`${showMobileNotes ? 'hidden md:block' : 'block'} w-full md:w-[380px] lg:w-[420px] shrink-0 h-full`}>
            <AudioPlayer
              currentSession={currentSession}
              notes={notes}
              currentTime={currentTime}
              duration={duration}
              isPlaying={isPlaying}
              playbackRate={settings.playbackRate}
              volume={settings.volume}
              isAudioEnhanced={!!settings.isAudioEnhanced}
              isTranscribing={isTranscribing}
              transcriptionProgress={transcriptionProgress}
              transcriptionStatus={transcriptionStatus}
              transcriptionDetail={transcriptionDetail}
              transcriptionElapsed={transcriptionElapsed}
              transcriptionEta={transcriptionEta}
              onToggleAudioEnhanced={handleToggleAudioEnhanced}
              onTimeUpdate={setCurrentTime}
              onDurationChange={setDuration}
              onPlayPause={handlePlayPause}
              onSeek={handleSeek}
              onRateChange={handleRateChange}
              onVolumeChange={handleVolumeChange}
              onStartRecording={handleStartRecording}
              onAudioRecorded={handleAudioRecorded}
              onAudioUploaded={handleAudioUploaded}
              onTriggerAddNote={() => {
                setShowMobileNotes(true);
                setQuickAddTriggered(true);
              }}
              onOpenMobileNotes={() => setShowMobileNotes(true)}
              onTranscribeAudio={handleTranscribeAudio}
              onCancelTranscription={handleCancelTranscription}
              onSaveTranscript={handleSaveTranscript}
              onUploadSlide={handleUploadSlide}
              onDiscardAudio={handleDiscardAudio}
              onUpdateTitle={(newTitle) => {
                if (currentSessionId) {
                  handleUpdateSessionTitle(currentSessionId, newTitle);
                }
              }}
              onExportNotes={handleExportNotes}
            />
          </div>

          {/* Right Panel: Structured Notes Feed, Composer & Dedicated Transcript View */}
          <div className={`${!showMobileNotes ? 'hidden md:block' : 'block'} flex-1 h-full min-w-0`}>
            <NotesFeed
              currentSession={currentSession}
              notes={notes}
              currentTime={currentTime}
              onSeek={handleSeek}
              onAddNote={handleAddNote}
              onUpdateNote={handleUpdateNote}
              onDeleteNote={handleDeleteNote}
              isQuickAddRequested={quickAddTriggered}
              onResetQuickAdd={() => setQuickAddTriggered(false)}
              onTranscribeAudio={handleTranscribeAudio}
              isTranscribing={isTranscribing}
              onSaveTranscript={handleSaveTranscript}
              onBackToRecording={() => setShowMobileNotes(false)}
              onUploadSlide={handleUploadSlide}
              onDeleteSlide={handleDeleteSlide}
              onUpdateSlideTimestamp={handleUpdateSlideTimestamp}
              onUpdateSlideAnnotation={handleUpdateSlideAnnotation}
            />
          </div>
        </div>
      )}

      {/* Floating Notification Toast */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 px-4 py-2.5 rounded-xl shadow-lg border border-neutral-700 dark:border-neutral-200 text-xs flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <Sparkles className="w-4 h-4 text-indigo-400 dark:text-indigo-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Keyboard Shortcuts Cheat Sheet Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* Session Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!sessionPendingDeletion}
        session={sessions.find((s) => s.id === sessionPendingDeletion) || null}
        isPermanent={isHardDeletePending}
        onConfirm={handleConfirmDeleteSession}
        onCancel={handleCancelDeleteSession}
      />

      {/* WebRTC P2P Device Sync Modal */}
      <SyncPanel
        isOpen={isSyncOpen}
        onClose={() => setIsSyncOpen(false)}
        onSyncCompleted={handleReloadLibrary}
      />

      {/* First-Time Offline Data Storage Warning Modal */}
      <OnboardingWarning />
    </div>
  );
}
