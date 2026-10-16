export type AspectRatioId = '16:9' | '9:16' | '1:1' | '4:3' | '3:4';

export type WallpaperCategory =
  | 'Iridescent'
  | 'Midnight'
  | 'Energy'
  | 'Glassmorphism'
  | 'Radiant'
  | 'Sunset'
  | 'Raycast'
  | 'Spring';

export interface WallpaperAsset {
  id: string;
  name: string;
  category: WallpaperCategory;
  stops: [string, string, string];
  angle: number;
  meshAccent: string;
}

export type DeviceFrameType =
  | 'macos-window'
  | 'macbook-pro-16'
  | 'iphone-16-pro'
  | 'ipad-pro-m4'
  | 'none';

export type SpringPresetName = 'rapid' | 'quick' | 'default' | 'mellow' | 'slow';

export interface SpringParams {
  stiffness: number;
  damping: number;
  mass: number;
  clamp: boolean;
  precision: number;
}

export type ClickSoundSetName = 'none' | 'apple-magic-mouse' | 'logitech-mx-master';

export type BackgroundAudioCategory = 'commercial' | 'electronic' | 'instrumental' | 'lo-fi';

export interface BuiltInTrack {
  id: string;
  title: string;
  category: BackgroundAudioCategory;
  bpm: number;
  mood: string;
}

export type AudioUnitId =
  | 'aufx/hpas/appl'
  | 'aufx/lpas/appl'
  | 'aufx/hshf/appl'
  | 'aufx/filt/appl'
  | 'aufx/dcmp/appl'
  | 'aufx/mcmp/appl'
  | 'aufx/lmtr/appl'
  | 'aufx/vois/appl';

export interface AudioUnitNodeConfig {
  id: AudioUnitId;
  name: string;
  description: string;
  enabled: boolean;
  amount: number;
}

export interface SliceBlock {
  id: string;
  startMs: number;
  endMs: number;
  speed: number;
  typingSpeedUp: boolean;
  label: string;
}

export interface ZoomBlock {
  id: string;
  startMs: number;
  endMs: number;
  scale: number;
  mode: 'auto-cursor' | 'manual';
  targetX: number; // normalized 0..1
  targetY: number; // normalized 0..1
  glassLoupe: boolean;
  springPreset: SpringPresetName;
}

export type CameraLayoutMode =
  | 'corner-br'
  | 'corner-bl'
  | 'corner-tr'
  | 'split-screen'
  | 'fullscreen'
  | 'hidden';

export interface CameraLayoutBlock {
  id: string;
  startMs: number;
  endMs: number;
  layout: CameraLayoutMode;
  label: string;
}

export interface MaskBlock {
  id: string;
  startMs: number;
  endMs: number;
  x: number; // normalized 0..1 on screen surface
  y: number;
  width: number;
  height: number;
  style: 'blur' | 'pixelate' | 'solid';
  intensity: number;
  label: string;
  trackShift: boolean;
}

export type CaptionGeneratorType = 'whisper' | 'system' | 'elevenlabs';

export interface CaptionSegment {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  confidence: number;
  generator: CaptionGeneratorType;
  type: 'speech' | 'sound-label';
}

export interface CursorTelemetryEvent {
  timeMs: number;
  x: number; // normalized 0..1
  y: number; // normalized 0..1
  type: 'move' | 'mousedown' | 'mouseup' | 'click' | 'keystroke';
  cursorShape: 'arrow' | 'pointer' | 'ibeam';
  targetElement?: string;
  keystroke?: string;
}

export interface ProjectStageConfig {
  aspectRatio: AspectRatioId;
  wallpaperId: string;
  customBgColor: string;
  useAdaptiveBorderGlow: boolean;
  paddingRatio: number; // 0.02 .. 0.28
  insetPx: number;
  cornerRadiusPx: number;
  shadowIntensity: number; // 0 .. 1
  deviceFrame: DeviceFrameType;
}

export interface ProjectCursorConfig {
  sizeScale: number; // 0.8 .. 3.0
  hideWhenIdle: boolean;
  loopCursorPosition: boolean;
  springPreset: SpringPresetName;
  customSpring: SpringParams;
  clickSoundEffect: ClickSoundSetName;
  clickRipple: boolean;
  motionBlurCursor: number; // 0 .. 1
  motionBlurZoom: number; // 0 .. 1
  highlightCursor: boolean;
}

export interface ProjectCameraConfig {
  enabled: boolean;
  defaultLayout: CameraLayoutMode;
  sizeRatio: number; // 0.15 .. 0.45
  roundness: number; // 0 .. 1 (1 = circle/squircle)
  mirror: boolean;
  shadow: number;
  aiMattingModel: 'none' | 'pp-mattingv2-fp16' | 'ssmatte-v1-s1c';
  mattingBackdrop: 'blur' | 'transparent' | 'studio-gradient';
  autoFaceCenter: boolean;
}

export interface ProjectAudioConfig {
  micVolume: number;
  systemAudioVolume: number;
  mossFormer2NoiseReduction: boolean;
  tfRestormerSpeechRestore: boolean;
  restoreSibilance: number;
  soundClassifierEnabled: boolean;
  audioUnits: AudioUnitNodeConfig[];
  backgroundTrackId: string | null;
  backgroundTrackVolume: number;
  autoDuckBackground: boolean;
}

export interface ProjectCaptionsConfig {
  enabled: boolean;
  generator: CaptionGeneratorType;
  language: string;
  fontSizeScale: number;
  positionY: number; // 0.7 .. 0.94
  style: 'glass-pill' | 'karaoke-highlight' | 'editorial-serif';
  voiceoverEnabled?: boolean;
  voiceURI?: string;
}

export interface ExportConfig {
  format: 'mp4' | 'gif' | 'webm';
  mp4Codec: 'h264' | 'hevc';
  resolution: '4k' | '1080p' | '720p';
  fps: 30 | 60 | 120;
  quality: 'studio' | 'web' | 'compact';
  variableFramerate: boolean;
}

export interface SSStudioProject {
  id: string;
  title: string;
  version: string;
  isDemoProject?: boolean;
  durationMs: number;
  speakerNotes?: string;
  audioWaveform?: number[];
  recordingSource: {
    type: 'display' | 'window' | 'externalDevice';
    name: string;
    appBundleId: string;
    initialDisplayRefreshRate: number;
    recordingScale: number;
    videoBorderColors: [string, string, string];
  };
  stageConfig: ProjectStageConfig;
  cursorConfig: ProjectCursorConfig;
  cameraConfig: ProjectCameraConfig;
  audioConfig: ProjectAudioConfig;
  captionsConfig: ProjectCaptionsConfig;
  exportConfig: ExportConfig;
  slices: SliceBlock[];
  zooms: ZoomBlock[];
  cameraLayouts: CameraLayoutBlock[];
  masks: MaskBlock[];
  captions: CaptionSegment[];
  cursorEvents: CursorTelemetryEvent[];
}

export interface SSStudioPreset {
  id: string;
  name: string;
  description: string;
  stageConfig: Partial<ProjectStageConfig>;
  cursorConfig: Partial<ProjectCursorConfig>;
  cameraConfig?: Partial<ProjectCameraConfig>;
}
