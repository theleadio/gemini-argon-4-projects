/**
 * Argon Atelier — Main Application Controller
 *
 * Connects:
 * - File upload / Drag & drop / Clipboard paste / Starter empty coloring sheets
 * - Connected-Component Region Segmentation & Photo -> Line Art cleaner
 * - Google Gemini 4 Argon (`google/gemini-4-argon`) multimodal coloring API
 * - 4 Real-time finish modes (Watercolor, Colored Pencil, Cel-Shaded, Flat)
 * - Smart Region Bucket, Region-Locked Brush, Eraser, Eyedropper, Split Curtain, Undo/Redo
 */

import {
  fitDimensions,
  analyzeUploadedImage,
  convertPhotoToLineArt,
  segmentColoringPage,
  buildArgonVisionImages,
} from './engine/segmentation.js';
import {
  renderRegionPigmentBuffer,
  deriveSecondaryHex,
  rgbToHex,
  hexToRgb,
} from './engine/renderer.js';
import {
  DEFAULT_OPENROUTER_API_KEY,
  STYLE_PRESETS,
  generateArgonColoringPlan,
} from './engine/argonApi.js';
import {
  SAMPLE_COLORING_PAGES,
  renderSamplePageToImageData,
} from './engine/samplePages.js';

// ==========================================
// Studio State
// ==========================================
const state = {
  sheetTitle: 'Alpine Valley Cottage',
  rawUploadedImageData: null, // Original image data before optional Photo->LineArt filter
  activeSourceImageData: null, // Current line-art ImageData being segmented
  segmentation: null, // { width, height, inkImageData, cleanLineImageData, regionMap, distField, regions }

  // Region colors: Map<regionId, { id, name, color, secondaryColor, source }>
  regionColors: new Map(),

  // Offscreen canvases for fast layer compositing
  pigmentCanvas: document.createElement('canvas'),
  brushCanvas: document.createElement('canvas'),
  inkCanvas: document.createElement('canvas'),
  emptySheetCanvas: document.createElement('canvas'),

  // Interactive Tool State
  activeTool: 'bucket', // 'bucket' | 'brush' | 'select-ai' | 'eyedropper' | 'eraser'
  finishMode: 'watercolor', // 'watercolor' | 'pencil' | 'cel' | 'flat'
  activeColor: '#E07A5F',
  paletteSwatches: [
    '#E07A5F',
    '#3B7A57',
    '#81B29A',
    '#F2CC8F',
    '#3051A8',
    '#E4B357',
    '#863A29',
    '#52B2F2',
    '#D96B27',
    '#3D405B',
  ],
  brushSize: 18,
  brushLockRegion: true,
  inkThreshold: 172,
  gapSeal: 1,

  // View Overlays
  showRegionNumbers: false,
  showSplitComparison: false,
  splitRatio: 0.5, // 0..1 horizontal curtain position
  zoom: 1.0,
  hoveredRegionId: 0,
  selectedRegionIds: new Set(),

  // Gemini 4 Argon Configuration
  stylePresetId: 'ghibli-gouache',
  apiKey:
    localStorage.getItem('argon_atelier_openrouter_key') ||
    DEFAULT_OPENROUTER_API_KEY,
  reasoningEffort: 'low',
  isColoringWithArgon: false,
  animationTimer: null,

  // Undo / Redo History Stack
  history: [],
  historyIndex: -1,
};

// ==========================================
// DOM Elements
// ==========================================
const dom = {
  canvas: document.getElementById('coloring-canvas'),
  paperFrame: document.getElementById('paper-sheet-frame'),
  fileInput: document.getElementById('file-input'),
  uploadPhotoBtn: document.getElementById('upload-photo-btn'),
  consoleUploadDropzone: document.getElementById('console-upload-dropzone'),
  dropzoneStage: document.getElementById('dropzone-stage'),
  dropOverlay: document.getElementById('drop-overlay'),
  sampleSelect: document.getElementById('sample-select'),
  extractLineartBtn: document.getElementById('extract-lineart-btn'),
  downloadEmptyBtn: document.getElementById('download-empty-btn'),
  undoBtn: document.getElementById('undo-btn'),
  redoBtn: document.getElementById('redo-btn'),
  resetEmptyBtn: document.getElementById('reset-empty-btn'),
  exportPngBtn: document.getElementById('export-png-btn'),

  // HUD & View Controls
  sheetTitleChip: document.getElementById('sheet-title-chip'),
  regionsCountChip: document.getElementById('regions-count-chip'),
  coloredProgressChip: document.getElementById('colored-progress-chip'),
  toggleNumbersBtn: document.getElementById('toggle-numbers-btn'),
  toggleSplitBtn: document.getElementById('toggle-split-btn'),
  splitCurtainLine: document.getElementById('split-curtain-line'),
  zoomOutBtn: document.getElementById('zoom-out-btn'),
  zoomInBtn: document.getElementById('zoom-in-btn'),
  zoomFitBtn: document.getElementById('zoom-fit-btn'),
  zoomLabel: document.getElementById('zoom-label'),
  livePaintCursor: document.getElementById('live-paint-cursor'),
  cursorSwatch: document.getElementById('cursor-swatch'),
  cursorText: document.getElementById('cursor-text'),
  regionHoverPill: document.getElementById('region-hover-pill'),
  hoverRegionId: document.getElementById('hover-region-id'),
  hoverRegionName: document.getElementById('hover-region-name'),

  // Tool Rail & Dock
  toolBtns: Array.from(document.querySelectorAll('.tool-btn')),
  brushLockCheckbox: document.getElementById('brush-lock-region'),
  brushSizeSlider: document.getElementById('brush-size-slider'),
  brushSizeVal: document.getElementById('brush-size-val'),
  finishPills: Array.from(document.querySelectorAll('.finish-pill')),
  activeColorInput: document.getElementById('active-color-input'),
  activeColorHex: document.getElementById('active-color-hex'),
  swatchRibbon: document.getElementById('swatch-ribbon'),
  inkThresholdSlider: document.getElementById('ink-threshold-slider'),
  inkThresholdVal: document.getElementById('ink-threshold-val'),
  gapSealSlider: document.getElementById('gap-seal-slider'),
  gapSealVal: document.getElementById('gap-seal-val'),

  // Right Argon Console
  argonColorBtn: document.getElementById('argon-color-btn'),
  argonBtnLabel: document.getElementById('argon-btn-label'),
  argonStatusBar: document.getElementById('argon-status-bar'),
  argonStatusText: document.getElementById('argon-status-text'),
  argonProgressFill: document.getElementById('argon-progress-fill'),
  animateStepsToggle: document.getElementById('animate-steps-toggle'),
  animSpeedSelect: document.getElementById('anim-speed-select'),
  presetGrid: document.getElementById('preset-grid'),
  activePresetTag: document.getElementById('active-preset-tag'),
  argonPromptInput: document.getElementById('argon-prompt-input'),
  clearPromptBtn: document.getElementById('clear-prompt-btn'),
  completeMicroToggle: document.getElementById('complete-micro-toggle'),
  selectedRegionsBar: document.getElementById('selected-regions-bar'),
  selectedRegionsCount: document.getElementById('selected-regions-count'),
  colorSelectedOnlyBtn: document.getElementById('color-selected-only-btn'),
  clearSelectedBtn: document.getElementById('clear-selected-btn'),

  // Argon Ledger & Blueprint
  argonLatencyBadge: document.getElementById('argon-latency-badge'),
  argonSceneTitle: document.getElementById('argon-scene-title'),
  argonNotesBody: document.getElementById('argon-notes-body'),
  blueprintPreviewImg: document.getElementById('blueprint-preview-img'),
  argonReasoningText: document.getElementById('argon-reasoning-text'),
  ledgerTotalCount: document.getElementById('ledger-total-count'),
  regionLedgerList: document.getElementById('region-ledger-list'),

  // Modal
  apiSettingsBtn: document.getElementById('api-settings-btn'),
  apiModal: document.getElementById('api-modal'),
  closeApiModalBtn: document.getElementById('close-api-modal-btn'),
  saveApiModalBtn: document.getElementById('save-api-modal-btn'),
  apiKeyInput: document.getElementById('api-key-input'),
  reasoningEffortSelect: document.getElementById('reasoning-effort-select'),
};

// ==========================================
// Initialization
// ==========================================
function initStudio() {
  populateStarterSelect();
  renderStylePresets();
  renderSwatchRibbon();
  bindEvents();

  // Load default starter empty coloring photo
  loadSamplePage('cottage');
}

function populateStarterSelect() {
  dom.sampleSelect.innerHTML = '';
  for (const page of SAMPLE_COLORING_PAGES) {
    const opt = document.createElement('option');
    opt.value = page.id;
    opt.textContent = `${page.title} (${page.regionsEstimate})`;
    dom.sampleSelect.appendChild(opt);
  }
}

function renderStylePresets() {
  dom.presetGrid.innerHTML = '';
  for (const preset of STYLE_PRESETS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `preset-card ${
      preset.id === state.stylePresetId ? 'active' : ''
    }`;
    btn.innerHTML = `
      <div class="preset-name">${preset.name}</div>
      <div class="preset-swatches">
        ${preset.swatch
          .map(
            (hex) =>
              `<span class="preset-swatch-dot" style="background:${hex}"></span>`
          )
          .join('')}
      </div>
    `;
    btn.addEventListener('click', () => {
      state.stylePresetId = preset.id;
      dom.activePresetTag.textContent = preset.tag;
      renderStylePresets();
    });
    dom.presetGrid.appendChild(btn);
  }
}

function renderSwatchRibbon() {
  dom.swatchRibbon.innerHTML = '';
  for (const hex of state.paletteSwatches) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `swatch-chip ${
      hex.toUpperCase() === state.activeColor.toUpperCase() ? 'active' : ''
    }`;
    chip.style.backgroundColor = hex;
    chip.title = hex;
    chip.addEventListener('click', () => {
      setActiveColor(hex);
    });
    dom.swatchRibbon.appendChild(chip);
  }
}

function setActiveColor(hex) {
  state.activeColor = hex.toUpperCase();
  dom.activeColorInput.value = state.activeColor;
  dom.activeColorHex.textContent = state.activeColor;
  renderSwatchRibbon();
}

// ==========================================
// Loading & Segmenting Coloring Photos
// ==========================================
function loadSamplePage(pageId) {
  stopActiveAnimation();
  const meta =
    SAMPLE_COLORING_PAGES.find((p) => p.id === pageId) ||
    SAMPLE_COLORING_PAGES[0];

  state.sheetTitle = meta.title;
  state.stylePresetId = meta.recommendedStyle || state.stylePresetId;
  dom.argonPromptInput.value = meta.defaultPrompt || '';
  renderStylePresets();

  const imgData = renderSamplePageToImageData(meta.id, 760);
  state.rawUploadedImageData = imgData;
  state.activeSourceImageData = imgData;
  state.regionColors.clear();
  state.selectedRegionIds.clear();
  updateSelectedRegionsUI();

  runSegmentationAndSetupLayers(true);
}

/**
 * Load an user-uploaded image File or Blob onto the coloring canvas
 */
function handleUploadedFile(file) {
  if (!file) return;
  stopActiveAnimation();

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const { width, height } = fitDimensions(
        img.naturalWidth || img.width || 760,
        img.naturalHeight || img.height || 760
      );
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tempCtx = tempCanvas.getContext('2d');

      // White paper backing for transparent PNGs
      tempCtx.fillStyle = '#FFFFFF';
      tempCtx.fillRect(0, 0, width, height);
      tempCtx.drawImage(img, 0, 0, width, height);

      const rawData = tempCtx.getImageData(0, 0, width, height);
      state.rawUploadedImageData = rawData;

      // Analyze if the uploaded image is already black-and-white line art or a full-color photo
      const analysis = analyzeUploadedImage(rawData);
      if (!analysis.isLikelyLineArt && analysis.satRatio > 0.18) {
        // Automatically extract clean line art if user uploaded a colored photograph,
        // while keeping rawUploadedImageData so they can toggle anytime
        state.activeSourceImageData = convertPhotoToLineArt(rawData, 1.35);
        dom.argonNotesBody.innerHTML =
          'Uploaded colored photo automatically converted to clean <strong>Empty Line Art</strong>. Ready for <code>google/gemini-4-argon</code>!';
      } else {
        state.activeSourceImageData = rawData;
        dom.argonNotesBody.innerHTML =
          'Uploaded empty coloring photo segmented into enclosed regions. Click <strong>Start Coloring with Gemini 4 Argon</strong>!';
      }

      const cleanName = file.name.replace(/\.[^/.]+$/, '');
      state.sheetTitle = cleanName || 'Uploaded Coloring Photo';
      dom.argonPromptInput.value = '';
      state.regionColors.clear();
      state.selectedRegionIds.clear();
      updateSelectedRegionsUI();

      runSegmentationAndSetupLayers(true);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function runSegmentationAndSetupLayers(resetBrushAndHistory = false) {
  if (!state.activeSourceImageData) return;

  const seg = segmentColoringPage(state.activeSourceImageData, {
    inkThreshold: state.inkThreshold,
    gapSeal: state.gapSeal,
  });
  state.segmentation = seg;

  const { width, height } = seg;
  dom.canvas.width = width;
  dom.canvas.height = height;

  state.pigmentCanvas.width = width;
  state.pigmentCanvas.height = height;

  state.inkCanvas.width = width;
  state.inkCanvas.height = height;
  state.inkCanvas.getContext('2d').putImageData(seg.inkImageData, 0, 0);

  state.emptySheetCanvas.width = width;
  state.emptySheetCanvas.height = height;
  state.emptySheetCanvas
    .getContext('2d')
    .putImageData(seg.cleanLineImageData, 0, 0);

  if (resetBrushAndHistory) {
    state.brushCanvas.width = width;
    state.brushCanvas.height = height;
    state.brushCanvas.getContext('2d').clearRect(0, 0, width, height);
    state.history = [];
    state.historyIndex = -1;
    pushHistorySnapshot();
  }

  // Update Blueprint preview image in right console
  const { annotatedDataUrl } = buildArgonVisionImages(seg);
  dom.blueprintPreviewImg.src = annotatedDataUrl;

  // Update HUD & Region Ledger
  dom.sheetTitleChip.textContent = state.sheetTitle;
  dom.regionsCountChip.textContent = `${seg.regions.length} Regions Segmented`;
  dom.ledgerTotalCount.textContent = String(seg.regions.length);

  rebuildPigmentLayerAndComposite();
  renderRegionLedger();
}

// ==========================================
// Rendering & Layer Compositing
// ==========================================
function rebuildPigmentLayerAndComposite() {
  if (!state.segmentation) return;
  const pigmentData = renderRegionPigmentBuffer(
    state.segmentation,
    state.regionColors,
    state.finishMode
  );
  state.pigmentCanvas.getContext('2d').putImageData(pigmentData, 0, 0);
  compositeMainCanvas();
  updateProgressChip();
}

function compositeMainCanvas() {
  if (!state.segmentation) return;
  const { width, height, regions, regionMap } = state.segmentation;
  const ctx = dom.canvas.getContext('2d');

  ctx.clearRect(0, 0, width, height);

  // 1. Region Pigment Buffer
  ctx.drawImage(state.pigmentCanvas, 0, 0);

  // 2. Freehand Studio Brush Buffer (underneath ink outlines!)
  ctx.drawImage(state.brushCanvas, 0, 0);

  // 3. Crisp Anti-Aliased Ink Outline Buffer on top
  ctx.drawImage(state.inkCanvas, 0, 0);

  // 4. Optional Before / After Split Comparison Curtain (left side = empty coloring photo)
  if (state.showSplitComparison) {
    const splitX = Math.round(width * state.splitRatio);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, splitX, height);
    ctx.clip();
    ctx.drawImage(state.emptySheetCanvas, 0, 0);
    ctx.restore();
  }

  // 5. Highlight Hovered or Selected Regions
  if (state.hoveredRegionId > 0 || state.selectedRegionIds.size > 0) {
    ctx.save();
    for (const selId of state.selectedRegionIds) {
      const reg = regions[selId - 1];
      if (!reg) continue;
      drawRegionBadgeMarker(ctx, reg, '#FFEDD2', '#141212', `✦ #${reg.id}`);
    }
    if (state.hoveredRegionId > 0) {
      const hReg = regions[state.hoveredRegionId - 1];
      if (hReg) {
        ctx.strokeStyle = 'rgba(48, 81, 168, 0.85)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(hReg.cx, hReg.cy, Math.min(22, Math.max(8, hReg.maxDist * 0.7)), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // 6. Optional Color-by-Number Region ID Badges Overlay
  if (state.showRegionNumbers) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const labeled = regions.filter((r) => r.isLabeled);
    for (const reg of labeled) {
      const label = String(reg.id);
      const fontSize = reg.maxDist < 10 ? 9 : 11;
      ctx.font = `700 ${fontSize}px "JetBrains Mono", monospace`;
      const tw = ctx.measureText(label).width;
      const pw = Math.max(16, tw + 8);
      const ph = fontSize + 5;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.strokeStyle = '#141212';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(reg.cx - pw / 2, reg.cy - ph / 2, pw, ph, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#141212';
      ctx.fillText(label, reg.cx, reg.cy + 0.5);
    }
    ctx.restore();
  }
}

function drawRegionBadgeMarker(ctx, reg, bgHex, fgHex, text) {
  ctx.font = '700 11px "JetBrains Mono", monospace';
  const tw = ctx.measureText(text).width;
  const pw = tw + 10;
  const ph = 18;
  ctx.fillStyle = bgHex;
  ctx.strokeStyle = fgHex;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(reg.cx - pw / 2, reg.cy - ph / 2, pw, ph, 99);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = fgHex;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, reg.cx, reg.cy + 0.5);
}

function updateProgressChip() {
  if (!state.segmentation) return;
  const totalRegions = state.segmentation.regions.length;
  if (totalRegions === 0) {
    dom.coloredProgressChip.textContent = '0% Colored';
    return;
  }
  const coloredCount = state.regionColors.size;
  const pct = Math.min(100, Math.round((coloredCount / totalRegions) * 100));
  dom.coloredProgressChip.textContent = `${pct}% Colored (${coloredCount}/${totalRegions})`;
}

// ==========================================
// Region Ledger UI (Right Console)
// ==========================================
function renderRegionLedger() {
  if (!state.segmentation) return;
  dom.regionLedgerList.innerHTML = '';

  const displayRegions = state.segmentation.regions.slice(0, 80);
  for (const reg of displayRegions) {
    const assigned = state.regionColors.get(reg.id);
    const hex = assigned?.color || '#FFFFFF';
    const name =
      assigned?.name ||
      (reg.touchesBorder ? `Background / Edge #${reg.id}` : `Uncolored Region #${reg.id}`);

    const row = document.createElement('div');
    row.className = `ledger-row ${
      state.hoveredRegionId === reg.id ? 'highlighted' : ''
    }`;
    row.dataset.regionId = String(reg.id);

    row.innerHTML = `
      <div class="ledger-row-left">
        <span class="ledger-id-badge">#${String(reg.id).padStart(2, '0')}</span>
        <span class="ledger-region-name" title="${name}">${name}</span>
      </div>
      <div class="ledger-row-right">
        <span class="ledger-area-meta">${reg.areaPct}%</span>
        <input type="color" class="ledger-swatch-input" value="${hex}" title="Change color of Region #${reg.id}" />
      </div>
    `;

    row.addEventListener('mouseenter', () => {
      state.hoveredRegionId = reg.id;
      compositeMainCanvas();
    });
    row.addEventListener('mouseleave', () => {
      state.hoveredRegionId = 0;
      compositeMainCanvas();
    });

    const colorInput = row.querySelector('.ledger-swatch-input');
    colorInput.addEventListener('click', (e) => e.stopPropagation());
    colorInput.addEventListener('input', (e) => {
      const newHex = e.target.value.toUpperCase();
      state.regionColors.set(reg.id, {
        id: reg.id,
        name: assigned?.name || `Region #${reg.id}`,
        color: newHex,
        secondaryColor: deriveSecondaryHex(newHex),
        source: 'manual',
      });
      rebuildPigmentLayerAndComposite();
    });
    colorInput.addEventListener('change', () => {
      pushHistorySnapshot();
    });

    row.addEventListener('click', () => {
      // Fill region with active color or toggle selection if in target mode
      if (state.activeTool === 'select-ai') {
        toggleSelectRegion(reg.id);
      } else {
        state.regionColors.set(reg.id, {
          id: reg.id,
          name: assigned?.name || `Region #${reg.id}`,
          color: state.activeColor,
          secondaryColor: deriveSecondaryHex(state.activeColor),
          source: 'manual',
        });
        rebuildPigmentLayerAndComposite();
        renderRegionLedger();
        pushHistorySnapshot();
      }
    });

    dom.regionLedgerList.appendChild(row);
  }
}

// ==========================================
// Gemini 4 Argon Coloring Workflow
// ==========================================
async function startArgonColoring(onlySelected = false) {
  if (!state.segmentation || state.isColoringWithArgon) return;
  stopActiveAnimation();

  state.isColoringWithArgon = true;
  dom.argonColorBtn.disabled = true;
  dom.argonBtnLabel.textContent = 'Gemini 4 Argon Coloring...';
  dom.argonStatusBar.classList.remove('hidden');
  dom.argonProgressFill.style.width = '18%';
  dom.argonLatencyBadge.textContent = 'Running...';

  const targetIds =
    onlySelected && state.selectedRegionIds.size > 0
      ? Array.from(state.selectedRegionIds)
      : null;

  try {
    const result = await generateArgonColoringPlan({
      segmentation: state.segmentation,
      stylePresetId: state.stylePresetId,
      customPrompt: dom.argonPromptInput.value.trim(),
      targetRegionIds: targetIds,
      existingColorsMap: state.regionColors,
      apiKey: state.apiKey,
      reasoningEffort: state.reasoningEffort,
      completeMicroRegions: dom.completeMicroToggle.checked,
      onStatus: (msg) => {
        dom.argonStatusText.textContent = msg;
        dom.argonProgressFill.style.width = '45%';
      },
    });

    // Update Console Metadata & Palette
    dom.argonLatencyBadge.textContent = `${(result.latencyMs / 1000).toFixed(1)}s • ${
      result.orderedSteps.length
    } regions`;
    dom.argonSceneTitle.textContent = `${result.sceneTitle} (by ${result.model})`;
    dom.argonNotesBody.textContent = result.artisticNotes;

    if (result.reasoningText) {
      dom.argonReasoningText.textContent = result.reasoningText;
    } else {
      dom.argonReasoningText.textContent = JSON.stringify(
        {
          model: result.model,
          latencyMs: result.latencyMs,
          usage: result.usage,
          regionsColored: result.orderedSteps.length,
        },
        null,
        2
      );
    }

    if (Array.isArray(result.palette) && result.palette.length > 0) {
      const merged = Array.from(
        new Set([
          ...result.palette.map((c) => c.toUpperCase()),
          ...state.paletteSwatches,
        ])
      ).slice(0, 11);
      state.paletteSwatches = merged;
      setActiveColor(result.palette[0]);
    }

    // Animate or Instant Fill
    const stepDelay = Number(dom.animSpeedSelect.value);
    const shouldAnimate = dom.animateStepsToggle.checked && stepDelay > 0;

    if (!shouldAnimate) {
      for (const step of result.orderedSteps) {
        state.regionColors.set(step.id, step);
      }
      dom.argonProgressFill.style.width = '100%';
      dom.argonStatusText.textContent = `Completed ${result.orderedSteps.length} regions!`;
      rebuildPigmentLayerAndComposite();
      renderRegionLedger();
      pushHistorySnapshot();
      finishArgonStatusUI();
    } else {
      await animateArgonSteps(result.orderedSteps, stepDelay);
      pushHistorySnapshot();
      finishArgonStatusUI();
    }
  } catch (err) {
    console.error('Gemini 4 Argon Error:', err);
    dom.argonStatusText.textContent = `Error: ${err.message}`;
    dom.argonLatencyBadge.textContent = 'Error';
    state.isColoringWithArgon = false;
    dom.argonColorBtn.disabled = false;
    dom.argonBtnLabel.textContent = 'Start Coloring with Gemini 4 Argon';
  }
}

function animateArgonSteps(steps, delayMs) {
  return new Promise((resolve) => {
    let idx = 0;
    const total = steps.length;
    dom.livePaintCursor.classList.remove('hidden');

    const tick = () => {
      if (idx >= total) {
        dom.livePaintCursor.classList.add('hidden');
        rebuildPigmentLayerAndComposite();
        renderRegionLedger();
        resolve();
        return;
      }

      // Batch small micro-regions so animation stays snappy (~40-65 visual frames max)
      const batchSize = total > 65 && idx > 35 ? 3 : 1;
      let currentStep = null;

      for (let b = 0; b < batchSize && idx < total; b++) {
        currentStep = steps[idx++];
        state.regionColors.set(currentStep.id, currentStep);
      }

      const reg = state.segmentation.regions[currentStep.id - 1];
      if (reg) {
        const xPct = (reg.cx / state.segmentation.width) * 100;
        const yPct = (reg.cy / state.segmentation.height) * 100;
        dom.livePaintCursor.style.left = `${xPct}%`;
        dom.livePaintCursor.style.top = `${yPct}%`;
        dom.cursorSwatch.style.backgroundColor = currentStep.color;
        dom.cursorText.textContent = `#${currentStep.id} • ${currentStep.name}`;
      }

      const pct = Math.round((idx / total) * 100);
      dom.argonProgressFill.style.width = `${pct}%`;
      dom.argonStatusText.textContent = `Painting #${currentStep.id}: ${currentStep.name} (${idx}/${total})...`;

      rebuildPigmentLayerAndComposite();
      state.animationTimer = setTimeout(tick, delayMs);
    };

    tick();
  });
}

function stopActiveAnimation() {
  if (state.animationTimer) {
    clearTimeout(state.animationTimer);
    state.animationTimer = null;
  }
  dom.livePaintCursor.classList.add('hidden');
}

function finishArgonStatusUI() {
  state.isColoringWithArgon = false;
  dom.argonColorBtn.disabled = false;
  dom.argonBtnLabel.textContent = 'Re-Color with Gemini 4 Argon';
  setTimeout(() => {
    if (!state.isColoringWithArgon) {
      dom.argonStatusBar.classList.add('hidden');
    }
  }, 1800);
}

// ==========================================
// Undo / Redo History Stack
// ==========================================
function pushHistorySnapshot() {
  if (!state.segmentation) return;

  // Trim forward redo stack
  if (state.historyIndex < state.history.length - 1) {
    state.history = state.history.slice(0, state.historyIndex + 1);
  }

  const clonedColors = new Map();
  for (const [k, v] of state.regionColors.entries()) {
    clonedColors.set(k, { ...v });
  }

  const brushCtx = state.brushCanvas.getContext('2d');
  const brushData = brushCtx.getImageData(
    0,
    0,
    state.brushCanvas.width,
    state.brushCanvas.height
  );

  state.history.push({
    regionColors: clonedColors,
    brushData,
  });

  if (state.history.length > 25) {
    state.history.shift();
  }
  state.historyIndex = state.history.length - 1;
  updateHistoryButtons();
}

function restoreHistoryAt(index) {
  if (index < 0 || index >= state.history.length) return;
  stopActiveAnimation();
  state.historyIndex = index;
  const snap = state.history[index];

  state.regionColors = new Map();
  for (const [k, v] of snap.regionColors.entries()) {
    state.regionColors.set(k, { ...v });
  }

  state.brushCanvas.getContext('2d').putImageData(snap.brushData, 0, 0);
  rebuildPigmentLayerAndComposite();
  renderRegionLedger();
  updateHistoryButtons();
}

function updateHistoryButtons() {
  dom.undoBtn.disabled = state.historyIndex <= 0;
  dom.redoBtn.disabled = state.historyIndex >= state.history.length - 1;
}

// ==========================================
// Interactive Canvas Pointer Events (Bucket, Brush, Eyedropper, Eraser, Target)
// ==========================================
let isPointerDown = false;
let activeStrokeRegionId = 0;
let lastBrushPt = null;
let isDraggingSplit = false;

function getCanvasCoords(evt) {
  const rect = dom.canvas.getBoundingClientRect();
  const x = Math.max(
    0,
    Math.min(
       dom.canvas.width - 1,
      Math.round(((evt.clientX - rect.left) / rect.width) * dom.canvas.width)
    )
  );
  const y = Math.max(
    0,
    Math.min(
      dom.canvas.height - 1,
      Math.round(((evt.clientY - rect.top) / rect.height) * dom.canvas.height)
    )
  );
  return { x, y };
}

function toggleSelectRegion(regionId) {
  if (regionId <= 0) return;
  if (state.selectedRegionIds.has(regionId)) {
    state.selectedRegionIds.delete(regionId);
  } else {
    state.selectedRegionIds.add(regionId);
  }
  updateSelectedRegionsUI();
  compositeMainCanvas();
}

function updateSelectedRegionsUI() {
  const count = state.selectedRegionIds.size;
  if (count > 0) {
    dom.selectedRegionsBar.classList.remove('hidden');
    dom.selectedRegionsCount.textContent = `${count} region${
      count > 1 ? 's' : ''
    } targeted`;
  } else {
    dom.selectedRegionsBar.classList.add('hidden');
  }
}

function stampBrushSegment(x0, y0, x1, y1, eraseMode = false) {
  if (!state.segmentation) return;
  const { width, height, regionMap } = state.segmentation;
  const brushCtx = state.brushCanvas.getContext('2d');
  const brushImg = brushCtx.getImageData(0, 0, width, height);
  const data = brushImg.data;

  const rgb = hexToRgb(state.activeColor);
  const r = Math.max(2, Math.round(state.brushSize / 2));
  const rSq = r * r;

  const dist = Math.max(1, Math.hypot(x1 - x0, y1 - y0));
  const steps = Math.ceil(dist / Math.max(1, r * 0.35));

  for (let s = 0; s <= steps; s++) {
    const cx = Math.round(x0 + ((x1 - x0) * s) / steps);
    const cy = Math.round(y0 + ((y1 - y0) * s) / steps);

    const yMin = Math.max(0, cy - r);
    const yMax = Math.min(height - 1, cy + r);
    const xMin = Math.max(0, cx - r);
    const xMax = Math.min(width - 1, cx + r);

    for (let y = yMin; y <= yMax; y++) {
      const dy = y - cy;
      const row = y * width;
      for (let x = xMin; x <= xMax; x++) {
        const dx = x - cx;
        if (dx * dx + dy * dy > rSq) continue;

        const i = row + x;
        if (
          state.brushLockRegion &&
          activeStrokeRegionId > 0 &&
          regionMap[i] !== activeStrokeRegionId
        ) {
          continue;
        }

        const idx = i * 4;
        if (eraseMode) {
          data[idx + 3] = 0;
        } else {
          data[idx] = rgb.r;
          data[idx + 1] = rgb.g;
          data[idx + 2] = rgb.b;
          data[idx + 3] = 255;
        }
      }
    }
  }

  brushCtx.putImageData(brushImg, 0, 0);
  compositeMainCanvas();
}

function bindEvents() {
  // Upload triggers
  dom.uploadPhotoBtn.addEventListener('click', () => dom.fileInput.click());
  dom.consoleUploadDropzone.addEventListener('click', () => dom.fileInput.click());
  dom.fileInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) handleUploadedFile(file);
    dom.fileInput.value = '';
  });

  // Drag & Drop anywhere on stage
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
    dom.dropOverlay.classList.remove('hidden');
  });
  window.addEventListener('dragleave', (e) => {
    if (e.relatedTarget === null) {
      dom.dropOverlay.classList.add('hidden');
    }
  });
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    dom.dropOverlay.classList.add('hidden');
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
      handleUploadedFile(file);
    }
  });

  // Clipboard image paste (Ctrl+V / Cmd+V)
  window.addEventListener('paste', (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) handleUploadedFile(file);
        break;
      }
    }
  });

  // Starter coloring page selector
  dom.sampleSelect.addEventListener('change', (e) => {
    loadSamplePage(e.target.value);
  });

  // Photo -> Line Art Extractor toggle
  dom.extractLineartBtn.addEventListener('click', () => {
    if (!state.rawUploadedImageData) return;
    state.activeSourceImageData = convertPhotoToLineArt(
      state.rawUploadedImageData,
      1.4
    );
    state.regionColors.clear();
    runSegmentationAndSetupLayers(true);
  });

  // Download Empty Coloring Sheet PNG (great for testing upload or printing)
  dom.downloadEmptyBtn.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = `${state.sheetTitle
      .toLowerCase()
      .replace(/\s+/g, '-')}-empty-coloring-sheet.png`;
    link.href = state.emptySheetCanvas.toDataURL('image/png');
    link.click();
  });

  // Undo / Redo / Clear / Export
  dom.undoBtn.addEventListener('click', () =>
    restoreHistoryAt(state.historyIndex - 1)
  );
  dom.redoBtn.addEventListener('click', () =>
    restoreHistoryAt(state.historyIndex + 1)
  );
  dom.resetEmptyBtn.addEventListener('click', () => {
    stopActiveAnimation();
    state.regionColors.clear();
    state.brushCanvas
      .getContext('2d')
      .clearRect(0, 0, state.brushCanvas.width, state.brushCanvas.height);
    rebuildPigmentLayerAndComposite();
    renderRegionLedger();
    pushHistorySnapshot();
  });

  dom.exportPngBtn.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = `${state.sheetTitle
      .toLowerCase()
      .replace(/\s+/g, '-')}-gemini-argon-colored.png`;
    link.href = dom.canvas.toDataURL('image/png');
    link.click();
  });

  // Tool Rail Buttons
  for (const btn of dom.toolBtns) {
    btn.addEventListener('click', () => {
      state.activeTool = btn.dataset.tool;
      for (const b of dom.toolBtns) {
        b.classList.toggle('active', b === btn);
      }
    });
  }

  dom.brushLockCheckbox.addEventListener('change', (e) => {
    state.brushLockRegion = e.target.checked;
  });

  dom.brushSizeSlider.addEventListener('input', (e) => {
    state.brushSize = Number(e.target.value);
    dom.brushSizeVal.textContent = `${state.brushSize}px`;
  });

  // Finish Mode Pills (Watercolor, Pencil, Cel, Flat)
  for (const pill of dom.finishPills) {
    pill.addEventListener('click', () => {
      state.finishMode = pill.dataset.finish;
      for (const p of dom.finishPills) {
        p.classList.toggle('active', p === pill);
      }
      rebuildPigmentLayerAndComposite();
    });
  }

  // Active Color Picker
  dom.activeColorInput.addEventListener('input', (e) => {
    setActiveColor(e.target.value);
  });

  // Segmentation Sliders (Ink Threshold & Gap Seal)
  dom.inkThresholdSlider.addEventListener('input', (e) => {
    state.inkThreshold = Number(e.target.value);
    dom.inkThresholdVal.textContent = String(state.inkThreshold);
  });
  dom.inkThresholdSlider.addEventListener('change', () => {
    runSegmentationAndSetupLayers(false);
  });

  dom.gapSealSlider.addEventListener('input', (e) => {
    state.gapSeal = Number(e.target.value);
    dom.gapSealVal.textContent = `${state.gapSeal}px`;
  });
  dom.gapSealSlider.addEventListener('change', () => {
    runSegmentationAndSetupLayers(false);
  });

  // HUD Overlays: Region Numbers & Before/After Split
  dom.toggleNumbersBtn.addEventListener('click', () => {
    state.showRegionNumbers = !state.showRegionNumbers;
    dom.toggleNumbersBtn.classList.toggle('active', state.showRegionNumbers);
    compositeMainCanvas();
  });

  dom.toggleSplitBtn.addEventListener('click', () => {
    state.showSplitComparison = !state.showSplitComparison;
    dom.toggleSplitBtn.classList.toggle('active', state.showSplitComparison);
    dom.splitCurtainLine.classList.toggle('hidden', !state.showSplitComparison);
    compositeMainCanvas();
  });

  // Split Curtain Dragging
  dom.splitCurtainLine.addEventListener('pointerdown', (e) => {
    isDraggingSplit = true;
    e.stopPropagation();
  });
  window.addEventListener('pointermove', (e) => {
    if (!isDraggingSplit) return;
    const rect = dom.canvas.getBoundingClientRect();
    const ratio = Math.max(
      0.05,
      Math.min(0.95, (e.clientX - rect.left) / rect.width)
    );
    state.splitRatio = ratio;
    dom.splitCurtainLine.style.left = `${ratio * 100}%`;
    compositeMainCanvas();
  });
  window.addEventListener('pointerup', () => {
    isDraggingSplit = false;
  });

  // Zoom Controls
  const applyZoom = (newZoom) => {
    state.zoom = Math.max(0.6, Math.min(2.4, newZoom));
    dom.paperFrame.style.transform = `scale(${state.zoom})`;
    dom.zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
  };
  dom.zoomInBtn.addEventListener('click', () => applyZoom(state.zoom + 0.15));
  dom.zoomOutBtn.addEventListener('click', () => applyZoom(state.zoom - 0.15));
  dom.zoomFitBtn.addEventListener('click', () => applyZoom(1.0));

  // Canvas Pointer Down / Move / Up
  dom.canvas.addEventListener('pointerdown', (e) => {
    if (!state.segmentation) return;
    const { x, y } = getCanvasCoords(e);
    const rid = state.segmentation.regionMap[y * state.segmentation.width + x];

    if (e.shiftKey || state.activeTool === 'select-ai') {
      toggleSelectRegion(rid);
      return;
    }

    if (state.activeTool === 'bucket') {
      if (rid > 0) {
        const existing = state.regionColors.get(rid);
        state.regionColors.set(rid, {
          id: rid,
          name: existing?.name || `Region #${rid}`,
          color: state.activeColor,
          secondaryColor: deriveSecondaryHex(state.activeColor),
          source: 'manual',
        });
        rebuildPigmentLayerAndComposite();
        renderRegionLedger();
        pushHistorySnapshot();
      }
    } else if (state.activeTool === 'eyedropper') {
      const ctx = dom.canvas.getContext('2d');
      const px = ctx.getImageData(x, y, 1, 1).data;
      setActiveColor(rgbToHex(px[0], px[1], px[2]));
      // Switch back to bucket for convenience
      state.activeTool = 'bucket';
      for (const b of dom.toolBtns) {
        b.classList.toggle('active', b.dataset.tool === 'bucket');
      }
    } else if (state.activeTool === 'eraser') {
      // If user clicks a region with no brush strokes, clear region color too
      if (rid > 0 && state.regionColors.has(rid)) {
        state.regionColors.delete(rid);
        rebuildPigmentLayerAndComposite();
        renderRegionLedger();
      }
      isPointerDown = true;
      activeStrokeRegionId = rid;
      lastBrushPt = { x, y };
      stampBrushSegment(x, y, x, y, true);
    } else if (state.activeTool === 'brush') {
      isPointerDown = true;
      activeStrokeRegionId = rid;
      lastBrushPt = { x, y };
      stampBrushSegment(x, y, x, y, false);
    }
  });

  dom.canvas.addEventListener('pointermove', (e) => {
    if (!state.segmentation) return;
    const { x, y } = getCanvasCoords(e);
    const rid = state.segmentation.regionMap[y * state.segmentation.width + x];

    // Update hover tooltip pill
    if (rid > 0) {
      dom.regionHoverPill.classList.remove('hidden');
      dom.hoverRegionId.textContent = `#${String(rid).padStart(2, '0')}`;
      const assigned = state.regionColors.get(rid);
      dom.hoverRegionName.textContent = assigned
        ? `${assigned.name} (${assigned.color})`
        : 'Uncolored Region — Click to fill';
    } else {
      dom.regionHoverPill.classList.add('hidden');
    }

    if (!isPointerDown || !lastBrushPt) return;
    if (state.activeTool === 'brush') {
      stampBrushSegment(lastBrushPt.x, lastBrushPt.y, x, y, false);
      lastBrushPt = { x, y };
    } else if (state.activeTool === 'eraser') {
      stampBrushSegment(lastBrushPt.x, lastBrushPt.y, x, y, true);
      lastBrushPt = { x, y };
    }
  });

  window.addEventListener('pointerup', () => {
    if (isPointerDown) {
      isPointerDown = false;
      lastBrushPt = null;
      pushHistorySnapshot();
    }
  });

  dom.canvas.addEventListener('pointerleave', () => {
    dom.regionHoverPill.classList.add('hidden');
  });

  // Gemini 4 Argon Console Buttons
  dom.argonColorBtn.addEventListener('click', () => startArgonColoring(false));
  dom.colorSelectedOnlyBtn.addEventListener('click', () =>
    startArgonColoring(true)
  );
  dom.clearSelectedBtn.addEventListener('click', () => {
    state.selectedRegionIds.clear();
    updateSelectedRegionsUI();
    compositeMainCanvas();
  });
  dom.clearPromptBtn.addEventListener('click', () => {
    dom.argonPromptInput.value = '';
  });

  // API Settings Modal
  dom.apiSettingsBtn.addEventListener('click', () => {
    dom.apiKeyInput.value = state.apiKey;
    dom.reasoningEffortSelect.value = state.reasoningEffort;
    dom.apiModal.classList.remove('hidden');
  });
  dom.closeApiModalBtn.addEventListener('click', () => {
    dom.apiModal.classList.add('hidden');
  });
  dom.saveApiModalBtn.addEventListener('click', () => {
    const newKey = dom.apiKeyInput.value.trim();
    if (newKey) {
      state.apiKey = newKey;
      localStorage.setItem('argon_atelier_openrouter_key', newKey);
    }
    state.reasoningEffort = dom.reasoningEffortSelect.value;
    dom.apiModal.classList.add('hidden');
  });

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (
      document.activeElement &&
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)
    ) {
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) restoreHistoryAt(state.historyIndex + 1);
      else restoreHistoryAt(state.historyIndex - 1);
      return;
    }
    const key = e.key.toLowerCase();
    if (key === 'b') dom.toolBtns.find((b) => b.dataset.tool === 'bucket')?.click();
    else if (key === 'p') dom.toolBtns.find((b) => b.dataset.tool === 'brush')?.click();
    else if (key === 'i') dom.toolBtns.find((b) => b.dataset.tool === 'eyedropper')?.click();
    else if (key === 'e') dom.toolBtns.find((b) => b.dataset.tool === 'eraser')?.click();
    else if (key === 'n') dom.toggleNumbersBtn.click();
    else if (key === 'c') dom.toggleSplitBtn.click();
  });
}

initStudio();
