import { ClickSoundSetName } from '../types/project';

export interface TrpcCallLogEntry {
  id: string;
  timestamp: number;
  router: string;
  procedure: string;
  kind: 'query' | 'mutation' | 'subscription';
  transport: 'electron-ipc' | 'in-memory-router';
  durationMs: number;
  inputSummary: string;
  outputSummary: string;
}

export interface CapturableWindowInfo {
  id: number;
  sourceId?: string;
  kind?: 'display' | 'window';
  name: string;
  bundleId: string;
  bounds: { x: number; y: number; width: number; height: number };
  isOnScreen: boolean;
  thumbnailDataUrl?: string;
}

declare global {
  interface Window {
    $$typelectron?: {
      invoke: (channel: string, payload: unknown) => Promise<unknown>;
      send: (channel: string, payload: unknown) => void;
      on: (channel: string, listener: (...args: unknown[]) => void) => () => void;
    };
    electronEnv?: {
      getFilePath: (file: File) => string;
      readonly WORKER_EXPORT_MODE: string | null;
      readonly APP_VERSION: string;
      readonly IS_RENDER_WORKER: boolean;
      readonly IS_STAGE_BENCH: boolean;
      readonly START_HIDDEN: boolean;
      readonly IS_DEV: boolean;
      readonly IS_BETA: boolean;
      sendProtocolPort: (a: unknown, b: unknown) => void;
    };
  }
}

/**
 * Complete catalog of the 48 main-process tRPC sub-routers recovered by REA from `dist-electron/index.js` (`LLe`).
 */
export const RECOVERED_TRPC_ROUTERS: Record<
  string,
  { varName: string; procedures: string[]; description: string }
> = {
  'capture.': {
    varName: 'rPe',
    procedures: [
      'mutation:preRecordingCheck',
      'mutation:start',
      'mutation:cancel',
      'mutation:restart',
      'mutation:finish',
      'mutation:pause',
      'mutation:resume',
      'subscription:currentSessionState',
      'subscription:inputDiscovery',
      'subscription:screenCaptureKitStatus',
      'subscription:audioSources',
      'query:isScreenCaptureKitSupported',
      'mutation:addMarker',
      'merge:recover.unfinishedRecordings',
    ],
    description: 'Controls polyrecorder-prod child process over stdin JSON / stdout NDJSON',
  },
  'project.': {
    varName: 'EEe',
    procedures: [
      'query:readProject',
      'query:openProject',
      'query:loadProject',
      'mutation:updateProject',
      'mutation:copyProject',
      'mutation:removeProject',
      'query:faceBounds',
      'query:segmentedWebcamVideos',
      'query:isVideoSegmentationSupported',
      'query:silenceChunks',
      'mutation:extractRawRecordingFiles',
      'mutation:share',
      'mutation:openVideoChunkStore',
      'mutation:writeVideoChunk',
      'merge:preview.hasPreview',
      'merge:previewWalker.readProjectSilently',
    ],
    description: 'Manages .screenstudio bundle persistence, Vision faceBounds, and chunk stores',
  },
  'media.': {
    varName: '_Fe',
    procedures: [
      'query:isImproveAudioSupported',
      'query:supportedAudioChainPresets',
      'query:renderAudio',
      'subscription:audioRenderState',
      'query:speechRanges',
      'query:getVideoBorderColors',
    ],
    description: 'Drives arm64/native-audio.node (CoreML MossFormer2 + MLX TF-Restormer + aufx)',
  },
  'captions.': {
    varName: 'LNe',
    procedures: [
      'query:getTranscript',
      'mutation:generateAll',
      'mutation:generateMissing',
      'mutation:updateTranscript',
      'query:isGeneratorSupported',
      'query:supportedLocales',
      'mutation:exportTranscriptAsSRT',
    ],
    description: 'Orchestrates whisper-darwin-arm64, macOS Speech.framework, and ElevenLabs STT',
  },
  'speech.': {
    varName: 'UFe',
    procedures: [
      'mutation:generateVoiceoverForProject',
      'mutation:removeVoiceoverFileFromProject',
      'mutation:addVoiceoverRecordingFileToProject',
      'mutation:generate',
      'query:voices',
    ],
    description: 'Generates AI voiceovers and stores WAV assets inside project/voiceovers/',
  },
  'export.': {
    varName: 'jPe',
    procedures: [
      'mutation:start',
      'mutation:cancel',
      'subscription:activeExportInfo',
      'query:activeExportInfo',
      'subscription:activeExportsCount',
      'subscription:progress',
      'subscription:isExportFinished',
      'query:getTempClipboardExportsPath',
    ],
    description: 'Acquires --render-worker BrowserWindow, writes WebCodecs chunks, & muxes via FFmpeg',
  },
  'window.': {
    varName: 'MLe',
    procedures: [
      'mutation:performChildWindowDrag',
      'mutation:updateChildWindow',
      'mutation:closeChildWindow',
      'subscription:childWindowDisplayRefreshRate',
      'subscription:isAnyAppWindowFocused',
      'mutation:maximize',
      'mutation:minimize',
      'mutation:contextMenu',
      'mutation:focusChildWindow',
      'mutation:markContentReady',
    ],
    description: 'Manages React Portal child BrowserWindows spawned from invisible 100×100 host',
  },
  'windows.': {
    varName: 'NLe',
    procedures: [
      'subscription:capturableWindows',
      'query:capturableWindows',
      'query:capturableWindowById',
    ],
    description: 'Invokes bin/list-windows (CGWindowListCopyWindowInfo) for window capture picker',
  },
  'displays.': {
    varName: 'vPe',
    procedures: ['subscription:allDisplays'],
    description: 'Streams active display bounds, scale factors, and ProMotion refresh rates',
  },
  'mask.': {
    varName: 'lFe',
    procedures: ['mutation:detectMaskedContentShift'],
    description: 'Runs bin/dynamic-mask-tracker to track redacted UI regions across scroll/pan',
  },
  'presets.': {
    varName: 'kFe',
    procedures: [
      'mutation:create',
      'mutation:createFromConfig',
      'mutation:sync',
      'mutation:apply',
      'mutation:import',
      'mutation:delete',
      'mutation:rename',
      'query:all',
      'subscription:all',
    ],
    description: 'Manages .screenstudiopreset bundles',
  },
  'assets.': {
    varName: 'TMe',
    procedures: [
      'query:backgrounds',
      'query:backgroundPath',
      'query:cursorSets',
      'query:mouseClickSoundPath',
    ],
    description: 'Resolves built-in wallpapers, cursor SVGs, and click sound WAVs',
  },
  'backgroundAudio.': {
    varName: 'WMe',
    procedures: [
      'subscription:userLibraryTracks',
      'query:userLibraryPath',
      'query:builtInTracks',
    ],
    description: 'Serves 17 built-in background audio tracks across 4 genres + user library',
  },
  'luts.': {
    varName: 'sFe',
    procedures: [
      'subscription:userLibrary',
      'query:readContents',
      'mutation:addToLibrary',
      'mutation:writeToLibrary',
      'mutation:removeFromLibrary',
    ],
    description: 'Manages 3D color-grading LUTs for webcam video',
  },
  'accessibility.': {
    varName: 'MEe',
    procedures: ['mutation:resizeSystemWindow', 'mutation:bringWindowToFront'],
    description: 'Calls bin/manage-window via macOS Accessibility API to size target windows',
  },
  'permissions.': {
    varName: 'DFe',
    procedures: ['query:check', 'subscription:watch', 'mutation:request'],
    description: 'Checks Screen Recording, Microphone, Camera, & Accessibility via node-mac-permissions',
  },
  'system.': {
    varName: '$Fe',
    procedures: [
      'query:machineId',
      'query:osVersion',
      'query:isDev',
      'mutation:openUrl',
      'mutation:showAlert',
      'query:cursorSize',
      'mutation:setDesktopVisibility',
      'mutation:copyToClipboard',
      'subscription:memoryInfo',
    ],
    description: 'System diagnostics, desktop icon hiding (bin/hide-icons), and memory telemetry',
  },
  'bench.': {
    varName: 'AFe',
    procedures: ['query:config', 'mutation:writeResult', 'mutation:done'],
    description: 'StageBench automated frame-time & GPU render benchmark harness',
  },
};

const callHistory: TrpcCallLogEntry[] = [];
const listeners = new Set<() => void>();

function recordCall(entry: TrpcCallLogEntry) {
  callHistory.unshift(entry);
  if (callHistory.length > 60) callHistory.pop();
  listeners.forEach((fn) => fn());
}

export function subscribeTrpcLog(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getTrpcCallLog(): TrpcCallLogEntry[] {
  return callHistory;
}

export function isElectronRuntime(): boolean {
  return (
    typeof window !== 'undefined' &&
    (Boolean(window.$$typelectron) ||
      (typeof navigator !== 'undefined' &&
        navigator.userAgent.includes('Electron')))
  );
}

export async function invokeTrpc<T = unknown>(
  path: string,
  type: 'query' | 'mutation' = 'query',
  input?: unknown
): Promise<T> {
  const t0 = performance.now();
  const [router, proc] = path.split('.');
  const transport = isElectronRuntime() ? 'electron-ipc' : 'in-memory-router';

  let output: unknown;
  if (window.$$typelectron) {
    try {
      const res = (await window.$$typelectron.invoke('trpc-op', {
        path,
        type,
        input,
      })) as { result?: { data?: unknown } };
      output = res?.result?.data;
    } catch (err) {
      output = { error: String(err) };
    }
  } else {
    output = await simulateInMemoryRouter(path, input);
  }

  const durationMs = Number((performance.now() - t0).toFixed(2));
  recordCall({
    id: `rpc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    router: `${router}.`,
    procedure: proc ?? path,
    kind: type,
    transport,
    durationMs,
    inputSummary: input ? JSON.stringify(input).slice(0, 80) : '{}',
    outputSummary: JSON.stringify(output).slice(0, 100),
  });

  return output as T;
}

async function simulateInMemoryRouter(path: string, input: unknown): Promise<unknown> {
  await new Promise((r) => setTimeout(r, 8));
  switch (path) {
    case 'app.version':
      return '4.0.4-4926-rea';
    case 'app.recorderVersion':
      return 'polyrecorder-prod (RecordKit 4.0 · arm64)';
    case 'media.isImproveAudioSupported':
      return true;
    case 'windows.capturableWindows':
      return [
        {
          id: 401,
          name: 'Screen Studio 4.0 — Architecture & Pipeline Demo',
          bundleId: 'com.timpler.screenstudio',
          bounds: { x: 120, y: 72, width: 1440, height: 900 },
          isOnScreen: true,
        },
        {
          id: 402,
          name: 'Hopper Disassembler — polyrecorder-prod.hop',
          bundleId: 'com.cryptic-apps.hopper-web-4',
          bounds: { x: 160, y: 90, width: 1380, height: 860 },
          isOnScreen: true,
        },
        {
          id: 403,
          name: 'Terminal — pi-coding-agent (REA MCP)',
          bundleId: 'com.apple.Terminal',
          bounds: { x: 200, y: 110, width: 1200, height: 760 },
          isOnScreen: true,
        },
        {
          id: 404,
          name: 'iPhone 16 Pro (USB CoreMediaIO DAL)',
          bundleId: 'com.apple.MobileDevice',
          bounds: { x: 0, y: 0, width: 1179, height: 2556 },
          isOnScreen: true,
        },
      ] satisfies CapturableWindowInfo[];
    default:
      return { ok: true, path, input };
  }
}

/**
 * WebAudio synthesizer for Screen Studio's click sound sets
 * (`apple-magic-mouse` and `logitech-mx-master` from `assets/sounds/index.ts`)
 * and recording start/stop chimes.
 */
class SoundAssetPlayer {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  playClick(soundSet: ClickSoundSetName, phase: 'down' | 'up' = 'down') {
    if (soundSet === 'none') return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    if (soundSet === 'apple-magic-mouse') {
      // Crisp high-frequency glass/tactile transient
      osc.type = 'triangle';
      const baseFreq = phase === 'down' ? 2150 : 1680;
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(340, now + 0.022);
      filter.type = 'bandpass';
      filter.frequency.value = 2400;
      filter.Q.value = 2.2;
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.024);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.026);
    } else if (soundSet === 'logitech-mx-master') {
      // Deeper mechanical micro-switch transient
      osc.type = 'sine';
      const baseFreq = phase === 'down' ? 1320 : 980;
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(190, now + 0.032);
      filter.type = 'lowpass';
      filter.frequency.value = 1800;
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.034);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.036);
    }
  }

  playRecordChime(kind: 'begin' | 'end') {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    if (kind === 'begin') {
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
    } else {
      osc.frequency.setValueAtTime(659.25, now); // E5
      osc.frequency.setValueAtTime(523.25, now + 0.08); // C5
    }
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }
}

export const soundPlayer = new SoundAssetPlayer();
