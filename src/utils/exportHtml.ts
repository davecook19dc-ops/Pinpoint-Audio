import { Folder, Note, Session } from '../types';

/**
 * Generates a self-contained, single-file HTML document containing
 * the active session, embedded base64 audio, notes, visual callout boxes,
 * and an interactive offline player in vanilla JavaScript and Tailwind CSS CDN.
 */
export async function generateStandaloneHtml(
  session: Session,
  notes: Note[],
  folderName: string = 'General'
): Promise<string> {
  let audioDataUrl = '';
  if (session.audioBlob) {
    audioDataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(session.audioBlob!);
    });
  }

  const imagesData: Array<{ id: string; name: string; timestamp?: number; dataUrl: string; annotationDataUrl?: string }> = [];
  if (session.images && session.images.length > 0) {
    for (const img of session.images) {
      if (img.blob) {
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(img.blob);
        });
        imagesData.push({
          id: img.id,
          name: img.name,
          timestamp: img.timestamp,
          dataUrl,
          annotationDataUrl: img.annotationDataUrl,
        });
      }
    }
  }

  const notesJson = JSON.stringify(notes).replace(/</g, '\\u003c');
  const sessionJson = JSON.stringify({
    title: session.title,
    duration: session.duration,
    folder: folderName,
  }).replace(/</g, '\\u003c');
  const slidesJson = JSON.stringify(imagesData).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(session.title)} - Pinpoint Audio</title>
  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- Google Fonts & OpenDyslexic -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/opendyslexic@latest/open-dyslexic.css">
  <style>
    body { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
    .font-dyslexic { font-family: 'OpenDyslexic', 'Plus Jakarta Sans', sans-serif !important; }
    .font-mono { font-family: 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums; }
    body.theme-sepia {
      background-color: #F4ECD8 !important;
      color: #272016 !important;
    }
    body.theme-sepia header,
    body.theme-sepia section,
    body.theme-sepia .bg-white {
      background-color: #FAF4E8 !important;
      border-color: #E2D7C0 !important;
    }
    body.theme-sepia .bg-neutral-50 {
      background-color: #EFE7D2 !important;
      border-color: #E2D7C0 !important;
    }
  </style>
</head>
<body class="bg-neutral-50 text-neutral-900 min-h-screen antialiased flex flex-col" id="appBody">
  <!-- Top Bar -->
  <header class="bg-white border-b border-neutral-200 px-6 py-3 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
        P
      </div>
      <div>
        <h1 class="text-sm font-bold text-neutral-900 leading-tight">${escapeHtml(session.title)}</h1>
        <p class="text-[11px] text-neutral-500">${escapeHtml(folderName)} · Offline Standalone Export</p>
      </div>
    </div>
    <div class="flex items-center gap-2 sm:gap-3">
      <button onclick="toggleShortcutsModal()" class="px-2.5 py-1 text-xs border border-neutral-200 rounded-md hover:bg-neutral-100 transition-colors flex items-center gap-1 font-medium cursor-pointer">
        <span>⌨️ Shortcuts</span>
        <kbd class="text-[10px] bg-neutral-100 border border-neutral-300 px-1 rounded font-mono">?</kbd>
      </button>
      <button onclick="toggleDyslexicFont()" class="px-2.5 py-1 text-xs border border-neutral-200 rounded-md hover:bg-neutral-100 transition-colors font-medium cursor-pointer">
        Toggle OpenDyslexic
      </button>
      <button id="themeToggleBtn" onclick="cycleTheme()" class="px-2.5 py-1 text-xs border border-neutral-200 rounded-md hover:bg-neutral-100 transition-colors font-medium cursor-pointer">
        Theme: Light
      </button>
    </div>
  </header>

  <!-- Main Split Layout -->
  <main class="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
    <!-- Left Panel: Audio Interface -->
    <section class="lg:col-span-5 bg-white border-r border-neutral-200 p-6 flex flex-col gap-6 overflow-y-auto">
      <div>
        <span class="text-xs uppercase tracking-wider font-semibold text-neutral-400">Audio Playback</span>
        <h2 class="text-base font-semibold text-neutral-800 mt-1">${escapeHtml(session.title)}</h2>
      </div>

      <!-- Native Audio Element with Data URL -->
      <audio id="mainAudio" src="${audioDataUrl}" preload="auto"></audio>

      <!-- Player UI Card -->
      <div class="p-5 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-4">
        <!-- Time Display -->
        <div class="flex items-center justify-between font-mono text-xs">
          <span id="currentTimeDisplay" class="font-bold text-indigo-600 text-sm">00:00</span>
          <span id="durationDisplay" class="text-neutral-500">00:00</span>
        </div>

        <!-- Progress Scrubber -->
        <div class="relative py-2">
          <input 
            type="range" 
            id="timelineScrubber" 
            min="0" 
            max="100" 
            value="0" 
            step="0.1" 
            class="w-full accent-indigo-600 cursor-pointer"
            oninput="handleSeek(this.value)"
          />
        </div>

        <!-- Controls -->
        <div class="flex items-center justify-center gap-4">
          <button onclick="skipTime(-5)" class="px-3 py-1.5 text-xs bg-neutral-200 hover:bg-neutral-300 rounded-lg font-medium transition-colors">
            -5s
          </button>
          <button id="playBtn" onclick="togglePlay()" class="w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center justify-center shadow transition-transform active:scale-95">
            ▶
          </button>
          <button onclick="skipTime(5)" class="px-3 py-1.5 text-xs bg-neutral-200 hover:bg-neutral-300 rounded-lg font-medium transition-colors">
            +5s
          </button>
        </div>

        <!-- Speed Selector -->
        <div class="flex items-center justify-between pt-2 border-t border-neutral-200 text-xs">
          <span class="text-neutral-500 text-[11px]">Speed:</span>
          <div class="flex items-center gap-1">
            <button onclick="setSpeed(0.75)" class="px-2 py-0.5 rounded bg-neutral-200 hover:bg-neutral-300 font-mono text-[11px]">0.75x</button>
            <button onclick="setSpeed(1.0)" class="px-2 py-0.5 rounded bg-indigo-600 text-white font-mono text-[11px] font-bold">1x</button>
            <button onclick="setSpeed(1.25)" class="px-2 py-0.5 rounded bg-neutral-200 hover:bg-neutral-300 font-mono text-[11px]">1.25x</button>
            <button onclick="setSpeed(1.5)" class="px-2 py-0.5 rounded bg-neutral-200 hover:bg-neutral-300 font-mono text-[11px]">1.5x</button>
          </div>
        </div>

        <!-- Enhance Audio (Web Audio API) Toggle -->
        <div class="pt-2 border-t border-neutral-200 flex items-center justify-between text-xs">
          <div>
            <div class="flex items-center gap-1">
              <span class="font-semibold text-neutral-800">Enhance Audio</span>
              <span id="enhanceTag" class="hidden text-[9px] font-bold uppercase bg-emerald-100 text-emerald-700 px-1 rounded">Active</span>
            </div>
            <p class="text-[10px] text-neutral-500">Auto-level voices & vocal EQ boost</p>
          </div>
          <button id="enhanceToggleBtn" onclick="toggleAudioEnhance()" class="px-2.5 py-1 text-xs rounded-lg border border-neutral-300 bg-white font-medium hover:bg-neutral-100 transition-colors">
            Enhance: OFF
          </button>
        </div>
      </div>

      <!-- Add Note at Current Time Button -->
      <div>
        <button onclick="focusNoteInput()" class="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs flex items-center justify-between shadow transition-colors">
          <span>+ Add Note at Current Time</span>
          <span class="font-mono bg-indigo-700/60 px-2 py-0.5 rounded text-[11px]" id="quickTimeTag">00:00</span>
        </button>
      </div>

      <!-- Marker List -->
      <div class="flex-1">
        <h3 class="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">Timeline Markers</h3>
        <div id="markersList" class="space-y-1.5 max-h-60 overflow-y-auto"></div>
      </div>

      <!-- Attached Slides & Visuals -->
      <div class="pt-3 border-t border-neutral-200">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-xs font-semibold uppercase tracking-wider text-neutral-400">Attached Slides (<span id="slideCount">0</span>)</h3>
        </div>
        <div id="slidesList" class="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto"></div>
      </div>
    </section>

    <!-- Right Panel: Notes Feed -->
    <section class="lg:col-span-7 bg-neutral-50 p-6 flex flex-col gap-4 overflow-hidden">
      <!-- Search Bar -->
      <div class="flex items-center gap-2">
        <input 
          type="text" 
          id="searchInput" 
          placeholder="Filter notes..." 
          oninput="renderNotes()" 
          class="flex-1 px-3 py-2 text-xs border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <select id="filterType" onchange="renderNotes()" class="px-2 py-2 text-xs border border-neutral-300 rounded-lg bg-white">
          <option value="all">All Types</option>
          <option value="note">Notes</option>
          <option value="task">Tasks</option>
          <option value="task_pending">Pending Tasks</option>
          <option value="key_point">Key Points</option>
          <option value="question_to_ask">Questions to Ask</option>
        </select>
      </div>

      <!-- Note Composer -->
      <div class="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm">
        <div class="flex items-center gap-2 mb-2 text-xs flex-wrap">
          <span class="text-neutral-400 text-[11px]">Type:</span>
          <select id="newNoteType" onchange="toggleComposerDueDate(this.value)" class="text-xs border border-neutral-200 rounded px-2 py-1 bg-neutral-50">
            <option value="note">Standard Note</option>
            <option value="task">Task</option>
            <option value="key_point">Key Point</option>
            <option value="question_to_ask">Question to Ask</option>
          </select>
          <div id="composerDueDateWrap" class="hidden flex items-center gap-1">
            <span class="text-neutral-400 text-[11px]">Due:</span>
            <input type="date" id="newNoteDueDate" class="text-xs border border-neutral-200 rounded px-1.5 py-0.5 bg-neutral-50"/>
          </div>
          <span class="ml-auto font-mono text-[11px] text-indigo-600 font-semibold" id="newNoteTimeTag">at 00:00</span>
        </div>
        <textarea 
          id="newNoteText" 
          rows="2" 
          placeholder="Write a note... (Press Ctrl+Enter to save)" 
          class="w-full text-xs p-2.5 border border-neutral-200 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-neutral-50"
        ></textarea>
        <div class="flex justify-end mt-2">
          <button onclick="addStandaloneNote()" class="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm">
            Save Note
          </button>
        </div>
      </div>

      <!-- Notes Feed List -->
      <div id="notesContainer" class="flex-1 overflow-y-auto space-y-3 pr-1"></div>
    </section>
  </main>

  <!-- Shortcuts Modal in Standalone Export -->
  <div id="shortcutsModal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" onclick="toggleShortcutsModal()">
    <div class="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-neutral-200 p-5 overflow-hidden flex flex-col max-h-[85vh]" onclick="event.stopPropagation()">
      <div class="flex items-center justify-between pb-3 border-b border-neutral-200">
        <div>
          <h3 class="text-sm font-bold text-neutral-900">Keyboard Shortcuts Cheat Sheet</h3>
          <p class="text-[11px] text-neutral-500">Quickly control audio playback and capture structured notes</p>
        </div>
        <button onclick="toggleShortcutsModal()" class="text-neutral-400 hover:text-neutral-700 p-1 rounded-lg">✕</button>
      </div>

      <div class="py-3 overflow-y-auto space-y-2 text-xs flex-1">
        <div class="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Audio Playback</div>
        <div class="flex items-center justify-between p-2 rounded bg-neutral-50">
          <span>Play / Pause</span>
          <kbd class="px-2 py-0.5 bg-white border border-neutral-300 rounded font-mono font-bold text-[11px]">Space</kbd>
        </div>
        <div class="flex items-center justify-between p-2 rounded bg-neutral-50">
          <span>Rewind / Fast-forward 5s</span>
          <span class="font-mono text-[11px]"><kbd class="px-1.5 py-0.5 bg-white border border-neutral-300 rounded">Shift</kbd> + <kbd class="px-1.5 py-0.5 bg-white border border-neutral-300 rounded">← / →</kbd></span>
        </div>
        <div class="flex items-center justify-between p-2 rounded bg-neutral-50">
          <span>Playback Speed</span>
          <span class="font-mono text-[11px]"><kbd class="px-1.5 py-0.5 bg-white border border-neutral-300 rounded">[</kbd> / <kbd class="px-1.5 py-0.5 bg-white border border-neutral-300 rounded">]</kbd></span>
        </div>

        <div class="text-[11px] font-bold text-neutral-400 uppercase tracking-wider pt-2">Notes & Capture</div>
        <div class="flex items-center justify-between p-2 rounded bg-neutral-50">
          <span>Add Note at Current Second</span>
          <span class="font-mono text-[11px]"><kbd class="px-1.5 py-0.5 bg-white border border-neutral-300 rounded">Ctrl/⌘</kbd> + <kbd class="px-1.5 py-0.5 bg-white border border-neutral-300 rounded">M</kbd></span>
        </div>
        <div class="flex items-center justify-between p-2 rounded bg-neutral-50">
          <span>Save Current Note</span>
          <kbd class="px-2 py-0.5 bg-white border border-neutral-300 rounded font-mono font-bold text-[11px]">Enter</kbd>
        </div>
        <div class="flex items-center justify-between p-2 rounded bg-neutral-50">
          <span>Insert Line Break</span>
          <span class="font-mono text-[11px]"><kbd class="px-1.5 py-0.5 bg-white border border-neutral-300 rounded">Shift</kbd> + <kbd class="px-1.5 py-0.5 bg-white border border-neutral-300 rounded">Enter</kbd></span>
        </div>

        <div class="text-[11px] font-bold text-neutral-400 uppercase tracking-wider pt-2">Navigation & General</div>
        <div class="flex items-center justify-between p-2 rounded bg-neutral-50">
          <span>Toggle Cheat Sheet</span>
          <kbd class="px-2 py-0.5 bg-white border border-neutral-300 rounded font-mono font-bold text-[11px]">?</kbd>
        </div>
        <div class="flex items-center justify-between p-2 rounded bg-neutral-50">
          <span>Focus Search Bar</span>
          <kbd class="px-2 py-0.5 bg-white border border-neutral-300 rounded font-mono font-bold text-[11px]">/</kbd>
        </div>
      </div>

      <div class="pt-3 border-t border-neutral-200 flex justify-end">
        <button onclick="toggleShortcutsModal()" class="px-3 py-1 bg-neutral-100 hover:bg-neutral-200 rounded text-xs font-medium">Close</button>
      </div>
    </div>
  </div>

  <!-- Slide Lightbox Modal -->
  <div id="slideLightbox" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm" onclick="closeSlideLightbox()">
    <div class="relative max-w-4xl max-h-[90vh] flex flex-col items-center" onclick="event.stopPropagation()">
      <div class="w-full flex items-center justify-between text-white mb-2">
        <span id="lightboxSlideTitle" class="text-xs font-semibold truncate"></span>
        <button onclick="closeSlideLightbox()" class="text-white hover:text-neutral-300 p-1 rounded-lg">✕</button>
      </div>
      <div class="relative max-h-[80vh] max-w-full flex items-center justify-center">
        <img id="lightboxSlideImg" src="" alt="Slide Preview" class="max-h-[80vh] max-w-full object-contain rounded-lg shadow-2xl"/>
        <img id="lightboxAnnotationImg" src="" alt="Annotations" class="hidden absolute inset-0 w-full h-full object-contain pointer-events-none"/>
      </div>
    </div>
  </div>

  <script>
    let notes = ${notesJson};
    let slides = ${slidesJson};
    const sessionData = ${sessionJson};
    const audio = document.getElementById('mainAudio');
    const playBtn = document.getElementById('playBtn');
    const scrubber = document.getElementById('timelineScrubber');
    const currentTimeDisplay = document.getElementById('currentTimeDisplay');
    const durationDisplay = document.getElementById('durationDisplay');
    const quickTimeTag = document.getElementById('quickTimeTag');
    const newNoteTimeTag = document.getElementById('newNoteTimeTag');
    let isDyslexic = false;
    let currentTheme = 'light';
    let isAudioEnhanced = false;

    // Web Audio API DSP Nodes for Voice Boost & Auto-Leveling
    let audioCtx = null;
    let sourceNode = null;
    let hpFilter = null;
    let vocalFilter = null;
    let compressor = null;
    let makeupGain = null;

    function initWebAudioPipeline() {
      if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContextClass();
        sourceNode = audioCtx.createMediaElementSource(audio);

        // 1. High-pass filter (80Hz rumble rolloff)
        hpFilter = audioCtx.createBiquadFilter();
        hpFilter.type = 'highpass';
        hpFilter.frequency.value = isAudioEnhanced ? 80 : 10;

        // 2. Vocal EQ boost (2.5kHz peaking filter)
        vocalFilter = audioCtx.createBiquadFilter();
        vocalFilter.type = 'peaking';
        vocalFilter.frequency.value = 2500;
        vocalFilter.Q.value = 1.0;
        vocalFilter.gain.value = isAudioEnhanced ? 6.5 : 0;

        // 3. Dynamics Compressor (auto-level quiet voices & limit loud bursts)
        compressor = audioCtx.createDynamicsCompressor();
        compressor.threshold.value = isAudioEnhanced ? -28 : 0;
        compressor.knee.value = 10;
        compressor.ratio.value = isAudioEnhanced ? 12 : 1;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.25;

        // 4. Makeup Gain
        makeupGain = audioCtx.createGain();
        makeupGain.gain.value = isAudioEnhanced ? 1.8 : 1.0;

        // Connect chain: source -> hpFilter -> vocalFilter -> compressor -> makeupGain -> destination
        sourceNode.connect(hpFilter);
        hpFilter.connect(vocalFilter);
        vocalFilter.connect(compressor);
        compressor.connect(makeupGain);
        makeupGain.connect(audioCtx.destination);
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
    }

    function toggleAudioEnhance() {
      initWebAudioPipeline();
      isAudioEnhanced = !isAudioEnhanced;
      const now = audioCtx.currentTime;

      hpFilter.frequency.setTargetAtTime(isAudioEnhanced ? 80 : 10, now, 0.04);
      vocalFilter.gain.setTargetAtTime(isAudioEnhanced ? 6.5 : 0, now, 0.04);
      compressor.threshold.setTargetAtTime(isAudioEnhanced ? -28 : 0, now, 0.04);
      compressor.ratio.setTargetAtTime(isAudioEnhanced ? 12 : 1, now, 0.04);
      makeupGain.gain.setTargetAtTime(isAudioEnhanced ? 1.8 : 1.0, now, 0.04);

      const btn = document.getElementById('enhanceToggleBtn');
      const tag = document.getElementById('enhanceTag');
      if (isAudioEnhanced) {
        btn.innerText = 'Enhance: ON';
        btn.className = 'px-2.5 py-1 text-xs rounded-lg border border-emerald-500 bg-emerald-600 text-white font-semibold transition-colors';
        tag.classList.remove('hidden');
      } else {
        btn.innerText = 'Enhance: OFF';
        btn.className = 'px-2.5 py-1 text-xs rounded-lg border border-neutral-300 bg-white font-medium hover:bg-neutral-100 transition-colors';
        tag.classList.add('hidden');
      }
    }

    function formatTime(s) {
      if (typeof s !== 'number' || isNaN(s) || !isFinite(s) || s < 0) return '00:00';
      const rounded = Math.round(s);
      const m = Math.floor(rounded / 60);
      const sec = Math.floor(rounded % 60);
      return (m < 10 ? '0' + m : m) + ':' + (sec < 10 ? '0' + sec : sec);
    }

    function togglePlay() {
      if (!audio.src) return;
      initWebAudioPipeline();
      if (audio.paused) {
        audio.play();
        playBtn.innerText = '⏸';
      } else {
        audio.pause();
        playBtn.innerText = '▶';
      }
    }

    function skipTime(delta) {
      audio.currentTime = Math.max(0, Math.min(audio.duration || 0, audio.currentTime + delta));
    }

    function setSpeed(rate) {
      audio.playbackRate = rate;
    }

    function handleSeek(val) {
      if (audio.duration) {
        audio.currentTime = (val / 100) * audio.duration;
      }
    }

    function jumpToTime(sec) {
      audio.currentTime = sec;
      if (audio.paused) {
        audio.play();
        playBtn.innerText = '⏸';
      }
    }

    audio.addEventListener('timeupdate', () => {
      const cur = audio.currentTime;
      const dur = audio.duration || sessionData.duration || 0;
      currentTimeDisplay.innerText = formatTime(cur);
      durationDisplay.innerText = formatTime(dur);
      quickTimeTag.innerText = formatTime(cur);
      newNoteTimeTag.innerText = 'at ' + formatTime(cur);
      if (dur > 0) {
        scrubber.value = (cur / dur) * 100;
      }
    });

    audio.addEventListener('loadedmetadata', () => {
      if (!isFinite(audio.duration) || audio.duration === Infinity) {
        const onSeeked = () => {
          audio.removeEventListener('seeked', onSeeked);
          const dur = isFinite(audio.duration) && audio.duration > 0 ? audio.duration : (sessionData.duration || 0);
          durationDisplay.innerText = formatTime(dur);
          audio.currentTime = 0;
        };
        audio.addEventListener('seeked', onSeeked, { once: true });
        audio.currentTime = 1e101;
      } else {
        durationDisplay.innerText = formatTime(audio.duration);
      }
    });

    function toggleDyslexicFont() {
      isDyslexic = !isDyslexic;
      document.body.classList.toggle('font-dyslexic', isDyslexic);
    }

    function cycleTheme() {
      const themes = ['light', 'dark', 'sepia'];
      const currentIndex = themes.indexOf(currentTheme);
      const nextTheme = themes[(currentIndex !== -1 ? currentIndex + 1 : 0) % themes.length];
      setTheme(nextTheme);
    }

    function setTheme(theme) {
      currentTheme = theme;
      const body = document.getElementById('appBody');
      const btn = document.getElementById('themeToggleBtn');

      document.documentElement.classList.remove('dark');
      body.classList.remove('theme-sepia');
      body.classList.remove('bg-neutral-50', 'bg-neutral-900', 'bg-[#F4ECD8]', 'text-neutral-900', 'text-neutral-100', 'text-[#272016]');

      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        body.classList.add('bg-neutral-900', 'text-neutral-100');
        if (btn) btn.innerText = 'Theme: Dark';
      } else if (theme === 'sepia') {
        body.classList.add('theme-sepia', 'bg-[#F4ECD8]', 'text-[#272016]');
        if (btn) btn.innerText = 'Theme: Sepia';
      } else {
        body.classList.add('bg-neutral-50', 'text-neutral-900');
        if (btn) btn.innerText = 'Theme: Light';
      }
    }

    function focusNoteInput() {
      document.getElementById('newNoteText').focus();
    }

    function toggleComposerDueDate(val) {
      const wrap = document.getElementById('composerDueDateWrap');
      if (wrap) {
        if (val === 'task') {
          wrap.classList.remove('hidden');
        } else {
          wrap.classList.add('hidden');
        }
      }
    }

    function addStandaloneNote() {
      const text = document.getElementById('newNoteText').value.trim();
      const type = document.getElementById('newNoteType').value;
      const dueInput = document.getElementById('newNoteDueDate');
      const dueDateVal = type === 'task' && dueInput && dueInput.value ? new Date(dueInput.value + 'T00:00:00').getTime() : undefined;
      if (!text) return;
      const newNote = {
        id: 'note-' + Date.now(),
        timestamp: audio.currentTime || 0,
        content: text,
        calloutType: type,
        dueDate: dueDateVal,
        completed: false
      };
      notes.push(newNote);
      notes.sort((a,b) => a.timestamp - b.timestamp);
      document.getElementById('newNoteText').value = '';
      if (dueInput) dueInput.value = '';
      renderNotes();
      renderMarkers();
    }

    function toggleShortcutsModal() {
      const modal = document.getElementById('shortcutsModal');
      modal.classList.toggle('hidden');
    }

    document.getElementById('newNoteText').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        addStandaloneNote();
      }
    });

    window.addEventListener('keydown', (e) => {
      const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';

      // '?' or Cmd/Ctrl + / toggles shortcuts cheat sheet
      if ((e.key === '?' || (e.shiftKey && e.key === '/')) && !isInput) {
        e.preventDefault();
        toggleShortcutsModal();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        toggleShortcutsModal();
        return;
      }

      if (e.key === 'Escape') {
        const modal = document.getElementById('shortcutsModal');
        if (!modal.classList.contains('hidden')) {
          modal.classList.add('hidden');
        }
        return;
      }

      // Ctrl/Cmd + M focuses note input at current second
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        focusNoteInput();
        return;
      }

      if (!isInput) {
        if (e.key === ' ' || e.code === 'Space') {
          e.preventDefault();
          togglePlay();
          return;
        }
        if (e.shiftKey && e.key === 'ArrowLeft') {
          e.preventDefault();
          skipTime(-5);
          return;
        }
        if (e.shiftKey && e.key === 'ArrowRight') {
          e.preventDefault();
          skipTime(5);
          return;
        }
        if (e.key === '/') {
          e.preventDefault();
          document.getElementById('searchInput').focus();
          return;
        }
      }
    });

    const calloutColors = {
      note: { border: 'border-[#e4ded5] dark:border-stone-800', bg: 'bg-[#faf8f5] dark:bg-stone-900/90', badge: 'bg-[#ebe5da] dark:bg-stone-800 text-stone-900 dark:text-stone-200', label: 'Note' },
      task: { border: 'border-[#b4edd0] dark:border-emerald-800/60', bg: 'bg-[#eaf8f1] dark:bg-emerald-950/30', badge: 'bg-[#bbf7d0] dark:bg-emerald-900/70 text-slate-900 dark:text-emerald-100 font-semibold', label: 'Task' },
      key_point: { border: 'border-[#fde68a] dark:border-amber-800/60', bg: 'bg-[#fffbeb] dark:bg-amber-950/30', badge: 'bg-[#fde68a] dark:bg-amber-900/70 text-slate-900 dark:text-amber-100 font-semibold', label: 'Key Point' },
      question_to_ask: { border: 'border-[#e9d5ff] dark:border-purple-800/60', bg: 'bg-[#faf5ff] dark:bg-purple-950/30', badge: 'bg-[#e9d5ff] dark:bg-purple-900/70 text-slate-900 dark:text-purple-100 font-semibold', label: 'Question to Ask' }
    };

    function renderNotes() {
      const container = document.getElementById('notesContainer');
      const q = document.getElementById('searchInput').value.toLowerCase();
      const filter = document.getElementById('filterType').value;

      const filtered = notes.filter(n => {
        if (q && !n.content.toLowerCase().includes(q) && !formatTime(n.timestamp).includes(q)) return false;
        if (filter === 'task_pending') return n.calloutType === 'task' && !n.completed;
        if (filter !== 'all' && n.calloutType !== filter) return false;
        return true;
      });

      if (filtered.length === 0) {
        container.innerHTML = '<div class="text-center py-10 text-xs text-neutral-400">No notes found.</div>';
        return;
      }

      container.innerHTML = filtered.map(n => {
        const style = calloutColors[n.calloutType] || calloutColors.note;
        const dueText = n.dueDate ? new Date(n.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
        return \`
          <div class="p-3.5 rounded-xl border \${style.border} \${style.bg} transition-all">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <button onclick="jumpToTime(\${n.timestamp})" class="px-2 py-0.5 rounded bg-neutral-900 text-white font-mono text-xs font-bold hover:bg-indigo-600 transition-colors">
                  ▶ \${formatTime(n.timestamp)}
                </button>
                <span class="text-[11px] font-semibold px-2 py-0.5 rounded \${style.badge}">\${style.label}</span>
              </div>
            </div>
            \${n.calloutType === 'task' ? 
              \`<div class="flex items-start gap-2.5 text-xs">
                <input type="checkbox" \${n.completed ? 'checked' : ''} onchange="toggleAction('\${n.id}')" class="mt-0.5 w-4 h-4 rounded border-emerald-400 accent-emerald-600 cursor-pointer shrink-0"/>
                <div class="flex-1 min-w-0">
                  <span class="\${n.completed ? 'line-through text-slate-400 opacity-60' : 'text-slate-900'} whitespace-pre-wrap">\${escapeHtml(n.content)}</span>
                  \${dueText ? \`<div class="mt-1"><span class="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 \${n.completed ? 'line-through opacity-60' : ''}">Due: \${dueText}</span></div>\` : ''}
                </div>
              </div>\` : 
              \`<p class="text-xs text-slate-900 whitespace-pre-wrap">\${escapeHtml(n.content)}</p>\`
            }
          </div>
        \`;
      }).join('');
    }

    function toggleAction(id) {
      const item = notes.find(n => n.id === id);
      if (item) {
        item.completed = !item.completed;
        renderNotes();
      }
    }

    function renderMarkers() {
      const list = document.getElementById('markersList');
      list.innerHTML = notes.map(n => \`
        <button onclick="jumpToTime(\${n.timestamp})" class="w-full text-left p-1.5 rounded hover:bg-neutral-100 flex items-center gap-2 text-xs truncate">
          <span class="font-mono text-indigo-600 font-semibold bg-neutral-100 px-1 rounded">\${formatTime(n.timestamp)}</span>
          <span class="truncate text-neutral-600">\${escapeHtml(n.content)}</span>
        </button>
      \`).join('');
    }

    function renderSlides() {
      const countEl = document.getElementById('slideCount');
      const list = document.getElementById('slidesList');
      if (countEl) countEl.innerText = slides.length;
      if (!list) return;

      if (slides.length === 0) {
        list.innerHTML = '<div class="col-span-2 text-center py-4 text-[11px] text-neutral-400">No slides attached</div>';
        return;
      }

      list.innerHTML = slides.map(s => \`
        <div class="relative group rounded-lg border border-neutral-200 overflow-hidden bg-white shadow-xs">
          <div class="relative w-full h-20 overflow-hidden cursor-pointer" onclick="openSlideLightbox('\${s.id}')">
            <img src="\${s.dataUrl}" alt="\${escapeHtml(s.name)}" class="w-full h-full object-cover group-hover:scale-105 transition-transform"/>
            \${s.annotationDataUrl ? \`<img src="\${s.annotationDataUrl}" alt="Annotations" class="absolute inset-0 w-full h-full object-cover pointer-events-none"/>\` : ''}
          </div>
          <div class="p-1.5 flex items-center justify-between text-[10px] bg-white">
            <span class="truncate font-medium text-neutral-700 max-w-[70px]">\${escapeHtml(s.name)}</span>
            \${typeof s.timestamp === 'number' ? \`
              <button onclick="jumpToTime(\${s.timestamp})" class="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 font-mono font-bold hover:bg-indigo-100">
                \${formatTime(s.timestamp)}
              </button>
            \` : ''}
          </div>
        </div>
      \`).join('');
    }

    function openSlideLightbox(slideId) {
      const slide = slides.find(s => s.id === slideId);
      if (!slide) return;
      document.getElementById('lightboxSlideTitle').innerText = slide.name;
      document.getElementById('lightboxSlideImg').src = slide.dataUrl;

      const annotImg = document.getElementById('lightboxAnnotationImg');
      if (slide.annotationDataUrl) {
        annotImg.src = slide.annotationDataUrl;
        annotImg.classList.remove('hidden');
      } else {
        annotImg.src = '';
        annotImg.classList.add('hidden');
      }

      document.getElementById('slideLightbox').classList.remove('hidden');
    }

    function closeSlideLightbox() {
      document.getElementById('slideLightbox').classList.add('hidden');
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.innerText = text;
      return div.innerHTML;
    }

    renderNotes();
    renderMarkers();
    renderSlides();
  </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
