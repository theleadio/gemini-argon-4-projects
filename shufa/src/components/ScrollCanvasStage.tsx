import React, { useEffect, useRef, useState, useCallback } from 'react';
import type {
  BrushPhysicsConfig,
  CharacterSpecimen,
  GridType,
  ScrollLayoutMode,
  SealStyle,
} from '../types/shufa';
import {
  drawActiveBrushCursor,
  drawCalligraphicStroke,
  drawCinnabarSeal,
  drawGhostCharacter,
  drawScrollSurface,
  drawStrokeAnatomyOverlay,
  drawTraditionalGrid,
} from '../utils/shufaEngine';
import { soundEngine } from '../utils/soundEngine';

export interface ActivePlaybackPosition {
  charIdx: number;
  strokeIdx: number;
  strokeProgress: number; // 0..1
  isFinished: boolean;
}

interface ScrollCanvasStageProps {
  specimens: CharacterSpecimen[];
  playbackPos: ActivePlaybackPosition;
  selectedCharIdx: number;
  hoveredStrokeIdx: number | null;
  onSelectChar: (idx: number) => void;
  config: BrushPhysicsConfig;
  gridType: GridType;
  layoutMode: ScrollLayoutMode;
  onChangeLayoutMode: (mode: ScrollLayoutMode) => void;
  sealText: string;
  sealStyle: SealStyle;
  colophonText: string;
  isPracticeMode: boolean;
  onTogglePracticeMode: (val: boolean) => void;
  canvasRefOut: React.MutableRefObject<HTMLCanvasElement | null>;
}

interface CellBox {
  charIdx: number;
  x: number;
  y: number;
  size: number;
}

interface UserBrushPoint {
  x: number; // in 1024 space
  y: number;
  pressure: number;
}

export const ScrollCanvasStage: React.FC<ScrollCanvasStageProps> = ({
  specimens,
  playbackPos,
  selectedCharIdx,
  hoveredStrokeIdx,
  onSelectChar,
  config,
  gridType,
  layoutMode,
  onChangeLayoutMode,
  sealText,
  sealStyle,
  colophonText,
  isPracticeMode,
  onTogglePracticeMode,
  canvasRefOut,
}) => {
  const internalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cellBoxesRef = useRef<CellBox[]>([]);

  // Interactive Brush Trace state (when in practice mode)
  const [practiceStrokeIdx, setPracticeStrokeIdx] = useState(0);
  const [practiceScores, setPracticeScores] = useState<number[]>([]);
  const [lastFeedback, setLastFeedback] = useState<{ text: string; score: number; ok: boolean } | null>(null);
  const [userCurrentStroke, setUserCurrentStroke] = useState<UserBrushPoint[]>([]);
  const isDrawingRef = useRef(false);

  const activeSpecimen = specimens[selectedCharIdx] || specimens[0];

  // Reset practice progress when selected character changes or practice mode toggles
  useEffect(() => {
    setPracticeStrokeIdx(0);
    setPracticeScores([]);
    setLastFeedback(null);
    setUserCurrentStroke([]);
  }, [selectedCharIdx, activeSpecimen?.char, isPracticeMode]);

  // Compute canvas dimensions & character cell geometry based on layoutMode and character count
  const computeStageGeometry = useCallback(() => {
    const count = Math.max(1, specimens.length);

    if (layoutMode === 'single-study' || isPracticeMode) {
      const width = 560;
      const height = 560;
      const size = 400;
      const cells: CellBox[] = [
        {
          charIdx: selectedCharIdx < specimens.length ? selectedCharIdx : 0,
          x: (width - size) / 2,
          y: (height - size) / 2 - 10,
          size,
        },
      ];
      return { width, height, cells, cellSize: size };
    }

    if (layoutMode === 'vertical-rtl') {
      // Traditional Vertical Scroll (中堂/条幅): max 4 or 5 chars per column, right-to-left columns
      const maxPerCol = count <= 5 ? count : count <= 10 ? Math.ceil(count / 2) : Math.ceil(count / 3);
      const numCols = Math.ceil(count / maxPerCol);
      const cellSize = count <= 4 ? 148 : count <= 8 ? 126 : 108;
      const colGap = 24;
      const rowGap = 12;
      const padX = 96;
      const padY = 68;

      const contentW = numCols * cellSize + (numCols - 1) * colGap;
      const contentH = maxPerCol * cellSize + (maxPerCol - 1) * rowGap;
      const width = Math.max(520, contentW + padX * 2 + 64);
      const height = Math.max(500, contentH + padY * 2);

      const startRightX = (width + contentW) / 2 - cellSize + 24;
      const startTopY = (height - contentH) / 2;

      const cells: CellBox[] = specimens.map((_, i) => {
        const col = Math.floor(i / maxPerCol);
        const row = i % maxPerCol;
        return {
          charIdx: i,
          x: startRightX - col * (cellSize + colGap),
          y: startTopY + row * (cellSize + rowGap),
          size: cellSize,
        };
      });

      return { width, height, cells, cellSize };
    }

    // Horizontal Scroll (横披: right-to-left or left-to-right)
    const maxPerRow = count <= 6 ? count : Math.ceil(count / 2);
    const numRows = Math.ceil(count / maxPerRow);
    const cellSize =
      maxPerRow <= 2
        ? 236
        : maxPerRow === 3
          ? 208
          : maxPerRow === 4
            ? 192
            : maxPerRow === 5
              ? 162
              : 136;
    const gap = 18;
    const padX = 96;
    const padY = 86;

    const rowWidth = maxPerRow * cellSize + (maxPerRow - 1) * gap;
    const totalH = numRows * cellSize + (numRows - 1) * (gap + 12);
    const width = Math.max(680, rowWidth + padX * 2 + 56);
    const height = Math.max(360, totalH + padY * 2);

    const startYBase = (height - totalH) / 2;

    const cells: CellBox[] = specimens.map((_, i) => {
      const row = Math.floor(i / maxPerRow);
      const colInRow = i % maxPerRow;
      const charsInThisRow = Math.min(maxPerRow, count - row * maxPerRow);
      const actualRowW = charsInThisRow * cellSize + (charsInThisRow - 1) * gap;
      const rowStartX = (width - actualRowW) / 2;

      const visualCol =
        layoutMode === 'horizontal-rtl' ? charsInThisRow - 1 - colInRow : colInRow;

      return {
        charIdx: i,
        x: rowStartX + visualCol * (cellSize + gap),
        y: startYBase + row * (cellSize + gap + 12),
        size: cellSize,
      };
    });

    return { width, height, cells, cellSize };
  }, [specimens, layoutMode, isPracticeMode, selectedCharIdx]);

  // Main Canvas Render Effect
  useEffect(() => {
    const canvas = internalCanvasRef.current;
    if (!canvas || specimens.length === 0) return;
    canvasRefOut.current = canvas;

    const { width, height, cells } = computeStageGeometry();
    cellBoxesRef.current = cells;

    const dpr = typeof window !== 'undefined' ? Math.min(2.5, window.devicePixelRatio || 1) : 1;
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);

    const isRubbing = config.style === 'rubbing';

    // 1. Draw Xuan paper or Stone Rubbing surface
    drawScrollSurface(ctx, width, height, isRubbing);

    // 2. Draw outer architectural scroll border (内框乌丝双阑)
    const borderInset = 18;
    ctx.strokeStyle = isRubbing ? 'rgba(235, 230, 218, 0.22)' : 'rgba(40, 40, 42, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(borderInset, borderInset, width - borderInset * 2, height - borderInset * 2);
    ctx.lineWidth = 0.6;
    ctx.strokeRect(
      borderInset + 4,
      borderInset + 4,
      width - (borderInset + 4) * 2,
      height - (borderInset + 4) * 2
    );

    let activeBrushTip: {
      tipX: number;
      tipY: number;
      tx: number;
      ty: number;
      pressure: number;
    } | null = null;

    // 3. Render each character cell
    for (const cell of cells) {
      const spec = specimens[cell.charIdx];
      if (!spec) continue;

      const isSelected = cell.charIdx === selectedCharIdx;

      // Grid lines
      drawTraditionalGrid(ctx, cell.x, cell.y, cell.size, gridType, isRubbing, isSelected);

      // Faint ghost outline if enabled (or always in Practice mode)
      if (config.showGhostOutline || isPracticeMode) {
        drawGhostCharacter(ctx, spec, cell.x, cell.y, cell.size, isRubbing);
      }

      if (isPracticeMode && (layoutMode === 'single-study' || isPracticeMode)) {
        // In Interactive Brush Practice Mode:
        // Draw already-mastered strokes in full ink
        for (let s = 0; s < practiceStrokeIdx; s++) {
          drawCalligraphicStroke(ctx, spec, s, 1, cell.x, cell.y, cell.size, config);
        }

        // Highlight the current target stroke guide
        if (practiceStrokeIdx < spec.strokeCount) {
          drawStrokeAnatomyOverlay(ctx, spec, practiceStrokeIdx, cell.x, cell.y, cell.size);
        }

        // Draw user's live wet brush stroke
        if (userCurrentStroke.length > 0) {
          ctx.save();
          ctx.translate(cell.x, cell.y);
          const s = cell.size / 1024;
          ctx.scale(s, s);
          ctx.fillStyle = isRubbing ? '#EFECE4' : '#121214';
          ctx.strokeStyle = isRubbing ? '#EFECE4' : '#121214';
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          for (let i = 0; i < userCurrentStroke.length; i++) {
            const pt = userCurrentStroke[i];
            const radius = 34 * pt.pressure;
            ctx.beginPath();
            ctx.ellipse(pt.x, pt.y, radius * 1.15, radius * 0.82, -0.55, 0, Math.PI * 2);
            ctx.fill();
            if (i > 0) {
              const prev = userCurrentStroke[i - 1];
              ctx.lineWidth = radius * 1.9;
              ctx.beginPath();
              ctx.moveTo(prev.x, prev.y);
              ctx.lineTo(pt.x, pt.y);
              ctx.stroke();
            }
          }
          ctx.restore();
        }
      } else {
        // Normal Animation / Scrubbing Playback Mode:
        for (let s = 0; s < spec.strokeCount; s++) {
          let strokeProg = 0;
          if (playbackPos.isFinished) {
            strokeProg = 1;
          } else if (cell.charIdx < playbackPos.charIdx) {
            strokeProg = 1;
          } else if (cell.charIdx === playbackPos.charIdx) {
            if (s < playbackPos.strokeIdx) {
              strokeProg = 1;
            } else if (s === playbackPos.strokeIdx) {
              strokeProg = playbackPos.strokeProgress;
            }
          }

          if (strokeProg > 0) {
            const tip = drawCalligraphicStroke(
              ctx,
              spec,
              s,
              strokeProg,
              cell.x,
              cell.y,
              cell.size,
              config
            );
            if (
              cell.charIdx === playbackPos.charIdx &&
              s === playbackPos.strokeIdx &&
              strokeProg > 0 &&
              strokeProg < 0.995
            ) {
              activeBrushTip = tip;
            }
          }
        }

        // Optional 永字八法 Median Spine & Vector Overlay
        if (config.showMedianSpine) {
          const focusStroke =
             isSelected && hoveredStrokeIdx !== null
              ? hoveredStrokeIdx
              : cell.charIdx === playbackPos.charIdx && !playbackPos.isFinished
                ? playbackPos.strokeIdx
                : null;
          drawStrokeAnatomyOverlay(ctx, spec, focusStroke, cell.x, cell.y, cell.size);
        }
      }

      // Small architectural Pinyin & index caption above/below cell
      ctx.save();
      ctx.font = '500 11px "IBM Plex Mono", monospace';
      ctx.fillStyle = isRubbing
        ? isSelected
          ? '#D95348'
          : 'rgba(235, 230, 218, 0.48)'
        : isSelected
          ? '#B8332A'
          : 'rgba(40, 40, 42, 0.52)';
      ctx.textAlign = 'left';
      ctx.fillText(
        `0${cell.charIdx + 1} · ${spec.pinyin}`,
        cell.x + 2,
        cell.y - 8
      );
      ctx.restore();
    }

    // 4. Draw Colophon Inscription (落款) and Carved Cinnabar Seal (印章)
    const sealSize = layoutMode === 'single-study' || isPracticeMode ? 48 : 42;
    let sealX = 38;
    let sealY = height - 36 - sealSize;

    if (layoutMode === 'horizontal-ltr') {
      sealX = width - 38 - sealSize;
      sealY = height - 36 - sealSize;
    }

    // Colophon vertical text above or beside the seal
    ctx.save();
    ctx.font = '500 13px "Noto Serif SC", "Songti SC", serif';
    ctx.fillStyle = isRubbing ? 'rgba(235, 230, 218, 0.65)' : 'rgba(40, 40, 42, 0.72)';
    ctx.textAlign = 'center';
    const colophonChars = Array.from(colophonText || '丙午年墨韵书');
    const colophonX = sealX + sealSize / 2;
    const colophonStartY = Math.max(46, sealY - colophonChars.length * 16 - 10);
    colophonChars.forEach((ch, idx) => {
      ctx.fillText(ch, colophonX, colophonStartY + idx * 16);
    });
    ctx.restore();

    // Stamp the Cinnabar seal (full opacity when finished or in practice complete, faint watermark otherwise)
    const isPracticeComplete =
      isPracticeMode && activeSpecimen && practiceStrokeIdx >= activeSpecimen.strokeCount;
    const sealComplete = playbackPos.isFinished || isPracticeComplete;

    ctx.save();
    ctx.globalAlpha = sealComplete ? 0.94 : 0.25;
    drawCinnabarSeal(
      ctx,
      sealX,
      sealY,
      sealSize,
      isPracticeComplete ? '神品妙墨' : sealText,
      sealStyle,
      1
    );
    ctx.restore();

    // 5. Draw live animated Sumi Brush Nib & Shaft when actively writing a stroke
    if (config.showBrushCursor && activeBrushTip && !isPracticeMode) {
      drawActiveBrushCursor(
        ctx,
        activeBrushTip.tipX,
        activeBrushTip.tipY,
        activeBrushTip.tx,
        activeBrushTip.ty,
        activeBrushTip.pressure
      );
    }

    ctx.restore();
  }, [
    specimens,
    playbackPos,
    selectedCharIdx,
    hoveredStrokeIdx,
    config,
    gridType,
    layoutMode,
    sealText,
    sealStyle,
    colophonText,
    isPracticeMode,
    practiceStrokeIdx,
    userCurrentStroke,
    activeSpecimen,
    computeStageGeometry,
    canvasRefOut,
  ]);

  // Helper to convert pointer event to canvas & 1024-cell coordinates
  const getPointerInActiveCell = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = internalCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const { width, height, cells } = computeStageGeometry();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;

    // Check if pointer is inside any cell
    for (const cell of cells) {
      if (
        canvasX >= cell.x &&
        canvasX <= cell.x + cell.size &&
        canvasY >= cell.y &&
        canvasY <= cell.y + cell.size
      ) {
        return {
          cell,
          normX: ((canvasX - cell.x) / cell.size) * 1024,
          normY: ((canvasY - cell.y) / cell.size) * 1024,
        };
      }
    }

    // In practice mode, also clamp to the primary cell
    if (isPracticeMode && cells[0]) {
      const cell = cells[0];
      return {
        cell,
        normX: Math.max(0, Math.min(1024, ((canvasX - cell.x) / cell.size) * 1024)),
        normY: Math.max(0, Math.min(1024, ((canvasY - cell.y) / cell.size) * 1024)),
      };
    }

    return null;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const hit = getPointerInActiveCell(e);
    if (!hit) return;

    if (!isPracticeMode) {
      onSelectChar(hit.cell.charIdx);
      return;
    }

    if (!activeSpecimen || practiceStrokeIdx >= activeSpecimen.strokeCount) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    soundEngine.playStrokeBrush(220, 1.0);
    setUserCurrentStroke([
      {
        x: hit.normX,
        y: hit.normY,
        pressure: e.pressure && e.pressure > 0 ? e.pressure : 0.82,
      },
    ]);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPracticeMode || !isDrawingRef.current) return;
    const hit = getPointerInActiveCell(e);
    if (!hit) return;

    setUserCurrentStroke((prev) => {
      if (prev.length === 0) return [{ x: hit.normX, y: hit.normY, pressure: 0.8 }];
      const last = prev[prev.length - 1];
      const dist = Math.hypot(hit.normX - last.x, hit.normY - last.y);
      if (dist < 10) return prev;
      // Velocity-reactive pressure
      const speedPressure = Math.max(0.42, Math.min(1.05, 1.02 - dist / 190));
      return [...prev, { x: hit.normX, y: hit.normY, pressure: speedPressure }];
    });
  };

  const evaluateUserStroke = (drawn: UserBrushPoint[], targetMedian: number[][]) => {
    if (drawn.length < 2 || !targetMedian || targetMedian.length < 2) {
      return { ok: false, score: 0, reason: '笔画过短，请顺沿红色起笔标识运笔' };
    }

    const uStart = drawn[0];
    const uEnd = drawn[drawn.length - 1];
    const tStart = targetMedian[0];
    const tEnd = targetMedian[targetMedian.length - 1];

    const startDist = Math.hypot(uStart.x - tStart[0], uStart.y - tStart[1]);
    const endDist = Math.hypot(uEnd.x - tEnd[0], uEnd.y - tEnd[1]);

    // Check overall directional cosine
    const uDx = uEnd.x - uStart.x;
    const uDy = uEnd.y - uStart.y;
    const tDx = tEnd[0] - tStart[0];
    const tDy = tEnd[1] - tStart[1];
    const uLen = Math.hypot(uDx, uDy) || 1;
    const tLen = Math.hypot(tDx, tDy) || 1;
    const cosSim = (uDx * tDx + uDy * tDy) / (uLen * tLen);

    // Check midpoint proximity
    const uMid = drawn[Math.floor(drawn.length / 2)];
    const tMid = targetMedian[Math.floor(targetMedian.length / 2)];
    const midDist = Math.hypot(uMid.x - tMid[0], uMid.y - tMid[1]);

    const avgError = startDist * 0.4 + endDist * 0.35 + midDist * 0.25;

    if (cosSim < 0.15 && startDist > endDist + 60) {
      return { ok: false, score: 35, reason: '逆向运笔：请从朱砂圆点「起笔」向箭头方向书写' };
    }

    if (avgError > 255) {
      return { ok: false, score: Math.max(40, Math.round(100 - avgError / 4)), reason: '位置偏离较大，请对准红线中锋运笔' };
    }

    const score = Math.max(68, Math.min(99, Math.round(100 - avgError * 0.16)));
    const praise =
      score >= 92
        ? '神采飞扬 · 中锋合度'
        : score >= 82
          ? '骨力稳健 · 笔势端正'
          : '落笔成型 · 气脉顺畅';
    return { ok: true, score, reason: praise };
  };

  const handlePointerUp = () => {
    if (!isPracticeMode || !isDrawingRef.current) return;
    isDrawingRef.current = false;

    if (!activeSpecimen || practiceStrokeIdx >= activeSpecimen.strokeCount) {
      setUserCurrentStroke([]);
      return;
    }

    const targetMedian = activeSpecimen.medians[practiceStrokeIdx];
    const result = evaluateUserStroke(userCurrentStroke, targetMedian);
    setUserCurrentStroke([]);

    if (result.ok) {
      const nextIdx = practiceStrokeIdx + 1;
      setPracticeStrokeIdx(nextIdx);
      setPracticeScores((prev) => [...prev, result.score]);
      setLastFeedback({
        text: `第 ${practiceStrokeIdx + 1} 画 (${activeSpecimen.anatomies[practiceStrokeIdx]?.nameZh || '笔画'}) · ${result.reason} (${result.score}分)`,
        score: result.score,
        ok: true,
      });
      if (nextIdx >= activeSpecimen.strokeCount) {
        soundEngine.playCharacterComplete(selectedCharIdx);
        soundEngine.playSealStamp();
      }
    } else {
      setLastFeedback({
        text: result.reason,
        score: result.score,
        ok: false,
      });
    }
  };

  const avgPracticeScore =
    practiceScores.length > 0
      ? Math.round(practiceScores.reduce((a, b) => a + b, 0) / practiceScores.length)
      : 0;

  return (
    <div className="scroll-stage-wrapper">
      {/* Top Stage Header Bar: Scroll Metadata + Mode Switchers */}
      <div className="stage-utility-bar">
        <div className="stage-meta-group">
          <span className="meta-badge">宣纸卷轴 · XUAN SCROLL</span>
          <span className="meta-divider">/</span>
          <span className="meta-text">
            {specimens.length} 字 · 共{' '}
            {specimens.reduce((acc, s) => acc + s.strokeCount, 0)} 画
          </span>
          {activeSpecimen && (
            <>
              <span className="meta-divider">/</span>
              <span className="meta-active-char">
                当前字：「{activeSpecimen.char}」({activeSpecimen.pinyin})
              </span>
            </>
          )}
        </div>

        <div className="stage-mode-actions">
          <div className="segmented-sharp" role="group" aria-label="章法布局">
            <button
              type="button"
              className={layoutMode === 'horizontal-rtl' && !isPracticeMode ? 'active' : ''}
              onClick={() => {
                onTogglePracticeMode(false);
                onChangeLayoutMode('horizontal-rtl');
              }}
              title="传统横披：自右向左书写"
            >
              古法横披 (右起)
            </button>
            <button
              type="button"
              className={layoutMode === 'horizontal-ltr' && !isPracticeMode ? 'active' : ''}
              onClick={() => {
                onTogglePracticeMode(false);
                onChangeLayoutMode('horizontal-ltr');
              }}
              title="现代横幅：自左向右书写"
            >
              现代横幅 (左起)
            </button>
            <button
              type="button"
              className={layoutMode === 'vertical-rtl' && !isPracticeMode ? 'active' : ''}
              onClick={() => {
                onTogglePracticeMode(false);
                onChangeLayoutMode('vertical-rtl');
              }}
              title="传统条幅：自上而下，自右向左分列"
            >
              中堂条幅 (竖排)
            </button>
            <button
              type="button"
              className={layoutMode === 'single-study' && !isPracticeMode ? 'active' : ''}
              onClick={() => {
                onTogglePracticeMode(false);
                onChangeLayoutMode('single-study');
              }}
              title="单字放大精研永字八法"
            >
              单字精研
            </button>
          </div>

          <button
            type="button"
            className={`practice-toggle-btn ${isPracticeMode ? 'active' : ''}`}
            onClick={() => {
              const next = !isPracticeMode;
              onTogglePracticeMode(next);
              if (next) onChangeLayoutMode('single-study');
            }}
          >
            {isPracticeMode ? '退出临摹' : '挥毫临摹 (手写)'}
          </button>
        </div>
      </div>

      {/* Center Pinned Xuan Paper Artifact */}
      <div className="xuan-canvas-viewport">
        <div className={`xuan-sheet-frame ${config.style === 'rubbing' ? 'rubbing-frame' : ''}`}>
          <canvas
            ref={internalCanvasRef}
            className={`shufa-main-canvas ${isPracticeMode ? 'practice-cursor' : 'inspect-cursor'}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
        </div>

        {/* Interactive Brush Trace Status Bar when Practice Mode is active */}
        {isPracticeMode && activeSpecimen && (
          <div className="practice-hud-bar">
            <div className="practice-hud-left">
              <span className="practice-tag">手写临摹 ·「{activeSpecimen.char}」</span>
              {practiceStrokeIdx < activeSpecimen.strokeCount ? (
                <span className="practice-instruction">
                  请书写第 <strong>{practiceStrokeIdx + 1}</strong> / {activeSpecimen.strokeCount} 画：
                  <strong>{activeSpecimen.anatomies[practiceStrokeIdx]?.nameZh}</strong>（
                  {activeSpecimen.anatomies[practiceStrokeIdx]?.technique}）
                </span>
              ) : (
                <span className="practice-complete-banner">
                  「{activeSpecimen.char}」字临摹圆满！综合笔意评分：<strong>{avgPracticeScore} 分</strong>
                </span>
              )}
            </div>

            <div className="practice-hud-right">
              {lastFeedback && (
                <span className={`practice-feedback ${lastFeedback.ok ? 'ok' : 'warn'}`}>
                  {lastFeedback.text}
                </span>
              )}
              {practiceStrokeIdx < activeSpecimen.strokeCount && (
                <button
                  type="button"
                  className="hud-btn"
                  onClick={() => setPracticeStrokeIdx((i) => Math.min(activeSpecimen.strokeCount, i + 1))}
                >
                  跳过此画
                </button>
              )}
              <button
                type="button"
                className="hud-btn"
                onClick={() => {
                  setPracticeStrokeIdx(0);
                  setPracticeScores([]);
                  setLastFeedback(null);
                }}
              >
                重写此字
              </button>
              {specimens.length > 1 && (
                <button
                  type="button"
                  className="hud-btn primary"
                  onClick={() => {
                    onSelectChar((selectedCharIdx + 1) % specimens.length);
                  }}
                >
                  临摹下一字 →
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
