import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  MousePointer,
  Camera,
  Sliders,
  Subtitles,
  Download,
  Volume2,
  Sparkles,
  Wand2,
  FileJson,
  FileText,
  Check,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  AspectRatioId,
  CameraLayoutMode,
  CaptionGeneratorType,
  ClickSoundSetName,
  DeviceFrameType,
  SpringPresetName,
  SSStudioPreset,
  SSStudioProject,
} from '../types/project';
import {
  BUILT_IN_BACKGROUND_AUDIO,
  BUILT_IN_PRESETS,
  WALLPAPER_CATALOG,
} from '../data/catalog';
import { computeSpringCurve, SPRING_PRESETS } from '../engine/springPhysics';
import { invokeTrpc, soundPlayer } from '../bridge/trpcBridge';
import { studioAudioEngine } from '../engine/audioEngine';

const CUSTOM_PRESETS_STORAGE_KEY = 'ssstudio_custom_presets_v1';

export type InspectorTabId =
  | 'background'
  | 'cursor'
  | 'camera'
  | 'audio'
  | 'captions'
  | 'export';

interface InspectorPanelProps {
  project: SSStudioProject;
  activeTab: InspectorTabId;
  onSelectTab: (tab: InspectorTabId) => void;
  onChangeProject: (updater: (prev: SSStudioProject) => SSStudioProject) => void;
  onTriggerExport: () => void;
  onExportSRT: () => void;
  onExportBundle: () => void;
  isExporting: boolean;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  project,
  activeTab,
  onSelectTab,
  onChangeProject,
  onTriggerExport,
  onExportSRT,
  onExportBundle,
  isExporting,
}) => {
  const {
    stageConfig,
    cursorConfig,
    cameraConfig,
    audioConfig,
    captionsConfig,
    exportConfig,
  } = project;

  const [customPresets, setCustomPresets] = useState<SSStudioPreset[]>(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_PRESETS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [newPresetName, setNewPresetName] = useState<string>('');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const updateVoices = () => {
      setVoices(studioAudioEngine.getAvailableVoices());
    };
    updateVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  const springCurve = useMemo(
    () => computeSpringCurve(cursorConfig.customSpring, 1000, 64),
    [cursorConfig.customSpring]
  );

  const applyPreset = (preset: SSStudioPreset) => {
    invokeTrpc('presets.apply', 'mutation', { presetId: preset.id });
    onChangeProject((prev) => ({
      ...prev,
      stageConfig: { ...prev.stageConfig, ...preset.stageConfig },
      cursorConfig: {
        ...prev.cursorConfig,
        ...preset.cursorConfig,
        customSpring: preset.cursorConfig?.springPreset
          ? { ...SPRING_PRESETS[preset.cursorConfig.springPreset] }
          : prev.cursorConfig.customSpring,
      },
      cameraConfig: { ...prev.cameraConfig, ...preset.cameraConfig },
    }));
  };

  const handleSaveCustomPreset = () => {
    const title = newPresetName.trim() || `Custom Studio (${stageConfig.aspectRatio})`;
    const created: SSStudioPreset = {
      id: `preset-custom-${Date.now()}`,
      name: title,
      description: `${stageConfig.aspectRatio} · ${cursorConfig.springPreset} spring · ${stageConfig.deviceFrame}`,
      stageConfig: { ...stageConfig },
      cursorConfig: { ...cursorConfig },
      cameraConfig: { ...cameraConfig },
    };
    invokeTrpc('presets.createFromConfig', 'mutation', { name: title });
    const next = [created, ...customPresets];
    setCustomPresets(next);
    setNewPresetName('');
    try {
      localStorage.setItem(CUSTOM_PRESETS_STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  const handleDeleteCustomPreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    invokeTrpc('presets.delete', 'mutation', { id });
    const next = customPresets.filter((p) => p.id !== id);
    setCustomPresets(next);
    try {
      localStorage.setItem(CUSTOM_PRESETS_STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  return (
    <aside className="inspector-panel">
      {/* 6 Icon-Labeled Domain Tabs */}
      <div className="inspector-tabs">
        {(
          [
            { id: 'background', label: 'Canvas', icon: Image },
            { id: 'cursor', label: 'Cursor', icon: MousePointer },
            { id: 'camera', label: 'Camera', icon: Camera },
            { id: 'audio', label: 'Audio AI', icon: Sliders },
            { id: 'captions', label: 'Captions', icon: Subtitles },
            { id: 'export', label: 'Export', icon: Download },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`inspector-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => onSelectTab(tab.id)}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="inspector-scroll-body">
        {/* TAB 1: BACKGROUND & FRAME */}
        {activeTab === 'background' && (
          <div className="inspector-section-stack">
            <div className="inspector-group">
              <div className="inspector-group-header">
                <span>Wallpaper Collection</span>
                <span className="mono-badge">{WALLPAPER_CATALOG.length} Assets</span>
              </div>
              <div className="wallpaper-grid">
                {WALLPAPER_CATALOG.map((wp) => {
                  const isSelected = stageConfig.wallpaperId === wp.id;
                  return (
                    <button
                      key={wp.id}
                      className={`wallpaper-swatch ${isSelected ? 'selected' : ''}`}
                      style={{
                        background: `linear-gradient(${wp.angle}deg, ${wp.stops[0]}, ${wp.stops[1]}, ${wp.stops[2]})`,
                      }}
                      onClick={() =>
                        onChangeProject((prev) => ({
                          ...prev,
                          stageConfig: { ...prev.stageConfig, wallpaperId: wp.id },
                        }))
                      }
                      title={`${wp.name} (${wp.category})`}
                    >
                      <span className="wallpaper-tag">{wp.category}</span>
                      {isSelected && <Check size={12} className="swatch-check" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="inspector-group">
              <div className="inspector-group-header">
                <span>Stage Geometry & Padding</span>
              </div>

              <div className="control-row">
                <label>Output Aspect Ratio</label>
                <div className="segmented-pills">
                  {(['16:9', '9:16', '1:1', '4:3', '3:4'] as AspectRatioId[]).map(
                    (ratio) => (
                      <button
                        key={ratio}
                        className={`seg-pill ${
                          stageConfig.aspectRatio === ratio ? 'active' : ''
                        }`}
                        onClick={() =>
                          onChangeProject((prev) => ({
                            ...prev,
                            stageConfig: { ...prev.stageConfig, aspectRatio: ratio },
                          }))
                        }
                      >
                        {ratio}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="control-row">
                <div className="control-label-val">
                  <label>Canvas Padding</label>
                  <span>{Math.round(stageConfig.paddingRatio * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.02}
                  max={0.25}
                  step={0.005}
                  value={stageConfig.paddingRatio}
                  onChange={(e) =>
                    onChangeProject((prev) => ({
                      ...prev,
                      stageConfig: {
                        ...prev.stageConfig,
                        paddingRatio: parseFloat(e.target.value),
                      },
                    }))
                  }
                />
              </div>

              <div className="control-row">
                <div className="control-label-val">
                  <label>Window Corner Radius</label>
                  <span>{stageConfig.cornerRadiusPx} px</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={36}
                  step={1}
                  value={stageConfig.cornerRadiusPx}
                  onChange={(e) =>
                    onChangeProject((prev) => ({
                      ...prev,
                      stageConfig: {
                        ...prev.stageConfig,
                        cornerRadiusPx: parseInt(e.target.value, 10),
                      },
                    }))
                  }
                />
              </div>

              <div className="control-row">
                <div className="control-label-val">
                  <label>Elevation Shadow</label>
                  <span>{Math.round(stageConfig.shadowIntensity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={stageConfig.shadowIntensity}
                  onChange={(e) =>
                    onChangeProject((prev) => ({
                      ...prev,
                      stageConfig: {
                        ...prev.stageConfig,
                        shadowIntensity: parseFloat(e.target.value),
                      },
                    }))
                  }
                />
              </div>
            </div>

            <div className="inspector-group">
              <div className="inspector-group-header">
                <span>Device Frame & Border Glow</span>
              </div>
              <div className="segmented-pills">
                {(
                  [
                    { id: 'macos-window', label: 'macOS Chrome' },
                    { id: 'macbook-pro-16', label: 'MacBook Pro' },
                    { id: 'iphone-16-pro', label: 'iPhone 16' },
                    { id: 'ipad-pro-m4', label: 'iPad Pro M4' },
                    { id: 'none', label: 'Frameless' },
                  ] as { id: DeviceFrameType; label: string }[]
                ).map((df) => (
                  <button
                    key={df.id}
                    className={`seg-pill ${
                      stageConfig.deviceFrame === df.id ? 'active' : ''
                    }`}
                    onClick={() =>
                      onChangeProject((prev) => ({
                        ...prev,
                        stageConfig: { ...prev.stageConfig, deviceFrame: df.id },
                      }))
                    }
                  >
                    {df.label}
                  </button>
                ))}
              </div>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={stageConfig.useAdaptiveBorderGlow}
                  onChange={(e) =>
                    onChangeProject((prev) => ({
                      ...prev,
                      stageConfig: {
                        ...prev.stageConfig,
                        useAdaptiveBorderGlow: e.target.checked,
                      },
                    }))
                  }
                />
                <span>
                  Adaptive Video Border Glow (<code>bin/video-border-colors</code>)
                </span>
              </label>
            </div>
          </div>
        )}

        {/* TAB 2: CURSOR & DAMPED HARMONIC SPRING PHYSICS */}
        {activeTab === 'cursor' && (
          <div className="inspector-section-stack">
            <div className="inspector-group">
              <div className="inspector-group-header">
                <span>Damped Harmonic Spring (`Lme` / `Rme`)</span>
                <span className="mono-badge">Settling: {springCurve.settlingMs}ms</span>
              </div>

              <div className="segmented-pills">
                {(
                  ['rapid', 'quick', 'default', 'mellow', 'slow'] as SpringPresetName[]
                ).map((preset) => (
                  <button
                    key={preset}
                    className={`seg-pill ${
                      cursorConfig.springPreset === preset ? 'active' : ''
                    }`}
                    onClick={() =>
                      onChangeProject((prev) => ({
                        ...prev,
                        cursorConfig: {
                          ...prev.cursorConfig,
                          springPreset: preset,
                          customSpring: { ...SPRING_PRESETS[preset] },
                        },
                      }))
                    }
                  >
                    {preset.charAt(0).toUpperCase() + preset.slice(1)}
                  </button>
                ))}
              </div>

              {/* Live SVG Step-Response Curve */}
              <div className="spring-curve-box">
                <svg viewBox="0 0 260 76" className="spring-curve-svg">
                  <line
                    x1="0"
                    y1="18"
                    x2="260"
                    y2="18"
                    stroke="rgba(255,255,255,0.12)"
                    strokeDasharray="3 3"
                  />
                  <polyline
                    fill="none"
                    stroke="#818CF8"
                    strokeWidth="2.2"
                    points={springCurve.points
                      .map((pt) => {
                        const x = (pt.tMs / 1000) * 260;
                        const y = 66 - pt.value * 48;
                        return `${x.toFixed(1)},${y.toFixed(1)}`;
                      })
                      .join(' ')}
                  />
                </svg>
                <div className="spring-curve-caption">
                  <span>k={cursorConfig.customSpring.stiffness}</span>
                  <span>c={cursorConfig.customSpring.damping}</span>
                  <span>m={cursorConfig.customSpring.mass}</span>
                </div>
              </div>

              <div className="control-row">
                <div className="control-label-val">
                  <label>Stiffness (k)</label>
                  <span>{cursorConfig.customSpring.stiffness}</span>
                </div>
                <input
                  type="range"
                  min={30}
                  max={340}
                  step={1}
                  value={cursorConfig.customSpring.stiffness}
                  onChange={(e) =>
                    onChangeProject((prev) => ({
                      ...prev,
                      cursorConfig: {
                        ...prev.cursorConfig,
                        customSpring: {
                          ...prev.cursorConfig.customSpring,
                          stiffness: parseInt(e.target.value, 10),
                        },
                      },
                    }))
                  }
                />
              </div>

              <div className="control-row">
                <div className="control-label-val">
                  <label>Damping (c)</label>
                  <span>{cursorConfig.customSpring.damping}</span>
                </div>
                <input
                  type="range"
                  min={4}
                  max={36}
                  step={1}
                  value={cursorConfig.customSpring.damping}
                  onChange={(e) =>
                    onChangeProject((prev) => ({
                      ...prev,
                      cursorConfig: {
                        ...prev.cursorConfig,
                        customSpring: {
                          ...prev.cursorConfig.customSpring,
                          damping: parseInt(e.target.value, 10),
                        },
                      },
                    }))
                  }
                />
              </div>

              <div className="control-row">
                <div className="control-label-val">
                  <label>Mass (m)</label>
                  <span>{cursorConfig.customSpring.mass.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={3.5}
                  step={0.1}
                  value={cursorConfig.customSpring.mass}
                  onChange={(e) =>
                    onChangeProject((prev) => ({
                      ...prev,
                      cursorConfig: {
                        ...prev.cursorConfig,
                        customSpring: {
                          ...prev.cursorConfig.customSpring,
                          mass: parseFloat(e.target.value),
                        },
                      },
                    }))
                  }
                />
              </div>
            </div>

            <div className="inspector-group">
              <div className="inspector-group-header">
                <span>Cursor Sizing & Motion Blur</span>
              </div>

              <div className="control-row">
                <div className="control-label-val">
                  <label>Cursor Scale (`bin/cursor-rect`)</label>
                  <span>{cursorConfig.sizeScale.toFixed(2)}×</span>
                </div>
                <input
                  type="range"
                  min={0.8}
                  max={3.0}
                  step={0.05}
                  value={cursorConfig.sizeScale}
                  onChange={(e) =>
                    onChangeProject((prev) => ({
                      ...prev,
                      cursorConfig: {
                        ...prev.cursorConfig,
                        sizeScale: parseFloat(e.target.value),
                      },
                    }))
                  }
                />
              </div>

              <div className="control-row">
                <div className="control-label-val">
                  <label>Cursor Motion Blur</label>
                  <span>{Math.round(cursorConfig.motionBlurCursor * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={cursorConfig.motionBlurCursor}
                  onChange={(e) =>
                    onChangeProject((prev) => ({
                      ...prev,
                      cursorConfig: {
                        ...prev.cursorConfig,
                        motionBlurCursor: parseFloat(e.target.value),
                      },
                    }))
                  }
                />
              </div>

              <div className="control-row">
                <div className="control-label-val">
                  <label>Zoom Pan Motion Blur</label>
                  <span>{Math.round(cursorConfig.motionBlurZoom * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={cursorConfig.motionBlurZoom}
                  onChange={(e) =>
                    onChangeProject((prev) => ({
                      ...prev,
                      cursorConfig: {
                        ...prev.cursorConfig,
                        motionBlurZoom: parseFloat(e.target.value),
                      },
                    }))
                  }
                />
              </div>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={cursorConfig.hideWhenIdle}
                  onChange={(e) =>
                    onChangeProject((prev) => ({
                      ...prev,
                      cursorConfig: {
                        ...prev.cursorConfig,
                        hideWhenIdle: e.target.checked,
                      },
                    }))
                  }
                />
                <span>Hide cursor when idle (&gt;1.8s)</span>
              </label>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={cursorConfig.loopCursorPosition}
                  onChange={(e) =>
                    onChangeProject((prev) => ({
                      ...prev,
                      cursorConfig: {
                        ...prev.cursorConfig,
                        loopCursorPosition: e.target.checked,
                      },
                    }))
                  }
                />
                <span>Loop cursor position for seamless video loops</span>
              </label>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={cursorConfig.clickRipple}
                  onChange={(e) =>
                    onChangeProject((prev) => ({
                      ...prev,
                      cursorConfig: {
                        ...prev.cursorConfig,
                        clickRipple: e.target.checked,
                      },
                    }))
                  }
                />
                <span>Show concentric click ripple ring</span>
              </label>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={cursorConfig.highlightCursor}
                  onChange={(e) =>
                    onChangeProject((prev) => ({
                      ...prev,
                      cursorConfig: {
                        ...prev.cursorConfig,
                        highlightCursor: e.target.checked,
                      },
                    }))
                  }
                />
                <span>Cursor spotlight halo</span>
              </label>
            </div>

            <div className="inspector-group">
              <div className="inspector-group-header">
                <span>Click Sound Effect (`assets/sounds/clicks`)</span>
              </div>
              <div className="segmented-pills">
                {(
                  [
                    { id: 'apple-magic-mouse', label: 'Magic Mouse' },
                    { id: 'logitech-mx-master', label: 'MX Master' },
                    { id: 'none', label: 'Muted' },
                  ] as { id: ClickSoundSetName; label: string }[]
                ).map((snd) => (
                  <button
                    key={snd.id}
                    className={`seg-pill ${
                      cursorConfig.clickSoundEffect === snd.id ? 'active' : ''
                    }`}
                    onClick={() => {
                      soundPlayer.playClick(snd.id, 'down');
                      onChangeProject((prev) => ({
                        ...prev,
                        cursorConfig: {
                          ...prev.cursorConfig,
                          clickSoundEffect: snd.id,
                        },
                      }));
                    }}
                  >
                    {snd.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CAMERA & ONNX MATTING */}
        {activeTab === 'camera' && (
          <div className="inspector-section-stack">
            <div className="inspector-group">
              <div className="inspector-group-header">
                <span>Webcam Overlay (`WebcamRecorder`)</span>
                <label className="switch-inline">
                  <input
                    type="checkbox"
                    checked={cameraConfig.enabled}
                    onChange={(e) =>
                      onChangeProject((prev) => ({
                        ...prev,
                        cameraConfig: {
                          ...prev.cameraConfig,
                          enabled: e.target.checked,
                        },
                      }))
                    }
                  />
                  <span>{cameraConfig.enabled ? 'Active' : 'Hidden'}</span>
                </label>
              </div>

              <div className="control-row">
                <label>Default Camera Layout</label>
                <div className="segmented-pills">
                  {(
                    [
                      { id: 'corner-br', label: 'Bottom-R' },
                      { id: 'corner-bl', label: 'Bottom-L' },
                      { id: 'split-screen', label: 'Split' },
                      { id: 'fullscreen', label: 'Full' },
                    ] as { id: CameraLayoutMode; label: string }[]
                  ).map((lay) => (
                    <button
                      key={lay.id}
                      className={`seg-pill ${
                        cameraConfig.defaultLayout === lay.id ? 'active' : ''
                      }`}
                      onClick={() =>
                        onChangeProject((prev) => ({
                          ...prev,
                          cameraConfig: {
                            ...prev.cameraConfig,
                            defaultLayout: lay.id,
                          },
                        }))
                      }
                    >
                      {lay.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="control-row">
                <div className="control-label-val">
                  <label>Camera Size</label>
                  <span>{Math.round(cameraConfig.sizeRatio * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.14}
                  max={0.42}
                  step={0.01}
                  value={cameraConfig.sizeRatio}
                  onChange={(e) =>
                    onChangeProject((prev) => ({
                      ...prev,
                      cameraConfig: {
                        ...prev.cameraConfig,
                        sizeRatio: parseFloat(e.target.value),
                      },
                    }))
                  }
                />
              </div>

              <div className="control-row">
                <div className="control-label-val">
                  <label>Shape Roundness (Squircle → Circle)</label>
                  <span>{Math.round(cameraConfig.roundness * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.05}
                  max={0.5}
                  step={0.01}
                  value={cameraConfig.roundness}
                  onChange={(e) =>
                    onChangeProject((prev) => ({
                      ...prev,
                      cameraConfig: {
                        ...prev.cameraConfig,
                        roundness: parseFloat(e.target.value),
                      },
                    }))
                  }
                />
              </div>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={cameraConfig.mirror}
                  onChange={(e) =>
                    onChangeProject((prev) => ({
                      ...prev,
                      cameraConfig: {
                        ...prev.cameraConfig,
                        mirror: e.target.checked,
                      },
                    }))
                  }
                />
                <span>Mirror horizontal webcam feed</span>
              </label>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={cameraConfig.autoFaceCenter}
                  onChange={(e) => {
                    invokeTrpc('project.faceBounds', 'query', {
                      projectId: project.id,
                    });
                    onChangeProject((prev) => ({
                      ...prev,
                      cameraConfig: {
                        ...prev.cameraConfig,
                        autoFaceCenter: e.target.checked,
                      },
                    }));
                  }}
                />
                <span>
                  Auto Face-Framing (<code>bin/face-detector</code> Vision.framework)
                </span>
              </label>
            </div>

            <div className="inspector-group">
              <div className="inspector-group-header">
                <span>AI Portrait Matting (`assets/models/*.onnx`)</span>
              </div>
              <div className="segmented-pills">
                {(
                  [
                    { id: 'pp-mattingv2-fp16', label: 'PP-MattingV2 FP16' },
                    { id: 'ssmatte-v1-s1c', label: 'SSMatte v1' },
                    { id: 'none', label: 'Raw Camera' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    className={`seg-pill ${
                      cameraConfig.aiMattingModel === m.id ? 'active' : ''
                    }`}
                    onClick={() =>
                      onChangeProject((prev) => ({
                        ...prev,
                        cameraConfig: {
                          ...prev.cameraConfig,
                          aiMattingModel: m.id,
                        },
                      }))
                    }
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <p className="inspector-helper-note">
                Runs <code>ort-wasm-simd-threaded.asyncify.wasm</code> +{' '}
                <code>bin/segment-video</code> to isolate the presenter from the room.
              </p>
            </div>
          </div>
        )}

        {/* TAB 4: AUDIO & MLX NATIVE-AUDIO.NODE */}
        {activeTab === 'audio' && (
          <div className="inspector-section-stack">
            <div className="inspector-group">
              <div className="inspector-group-header">
                <span>`native-audio.node` Neural Speech Chain</span>
                <span className="mono-badge">CoreML + MLX</span>
              </div>

              <label className="checkbox-row highlight-box">
                <input
                  type="checkbox"
                  checked={audioConfig.mossFormer2NoiseReduction}
                  onChange={(e) => {
                    invokeTrpc('media.renderAudio', 'query', {
                      mossFormer2: e.target.checked,
                    });
                    onChangeProject((prev) => ({
                      ...prev,
                      audioConfig: {
                        ...prev.audioConfig,
                        mossFormer2NoiseReduction: e.target.checked,
                      },
                    }));
                  }}
                />
                <div>
                  <strong>MossFormer2 48kHz Speech Enhancement</strong>
                  <small>
                    <code>MossFormer2_SE_48K_masker_float16_w12_b6.mlmodelc</code>
                  </small>
                </div>
              </label>

              <label className="checkbox-row highlight-box">
                <input
                  type="checkbox"
                  checked={audioConfig.tfRestormerSpeechRestore}
                  onChange={(e) => {
                    invokeTrpc('media.renderAudio', 'query', {
                      tfRestormer: e.target.checked,
                    });
                    onChangeProject((prev) => ({
                      ...prev,
                      audioConfig: {
                        ...prev.audioConfig,
                        tfRestormerSpeechRestore: e.target.checked,
                      },
                    }));
                  }}
                />
                <div>
                  <strong>TF-Restormer GPU Speech Super-Resolution</strong>
                  <small>
                    <code>tf-restormer.safetensors</code> via Apple <code>mlx.metallib</code>
                  </small>
                </div>
              </label>

              <div className="control-row">
                <div className="control-label-val">
                  <label>Restore Sibilance (`restoreSibilance`)</label>
                  <span>{Math.round(audioConfig.restoreSibilance * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={audioConfig.restoreSibilance}
                  onChange={(e) =>
                    onChangeProject((prev) => ({
                      ...prev,
                      audioConfig: {
                        ...prev.audioConfig,
                        restoreSibilance: parseFloat(e.target.value),
                      },
                    }))
                  }
                />
              </div>
            </div>

            {/* Apple AudioUnit (aufx) Rack */}
            <div className="inspector-group">
              <div className="inspector-group-header">
                <span>Apple AudioToolbox (`aufx/*`) DSP Chain</span>
              </div>
              <div className="aufx-list">
                {audioConfig.audioUnits.map((unit) => (
                  <div key={unit.id} className="aufx-item">
                    <label className="aufx-top">
                      <input
                        type="checkbox"
                        checked={unit.enabled}
                        onChange={(e) =>
                          onChangeProject((prev) => ({
                            ...prev,
                            audioConfig: {
                              ...prev.audioConfig,
                              audioUnits: prev.audioConfig.audioUnits.map((u) =>
                                u.id === unit.id
                                  ? { ...u, enabled: e.target.checked }
                                  : u
                              ),
                            },
                          }))
                        }
                      />
                      <span className="aufx-name">{unit.name}</span>
                      <code className="aufx-code">{unit.id}</code>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* 17 Built-in Background Music Tracks */}
            <div className="inspector-group">
              <div className="inspector-group-header">
                <span>Background Music (`assets/background-audio`)</span>
                <span className="mono-badge">17 Tracks</span>
              </div>
              <select
                className="studio-select"
                value={audioConfig.backgroundTrackId ?? ''}
                onChange={(e) =>
                  onChangeProject((prev) => ({
                    ...prev,
                    audioConfig: {
                      ...prev.audioConfig,
                      backgroundTrackId: e.target.value || null,
                    },
                  }))
                }
              >
                <option value="">None (No Background Music)</option>
                {BUILT_IN_BACKGROUND_AUDIO.map((tr) => (
                  <option key={tr.id} value={tr.id}>
                    [{tr.category.toUpperCase()}] {tr.title} ({tr.bpm} BPM)
                  </option>
                ))}
              </select>

              <div className="control-row">
                <div className="control-label-val">
                  <label>Background Track Mix</label>
                  <span>{Math.round(audioConfig.backgroundTrackVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={0.6}
                  step={0.02}
                  value={audioConfig.backgroundTrackVolume}
                  onChange={(e) =>
                    onChangeProject((prev) => ({
                      ...prev,
                      audioConfig: {
                        ...prev.audioConfig,
                        backgroundTrackVolume: parseFloat(e.target.value),
                      },
                    }))
                  }
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: CAPTIONS & AI VOICEOVER */}
        {activeTab === 'captions' && (
          <div className="inspector-section-stack">
            <div className="inspector-group">
              <div className="inspector-group-header">
                <span>Speech-to-Text Engine (`DNe` Router)</span>
                <label className="switch-inline">
                  <input
                    type="checkbox"
                    checked={captionsConfig.enabled}
                    onChange={(e) =>
                      onChangeProject((prev) => ({
                        ...prev,
                        captionsConfig: {
                          ...prev.captionsConfig,
                          enabled: e.target.checked,
                        },
                      }))
                    }
                  />
                  <span>{captionsConfig.enabled ? 'Visible' : 'Hidden'}</span>
                </label>
              </div>

              <div className="segmented-pills">
                {(
                  [
                    { id: 'whisper', label: 'Whisper arm64' },
                    { id: 'system', label: 'macOS Speech' },
                    { id: 'elevenlabs', label: 'ElevenLabs' },
                  ] as { id: CaptionGeneratorType; label: string }[]
                ).map((gen) => (
                  <button
                    key={gen.id}
                    className={`seg-pill ${
                      captionsConfig.generator === gen.id ? 'active' : ''
                    }`}
                    onClick={() => {
                      invokeTrpc('captions.generateAll', 'mutation', {
                        type: gen.id,
                      });
                      onChangeProject((prev) => ({
                        ...prev,
                        captionsConfig: {
                          ...prev.captionsConfig,
                          generator: gen.id,
                        },
                      }));
                    }}
                  >
                    {gen.label}
                  </button>
                ))}
              </div>

              <div className="control-row">
                <label>Caption Visual Style</label>
                <div className="segmented-pills">
                  {(
                    [
                      { id: 'karaoke-highlight', label: 'Karaoke' },
                      { id: 'glass-pill', label: 'Glass Pill' },
                      { id: 'editorial-serif', label: 'Instrument Serif' },
                    ] as const
                  ).map((st) => (
                    <button
                      key={st.id}
                      className={`seg-pill ${
                        captionsConfig.style === st.id ? 'active' : ''
                      }`}
                      onClick={() =>
                        onChangeProject((prev) => ({
                          ...prev,
                          captionsConfig: {
                            ...prev.captionsConfig,
                            style: st.id,
                          },
                        }))
                      }
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="control-row">
                <div className="control-label-val">
                  <label>Caption Font Scale</label>
                  <span>{Math.round(captionsConfig.fontSizeScale * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.75}
                  max={1.45}
                  step={0.05}
                  value={captionsConfig.fontSizeScale}
                  onChange={(e) =>
                    onChangeProject((prev) => ({
                      ...prev,
                      captionsConfig: {
                        ...prev.captionsConfig,
                        fontSizeScale: parseFloat(e.target.value),
                      },
                    }))
                  }
                />
              </div>

              <button className="btn-secondary full-width" onClick={onExportSRT}>
                <FileText size={14} />
                <span>Export Captions as .SRT (`captions.exportTranscriptAsSRT`)</span>
              </button>
            </div>

            <div className="inspector-group">
              <div className="inspector-group-header">
                <span>Transcript Segments ({project.captions.length})</span>
              </div>
              <div className="caption-editor-list">
                {project.captions.map((cap) => (
                  <div key={cap.id} className="caption-edit-card">
                    <div className="caption-edit-meta">
                      <span>
                        {(cap.startMs / 1000).toFixed(1)}s – {(cap.endMs / 1000).toFixed(1)}s
                      </span>
                      <span className={`proc-chip ${cap.type === 'sound-label' ? 'subscription' : 'query'}`}>
                        {cap.type === 'sound-label' ? 'SoundAnalysis' : cap.generator}
                      </span>
                    </div>
                    <input
                      type="text"
                      className="caption-input"
                      value={cap.text}
                      onChange={(e) =>
                        onChangeProject((prev) => ({
                          ...prev,
                          captions: prev.captions.map((c) =>
                            c.id === cap.id ? { ...c, text: e.target.value } : c
                          ),
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: EXPORT & PRESETS */}
        {activeTab === 'export' && (
          <div className="inspector-section-stack">
            <div className="inspector-group">
              <div className="inspector-group-header">
                <span>Studio Presets (`.screenstudiopreset`)</span>
              </div>
              <div className="preset-cards-stack">
                {BUILT_IN_PRESETS.map((pr) => (
                  <button
                    key={pr.id}
                    className="preset-card-btn"
                    onClick={() => applyPreset(pr)}
                  >
                    <div className="preset-card-title">
                      <Wand2 size={13} className="accent-icon" />
                      <span>{pr.name}</span>
                    </div>
                    <div className="preset-card-desc">{pr.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="inspector-group">
              <div className="inspector-group-header">
                <span>Export Pipeline (`ActiveExportController`)</span>
              </div>

              <div className="control-row">
                <label>Output Container & Codec</label>
                <div className="segmented-pills">
                  {(
                    [
                      { id: 'mp4', label: 'MP4 (H.264/HEVC)' },
                      { id: 'webm', label: 'WebM (VP9)' },
                      { id: 'gif', label: 'Studio GIF' },
                    ] as const
                  ).map((fmt) => (
                    <button
                      key={fmt.id}
                      className={`seg-pill ${
                        exportConfig.format === fmt.id ? 'active' : ''
                      }`}
                      onClick={() =>
                        onChangeProject((prev) => ({
                          ...prev,
                          exportConfig: { ...prev.exportConfig, format: fmt.id },
                        }))
                      }
                    >
                      {fmt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="control-row">
                <label>Resolution</label>
                <div className="segmented-pills">
                  {(['4k', '1080p', '720p'] as const).map((res) => (
                    <button
                      key={res}
                      className={`seg-pill ${
                        exportConfig.resolution === res ? 'active' : ''
                      }`}
                      onClick={() =>
                        onChangeProject((prev) => ({
                          ...prev,
                          exportConfig: { ...prev.exportConfig, resolution: res },
                        }))
                      }
                    >
                      {res.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="control-row">
                <label>Target Frame Rate</label>
                <div className="segmented-pills">
                  {([30, 60, 120] as const).map((fps) => (
                    <button
                      key={fps}
                      className={`seg-pill ${
                        exportConfig.fps === fps ? 'active' : ''
                      }`}
                      onClick={() =>
                        onChangeProject((prev) => ({
                          ...prev,
                          exportConfig: { ...prev.exportConfig, fps },
                        }))
                      }
                    >
                      {fps} FPS
                    </button>
                  ))}
                </div>
              </div>

              <button
                className="btn-export-CTA full-width"
                disabled={isExporting}
                onClick={onTriggerExport}
              >
                <Sparkles size={15} />
                <span>
                  {isExporting
                    ? 'Rendering Frames in Worker...'
                    : `Render & Download (${exportConfig.resolution.toUpperCase()} · ${exportConfig.fps} FPS)`}
                </span>
              </button>

              <button
                className="btn-secondary full-width"
                onClick={onExportBundle}
              >
                <FileJson size={14} />
                <span>Save `.screenstudio` Project Bundle</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
