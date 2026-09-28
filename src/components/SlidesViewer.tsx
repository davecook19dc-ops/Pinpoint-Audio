import React, { useState, useEffect, useMemo, useRef } from 'react';
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
}

export const SlidesViewer: React.FC<SlidesViewerProps> = ({
  currentSession,
  currentTime,
  onSeek,
  onUploadSlide,
  onDeleteSlide,
  onUpdateSlideTimestamp,
}) => {
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null);
  const [lightboxSlideId, setLightboxSlideId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

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
    // Find the slide whose timestamp is <= currentTime, closest to currentTime
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

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      Array.from(e.dataTransfer.files).forEach((file) => {
        if (file.type.startsWith('image/')) {
          onUploadSlide(file, currentTime > 0 ? currentTime : undefined);
        }
      });
    }
  };

  const currentLightboxIndex = slides.findIndex((s) => s.id === lightboxSlideId);
  const currentLightboxSlide = currentLightboxIndex >= 0 ? slides[currentLightboxIndex] : null;

  const handleNextLightbox = () => {
    if (currentLightboxIndex < slides.length - 1) {
      setLightboxSlideId(slides[currentLightboxIndex + 1].id);
      setZoomLevel(1);
    }
  };

  const handlePrevLightbox = () => {
    if (currentLightboxIndex > 0) {
      setLightboxSlideId(slides[currentLightboxIndex - 1].id);
      setZoomLevel(1);
    }
  };

  // Keyboard navigation for lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!lightboxSlideId) return;
      if (e.key === 'Escape') {
        setLightboxSlideId(null);
        setZoomLevel(1);
      } else if (e.key === 'ArrowRight') {
        handleNextLightbox();
      } else if (e.key === 'ArrowLeft') {
        handlePrevLightbox();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxSlideId, currentLightboxIndex, slides]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top Header Actions */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#e8e4dc] dark:border-stone-800 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400">
            <ImageIcon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
              <span>Lecture Slides &amp; Visuals</span>
              <span className="text-[11px] px-2 py-0.2 rounded-full bg-[#f0ece4] dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-mono">
                {slides.length}
              </span>
            </h3>
            <p className="text-[10px] text-stone-500 dark:text-stone-400">
              Attach whiteboard photos, presentation slides, and diagrams
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="py-1.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Slide</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileInputChange}
        />
      </div>

      {/* Main Content Area */}
      {slides.length === 0 ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`flex-1 flex flex-col items-center justify-center p-8 text-center border-2 border-dashed rounded-2xl transition-colors ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20'
              : 'border-[#e4ded5] dark:border-stone-800 bg-[#faf8f5]/60 dark:bg-stone-900/30'
          }`}
        >
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3 shadow-2xs">
            <ImageIcon className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100 mb-1">
            No slides or images attached
          </h4>
          <p className="text-xs text-stone-600 dark:text-stone-400 max-w-sm mb-4 leading-relaxed">
            Drag and drop images here, or attach whiteboard captures and lecture presentation slides to sync with timestamps.
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-2xs flex items-center gap-2 transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Slide or Diagram</span>
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`flex-1 overflow-y-auto pr-1 space-y-3 relative ${
            isDragging ? 'ring-2 ring-indigo-500 rounded-xl' : ''
          }`}
        >
          {/* Quick Drop Notice if dragging */}
          {isDragging && (
            <div className="p-3 mb-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 text-center text-xs font-semibold text-indigo-700 dark:text-indigo-300 animate-pulse">
              Drop images anywhere to attach to this recording
            </div>
          )}

          {/* Grid of Slide Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {slides.map((slide, index) => {
              const url = slideUrls[slide.id];
              const isActive = activeSlideId === slide.id;
              const isSelected = selectedSlideId === slide.id;

              return (
                <div
                  key={slide.id}
                  className={`group relative rounded-2xl border transition-all overflow-hidden bg-white dark:bg-stone-850 flex flex-col shadow-2xs ${
                    isActive
                      ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20 dark:bg-indigo-950/20'
                      : 'border-[#e8e4dc] dark:border-stone-800 hover:border-indigo-300 dark:hover:border-stone-700'
                  }`}
                >
                  {/* Image Thumbnail Container */}
                  <div className="relative aspect-video w-full bg-stone-100 dark:bg-stone-900 overflow-hidden flex items-center justify-center">
                    {url ? (
                      <img
                        src={url}
                        alt={slide.name}
                        className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-200 cursor-pointer"
                        onClick={() => {
                          setLightboxSlideId(slide.id);
                          setZoomLevel(1);
                        }}
                      />
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

                    {/* Top Right Quick Actions Overlay */}
                    <div className="absolute top-2 right-2 flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => {
                          setLightboxSlideId(slide.id);
                          setZoomLevel(1);
                        }}
                        title="View Fullscreen"
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

                      {/* Retag timestamp to current time */}
                      {typeof slide.timestamp === 'number' && (
                        <button
                          type="button"
                          onClick={() => onUpdateSlideTimestamp(slide.id, currentTime)}
                          title={`Update timestamp to current time (${formatTime(currentTime)})`}
                          className="text-[10px] text-stone-400 hover:text-indigo-600 dark:hover:text-indigo-400 underline font-medium cursor-pointer"
                        >
                          Retag ({formatTime(currentTime)})
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Lightbox / Fullscreen Slide Modal */}
      {currentLightboxSlide && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm animate-in fade-in duration-150 p-4 select-none"
          onClick={() => {
            setLightboxSlideId(null);
            setZoomLevel(1);
          }}
        >
          {/* Lightbox Header Bar */}
          <div
            className="flex items-center justify-between text-white pb-3 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold truncate max-w-xs sm:max-w-md">
                {currentLightboxSlide.name}
              </span>
              <span className="text-xs text-stone-400 font-mono">
                {currentLightboxIndex + 1} of {slides.length}
              </span>
              {typeof currentLightboxSlide.timestamp === 'number' && (
                <button
                  type="button"
                  onClick={() => {
                    onSeek(currentLightboxSlide.timestamp!);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-mono text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Jump to {formatTime(currentLightboxSlide.timestamp)}</span>
                </button>
              )}
            </div>

            {/* Lightbox Controls */}
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
              <span className="text-xs font-mono text-stone-300 w-10 text-center">
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

          {/* Lightbox Main Image Display */}
          <div
            className="flex-1 flex items-center justify-center relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Previous Button */}
            {currentLightboxIndex > 0 && (
              <button
                type="button"
                onClick={handlePrevLightbox}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-xs transition-colors cursor-pointer"
                title="Previous Slide (←)"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {/* Slide Image */}
            <div className="w-full h-full flex items-center justify-center overflow-auto p-4">
              <img
                src={slideUrls[currentLightboxSlide.id]}
                alt={currentLightboxSlide.name}
                style={{ transform: `scale(${zoomLevel})` }}
                className="max-h-[80vh] max-w-[90vw] object-contain transition-transform duration-100 rounded-lg shadow-2xl"
              />
            </div>

            {/* Next Button */}
            {currentLightboxIndex < slides.length - 1 && (
              <button
                type="button"
                onClick={handleNextLightbox}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-xs transition-colors cursor-pointer"
                title="Next Slide (→)"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
