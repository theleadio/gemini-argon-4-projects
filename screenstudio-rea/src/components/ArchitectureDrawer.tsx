import React, { useEffect, useState } from 'react';
import {
  Cpu,
  Terminal,
  Layers,
  Play,
  X,
  CheckCircle2,
  Database,
  Sparkles,
} from 'lucide-react';
import {
  getTrpcCallLog,
  invokeTrpc,
  RECOVERED_TRPC_ROUTERS,
  subscribeTrpcLog,
  TrpcCallLogEntry,
} from '../bridge/trpcBridge';

interface ArchitectureDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const NATIVE_BINARIES_INVENTORY = [
  {
    name: 'bin/prod/polyrecorder-prod',
    arch: 'universal (arm64 + x86_64)',
    sha256: '4a8df480719c5f5a40c092e43a31b720f705b600d6c03c2497b2beca2da86d68',
    role: 'Core Swift capture engine (13,620 procedures). Links ScreenCaptureKit, AVFoundation, CoreMediaIO, MobileDevice.framework, VideoToolbox, Metal.',
    subsystems: [
      'DisplayRecorder (SCStream)',
      'WindowRecorder (SCWindow)',
      'ExternalDeviceRecorder (iOS/iPadOS USB)',
      'InputRecorder (120Hz mouse/keystroke NDJSON)',
      'FocusRecorder (Accessibility element tracking)',
      'SegmentedAssetWriterDelegate (crash-safe fMP4)',
    ],
  },
  {
    name: 'bin/arm64/native-audio.node',
    arch: 'arm64 (Rust N-API + C++ + ObjC)',
    sha256: '39d96d820ed3f657bb72b999f83865d7c54cbb7072521d3f2ba9fbc1ea71346f',
    role: 'In-process native audio engine linking CoreML, Metal (mlx.metallib), SoundAnalysis, Accelerate, and AudioToolbox (aufx).',
    subsystems: [
      'MossFormer2_SE_48K_masker_float16_w12_b6.mlmodelc',
      'tf-restormer.safetensors (Apple MLX)',
      'ScreenStudioClassificationResults (17 vocal classes)',
      '8 Apple AudioUnit (aufx/*) DSP processors',
    ],
  },
  {
    name: 'bin/segment-video & bin/face-detector',
    arch: 'universal (arm64 + x86_64)',
    sha256: 'e7ac1c1174ca939df3bafec53a4721af89c314bf295a06b980506ec484049010',
    role: 'Swift Vision.framework CLIs for person segmentation and webcam face-bounds centering, paired with ONNX Runtime Web PP-MattingV2.',
    subsystems: [
      'pp-mattingv2-stdc1-human-576x1024-ss2-fp16.onnx',
      'ssmatte-v1-s1c.onnx',
      'C9S7Xuu8.cascade (in-renderer face cascade)',
    ],
  },
  {
    name: 'bin/whisper-darwin-arm64 & bin/transcribe-audio',
    arch: 'arm64 / universal',
    sha256: '7b46608d6f1ca91ca5948564da9896d522cdc7aa85586a7a5ce652cf5e6dd8fd',
    role: 'Local word-level caption engines: whisper.cpp (--max-len 1 --output-srt) and macOS Speech.framework AttributedString.',
    subsystems: [
      'Whisper C++ (Accelerate.framework)',
      'macOS Speech.framework (TimeRange + Confidence)',
      'ElevenLabs Scribe Cloud fallback',
    ],
  },
  {
    name: 'bin/dynamic-mask-tracker & bin/audio-composer',
    arch: 'universal (arm64 + x86_64)',
    sha256: 'b697a356f4831b2ecba411a294cf554aac317d5ab41afcf27304d0ad6bcee536',
    role: 'Swift CLIs for tracking redacted UI regions across scroll/pan and mixing multi-track project audio.',
    subsystems: [
      'bin/detect-silence',
      'bin/video-border-colors',
      'bin/cursor-rect',
      'bin/list-windows & bin/manage-window',
    ],
  },
];

export const ArchitectureDrawer: React.FC<ArchitectureDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeSection, setActiveSection] = useState<'trpc' | 'binaries' | 'portal'>('trpc');
  const [logs, setLogs] = useState<TrpcCallLogEntry[]>(() => [...getTrpcCallLog()]);

  useEffect(() => {
    setLogs([...getTrpcCallLog()]);
    return subscribeTrpcLog(() => {
      setLogs([...getTrpcCallLog()]);
    });
  }, []);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="arch-drawer-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="hud-header">
          <div className="hud-title-row">
            <Cpu size={18} className="accent-icon" />
            <div>
              <div className="hud-title">
                REA Reconstruction Ledger · Screen Studio 4.0.4-4926
              </div>
              <div className="hud-subtitle">
                Shipped-Artifact Evidence (`com.timpler.screenstudio`) · Live `$$typelectron` tRPC Bus
              </div>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="arch-tabs-bar">
          <button
            className={`arch-tab-btn ${activeSection === 'trpc' ? 'active' : ''}`}
            onClick={() => setActiveSection('trpc')}
          >
            <Terminal size={14} />
            <span>48 tRPC Sub-Routers & Live IPC Bus ({logs.length})</span>
          </button>
          <button
            className={`arch-tab-btn ${activeSection === 'binaries' ? 'active' : ''}`}
            onClick={() => setActiveSection('binaries')}
          >
            <Database size={14} />
            <span>Native Mach-O & ML Model Inventory</span>
          </button>
          <button
            className={`arch-tab-btn ${activeSection === 'portal' ? 'active' : ''}`}
            onClick={() => setActiveSection('portal')}
          >
            <Layers size={14} />
            <span>100×100 Invisible Host & Portal Window Model</span>
          </button>
        </div>

        {activeSection === 'trpc' && (
          <div className="arch-split-body">
            <div className="arch-routers-col">
              <div className="arch-col-header">
                <span>Root Router `LLe` in `dist-electron/index.js`</span>
                <span className="mono-badge">48 Merged Routers</span>
              </div>
              <div className="arch-router-list">
                {Object.entries(RECOVERED_TRPC_ROUTERS).map(([prefix, info]) => (
                  <div key={prefix} className="arch-router-card">
                    <div className="arch-router-top">
                      <span className="arch-router-name">{prefix}*</span>
                      <span className="arch-router-var">var {info.varName}</span>
                      <button
                        className="arch-probe-btn"
                        onClick={() => {
                          const firstProc = info.procedures[0]?.split(':')[1] ?? 'version';
                          invokeTrpc(`${prefix}${firstProc}`, 'query', { probe: true });
                        }}
                      >
                        <Play size={10} />
                        <span>Invoke</span>
                      </button>
                    </div>
                    <div className="arch-router-desc">{info.description}</div>
                    <div className="arch-proc-chips">
                      {info.procedures.map((p) => {
                        const [kind, name] = p.split(':');
                        return (
                          <span key={p} className={`proc-chip ${kind}`}>
                            {kind}:{name}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="arch-log-col">
              <div className="arch-col-header">
                <span>Live `$$typelectron` IPC Telemetry</span>
                <button
                  className="arch-probe-btn"
                  onClick={() => {
                    invokeTrpc('windows.capturableWindows', 'query');
                    invokeTrpc('media.isImproveAudioSupported', 'query');
                  }}
                >
                  <Sparkles size={11} />
                  <span>Ping IPC Bus</span>
                </button>
              </div>
              <div className="arch-log-list">
                {logs.length === 0 ? (
                  <div className="empty-log">
                    Interact with the timeline, inspector, or click "Ping IPC Bus" to observe live tRPC traffic.
                  </div>
                ) : (
                  logs.map((entry) => (
                    <div key={entry.id} className="arch-log-item">
                      <div className="arch-log-top">
                        <span className={`proc-chip ${entry.kind}`}>
                          {entry.kind}
                        </span>
                        <span className="arch-log-path">
                          {entry.router}
                          {entry.procedure}
                        </span>
                        <span className="arch-log-time">
                          {entry.durationMs}ms · {entry.transport}
                        </span>
                      </div>
                      <div className="arch-log-payload">
                        in: {entry.inputSummary} → out: {entry.outputSummary}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeSection === 'binaries' && (
          <div className="arch-binaries-grid">
            {NATIVE_BINARIES_INVENTORY.map((bin) => (
              <div key={bin.name} className="arch-binary-card">
                <div className="arch-binary-header">
                  <div>
                    <div className="arch-binary-name">{bin.name}</div>
                    <div className="arch-binary-arch">{bin.arch}</div>
                  </div>
                  <span className="mono-badge">SHA256: {bin.sha256.slice(0, 12)}…</span>
                </div>
                <p className="arch-binary-role">{bin.role}</p>
                <div className="arch-proc-chips">
                  {bin.subsystems.map((sub) => (
                    <span key={sub} className="proc-chip query">
                      <CheckCircle2 size={10} />
                      <span>{sub}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeSection === 'portal' && (
          <div className="arch-portal-explainer">
            <div className="portal-step-card">
              <div className="portal-step-num">01 · Invisible Host Window (`gRe()` in `dist-electron/index.js`)</div>
              <p>
                At startup, Screen Studio creates a <strong>100×100px invisible BrowserWindow</strong> with{' '}
                <code>opacity: 0</code>, <code>focusable: false</code>,{' '}
                <code>skipTaskbar: true</code>, <code>backgroundThrottling: false</code>, and{' '}
                <code>setIgnoreMouseEvents(true)</code>. This window loads{' '}
                <code>dist/index.html</code> (which boots <code>dist/BEy_VAkj.js</code>).
              </p>
            </div>
            <div className="portal-step-card">
              <div className="portal-step-num">02 · React Portal Child Windows (`$Oe()` & `setWindowOpenHandler`)</div>
              <p>
                Every visible UI surface (the Recording HUD, Project Editor, Quick Export Widget, Settings, and Teleprompter) is opened by calling{' '}
                <code>window.open('about:blank', frameName, serializedFeatures)</code> from the host window. The main process intercepts{' '}
                <code>setWindowOpenHandler</code>, applies{' '}
                <code>childWindow.setContentProtection(true)</code> so macOS WindowServer excludes Screen Studio UI from screen recordings, and React renders into the child window's DOM via <code>createPortal</code>.
              </p>
            </div>
            <div className="portal-step-card">
              <div className="portal-step-num">03 · Background `--render-worker` Export Window (`hke.renderFramesUsingVideoEncoder`)</div>
              <p>
                During video export, <code>ActiveExportController</code> acquires a hidden worker BrowserWindow launched with{' '}
                <code>--render-worker</code> (which dynamically imports <code>dist/D6IDRHOL.js</code>). It demuxes source tracks via{' '}
                <code>web-demuxer.wasm</code>, composites spring-smoothed cursor & zoom trajectories, encodes H.264/HEVC frames via Chromium WebCodecs, and streams chunks back to the main process for final FFmpeg muxing with <code>native-audio.node</code> output.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
