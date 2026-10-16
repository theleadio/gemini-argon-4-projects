import type {
  BrushPhysicsConfig,
  CharacterSpecimen,
  GridType,
  SealStyle,
  StrokeAnatomy,
} from '../types/shufa';

export interface ResampledPoint {
  x: number;
  y: number;
  tx: number;
  ty: number;
  nx: number;
  ny: number;
  progress: number;
  pressure: number;
  curvature: number;
}

const path2DCache = new Map<string, Path2D>();
const resampledCache = new Map<string, ResampledPoint[]>();

export function getCachedPath2D(svgPath: string): Path2D {
  let p = path2DCache.get(svgPath);
  if (!p) {
    p = new Path2D(svgPath);
    path2DCache.set(svgPath, p);
  }
  return p;
}

/**
 * Deterministic pseudo-random helper for consistent bristle & paper grain
 */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Resample a stroke's median polyline into dense points (every ~7 units in 1024-space)
 * with tangent, normal, curvature, and calligraphic pressure profile.
 */
export function resampleMedianWithDynamics(
  median: number[][],
  anatomy: StrokeAnatomy,
  cacheKey: string
): ResampledPoint[] {
  const existing = resampledCache.get(cacheKey);
  if (existing) return existing;

  if (!median || median.length === 0) return [];
  if (median.length === 1) {
    return [
      {
        x: median[0][0],
        y: median[0][1],
        tx: 1,
        ty: 0,
        nx: 0,
        ny: 1,
        progress: 1,
        pressure: 1,
        curvature: 0,
      },
    ];
  }

  // First compute cumulative arc length
  const rawPts = median.map(([x, y]) => ({ x, y }));
  const cumLen: number[] = [0];
  let totalLen = 0;
  for (let i = 1; i < rawPts.length; i++) {
    const d = Math.hypot(rawPts[i].x - rawPts[i - 1].x, rawPts[i].y - rawPts[i - 1].y);
    totalLen += d;
    cumLen.push(totalLen);
  }

  if (totalLen < 1) {
    return [
      {
        x: rawPts[0].x,
        y: rawPts[0].y,
        tx: 1,
        ty: 0,
        nx: 0,
        ny: 1,
        progress: 1,
        pressure: 1,
        curvature: 0,
      },
    ];
  }

  const numSteps = Math.max(18, Math.min(180, Math.ceil(totalLen / 6.5)));
  const out: ResampledPoint[] = [];

  for (let s = 0; s <= numSteps; s++) {
    const progress = s / numSteps;
    const targetDist = progress * totalLen;

    // Locate segment
    let segIdx = 0;
    while (segIdx < cumLen.length - 2 && cumLen[segIdx + 1] < targetDist) {
      segIdx++;
    }

    const segStart = cumLen[segIdx];
    const segEnd = cumLen[segIdx + 1];
    const localT = segEnd > segStart ? (targetDist - segStart) / (segEnd - segStart) : 0;

    const p0 = rawPts[Math.max(0, segIdx - 1)];
    const p1 = rawPts[segIdx];
    const p2 = rawPts[Math.min(rawPts.length - 1, segIdx + 1)];
    const p3 = rawPts[Math.min(rawPts.length - 1, segIdx + 2)];

    // Catmull-Rom spline with low tension so sharp corners in Zhe strokes stay crisp
    const t2 = localT * localT;
    const t3 = t2 * localT;
    const tension = 0.25;

    const m1x = tension * (p2.x - p0.x);
    const m1y = tension * (p2.y - p0.y);
    const m2x = tension * (p3.x - p1.x);
    const m2y = tension * (p3.y - p1.y);

    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + localT;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;

    const x = h00 * p1.x + h10 * m1x + h01 * p2.x + h11 * m2x;
    const y = h00 * p1.y + h10 * m1y + h01 * p2.y + h11 * m2y;

    out.push({
      x,
      y,
      tx: 1,
      ty: 0,
      nx: 0,
      ny: 1,
      progress,
      pressure: 0.75,
      curvature: 0,
    });
  }

  // Compute tangents, normals, curvature, and calligraphic pressure envelope
  for (let i = 0; i < out.length; i++) {
    const prev = out[Math.max(0, i - 1)];
    const next = out[Math.min(out.length - 1, i + 1)];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    const tx = dx / len;
    const ty = dy / len;
    out[i].tx = tx;
    out[i].ty = ty;
    out[i].nx = -ty;
    out[i].ny = tx;
  }

  for (let i = 0; i < out.length; i++) {
    const prev = out[Math.max(0, i - 2)];
    const next = out[Math.min(out.length - 1, i + 2)];
    const dot = Math.max(-1, Math.min(1, prev.tx * next.tx + prev.ty * next.ty));
    const angleChange = Math.acos(dot); // radians
    const curvature = Math.min(1, angleChange / 1.1);
    out[i].curvature = curvature;

    const p = out[i].progress;
    // Calligraphic Qibi (起笔), Xingbi (行笔), Shoubi (收笔) pressure profile
    let pressure = 0.72;
    if (p < 0.14) {
      // Qibi attack: press down firmly (dunbi)
      pressure = 0.65 + 0.35 * Math.sin((p / 0.14) * Math.PI * 0.75);
    } else if (p < 0.82) {
      // Xingbi travel: slightly lighter in mid-stroke unless turning a corner
      const midWave = Math.sin(((p - 0.14) / 0.68) * Math.PI);
      pressure = 0.78 - 0.22 * midWave + curvature * 0.32;
    } else {
      // Shoubi release: depends on stroke type!
      const tailT = (p - 0.82) / 0.18;
      if (anatomy.code === 'pie' || anatomy.code === 'ti' || anatomy.code === 'gou') {
        // Sharp tapered flick (出锋)
        pressure = Math.max(0.12, 0.76 * (1 - tailT * 0.86));
      } else if (anatomy.code === 'na') {
        // Heavy wave press then horizontal taper (一波三折)
        pressure = tailT < 0.55 ? 0.82 + tailT * 0.32 : Math.max(0.18, 1.0 - (tailT - 0.55) * 1.8);
      } else {
        // Settled Huifeng press (回锋顿笔)
        pressure = 0.72 + 0.24 * Math.sin(tailT * Math.PI * 0.85);
      }
    }
    out[i].pressure = Math.max(0.12, Math.min(1.15, pressure));
  }

  resampledCache.set(cacheKey, out);
  return out;
}

/**
 * Draw tactile Xuan paper or Stone Stele Rubbing background on canvas
 */
export function drawScrollSurface(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  isRubbing: boolean
): void {
  ctx.save();

  if (isRubbing) {
    // Weathered dark charcoal limestone stele (金石碑拓)
    ctx.fillStyle = '#171719';
    ctx.fillRect(0, 0, width, height);

    // Subtle stone mineral grain & rubbing paper mottling
    const grainCount = Math.min(420, Math.floor((width * height) / 1800));
    for (let i = 0; i < grainCount; i++) {
      const gx = seededRandom(i * 3.1) * width;
      const gy = seededRandom(i * 7.3) * height;
      const r = 0.6 + seededRandom(i * 11.7) * 2.2;
      const alpha = 0.03 + seededRandom(i * 5.9) * 0.06;
      ctx.fillStyle = i % 3 === 0 ? `rgba(238, 234, 224, ${alpha})` : `rgba(48, 47, 45, ${alpha * 1.4})`;
      ctx.beginPath();
      ctx.arc(gx, gy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Fine stone fissure hairlines
    ctx.strokeStyle = 'rgba(235, 230, 218, 0.035)';
    ctx.lineWidth = 0.75;
    for (let i = 0; i < 14; i++) {
      const sx = seededRandom(i * 19.1) * width;
      const sy = seededRandom(i * 23.7) * height;
      const ang = seededRandom(i * 31.3) * Math.PI;
      const len = 30 + seededRandom(i * 41.9) * 90;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(
        sx + Math.cos(ang) * len * 0.5 + 8,
        sy + Math.sin(ang) * len * 0.5 - 6,
        sx + Math.cos(ang) * len,
        sy + Math.sin(ang) * len
      );
      ctx.stroke();
    }
  } else {
    // Warm Anhui Jingxian Xuan Paper (宣纸)
    ctx.fillStyle = '#F7F4EE';
    ctx.fillRect(0, 0, width, height);

    // Subtle horizontal laid-paper bamboo screen lines (帘纹)
    ctx.strokeStyle = 'rgba(185, 176, 158, 0.14)';
    ctx.lineWidth = 0.6;
    for (let y = 6; y < height; y += 7) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Organic mulberry bark fibers (檀皮纤维)
    const fiberCount = Math.min(180, Math.floor((width * height) / 3600));
    ctx.lineWidth = 0.65;
    for (let i = 0; i < fiberCount; i++) {
      const fx = seededRandom(i * 13.7) * width;
      const fy = seededRandom(i * 17.3) * height;
      const ang = seededRandom(i * 29.1) * Math.PI * 2;
      const len = 8 + seededRandom(i * 37.9) * 22;
      ctx.strokeStyle =
        i % 4 === 0 ? 'rgba(166, 152, 128, 0.16)' : 'rgba(210, 202, 186, 0.24)';
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.quadraticCurveTo(
        fx + Math.cos(ang + 0.3) * (len * 0.5),
        fy + Math.sin(ang + 0.3) * (len * 0.5),
        fx + Math.cos(ang) * len,
        fy + Math.sin(ang) * len
      );
      ctx.stroke();
    }
  }

  ctx.restore();
}

/**
 * Draw traditional Chinese calligraphy practice grid inside a character cell
 */
export function drawTraditionalGrid(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  gridType: GridType,
  isRubbing: boolean,
  isActiveChar: boolean
): void {
  if (gridType === 'blank') return;

  ctx.save();
  const primaryColor = isRubbing
    ? isActiveChar
      ? 'rgba(184, 51, 42, 0.55)'
      : 'rgba(235, 230, 218, 0.16)'
    : isActiveChar
      ? 'rgba(184, 51, 42, 0.52)'
      : 'rgba(184, 51, 42, 0.28)';

  const subColor = isRubbing
    ? 'rgba(235, 230, 218, 0.09)'
    : 'rgba(184, 51, 42, 0.17)';

  if (gridType === 'wusi') {
    // 乌丝栏: Vertical column borders + top/bottom double frame
    const wusiColor = isRubbing ? 'rgba(235, 230, 218, 0.18)' : 'rgba(40, 40, 42, 0.24)';
    ctx.strokeStyle = wusiColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + size);
    ctx.moveTo(x + size, y);
    ctx.lineTo(x + size, y + size);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Outer cell border
  ctx.strokeStyle = primaryColor;
  ctx.lineWidth = isActiveChar ? 1.25 : 1;
  ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);

  if (gridType === 'mizi') {
    // Center cross
    ctx.strokeStyle = subColor;
    ctx.lineWidth = 0.85;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x + size / 2, y);
    ctx.lineTo(x + size / 2, y + size);
    ctx.moveTo(x, y + size / 2);
    ctx.lineTo(x + size, y + size / 2);
    // Diagonals
    ctx.moveTo(x, y);
    ctx.lineTo(x + size, y + size);
    ctx.moveTo(x + size, y);
    ctx.lineTo(x, y + size);
    ctx.stroke();
  } else if (gridType === 'jiugong') {
    ctx.strokeStyle = subColor;
    ctx.lineWidth = 0.85;
    ctx.setLineDash([3, 3]);
    const third = size / 3;
    ctx.beginPath();
    ctx.moveTo(x + third, y);
    ctx.lineTo(x + third, y + size);
    ctx.moveTo(x + third * 2, y);
    ctx.lineTo(x + third * 2, y + size);
    ctx.moveTo(x, y + third);
    ctx.lineTo(x + size, y + third);
    ctx.moveTo(x, y + third * 2);
    ctx.lineTo(x + size, y + third * 2);
    ctx.stroke();
  } else if (gridType === 'huigong') {
    ctx.strokeStyle = subColor;
    ctx.lineWidth = 0.9;
    const inset = size * 0.22;
    ctx.strokeRect(x + inset, y + inset, size - inset * 2, size - inset * 2);
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(x + size / 2, y);
    ctx.lineTo(x + size / 2, y + size);
    ctx.moveTo(x, y + size / 2);
    ctx.lineTo(x + size, y + size / 2);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Render faint ghost watermark of all strokes in the character
 */
export function drawGhostCharacter(
  ctx: CanvasRenderingContext2D,
  specimen: CharacterSpecimen,
  cellX: number,
  cellY: number,
  cellSize: number,
  isRubbing: boolean
): void {
  ctx.save();
  ctx.translate(cellX, cellY);
  const scale = cellSize / 1024;
  ctx.scale(scale, scale);

  ctx.fillStyle = isRubbing ? 'rgba(238, 234, 224, 0.07)' : 'rgba(40, 40, 42, 0.065)';
  for (const strokePath of specimen.strokes) {
    const p2d = getCachedPath2D(strokePath);
    ctx.fill(p2d);
  }
  ctx.restore();
}

/**
 * Render a single stroke (either completed progress=1 or partial 0 < progress < 1)
 * with authentic brush physics, feibai bristle texture, and wet ink pooling.
 */
export function drawCalligraphicStroke(
  ctx: CanvasRenderingContext2D,
  specimen: CharacterSpecimen,
  strokeIdx: number,
  progress: number, // 0..1
  cellX: number,
  cellY: number,
  cellSize: number,
  config: BrushPhysicsConfig
): { tipX: number; tipY: number; tx: number; ty: number; pressure: number } | null {
  if (progress <= 0) return null;

  const strokePath = specimen.strokes[strokeIdx];
  const median = specimen.medians[strokeIdx];
  const anatomy = specimen.anatomies[strokeIdx];
  if (!strokePath || !median || median.length === 0) return null;

  const isRubbing = config.style === 'rubbing';
  const isRadicalColored = config.highlightRadical && anatomy?.isRadical;

  // Choose base ink color
  let inkHex = '#121214';
  let inkRgb = '18, 18, 20';
  if (isRubbing) {
    inkHex = isRadicalColored ? '#D95348' : '#EFECE4';
    inkRgb = isRadicalColored ? '217, 83, 72' : '239, 236, 228';
  } else if (isRadicalColored) {
    inkHex = '#B8332A';
    inkRgb = '184, 51, 42';
  }

  const cacheKey = `${specimen.char}_${strokeIdx}`;
  const samples = resampleMedianWithDynamics(median, anatomy, cacheKey);
  if (samples.length === 0) return null;

  const clampedProg = Math.max(0, Math.min(1, progress));
  const maxSampleIdx = Math.max(0, Math.min(samples.length - 1, Math.floor(clampedProg * (samples.length - 1))));
  const activeSample = samples[maxSampleIdx];

  const scale = cellSize / 1024;
  const path2D = getCachedPath2D(strokePath);

  ctx.save();
  ctx.translate(cellX, cellY);
  ctx.scale(scale, scale);

  // 1. Clip to exact calligraphic SVG stroke silhouette so proportions and hooks are razor-sharp
  ctx.save();
  ctx.clip(path2D);

  // Base stroke reveal:
  // If completed (progress >= 0.995), fill the clipped stroke path directly for crisp edges,
  // otherwise sweep a calligraphic brush head along the resampled median up to maxSampleIdx!
  if (clampedProg >= 0.995) {
    ctx.fillStyle = inkHex;
    ctx.fill(path2D);
  } else {
    ctx.fillStyle = inkHex;
    ctx.strokeStyle = inkHex;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw progressive brush envelope along median
    ctx.beginPath();
    ctx.moveTo(samples[0].x, samples[0].y);
    for (let i = 1; i <= maxSampleIdx; i++) {
      ctx.lineTo(samples[i].x, samples[i].y);
    }
    // Width of reveal brush in 1024-space (wide enough to cover the stroke belly without jumping across folds)
    ctx.lineWidth = 148;
    ctx.stroke();

    // Also stamp angled brush ellipses at start and active tip for natural calligraphic front
    for (let i = 0; i <= maxSampleIdx; i += 2) {
      const pt = samples[i];
      const r = 68 * (0.75 + pt.pressure * 0.35);
      ctx.beginPath();
      ctx.ellipse(pt.x, pt.y, r * 1.15, r * 0.85, -0.58, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 2. Feibai (飞白枯笔) Multi-Bristle Dry Streaks inside the stroke!
  const effectiveFeibai =
    config.style === 'feibai'
      ? Math.max(0.68, config.feibaiIntensity)
      : config.style === 'xingshu'
        ? Math.max(0.28, config.feibaiIntensity * 0.85)
        : config.feibaiIntensity * 0.45;

  if (effectiveFeibai > 0.08 && samples.length >= 5) {
    const paperCutColor = isRubbing
      ? 'rgba(23, 23, 25, 0.72)'
      : 'rgba(247, 244, 238, 0.78)';
    const bristleTracks = config.style === 'feibai' ? 14 : 8;

    ctx.strokeStyle = paperCutColor;
    ctx.lineCap = 'round';

    for (let b = 0; b < bristleTracks; b++) {
      // Offset across the stroke width (-52..+52 in 1024-space)
      const normalizedOffset = (b / (bristleTracks - 1)) * 2 - 1;
      const offsetDist = normalizedOffset * 48;
      const seed = strokeIdx * 97 + b * 31 + specimen.char.charCodeAt(0);
      const startFraction = 0.16 + seededRandom(seed) * 0.22;
      const endFraction = Math.min(clampedProg, 0.58 + seededRandom(seed + 7) * 0.38);

      if (endFraction > startFraction + 0.08) {
        const sIdx0 = Math.floor(startFraction * (samples.length - 1));
        const sIdx1 = Math.min(maxSampleIdx, Math.floor(endFraction * (samples.length - 1)));

        if (sIdx1 > sIdx0 + 1) {
          ctx.lineWidth = (2.2 + seededRandom(seed + 13) * 4.8) * effectiveFeibai;
          ctx.beginPath();
          for (let i = sIdx0; i <= sIdx1; i++) {
            const pt = samples[i];
            const jitter = (seededRandom(seed + i * 3) - 0.5) * 6;
            const bx = pt.x + pt.nx * (offsetDist + jitter);
            const by = pt.y + pt.ny * (offsetDist + jitter);
            if (i === sIdx0) ctx.moveTo(bx, by);
            else ctx.lineTo(bx, by);
          }
          ctx.stroke();
        }
      }
    }
  }

  // 3. Wet Sumi Ink Pooling (宿墨 / 浓墨蓄势) at Qibi, Turns, and Shoubi
  if (config.inkWetness > 0.25 && !isRubbing) {
    const poolAlpha = (config.inkWetness - 0.2) * 0.34;
    ctx.fillStyle = `rgba(0, 0, 0, ${poolAlpha})`;
    for (let i = 0; i <= maxSampleIdx; i += 3) {
      const pt = samples[i];
      if (pt.pressure > 0.86 || pt.curvature > 0.35 || i === 0) {
        const poolR = 38 * pt.pressure;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, poolR, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  ctx.restore(); // end clip(path2D)

  // 4. Subtle Xuan paper ink bleed (墨韵晕染) around stroke perimeter when inkWetness is high
  if (config.inkWetness > 0.55 && clampedProg >= 0.99 && !isRubbing) {
    ctx.save();
    ctx.strokeStyle = `rgba(${inkRgb}, ${(config.inkWetness - 0.5) * 0.16})`;
    ctx.lineWidth = (config.inkWetness - 0.45) * 14;
    ctx.lineJoin = 'round';
    ctx.stroke(path2D);
    ctx.restore();
  }

  // 5. Running Script Qiansi (行书牵丝 / 游丝连带) connecting previous stroke exit to this stroke entry
  const shouldDrawQiansi =
    (config.style === 'xingshu' || config.showQiansi) &&
    strokeIdx > 0 &&
    clampedProg > 0.02;

  if (shouldDrawQiansi) {
    const prevMedian = specimen.medians[strokeIdx - 1];
    if (prevMedian && prevMedian.length > 0) {
      const prevEnd = prevMedian[prevMedian.length - 1];
      const currStart = median[0];
      const dist = Math.hypot(currStart[0] - prevEnd[0], currStart[1] - prevEnd[1]);

      // Draw delicate gossamer ink filament when strokes are within natural wrist travel (< 680 units)
      if (dist > 24 && dist < 680) {
        const midX = (prevEnd[0] + currStart[0]) * 0.5 - (currStart[1] - prevEnd[1]) * 0.12;
        const midY = (prevEnd[1] + currStart[1]) * 0.5 + (currStart[0] - prevEnd[0]) * 0.08;

        ctx.save();
        ctx.strokeStyle = isRubbing
          ? 'rgba(239, 236, 228, 0.34)'
          : isRadicalColored
            ? 'rgba(184, 51, 42, 0.36)'
            : 'rgba(20, 20, 22, 0.32)';
        ctx.lineCap = 'round';

        // Tapered 2-part gossamer thread: strong exit flick, airy midpoint, crisp entry lead-in
        ctx.lineWidth = 7.5;
        ctx.beginPath();
        ctx.moveTo(prevEnd[0], prevEnd[1]);
        ctx.quadraticCurveTo(
          (prevEnd[0] + midX) * 0.5,
          (prevEnd[1] + midY) * 0.5,
          midX,
          midY
        );
        ctx.stroke();

        ctx.lineWidth = 5.0;
        ctx.beginPath();
        ctx.moveTo(midX, midY);
        ctx.quadraticCurveTo(
          (midX + currStart[0]) * 0.5,
          (midY + currStart[1]) * 0.5,
          currStart[0],
          currStart[1]
        );
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  ctx.restore();

  return {
    tipX: cellX + activeSample.x * scale,
    tipY: cellY + activeSample.y * scale,
    tx: activeSample.tx,
    ty: activeSample.ty,
    pressure: activeSample.pressure,
  };
}

/**
 * Draw Eight Principles of Yong (永字八法) median spine & Qibi/Shoubi trajectory vectors
 */
export function drawStrokeAnatomyOverlay(
  ctx: CanvasRenderingContext2D,
  specimen: CharacterSpecimen,
  activeStrokeIdx: number | null,
  cellX: number,
  cellY: number,
  cellSize: number
): void {
  ctx.save();
  ctx.translate(cellX, cellY);
  const scale = cellSize / 1024;
  ctx.scale(scale, scale);

  for (let sIdx = 0; sIdx < specimen.medians.length; sIdx++) {
    const median = specimen.medians[sIdx];
    if (!median || median.length < 2) continue;

    const isFocused = activeStrokeIdx === null || activeStrokeIdx === sIdx;
    const alpha = isFocused ? 0.88 : 0.32;

    // 1. Air-travel dotted connector from previous stroke
    if (sIdx > 0 && isFocused) {
      const prevEnd = specimen.medians[sIdx - 1][specimen.medians[sIdx - 1].length - 1];
      const currStart = median[0];
      ctx.save();
      ctx.strokeStyle = `rgba(184, 51, 42, ${alpha * 0.45})`;
      ctx.lineWidth = 4.5;
      ctx.setLineDash([12, 12]);
      ctx.beginPath();
      ctx.moveTo(prevEnd[0], prevEnd[1]);
      ctx.lineTo(currStart[0], currStart[1]);
      ctx.stroke();
      ctx.restore();
    }

    // 2. Median centerline spine
    ctx.strokeStyle = `rgba(184, 51, 42, ${alpha})`;
    ctx.lineWidth = isFocused ? 6.5 : 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(median[0][0], median[0][1]);
    for (let i = 1; i < median.length; i++) {
      ctx.lineTo(median[i][0], median[i][1]);
    }
    ctx.stroke();

    // 3. Qibi (起笔) start badge with stroke number
    const startPt = median[0];
    ctx.fillStyle = isFocused ? '#B8332A' : 'rgba(184, 51, 42, 0.55)';
    ctx.beginPath();
    ctx.arc(startPt[0], startPt[1], isFocused ? 22 : 15, 0, Math.PI * 2);
    ctx.fill();

    if (cellSize >= 140) {
      ctx.fillStyle = '#F7F4EE';
      ctx.font = `600 ${isFocused ? 26 : 20}px "IBM Plex Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(sIdx + 1), startPt[0], startPt[1] + 1);
    }

    // 4. Directional arrowhead at Shoubi (收笔)
    const endPt = median[median.length - 1];
    const prevPt = median[median.length - 2];
    const ang = Math.atan2(endPt[1] - prevPt[1], endPt[0] - prevPt[0]);
    const arrowLen = isFocused ? 24 : 16;

    ctx.fillStyle = `rgba(184, 51, 42, ${alpha})`;
    ctx.beginPath();
    ctx.moveTo(endPt[0], endPt[1]);
    ctx.lineTo(
      endPt[0] - arrowLen * Math.cos(ang - 0.45),
      endPt[1] - arrowLen * Math.sin(ang - 0.45)
    );
    ctx.lineTo(
      endPt[0] - arrowLen * Math.cos(ang + 0.45),
      endPt[1] - arrowLen * Math.sin(ang + 0.45)
    );
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Render the live animated Sumi Brush Nib & Bamboo Shaft Projection during stroke playback
 */
export function drawActiveBrushCursor(
  ctx: CanvasRenderingContext2D,
  tipX: number,
  tipY: number,
  tx: number,
  ty: number,
  pressure: number
): void {
  ctx.save();

  // Subtle pressure ripple ring on the Xuan paper
  const contactRadius = Math.max(5, 11 * pressure);
  ctx.strokeStyle = 'rgba(184, 51, 42, 0.75)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(tipX, tipY, contactRadius + 4, 0, Math.PI * 2);
  ctx.stroke();

  // Wet sumi ink core at brush contact point
  ctx.fillStyle = 'rgba(18, 18, 20, 0.92)';
  ctx.beginPath();
  ctx.ellipse(
    tipX,
    tipY,
    contactRadius * 1.15,
    contactRadius * 0.78,
    Math.atan2(ty, tx),
    0,
    Math.PI * 2
  );
  ctx.fill();

  // Angled Calligraphic Brush Ferrule & Bristle Cone (毛笔笔锋与湘妃竹笔管)
  // Traditional brush posture tilts toward top-right (~ -52 degrees)
  const shaftAngle = -0.92;
  const coneLen = 28;
  const shaftLen = 58;

  const ferruleX = tipX + Math.cos(shaftAngle) * coneLen;
  const ferruleY = tipY + Math.sin(shaftAngle) * coneLen;
  const topX = ferruleX + Math.cos(shaftAngle) * shaftLen;
  const topY = ferruleY + Math.sin(shaftAngle) * shaftLen;

  // Soft paper shadow cast by the brush
  ctx.strokeStyle = 'rgba(20, 20, 22, 0.14)';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(tipX + 6, tipY + 8);
  ctx.lineTo(topX + 14, topY + 18);
  ctx.stroke();

  // Bristle cone (wolf/goat hair gradient from black ink tip to ivory belly)
  const perpX = -Math.sin(shaftAngle);
  const perpY = Math.cos(shaftAngle);
  const ferruleHalfW = 5.5;

  const coneGrad = ctx.createLinearGradient(tipX, tipY, ferruleX, ferruleY);
  coneGrad.addColorStop(0, '#111113');
  coneGrad.addColorStop(0.55, '#3A3733');
  coneGrad.addColorStop(1, '#DCD4C4');

  ctx.fillStyle = coneGrad;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(ferruleX + perpX * ferruleHalfW, ferruleY + perpY * ferruleHalfW);
  ctx.lineTo(ferruleX - perpX * ferruleHalfW, ferruleY - perpY * ferruleHalfW);
  ctx.closePath();
  ctx.fill();

  // Cinnabar lacquer collar (笔斗)
  ctx.strokeStyle = '#B8332A';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(ferruleX + perpX * (ferruleHalfW + 0.5), ferruleY + perpY * (ferruleHalfW + 0.5));
  ctx.lineTo(ferruleX - perpX * (ferruleHalfW + 0.5), ferruleY - perpY * (ferruleHalfW + 0.5));
  ctx.stroke();

  // Bamboo brush shaft (竹笔管)
  ctx.strokeStyle = '#3B3228';
  ctx.lineWidth = 9.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(ferruleX, ferruleY);
  ctx.lineTo(topX, topY);
  ctx.stroke();

  ctx.restore();
}

/**
 * Draw authentic carved Cinnabar Red Seal (朱文阳刻 / 白文阴刻印章)
 */
export function drawCinnabarSeal(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  sealText: string,
  sealStyle: SealStyle,
  revealScale = 1
): void {
  if (revealScale <= 0) return;
  const chars = Array.from(sealText.trim() || '墨韵').slice(0, 4);
  while (chars.length < 4 && chars.length !== 2) {
    chars.push('印');
  }

  ctx.save();
  const cx = x + size / 2;
  const cy = y + size / 2;
  ctx.translate(cx, cy);
  ctx.scale(revealScale, revealScale);
  ctx.rotate(-0.018); // subtle hand-stamped organic angle
  ctx.translate(-size / 2, -size / 2);

  const cinnabar = '#B8332A';
  const paperCut = '#F7F4EE';

  if (sealStyle === 'baiwen') {
    // 白文 (Yin Intaglio): solid vermilion block with carved white characters
    ctx.fillStyle = cinnabar;
    ctx.fillRect(0, 0, size, size);

    // Subtle inner hairline frame
    ctx.strokeStyle = 'rgba(247, 244, 238, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(3, 3, size - 6, size - 6);

    ctx.fillStyle = paperCut;
  } else {
    // 朱文 (Yang Relief): thick vermilion border + vermilion characters on paper
    ctx.fillStyle = 'rgba(184, 51, 42, 0.05)';
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = cinnabar;
    ctx.lineWidth = Math.max(2.5, size * 0.075);
    ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, size - ctx.lineWidth, size - ctx.lineWidth);

    ctx.fillStyle = cinnabar;
  }

  // Render 2 or 4 characters in traditional right-to-left seal arrangement
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (chars.length === 2) {
    const fontSize = Math.round(size * 0.42);
    ctx.font = `700 ${fontSize}px "Noto Serif SC", "Songti SC", serif`;
    ctx.fillText(chars[0], size * 0.5, size * 0.31);
    ctx.fillText(chars[1], size * 0.5, size * 0.71);
  } else {
    // 4-char seal order: top-right (0), bottom-right (1), top-left (2), bottom-left (3)
    const fontSize = Math.round(size * 0.34);
    ctx.font = `700 ${fontSize}px "Noto Serif SC", "Songti SC", serif`;
    ctx.fillText(chars[0], size * 0.71, size * 0.31);
    ctx.fillText(chars[1], size * 0.71, size * 0.71);
    ctx.fillText(chars[2], size * 0.29, size * 0.31);
    ctx.fillText(chars[3], size * 0.29, size * 0.71);
  }

  // Organic carved stone distress (残破金石感)
  ctx.fillStyle = paperCut;
  for (let i = 0; i < 18; i++) {
    const dx = seededRandom(i * 19.7 + size) * size;
    const dy = seededRandom(i * 31.1 + size) * size;
    const dr = 0.8 + seededRandom(i * 43.3) * (size * 0.035);
    ctx.beginPath();
    ctx.arc(dx, dy, dr, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
