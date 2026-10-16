import React, { useRef, useState } from 'react';
import {
  ZoomIn,
  Scissors,
  ShieldAlert,
  Camera,
  Subtitles,
  Film,
  Plus,
  Trash2,
  FastForward,
  Sparkles,
  Search,
  Volume2,
} from 'lucide-react';
import {
  CameraLayoutBlock,
  CameraLayoutMode,
  CaptionSegment,
  MaskBlock,
  SliceBlock,
  SpringPresetName,
  SSStudioProject,
  ZoomBlock,
} from '../types/project';
import { invokeTrpc } from '../bridge/trpcBridge';
import { studioAudioEngine } from '../engine/audioEngine';

export type SelectedBlockRef =
  | { kind: 'zoom'; id: string }
  | { kind: 'slice'; id: string }
  | { kind: 'camera'; id: string }
  | { kind: 'mask'; id: string }
  | { kind: 'caption'; id: string }
  | null;

interface TimelineDockProps {
  project: SSStudioProject;
  currentTimeMs: number;
  selectedBlock: SelectedBlockRef;
  onSeek: (timeMs: number) => void;
  onSelectBlock: (sel: SelectedBlockRef) => void;
  onChangeProject: (updater: (prev: SSStudioProject) => SSStudioProject) => void;
}

export const TimelineDock: React.FC<TimelineDockProps> = ({
  project,
  currentTimeMs,
  selectedBlock,
  onSeek,
  onSelectBlock,
  onChangeProject,
}) => {
  const trackAreaRef = useRef<HTMLDivElement | null>(null);
  const [silenceToast, setSilenceToast] = useState<string | null>(null);

  const {
    durationMs,
    slices,
    zooms,
    cameraLayouts,
    masks,
    captions,
    cursorEvents,
    audioWaveform,
  } = project;

  const pct = (ms: number) =>
    `${Math.max(0, Math.min(100, (ms / durationMs) * 100))}%`;
  const widthPct = (startMs: number, endMs: number) =>
    `${Math.max(1.2, ((endMs - startMs) / durationMs) * 100)}%`;

  const handleRulerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = trackAreaRef.current;
    if (!el) return;
    const updateFromClientX = (clientX: number) => {
      const rect = el.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      onSeek(ratio * durationMs);
    };
    updateFromClientX(e.clientX);

    const onMove = (moveEv: PointerEvent) => updateFromClientX(moveEv.clientX);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  /**
   * Interactive drag & trim handler for any timeline block (`move` | `trim-start` | `trim-end`).
   */
  const startBlockDragOrTrim = (
    e: React.PointerEvent,
    kind: NonNullable<SelectedBlockRef>['kind'],
    id: string,
    initialStartMs: number,
    initialEndMs: number,
    mode: 'move' | 'trim-start' | 'trim-end'
  ) => {
    e.stopPropagation();
    onSelectBlock({ kind, id });

    const el = trackAreaRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const startClientX = e.clientX;
    const blockSpan = Math.max(300, initialEndMs - initialStartMs);
    const minDuration = 350;

    const applyRange = (newStart: number, newEnd: number) => {
      const s = Math.round(newStart);
      const end = Math.round(newEnd);
      onChangeProject((prev) => {
        if (kind === 'zoom') {
          return {
            ...prev,
            zooms: prev.zooms.map((b) =>
              b.id === id ? { ...b, startMs: s, endMs: end } : b
            ),
          };
        }
        if (kind === 'slice') {
          return {
            ...prev,
            slices: prev.slices.map((b) =>
              b.id === id ? { ...b, startMs: s, endMs: end } : b
            ),
          };
        }
        if (kind === 'camera') {
          return {
            ...prev,
            cameraLayouts: prev.cameraLayouts.map((b) =>
              b.id === id ? { ...b, startMs: s, endMs: end } : b
            ),
          };
        }
        if (kind === 'mask') {
          return {
            ...prev,
            masks: prev.masks.map((b) =>
              b.id === id ? { ...b, startMs: s, endMs: end } : b
            ),
          };
        }
        if (kind === 'caption') {
          return {
            ...prev,
            captions: prev.captions.map((b) =>
              b.id === id ? { ...b, startMs: s, endMs: end } : b
            ),
          };
        }
        return prev;
      });
    };

    const onMove = (moveEv: PointerEvent) => {
      const dxPx = moveEv.clientX - startClientX;
      if (Math.abs(dxPx) < 2) return;
      const dtMs = (dxPx / Math.max(1, rect.width)) * durationMs;

      if (mode === 'move') {
        const clampedStart = Math.max(
          0,
          Math.min(durationMs - blockSpan, initialStartMs + dtMs)
        );
        applyRange(clampedStart, clampedStart + blockSpan);
      } else if (mode === 'trim-start') {
        const clampedStart = Math.max(
          0,
          Math.min(initialEndMs - minDuration, initialStartMs + dtMs)
        );
        applyRange(clampedStart, initialEndMs);
      } else {
        const clampedEnd = Math.max(
          initialStartMs + minDuration,
          Math.min(durationMs, initialEndMs + dtMs)
        );
        applyRange(initialStartMs, clampedEnd);
      }
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const addZoomAtPlayhead = () => {
    const startMs = Math.max(0, Math.min(durationMs - 2400, currentTimeMs));
    const endMs = Math.min(durationMs, startMs + 2400);
    const newZoom: ZoomBlock = {
      id: `zoom-${Date.now()}`,
      startMs,
      endMs,
      scale: 1.95,
      mode: 'auto-cursor',
      targetX: 0.5,
      targetY: 0.5,
      glassLoupe: false,
      springPreset: project.cursorConfig.springPreset,
    };
    onChangeProject((prev) => ({
      ...prev,
      zooms: [...prev.zooms, newZoom],
    }));
    onSelectBlock({ kind: 'zoom', id: newZoom.id });
  };

  const splitSliceAtPlayhead = () => {
    const target = slices.find(
      (s) => currentTimeMs > s.startMs + 400 && currentTimeMs < s.endMs - 400
    );
    if (!target) return;
    const firstHalf: SliceBlock = {
      ...target,
      endMs: Math.round(currentTimeMs),
    };
    const secondHalf: SliceBlock = {
      ...target,
      id: `slice-${Date.now()}`,
      startMs: Math.round(currentTimeMs),
      label: `${target.label} (Split)`,
    };
    onChangeProject((prev) => ({
      ...prev,
      slices: prev.slices.flatMap((s) =>
        s.id === target.id ? [firstHalf, secondHalf] : [s]
      ),
    }));
    onSelectBlock({ kind: 'slice', id: secondHalf.id });
  };

  const addMaskAtPlayhead = () => {
    const startMs = Math.max(0, Math.min(durationMs - 3000, currentTimeMs));
    const endMs = Math.min(durationMs, startMs + 3000);
    const newMask: MaskBlock = {
      id: `mask-${Date.now()}`,
      startMs,
      endMs,
      x: 0.35,
      y: 0.25,
      width: 0.3,
      height: 0.14,
      style: 'blur',
      intensity: 14,
      label: 'Sensitive UI Region',
      trackShift: true,
    };
    invokeTrpc('mask.detectMaskedContentShift', 'mutation', { maskId: newMask.id });
    onChangeProject((prev) => ({
      ...prev,
      masks: [...prev.masks, newMask],
    }));
    onSelectBlock({ kind: 'mask', id: newMask.id });
  };

  const addCameraLayoutAtPlayhead = () => {
    const startMs = Math.max(0, Math.min(durationMs - 2600, currentTimeMs));
    const endMs = Math.min(durationMs, startMs + 2600);
    const newCam: CameraLayoutBlock = {
      id: `cam-${Date.now()}`,
      startMs,
      endMs,
      layout: 'fullscreen',
      label: 'Fullscreen Presenter',
    };
    onChangeProject((prev) => ({
      ...prev,
      cameraLayouts: [...prev.cameraLayouts, newCam],
    }));
    onSelectBlock({ kind: 'camera', id: newCam.id });
  };

  const addCaptionAtPlayhead = () => {
    const startMs = Math.max(0, Math.min(durationMs - 2400, currentTimeMs));
    const endMs = Math.min(durationMs, startMs + 2400);
    const newCap: CaptionSegment = {
      id: `cap-${Date.now()}`,
      startMs,
      endMs,
      text: 'New synchronized transcript caption segment',
      confidence: 0.99,
      generator: project.captionsConfig.generator,
      type: 'speech',
    };
    onChangeProject((prev) => ({
      ...prev,
      captions: [...prev.captions, newCap],
    }));
    onSelectBlock({ kind: 'caption', id: newCap.id });
  };

  const handleDetectSilence = async () => {
    const result = await studioAudioEngine.detectAndSplitSilences(project);
    onChangeProject((prev) => ({
      ...prev,
      slices: result.updatedSlices,
    }));
    const firstSilence = result.updatedSlices.find((s) => s.speed > 1);
    if (firstSilence) {
      onSelectBlock({ kind: 'slice', id: firstSilence.id });
    }
    setSilenceToast(
      `Detected ${result.silentRanges.length} silent interval(s) → auto-split & set to 2.5× speed`
    );
    window.setTimeout(() => setSilenceToast(null), 3600);
  };

  const deleteSelectedBlock = () => {
    if (!selectedBlock) return;
    onChangeProject((prev) => {
      if (selectedBlock.kind === 'zoom') {
        return { ...prev, zooms: prev.zooms.filter((z) => z.id !== selectedBlock.id) };
      }
      if (selectedBlock.kind === 'mask') {
        return { ...prev, masks: prev.masks.filter((m) => m.id !== selectedBlock.id) };
      }
      if (selectedBlock.kind === 'camera') {
        return {
          ...prev,
          cameraLayouts: prev.cameraLayouts.filter((c) => c.id !== selectedBlock.id),
        };
      }
      if (selectedBlock.kind === 'caption') {
        return {
          ...prev,
          captions: prev.captions.filter((c) => c.id !== selectedBlock.id),
        };
      }
      if (selectedBlock.kind === 'slice' && prev.slices.length > 1) {
        return {
          ...prev,
          slices: prev.slices.filter((s) => s.id !== selectedBlock.id),
        };
      }
      return prev;
    });
    onSelectBlock(null);
  };

  const selectedZoom =
    selectedBlock?.kind === 'zoom'
      ? zooms.find((z) => z.id === selectedBlock.id) ?? null
      : null;

  const selectedSlice =
    selectedBlock?.kind === 'slice'
      ? slices.find((s) => s.id === selectedBlock.id) ?? null
      : null;

  const selectedMask =
    selectedBlock?.kind === 'mask'
      ? masks.find((m) => m.id === selectedBlock.id) ?? null
      : null;

  const selectedCamera =
    selectedBlock?.kind === 'camera'
      ? cameraLayouts.find((c) => c.id === selectedBlock.id) ?? null
      : null;

  const selectedCaption =
    selectedBlock?.kind === 'caption'
      ? captions.find((c) => c.id === selectedBlock.id) ?? null
      : null;

  return (
    <section className="timeline-dock">
      {/* Contextual Sub-Editor Bar (Zoom / Slice / Mask / Camera / Caption Editor) */}
      <div className="timeline-toolbar">
        <div className="timeline-actions-left">
          <button className="tl-action-btn accent" onClick={addZoomAtPlayhead}>
            <Plus size={13} />
            <ZoomIn size={13} />
            <span>Add Zoom</span>
          </button>
          <button className="tl-action-btn" onClick={splitSliceAtPlayhead}>
            <Scissors size={13} />
            <span>Split Clip</span>
          </button>
          <button className="tl-action-btn" onClick={addMaskAtPlayhead}>
            <ShieldAlert size={13} />
            <span>+ Mask</span>
          </button>
          <button className="tl-action-btn" onClick={addCameraLayoutAtPlayhead}>
            <Camera size={13} />
            <span>+ Layout</span>
          </button>
          <button className="tl-action-btn" onClick={addCaptionAtPlayhead}>
            <Subtitles size={13} />
            <span>+ Caption</span>
          </button>
          <button className="tl-action-btn" onClick={handleDetectSilence}>
            <Sparkles size={13} />
            <span>Detect Silence (`bin/detect-silence`)</span>
          </button>
        </div>

        {/* Contextual Selected Block Inspector Strip */}
        <div className="timeline-context-strip">
          {silenceToast && (
            <div className="context-editor-pill">
              <span className="context-badge emerald">Silence Detector</span>
              <span>{silenceToast}</span>
            </div>
          )}

          {!silenceToast && selectedZoom && (
            <div className="context-editor-pill">
              <span className="context-badge indigo">Zoom Editor</span>
              <label>
                Scale <strong>{selectedZoom.scale.toFixed(2)}×</strong>
                <input
                  type="range"
                  min={1.2}
                  max={3.5}
                  step={0.05}
                  value={selectedZoom.scale}
                  onChange={(e) =>
                    onChangeProject((prev) => ({
                      ...prev,
                      zooms: prev.zooms.map((z) =>
                        z.id === selectedZoom.id
                          ? { ...z, scale: parseFloat(e.target.value) }
                          : z
                      ),
                    }))
                  }
                />
              </label>
              <button
                className={`mini-chip ${
                  selectedZoom.mode === 'auto-cursor' ? 'active' : ''
                }`}
                onClick={() =>
                  onChangeProject((prev) => ({
                    ...prev,
                    zooms: prev.zooms.map((z) =>
                      z.id === selectedZoom.id
                        ? {
                            ...z,
                            mode: z.mode === 'auto-cursor' ? 'manual' : 'auto-cursor',
                          }
                        : z
                    ),
                  }))
                }
              >
                {selectedZoom.mode === 'auto-cursor'
                  ? 'Auto Follow Cursor'
                  : 'Manual Target (Drag on Canvas)'}
              </button>
              <button
                className={`mini-chip ${selectedZoom.glassLoupe ? 'active' : ''}`}
                onClick={() =>
                  onChangeProject((prev) => ({
                    ...prev,
                    zooms: prev.zooms.map((z) =>
                      z.id === selectedZoom.id
                        ? { ...z, glassLoupe: !z.glassLoupe }
                        : z
                    ),
                  }))
                }
              >
                <Search size={11} />
                <span>Glass Loupe</span>
              </button>
              <select
                className="mini-select"
                value={selectedZoom.springPreset}
                onChange={(e) =>
                  onChangeProject((prev) => ({
                    ...prev,
                    zooms: prev.zooms.map((z) =>
                      z.id === selectedZoom.id
                        ? { ...z, springPreset: e.target.value as SpringPresetName }
                        : z
                    ),
                  }))
                }
              >
                <option value="rapid">Rapid Spring</option>
                <option value="quick">Quick Spring</option>
                <option value="default">Default Spring</option>
                <option value="mellow">Mellow Spring</option>
                <option value="slow">Slow Spring</option>
              </select>
            </div>
          )}

          {!silenceToast && selectedSlice && (
            <div className="context-editor-pill">
              <span className="context-badge emerald">Slice Editor</span>
              <span>Speed:</span>
              {[1, 1.5, 2, 2.5, 3].map((spd) => (
                <button
                  key={spd}
                  className={`mini-chip ${selectedSlice.speed === spd ? 'active' : ''}`}
                  onClick={() =>
                    onChangeProject((prev) => ({
                      ...prev,
                      slices: prev.slices.map((s) =>
                        s.id === selectedSlice.id ? { ...s, speed: spd } : s
                      ),
                    }))
                  }
                >
                  {spd}×
                </button>
              ))}
              <button
                className={`mini-chip ${selectedSlice.typingSpeedUp ? 'active' : ''}`}
                onClick={() =>
                  onChangeProject((prev) => ({
                    ...prev,
                    slices: prev.slices.map((s) =>
                      s.id === selectedSlice.id
                        ? { ...s, typingSpeedUp: !s.typingSpeedUp }
                        : s
                    ),
                  }))
                }
              >
                <FastForward size={11} />
                <span>Speed Up Typing</span>
              </button>
            </div>
          )}

          {!silenceToast && selectedMask && (
            <div className="context-editor-pill">
              <span className="context-badge amber">Mask Editor (Drag corners on Stage)</span>
              {(['blur', 'pixelate', 'solid'] as const).map((st) => (
                <button
                  key={st}
                  className={`mini-chip ${selectedMask.style === st ? 'active' : ''}`}
                  onClick={() =>
                    onChangeProject((prev) => ({
                      ...prev,
                      masks: prev.masks.map((m) =>
                        m.id === selectedMask.id ? { ...m, style: st } : m
                      ),
                    }))
                  }
                >
                  {st.toUpperCase()}
                </button>
              ))}
              <button
                className={`mini-chip ${selectedMask.trackShift ? 'active' : ''}`}
                onClick={() =>
                  onChangeProject((prev) => ({
                    ...prev,
                    masks: prev.masks.map((m) =>
                      m.id === selectedMask.id
                        ? { ...m, trackShift: !m.trackShift }
                        : m
                    ),
                  }))
                }
              >
                Track Shift
              </button>
            </div>
          )}

          {!silenceToast && selectedCamera && (
            <div className="context-editor-pill">
              <span className="context-badge purple">Camera Layout Editor</span>
              {(
                [
                  { id: 'corner-br', label: 'Bottom-Right' },
                  { id: 'corner-bl', label: 'Bottom-Left' },
                  { id: 'corner-tr', label: 'Top-Right' },
                  { id: 'split-screen', label: 'Split Screen' },
                  { id: 'fullscreen', label: 'Fullscreen' },
                  { id: 'hidden', label: 'Hidden' },
                ] as { id: CameraLayoutMode; label: string }[]
              ).map((lay) => (
                <button
                  key={lay.id}
                  className={`mini-chip ${
                    selectedCamera.layout === lay.id ? 'active' : ''
                  }`}
                  onClick={() =>
                    onChangeProject((prev) => ({
                      ...prev,
                      cameraLayouts: prev.cameraLayouts.map((c) =>
                        c.id === selectedCamera.id
                          ? { ...c, layout: lay.id, label: lay.label }
                          : c
                      ),
                    }))
                  }
                >
                  {lay.label}
                </button>
              ))}
            </div>
          )}

          {!silenceToast && selectedCaption && (
            <div className="context-editor-pill">
              <span className="context-badge indigo">Caption Segment</span>
              <input
                type="text"
                className="caption-inline-input"
                value={selectedCaption.text}
                onChange={(e) =>
                  onChangeProject((prev) => ({
                    ...prev,
                    captions: prev.captions.map((c) =>
                      c.id === selectedCaption.id
                        ? { ...c, text: e.target.value }
                        : c
                    ),
                  }))
                }
              />
              <button
                className="mini-chip"
                onClick={() =>
                  studioAudioEngine.speakText(
                    selectedCaption.text,
                    project.captionsConfig.voiceURI
                  )
                }
              >
                <Volume2 size={11} />
                <span>Speak TTS</span>
              </button>
            </div>
          )}
        </div>

        <div className="timeline-actions-right">
          {selectedBlock &&
            (selectedBlock.kind !== 'slice' || slices.length > 1) && (
              <button
                className="tl-action-btn danger"
                onClick={deleteSelectedBlock}
                title="Delete Selected Block (Backspace)"
              >
                <Trash2 size={13} />
                <span>Remove</span>
              </button>
            )}
        </div>
      </div>

      {/* Multi-Track Body */}
      <div className="timeline-grid">
        {/* Left Track Headers */}
        <div className="timeline-labels-col">
          <div className="tl-ruler-corner">TIMECODE (DRAG/TRIM)</div>
          <div className="tl-track-label">
            <Film size={13} />
            <span>Screen Clip</span>
          </div>
          <div className="tl-track-label">
            <ZoomIn size={13} />
            <span>Zoom & Spring</span>
          </div>
          <div className="tl-track-label">
            <Camera size={13} />
            <span>Camera Layout</span>
          </div>
          <div className="tl-track-label">
            <ShieldAlert size={13} />
            <span>Privacy Masks</span>
          </div>
          <div className="tl-track-label">
            <Subtitles size={13} />
            <span>Captions & Audio</span>
          </div>
        </div>

        {/* Right Interactive Track Lanes */}
        <div
          className="timeline-lanes-col"
          ref={trackAreaRef}
          onPointerDown={handleRulerPointerDown}
        >
          {/* Time Ruler + Click Telemetry Dots */}
          <div className="tl-ruler-row">
            {(() => {
              const totalSec = Math.max(1, Math.ceil(durationMs / 1000));
              const stepSec = totalSec > 24 ? 2 : 1;
              const ticks: number[] = [];
              for (let s = 0; s <= totalSec; s += stepSec) {
                ticks.push(s);
              }
              return ticks.map((sec) => (
                <div
                  key={sec}
                  className="tl-ruler-tick"
                  style={{ left: `${(sec / (durationMs / 1000)) * 100}%` }}
                >
                  <span>{sec}s</span>
                </div>
              ));
            })()}
            {cursorEvents
              .filter((ev) => ev.type === 'click' || ev.type === 'keystroke')
              .map((ev, i) => (
                <div
                  key={i}
                  className={`tl-telemetry-dot ${ev.type}`}
                  style={{ left: pct(ev.timeMs) }}
                  title={`${ev.type} @ ${(ev.timeMs / 1000).toFixed(2)}s`}
                />
              ))}
          </div>

          {/* Lane 1: Screen Clips / Slices */}
          <div className="tl-lane">
            {slices.map((slice) => {
              const isSel =
                selectedBlock?.kind === 'slice' && selectedBlock.id === slice.id;
              return (
                <div
                  key={slice.id}
                  className={`tl-block slice-block ${isSel ? 'selected' : ''}`}
                  style={{
                    left: pct(slice.startMs),
                    width: widthPct(slice.startMs, slice.endMs),
                  }}
                  onPointerDown={(e) =>
                    startBlockDragOrTrim(
                      e,
                      'slice',
                      slice.id,
                      slice.startMs,
                      slice.endMs,
                      'move'
                    )
                  }
                >
                  <div
                    className="tl-trim-handle left"
                    onPointerDown={(e) =>
                      startBlockDragOrTrim(
                        e,
                        'slice',
                        slice.id,
                        slice.startMs,
                        slice.endMs,
                        'trim-start'
                      )
                    }
                  />
                  <span className="tl-block-title">{slice.label}</span>
                  {slice.speed !== 1 && (
                    <span className="tl-block-pill">{slice.speed}×</span>
                  )}
                  {slice.typingSpeedUp && (
                    <span className="tl-block-pill">Fast Typing</span>
                  )}
                  <div
                    className="tl-trim-handle right"
                    onPointerDown={(e) =>
                      startBlockDragOrTrim(
                        e,
                        'slice',
                        slice.id,
                        slice.startMs,
                        slice.endMs,
                        'trim-end'
                      )
                    }
                  />
                </div>
              );
            })}
          </div>

          {/* Lane 2: Zoom Blocks */}
          <div className="tl-lane">
            {zooms.map((zm) => {
              const isSel =
                selectedBlock?.kind === 'zoom' && selectedBlock.id === zm.id;
              return (
                <div
                  key={zm.id}
                  className={`tl-block zoom-block ${isSel ? 'selected' : ''}`}
                  style={{
                    left: pct(zm.startMs),
                    width: widthPct(zm.startMs, zm.endMs),
                  }}
                  onPointerDown={(e) =>
                    startBlockDragOrTrim(
                      e,
                      'zoom',
                      zm.id,
                      zm.startMs,
                      zm.endMs,
                      'move'
                    )
                  }
                >
                  <div
                    className="tl-trim-handle left"
                    onPointerDown={(e) =>
                      startBlockDragOrTrim(
                        e,
                        'zoom',
                        zm.id,
                        zm.startMs,
                        zm.endMs,
                        'trim-start'
                      )
                    }
                  />
                  <ZoomIn size={11} />
                  <span className="tl-block-title">
                    {zm.scale.toFixed(2)}×{' '}
                    {zm.glassLoupe
                      ? 'Loupe'
                      : zm.mode === 'auto-cursor'
                      ? 'Auto'
                      : 'Manual'}
                  </span>
                  <span className="tl-block-pill">{zm.springPreset}</span>
                  <div
                    className="tl-trim-handle right"
                    onPointerDown={(e) =>
                      startBlockDragOrTrim(
                        e,
                        'zoom',
                        zm.id,
                        zm.startMs,
                        zm.endMs,
                        'trim-end'
                      )
                    }
                  />
                </div>
              );
            })}
          </div>

          {/* Lane 3: Camera Layout Blocks */}
          <div className="tl-lane">
            {cameraLayouts.map((cl) => {
              const isSel =
                selectedBlock?.kind === 'camera' && selectedBlock.id === cl.id;
              return (
                <div
                  key={cl.id}
                  className={`tl-block camera-block ${isSel ? 'selected' : ''}`}
                  style={{
                    left: pct(cl.startMs),
                    width: widthPct(cl.startMs, cl.endMs),
                  }}
                  onPointerDown={(e) =>
                    startBlockDragOrTrim(
                      e,
                      'camera',
                      cl.id,
                      cl.startMs,
                      cl.endMs,
                      'move'
                    )
                  }
                >
                  <div
                    className="tl-trim-handle left"
                    onPointerDown={(e) =>
                      startBlockDragOrTrim(
                        e,
                        'camera',
                        cl.id,
                        cl.startMs,
                        cl.endMs,
                        'trim-start'
                      )
                    }
                  />
                  <Camera size={11} />
                  <span className="tl-block-title">{cl.label}</span>
                  <div
                    className="tl-trim-handle right"
                    onPointerDown={(e) =>
                      startBlockDragOrTrim(
                        e,
                        'camera',
                        cl.id,
                        cl.startMs,
                        cl.endMs,
                        'trim-end'
                      )
                    }
                  />
                </div>
              );
            })}
          </div>

          {/* Lane 4: Privacy Masks */}
          <div className="tl-lane">
            {masks.map((mk) => {
              const isSel =
                selectedBlock?.kind === 'mask' && selectedBlock.id === mk.id;
              return (
                <div
                  key={mk.id}
                  className={`tl-block mask-block ${isSel ? 'selected' : ''}`}
                  style={{
                    left: pct(mk.startMs),
                    width: widthPct(mk.startMs, mk.endMs),
                  }}
                  onPointerDown={(e) =>
                    startBlockDragOrTrim(
                      e,
                      'mask',
                      mk.id,
                      mk.startMs,
                      mk.endMs,
                      'move'
                    )
                  }
                >
                  <div
                    className="tl-trim-handle left"
                    onPointerDown={(e) =>
                      startBlockDragOrTrim(
                        e,
                        'mask',
                        mk.id,
                        mk.startMs,
                        mk.endMs,
                        'trim-start'
                      )
                    }
                  />
                  <ShieldAlert size={11} />
                  <span className="tl-block-title">
                    {mk.label} ({mk.style})
                  </span>
                  <div
                    className="tl-trim-handle right"
                    onPointerDown={(e) =>
                      startBlockDragOrTrim(
                        e,
                        'mask',
                        mk.id,
                        mk.startMs,
                        mk.endMs,
                        'trim-end'
                      )
                    }
                  />
                </div>
              );
            })}
          </div>

          {/* Lane 5: Whisper / Speech Captions & Audio Waveform Envelope */}
          <div className="tl-lane">
            {audioWaveform && audioWaveform.length > 0 && (
              <div className="tl-waveform-backdrop" aria-hidden="true">
                {audioWaveform.map((amp, idx) => (
                  <span
                    key={idx}
                    className="tl-waveform-bar"
                    style={{ height: `${Math.max(12, Math.round(amp * 92))}%` }}
                  />
                ))}
              </div>
            )}
            {captions.map((cap) => {
              const isSel =
                selectedBlock?.kind === 'caption' &&
                selectedBlock.id === cap.id;
              return (
                <div
                  key={cap.id}
                  className={`tl-block caption-block ${
                    cap.type === 'sound-label' ? 'sound-label' : ''
                  } ${isSel ? 'selected' : ''}`}
                  style={{
                    left: pct(cap.startMs),
                    width: widthPct(cap.startMs, cap.endMs),
                  }}
                  onPointerDown={(e) =>
                    startBlockDragOrTrim(
                      e,
                      'caption',
                      cap.id,
                      cap.startMs,
                      cap.endMs,
                      'move'
                    )
                  }
                >
                  <div
                    className="tl-trim-handle left"
                    onPointerDown={(e) =>
                      startBlockDragOrTrim(
                        e,
                        'caption',
                        cap.id,
                        cap.startMs,
                        cap.endMs,
                        'trim-start'
                      )
                    }
                  />
                  <span className="tl-block-title">{cap.text}</span>
                  <div
                    className="tl-trim-handle right"
                    onPointerDown={(e) =>
                      startBlockDragOrTrim(
                        e,
                        'caption',
                        cap.id,
                        cap.startMs,
                        cap.endMs,
                        'trim-end'
                      )
                    }
                  />
                </div>
              );
            })}
          </div>

          {/* Playhead Vertical Line & Handle */}
          <div className="tl-playhead" style={{ left: pct(currentTimeMs) }}>
            <div className="tl-playhead-cap" />
          </div>
        </div>
      </div>
    </section>
  );
};
