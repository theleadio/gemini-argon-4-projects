import React, { useEffect, useState } from 'react';
import {
  Monitor,
  AppWindow,
  Smartphone,
  Crop,
  Camera,
  Mic,
  Volume2,
  CircleDot,
  Sparkles,
  Check,
  X,
  EyeOff,
  FileText,
} from 'lucide-react';
import {
  CapturableWindowInfo,
  invokeTrpc,
  isElectronRuntime,
  soundPlayer,
} from '../bridge/trpcBridge';

interface RecorderHudModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartLiveCapture: (options: {
    mode: 'display' | 'window' | 'area' | 'device';
    windowName: string;
    screenStream: MediaStream | null;
    webcamStream: MediaStream | null;
  }) => void;
}

export const RecorderHudModal: React.FC<RecorderHudModalProps> = ({
  isOpen,
  onClose,
  onStartLiveCapture,
}) => {
  const [captureMode, setCaptureMode] = useState<'display' | 'window' | 'area' | 'device'>('window');
  const [windows, setWindows] = useState<CapturableWindowInfo[]>([]);
  const [selectedWindowId, setSelectedWindowId] = useState<number>(401);
  const [enableCamera, setEnableCamera] = useState(true);
  const [enableMic, setEnableMic] = useState(true);
  const [enableSystemAudio, setEnableSystemAudio] = useState(true);
  const [hideDesktopIcons, setHideDesktopIcons] = useState(true);
  const [showSpeakerNotes, setShowSpeakerNotes] = useState(false);
  const [speakerNotes, setSpeakerNotes] = useState(
    '1. Open /Applications/Screen Studio.app in REA\n2. Inspect polyrecorder-prod Swift types\n3. Show MossFormer2 + MLX TF-Restormer audio chain'
  );
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [screenPermStatus, setScreenPermStatus] = useState<string>('granted');

  useEffect(() => {
    if (!isOpen) return;
    invokeTrpc<{ screen?: string }>('permissions.check', 'query').then((res) => {
      if (res?.screen) setScreenPermStatus(res.screen);
    });
    invokeTrpc<CapturableWindowInfo[]>('windows.capturableWindows', 'query').then(
      (list) => {
        if (Array.isArray(list) && list.length > 0) {
          setWindows(list);
          setSelectedWindowId(list[0].id);
        }
      }
    );
  }, [isOpen]);

  if (!isOpen) return null;

  const selectedWindow =
    windows.find((w) => w.id === selectedWindowId) ?? windows[0];

  const handleStartBrowserScreenCapture = async () => {
    setStatusMsg('Running capture.preRecordingCheck...');
    await invokeTrpc('capture.preRecordingCheck', 'mutation', {
      mode: captureMode,
      windowId: selectedWindowId,
      sourceId: selectedWindow?.sourceId ?? null,
      hideDesktopIcons,
    });

    let screenStream: MediaStream | null = null;
    let webcamStream: MediaStream | null = null;

    // 1. Primary path: standard getDisplayMedia (handled in Electron by setDisplayMediaRequestHandler)
    if (navigator.mediaDevices?.getDisplayMedia) {
      try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });
      } catch {
        // Fallback below
      }
    }

    // 2. Fallback: Electron chromeMediaSource: 'desktop' constraint
    if (
      !screenStream &&
      isElectronRuntime() &&
      selectedWindow?.sourceId &&
      navigator.mediaDevices?.getUserMedia
    ) {
      try {
        screenStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: selectedWindow.sourceId,
              minWidth: 1280,
              maxWidth: 3840,
              minHeight: 720,
              maxHeight: 2160,
            },
          } as unknown as MediaTrackConstraints,
        });
      } catch {
        // Proceed with interactive canvas recording if screen permission is not yet granted
      }
    }

    if (enableCamera && navigator.mediaDevices?.getUserMedia) {
      try {
        webcamStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 640 },
          audio: false,
        });
      } catch {
        // Fallback to stylized studio avatar
      }
    }

    soundPlayer.playRecordChime('begin');
    await invokeTrpc('capture.start', 'mutation', {
      mode: captureMode,
      windowId: selectedWindowId,
      camera: enableCamera,
      mic: enableMic,
      systemAudio: enableSystemAudio,
    });

    onStartLiveCapture({
      mode: captureMode,
      windowName:
        captureMode === 'device'
          ? 'iPhone 16 Pro (RecordKit USB DAL)'
          : selectedWindow?.name ?? 'Built-in Liquid Retina XDR Display',
      screenStream,
      webcamStream,
    });
    setStatusMsg(null);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="recorder-hud-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="hud-header">
          <div className="hud-title-row">
            <span className="hud-rec-dot" />
            <div>
              <div className="hud-title">polyrecorder-prod · Capture HUD</div>
              <div className="hud-subtitle">
                ScreenCaptureKit + RecordKit CoreMediaIO DAL + InputRecorder Telemetry
              </div>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} title="Close HUD">
            <X size={16} />
          </button>
        </div>

        {/* 4 Capture Target Modes */}
        <div className="hud-mode-grid">
          <button
            className={`hud-mode-btn ${captureMode === 'display' ? 'active' : ''}`}
            onClick={() => setCaptureMode('display')}
          >
            <Monitor size={18} />
            <span>Full Display</span>
            <small>SCDisplay</small>
          </button>
          <button
            className={`hud-mode-btn ${captureMode === 'window' ? 'active' : ''}`}
            onClick={() => setCaptureMode('window')}
          >
            <AppWindow size={18} />
            <span>Specific Window</span>
            <small>SCWindow</small>
          </button>
          <button
            className={`hud-mode-btn ${captureMode === 'area' ? 'active' : ''}`}
            onClick={() => setCaptureMode('area')}
          >
            <Crop size={18} />
            <span>Screen Area</span>
            <small>CropRect</small>
          </button>
          <button
            className={`hud-mode-btn ${captureMode === 'device' ? 'active' : ''}`}
            onClick={() => setCaptureMode('device')}
          >
            <Smartphone size={18} />
            <span>iPhone / iPad</span>
            <small>MobileDevice</small>
          </button>
        </div>

        {/* Target Window / Device Selector */}
        <div className="hud-section">
          <div className="hud-section-label">
            <span>
              {captureMode === 'device'
                ? 'External iOS Device (RecordKit.AppleMobileDevice)'
                : 'Capturable Windows (bin/list-windows)'}
            </span>
            <span className="mono-badge">120 Hz ProMotion</span>
          </div>
          <div className="hud-window-list">
            {windows.map((win) => (
              <button
                key={win.id}
                className={`hud-window-item ${
                  selectedWindowId === win.id ? 'selected' : ''
                }`}
                onClick={() => setSelectedWindowId(win.id)}
              >
                <div className="hud-window-row-left">
                  {win.thumbnailDataUrl && (
                    <img
                      src={win.thumbnailDataUrl}
                      alt=""
                      className="hud-window-thumb"
                    />
                  )}
                  <div className="hud-window-meta">
                    <span className="hud-window-name">{win.name}</span>
                    <span className="hud-window-bundle">
                      {win.bundleId} · {win.bounds.width}×{win.bounds.height}
                    </span>
                  </div>
                </div>
                {selectedWindowId === win.id && (
                  <Check size={15} className="accent-icon" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Peripheral & Utility Toggles */}
        <div className="hud-toggles-row">
          <button
            className={`hud-pill-toggle ${enableCamera ? 'on' : ''}`}
            onClick={() => setEnableCamera((v) => !v)}
          >
            <Camera size={14} />
            <span>FaceTime HD Camera</span>
          </button>
          <button
            className={`hud-pill-toggle ${enableMic ? 'on' : ''}`}
            onClick={() => setEnableMic((v) => !v)}
          >
            <Mic size={14} />
            <span>Studio Mic (MossFormer2)</span>
          </button>
          <button
            className={`hud-pill-toggle ${enableSystemAudio ? 'on' : ''}`}
            onClick={() => setEnableSystemAudio((v) => !v)}
          >
            <Volume2 size={14} />
            <span>macOS System Audio</span>
          </button>
          <button
            className={`hud-pill-toggle ${hideDesktopIcons ? 'on' : ''}`}
            onClick={() => {
              const next = !hideDesktopIcons;
              setHideDesktopIcons(next);
              invokeTrpc('system.setDesktopVisibility', 'mutation', {
                visible: !next,
              });
            }}
          >
            <EyeOff size={14} />
            <span>Hide Desktop Icons</span>
          </button>
          <button
            className={`hud-pill-toggle ${showSpeakerNotes ? 'on' : ''}`}
            onClick={() => setShowSpeakerNotes((v) => !v)}
          >
            <FileText size={14} />
            <span>Speaker Notes</span>
          </button>
        </div>

        {showSpeakerNotes && (
          <div className="hud-speaker-notes">
            <label>Floating Teleprompter / Speaker Notes (excluded from SCStream via contentProtection)</label>
            <textarea
              value={speakerNotes}
              onChange={(e) => setSpeakerNotes(e.target.value)}
              rows={3}
            />
          </div>
        )}

        {screenPermStatus !== 'granted' && (
          <div className="hud-status-banner">
            <span>
              macOS Screen Recording permission status: <strong>{screenPermStatus}</strong>. Grant permission to Terminal/Electron so macOS allows screen capture:
            </span>
            <button
              className="tl-action-btn accent"
              style={{ marginLeft: 8 }}
              onClick={() => invokeTrpc('permissions.request', 'mutation')}
            >
              Open macOS Privacy Settings
            </button>
          </div>
        )}

        {statusMsg && <div className="hud-status-banner">{statusMsg}</div>}

        <div className="hud-footer">
          <div className="hud-footer-hint">
            <Sparkles size={13} />
            <span>
              Logs cursor clicks & focus events at 120 Hz for automatic spring zoom blocks
            </span>
          </div>
          <div className="hud-footer-actions">
            <button className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn-record-primary"
              onClick={handleStartBrowserScreenCapture}
            >
              <CircleDot size={15} />
              <span>Start Recording</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
