import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  CircleDot,
  Cpu,
  Download,
  Undo2,
  Redo2,
  Command,
  Sparkles,
  Volume2,
  VolumeX,
  Maximize2,
  CheckCircle2,
  X,
} from 'lucide-react';
import { AspectRatioId, SSStudioProject } from './types/project';
import { createDefaultProject } from './data/catalog';
import { renderStageFrame, StageMetrics } from './engine/stageRenderer';
import {
  exportCaptionsAsSRT,
  exportScreenStudioBundle,
  ExportProgressState,
  runStageVideoExport,
} from './engine/exporter';
import { InspectorPanel, InspectorTabId } from './components/InspectorPanel';
import { SelectedBlockRef, TimelineDock } from './components/TimelineDock';
import { RecorderHudModal } from './components/RecorderHudModal';
import { ArchitectureDrawer } from './components/ArchitectureDrawer';
import { invokeTrpc, isElectronRuntime, soundPlayer } from './bridge/trpcBridge';

export const App: React.FC = () => {
  const [project, setProject] = useState<SSStudioProject>(() =>
    createDefaultProject()
  );
  const [historyPast, setHistoryPast] = useState<SSStudioProject[]>([]);
  const [historyFuture, setHistoryFuture] = useState<SSStudioProject[]>([]);

  const [currentTimeMs, setCurrentTimeMs] = useState<number>(1850);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [activeInspectorTab, setActiveInspectorTab] =
    useState<InspectorTabId>('background');
  const [selectedBlock, setSelectedBlock] = useState<SelectedBlockRef>({
    kind: 'zoom',
    id: 'zoom-1',
  });

  const [isRecorderHudOpen, setIsRecorderHudOpen] = useState<boolean>(false);
  const [isArchDrawerOpen, setIsArchDrawerOpen] = useState<boolean>(false);
  const [isCommandMenuOpen, setIsCommandMenuOpen] = useState<boolean>(false);
  const [isLiveTelemetryRecording, setIsLiveTelemetryRecording] =
    useState<boolean>(false);

  // Active Recording Session state (mirrors `capture.currentSessionState` in polyrecorder)
  const [activeRecSession, setActiveRecSession] = useState<{
    active: boolean;
    paused: boolean;
    elapsedMs: number;
    windowName: string;
    markersCount: number;
  } | null>(null);

  const liveMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const liveRecordedChunksRef = useRef<BlobPart[]>([]);
  const liveWebcamRecorderRef = useRef<MediaRecorder | null>(null);
  const liveWebcamChunksRef = useRef<BlobPart[]>([]);
  const activeStreamsRef = useRef<MediaStream[]>([]);
  const recordedBlobUrlRef = useRef<string | null>(null);
  const recordedWebcamBlobUrlRef = useRef<string | null>(null);
  const [videoReadyRevision, setVideoReadyRevision] = useState<number>(0);

  const [exportState, setExportState] = useState<ExportProgressState>({
    phase: 'idle',
    progress: 0,
    renderedFrames: 0,
    totalFrames: 0,
    outputUrl: null,
    outputFilename: null,
  });

  const [stageMetrics, setStageMetrics] = useState<StageMetrics | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const webcamVideoRef = useRef<HTMLVideoElement | null>(null);
  const exportAbortRef = useRef<AbortController | null>(null);
  const lastClickedSoundIndexRef = useRef<number>(-1);
  const lastMoveLogTimeRef = useRef<number>(0);

  const updateProject = useCallback(
    (updater: (prev: SSStudioProject) => SSStudioProject) => {
      setProject((prev) => {
        const next = updater(prev);
        setHistoryPast((h) => [...h.slice(-18), prev]);
        setHistoryFuture([]);
        return next;
      });
    },
    []
  );

  const handleUndo = useCallback(() => {
    setHistoryPast((past) => {
      if (past.length === 0) return past;
      const previous = past[past.length - 1];
      setProject((curr) => {
        setHistoryFuture((f) => [curr, ...f]);
        return previous;
      });
      return past.slice(0, -1);
    });
  }, []);

  const handleRedo = useCallback(() => {
    setHistoryFuture((future) => {
      if (future.length === 0) return future;
      const next = future[0];
      setProject((curr) => {
        setHistoryPast((p) => [...p, curr]);
        return next;
      });
      return future.slice(1);
    });
  }, []);

  // Initial boot tRPC probes (mirroring _Re() in dist-electron/index.js)
  useEffect(() => {
    invokeTrpc('app.version', 'query');
    invokeTrpc('app.recorderVersion', 'query');
    invokeTrpc('media.isImproveAudioSupported', 'query');
  }, []);

  // Playback RAF Loop respecting Slice speed multipliers
  useEffect(() => {
    if (!isPlaying) return;
    let rafId = 0;
    let lastTs = performance.now();

    const tick = (now: number) => {
      const dt = now - lastTs;
      lastTs = now;

      setCurrentTimeMs((prevMs) => {
        const activeSlice = project.slices.find(
          (s) => prevMs >= s.startMs && prevMs <= s.endMs
        );
        const speed = activeSlice?.speed ?? 1.0;
        const nextMs = prevMs + dt * speed;

        // Play click sound if crossing a click event
        if (!isMuted && project.cursorConfig.clickSoundEffect !== 'none') {
          const clickIdx = project.cursorEvents.findIndex(
            (ev) =>
              ev.type === 'click' &&
              ev.timeMs > prevMs &&
              ev.timeMs <= nextMs
          );
          if (clickIdx !== -1 && clickIdx !== lastClickedSoundIndexRef.current) {
            lastClickedSoundIndexRef.current = clickIdx;
            soundPlayer.playClick(project.cursorConfig.clickSoundEffect, 'down');
          }
        }

        if (nextMs >= project.durationMs) {
          lastClickedSoundIndexRef.current = -1;
          if (screenVideoRef.current && !screenVideoRef.current.srcObject && recordedBlobUrlRef.current) {
            screenVideoRef.current.currentTime = 0;
            screenVideoRef.current.play().catch(() => {});
          }
          if (webcamVideoRef.current && !webcamVideoRef.current.srcObject && recordedWebcamBlobUrlRef.current) {
            webcamVideoRef.current.currentTime = 0;
            webcamVideoRef.current.play().catch(() => {});
          }
          return 0;
        }
        return nextMs;
      });

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, isMuted, project]);

  // Sync play/pause state of recorded <video> elements with timeline `isPlaying`
  useEffect(() => {
    const sVid = screenVideoRef.current;
    if (sVid && !sVid.srcObject && recordedBlobUrlRef.current) {
      if (isPlaying) {
        sVid.currentTime = currentTimeMs / 1000;
        sVid.play().catch(() => {});
      } else {
        sVid.pause();
      }
    }
    const wVid = webcamVideoRef.current;
    if (wVid && !wVid.srcObject && recordedWebcamBlobUrlRef.current) {
      if (isPlaying) {
        wVid.currentTime = currentTimeMs / 1000;
        wVid.play().catch(() => {});
      } else {
        wVid.pause();
      }
    }
  }, [isPlaying]);

  // Sync recorded <video> elements currentTime when scrubbing in Editor mode
  useEffect(() => {
    const sVid = screenVideoRef.current;
    if (sVid && !sVid.srcObject && recordedBlobUrlRef.current) {
      if (!isPlaying && Math.abs(sVid.currentTime * 1000 - currentTimeMs) > 50) {
        sVid.currentTime = currentTimeMs / 1000;
      }
    }
    const wVid = webcamVideoRef.current;
    if (wVid && !wVid.srcObject && recordedWebcamBlobUrlRef.current) {
      if (!isPlaying && Math.abs(wVid.currentTime * 1000 - currentTimeMs) > 50) {
        wVid.currentTime = currentTimeMs / 1000;
      }
    }
  }, [currentTimeMs, isPlaying]);

  // Active Recording Session Timer
  useEffect(() => {
    if (!activeRecSession?.active || activeRecSession.paused) return;
    let rafId = 0;
    let lastTs = performance.now();
    const tick = (now: number) => {
      const dt = now - lastTs;
      lastTs = now;
      setActiveRecSession((prev) => {
        if (!prev || !prev.active || prev.paused) return prev;
        const nextElapsed = prev.elapsedMs + dt;
        setCurrentTimeMs(nextElapsed);
        setProject((p) => {
          const nextDur = Math.max(15000, Math.ceil((nextElapsed + 2000) / 1000) * 1000);
          return {
            ...p,
            durationMs: nextDur,
            slices: [
              {
                id: 'slice-live-rec',
                startMs: 0,
                endMs: Math.round(nextElapsed),
                speed: 1.0,
                typingSpeedUp: false,
                label: `Recording · ${prev.windowName}`,
              },
            ],
            cameraLayouts: p.cameraLayouts.map((cl, i) =>
              i === 0 ? { ...cl, endMs: nextDur } : cl
            ),
          };
        });
        return { ...prev, elapsedMs: nextElapsed };
      });
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [activeRecSession?.active, activeRecSession?.paused]);

  const handleFinishRecordingSession = useCallback(async () => {
    if (!activeRecSession) return;
    soundPlayer.playRecordChime('end');
    const finalDurationMs = Math.max(4000, Math.round(activeRecSession.elapsedMs));

    await invokeTrpc('capture.finish', 'mutation', {
      durationMs: finalDurationMs,
      windowName: activeRecSession.windowName,
    });

    // 1. Finalize recorded Screen video blob
    if (
      liveMediaRecorderRef.current &&
      liveMediaRecorderRef.current.state !== 'inactive'
    ) {
      await new Promise<void>((resolve) => {
        const rec = liveMediaRecorderRef.current!;
        rec.onstop = () => {
          if (liveRecordedChunksRef.current.length > 0) {
            const blob = new Blob(liveRecordedChunksRef.current, {
              type: rec.mimeType || 'video/webm',
            });
            if (recordedBlobUrlRef.current) {
              URL.revokeObjectURL(recordedBlobUrlRef.current);
            }
            const url = URL.createObjectURL(blob);
            recordedBlobUrlRef.current = url;
            if (screenVideoRef.current) {
              screenVideoRef.current.srcObject = null;
              screenVideoRef.current.src = url;
              screenVideoRef.current.loop = true;
              screenVideoRef.current.currentTime = 0;
              screenVideoRef.current.play().catch(() => {});
            }
          }
          resolve();
        };
        try {
          rec.requestData();
        } catch {}
        rec.stop();
      });
    }

    // 2. Finalize recorded Webcam video blob
    if (
      liveWebcamRecorderRef.current &&
      liveWebcamRecorderRef.current.state !== 'inactive'
    ) {
      await new Promise<void>((resolve) => {
        const rec = liveWebcamRecorderRef.current!;
        rec.onstop = () => {
          if (liveWebcamChunksRef.current.length > 0) {
            const blob = new Blob(liveWebcamChunksRef.current, {
              type: rec.mimeType || 'video/webm',
            });
            if (recordedWebcamBlobUrlRef.current) {
              URL.revokeObjectURL(recordedWebcamBlobUrlRef.current);
            }
            const url = URL.createObjectURL(blob);
            recordedWebcamBlobUrlRef.current = url;
            if (webcamVideoRef.current) {
              webcamVideoRef.current.srcObject = null;
              webcamVideoRef.current.src = url;
              webcamVideoRef.current.loop = true;
              webcamVideoRef.current.currentTime = 0;
              webcamVideoRef.current.play().catch(() => {});
            }
          }
          resolve();
        };
        try {
          rec.requestData();
        } catch {}
        rec.stop();
      });
    }

    // Stop live capture hardware tracks after recorded blobs are attached
    activeStreamsRef.current.forEach((st) =>
      st.getTracks().forEach((t) => t.stop())
    );
    activeStreamsRef.current = [];

    updateProject((prev) => ({
      ...prev,
      durationMs: finalDurationMs,
      slices: [
        {
          id: `slice-rec-${Date.now()}`,
          startMs: 0,
          endMs: finalDurationMs,
          speed: 1.0,
          typingSpeedUp: false,
          label: `Recorded · ${activeRecSession.windowName}`,
        },
      ],
    }));

    setActiveRecSession(null);
    setIsLiveTelemetryRecording(false);
    setCurrentTimeMs(0);
    setIsPlaying(true);
  }, [activeRecSession, updateProject]);

  // Render Stage Canvas on every state/time change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const ratioMap: Record<AspectRatioId, [number, number]> = {
      '16:9': [1280, 720],
      '9:16': [540, 960],
      '1:1': [820, 820],
      '4:3': [960, 720],
      '3:4': [720, 960],
    };
    const [logicalW, logicalH] =
      ratioMap[project.stageConfig.aspectRatio] ?? [1280, 720];

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (
      canvas.width !== logicalW * dpr ||
      canvas.height !== logicalH * dpr
    ) {
      canvas.width = logicalW * dpr;
      canvas.height = logicalH * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    const metrics = renderStageFrame({
      ctx,
      width: logicalW,
      height: logicalH,
      project,
      timeMs: currentTimeMs,
      screenVideoEl: screenVideoRef.current,
      webcamVideoEl: webcamVideoRef.current,
      selectedMaskId:
        selectedBlock?.kind === 'mask' ? selectedBlock.id : null,
      selectedZoomId:
        selectedBlock?.kind === 'zoom' ? selectedBlock.id : null,
      showGizmos: true,
    });
    ctx.restore();
    setStageMetrics(metrics);
  }, [project, currentTimeMs, selectedBlock, videoReadyRevision]);

  // Global keyboard shortcuts (Space = Play/Pause, Cmd+K = Command Menu, Cmd+I = REA Architecture)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandMenuOpen((o) => !o);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        setIsArchDrawerOpen((o) => !o);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo]);

  // Direct Canvas Interaction: Drag Manual Zoom Target, Drag Privacy Mask, or Record Live Click Telemetry
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !stageMetrics) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const logicalW = canvas.width / dpr;
    const logicalH = canvas.height / dpr;

    const toNormScreenCoords = (clientX: number, clientY: number) => {
      const canvasX = ((clientX - rect.left) / rect.width) * logicalW;
      const canvasY = ((clientY - rect.top) / rect.height) * logicalH;
      const { x, y, w, h } = stageMetrics.screenRect;
      const nx = Math.max(0.02, Math.min(0.98, (canvasX - x) / w));
      const ny = Math.max(0.02, Math.min(0.98, (canvasY - y) / h));
      return { nx, ny };
    };

    const { nx, ny } = toNormScreenCoords(e.clientX, e.clientY);

    // If Live Telemetry Recording is active, log real click + auto-create a spring zoom block!
    if (isLiveTelemetryRecording) {
      soundPlayer.playClick(project.cursorConfig.clickSoundEffect, 'down');
      const clickTime = Math.round(currentTimeMs);
      updateProject((prev) => ({
        ...prev,
        cursorEvents: [
          ...prev.cursorEvents,
          {
            timeMs: clickTime,
            x: nx,
            y: ny,
            type: 'click' as const,
            cursorShape: 'pointer' as const,
          },
        ].sort((a, b) => a.timeMs - b.timeMs),
        zooms: [
          ...prev.zooms,
          {
            id: `zoom-live-${Date.now()}`,
            startMs: Math.max(0, clickTime - 150),
            endMs: Math.min(prev.durationMs, clickTime + 2100),
            scale: 1.9,
            mode: 'manual',
            targetX: nx,
            targetY: ny,
            glassLoupe: false,
            springPreset: prev.cursorConfig.springPreset,
          },
        ],
      }));
      return;
    }

    // Reposition selected Zoom target or Mask on drag
    const updateAtCoords = (cx: number, cy: number) => {
      const pos = toNormScreenCoords(cx, cy);
      if (selectedBlock?.kind === 'zoom') {
        setProject((prev) => ({
          ...prev,
          zooms: prev.zooms.map((z) =>
            z.id === selectedBlock.id
              ? { ...z, mode: 'manual', targetX: pos.nx, targetY: pos.ny }
              : z
          ),
        }));
      } else if (selectedBlock?.kind === 'mask') {
        setProject((prev) => ({
          ...prev,
          masks: prev.masks.map((m) =>
            m.id === selectedBlock.id
              ? {
                  ...m,
                  x: Math.max(0, Math.min(1 - m.width, pos.nx - m.width / 2)),
                  y: Math.max(0, Math.min(1 - m.height, pos.ny - m.height / 2)),
                }
              : m
          ),
        }));
      }
    };

    updateAtCoords(e.clientX, e.clientY);

    const onMove = (me: PointerEvent) => updateAtCoords(me.clientX, me.clientY);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handleStartVideoExport = async () => {
    exportAbortRef.current?.abort();
    const controller = new AbortController();
    exportAbortRef.current = controller;
    setIsPlaying(false);
    await runStageVideoExport(
      project,
      setExportState,
      controller.signal,
      screenVideoRef.current,
      webcamVideoRef.current
    );
  };

  const formatTimecode = (ms: number) => {
    const totalSec = ms / 1000;
    const mins = Math.floor(totalSec / 60);
    const secs = (totalSec % 60).toFixed(2).padStart(5, '0');
    return `${String(mins).padStart(2, '0')}:${secs}`;
  };

  return (
    <div className="ssstudio-shell">
      {/* Offscreen 1x1 <video> elements so Chromium decodes live MediaStream frames at 60fps */}
      <video
        ref={screenVideoRef}
        onLoadedData={() => setVideoReadyRevision((r) => r + 1)}
        onSeeked={() => setVideoReadyRevision((r) => r + 1)}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: 'none',
        }}
        muted
        playsInline
      />
      <video
        ref={webcamVideoRef}
        onLoadedData={() => setVideoReadyRevision((r) => r + 1)}
        onSeeked={() => setVideoReadyRevision((r) => r + 1)}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: 'none',
        }}
        muted
        playsInline
      />

      {/* 1. TOP MACOS WINDOW TITLEBAR */}
      <header className="top-window-bar">
        <div className="top-bar-left">
          {isElectronRuntime() && (
            <div className="macos-native-traffic-spacer" aria-hidden="true" />
          )}
          <div className="brand-badge">
            <span className="brand-dot" />
            <span className="brand-name">SSStudio</span>
            <span className="version-tag">4.0.4-rea</span>
          </div>
          <input
            className="project-title-input"
            value={project.title}
            onChange={(e) =>
              updateProject((prev) => ({ ...prev, title: e.target.value }))
            }
            aria-label="Project title"
          />
        </div>

        <div className="top-bar-center">
          <button
            className="top-pill-btn record-trigger"
            onClick={() => setIsRecorderHudOpen(true)}
          >
            <CircleDot size={13} className="rec-icon" />
            <span>New Recording (`polyrecorder`)</span>
          </button>

          <div className="aspect-ratio-switcher">
            {(
              [
                { id: '16:9', label: '16:9 Wide' },
                { id: '9:16', label: '9:16 Vertical' },
                { id: '1:1', label: '1:1 Square' },
                { id: '4:3', label: '4:3 Classic' },
              ] as { id: AspectRatioId; label: string }[]
            ).map((ar) => (
              <button
                key={ar.id}
                className={`ar-btn ${
                  project.stageConfig.aspectRatio === ar.id ? 'active' : ''
                }`}
                onClick={() =>
                  updateProject((prev) => ({
                    ...prev,
                    stageConfig: { ...prev.stageConfig, aspectRatio: ar.id },
                  }))
                }
              >
                {ar.label}
              </button>
            ))}
          </div>
        </div>

        <div className="top-bar-right">
          <button
            className="icon-btn"
            onClick={handleUndo}
            disabled={historyPast.length === 0}
            title="Undo (⌘Z)"
          >
            <Undo2 size={15} />
          </button>
          <button
            className="icon-btn"
            onClick={handleRedo}
            disabled={historyFuture.length === 0}
            title="Redo (⇧⌘Z)"
          >
            <Redo2 size={15} />
          </button>

          <button
            className="top-pill-btn arch-trigger"
            onClick={() => setIsArchDrawerOpen(true)}
            title="Inspect REA Reverse-Engineered Architecture & Live tRPC Bus (⌘I)"
          >
            <Cpu size={14} />
            <span>REA Architecture & tRPC</span>
          </button>

          <button
            className="btn-export-top"
            onClick={handleStartVideoExport}
            disabled={
              exportState.phase === 'initializing' ||
              exportState.phase === 'exporting' ||
              exportState.phase === 'compiling'
            }
          >
            <Download size={14} />
            <span>Export</span>
          </button>
        </div>
      </header>

      {/* 2. MIDDLE WORKSPACE: STAGE CANVAS + RIGHT INSPECTOR */}
      <div className="workspace-main">
        <main className="stage-viewport-area">
          {/* Live Physics & Engine Telemetry Overlay Bar */}
          <div className="stage-telemetry-strip">
            <div className="telemetry-chip">
              <span className="dot indigo" />
              <span>
                Spring Zoom:{' '}
                <strong>
                  {stageMetrics ? `${stageMetrics.zoom.scale.toFixed(2)}×` : '1.00×'}
                </strong>{' '}
                ({project.cursorConfig.springPreset} · k=
                {project.cursorConfig.customSpring.stiffness}, c=
                {project.cursorConfig.customSpring.damping})
              </span>
            </div>
            <div className="telemetry-chip">
              <span className="dot emerald" />
              <span>
                Cursor:{' '}
                <strong>
                  (
                  {stageMetrics ? stageMetrics.cursor.x.toFixed(2) : '0.50'},{' '}
                  {stageMetrics ? stageMetrics.cursor.y.toFixed(2) : '0.50'})
                </strong>
              </span>
            </div>
            <div className="telemetry-chip">
              <Sparkles size={11} />
              <span>
                Audio:{' '}
                <strong>
                  {project.audioConfig.mossFormer2NoiseReduction
                    ? 'MossFormer2 48k'
                    : 'Raw'}{' '}
                  +{' '}
                  {project.audioConfig.tfRestormerSpeechRestore
                    ? 'MLX TF-Restormer'
                    : 'Bypass'}
                </strong>
              </span>
            </div>
          </div>

          {/* Active Recording Session Dock (when `capture.start` is running) */}
          {activeRecSession?.active && (
            <div className="active-rec-dock">
              <div className="active-rec-left">
                <span
                  className={`hud-rec-dot ${
                    activeRecSession.paused ? 'paused' : 'pulse'
                  }`}
                />
                <span className="active-rec-time">
                  {formatTimecode(activeRecSession.elapsedMs)}
                </span>
                <span className="active-rec-target">
                  Recording: {activeRecSession.windowName} (Click canvas to add
                  auto-zooms)
                </span>
              </div>
              <div className="active-rec-actions">
                <button
                  className="tl-action-btn accent"
                  onClick={() => {
                    const t = Math.round(activeRecSession.elapsedMs);
                    invokeTrpc('capture.addMarker', 'mutation', { timeMs: t });
                    setProject((prev) => ({
                      ...prev,
                      durationMs: Math.max(prev.durationMs, t + 3000),
                      zooms: [
                        ...prev.zooms,
                        {
                          id: `zoom-marker-${Date.now()}`,
                          startMs: Math.max(0, t - 100),
                          endMs: t + 2200,
                          scale: 1.95,
                          mode: 'auto-cursor',
                          targetX: 0.5,
                          targetY: 0.5,
                          glassLoupe: false,
                          springPreset: prev.cursorConfig.springPreset,
                        },
                      ],
                    }));
                    setActiveRecSession((s) =>
                      s ? { ...s, markersCount: s.markersCount + 1 } : s
                    );
                  }}
                >
                  <Sparkles size={12} />
                  <span>+ Zoom Marker ({activeRecSession.markersCount})</span>
                </button>
                <button
                  className="tl-action-btn"
                  onClick={() => {
                    const nextPaused = !activeRecSession.paused;
                    invokeTrpc(
                      nextPaused ? 'capture.pause' : 'capture.resume',
                      'mutation'
                    );
                    setActiveRecSession((s) =>
                      s ? { ...s, paused: nextPaused } : s
                    );
                  }}
                >
                  {activeRecSession.paused ? 'Resume' : 'Pause'}
                </button>
                <button
                  className="btn-record-primary"
                  onClick={handleFinishRecordingSession}
                >
                  <span>Finish Recording</span>
                </button>
              </div>
            </div>
          )}

          {/* Interactive Stage Canvas Container */}
          <div className="stage-canvas-frame">
            <canvas
              ref={canvasRef}
              className={`stage-canvas aspect-${project.stageConfig.aspectRatio.replace(
                ':',
                '-'
              )}`}
              onPointerDown={handleCanvasPointerDown}
              onPointerMove={(e) => {
                if (!isLiveTelemetryRecording || !stageMetrics || !canvasRef.current) return;
                const now = performance.now();
                if (now - lastMoveLogTimeRef.current < 65) return;
                lastMoveLogTimeRef.current = now;
                const rect = canvasRef.current.getBoundingClientRect();
                const dpr = Math.min(2, window.devicePixelRatio || 1);
                const logicalW = canvasRef.current.width / dpr;
                const logicalH = canvasRef.current.height / dpr;
                const canvasX = ((e.clientX - rect.left) / rect.width) * logicalW;
                const canvasY = ((e.clientY - rect.top) / rect.height) * logicalH;
                const { x, y, w, h } = stageMetrics.screenRect;
                const nx = Math.max(0.02, Math.min(0.98, (canvasX - x) / w));
                const ny = Math.max(0.02, Math.min(0.98, (canvasY - y) / h));
                const tMs = Math.round(currentTimeMs);
                setProject((prev) => ({
                  ...prev,
                  cursorEvents: [
                    ...prev.cursorEvents,
                    {
                      timeMs: tMs,
                      x: nx,
                      y: ny,
                      type: 'move' as const,
                      cursorShape: 'arrow' as const,
                    },
                  ],
                }));
              }}
            />
          </div>

          {/* Export Status & Download Banner */}
          {exportState.phase !== 'idle' && (
            <div className="export-toast-banner">
              <div className="export-toast-left">
                {exportState.phase === 'completed' ? (
                  <CheckCircle2 size={16} className="emerald-icon" />
                ) : (
                  <Sparkles size={16} className="accent-icon spin" />
                )}
                <div>
                  <div className="export-toast-title">
                    {exportState.phase === 'completed'
                      ? `Export Completed (${exportState.totalFrames} frames rendered)`
                      : `ActiveExportController · ${exportState.phase.toUpperCase()} (${
                          exportState.renderedFrames
                        }/${exportState.totalFrames} frames)`}
                  </div>
                  <div className="export-progress-track">
                    <div
                      className="export-progress-fill"
                      style={{ width: `${Math.round(exportState.progress * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="export-toast-actions">
                {exportState.outputUrl && exportState.outputFilename && (
                  <a
                    href={exportState.outputUrl}
                    download={exportState.outputFilename}
                    className="btn-export-top"
                  >
                    <Download size={13} />
                    <span>Download {exportState.outputFilename}</span>
                  </a>
                )}
                {exportState.phase !== 'completed' &&
                exportState.phase !== 'cancelled' ? (
                  <button
                    className="btn-secondary"
                    onClick={() => exportAbortRef.current?.abort()}
                  >
                    Cancel
                  </button>
                ) : (
                  <button
                    className="icon-btn"
                    onClick={() =>
                      setExportState((s) => ({ ...s, phase: 'idle' }))
                    }
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Bottom Stage Transport Controls */}
          <div className="stage-transport-bar">
            <div className="transport-left">
              <button
                className="transport-play-btn"
                onClick={() => setIsPlaying((p) => !p)}
                title="Play / Pause (Space)"
              >
                {isPlaying ? <Pause size={15} /> : <Play size={15} />}
              </button>
              <button
                className="icon-btn"
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentTimeMs(0);
                }}
                title="Restart to 00:00"
              >
                <RotateCcw size={14} />
              </button>
              <button
                className="icon-btn"
                onClick={() => setIsMuted((m) => !m)}
                title={isMuted ? 'Unmute Click Sounds' : 'Mute Click Sounds'}
              >
                {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
              <div className="transport-timecode">
                <span className="tc-current">{formatTimecode(currentTimeMs)}</span>
                <span className="tc-sep">/</span>
                <span className="tc-total">
                  {formatTimecode(project.durationMs)}
                </span>
              </div>
              {stageMetrics && stageMetrics.activeSliceSpeed !== 1 && (
                <span className="speed-indicator">
                  {stageMetrics.activeSliceSpeed}× Slice Speed
                </span>
              )}
            </div>

            <div className="transport-right">
              <button
                className={`live-click-rec-btn ${
                  isLiveTelemetryRecording ? 'active' : ''
                }`}
                onClick={() => {
                  const next = !isLiveTelemetryRecording;
                  setIsLiveTelemetryRecording(next);
                  if (next && !isPlaying) setIsPlaying(true);
                }}
                title="Click anywhere on the canvas while playing to record live cursor telemetry & auto-zoom blocks"
              >
                <CircleDot size={13} />
                <span>
                  {isLiveTelemetryRecording
                    ? 'Recording Canvas Clicks → Auto-Zoom ON'
                    : 'Interactive Click-to-Zoom Recorder'}
                </span>
              </button>

              <button
                className="cmd-k-btn"
                onClick={() => setIsCommandMenuOpen(true)}
              >
                <Command size={12} />
                <span>Command Menu</span>
                <kbd>⌘K</kbd>
              </button>
            </div>
          </div>
        </main>

        {/* 3. RIGHT 6-TAB INSPECTOR PANEL */}
        <InspectorPanel
          project={project}
          activeTab={activeInspectorTab}
          onSelectTab={setActiveInspectorTab}
          onChangeProject={updateProject}
          onTriggerExport={handleStartVideoExport}
          onExportSRT={() => exportCaptionsAsSRT(project)}
          onExportBundle={() => exportScreenStudioBundle(project)}
          isExporting={
            exportState.phase === 'initializing' ||
            exportState.phase === 'exporting' ||
            exportState.phase === 'compiling'
          }
        />
      </div>

      {/* 4. BOTTOM MULTI-TRACK TIMELINE DOCK */}
      <TimelineDock
        project={project}
        currentTimeMs={currentTimeMs}
        selectedBlock={selectedBlock}
        onSeek={(ms) => setCurrentTimeMs(ms)}
        onSelectBlock={setSelectedBlock}
        onChangeProject={updateProject}
      />

      {/* 5. RECORDER HUD MODAL (`polyrecorder-prod`) */}
      <RecorderHudModal
        isOpen={isRecorderHudOpen}
        onClose={() => setIsRecorderHudOpen(false)}
        onStartLiveCapture={({ windowName, screenStream, webcamStream }) => {
          const streams: MediaStream[] = [];
          if (screenStream) streams.push(screenStream);
          if (webcamStream) streams.push(webcamStream);
          activeStreamsRef.current = streams;

          if (screenStream && screenVideoRef.current) {
            screenVideoRef.current.removeAttribute('src');
            screenVideoRef.current.srcObject = screenStream;
            screenVideoRef.current.play().catch(() => {});

            // Record the live MediaStream into chunks for timeline playback after finishing
            try {
              const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
                ? 'video/webm;codecs=vp9'
                : 'video/webm';
              const rec = new MediaRecorder(screenStream, { mimeType: mime });
              liveRecordedChunksRef.current = [];
              rec.ondataavailable = (ev) => {
                if (ev.data && ev.data.size > 0) {
                  liveRecordedChunksRef.current.push(ev.data);
                }
              };
              rec.start(200);
              liveMediaRecorderRef.current = rec;
            } catch {
              liveMediaRecorderRef.current = null;
            }
          }
          if (webcamStream && webcamVideoRef.current) {
            webcamVideoRef.current.removeAttribute('src');
            webcamVideoRef.current.srcObject = webcamStream;
            webcamVideoRef.current.play().catch(() => {});

            // Record the live Webcam MediaStream into chunks for timeline playback after finishing
            try {
              const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
                ? 'video/webm;codecs=vp9'
                : 'video/webm';
              const camRec = new MediaRecorder(webcamStream, { mimeType: mime });
              liveWebcamChunksRef.current = [];
              camRec.ondataavailable = (ev) => {
                if (ev.data && ev.data.size > 0) {
                  liveWebcamChunksRef.current.push(ev.data);
                }
              };
              camRec.start(200);
              liveWebcamRecorderRef.current = camRec;
            } catch {
              liveWebcamRecorderRef.current = null;
            }
          }

          setProject((prev) => ({
            ...prev,
            title: `${windowName}.screenstudio`,
            isDemoProject: false,
            durationMs: 15000,
            recordingSource: {
              ...prev.recordingSource,
              name: windowName,
            },
            slices: [
              {
                id: 'slice-live-rec',
                startMs: 0,
                endMs: 500,
                speed: 1.0,
                typingSpeedUp: false,
                label: `Recording · ${windowName}`,
              },
            ],
            zooms: [],
            masks: [],
            captions: [],
            cameraLayouts: [
              {
                id: 'cam-live-1',
                startMs: 0,
                endMs: 15000,
                layout: 'corner-bl',
                label: 'Corner Bottom-Left',
              },
            ],
            cursorEvents: [
              { timeMs: 0, x: 0.5, y: 0.5, type: 'move', cursorShape: 'arrow' },
            ],
          }));

          setIsRecorderHudOpen(false);
          setIsPlaying(false);
          setCurrentTimeMs(0);
          setIsLiveTelemetryRecording(true);
          setActiveRecSession({
            active: true,
            paused: false,
            elapsedMs: 0,
            windowName,
            markersCount: 0,
          });
        }}
      />

      {/* 6. REA ARCHITECTURE & LIVE TRPC INSPECTOR DRAWER */}
      <ArchitectureDrawer
        isOpen={isArchDrawerOpen}
        onClose={() => setIsArchDrawerOpen(false)}
      />

      {/* 7. COMMAND MENU PALETTE (⌘K) */}
      {isCommandMenuOpen && (
        <div
          className="modal-backdrop"
          onClick={() => setIsCommandMenuOpen(false)}
        >
          <div
            className="cmd-palette-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cmd-palette-header">
              <Command size={15} className="accent-icon" />
              <span>SSStudio Command Menu (`LBoiLCis.js` ActionsManager)</span>
              <button
                className="icon-btn"
                onClick={() => setIsCommandMenuOpen(false)}
              >
                <X size={15} />
              </button>
            </div>
            <div className="cmd-palette-list">
              {[
                {
                  label: 'Add Spring Zoom Block at Playhead',
                  shortcut: 'Z',
                  action: () => {
                    const startMs = Math.min(project.durationMs - 2400, currentTimeMs);
                    updateProject((prev) => ({
                      ...prev,
                      zooms: [
                        ...prev.zooms,
                        {
                          id: `zoom-${Date.now()}`,
                          startMs,
                          endMs: startMs + 2400,
                          scale: 2.0,
                          mode: 'auto-cursor',
                          targetX: 0.5,
                          targetY: 0.5,
                          glassLoupe: false,
                          springPreset: prev.cursorConfig.springPreset,
                        },
                      ],
                    }));
                  },
                },
                {
                  label: 'Toggle Glass Loupe Magnifier on Active Zoom',
                  shortcut: 'L',
                  action: () => {
                    updateProject((prev) => ({
                      ...prev,
                      zooms: prev.zooms.map((z, idx) =>
                        idx === 0 ? { ...z, glassLoupe: !z.glassLoupe } : z
                      ),
                    }));
                  },
                },
                {
                  label: 'Open polyrecorder Capture HUD',
                  shortcut: '⌘R',
                  action: () => setIsRecorderHudOpen(true),
                },
                {
                  label: 'Open REA Architecture & 48-Router tRPC Inspector',
                  shortcut: '⌘I',
                  action: () => setIsArchDrawerOpen(true),
                },
                {
                  label: 'Export Captions as .SRT (`captions.exportTranscriptAsSRT`)',
                  shortcut: '⇧S',
                  action: () => exportCaptionsAsSRT(project),
                },
                {
                  label: 'Render & Download Video (`ActiveExportController`)',
                  shortcut: '⌘E',
                  action: () => handleStartVideoExport(),
                },
              ].map((cmd) => (
                <button
                  key={cmd.label}
                  className="cmd-palette-item"
                  onClick={() => {
                    cmd.action();
                    setIsCommandMenuOpen(false);
                  }}
                >
                  <Maximize2 size={13} />
                  <span>{cmd.label}</span>
                  <kbd>{cmd.shortcut}</kbd>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
