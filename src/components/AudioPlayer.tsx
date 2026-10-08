import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  Square,
  Play,
  Pause,
  RotateCcw,
  Upload,
  Volume2,
  VolumeX,
  FileAudio,
  PlusCircle,
  AlertCircle,
  Clock,
  Sparkles,
  Sliders,
  FileText,
  Loader2,
  XCircle,
  Monitor,
  Download,
  RotateCw,
  Image as ImageIcon,
  Paperclip,
  X,
  Edit2,
  Check,
  CheckCircle2,
  Trash2,
  RefreshCw,
  FileDown,
} from 'lucide-react';
import { Note, Session, TranscriptionChunk } from '../types';
import { formatTime, downloadNativeAudio } from '../utils/audio';
import { modifierKey } from '../utils/platform';
import { exportSessionToMarkdown, generateMarkdownString, hasSessionExportableContent } from '../services/exportService';
import { checkWebGPUSupport } from '../utils/webgpu';
import { speechService } from '../services/speechService';
import { fileSystemService } from '../services/fileSystemService';

interface AudioPlayerProps {
  currentSession: Session | null;
  notes: Note[];
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  playbackRate: number;
  volume: number;
  isAudioEnhanced: boolean;
  isTranscribing?: boolean;
  transcriptionProgress?: number;
  transcriptionStatus?: string;
  transcriptionDetail?: string;
  transcriptionElapsed?: number;
  transcriptionEta?: number;
  onToggleAudioEnhanced: () => void;
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onRateChange: (rate: number) => void;
  onVolumeChange: (vol: number) => void;
  onStartRecording?: (mode?: 'mic' | 'meeting') => Promise<string>;
  onAudioRecorded: (
    blob: Blob,
    duration: number,
    fileName: string,
    targetSessionId?: string,
    transcript?: string,
    chunks?: TranscriptionChunk[]
  ) => void;
  onAudioUploaded: (file: File) => void;
  onTriggerAddNote: () => void;
  onOpenMobileNotes?: () => void;
  onTranscribeAudio?: () => void;
  onCancelTranscription?: () => void;
  onSaveTranscript?: (
    transcript: string,
    chunks?: TranscriptionChunk[],
    sessionId?: string
  ) => void;
  onUploadSlide?: (file: File) => void;
  onOpenSlides?: () => void;
  onUpdateTitle?: (newTitle: string) => void;
  onDiscardAudio?: () => void;
  onExportNotes?: (session: Session) => void;
  onShowToast?: (msg: string) => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  currentSession,
  notes,
  currentTime,
  duration,
  isPlaying,
  playbackRate,
  volume,
  isAudioEnhanced,
  isTranscribing = false,
  transcriptionProgress = 0,
  transcriptionStatus = '',
  transcriptionDetail = '',
  transcriptionElapsed,
  transcriptionEta,
  onToggleAudioEnhanced,
  onTimeUpdate,
  onPlayPause,
  onSeek,
  onRateChange,
  onVolumeChange,
  onStartRecording,
  onAudioRecorded,
  onAudioUploaded,
  onTriggerAddNote,
  onOpenMobileNotes,
  onTranscribeAudio,
  onCancelTranscription,
  onSaveTranscript,
  onUploadSlide,
  onOpenSlides,
  onUpdateTitle,
  onDiscardAudio,
  onExportNotes,
  onShowToast,
}) => {
  // Session Title inline editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(currentSession?.title || '');
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  // Manual Note Export: writes to local folder if configured and permitted, else triggers browser download
  const handleExportNotesClick = async () => {
    if (!currentSession) return;
    if (onExportNotes) {
      onExportNotes(currentSession);
      return;
    }

    if (fileSystemService.isSupported()) {
      const handle = await fileSystemService.getStoredHandle();
      if (handle) {
        const hasPerm = await fileSystemService.verifyPermission(handle);
        if (hasPerm) {
          const mdString = generateMarkdownString(currentSession, notes);
          const mdBlob = new Blob([mdString], { type: 'text/markdown;charset=utf-8' });
          const safeTitle = (currentSession.title || 'Lecture-Notes')
            .replace(/[\\/:*?"<>|]/g, '_')
            .trim() || 'Lecture-Notes';
          const mdFileName = `${safeTitle}.md`;
          const saved = await fileSystemService.saveFileToDirectory(mdFileName, mdBlob);
          if (saved) {
            if (onShowToast) {
              onShowToast(`Saved notes to local folder: ${mdFileName}`);
            }
            return;
          }
        }
      }
    }

    await exportSessionToMarkdown(currentSession, notes);
  };

  useEffect(() => {
    setTitleInput(currentSession?.title || '');
    setIsEditingTitle(false);
  }, [currentSession?.id, currentSession?.title]);

  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditingTitle]);

  const handleSaveTitle = () => {
    const trimmed = titleInput.trim();
    if (trimmed && trimmed !== currentSession?.title && onUpdateTitle) {
      onUpdateTitle(trimmed);
    } else {
      setTitleInput(currentSession?.title || '');
    }
    setIsEditingTitle(false);
  };

  const handleCancelTitle = () => {
    setTitleInput(currentSession?.title || '');
    setIsEditingTitle(false);
  };

  const hasExportableContent = hasSessionExportableContent(currentSession, notes);

  // WebGPU support state for diagnostics and UI warning banner
  const [hasWebGpu, setHasWebGpu] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    checkWebGPUSupport().then((supported) => {
      if (mounted) {
        setHasWebGpu(supported);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [recordingMode, setRecordingMode] = useState<'mic' | 'meeting'>('mic');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingSecondsRef = useRef<number>(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [recordingNotice, setRecordingNotice] = useState<string | null>(null);
  const [showMobileMeetingNotice, setShowMobileMeetingNotice] = useState(false);

  // Live Web Speech transcription state (Opt-in Hybrid Mode)
  const [useLiveTranscription, setUseLiveTranscription] = useState<boolean>(false);
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [liveInterimText, setLiveInterimText] = useState<string>('');
  const liveTranscriptRef = useRef<string>('');
  const liveChunksRef = useRef<Array<{ timestamp: [number, number]; text: string }>>([]);

  // References for recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const activeRecordingSessionIdRef = useRef<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const activeStreamsRef = useRef<MediaStream[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const slideFileInputRef = useRef<HTMLInputElement | null>(null);

  // Timeline hover state
  const [hoveredTime, setHoveredTime] = useState<number | null>(null);
  const timelineBarRef = useRef<HTMLDivElement | null>(null);

  // Clean up recording on unmount
  useEffect(() => {
    return () => {
      speechService.stop();
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      activeStreamsRef.current.forEach((str) => {
        str.getTracks().forEach((track) => track.stop());
      });
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  // Visualizer loop for live audio recording (Mic or Meeting Mix)
  const drawVisualizer = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const barWidth = (canvas.width / bufferLength) * 2.2;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * canvas.height * 0.9;

      // Clean indigo-emerald gradient
      const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
      gradient.addColorStop(0, '#6366F1');
      gradient.addColorStop(1, '#10B981');

      ctx.fillStyle = gradient;
      ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);

      x += barWidth;
    }

    animFrameRef.current = requestAnimationFrame(drawVisualizer);
  };

  // Start recording: supports 'mic' or 'meeting' (Teams/Zoom/System audio + Mic mix)
  const startRecording = async (mode: 'mic' | 'meeting' = 'mic') => {
    setMicError(null);
    setRecordingNotice(null);
    setRecordingMode(mode);
    liveChunksRef.current = [];

    // Mobile Environment Check: mobile browsers do not support getDisplayMedia system audio
    const isMobileDevice =
      typeof window !== 'undefined' &&
      (/android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getDisplayMedia);

    if (mode === 'meeting' && isMobileDevice) {
      setShowMobileMeetingNotice(true);
      return;
    }

    try {
      let streamToRecord: MediaStream;
      const audioCtx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      activeStreamsRef.current = [];

      if (mode === 'meeting') {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
          setShowMobileMeetingNotice(true);
          return;
        }

        // 1. Request screen/system audio
        let displayStream: MediaStream;
        try {
          displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true,
          });
        } catch (displayErr: unknown) {
          const errName =
            displayErr && typeof displayErr === 'object' && 'name' in displayErr
              ? (displayErr as { name: string }).name
              : '';
          if (errName === 'NotAllowedError' || errName === 'AbortError') {
            // User cancelled sharing prompt
            setIsRecording(false);
            if (audioCtx.state !== 'closed') audioCtx.close().catch(() => {});
            return;
          }
          throw displayErr;
        }

        activeStreamsRef.current.push(displayStream);

        // 2. Request microphone
        let micStream: MediaStream;
        try {
          micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
            },
          });
          activeStreamsRef.current.push(micStream);
        } catch (micErr) {
          displayStream.getTracks().forEach((track) => track.stop());
          throw new Error(
            'Microphone access is required to record meeting voice. ' +
              (micErr instanceof Error ? micErr.message : '')
          );
        }

        // 3. Verify displayStream contains an audio track
        const displayAudioTracks = displayStream.getAudioTracks();
        if (displayAudioTracks.length === 0) {
          displayStream.getTracks().forEach((track) => track.stop());
          micStream.getTracks().forEach((track) => track.stop());
          if (audioCtx.state !== 'closed') audioCtx.close().catch(() => {});
          const msg =
            'You forgot to check "Share audio" in the screen share dialog. Please click "Record Meeting" again and ensure the "Share audio" checkbox is enabled.';
          setMicError(msg);
          setIsRecording(false);
          return;
        }

        // 4. Create MediaStreamDestination
        const destination = audioCtx.createMediaStreamDestination();

        // 5. Connect both streams: createMediaStreamSource for mic & display audio
        const micSource = audioCtx.createMediaStreamSource(micStream);
        const displaySource = audioCtx.createMediaStreamSource(displayStream);

        micSource.connect(destination);
        displaySource.connect(destination);

        // Also connect to visualizer analyser
        micSource.connect(analyser);
        displaySource.connect(analyser);

        // 6. CRITICAL: Stop all video tracks on displayStream immediately so app only records mixed audio
        displayStream.getVideoTracks().forEach((track) => {
          track.stop();
        });

        // Graceful Stopping: Listen for user clicking native "Stop Sharing" button
        displayAudioTracks.forEach((track) => {
          track.addEventListener('ended', () => {
            stopRecording();
          });
        });

        // 7. Pass mixed destination.stream into MediaRecorder
        streamToRecord = destination.stream;
      } else {
        // Standard Microphone recording
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Microphone access is not supported in this browser.');
        }

        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        activeStreamsRef.current.push(micStream);

        const source = audioCtx.createMediaStreamSource(micStream);
        source.connect(analyser);

        streamToRecord = micStream;
      }

      // Select supported MIME type
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        'audio/wav',
      ];
      let selectedMime = '';
      for (const m of mimeTypes) {
        if (MediaRecorder.isTypeSupported(m)) {
          selectedMime = m;
          break;
        }
      }

      const options = selectedMime ? { mimeType: selectedMime } : undefined;
      const mediaRecorder = new MediaRecorder(streamToRecord, options);

      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        speechService.stop();
        setLiveInterimText('');

        // Stop all active streams
        activeStreamsRef.current.forEach((str) => {
          str.getTracks().forEach((track) => track.stop());
        });
        streamToRecord.getTracks().forEach((track) => track.stop());
        activeStreamsRef.current = [];

        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        if (audioCtx.state !== 'closed') audioCtx.close().catch(() => {});

        const finalBlob = new Blob(audioChunksRef.current, {
          type: selectedMime || 'audio/webm',
        });

        const recordedDuration = Math.max(1, recordingSecondsRef.current || 1);
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const prefix = mode === 'meeting' ? 'Meeting' : 'Recording';
        const fileName = `${prefix}_${timestamp}.${selectedMime.includes('ogg') ? 'ogg' : 'webm'}`;

        const sessionToUpdate = activeRecordingSessionIdRef.current || currentSession?.id;
        const currentTranscript = liveTranscriptRef.current ? liveTranscriptRef.current : undefined;
        const currentChunks =
          liveChunksRef.current.length > 0 ? [...liveChunksRef.current] : undefined;

        if (finalBlob.size > 0) {
          onAudioRecorded(
            finalBlob,
            recordedDuration,
            fileName,
            sessionToUpdate,
            currentTranscript,
            currentChunks
          );
        } else {
          console.error('Audio recording failed: recorded blob was empty.');
        }

        if (useLiveTranscription && currentTranscript) {
          if (onShowToast) {
            onShowToast('Recording & live transcript saved to Transcript tab!');
          }
        }

        activeRecordingSessionIdRef.current = null;
        setRecordingSeconds(0);
        recordingSecondsRef.current = 0;
        setIsRecording(false);
        setIsRecordingPaused(false);
        setRecordingNotice(null);
        onTimeUpdate(0);
      };

      // Generate or bind the unique sessionId before starting recording
      let sessionIdToUse = currentSession && !currentSession.audioBlob ? currentSession.id : null;
      if (!sessionIdToUse && onStartRecording) {
        sessionIdToUse = await onStartRecording(mode);
      } else if (!sessionIdToUse) {
        sessionIdToUse = `session-${Date.now()}`;
      }
      activeRecordingSessionIdRef.current = sessionIdToUse;

      mediaRecorderRef.current = mediaRecorder;
      recordingStartTimeRef.current = Date.now();
      recordingSecondsRef.current = 0;
      mediaRecorder.start(1000); // Collect data chunks every 1000ms
      setIsRecording(true);
      setIsRecordingPaused(false);
      setRecordingSeconds(0);

      // Start live speech recognition if user opted in
      if (useLiveTranscription) {
        liveTranscriptRef.current = '';
        liveChunksRef.current = [];
        setLiveTranscript('');
        setLiveInterimText('');
        speechService.start(
          {
            onInterimResult: (interim) => {
              setLiveInterimText(interim);
            },
            onFinalResult: (finalText, timestampSec) => {
              const timeStr = formatTime(timestampSec);
              const line = `[${timeStr}] ${finalText}`;
              const updated = liveTranscriptRef.current
                ? `${liveTranscriptRef.current}\n\n${line}`
                : line;
              liveTranscriptRef.current = updated;
              setLiveTranscript(updated);
              setLiveInterimText('');

              const startSec = Math.max(0, timestampSec - 3);
              const endSec = timestampSec;
              liveChunksRef.current.push({ timestamp: [startSec, endSec], text: finalText });
              // Atomic save happens on recorder.onstop alongside the final audio blob
            },
            onError: (err) => {
              console.warn('Live speech recognition warning:', err);
            },
          },
          () => recordingSecondsRef.current || 0
        );
      }

      // Start elapsed timer and keep current playback time in sync for live note timestamps
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = window.setInterval(() => {
        recordingSecondsRef.current += 1;
        setRecordingSeconds(recordingSecondsRef.current);
        onTimeUpdate(recordingSecondsRef.current);
      }, 1000);

      // Start visualizer animation
      drawVisualizer();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Could not access audio recording devices.';
      setMicError(message);
      setIsRecording(false);
      setIsRecordingPaused(false);
    }
  };

  // Pause active recording session
  const pauseRecording = () => {
    if (useLiveTranscription) {
      speechService.stop();
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.pause();
      } catch (err) {
        console.warn('Error pausing media recorder:', err);
      }
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setIsRecordingPaused(true);
  };

  // Resume paused recording session
  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      try {
        mediaRecorderRef.current.resume();
      } catch (err) {
        console.warn('Error resuming media recorder:', err);
      }
    }
    if (useLiveTranscription) {
      speechService.start(
        {
          onInterimResult: (interim) => setLiveInterimText(interim),
          onFinalResult: (finalText, timestampSec) => {
            const timeStr = formatTime(timestampSec);
            const line = `[${timeStr}] ${finalText}`;
            const updated = liveTranscriptRef.current
              ? `${liveTranscriptRef.current}\n\n${line}`
              : line;
            liveTranscriptRef.current = updated;
            setLiveTranscript(updated);
            setLiveInterimText('');

            const startSec = Math.max(0, timestampSec - 3);
            const endSec = timestampSec;
            liveChunksRef.current.push({ timestamp: [startSec, endSec], text: finalText });
            // Atomic save happens on recorder.onstop alongside the final audio blob
          },
        },
        () => recordingSecondsRef.current || 0
      );
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    recordingTimerRef.current = window.setInterval(() => {
      recordingSecondsRef.current += 1;
      setRecordingSeconds(recordingSecondsRef.current);
      onTimeUpdate(recordingSecondsRef.current);
    }, 1000);

    setIsRecordingPaused(false);
    drawVisualizer();
  };

  // Stop recording
  const stopRecording = () => {
    speechService.stop();
    setLiveInterimText('');
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  // Timeline click seek
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineBarRef.current || duration <= 0) return;
    const rect = timelineBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(ratio * duration);
  };

  const handleTimelineMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineBarRef.current || duration <= 0) return;
    const rect = timelineBarRef.current.getBoundingClientRect();
    const hoverX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, hoverX / rect.width));
    setHoveredTime(ratio * duration);
  };

  const handleTimelineMouseLeave = () => {
    setHoveredTime(null);
  };

  // File upload change
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onAudioUploaded(file);
      e.target.value = '';
    }
  };

  const progressPercent =
    duration > 0 && isFinite(duration)
      ? Math.min(100, Math.max(0, (currentTime / duration) * 100))
      : 0;
  const speedOptions = [0.5, 0.75, 1, 1.25, 1.5, 2];

  return (
    <div className="flex flex-col h-full bg-[#fcfbf9] dark:bg-stone-900 border-r border-[#e8e4dc] dark:border-stone-800 p-5 overflow-y-auto">
      {/* Session Title & Audio Source Header */}
      <div className="mb-5 pb-4 border-b border-[#e8e4dc] dark:border-stone-800">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-xs uppercase tracking-wider font-semibold text-stone-500 dark:text-stone-400">
            Audio Interface
          </span>
          <div className="flex items-center gap-2">
            {/* Export Notes Action */}
            {currentSession && (
              <button
                type="button"
                onClick={handleExportNotesClick}
                disabled={!hasExportableContent}
                title={
                  hasExportableContent
                    ? 'Export session notes, takeaways & transcript as Markdown (.md)'
                    : 'No notes or transcript available to export'
                }
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-stone-800 hover:bg-[#f0ece4] dark:hover:bg-stone-700 border border-[#e8e4dc] dark:border-stone-700 text-stone-800 dark:text-stone-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FileDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Export Notes</span>
              </button>
            )}

            {/* Download Audio Action */}
            {currentSession?.audioBlob && (
              <button
                onClick={() => {
                  if (currentSession.audioBlob) {
                    downloadNativeAudio(currentSession.audioBlob, currentSession.title || 'recording');
                  }
                }}
                title="Download recording audio file"
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-stone-800 hover:bg-[#f0ece4] dark:hover:bg-stone-700 border border-[#e8e4dc] dark:border-stone-700 text-stone-800 dark:text-stone-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs shrink-0"
              >
                <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Download Audio</span>
              </button>
            )}
          </div>
        </div>
        {isEditingTitle && currentSession ? (
          <div className="flex items-center gap-1.5 mt-0.5">
            <input
              ref={titleInputRef}
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSaveTitle();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  handleCancelTitle();
                }
              }}
              onBlur={handleSaveTitle}
              placeholder="Session title..."
              className="flex-1 text-base font-bold px-2.5 py-1 rounded-xl border border-indigo-500 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-2xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
            />
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSaveTitle();
              }}
              title="Save Title (Enter)"
              className="p-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-colors cursor-pointer shrink-0"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleCancelTitle();
              }}
              title="Cancel (Esc)"
              className="p-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 group">
            <h2
              onClick={() => {
                if (currentSession) setIsEditingTitle(true);
              }}
              title={currentSession ? 'Click to edit title' : ''}
              className={`text-lg font-bold tracking-tight text-stone-900 dark:text-white truncate ${
                currentSession ? 'cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors' : ''
              }`}
            >
              {currentSession ? currentSession.title : 'No Session Selected'}
            </h2>
            {currentSession && (
              <button
                type="button"
                onClick={() => setIsEditingTitle(true)}
                title="Edit session title"
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-[#edeae3] dark:hover:bg-stone-800 transition-colors cursor-pointer shrink-0 opacity-70 group-hover:opacity-100"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Recording & Input Action Zone */}
      <div className="mb-6 space-y-3">
        {isRecording ? (
          <div
            className={`p-4 rounded-xl border transition-all ${
              isRecordingPaused
                ? 'border-amber-500/40 bg-amber-50/70 dark:bg-amber-950/20 shadow-2xs'
                : 'border-red-500/30 bg-red-50 dark:bg-red-950/20 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 min-w-0">
                {isRecordingPaused ? (
                  <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
                ) : (
                  <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold block truncate ${
                        isRecordingPaused
                          ? 'text-amber-800 dark:text-amber-300'
                          : 'text-red-700 dark:text-red-400'
                      }`}
                    >
                      {recordingMode === 'meeting'
                        ? 'Recording Meeting Audio'
                        : 'Recording Microphone'}
                    </span>
                    {isRecordingPaused && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-200 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200 text-[10px] font-bold font-mono">
                        PAUSED
                      </span>
                    )}
                  </div>
                  {recordingMode === 'meeting' && (
                    <span className="text-[10px] text-red-600/80 dark:text-red-400/80 block truncate">
                      Teams / Zoom / System audio + Mic mixed
                    </span>
                  )}
                </div>
              </div>
              <span
                className={`font-mono text-sm font-bold tabular-nums shrink-0 ${
                  isRecordingPaused
                    ? 'text-amber-800 dark:text-amber-300'
                    : 'text-red-700 dark:text-red-400'
                }`}
              >
                {formatTime(recordingSeconds)}
              </span>
            </div>

            {/* Live Visualizer Canvas */}
            <div className="relative mb-3">
              <canvas
                ref={canvasRef}
                width={280}
                height={48}
                className={`w-full h-12 rounded transition-opacity ${
                  isRecordingPaused
                    ? 'opacity-40 bg-amber-900/10 dark:bg-amber-900/30'
                    : 'bg-neutral-900/10 dark:bg-neutral-900/50'
                }`}
              />
              {isRecordingPaused && (
                <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-amber-900 dark:text-amber-300 bg-amber-50/40 dark:bg-amber-950/40 backdrop-blur-[1px] rounded">
                  Waveform Frozen (Paused)
                </div>
              )}
            </div>

            {/* Live Web Speech Dictation Display */}
            {useLiveTranscription && (
              <div className="mb-3 p-3 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs shadow-2xs space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Live Dictation (Web Speech API)
                  </span>
                  <span className="text-stone-400 dark:text-stone-500 font-mono text-[9px]">Continuous</span>
                </div>
                <div className="max-h-28 overflow-y-auto space-y-1 font-mono text-[11px] leading-relaxed">
                  {liveTranscript ? (
                    <div className="text-stone-800 dark:text-stone-200 whitespace-pre-wrap">
                      {liveTranscript}
                    </div>
                  ) : null}
                  {liveInterimText ? (
                    <div className="text-indigo-600 dark:text-indigo-400 opacity-75 italic">
                      {liveInterimText}...
                    </div>
                  ) : !liveTranscript ? (
                    <div className="text-stone-400 dark:text-stone-500 italic">
                      Listening for speech...
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {/* Action Buttons: Pause/Resume + Stop */}
            <div className="flex items-center gap-2">
              {isRecordingPaused ? (
                <button
                  type="button"
                  onClick={resumeRecording}
                  title="Resume Recording"
                  className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Resume</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={pauseRecording}
                  title="Pause Recording"
                  className="flex-1 py-2.5 px-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                >
                  <Pause className="w-4 h-4 fill-current" />
                  <span>Pause</span>
                </button>
              )}

              <button
                type="button"
                onClick={stopRecording}
                title="Finish and save recording"
                className="flex-1 py-2.5 px-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop & Save</span>
              </button>
            </div>
          </div>
        ) : currentSession?.audioBlob ? (
          /* Post-Recording Completed State: Record controls are HIDDEN to prevent accidental overwrites */
          <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-2.5 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 block truncate">
                    Recording Ready
                  </span>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate font-mono">
                    {currentSession.audioFileName || 'Voice Recording'} • {formatTime(duration)}
                  </p>
                </div>
              </div>

              {/* Safe Discard & Start New Recording Flow */}
              <button
                type="button"
                onClick={() => {
                  const confirmed = window.confirm(
                    'Are you sure you want to discard this recording and record again? The current audio will be cleared.'
                  );
                  if (confirmed && onDiscardAudio) {
                    onDiscardAudio();
                  }
                }}
                className="py-1 px-2.5 rounded-lg bg-white/90 dark:bg-stone-800/90 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-stone-600 hover:text-rose-600 dark:text-stone-300 dark:hover:text-rose-400 border border-stone-200 dark:border-stone-700 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer shrink-0 shadow-2xs"
                title="Discard current audio to allow recording a new track"
              >
                <Trash2 className="w-3 h-3" />
                <span>Discard & Record Again</span>
              </button>
            </div>

            {/* WebGPU Support Warning Alert in Post-Recording Toolset */}
            {hasWebGpu === false && (
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/80 text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2 shadow-2xs leading-relaxed">
                <span className="shrink-0 select-none">⚠️</span>
                <span>
                  WebGPU is not supported or disabled on this device. Transcription is running on CPU (WASM) and will be significantly slower.
                </span>
              </div>
            )}

            {/* Post-recording Toolset Quick Bar */}
            <div className="flex flex-wrap items-center gap-2 pt-1.5 border-t border-emerald-500/10">
              {/* Download Audio Action */}
              <button
                type="button"
                onClick={() => {
                  if (currentSession.audioBlob) {
                    downloadNativeAudio(currentSession.audioBlob, currentSession.title || 'recording');
                  }
                }}
                title="Download recording audio file"
                className="py-1.5 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Audio</span>
              </button>

              {/* Export Notes Action */}
              <button
                type="button"
                onClick={handleExportNotesClick}
                disabled={!hasExportableContent}
                title={
                  hasExportableContent
                    ? 'Export notes and transcript as Markdown (.md)'
                    : 'No notes or transcript available to export'
                }
                className="py-1.5 px-2.5 rounded-lg bg-white dark:bg-stone-800 hover:bg-[#f0ece4] dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 border border-[#e8e4dc] dark:border-stone-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FileDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Export Notes (.md)</span>
              </button>

              {/* Transcribe Offline Action */}
              {onTranscribeAudio && (
                !isTranscribing ? (
                  <button
                    type="button"
                    onClick={onTranscribeAudio}
                    title="Transcribe recording locally with Moonshine Web Worker (100% offline)"
                    className="py-1.5 px-2.5 rounded-lg bg-white dark:bg-stone-800 hover:bg-[#f0ece4] dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 border border-[#e8e4dc] dark:border-stone-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Transcribe Offline</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onCancelTranscription}
                    className="py-1.5 px-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </button>
                )
              )}

              {/* Attach Slide Action */}
              <button
                type="button"
                onClick={() => slideFileInputRef.current?.click()}
                className="py-1.5 px-2.5 rounded-lg bg-white dark:bg-stone-800 hover:bg-[#f0ece4] dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 border border-[#e8e4dc] dark:border-stone-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs relative"
                title="Attach slide or image to this recording"
              >
                <ImageIcon className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>Attach Slide</span>
                {currentSession?.images && currentSession.images.length > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-amber-500 text-white font-mono text-[9px] font-bold">
                    {currentSession.images.length}
                  </span>
                )}
              </button>
              <input
                ref={slideFileInputRef}
                type="file"
                accept="image/*,application/pdf"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    Array.from(e.target.files).forEach((file) => {
                      if (onUploadSlide) onUploadSlide(file);
                    });
                    e.target.value = '';
                  }
                }}
              />
            </div>

            {/* Inline Transcription Progress Callout in Post-Recording view */}
            {isTranscribing && (
              <div className="p-3 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 space-y-2 animate-in fade-in duration-200">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-indigo-950 dark:text-indigo-200 truncate pr-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span className="truncate">
                      {transcriptionStatus || 'Processing audio chunks...'}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300 text-xs shrink-0">
                    {Math.round(transcriptionProgress)}%
                  </span>
                </div>

                <div className="w-full h-2 bg-[#e0d9cf] dark:bg-stone-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(2, Math.min(100, transcriptionProgress))}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-stone-600 dark:text-stone-300">
                  <span className="truncate">
                    {transcriptionDetail || 'Processing with 30s chunks & 5s stride...'}
                  </span>
                  {typeof transcriptionElapsed === 'number' && (
                    <span className="shrink-0 ml-2">
                      Elapsed: {formatTime(transcriptionElapsed)} {typeof transcriptionEta === 'number' ? `• ETA: ~${formatTime(transcriptionEta)}` : ''}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Post-Recording Backup Reminder Callout */}
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2 shadow-2xs leading-relaxed">
              <span className="shrink-0 text-sm select-none">💡</span>
              <span>
                <strong className="font-semibold">Tip:</strong> Always download your audio and export your notes as a backup. Since Pinpoint operates entirely offline, your files cannot be recovered if your browser data is cleared.
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Live Transcription Privacy Toggle */}
            <div className="p-3 rounded-xl bg-white dark:bg-stone-900 border border-[#e8e4dc] dark:border-stone-800 space-y-1.5 shadow-2xs">
              <label className="flex items-center justify-between cursor-pointer select-none">
                <span className="text-xs font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                  <span>Enable Live Transcription</span>
                  {useLiveTranscription && (
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
                      Live ON
                    </span>
                  )}
                </span>
                <input
                  type="checkbox"
                  checked={useLiveTranscription}
                  onChange={(e) => setUseLiveTranscription(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
              </label>
              <p className="text-[11px] text-amber-800 dark:text-amber-300/90 leading-relaxed">
                ⚠️ Notice: Live transcription uses your browser&apos;s built-in dictation engine, which may send audio to Google or Apple servers. Leave this off for strictly private, offline processing.
              </p>
            </div>

            <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
              <button
                onClick={() => startRecording('mic')}
                className="py-2.5 px-2 bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-white text-white dark:text-neutral-900 font-medium rounded-lg text-xs flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-colors shadow-sm cursor-pointer whitespace-nowrap"
                title="Record Microphone audio only"
              >
                <Mic className="w-4 h-4 text-rose-500 shrink-0" />
                <span className="truncate">Record Mic</span>
              </button>

              <button
                onClick={() => startRecording('meeting')}
                className="hidden md:flex py-2.5 px-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg text-xs flex-col sm:flex-row items-center justify-center gap-1.5 transition-colors shadow-sm cursor-pointer whitespace-nowrap"
                title="Record Meeting: Captures Teams / Zoom / Tab system audio + your microphone mixed together"
              >
                <Monitor className="w-4 h-4 text-white shrink-0" />
                <span className="truncate">Record Meeting</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="py-2.5 px-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-medium rounded-lg text-xs flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-colors cursor-pointer border border-neutral-200 dark:border-neutral-700 whitespace-nowrap"
                title="Upload audio file"
              >
                <Upload className="w-4 h-4 text-indigo-500 shrink-0" />
                <span className="truncate">Audio</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/webm, audio/mp4, audio/mp3, audio/wav, audio/*"
                className="hidden"
                onChange={handleFileUpload}
              />

            <button
              onClick={() => slideFileInputRef.current?.click()}
              className="py-2.5 px-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-medium rounded-lg text-xs flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-colors cursor-pointer border border-neutral-200 dark:border-neutral-700 whitespace-nowrap relative"
              title="Attach slide or image to current session"
            >
              <ImageIcon className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="truncate">Slide</span>
              {currentSession?.images && currentSession.images.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.2 rounded-full bg-amber-500 text-white font-mono text-[9px] font-bold">
                  {currentSession.images.length}
                </span>
              )}
            </button>
              <input
                ref={slideFileInputRef}
                type="file"
                accept="image/*,application/pdf"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    Array.from(e.target.files).forEach((file) => {
                      if (onUploadSlide) onUploadSlide(file);
                    });
                    e.target.value = '';
                  }
                }}
              />
            </div>
          </div>
        )}

        {/* Tip / Notice Message (e.g. system audio check reminder) */}
        {recordingNotice && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 rounded-lg flex items-start gap-2 text-xs text-blue-800 dark:text-blue-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
            <span>{recordingNotice}</span>
          </div>
        )}

        {/* Recording Error Message */}
        {micError && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800/50 rounded-lg flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <span>{micError}</span>
          </div>
        )}
      </div>

      {/* Main Interactive Audio Player & Scrubber */}
      <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 space-y-4 mb-6">
        {/* Track Metadata */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
            <FileAudio className="w-4 h-4 text-indigo-500" />
            <span className="font-medium truncate max-w-[140px]">
              {currentSession?.audioBlob ? 'Audio Loaded' : 'No Audio Track'}
            </span>
          </div>
          <div className="font-mono text-neutral-700 dark:text-neutral-300 tabular-nums">
            <span className="font-semibold text-neutral-900 dark:text-white">
              {formatTime(currentTime)}
            </span>
            <span className="text-neutral-400 mx-1">/</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Interactive Timeline Bar with Note Pin Markers */}
        <div className="relative py-2">
          <div
            ref={timelineBarRef}
            onClick={handleTimelineClick}
            onMouseMove={handleTimelineMouseMove}
            onMouseLeave={handleTimelineMouseLeave}
            className="group relative h-3 bg-neutral-200 dark:bg-neutral-700 rounded-full cursor-pointer overflow-visible"
          >
            {/* Progress Fill */}
            <div
              className="h-full bg-indigo-600 dark:bg-indigo-500 rounded-full transition-all duration-75 relative"
              style={{ width: `${progressPercent}%` }}
            >
              {/* Playhead handle */}
              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-4 h-4 rounded-full bg-white dark:bg-neutral-100 shadow-md border-2 border-indigo-600 scale-90 group-hover:scale-110 transition-transform" />
            </div>

            {/* Note Pins on Timeline */}
            {duration > 0 && isFinite(duration) &&
              notes.map((note) => {
                const notePercent = Math.min(100, Math.max(0, (note.timestamp / duration) * 100));
                return (
                  <button
                    key={note.id}
                    title={`${formatTime(note.timestamp)}: ${note.content.slice(0, 40)}...`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSeek(note.timestamp);
                    }}
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-neutral-900 hover:scale-150 transition-transform z-10 cursor-pointer"
                    style={{ left: `${notePercent}%` }}
                  />
                );
              })}

            {/* Hover Tooltip */}
            {hoveredTime !== null && (
              <div
                className="absolute -top-7 -translate-x-1/2 bg-neutral-900 text-white text-[10px] font-mono px-1.5 py-0.5 rounded shadow pointer-events-none z-20"
                style={{
                  left: `${(hoveredTime / duration) * 100}%`,
                }}
              >
                {formatTime(hoveredTime)}
              </div>
            )}
          </div>
        </div>

        {/* Primary Playback Controls */}
        <div className="flex items-center justify-between pt-1">
          {/* Skip Back 5s */}
          <button
            onClick={() => onSeek(Math.max(0, currentTime - 5))}
            title="Rewind 5 seconds"
            className="p-2 text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-200/60 dark:hover:bg-neutral-700/60 rounded-lg transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Play / Pause Primary Button */}
          <button
            onClick={onPlayPause}
            disabled={!currentSession?.audioBlob}
            className={`w-12 h-12 rounded-full flex items-center justify-center shadow-sm transition-all cursor-pointer ${
              currentSession?.audioBlob
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white hover:scale-105 active:scale-95'
                : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-400 cursor-not-allowed'
            }`}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current translate-x-0.5" />
            )}
          </button>

          {/* Skip Forward 5s */}
          <button
            onClick={() => onSeek(Math.min(duration, currentTime + 5))}
            title="Forward 5 seconds"
            className="p-2 text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-200/60 dark:hover:bg-neutral-700/60 rounded-lg transition-colors cursor-pointer"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        {/* Speed Controls & Volume */}
        <div className="flex flex-col gap-3.5 items-start w-full pt-4 border-t border-neutral-200/80 dark:border-neutral-700/80 text-xs">
          {/* Speed Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-2">
            <span className="text-neutral-500 dark:text-neutral-400 text-[11px] font-medium shrink-0">Speed:</span>
            <div className="flex flex-wrap gap-2 bg-neutral-200/70 dark:bg-neutral-700/70 rounded-xl p-1">
              {speedOptions.map((rate) => (
                <button
                  key={rate}
                  onClick={() => onRateChange(rate)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-mono transition-colors cursor-pointer ${
                    playbackRate === rate
                      ? 'bg-white dark:bg-neutral-900 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>
          </div>

          {/* Volume Slider */}
          <div className="flex items-center justify-between w-full gap-3">
            <div className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400 text-[11px] shrink-0">
              <button
                onClick={() => onVolumeChange(volume > 0 ? 0 : 1)}
                className="text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 cursor-pointer p-0.5"
                title={volume === 0 ? "Unmute" : "Mute"}
              >
                {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <span>Volume:</span>
            </div>
            <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                className="w-full max-w-[200px] h-2 accent-indigo-600 bg-neutral-200 dark:bg-neutral-700 rounded-lg cursor-pointer"
              />
              <span className="text-[10px] font-mono text-neutral-400 w-8 text-right shrink-0">
                {Math.round(volume * 100)}%
              </span>
            </div>
          </div>
        </div>

        {/* Audio Enhancement & Voice Boost (Web Audio API) */}
        <div className="pt-4 border-t border-neutral-200/80 dark:border-neutral-700/80">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-2.5 min-w-0 mr-2">
              <div
                className={`p-1.5 rounded-md transition-colors shrink-0 mt-0.5 sm:mt-0 ${
                  isAudioEnhanced
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                    : 'bg-neutral-200/70 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 space-y-0.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                    Enhance Audio
                  </span>
                  {isAudioEnhanced && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-300 dark:border-emerald-800">
                      Voice Boost Active
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400 leading-relaxed pr-1">
                  Auto-level quiet voices &amp; boost speech clarity
                </p>
              </div>
            </div>

            {/* Toggle Switch */}
            <button
              type="button"
              role="switch"
              aria-checked={isAudioEnhanced}
              onClick={onToggleAudioEnhanced}
              title="Toggle Auto-Leveling Dynamics Compressor & Vocal EQ"
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                isAudioEnhanced ? 'bg-emerald-600' : 'bg-neutral-300 dark:bg-neutral-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  isAudioEnhanced ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Active DSP Specs Details */}
          {isAudioEnhanced && (
            <div className="mt-2.5 p-2 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 text-[10px] space-y-1 text-emerald-900 dark:text-emerald-300 font-mono">
              <div className="flex items-center justify-between">
                <span>⚡ Dynamics Compressor:</span>
                <span className="font-semibold">-28dB thresh / 12:1 ratio</span>
              </div>
              <div className="flex items-center justify-between">
                <span>🎙️ Vocal EQ Peaking:</span>
                <span className="font-semibold">+6.5dB @ 2.5kHz</span>
              </div>
              <div className="flex items-center justify-between">
                <span>🔉 Low-End Rolloff:</span>
                <span className="font-semibold">80Hz High-Pass</span>
              </div>
            </div>
          )}
        </div>

        {/* Speech-to-Text Transcription */}
        <div className="pt-4 border-t border-[#e8e4dc] dark:border-stone-800">
          {/* WebGPU Support Warning Banner */}
          {hasWebGpu === false && (
            <div className="mb-3 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/80 text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2 shadow-2xs leading-relaxed">
              <span className="shrink-0 select-none">⚠️</span>
              <span>
                WebGPU is not supported or disabled on this device. Transcription is running on CPU (WASM) and will be significantly slower.
              </span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-2.5 min-w-0 mr-1">
              <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 shrink-0 mt-0.5 sm:mt-0">
                <FileText className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 space-y-0.5">
                <span className="text-xs font-semibold text-stone-900 dark:text-stone-100 block">
                  Speech-to-Text
                </span>
                <p className="text-[10px] text-stone-500 dark:text-stone-400 leading-relaxed">
                  Auto-generate timestamped transcript
                </p>
              </div>
            </div>

            <div className="shrink-0 self-end sm:self-auto">
              {!isTranscribing ? (
                <button
                  onClick={onTranscribeAudio}
                  disabled={!currentSession?.audioBlob}
                  title={
                    currentSession?.audioBlob
                      ? 'Transcribe audio locally with Moonshine speech recognition (100% offline)'
                      : 'Record or upload an audio track first to transcribe'
                  }
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
                    currentSession?.audioBlob
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      : 'bg-[#edeae3] dark:bg-stone-800 text-stone-400 cursor-not-allowed'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Transcribe Offline</span>
                </button>
              ) : (
                <button
                  onClick={onCancelTranscription}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900 border border-rose-200 dark:border-rose-800 transition-colors cursor-pointer flex items-center gap-1"
                  title="Cancel ongoing transcription"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Cancel</span>
                </button>
              )}
            </div>
          </div>

          {/* Active Transcription Progress Bar & Status */}
          {isTranscribing && (
            <div className="mt-3 p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-800/60 space-y-2 animate-in fade-in duration-200">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-indigo-950 dark:text-indigo-200 font-semibold truncate pr-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span className="truncate">
                    {transcriptionStatus || 'Processing audio...'}
                  </span>
                </div>
                <span className="font-mono text-xs font-bold text-indigo-700 dark:text-indigo-300 tabular-nums shrink-0">
                  {Math.round(transcriptionProgress)}%
                </span>
              </div>

              {/* Progress Track */}
              <div className="w-full h-2 bg-[#e0d9cf] dark:bg-stone-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(2, Math.min(100, transcriptionProgress))}%` }}
                />
              </div>

              {/* Detail label e.g. "Chunk 2 of 5 • 60s of 145s audio" */}
              {transcriptionDetail && (
                <div className="text-[11px] text-stone-600 dark:text-stone-300 font-mono truncate">
                  {transcriptionDetail}
                </div>
              )}

              {/* Live Elapsed & ETA display formatted in mm:ss */}
              <div className="flex items-center justify-between text-[11px] font-mono text-stone-700 dark:text-stone-300 tabular-nums">
                <span>
                  Elapsed: {formatTime(transcriptionElapsed || 0)} | ETA: ~{formatTime(transcriptionEta || 0)} remaining
                </span>
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-sans font-medium">
                  30s Strided Chunking
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Prominent "Add Note at Current Time" Action */}
      <div className="mb-6">
        <button
          onClick={onTriggerAddNote}
          className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl text-xs flex items-center justify-between shadow-sm hover:shadow transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-2">
            <PlusCircle className="w-4 h-4 transition-transform group-hover:scale-110" />
            <span className="font-semibold">Add Note at Current Time</span>
          </div>
          <div className="flex items-center gap-1.5 bg-indigo-700/60 px-2 py-0.5 rounded text-[11px] font-mono tabular-nums">
            <Clock className="w-3 h-3" />
            <span>{formatTime(currentTime)}</span>
            <kbd className="ml-1 text-[10px] opacity-75 font-sans">{modifierKey}+M</kbd>
          </div>
        </button>
      </div>

      {/* Notes Markers Overview on this track */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Timeline Markers ({notes.length})
          </span>
          <span className="text-[11px] text-neutral-400">Click to jump</span>
        </div>

        {notes.length === 0 ? (
          <div className="p-4 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-800 text-center text-xs text-neutral-500 dark:text-neutral-400">
            No notes added to this timeline yet.
            <div className="mt-1 text-[11px] text-neutral-400">
              Press <kbd className="px-1 bg-neutral-200 dark:bg-neutral-800 rounded">Ctrl+M</kbd> to add a timestamped note.
            </div>
          </div>
        ) : (
          <div className="space-y-1.5 overflow-y-auto pr-1 flex-1">
            {notes.map((n) => {
              const isCurrent = Math.abs(currentTime - n.timestamp) < 2.5;
              return (
                <button
                  key={n.id}
                  onClick={() => onSeek(n.timestamp)}
                  className={`w-full text-left p-2 rounded-lg text-xs flex items-start gap-2.5 transition-colors cursor-pointer border ${
                    isCurrent
                      ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800'
                      : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 border-transparent'
                  }`}
                >
                  <span className="font-mono text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded shrink-0 tabular-nums">
                    {formatTime(n.timestamp)}
                  </span>
                  <span className="text-neutral-700 dark:text-neutral-300 truncate text-[11px]">
                    {n.content}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Mobile-only "Open Note Space" button */}
      {onOpenMobileNotes && (
        <div className="block md:hidden pt-3 pb-1 shrink-0 sticky bottom-0 bg-gradient-to-t from-[#fcfbf9] via-[#fcfbf9] dark:from-stone-900 dark:via-stone-900 to-transparent">
          <button
            type="button"
            onClick={onOpenMobileNotes}
            className="w-full py-3 px-4 rounded-2xl bg-[#e0e7ff] dark:bg-indigo-950/90 hover:bg-[#c7d2fe] dark:hover:bg-indigo-900 text-indigo-950 dark:text-indigo-100 border border-[#c7d2fe] dark:border-indigo-800/80 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs active:scale-[0.99] transition-all cursor-pointer"
          >
            <span>📝</span>
            <span>Open Note Space</span>
            {notes.length > 0 && (
              <span className="ml-1 text-[11px] px-2 py-0.5 rounded-full bg-indigo-600 text-white font-mono font-bold">
                {notes.length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Mobile Meeting Recording Guidance Modal */}
      {showMobileMeetingNotice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setShowMobileMeetingNotice(false)}
        >
          <div
            className="w-full max-w-md bg-[#fcfbf9] dark:bg-stone-900 rounded-2xl shadow-2xl border border-[#e8e4dc] dark:border-stone-800 p-5 overflow-hidden flex flex-col space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#e8e4dc] dark:border-stone-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center justify-center text-base shadow-2xs">
                  📱
                </div>
                <div>
                  <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                    Mobile Browser Notice
                  </h3>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    Meeting &amp; System Audio Recording
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileMeetingNotice(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-[#fffbeb] dark:bg-amber-950/30 border border-[#fde68a] dark:border-amber-800/60 text-xs text-stone-800 dark:text-stone-200 leading-relaxed space-y-2">
              <p className="font-semibold text-slate-800 dark:text-stone-100">
                Screen and system audio recording isn't supported on mobile web browsers. Please use 'Record Mic' to capture room audio directly, or upload a pre-recorded audio file instead!
              </p>
              <p className="text-[11px] text-stone-600 dark:text-stone-400">
                Mobile operating systems (iOS and Android) restrict background system audio capture in web browsers for privacy and security reasons.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowMobileMeetingNotice(false);
                  startRecording('mic');
                }}
                className="w-full sm:flex-1 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Record Mic Instead</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMobileMeetingNotice(false);
                  fileInputRef.current?.click();
                }}
                className="w-full sm:w-auto py-2.5 px-3 rounded-xl bg-white dark:bg-stone-800 hover:bg-[#f0ece4] dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 border border-[#e8e4dc] dark:border-stone-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <Upload className="w-3.5 h-3.5 text-indigo-500" />
                <span>Upload Audio</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
