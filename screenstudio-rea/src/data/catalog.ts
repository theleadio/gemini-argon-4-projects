import {
  AudioUnitNodeConfig,
  BuiltInTrack,
  SSStudioPreset,
  SSStudioProject,
  WallpaperAsset,
} from '../types/project';
import { SPRING_PRESETS } from '../engine/springPhysics';

/**
 * Reconstructed from `assets/backgrounds/*` and `dist/ChmuunRT2.js` gradient palette stops.
 */
export const WALLPAPER_CATALOG: WallpaperAsset[] = [
  {
    id: 'iridescent-1',
    name: 'Iridescent Prism',
    category: 'Iridescent',
    stops: ['#12c2e9', '#c471ed', '#f64f59'],
    angle: 135,
    meshAccent: '#a8edea',
  },
  {
    id: 'iridescent-2',
    name: 'Iridescent Pearl',
    category: 'Iridescent',
    stops: ['#a1c4fd', '#c2e9fb', '#e0c3fc'],
    angle: 145,
    meshAccent: '#fcc5e4',
  },
  {
    id: 'midnight-1',
    name: 'Midnight Obsidian',
    category: 'Midnight',
    stops: ['#0f2027', '#203a43', '#2c5364'],
    angle: 140,
    meshAccent: '#1fa2ff',
  },
  {
    id: 'midnight-2',
    name: 'Midnight Nebula',
    category: 'Midnight',
    stops: ['#03001e', '#7303c0', '#ec38bc'],
    angle: 130,
    meshAccent: '#fdeff9',
  },
  {
    id: 'energy-1',
    name: 'Energy Hyperion',
    category: 'Energy',
    stops: ['#fc466b', '#3f5efb', '#00f2fe'],
    angle: 125,
    meshAccent: '#f9d423',
  },
  {
    id: 'energy-2',
    name: 'Energy Solar',
    category: 'Energy',
    stops: ['#f83600', '#fe8c00', '#f9d423'],
    angle: 135,
    meshAccent: '#ff7882',
  },
  {
    id: 'glassmorphism-1',
    name: 'Glass Frost Indigo',
    category: 'Glassmorphism',
    stops: ['#1d2671', '#c33764', '#4776e6'],
    angle: 140,
    meshAccent: '#8e54e9',
  },
  {
    id: 'radiant-1',
    name: 'Radiant Aurora',
    category: 'Radiant',
    stops: ['#11998e', '#38ef7d', '#00dbde'],
    angle: 150,
    meshAccent: '#a6ffcb',
  },
  {
    id: 'sunset-1',
    name: 'Sunset Velvet',
    category: 'Sunset',
    stops: ['#3a1c71', '#d76d77', '#ffaf7b'],
    angle: 135,
    meshAccent: '#fda085',
  },
  {
    id: 'raycast-1',
    name: 'Raycast Crimson',
    category: 'Raycast',
    stops: ['#16060b', '#c31432', '#240b36'],
    angle: 145,
    meshAccent: '#ff453a',
  },
  {
    id: 'spring-1',
    name: 'Spring Botanical',
    category: 'Spring',
    stops: ['#134e5e', '#71b280', '#96e6a1'],
    angle: 130,
    meshAccent: '#d4fc79',
  },
];

/**
 * Exact 17 built-in background audio tracks reconstructed from `assets/background-audio/index.ts`.
 */
export const BUILT_IN_BACKGROUND_AUDIO: BuiltInTrack[] = [
  // Commercial
  {
    id: 'commercial/Smile Piano',
    title: 'Smile Piano',
    category: 'commercial',
    bpm: 108,
    mood: 'Rhythmic piano, muted guitar, hush shaker, warm sub',
  },
  {
    id: 'commercial/Focus Mallets',
    title: 'Focus Mallets',
    category: 'commercial',
    bpm: 108,
    mood: 'Slide-deck mallets, positive professional non-distracting',
  },
  {
    id: 'commercial/Marimba Bed',
    title: 'Marimba Bed',
    category: 'commercial',
    bpm: 118,
    mood: 'Marimba ostinato, piano ticks, clean subdrops every 4 bars',
  },
  {
    id: 'commercial/Product Uplift',
    title: 'Product Uplift',
    category: 'commercial',
    bpm: 120,
    mood: 'Rhythmic piano ticks, soft impacts, airy risers, motivating',
  },
  // Electronic
  {
    id: 'electronic/Breezy House',
    title: 'Breezy House',
    category: 'electronic',
    bpm: 122,
    mood: 'Pop piano plucks, soft 4-on-the-floor, warm sub, seamless',
  },
  {
    id: 'electronic/Ambient Electronica',
    title: 'Ambient Electronica',
    category: 'electronic',
    bpm: 88,
    mood: 'Glassy pluck synths, soft felt piano accents, airy pad bed',
  },
  {
    id: 'electronic/Electro Pop',
    title: 'Electro Pop',
    category: 'electronic',
    bpm: 115,
    mood: 'Percussive synth ostinato, tight kick, precise bass',
  },
  {
    id: 'electronic/Pastel Synthwave',
    title: 'Pastel Synthwave',
    category: 'electronic',
    bpm: 108,
    mood: 'Airy polys, subdued 80s kick, glossy arps, tape chorus',
  },
  // Instrumental
  {
    id: 'instrumental/Noble Documentary',
    title: 'Noble Documentary',
    category: 'instrumental',
    bpm: 106,
    mood: 'Cinematic piano & strings texture, delicate swells',
  },
  {
    id: 'instrumental/Corporate Smile',
    title: 'Corporate Smile',
    category: 'instrumental',
    bpm: 112,
    mood: 'Piano arps, muted strings, palm-mute guitar, gentle kick',
  },
  {
    id: 'instrumental/Friendly Folk',
    title: 'Friendly Folk',
    category: 'instrumental',
    bpm: 98,
    mood: 'Fingerpicked acoustic guitar, brushed snare, mandolin shimmer',
  },
  {
    id: 'instrumental/Piano Smile',
    title: 'Piano Smile',
    category: 'instrumental',
    bpm: 110,
    mood: 'Rhythmic grand piano motif, glockenspiel highlights',
  },
  // Lo-Fi
  {
    id: 'lo-fi/Sunny Lo-Fi',
    title: 'Sunny Lo‑Fi',
    category: 'lo-fi',
    bpm: 90,
    mood: 'Soft Rhodes chords, gentle swing kit, vinyl texture',
  },
  {
    id: 'lo-fi/Lean Groove',
    title: 'Lean Groove',
    category: 'lo-fi',
    bpm: 98,
    mood: 'Rhodes + bass unison, hats on offbeats, micro-chorus',
  },
  {
    id: 'lo-fi/Bright Lounge',
    title: 'Bright Lounge',
    category: 'lo-fi',
    bpm: 80,
    mood: 'Muted e-guitar chords, soft synth lead, cozy pad',
  },
  {
    id: 'lo-fi/Cozy Chillhop',
    title: 'Cozy Chillhop',
    category: 'lo-fi',
    bpm: 78,
    mood: 'Jazzy Rhodes, muted trumpet chops, soft analog bass',
  },
  {
    id: 'lo-fi/Uplifting Sunset',
    title: 'Uplifting Sunset',
    category: 'lo-fi',
    bpm: 88,
    mood: 'Rhodes & vibraphone lead over lush major chords',
  },
];

/**
 * Exact Apple AudioUnit (`aufx`) nodes reconstructed from `dist/BEy_VAkj.js` and `dist-electron/index.js`.
 */
export const DEFAULT_AUDIO_UNITS: AudioUnitNodeConfig[] = [
  {
    id: 'aufx/vois/appl',
    name: 'Apple Voice Isolation',
    description: 'CoreAudio neural voice isolation filter',
    enabled: true,
    amount: 0.85,
  },
  {
    id: 'aufx/hpas/appl',
    name: 'High-Pass Filter (80 Hz)',
    description: 'Removes low-end rumble and desk vibrations',
    enabled: true,
    amount: 0.65,
  },
  {
    id: 'aufx/filt/appl',
    name: '3-Band Parametric EQ',
    description: 'Presence boost at 3.2 kHz + mud cut at 240 Hz',
    enabled: true,
    amount: 0.7,
  },
  {
    id: 'aufx/dcmp/appl',
    name: 'Dynamics Processor',
    description: 'Smooth vocal compression (-18 dB threshold, 3:1 ratio)',
    enabled: true,
    amount: 0.75,
  },
  {
    id: 'aufx/mcmp/appl',
    name: 'Multiband Compressor',
    description: 'Tames harsh sibilance and balances low-mid warmth',
    enabled: false,
    amount: 0.5,
  },
  {
    id: 'aufx/hshf/appl',
    name: 'High-Shelf Air Exciter',
    description: 'Adds crisp studio air above 10 kHz',
    enabled: true,
    amount: 0.45,
  },
  {
    id: 'aufx/lpas/appl',
    name: 'Low-Pass Anti-Hiss',
    description: 'Rolls off ultrasonic harshness above 18 kHz',
    enabled: false,
    amount: 0.4,
  },
  {
    id: 'aufx/lmtr/appl',
    name: 'True-Peak Brickwall Limiter',
    description: 'Normalizes output to -1.0 dBTP without clipping',
    enabled: true,
    amount: 0.9,
  },
];

/**
 * SoundAnalysis vocal event classes reconstructed from `dist/BEy_VAkj.js` (`classifySound`).
 */
export const SOUND_CLASSIFICATION_LABELS = [
  'speech',
  'breathing',
  'sigh',
  'cough',
  'laughter',
  'chuckle_chortle',
  'gasp',
  'whispering',
  'sneeze',
  'babble',
  'humming',
  'singing',
  'shout',
  'yell',
  'screaming',
  'crying_sobbing',
  'rapping',
] as const;

export const BUILT_IN_PRESETS: SSStudioPreset[] = [
  {
    id: 'preset-linear-launch',
    name: 'Midnight Product Launch',
    description: 'Deep Obsidian canvas, 16:9 Wide, Quick spring zoom, macOS window chrome',
    stageConfig: {
      aspectRatio: '16:9',
      wallpaperId: 'midnight-1',
      paddingRatio: 0.11,
      cornerRadiusPx: 16,
      shadowIntensity: 0.85,
      deviceFrame: 'macos-window',
      useAdaptiveBorderGlow: true,
    },
    cursorConfig: {
      springPreset: 'quick',
      sizeScale: 1.45,
      motionBlurZoom: 0.65,
      motionBlurCursor: 0.45,
      clickRipple: true,
    },
  },
  {
    id: 'preset-iridescent-demo',
    name: 'Iridescent Keynote',
    description: 'Prism wallpaper, MacBook Pro 16" frame, Default spring physics',
    stageConfig: {
      aspectRatio: '16:9',
      wallpaperId: 'iridescent-1',
      paddingRatio: 0.14,
      cornerRadiusPx: 18,
      shadowIntensity: 0.9,
      deviceFrame: 'macbook-pro-16',
      useAdaptiveBorderGlow: true,
    },
    cursorConfig: {
      springPreset: 'default',
      sizeScale: 1.6,
      motionBlurZoom: 0.55,
      motionBlurCursor: 0.35,
      clickRipple: true,
    },
  },
  {
    id: 'preset-social-vertical',
    name: 'Vertical Social Story (9:16)',
    description: 'Portrait 9:16 layout, tight padding, Rapid spring zoom for TikTok/Reels/Shorts',
    stageConfig: {
      aspectRatio: '9:16',
      wallpaperId: 'energy-1',
      paddingRatio: 0.08,
      cornerRadiusPx: 20,
      shadowIntensity: 0.8,
      deviceFrame: 'iphone-16-pro',
      useAdaptiveBorderGlow: true,
    },
    cursorConfig: {
      springPreset: 'rapid',
      sizeScale: 1.8,
      motionBlurZoom: 0.75,
      motionBlurCursor: 0.5,
      clickRipple: true,
    },
  },
];

export function generateDefaultWaveform(
  durationMs: number,
  captions: { startMs: number; endMs: number; type: string }[],
  bins = 128
): number[] {
  const out: number[] = [];
  for (let i = 0; i < bins; i++) {
    const tMs = ((i + 0.5) / bins) * durationMs;
    const activeCap = captions.find(
      (c) => tMs >= c.startMs && tMs <= c.endMs && c.type === 'speech'
    );
    const activeBreath = captions.find(
      (c) => tMs >= c.startMs && tMs <= c.endMs && c.type === 'sound-label'
    );
    if (activeCap) {
      const Syllabic =
        0.35 +
        0.55 *
          Math.abs(
            Math.sin(tMs * 0.019) * Math.cos(tMs * 0.0073 + i * 0.7)
          );
      out.push(Number(Math.min(0.98, Syllabic).toFixed(3)));
    } else if (activeBreath) {
      out.push(0.14);
    } else {
      out.push(0.03);
    }
  }
  return out;
}

export function createDefaultProject(): SSStudioProject {
  const defaultCaptions: SSStudioProject['captions'] = [
    {
      id: 'cap-1',
      startMs: 300,
      endMs: 3600,
      text: 'Screen Studio spawns an invisible 100×100 host window and renders UI via React Portals.',
      confidence: 0.98,
      generator: 'whisper',
      type: 'speech',
    },
    {
      id: 'cap-2',
      startMs: 3800,
      endMs: 6100,
      text: 'polyrecorder-prod captures displays, windows, and iOS devices over ScreenCaptureKit.',
      confidence: 0.96,
      generator: 'whisper',
      type: 'speech',
    },
    {
      id: 'cap-3',
      startMs: 6300,
      endMs: 9900,
      text: 'Cursor trajectories and camera zooms are smoothed by a damped harmonic spring solver.',
      confidence: 0.99,
      generator: 'whisper',
      type: 'speech',
    },
    {
      id: 'cap-4',
      startMs: 10050,
      endMs: 11350,
      text: '[breathing]',
      confidence: 0.91,
      generator: 'system',
      type: 'sound-label',
    },
    {
      id: 'cap-5',
      startMs: 11500,
      endMs: 15600,
      text: 'native-audio.node runs CoreML MossFormer2 and Apple MLX TF-Restormer before WebCodecs export.',
      confidence: 0.97,
      generator: 'whisper',
      type: 'speech',
    },
  ];

  return {
    id: 'proj_ssstudio_404_rea',
    title: 'REA Reverse Engineering Walkthrough.screenstudio',
    version: '4.0.4-4926',
    isDemoProject: true,
    durationMs: 16000,
    speakerNotes:
      '1. Introduce Screen Studio 4.0 invisible 100×100 host window & React Portal architecture.\n2. Show polyrecorder-prod capturing at 120Hz ProMotion with raw cursor & click telemetry.\n3. Demonstrate Damped Harmonic Spring (stiffness 125, damping 12, mass 1.5) & Glass Loupe.\n4. Toggle CoreML MossFormer2 48kHz + Apple MLX TF-Restormer + aufx DSP rack.',
    audioWaveform: generateDefaultWaveform(16000, defaultCaptions, 128),
    recordingSource: {
      type: 'window',
      name: 'Screen Studio 4.0 — Architecture & Pipeline Demo',
      appBundleId: 'com.timpler.screenstudio',
      initialDisplayRefreshRate: 120,
      recordingScale: 2,
      videoBorderColors: ['#3b82f6', '#8b5cf6', '#ec4899'],
    },
    stageConfig: {
      aspectRatio: '16:9',
      wallpaperId: 'iridescent-1',
      customBgColor: '#0f172a',
      useAdaptiveBorderGlow: true,
      paddingRatio: 0.11,
      insetPx: 4,
      cornerRadiusPx: 16,
      shadowIntensity: 0.82,
      deviceFrame: 'macos-window',
    },
    cursorConfig: {
      sizeScale: 1.55,
      hideWhenIdle: true,
      loopCursorPosition: true,
      springPreset: 'default',
      customSpring: { ...SPRING_PRESETS.default },
      clickSoundEffect: 'apple-magic-mouse',
      clickRipple: true,
      motionBlurCursor: 0.6,
      motionBlurZoom: 0.6,
      highlightCursor: true,
    },
    cameraConfig: {
      enabled: true,
      defaultLayout: 'corner-br',
      sizeRatio: 0.24,
      roundness: 0.28,
      mirror: true,
      shadow: 0.75,
      aiMattingModel: 'pp-mattingv2-fp16',
      mattingBackdrop: 'studio-gradient',
      autoFaceCenter: true,
    },
    audioConfig: {
      micVolume: 1.0,
      systemAudioVolume: 0.8,
      mossFormer2NoiseReduction: true,
      tfRestormerSpeechRestore: true,
      restoreSibilance: 0.65,
      soundClassifierEnabled: true,
      audioUnits: DEFAULT_AUDIO_UNITS,
      backgroundTrackId: 'lo-fi/Sunny Lo-Fi',
      backgroundTrackVolume: 0.22,
      autoDuckBackground: true,
    },
    captionsConfig: {
      enabled: true,
      generator: 'whisper',
      language: 'en',
      fontSizeScale: 1.0,
      positionY: 0.86,
      style: 'karaoke-highlight',
      voiceoverEnabled: false,
    },
    exportConfig: {
      format: 'mp4',
      mp4Codec: 'h264',
      resolution: '4k',
      fps: 60,
      quality: 'studio',
      variableFramerate: false,
    },
    slices: [
      {
        id: 'slice-1',
        startMs: 0,
        endMs: 6200,
        speed: 1.0,
        typingSpeedUp: false,
        label: '1 · Inspect Bundle & ASAR',
      },
      {
        id: 'slice-2',
        startMs: 6200,
        endMs: 11400,
        speed: 1.5,
        typingSpeedUp: true,
        label: '2 · Polyrecorder & Spring Physics (1.5×)',
      },
      {
        id: 'slice-3',
        startMs: 11400,
        endMs: 16000,
        speed: 1.0,
        typingSpeedUp: false,
        label: '3 · MLX Audio & WebCodecs Export',
      },
    ],
    zooms: [
      {
        id: 'zoom-1',
        startMs: 1200,
        endMs: 4600,
        scale: 1.85,
        mode: 'auto-cursor',
        targetX: 0.28,
        targetY: 0.34,
        glassLoupe: false,
        springPreset: 'default',
      },
      {
        id: 'zoom-2',
        startMs: 6400,
        endMs: 10200,
        scale: 2.15,
        mode: 'manual',
        targetX: 0.68,
        targetY: 0.42,
        glassLoupe: true,
        springPreset: 'quick',
      },
      {
        id: 'zoom-3',
        startMs: 12200,
        endMs: 15100,
        scale: 1.75,
        mode: 'auto-cursor',
        targetX: 0.52,
        targetY: 0.72,
        glassLoupe: false,
        springPreset: 'mellow',
      },
    ],
    cameraLayouts: [
      {
        id: 'cam-1',
        startMs: 0,
        endMs: 5800,
        layout: 'corner-br',
        label: 'Corner Bottom-Right',
      },
      {
        id: 'cam-2',
        startMs: 5800,
        endMs: 10600,
        layout: 'corner-bl',
        label: 'Corner Bottom-Left',
      },
      {
        id: 'cam-3',
        startMs: 10600,
        endMs: 16000,
        layout: 'split-screen',
        label: 'Split Screen Side-by-Side',
      },
    ],
    masks: [
      {
        id: 'mask-1',
        startMs: 2000,
        endMs: 9500,
        x: 0.62,
        y: 0.14,
        width: 0.28,
        height: 0.08,
        style: 'blur',
        intensity: 14,
        label: 'API Key / Token Redaction',
        trackShift: true,
      },
    ],
    captions: defaultCaptions,
    cursorEvents: [
      { timeMs: 0, x: 0.18, y: 0.24, type: 'move', cursorShape: 'arrow' },
      { timeMs: 800, x: 0.26, y: 0.32, type: 'move', cursorShape: 'pointer' },
      { timeMs: 1350, x: 0.28, y: 0.34, type: 'click', cursorShape: 'pointer', targetElement: 'open_binary' },
      { timeMs: 2400, x: 0.34, y: 0.48, type: 'move', cursorShape: 'ibeam' },
      { timeMs: 2900, x: 0.34, y: 0.48, type: 'keystroke', cursorShape: 'ibeam', keystroke: '⌘ + Shift + R' },
      { timeMs: 4200, x: 0.48, y: 0.36, type: 'move', cursorShape: 'arrow' },
      { timeMs: 5600, x: 0.66, y: 0.41, type: 'move', cursorShape: 'pointer' },
      { timeMs: 6550, x: 0.68, y: 0.42, type: 'click', cursorShape: 'pointer', targetElement: 'SpringSolver' },
      { timeMs: 7400, x: 0.72, y: 0.52, type: 'keystroke', cursorShape: 'ibeam', keystroke: 'stiffness: 125' },
      { timeMs: 8900, x: 0.64, y: 0.38, type: 'click', cursorShape: 'pointer', targetElement: 'GlassLoupe' },
      { timeMs: 10800, x: 0.44, y: 0.68, type: 'move', cursorShape: 'arrow' },
      { timeMs: 12400, x: 0.52, y: 0.72, type: 'click', cursorShape: 'pointer', targetElement: 'MossFormer2' },
      { timeMs: 13600, x: 0.58, y: 0.74, type: 'keystroke', cursorShape: 'pointer', keystroke: '⌘ + E (Export 4K)' },
      { timeMs: 14900, x: 0.78, y: 0.22, type: 'click', cursorShape: 'pointer', targetElement: 'ExportButton' },
      { timeMs: 15800, x: 0.18, y: 0.24, type: 'move', cursorShape: 'arrow' },
    ],
  };
}
