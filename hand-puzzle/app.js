/**
 * HandCraft Puzzle — Gesture-Controlled 3x3, 4x4 & 5x5 Photo Puzzle Game
 * Supports MediaPipe Hands webcam tracking (Pinch & Drag, Pinch-Tap to Swap, Peace Sign to Peek)
 * as well as full Mouse & Touch controls and custom Photo Uploads.
 */

(() => {
  'use strict';

  // --- Constants & State ---
  const SOURCE_SIZE = 900; // High-DPI internal square canvas size for sharp tiles
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = SOURCE_SIZE;
  sourceCanvas.height = SOURCE_SIZE;
  const sourceCtx = sourceCanvas.getContext('2d');

  const state = {
    gridSize: 3,           // 3, 4, or 5
    mode: 'swap',          // 'swap' | 'slide'
    tiles: [],             // Array of tile IDs (0 .. N*N-1) at each board index
    emptyTileId: null,     // Used in 'slide' mode (N*N - 1)
    selectedSlot: null,    // Currently selected board slot index
    draggingSlot: null,    // Currently dragged board slot index
    hoverSlot: null,       // Board slot index under hand/mouse cursor
    moves: 0,
    elapsedSeconds: 0,
    timerInterval: null,
    timerRunning: false,
    isSolved: false,
    showNumbers: true,
    isPeeking: false,
    peacePeeking: false,
    soundEnabled: true,
    activePresetIndex: 0,

    // Hand Tracking State
    cameraActive: false,
    handVisible: false,
    cursorX: window.innerWidth / 2,
    cursorY: window.innerHeight / 2,
    targetX: window.innerWidth / 2,
    targetY: window.innerHeight / 2,
    isPinching: false,
    pinchStrength: 0,      // 0..1
    pinchStartX: 0,
    pinchStartY: 0,
    pinchStartSlot: null,
    peaceFrames: 0,
    hoveredUiElement: null,
  };

  // --- DOM Elements ---
  const dom = {
    puzzleGrid: document.getElementById('puzzle-grid'),
    boardWrapper: document.getElementById('board-wrapper'),
    statMoves: document.getElementById('stat-moves'),
    statTime: document.getElementById('stat-time'),
    statProgress: document.getElementById('stat-progress'),
    boardProgressFill: document.getElementById('board-progress-fill'),
    statusMessage: document.getElementById('status-message'),

    btnSize3: document.getElementById('btn-size-3'),
    btnSize4: document.getElementById('btn-size-4'),
    btnSize5: document.getElementById('btn-size-5'),
    btnModeSwap: document.getElementById('btn-mode-swap'),
    btnModeSlide: document.getElementById('btn-mode-slide'),

    btnShuffle: document.getElementById('btn-shuffle'),
    btnHint: document.getElementById('btn-hint'),
    btnNumbers: document.getElementById('btn-numbers'),
    btnPeek: document.getElementById('btn-peek'),
    btnSound: document.getElementById('btn-sound'),

    peekOverlay: document.getElementById('peek-overlay'),
    peekCanvas: document.getElementById('peek-canvas'),
    miniPreviewCanvas: document.getElementById('mini-preview-canvas'),

    winOverlay: document.getElementById('win-overlay'),
    winSummary: document.getElementById('win-summary'),
    btnPlayAgain: document.getElementById('btn-play-again'),
    btnNextSize: document.getElementById('btn-next-size'),
    confettiCanvas: document.getElementById('confetti-canvas'),

    fileInput: document.getElementById('file-input'),
    btnUploadPhoto: document.getElementById('btn-upload-photo'),
    btnSnapWebcam: document.getElementById('btn-snap-webcam'),
    uploadDropzone: document.getElementById('upload-dropzone'),
    presetGrid: document.getElementById('preset-grid'),

    btnCameraToggle: document.getElementById('btn-camera-toggle'),
    btnStartCamOverlay: document.getElementById('btn-start-cam-overlay'),
    cameraStatusDot: document.getElementById('camera-status-dot'),
    cameraBtnText: document.getElementById('camera-btn-text'),
    cameraPlaceholder: document.getElementById('camera-placeholder'),
    cameraPlaceholderText: document.getElementById('camera-placeholder-text'),
    cameraDeviceRow: document.getElementById('camera-device-row'),
    cameraSelect: document.getElementById('camera-select'),
    gestureBadge: document.getElementById('gesture-badge'),
    webcamVideo: document.getElementById('webcam-video'),
    webcamCanvas: document.getElementById('webcam-canvas'),
    pinchMeterFill: document.getElementById('pinch-meter-fill'),

    handCursor: document.getElementById('hand-cursor'),
    cursorLabel: document.getElementById('cursor-label'),
    cursorProgressBar: document.getElementById('cursor-progress-bar'),
    dragGhost: document.getElementById('drag-ghost'),
  };

  // --- Web Audio Synthesizer (Zero External Assets) ---
  class SoundFX {
    constructor() {
      this.ctx = null;
    }

    init() {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) this.ctx = new AudioContext();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    playTone(freq, type = 'sine', duration = 0.1, gainVal = 0.12, slideFreq = null) {
      if (!state.soundEnabled) return;
      try {
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        if (slideFreq) {
          osc.frequency.exponentialRampToValueAtTime(slideFreq, now + duration);
        }
        gain.gain.setValueAtTime(gainVal, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + duration);
      } catch (_) {
        // Ignore audio context restrictions prior to gesture
      }
    }

    grab() {
      this.playTone(320, 'triangle', 0.09, 0.12, 480);
    }

    swap() {
      this.playTone(260, 'sine', 0.12, 0.14, 390);
    }

    correctLock() {
      this.playTone(523.25, 'triangle', 0.14, 0.14, 659.25); // C5 -> E5
    }

    winFanfare() {
      if (!state.soundEnabled) return;
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((n, idx) => {
        setTimeout(() => this.playTone(n, 'triangle', 0.28, 0.16), idx * 110);
      });
    }
  }

  const sfx = new SoundFX();

  // --- Built-in Procedural High-Res Artworks ---
  const artworks = [
    {
      name: 'Alpine Sunset',
      render(ctx, w, h) {
        // Sky gradient
        const sky = ctx.createLinearGradient(0, 0, 0, h * 0.65);
        sky.addColorStop(0, '#0f172a');
        sky.addColorStop(0.35, '#4c1d95');
        sky.addColorStop(0.7, '#db2777');
        sky.addColorStop(1, '#f59e0b');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, w, h);

        // Glowing Sun
        const sunGrad = ctx.createRadialGradient(w * 0.5, h * 0.42, 20, w * 0.5, h * 0.42, w * 0.28);
        sunGrad.addColorStop(0, '#fef08a');
        sunGrad.addColorStop(0.4, '#f97316');
        sunGrad.addColorStop(1, 'rgba(249, 115, 22, 0)');
        ctx.fillStyle = sunGrad;
        ctx.beginPath();
        ctx.arc(w * 0.5, h * 0.42, w * 0.28, 0, Math.PI * 2);
        ctx.fill();

        // Stars in upper sky
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        for (let i = 0; i < 45; i++) {
          const sx = ((i * 197) % w);
          const sy = ((i * 97) % (h * 0.3));
          const sr = (i % 3) + 1.2;
          ctx.beginPath();
          ctx.arc(sx, sy, sr, 0, Math.PI * 2);
          ctx.fill();
        }

        // Far Mountains
        ctx.fillStyle = '#311042';
        ctx.beginPath();
        ctx.moveTo(0, h * 0.65);
        ctx.lineTo(w * 0.18, h * 0.38);
        ctx.lineTo(w * 0.35, h * 0.54);
        ctx.lineTo(w * 0.56, h * 0.32);
        ctx.lineTo(w * 0.78, h * 0.52);
        ctx.lineTo(w * 0.92, h * 0.39);
        ctx.lineTo(w, h * 0.55);
        ctx.lineTo(w, h * 0.65);
        ctx.closePath();
        ctx.fill();

        // Mid Mountains
        ctx.fillStyle = '#1e1b4b';
        ctx.beginPath();
        ctx.moveTo(0, h * 0.68);
        ctx.lineTo(w * 0.1, h * 0.49);
        ctx.lineTo(w * 0.29, h * 0.42);
        ctx.lineTo(w * 0.48, h * 0.58);
        ctx.lineTo(w * 0.72, h * 0.4);
        ctx.lineTo(w, h * 0.62);
        ctx.lineTo(w, h * 0.68);
        ctx.closePath();
        ctx.fill();

        // Lake Reflection
        const lake = ctx.createLinearGradient(0, h * 0.65, 0, h);
        lake.addColorStop(0, '#be185d');
        lake.addColorStop(0.4, '#4338ca');
        lake.addColorStop(1, '#090d16');
        ctx.fillStyle = lake;
        ctx.fillRect(0, h * 0.65, w, h * 0.35);

        // Water Shimmer Lines
        ctx.fillStyle = 'rgba(254, 240, 138, 0.45)';
        for (let i = 0; i < 18; i++) {
          const ly = h * 0.67 + i * (h * 0.017);
          const lw = (w * 0.32) * (1 - i / 24);
          ctx.fillRect(w * 0.5 - lw / 2 + Math.sin(i * 2) * 14, ly, lw, 4);
        }

        // Foreground Pine Silhouettes
        ctx.fillStyle = '#090d16';
        const drawPine = (px, baseY, treeH, treeW) => {
          for (let layer = 0; layer < 3; layer++) {
            const topY = baseY - treeH + layer * (treeH * 0.22);
            const botY = baseY - (2 - layer) * (treeH * 0.22);
            const halfW = (treeW * 0.5) * (0.55 + layer * 0.25);
            ctx.beginPath();
            ctx.moveTo(px, topY);
            ctx.lineTo(px - halfW, botY);
            ctx.lineTo(px + halfW, botY);
            ctx.closePath();
            ctx.fill();
          }
        };
        drawPine(w * 0.08, h * 0.98, 220, 110);
        drawPine(w * 0.17, h * 0.99, 160, 85);
        drawPine(w * 0.85, h * 0.99, 190, 95);
        drawPine(w * 0.94, h * 0.98, 240, 120);
      }
    },
    {
      name: 'Cyber Neon City',
      render(ctx, w, h) {
        const bg = ctx.createLinearGradient(0, 0, 0, h);
        bg.addColorStop(0, '#050814');
        bg.addColorStop(0.55, '#1e1b4b');
        bg.addColorStop(0.6, '#ec4899');
        bg.addColorStop(1, '#090d16');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);

        // Synthwave Striped Sun
        const cx = w * 0.5, cy = h * 0.36, r = w * 0.24;
        const sun = ctx.createLinearGradient(0, cy - r, 0, cy + r);
        sun.addColorStop(0, '#22d3ee');
        sun.addColorStop(0.5, '#f43f5e');
        sun.addColorStop(1, '#facc15');
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = sun;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        ctx.fillStyle = '#141236';
        for (let y = cy + 10; y < cy + r; y += 22) {
          const stripeH = Math.max(3, (y - cy) * 0.07);
          ctx.fillRect(cx - r, y, r * 2, stripeH);
        }
        ctx.restore();

        // City Skyline Buildings
        const blds = [
          [0.04, 0.12, 0.32, '#06b6d4'],
          [0.17, 0.11, 0.25, '#ec4899'],
          [0.29, 0.14, 0.38, '#a855f7'],
          [0.45, 0.12, 0.29, '#22d3ee'],
          [0.58, 0.13, 0.36, '#f43f5e'],
          [0.72, 0.12, 0.27, '#38bdf8'],
          [0.85, 0.11, 0.33, '#e879f9']
        ];
        const horizonY = h * 0.6;
        blds.forEach(([bx, bw, bh, accent]) => {
          const x = bx * w, width = bw * w, height = bh * h, y = horizonY - height;
          ctx.fillStyle = '#0b0f1f';
          ctx.fillRect(x, y, width, height);
          ctx.strokeStyle = accent;
          ctx.lineWidth = 3;
          ctx.strokeRect(x, y, width, height);

          // Lit Windows
          ctx.fillStyle = accent;
          for (let wy = y + 16; wy < horizonY - 14; wy += 22) {
            for (let wx = x + 12; wx < x + width - 16; wx += 18) {
              if (((wx + wy) % 5) !== 0) {
                ctx.fillRect(wx, wy, 9, 12);
              }
            }
          }
        });

        // 3D Perspective Grid Floor
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let i = -10; i <= 10; i++) {
          ctx.moveTo(w * 0.5 + i * 25, horizonY);
          ctx.lineTo(w * 0.5 + i * 160, h);
        }
        for (let j = 1; j <= 10; j++) {
          const py = horizonY + Math.pow(j / 10, 1.8) * (h - horizonY);
          ctx.moveTo(0, py);
          ctx.lineTo(w, py);
        }
        ctx.stroke();
      }
    },
    {
      name: 'Coral Reef Odyssey',
      render(ctx, w, h) {
        const sea = ctx.createLinearGradient(0, 0, 0, h);
        sea.addColorStop(0, '#38bdf8');
        sea.addColorStop(0.45, '#0284c7');
        sea.addColorStop(1, '#0f172a');
        ctx.fillStyle = sea;
        ctx.fillRect(0, 0, w, h);

        // Sunbeams
        ctx.save();
        for (let i = 0; i < 6; i++) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.beginPath();
          ctx.moveTo(w * (0.15 + i * 0.14), 0);
          ctx.lineTo(w * (0.22 + i * 0.14), 0);
          ctx.lineTo(w * (0.4 + i * 0.16), h);
          ctx.lineTo(w * (0.05 + i * 0.16), h);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();

        // Colorful Reef Hills
        const drawHill = (yOff, color) => {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.moveTo(0, h);
          for (let x = 0; x <= w; x += 30) {
            const y = yOff + Math.sin(x * 0.012 + yOff) * 45;
            ctx.lineTo(x, y);
          }
          ctx.lineTo(w, h);
          ctx.closePath();
          ctx.fill();
        };
        drawHill(h * 0.72, '#0d9488');
        drawHill(h * 0.82, '#be185d');
        drawHill(h * 0.89, '#f59e0b');

        // Tropical Fish
        const fishes = [
          [0.25, 0.3, 46, '#f97316', '#fde047', 1],
          [0.68, 0.24, 38, '#ec4899', '#67e8f9', -1],
          [0.45, 0.52, 54, '#facc15', '#ef4444', 1],
          [0.76, 0.6, 42, '#a855f7', '#fde047', -1],
          [0.22, 0.65, 36, '#10b981', '#ffffff', 1]
        ];
        fishes.forEach(([fx, fy, size, c1, c2, dir]) => {
          const x = fx * w, y = fy * h;
          ctx.save();
          ctx.translate(x, y);
          ctx.scale(dir, 1);
          // Tail
          ctx.fillStyle = c2;
          ctx.beginPath();
          ctx.moveTo(-size * 0.7, 0);
          ctx.lineTo(-size * 1.35, -size * 0.55);
          ctx.lineTo(-size * 1.35, size * 0.55);
          ctx.closePath();
          ctx.fill();
          // Body
          ctx.fillStyle = c1;
          ctx.beginPath();
          ctx.ellipse(0, 0, size, size * 0.58, 0, 0, Math.PI * 2);
          ctx.fill();
          // Stripe
          ctx.fillStyle = c2;
          ctx.fillRect(-size * 0.15, -size * 0.52, size * 0.25, size * 1.04);
          // Eye
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(size * 0.52, -size * 0.14, size * 0.16, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.arc(size * 0.56, -size * 0.14, size * 0.08, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });

        // Bubbles
        ctx.strokeStyle = 'rgba(255,255,255,0.65)';
        ctx.lineWidth = 2.5;
        for (let i = 0; i < 24; i++) {
          const bx = ((i * 173 + 60) % (w - 80)) + 40;
          const by = ((i * 139 + 40) % (h - 120)) + 40;
          const br = 6 + (i % 4) * 5;
          ctx.beginPath();
          ctx.arc(bx, by, br, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    },
    {
      name: 'Prism Mandala',
      render(ctx, w, h) {
        // Distinct 4-quadrant background so every corner has a unique color signature
        const quads = [
          [0, 0, '#1e1b4b', '#4f46e5'],
          [w / 2, 0, '#3b0764', '#db2777'],
          [0, h / 2, '#064e3b', '#06b6d4'],
          [w / 2, h / 2, '#451a03', '#f59e0b']
        ];
        quads.forEach(([qx, qy, c1, c2]) => {
          const g = ctx.createRadialGradient(qx + w / 4, qy + h / 4, 20, qx + w / 4, qy + h / 4, w * 0.45);
          g.addColorStop(0, c2);
          g.addColorStop(1, c1);
          ctx.fillStyle = g;
          ctx.fillRect(qx, qy, w / 2, h / 2);
        });

        // Concentric Mandala Rings
        const cx = w / 2, cy = h / 2;
        const colors = ['#f43f5e', '#f59e0b', '#10b981', '#06b6d4', '#8b5cf6', '#ec4899'];
        for (let ring = 6; ring >= 1; ring--) {
          const rad = ring * (w * 0.068);
          const petals = 12;
          ctx.save();
          ctx.translate(cx, cy);
          for (let p = 0; p < petals; p++) {
            ctx.rotate((Math.PI * 2) / petals);
            ctx.fillStyle = colors[(ring + p) % colors.length];
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(rad * 0.45, -rad * 0.28, rad, 0);
            ctx.quadraticCurveTo(rad * 0.45, rad * 0.28, 0, 0);
            ctx.fill();
            ctx.stroke();
          }
          ctx.restore();
        }

        // Corner medallions for clear orientation cues
        const corners = [
          [w * 0.14, h * 0.14, '#38bdf8', 'NW'],
          [w * 0.86, h * 0.14, '#f472b6', 'NE'],
          [w * 0.14, h * 0.86, '#34d399', 'SW'],
          [w * 0.86, h * 0.86, '#fbbf24', 'SE']
        ];
        corners.forEach(([x, y, col, label]) => {
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.arc(x, y, 54, 0, Math.PI * 2);
          ctx.fill();
          ctx.lineWidth = 4;
          ctx.strokeStyle = '#fff';
          ctx.stroke();
          ctx.fillStyle = '#0f172a';
          ctx.font = '800 28px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, x, y);
        });
      }
    }
  ];

  // --- Initialize Preset Gallery ---
  function initPresets() {
    dom.presetGrid.innerHTML = '';
    artworks.forEach((art, index) => {
      const btn = document.createElement('button');
      btn.className = `preset-item gesture-target ${index === 0 ? 'active' : ''}`;
      btn.title = art.name;
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = 160;
      thumbCanvas.height = 160;
      art.render(thumbCanvas.getContext('2d'), 160, 160);
      btn.appendChild(thumbCanvas);
      btn.addEventListener('click', () => selectPreset(index, btn));
      dom.presetGrid.appendChild(btn);
    });
  }

  function selectPreset(index, btnEl) {
    state.activePresetIndex = index;
    document.querySelectorAll('.preset-item').forEach((el) => el.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    artworks[index].render(sourceCtx, SOURCE_SIZE, SOURCE_SIZE);
    syncPreviewCanvases();
    startNewPuzzle();
  }

  function loadCustomImage(imgElement, label = 'Custom Photo') {
    // Center-crop image onto square sourceCanvas
    const iw = imgElement.naturalWidth || imgElement.videoWidth || imgElement.width;
    const ih = imgElement.naturalHeight || imgElement.videoHeight || imgElement.height;
    const side = Math.min(iw, ih);
    const sx = (iw - side) / 2;
    const sy = (ih - side) / 2;

    sourceCtx.clearRect(0, 0, SOURCE_SIZE, SOURCE_SIZE);
    sourceCtx.drawImage(imgElement, sx, sy, side, side, 0, 0, SOURCE_SIZE, SOURCE_SIZE);

    // Add or update custom preset thumbnail at the front of presetGrid
    document.querySelectorAll('.preset-item').forEach((el) => el.classList.remove('active'));
    const customBtn = document.createElement('button');
    customBtn.className = 'preset-item gesture-target active';
    customBtn.title = label;
    const thumb = document.createElement('canvas');
    thumb.width = 160;
    thumb.height = 160;
    thumb.getContext('2d').drawImage(sourceCanvas, 0, 0, 160, 160);
    customBtn.appendChild(thumb);

    // Save snapshot data URL for re-selecting
    const snapshotCanvas = document.createElement('canvas');
    snapshotCanvas.width = SOURCE_SIZE;
    snapshotCanvas.height = SOURCE_SIZE;
    snapshotCanvas.getContext('2d').drawImage(sourceCanvas, 0, 0);

    customBtn.addEventListener('click', () => {
      document.querySelectorAll('.preset-item').forEach((el) => el.classList.remove('active'));
      customBtn.classList.add('active');
      sourceCtx.drawImage(snapshotCanvas, 0, 0);
      syncPreviewCanvases();
      startNewPuzzle();
    });

    if (dom.presetGrid.children.length >= 4) {
      dom.presetGrid.removeChild(dom.presetGrid.lastElementChild);
    }
    dom.presetGrid.prepend(customBtn);

    syncPreviewCanvases();
    startNewPuzzle();
    setStatus(`Loaded "${label}"! Pinch & drag tiles or click to play.`);
  }

  function syncPreviewCanvases() {
    const peekCtx = dom.peekCanvas.getContext('2d');
    peekCtx.clearRect(0, 0, dom.peekCanvas.width, dom.peekCanvas.height);
    peekCtx.drawImage(sourceCanvas, 0, 0, dom.peekCanvas.width, dom.peekCanvas.height);

    const miniCtx = dom.miniPreviewCanvas.getContext('2d');
    miniCtx.clearRect(0, 0, dom.miniPreviewCanvas.width, dom.miniPreviewCanvas.height);
    miniCtx.drawImage(sourceCanvas, 0, 0, dom.miniPreviewCanvas.width, dom.miniPreviewCanvas.height);
  }

  // --- Puzzle Setup & Shuffling ---
  function startNewPuzzle() {
    const N = state.gridSize;
    const total = N * N;
    state.tiles = Array.from({ length: total }, (_, i) => i);
    state.emptyTileId = state.mode === 'slide' ? total - 1 : null;
    state.selectedSlot = null;
    state.draggingSlot = null;
    state.hoverSlot = null;
    state.moves = 0;
    state.isSolved = false;
    dom.winOverlay.classList.add('hidden');
    hideDragGhost();

    resetTimer();
    shuffleTiles();
    renderBoard();
    updateHUD();
  }

  function shuffleTiles() {
    const N = state.gridSize;
    const total = N * N;

    if (state.mode === 'swap') {
      // Fisher-Yates shuffle, ensuring at least most tiles are displaced
      do {
        for (let i = total - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [state.tiles[i], state.tiles[j]] = [state.tiles[j], state.tiles[i]];
        }
      } while (countCorrectTiles() > Math.floor(total / 3));
    } else {
      // Classic Slide Mode: Perform valid random sliding moves from solved state
      // so the puzzle is 100% guaranteed solvable!
      state.tiles = Array.from({ length: total }, (_, i) => i);
      let emptySlot = total - 1;
      let prevSlot = -1;
      const shuffleSteps = N * N * 18;

      for (let step = 0; step < shuffleSteps; step++) {
        const neighbors = getAdjacentSlots(emptySlot, N).filter((s) => s !== prevSlot);
        const pick = neighbors[Math.floor(Math.random() * neighbors.length)];
        [state.tiles[emptySlot], state.tiles[pick]] = [state.tiles[pick], state.tiles[emptySlot]];
        prevSlot = emptySlot;
        emptySlot = pick;
      }

      // Guard against accidentally ending in solved state
      if (countCorrectTiles() === total) {
        const neighbors = getAdjacentSlots(emptySlot, N);
        const pick = neighbors[0];
        [state.tiles[emptySlot], state.tiles[pick]] = [state.tiles[pick], state.tiles[emptySlot]];
      }
    }
  }

  function getAdjacentSlots(slot, N) {
    const r = Math.floor(slot / N);
    const c = slot % N;
    const adj = [];
    if (r > 0) adj.push((r - 1) * N + c);
    if (r < N - 1) adj.push((r + 1) * N + c);
    if (c > 0) adj.push(r * N + (c - 1));
    if (c < N - 1) adj.push(r * N + (c + 1));
    return adj;
  }

  // --- Board Rendering ---
  function renderBoard() {
    const N = state.gridSize;
    const total = N * N;
    const tilePixelSize = Math.floor(SOURCE_SIZE / N);

    dom.puzzleGrid.style.gridTemplateColumns = `repeat(${N}, 1fr)`;
    dom.puzzleGrid.style.gridTemplateRows = `repeat(${N}, 1fr)`;
    dom.puzzleGrid.classList.toggle('hide-numbers', !state.showNumbers);
    dom.puzzleGrid.innerHTML = '';

    for (let slot = 0; slot < total; slot++) {
      const tileId = state.tiles[slot];
      const tileEl = document.createElement('div');
      tileEl.className = 'puzzle-tile';
      tileEl.dataset.slot = slot;

      const isEmpty = state.mode === 'slide' && tileId === state.emptyTileId && !state.isSolved;

      if (isEmpty) {
        tileEl.classList.add('empty-slot');
      } else {
        if (tileId === slot) {
          tileEl.classList.add('correct-spot');
        }
        if (state.selectedSlot === slot) {
          tileEl.classList.add('selected');
        }
        if (state.draggingSlot === slot) {
          tileEl.classList.add('dragging-source');
        }
        if (state.hoverSlot === slot) {
          tileEl.classList.add('gesture-hover');
        }

        // Draw slice of sourceCanvas onto tile canvas
        const canvas = document.createElement('canvas');
        canvas.width = tilePixelSize;
        canvas.height = tilePixelSize;
        const srcRow = Math.floor(tileId / N);
        const srcCol = tileId % N;
        canvas
          .getContext('2d')
          .drawImage(
            sourceCanvas,
            srcCol * tilePixelSize,
            srcRow * tilePixelSize,
            tilePixelSize,
            tilePixelSize,
            0,
            0,
            tilePixelSize,
            tilePixelSize
          );
        tileEl.appendChild(canvas);

        // Tile Number Badge (1-based)
        const badge = document.createElement('span');
        badge.className = 'tile-number';
        badge.textContent = tileId + 1;
        tileEl.appendChild(badge);

        // Mouse & Touch Event Listeners
        attachTilePointerEvents(tileEl, slot);
      }

      dom.puzzleGrid.appendChild(tileEl);
    }
  }

  function updateTileClassesOnly() {
    const tilesEls = dom.puzzleGrid.children;
    for (let slot = 0; slot < tilesEls.length; slot++) {
      const el = tilesEls[slot];
      el.classList.toggle('selected', state.selectedSlot === slot);
      el.classList.toggle('dragging-source', state.draggingSlot === slot);
      el.classList.toggle('gesture-hover', state.hoverSlot === slot);
    }
  }

  // --- Mouse & Touch Pointer Interactions on Tiles ---
  function attachTilePointerEvents(tileEl, slot) {
    tileEl.addEventListener('pointerdown', (e) => {
      if (state.isSolved) return;
      e.preventDefault();
      ensureTimerStarted();

      if (state.mode === 'slide') {
        handleSlideClick(slot);
        return;
      }

      // Swap Mode: support both click-two-tiles AND drag-and-drop
      state.draggingSlot = slot;
      const startX = e.clientX;
      const startY = e.clientY;
      let hasDragged = false;

      sfx.grab();
      updateTileClassesOnly();

      const onMove = (moveEvt) => {
        const dx = moveEvt.clientX - startX;
        const dy = moveEvt.clientY - startY;
        if (!hasDragged && Math.hypot(dx, dy) > 8) {
          hasDragged = true;
          showDragGhost(slot, moveEvt.clientX, moveEvt.clientY);
        }
        if (hasDragged) {
          moveDragGhost(moveEvt.clientX, moveEvt.clientY);
          const targetSlot = getSlotAtPoint(moveEvt.clientX, moveEvt.clientY);
          if (targetSlot !== state.hoverSlot) {
            state.hoverSlot = targetSlot;
            updateTileClassesOnly();
          }
        }
      };

      const onUp = (upEvt) => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        hideDragGhost();
        state.draggingSlot = null;
        state.hoverSlot = null;

        if (hasDragged) {
          const dropSlot = getSlotAtPoint(upEvt.clientX, upEvt.clientY);
          if (dropSlot !== null && dropSlot !== slot) {
            swapSlots(slot, dropSlot);
            state.selectedSlot = null;
          } else {
            updateTileClassesOnly();
          }
        } else {
          // Click-to-select / Click-second-tile-to-swap
          handleTileTapInSwapMode(slot);
        }
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });
  }

  function handleTileTapInSwapMode(slot) {
    if (state.selectedSlot === null) {
      state.selectedSlot = slot;
      sfx.grab();
      setStatus(`Selected tile #${state.tiles[slot] + 1}. Now select another tile to swap!`);
      updateTileClassesOnly();
    } else if (state.selectedSlot === slot) {
      state.selectedSlot = null;
      updateTileClassesOnly();
    } else {
      const firstSlot = state.selectedSlot;
      state.selectedSlot = null;
      swapSlots(firstSlot, slot);
    }
  }

  function handleSlideClick(slot) {
    const N = state.gridSize;
    const emptySlot = state.tiles.indexOf(state.emptyTileId);
    if (slot === emptySlot) return;

    const r1 = Math.floor(slot / N);
    const c1 = slot % N;
    const rEmpty = Math.floor(emptySlot / N);
    const cEmpty = emptySlot % N;

    if (r1 !== rEmpty && c1 !== cEmpty) {
      setStatus('In Classic Slide mode, pick a tile in the same row or column as the empty space.');
      return;
    }

    ensureTimerStarted();

    // Slide single or multiple collinear tiles toward emptySlot
    const stepR = Math.sign(r1 - rEmpty);
    const stepC = Math.sign(c1 - cEmpty);
    let currR = rEmpty;
    let currC = cEmpty;

    while (currR !== r1 || currC !== c1) {
      const nextR = currR + stepR;
      const nextC = currC + stepC;
      const currIdx = currR * N + currC;
      const nextIdx = nextR * N + nextC;
      [state.tiles[currIdx], state.tiles[nextIdx]] = [state.tiles[nextIdx], state.tiles[currIdx]];
      currR = nextR;
      currC = nextC;
    }

    state.moves++;
    sfx.swap();
    renderBoard();
    updateHUD();
    checkWinCondition();
  }

  function swapSlots(slotA, slotB) {
    if (slotA === slotB || state.isSolved) return;
    ensureTimerStarted();

    [state.tiles[slotA], state.tiles[slotB]] = [state.tiles[slotB], state.tiles[slotA]];
    state.moves++;

    const lockedRight = state.tiles[slotA] === slotA || state.tiles[slotB] === slotB;
    if (lockedRight) {
      sfx.correctLock();
    } else {
      sfx.swap();
    }

    renderBoard();
    updateHUD();
    checkWinCondition();
  }

  // --- Floating Drag Ghost Tile ---
  function showDragGhost(slot, x, y) {
    const N = state.gridSize;
    const tileId = state.tiles[slot];
    if (tileId === undefined) return;
    const tilePixelSize = Math.floor(SOURCE_SIZE / N);
    const srcRow = Math.floor(tileId / N);
    const srcCol = tileId % N;

    const ghostCtx = dom.dragGhost.getContext('2d');
    ghostCtx.clearRect(0, 0, dom.dragGhost.width, dom.dragGhost.height);
    ghostCtx.drawImage(
      sourceCanvas,
      srcCol * tilePixelSize,
      srcRow * tilePixelSize,
      tilePixelSize,
      tilePixelSize,
      0,
      0,
      dom.dragGhost.width,
      dom.dragGhost.height
    );

    dom.dragGhost.classList.remove('hidden');
    moveDragGhost(x, y);
  }

  function moveDragGhost(x, y) {
    dom.dragGhost.style.left = `${x}px`;
    dom.dragGhost.style.top = `${y}px`;
  }

  function hideDragGhost() {
    dom.dragGhost.classList.add('hidden');
  }

  function getSlotAtPoint(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const tile = el.closest('.puzzle-tile');
    if (!tile) return null;
    const slot = parseInt(tile.dataset.slot, 10);
    return Number.isNaN(slot) ? null : slot;
  }

  // --- Hint Assist ---
  function triggerHint() {
    if (state.isSolved) return;
    ensureTimerStarted();

    if (state.mode === 'swap') {
      // Find first misplaced tile and swap it directly into its true home
      const misplacedSlot = state.tiles.findIndex((tileId, idx) => tileId !== idx);
      if (misplacedSlot === -1) return;
      const correctTileHolder = state.tiles.indexOf(misplacedSlot);
      swapSlots(misplacedSlot, correctTileHolder);
      const targetEl = dom.puzzleGrid.children[misplacedSlot];
      if (targetEl) targetEl.classList.add('hint-highlight');
      setStatus(`Hint used: Placed tile #${misplacedSlot + 1} into its correct position!`);
    } else {
      // In Slide mode, highlight a valid movable neighbor that reduces Manhattan distance
      const N = state.gridSize;
      const emptySlot = state.tiles.indexOf(state.emptyTileId);
      const neighbors = getAdjacentSlots(emptySlot, N);
      let bestSlot = neighbors[0];
      let bestGain = -Infinity;

      neighbors.forEach((nSlot) => {
        const tId = state.tiles[nSlot];
        const goalR = Math.floor(tId / N), goalC = tId % N;
        const currR = Math.floor(nSlot / N), currC = nSlot % N;
        const emptyR = Math.floor(emptySlot / N), emptyC = emptySlot % N;
        const beforeDist = Math.abs(goalR - currR) + Math.abs(goalC - currC);
        const afterDist = Math.abs(goalR - emptyR) + Math.abs(goalC - emptyC);
        const gain = beforeDist - afterDist;
        if (gain > bestGain) {
          bestGain = gain;
          bestSlot = nSlot;
        }
      });

      handleSlideClick(bestSlot);
      setStatus('Hint used: Slid an adjacent tile closer to its goal.');
    }
  }

  // --- Timer, Progress & Win Condition ---
  function ensureTimerStarted() {
    if (state.timerRunning || state.isSolved) return;
    state.timerRunning = true;
    state.timerInterval = setInterval(() => {
      state.elapsedSeconds++;
      dom.statTime.textContent = formatTime(state.elapsedSeconds);
    }, 1000);
  }

  function resetTimer() {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
    state.timerRunning = false;
    state.elapsedSeconds = 0;
    dom.statTime.textContent = '00:00';
  }

  function formatTime(sec) {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  function countCorrectTiles() {
    return state.tiles.reduce((acc, tileId, idx) => acc + (tileId === idx ? 1 : 0), 0);
  }

  function updateHUD() {
    const total = state.gridSize * state.gridSize;
    const correct = countCorrectTiles();
    const pct = Math.round((correct / total) * 100);

    dom.statMoves.textContent = state.moves;
    dom.statProgress.textContent = `${correct}/${total}`;
    dom.boardProgressFill.style.width = `${pct}%`;
  }

  function checkWinCondition() {
    const total = state.gridSize * state.gridSize;
    if (countCorrectTiles() === total) {
      state.isSolved = true;
      clearInterval(state.timerInterval);
      state.timerRunning = false;
      renderBoard(); // Reveals final tile in slide mode too
      sfx.winFanfare();
      dom.winSummary.textContent = `You solved the ${state.gridSize}×${state.gridSize} puzzle in ${state.moves} moves (${formatTime(state.elapsedSeconds)})!`;
      dom.winOverlay.classList.remove('hidden');
      launchConfetti();
      setStatus('🎉 Puzzle complete! Pinch or click "Play Again" to start a new round.');
    }
  }

  function setStatus(msg) {
    dom.statusMessage.textContent = msg;
  }

  // --- Confetti Celebration ---
  let confettiAnimId = null;
  function launchConfetti() {
    cancelAnimationFrame(confettiAnimId);
    const canvas = dom.confettiCanvas;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth || 560;
    canvas.height = canvas.offsetHeight || 560;

    const palette = ['#6366f1', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#fef08a'];
    const particles = Array.from({ length: 85 }, () => ({
      x: canvas.width / 2,
      y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 14,
      vy: (Math.random() - 0.85) * 14,
      size: 6 + Math.random() * 6,
      color: palette[Math.floor(Math.random() * palette.length)],
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.25
    }));

    function frame() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.28; // gravity
        p.rot += p.vRot;
        if (p.y < canvas.height + 20) alive = true;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      });
      if (alive && !dom.winOverlay.classList.contains('hidden')) {
        confettiAnimId = requestAnimationFrame(frame);
      }
    }
    frame();
  }

  // --- MediaPipe Hands & Gesture Controller ---
  let handsDetector = null;
  let cameraStream = null;
  let videoFrameLoopId = null;

  async function toggleCamera() {
    if (state.cameraActive) {
      stopCamera();
    } else {
      await startCamera();
    }
  }

  async function acquireCameraStream(preferredDeviceId) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error(
        'Camera API unavailable. Please open this app via http://localhost (not an insecure IP or restricted webview).'
      );
    }

    const attempts = [];
    if (typeof preferredDeviceId === 'string' && preferredDeviceId.length > 0) {
      attempts.push({
        video: { deviceId: { exact: preferredDeviceId }, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      attempts.push({
        video: { deviceId: { exact: preferredDeviceId } },
        audio: false
      });
    } else {
      attempts.push({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      attempts.push({ video: true, audio: false });
    }

    let lastErr = null;
    for (const constraints of attempts) {
      try {
        return await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        lastErr = err;
        // If user explicitly denied permission, don't keep re-prompting
        if (err && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
          throw err;
        }
      }
    }

    // Fallback: Enumerate videoinput devices and try built-in / FaceTime cameras first
    // (helps on macOS when Continuity Camera or a Virtual Camera is default but offline)
    if (navigator.mediaDevices.enumerateDevices) {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === 'videoinput' && d.deviceId);
      // Sort built-in / FaceTime cameras ahead of virtual/continuity cameras
      videoInputs.sort((a, b) => {
        const aScore = /facetime|built-in|usb/i.test(a.label) ? 0 : 1;
        const bScore = /facetime|built-in|usb/i.test(b.label) ? 0 : 1;
        return aScore - bScore;
      });
      for (const dev of videoInputs) {
        try {
          return await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: dev.deviceId } },
            audio: false
          });
        } catch (err) {
          lastErr = err;
        }
      }
    }

    throw lastErr || new Error('No working camera stream found.');
  }

  async function populateCameraDropdown(activeStream) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === 'videoinput');
      if (videoInputs.length <= 1) {
        dom.cameraDeviceRow.hidden = true;
        return;
      }

      const activeTrack = activeStream && activeStream.getVideoTracks()[0];
      const activeDeviceId = activeTrack && activeTrack.getSettings ? activeTrack.getSettings().deviceId : '';

      dom.cameraSelect.innerHTML = '';
      videoInputs.forEach((dev, idx) => {
        const opt = document.createElement('option');
        opt.value = dev.deviceId;
        opt.textContent = dev.label || `Camera ${idx + 1}`;
        if (dev.deviceId === activeDeviceId) opt.selected = true;
        dom.cameraSelect.appendChild(opt);
      });
      dom.cameraDeviceRow.hidden = false;
    } catch (_) {
      // Ignore enumeration errors
    }
  }

  async function startCamera(preferredDeviceId = null) {
    const deviceId = typeof preferredDeviceId === 'string' ? preferredDeviceId : null;
    try {
      dom.cameraBtnText.textContent = 'Starting Camera...';
      setGestureBadge('Requesting Cam...', 'badge-neutral');

      // Stop previous tracks if switching camera
      if (cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop());
        cameraStream = null;
      }

      // 1. Request webcam stream FIRST (directly inside user gesture handler)
      cameraStream = await acquireCameraStream(deviceId);

      dom.webcamVideo.srcObject = cameraStream;
      await new Promise((resolve) => {
        if (dom.webcamVideo.readyState >= 1) {
          resolve();
        } else {
          dom.webcamVideo.onloadedmetadata = () => resolve();
        }
      });
      await dom.webcamVideo.play();

      dom.webcamCanvas.width = dom.webcamVideo.videoWidth || 640;
      dom.webcamCanvas.height = dom.webcamVideo.videoHeight || 480;

      state.cameraActive = true;
      dom.cameraPlaceholder.classList.add('hidden');
      dom.cameraStatusDot.classList.add('live');
      dom.btnCameraToggle.classList.add('camera-active');
      dom.cameraBtnText.textContent = 'Camera On (Stop)';
      await populateCameraDropdown(cameraStream);

      // 2. Initialize MediaPipe Hands detector
      setGestureBadge('Loading Hand AI...', 'badge-neutral');
      if (!handsDetector) {
        if (typeof window.Hands === 'undefined') {
          throw new Error('MediaPipe Hands script not loaded — check your internet connection.');
        }
        handsDetector = new window.Hands({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });
        handsDetector.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.65,
          minTrackingConfidence: 0.65
        });
        handsDetector.onResults(onHandResults);
      }

      setGestureBadge('Show Hand 🖐️', 'badge-ready');
      setStatus('Hand tracking active! Move your hand to steer the cursor, pinch Thumb + Index to grab tiles.');

      cancelAnimationFrame(videoFrameLoopId);
      let isProcessingFrame = false;
      const processVideo = async () => {
        if (!state.cameraActive) return;
        if (dom.webcamVideo.readyState >= 2 && handsDetector && !isProcessingFrame) {
          isProcessingFrame = true;
          try {
            await handsDetector.send({ image: dom.webcamVideo });
          } catch (sendErr) {
            console.warn('Hand frame error:', sendErr);
          }
          isProcessingFrame = false;
        }
        if (state.cameraActive) {
          videoFrameLoopId = requestAnimationFrame(processVideo);
        }
      };
      processVideo();
    } catch (err) {
      console.error('Camera initialization error:', err);
      dom.cameraBtnText.textContent = 'Enable Hand Camera';
      dom.btnCameraToggle.classList.remove('camera-active');
      setGestureBadge('Camera Error', 'badge-neutral');

      let friendlyReason = err.message || 'Permission denied';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        friendlyReason =
          'Camera permission was blocked. Allow camera access in your browser address bar (and macOS System Settings → Privacy & Security → Camera).';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        friendlyReason = 'No camera device was detected on this computer.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        friendlyReason =
          'Camera is busy or unavailable (if iPhone Continuity Camera is selected, wake your phone or pick your built-in camera).';
      }

      if (dom.cameraPlaceholderText) {
        dom.cameraPlaceholderText.textContent = friendlyReason;
      }
      setStatus(`Could not access camera: ${friendlyReason}`);
    }
  }

  function stopCamera() {
    state.cameraActive = false;
    cancelAnimationFrame(videoFrameLoopId);
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      cameraStream = null;
    }
    dom.webcamVideo.srcObject = null;
    const ctx = dom.webcamCanvas.getContext('2d');
    ctx.clearRect(0, 0, dom.webcamCanvas.width, dom.webcamCanvas.height);

    dom.cameraPlaceholder.classList.remove('hidden');
    if (dom.cameraPlaceholderText) {
      dom.cameraPlaceholderText.textContent = 'Use your webcam to grab & swap tiles in mid-air!';
    }
    dom.cameraStatusDot.classList.remove('live');
    dom.btnCameraToggle.classList.remove('camera-active');
    dom.cameraBtnText.textContent = 'Enable Hand Camera';
    dom.handCursor.classList.add('hidden');
    hideDragGhost();
    setGestureBadge('Camera Off', 'badge-neutral');
  }

  function setGestureBadge(text, cls) {
    dom.gestureBadge.textContent = text;
    dom.gestureBadge.className = `badge ${cls}`;
  }

  function onHandResults(results) {
    const canvas = dom.webcamCanvas;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      state.handVisible = false;
      dom.handCursor.classList.add('hidden');
      dom.pinchMeterFill.style.width = '0%';
      if (state.peacePeeking) {
        state.peacePeeking = false;
        updatePeekDisplay();
      }
      if (state.cameraActive) {
        setGestureBadge('Show Hand 🖐️', 'badge-neutral');
      }
      return;
    }

    const lm = results.multiHandLandmarks[0];
    state.handVisible = true;
    dom.handCursor.classList.remove('hidden');

    // Draw Hand Landmarks Skeleton on PIP Canvas
    drawHandSkeleton(ctx, lm, canvas.width, canvas.height);

    // Compute Midpoint between Thumb Tip (4) and Index Tip (8) for intuitive pinching cursor
    const thumbTip = lm[4];
    const indexTip = lm[8];
    const wrist = lm[0];
    const middleMcp = lm[9];

    // Mirrored X coordinate (1 - x)
    const rawX = 1 - (thumbTip.x * 0.35 + indexTip.x * 0.65);
    const rawY = thumbTip.y * 0.35 + indexTip.y * 0.65;

    // Map active central camera region [0.14 .. 0.86] to full viewport [0 .. 1]
    const normX = Math.max(0, Math.min(1, (rawX - 0.14) / 0.72));
    const normY = Math.max(0, Math.min(1, (rawY - 0.14) / 0.72));

    state.targetX = normX * window.innerWidth;
    state.targetY = normY * window.innerHeight;

    // Smooth cursor position (adaptive EMA)
    const distJump = Math.hypot(state.targetX - state.cursorX, state.targetY - state.cursorY);
    const alpha = distJump > 90 ? 0.55 : 0.32;
    state.cursorX += (state.targetX - state.cursorX) * alpha;
    state.cursorY += (state.targetY - state.cursorY) * alpha;

    dom.handCursor.style.left = `${state.cursorX}px`;
    dom.handCursor.style.top = `${state.cursorY}px`;

    // Calculate Normalized Pinch Distance (Thumb Tip 4 to Index Tip 8 divided by Palm Size 0->9)
    const palmSize = Math.hypot(middleMcp.x - wrist.x, middleMcp.y - wrist.y) || 0.15;
    const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
    const pinchRatio = pinchDist / palmSize;

    // Convert ratio into 0..100% pinch meter
    const strength = Math.max(0, Math.min(1, (0.75 - pinchRatio) / 0.4));
    state.pinchStrength = strength;
    dom.pinchMeterFill.style.width = `${Math.round(strength * 100)}%`;

    // Update circular ring progress on virtual cursor
    const dashOffset = 125.6 * (1 - strength);
    dom.cursorProgressBar.style.strokeDashoffset = `${dashOffset}`;

    // Hysteresis thresholds for reliable Pinch Start / End
    const PINCH_ON_THRESHOLD = 0.42;
    const PINCH_OFF_THRESHOLD = 0.56;

    const wasPinching = state.isPinching;
    if (!wasPinching && pinchRatio < PINCH_ON_THRESHOLD) {
      state.isPinching = true;
      onGesturePinchStart(state.cursorX, state.cursorY);
    } else if (wasPinching && pinchRatio > PINCH_OFF_THRESHOLD) {
      state.isPinching = false;
      onGesturePinchEnd(state.cursorX, state.cursorY);
    } else if (state.isPinching) {
      onGesturePinchMove(state.cursorX, state.cursorY);
    } else {
      onGestureHoverMove(state.cursorX, state.cursorY);
    }

    // Check Peace Sign (✌️) to Peek Original Image when not pinching
    const isPeace = detectPeaceSign(lm) && !state.isPinching;
    if (isPeace) {
      state.peaceFrames++;
      if (state.peaceFrames >= 8) {
        state.peacePeeking = true;
        updatePeekDisplay();
        setGestureBadge('Peace: Peeking ✌️', 'badge-peek');
        dom.cursorLabel.textContent = 'PEEK ✌️';
      }
    } else {
      state.peaceFrames = 0;
      if (state.peacePeeking) {
        state.peacePeeking = false;
        updatePeekDisplay();
      }
    }

    // Update HUD badges & cursor visual state
    dom.handCursor.classList.toggle('pinching', state.isPinching);
    if (!state.peacePeeking) {
      if (state.isPinching) {
        setGestureBadge('Pinching 🤏', 'badge-pinch');
        dom.cursorLabel.textContent = 'GRAB 🤏';
      } else {
        setGestureBadge('Tracking 🖐️', 'badge-ready');
        dom.cursorLabel.textContent = 'OPEN';
      }
    }
  }

  function detectPeaceSign(lm) {
    // Index (8) and Middle (12) extended above PIP joints (6, 10), Ring (16) and Pinky (20) curled below PIP (14, 18)
    const indexUp = lm[8].y < lm[6].y - 0.03;
    const middleUp = lm[12].y < lm[10].y - 0.03;
    const ringCurled = lm[16].y > lm[14].y;
    const pinkyCurled = lm[20].y > lm[18].y;
    const vSpread = Math.hypot(lm[8].x - lm[12].x, lm[8].y - lm[12].y) > 0.04;
    return indexUp && middleUp && ringCurled && pinkyCurled && vSpread;
  }

  function drawHandSkeleton(ctx, lm, w, h) {
    if (window.drawConnectors && window.HAND_CONNECTIONS) {
      window.drawConnectors(ctx, lm, window.HAND_CONNECTIONS, {
        color: 'rgba(6, 182, 212, 0.75)',
        lineWidth: 3
      });
    }
    // Highlight thumb tip (4) and index tip (8)
    const t = lm[4], idx = lm[8];
    ctx.strokeStyle = state.isPinching ? '#ec4899' : '#22d3ee';
    ctx.lineWidth = state.isPinching ? 4 : 2;
    ctx.beginPath();
    ctx.moveTo(t.x * w, t.y * h);
    ctx.lineTo(idx.x * w, idx.y * h);
    ctx.stroke();

    [t, idx].forEach((pt) => {
      ctx.fillStyle = state.isPinching ? '#ec4899' : '#ffffff';
      ctx.beginPath();
      ctx.arc(pt.x * w, pt.y * h, 6, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // --- Hand Gesture Interaction Handlers ---
  function onGestureHoverMove(x, y) {
    // Highlight tile or UI button under hand cursor
    const slot = getSlotAtPoint(x, y);
    if (slot !== state.hoverSlot) {
      state.hoverSlot = slot;
      updateTileClassesOnly();
    }

    const el = document.elementFromPoint(x, y);
    const uiTarget = el ? el.closest('.gesture-target') : null;
    if (uiTarget !== state.hoveredUiElement) {
      if (state.hoveredUiElement) state.hoveredUiElement.classList.remove('gesture-hover');
      state.hoveredUiElement = uiTarget;
      if (uiTarget) uiTarget.classList.add('gesture-hover');
    }
  }

  function onGesturePinchStart(x, y) {
    state.pinchStartX = x;
    state.pinchStartY = y;

    // 1. Check if pinching a UI button
    const el = document.elementFromPoint(x, y);
    const uiTarget = el ? el.closest('.gesture-target') : null;
    if (uiTarget) {
      sfx.grab();
      uiTarget.click();
      return;
    }

    if (state.isSolved) return;

    // 2. Check if pinching a puzzle tile
    const slot = getSlotAtPoint(x, y);
    if (slot === null) return;

    ensureTimerStarted();

    if (state.mode === 'slide') {
      handleSlideClick(slot);
      return;
    }

    // Swap mode: start potential drag or tap-swap
    state.pinchStartSlot = slot;
    state.draggingSlot = slot;
    sfx.grab();
    showDragGhost(slot, x, y);
    updateTileClassesOnly();
  }

  function onGesturePinchMove(x, y) {
    if (state.pinchStartSlot === null) return;
    moveDragGhost(x, y);
    const targetSlot = getSlotAtPoint(x, y);
    if (targetSlot !== state.hoverSlot) {
      state.hoverSlot = targetSlot;
      updateTileClassesOnly();
    }
  }

  function onGesturePinchEnd(x, y) {
    if (state.pinchStartSlot === null) return;

    const startSlot = state.pinchStartSlot;
    const dropSlot = getSlotAtPoint(x, y);

    hideDragGhost();
    state.pinchStartSlot = null;
    state.draggingSlot = null;
    state.hoverSlot = null;

    if (dropSlot !== null && dropSlot !== startSlot) {
      // Pinched on startSlot and dragged onto dropSlot -> Swap immediately!
      state.selectedSlot = null;
      swapSlots(startSlot, dropSlot);
    } else {
      // Pinched and released on the same slot -> treat as a tap selection!
      handleTileTapInSwapMode(startSlot);
    }
  }

  // --- Peek Original Image Helper ---
  function updatePeekDisplay() {
    const active = state.isPeeking || state.peacePeeking;
    dom.peekOverlay.classList.toggle('hidden', !active);
    dom.btnPeek.classList.toggle('active', active);
  }

  // --- Wire Up UI Controls & File Upload ---
  function bindEvents() {
    // Grid Size Buttons (3x3, 4x4, 5x5)
    [dom.btnSize3, dom.btnSize4, dom.btnSize5].forEach((btn) => {
      btn.addEventListener('click', () => {
        const newSize = parseInt(btn.dataset.size, 10);
        if (state.gridSize === newSize && !state.isSolved) return;
        state.gridSize = newSize;
        [dom.btnSize3, dom.btnSize4, dom.btnSize5].forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        startNewPuzzle();
        setStatus(`Switched to ${newSize}×${newSize} grid (${newSize * newSize} tiles).`);
      });
    });

    // Mode Buttons (Swap vs Classic Slide)
    [dom.btnModeSwap, dom.btnModeSlide].forEach((btn) => {
      btn.addEventListener('click', () => {
        const newMode = btn.dataset.mode;
        if (state.mode === newMode) return;
        state.mode = newMode;
        [dom.btnModeSwap, dom.btnModeSlide].forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        startNewPuzzle();
        setStatus(
          newMode === 'swap'
            ? 'Swap Mode: Pinch & drag any tile onto another to swap them!'
            : 'Classic Slide Mode: Pinch or click tiles adjacent to the empty slot to slide them!'
        );
      });
    });

    // HUD Actions
    dom.btnShuffle.addEventListener('click', () => {
      sfx.swap();
      startNewPuzzle();
      setStatus('Board reshuffled!');
    });

    dom.btnHint.addEventListener('click', triggerHint);

    dom.btnNumbers.addEventListener('click', () => {
      state.showNumbers = !state.showNumbers;
      dom.btnNumbers.classList.toggle('active', state.showNumbers);
      dom.puzzleGrid.classList.toggle('hide-numbers', !state.showNumbers);
    });

    dom.btnPeek.addEventListener('click', () => {
      state.isPeeking = !state.isPeeking;
      updatePeekDisplay();
    });

    dom.btnSound.addEventListener('click', () => {
      state.soundEnabled = !state.soundEnabled;
      dom.btnSound.textContent = state.soundEnabled ? '🔊' : '🔇';
    });

    // Win Modal Buttons
    dom.btnPlayAgain.addEventListener('click', () => {
      startNewPuzzle();
    });

    dom.btnNextSize.addEventListener('click', () => {
      const next = state.gridSize === 3 ? 4 : state.gridSize === 4 ? 5 : 3;
      const btn = document.querySelector(`.pill-btn[data-size="${next}"]`);
      if (btn) btn.click();
    });

    // Camera Toggle Buttons
    dom.btnCameraToggle.addEventListener('click', toggleCamera);
    dom.btnStartCamOverlay.addEventListener('click', () => startCamera());
    if (dom.cameraSelect) {
      dom.cameraSelect.addEventListener('change', (e) => {
        if (e.target.value) startCamera(e.target.value);
      });
    }

    // Photo Upload (Button + Drag & Drop)
    dom.btnUploadPhoto.addEventListener('click', () => dom.fileInput.click());

    dom.fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) handleUploadedFile(file);
      dom.fileInput.value = '';
    });

    // Snap From Webcam Button
    dom.btnSnapWebcam.addEventListener('click', async () => {
      if (!state.cameraActive) {
        await startCamera();
      }
      if (dom.webcamVideo.readyState >= 2) {
        // Flip horizontally so webcam selfie matches mirror view
        const temp = document.createElement('canvas');
        temp.width = dom.webcamVideo.videoWidth;
        temp.height = dom.webcamVideo.videoHeight;
        const tCtx = temp.getContext('2d');
        tCtx.translate(temp.width, 0);
        tCtx.scale(-1, 1);
        tCtx.drawImage(dom.webcamVideo, 0, 0);
        loadCustomImage(temp, 'Webcam Snapshot');
        sfx.correctLock();
      } else {
        setStatus('Enable the webcam first to snap a live photo!');
      }
    });

    // Global Drag & Drop Image Support
    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      dom.uploadDropzone.classList.add('drag-over');
    });

    window.addEventListener('dragleave', (e) => {
      if (e.target === document.documentElement || e.target === document.body) {
        dom.uploadDropzone.classList.remove('drag-over');
      }
    });

    window.addEventListener('drop', (e) => {
      e.preventDefault();
      dom.uploadDropzone.classList.remove('drag-over');
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        handleUploadedFile(file);
      }
    });

    // Spacebar shortcut to hold-peek
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && document.activeElement === document.body) {
        e.preventDefault();
        state.isPeeking = true;
        updatePeekDisplay();
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        state.isPeeking = false;
        updatePeekDisplay();
      }
    });
  }

  function handleUploadedFile(file) {
    if (!file.type.startsWith('image/')) {
      setStatus('Please select a valid image file (PNG, JPG, WebP, GIF).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      const img = new Image();
      img.onload = () => {
        const cleanName = file.name.replace(/\.[^/.]+$/, '').slice(0, 22) || 'Uploaded Photo';
        loadCustomImage(img, cleanName);
        sfx.correctLock();
      };
      img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
  }

  // --- Boot ---
  function init() {
    initPresets();
    bindEvents();
    selectPreset(0, dom.presetGrid.firstElementChild);
  }

  init();
})();
