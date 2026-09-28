import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Image as ImageIcon,
  Plus,
  Trash2,
  Maximize2,
  Clock,
  Link,
  Unlink,
  ChevronLeft,
  ChevronRight,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Upload,
  Pen,
  Highlighter,
  Eraser,
  Undo2,
  MousePointer,
  Sparkles,
  Check,
  Palette,
} from 'lucide-react';
import { Session, SessionImage } from '../types';
import { formatTime } from '../utils/audio';

interface SlidesViewerProps {
  currentSession: Session | null;
  currentTime: number;
  onSeek: (seconds: number) => void;
  onUploadSlide: (file: File, timestamp?: number) => void;
  onDeleteSlide: (slideId: string) => void;
  onUpdateSlideTimestamp: (slideId: string, timestamp?: number) => void;
  onUpdateSlideAnnotation?: (slideId: string, annotationDataUrl?: string) => void;
}

type AnnotationTool = 'pen' | 'highlighter' | 'eraser' | 'cursor';

const PASTEL_COLORS = [
  { label: 'Amber', value: '#f59e0b', bgClass: 'bg-amber-500' },
  { label: 'Indigo', value: '#6366f1', bgClass: 'bg-indigo-500' },
  { label: 'Emerald', value: '#10b981', bgClass: 'bg-emerald-500' },
  { label: 'Coral', value: '#f43f5e', bgClass: 'bg-rose-500' },
  { label: 'White', value: '#ffffff', bgClass: 'bg-white border border-stone-300' },
  { label: 'Slate', value: '#1e293b', bgClass: 'bg-slate-800' },
];

const STROKE_WIDTHS = [
  { label: 'Fine', value: 2 },
  { label: 'Medium', value: 5 },
  { label: 'Bold', value: 12 },
];

export const SlidesViewer: React.FC<SlidesViewerProps> = ({
  currentSession,
  currentTime,
  onSeek,
  onUploadSlide,
  onDeleteSlide,
  onUpdateSlideTimestamp,
  onUpdateSlideAnnotation,
}) => {
  const [lightboxSlideId, setLightboxSlideId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Annotation Tool States
  const [activeTool, setActiveTool] = useState<AnnotationTool>('pen');
  const [strokeColor, setStrokeColor] = useState<string>('#f59e0b');
  const [strokeWidth, setStrokeWidth] = useState<number>(5);
  const [historyStack, setHistoryStack] = useState<ImageData[]>([]);

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const imageContainerRef = useRef<HTMLDivElement | null>(null);

  const slides = currentSession?.images || [];

  // Create temporary object URLs for slides (and revoke when unmounted/updated)
  const [slideUrls, setSlideUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const urls: Record<string, string> = {};
    slides.forEach((slide) => {
      try {
        urls[slide.id] = URL.createObjectURL(slide.blob);
      } catch (err) {
        console.error('Failed to create object URL for slide image:', err);
      }
    });
    setSlideUrls(urls);

    return () => {
      Object.values(urls).forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      });
    };
  }, [slides]);

  // Determine currently "Active" slide based on playback currentTime
  const activeSlideId = useMemo(() => {
    if (slides.length === 0) return null;
    const timestampedSlides = slides
      .filter((s) => typeof s.timestamp === 'number')
      .sort((a, b) => (a.timestamp! - b.timestamp!));

    if (timestampedSlides.length === 0) return null;

    let currentMatch: SessionImage | null = null;
    for (const slide of timestampedSlides) {
      if (slide.timestamp! <= currentTime) {
        currentMatch = slide;
      } else {
        break;
      }
    }
    return currentMatch ? currentMatch.id : null;
  }, [slides, currentTime]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      Array.from(e.target.files).forEach((file) => {
        onUploadSlide(file, currentTime > 0 ? currentTime : undefined);
      });
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      Array.from(e.dataTransfer.files).forEach((file) => {
        onUploadSlide(file, currentTime > 0 ? currentTime : undefined);
      });
    }
  };

  // Lightbox Slide navigation
  const currentLightboxIndex = useMemo(() => {
    if (!lightboxSlideId) return -1;
    return slides.findIndex((s) => s.id === lightboxSlideId);
  }, [slides, lightboxSlideId]);

  const currentLightboxSlide = currentLightboxIndex !== -1 ? slides[currentLightboxIndex] : null;

  const handlePrevLightbox = () => {
    if (currentLightboxIndex > 0) {
      setLightboxSlideId(slides[currentLightboxIndex - 1].id);
      setHistoryStack([]);
    }
  };

  const handleNextLightbox = () => {
    if (currentLightboxIndex < slides.length - 1) {
      setLightboxSlideId(slides[currentLightboxIndex + 1].id);
      setHistoryStack([]);
    }
  };

  // Synchronize and Load Canvas Layer for current slide
  const loadSlideAnnotationToCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentLightboxSlide) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (currentLightboxSlide.annotationDataUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        // Save initial state to history
        try {
          const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
          setHistoryStack([snapshot]);
        } catch {
          // ignore
        }
      };
      img.src = currentLightboxSlide.annotationDataUrl;
    } else {
      try {
        const blank = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setHistoryStack([blank]);
      } catch {
        // ignore
      }
    }
  }, [currentLightboxSlide]);

  // Adjust canvas size when lightbox slide image loads or resizes
  const handleImageLoaded = (imgEl: HTMLImageElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = imgEl.naturalWidth || imgEl.clientWidth || 1280;
    const height = imgEl.naturalHeight || imgEl.clientHeight || 720;

    canvas.width = width;
    canvas.height = height;

    loadSlideAnnotationToCanvas();
  };

  // Save current canvas drawings to IndexedDB
  const commitCanvasDrawing = () => {
    const canvas = canvasRef.current;
    if (!canvas || !currentLightboxSlide || !onUpdateSlideAnnotation) return;

    const dataUrl = canvas.toDataURL('image/png');
    onUpdateSlideAnnotation(currentLightboxSlide.id, dataUrl);
  };

  // Undo Last Annotation Action
  const handleUndo = () => {
    const canvas = canvasRef.current;
    if (!canvas || historyStack.length <= 1) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const nextStack = [...historyStack];
    nextStack.pop(); // remove current state
    const previousState = nextStack[nextStack.length - 1];

    if (previousState) {
      ctx.putImageData(previousState, 0, 0);
      setHistoryStack(nextStack);
      commitCanvasDrawing();
    }
  };

  // Clear all annotations on active slide
  const handleClearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !currentLightboxSlide) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const blank = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistoryStack([blank]);

    if (onUpdateSlideAnnotation) {
      onUpdateSlideAnnotation(currentLightboxSlide.id, undefined);
    }
  };

  // Canvas Coordinate Mapping
  const getCanvasCoordinates = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  // Drawing Event Handlers
  const startDrawing = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (activeTool === 'cursor') return;
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const coords = getCanvasCoordinates(e);
    if (!coords) return;

    isDrawingRef.current = true;
    lastPointRef.current = coords;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);

    if (activeTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = strokeWidth * 4;
    } else if (activeTool === 'highlighter') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = strokeColor + '55'; // 33% alpha
      ctx.lineWidth = strokeWidth * 3;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const drawMove = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawingRef.current || activeTool === 'cursor') return;
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const coords = getCanvasCoordinates(e);
    if (!coords || !lastPointRef.current) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();

    lastPointRef.current = coords;
  };

  const endDrawing = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    lastPointRef.current = null;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setHistoryStack((prev) => [...prev.slice(-20), snapshot]); // keep up to 20 undos
    } catch {
      // ignore
    }

    commitCanvasDrawing();
  };

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!lightboxSlideId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevLightbox();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextLightbox();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setLightboxSlideId(null);
        setZoomLevel(1);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxSlideId, currentLightboxIndex, slides.length, historyStack]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden min-h-0 bg-[#faf8f5] dark:bg-stone-900/60 p-4">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#e8e4dc] dark:border-stone-800 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400">
            <ImageIcon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-stone-900 dark:text-white flex items-center gap-1.5">
              <span>Slides &amp; PDFs</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                {slides.length}
              </span>
            </h3>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              Interactive slides, PDF pages &amp; drawing canvas
            </p>
          </div>
        </div>

        {/* Upload Action */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="py-1.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Slide or PDF</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="hidden"
            onChange={handleFileInputChange}
          />
        </div>
      </div>

      {/* Main Content: Slides Grid or Empty Dropzone */}
      {slides.length === 0 ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex-1 flex flex-col items-center justify-center p-8 text-center border-2 border-dashed rounded-2xl transition-all cursor-pointer ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 scale-[0.99]'
              : 'border-[#e4ded5] dark:border-stone-800 bg-[#faf8f5]/60 dark:bg-stone-900/30 hover:border-indigo-300'
          }`}
        >
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3 shadow-2xs">
            <ImageIcon className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100 mb-1">
            No slides attached
          </h4>
          <p className="text-xs text-stone-600 dark:text-stone-400 max-w-sm mb-4 leading-relaxed">
            Attach lecture slides, whiteboard photos, or PDF documents to annotate and jump to timestamped moments during playback.
          </p>
          <div className="py-2 px-4 bg-stone-900 dark:bg-white text-white dark:text-stone-900 text-xs font-semibold rounded-xl shadow-xs flex items-center gap-2">
            <Plus className="w-4 h-4" />
            <span>Select Images or PDF File</span>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className="flex-1 overflow-y-auto pr-1 relative"
        >
          {isDragging && (
            <div className="absolute inset-0 z-30 bg-indigo-600/10 border-2 border-dashed border-indigo-500 rounded-2xl backdrop-blur-2xs flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-300">
              Drop images or PDF files to attach
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pb-4">
            {slides.map((slide, index) => {
              const isActive = activeSlideId === slide.id;
              const url = slideUrls[slide.id];
              const hasAnnotation = !!slide.annotationDataUrl;

              return (
                <div
                  key={slide.id}
                  className={`group rounded-2xl border bg-white dark:bg-stone-900 overflow-hidden shadow-2xs transition-all flex flex-col ${
                    isActive
                      ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20 dark:bg-indigo-950/20'
                      : 'border-[#e8e4dc] dark:border-stone-800 hover:border-indigo-300 dark:hover:border-stone-700'
                  }`}
                >
                  {/* Image Thumbnail Container */}
                  <div className="relative aspect-video w-full bg-stone-100 dark:bg-stone-900 overflow-hidden flex items-center justify-center">
                    {url ? (
                      <div
                        className="relative w-full h-full cursor-pointer group-hover:scale-105 transition-transform duration-200"
                        onClick={() => {
                          setLightboxSlideId(slide.id);
                          setZoomLevel(1);
                        }}
                      >
                        <img
                          src={url}
                          alt={slide.name}
                          className="w-full h-full object-cover object-center"
                        />
                        {/* Render saved annotation drawing overlay if present */}
                        {slide.annotationDataUrl && (
                          <img
                            src={slide.annotationDataUrl}
                            alt="Annotations"
                            className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none"
                          />
                        )}
                      </div>
                    ) : (
                      <ImageIcon className="w-8 h-8 text-stone-300" />
                    )}

                    {/* Active Playback Badge */}
                    {isActive && (
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold shadow-xs flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Active Slide</span>
                      </div>
                    )}

                    {/* Annotated Badge */}
                    {hasAnnotation && !isActive && (
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-amber-500/90 backdrop-blur-xs text-white text-[10px] font-bold shadow-xs flex items-center gap-1">
                        <Pen className="w-2.5 h-2.5" />
                        <span>Annotated</span>
                      </div>
                    )}

                    {/* Top Right Quick Actions Overlay */}
                    <div className="absolute top-2 right-2 flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => {
                          setLightboxSlideId(slide.id);
                          setZoomLevel(1);
                        }}
                        title="Annotate & Fullscreen"
                        className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white backdrop-blur-xs transition-colors cursor-pointer"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteSlide(slide.id)}
                        title="Delete Slide"
                        className="p-1.5 rounded-lg bg-black/60 hover:bg-rose-600 text-white backdrop-blur-xs transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Slide Index Badge */}
                    <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded-md bg-black/50 backdrop-blur-xs text-white text-[9px] font-mono">
                      Slide #{index + 1}
                    </div>
                  </div>

                  {/* Card Metadata & Controls Footer */}
                  <div className="p-3 flex flex-col justify-between gap-2 flex-1">
                    <div className="min-w-0">
                      <p
                        className="text-xs font-semibold text-stone-900 dark:text-stone-100 truncate"
                        title={slide.name}
                      >
                        {slide.name}
                      </p>
                      <p className="text-[10px] text-stone-400 dark:text-stone-500">
                        Added {new Date(slide.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    {/* Timestamp Link Button / Status */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#f0ece4] dark:border-stone-800 text-xs">
                      {typeof slide.timestamp === 'number' ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onSeek(slide.timestamp!)}
                            title={`Jump playback to ${formatTime(slide.timestamp)}`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-mono text-[11px] font-bold border border-indigo-200/60 dark:border-indigo-800/60 transition-colors cursor-pointer"
                          >
                            <Clock className="w-3 h-3" />
                            <span>{formatTime(slide.timestamp)}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onUpdateSlideTimestamp(slide.id, undefined)}
                            title="Unlink timestamp"
                            className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 p-0.5"
                          >
                            <Unlink className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onUpdateSlideTimestamp(slide.id, currentTime)}
                          title={`Link to current audio time (${formatTime(currentTime)})`}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-stone-600 hover:text-indigo-600 dark:text-stone-400 dark:hover:text-indigo-400 cursor-pointer"
                        >
                          <Link className="w-3 h-3" />
                          <span>Link to {formatTime(currentTime)}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setLightboxSlideId(slide.id);
                          setZoomLevel(1);
                        }}
                        className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Pen className="w-3 h-3" />
                        <span>Annotate</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Interactive Fullscreen Slide Annotator & Lightbox Modal */}
      {currentLightboxSlide && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/92 backdrop-blur-md p-3 sm:p-4 select-none animate-in fade-in duration-150"
          onClick={() => {
            setLightboxSlideId(null);
            setZoomLevel(1);
          }}
        >
          {/* Lightbox Top Header Bar */}
          <div
            className="flex items-center justify-between text-white pb-2.5 shrink-0 border-b border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xs sm:text-sm font-bold truncate max-w-xs sm:max-w-md">
                {currentLightboxSlide.name}
              </span>
              <span className="text-xs text-stone-400 font-mono shrink-0">
                {currentLightboxIndex + 1} / {slides.length}
              </span>
              {typeof currentLightboxSlide.timestamp === 'number' && (
                <button
                  type="button"
                  onClick={() => {
                    onSeek(currentLightboxSlide.timestamp!);
                  }}
                  className="hidden sm:inline-flex px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-mono text-xs font-bold items-center gap-1 transition-colors cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Jump to {formatTime(currentLightboxSlide.timestamp)}</span>
                </button>
              )}
            </div>

            {/* Top Right Controls */}
            <div className="flex items-center gap-2">
              {/* Zoom Controls */}
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                title="Zoom out"
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono text-stone-300 w-9 text-center">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                title="Zoom in"
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(1)}
                title="Reset zoom"
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <div className="w-px h-5 bg-white/20 mx-1" />

              <button
                type="button"
                onClick={() => {
                  setLightboxSlideId(null);
                  setZoomLevel(1);
                }}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                title="Close Lightbox (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Lightbox Main Slide Stage (Image + Canvas Overlay) */}
          <div
            className="flex-1 flex items-center justify-center relative overflow-hidden my-2"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Previous Button */}
            {currentLightboxIndex > 0 && (
              <button
                type="button"
                onClick={handlePrevLightbox}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-xs transition-colors cursor-pointer"
                title="Previous Slide (←)"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {/* Slide Image + HTML5 Canvas Overlay Wrapper */}
            <div
              ref={imageContainerRef}
              style={{ transform: `scale(${zoomLevel})` }}
              className="relative max-h-[75vh] max-w-[90vw] flex items-center justify-center transition-transform duration-100 rounded-xl overflow-hidden shadow-2xl bg-black"
            >
              <img
                src={slideUrls[currentLightboxSlide.id]}
                alt={currentLightboxSlide.name}
                onLoad={(e) => handleImageLoaded(e.currentTarget)}
                className="max-h-[75vh] max-w-[90vw] object-contain block pointer-events-none select-none"
              />

              {/* HTML5 Interactive Drawing Layer Canvas */}
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={drawMove}
                onMouseUp={endDrawing}
                onMouseLeave={endDrawing}
                onTouchStart={startDrawing}
                onTouchMove={drawMove}
                onTouchEnd={endDrawing}
                className={`absolute inset-0 w-full h-full touch-none ${
                  activeTool === 'cursor' ? 'cursor-default pointer-events-none' : 'cursor-crosshair'
                }`}
              />
            </div>

            {/* Next Button */}
            {currentLightboxIndex < slides.length - 1 && (
              <button
                type="button"
                onClick={handleNextLightbox}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-xs transition-colors cursor-pointer"
                title="Next Slide (→)"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Floating Chalk-Pastel Annotation Toolbar */}
          <div
            className="flex items-center justify-center shrink-0 pt-1"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 bg-stone-900/95 border border-stone-700/80 rounded-2xl shadow-2xl backdrop-blur-md">
              {/* Tool Selection Group */}
              <div className="flex items-center bg-stone-800 rounded-xl p-0.5">
                <button
                  type="button"
                  onClick={() => setActiveTool('pen')}
                  title="Pen / Marker"
                  className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                    activeTool === 'pen'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-stone-300 hover:text-white'
                  }`}
                >
                  <Pen className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Pen</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTool('highlighter')}
                  title="Highlighter"
                  className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                    activeTool === 'highlighter'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-stone-300 hover:text-white'
                  }`}
                >
                  <Highlighter className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Highlight</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTool('eraser')}
                  title="Eraser"
                  className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                    activeTool === 'eraser'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-stone-300 hover:text-white'
                  }`}
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Eraser</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTool('cursor')}
                  title="Pointer / View Mode"
                  className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                    activeTool === 'cursor'
                      ? 'bg-stone-700 text-white shadow-xs'
                      : 'text-stone-300 hover:text-white'
                  }`}
                >
                  <MousePointer className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">View</span>
                </button>
              </div>

              <div className="w-px h-5 bg-stone-700" />

              {/* Chalk-Pastel Color Swatches */}
              {activeTool !== 'eraser' && activeTool !== 'cursor' && (
                <div className="flex items-center gap-1 bg-stone-800/80 rounded-xl px-1.5 py-1">
                  {PASTEL_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setStrokeColor(c.value)}
                      title={c.label}
                      className={`w-5 h-5 rounded-full ${c.bgClass} transition-transform cursor-pointer ${
                        strokeColor === c.value ? 'scale-125 ring-2 ring-white' : 'hover:scale-110'
                      }`}
                    />
                  ))}
                </div>
              )}

              {/* Stroke Width Selector */}
              {activeTool !== 'cursor' && (
                <div className="flex items-center bg-stone-800/80 rounded-xl p-0.5">
                  {STROKE_WIDTHS.map((w) => (
                    <button
                      key={w.value}
                      type="button"
                      onClick={() => setStrokeWidth(w.value)}
                      title={`${w.label} Stroke`}
                      className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold cursor-pointer transition-colors ${
                        strokeWidth === w.value
                          ? 'bg-stone-700 text-white'
                          : 'text-stone-400 hover:text-white'
                      }`}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="w-px h-5 bg-stone-700" />

              {/* Undo & Clear Action Buttons */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={historyStack.length <= 1}
                  title="Undo last stroke (Ctrl+Z)"
                  className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-stone-200 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Undo</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearCanvas}
                  title="Clear all annotations on slide"
                  className="p-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Clear</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
