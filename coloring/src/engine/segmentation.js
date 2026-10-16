/**
 * Argon Atelier — High-Precision Line-Art Extraction & Connected-Component Region Engine
 *
 * Responsibilities:
 * 1. Optional Photo -> Line Art conversion (Sobel gradient + adaptive threshold) for non-line-art uploads.
 * 2. Anti-aliased Ink Outline Layer extraction (zero white-halo alpha ramp).
 * 3. Gap-sealing morphological barrier + Connected-Component flood-fill labeling.
 * 4. 2-pass Chamfer Distance Transform to find each region's true Pole of Inaccessibility (label anchor)
 *    and edge-distance field for Watercolor / Pencil / Cel shading.
 * 5. Annotated Numbered Blueprint Image generator for Google Gemini 4 Argon multimodal vision input.
 */

export const MAX_WORKING_DIM = 840;
export const MAX_ARGON_LABELED_REGIONS = 75;

/**
 * Resize an image/canvas to fit within MAX_WORKING_DIM while maintaining aspect ratio.
 */
export function fitDimensions(srcW, srcH, maxDim = MAX_WORKING_DIM) {
  if (srcW <= maxDim && srcH <= maxDim) {
    return { width: Math.round(srcW), height: Math.round(srcH) };
  }
  const scale = maxDim / Math.max(srcW, srcH);
  return {
    width: Math.max(64, Math.round(srcW * scale)),
    height: Math.max(64, Math.round(srcH * scale)),
  };
}

/**
 * Inspect an ImageData to estimate if it's already a line-art coloring page
 * or a full-color / grayscale photograph that might benefit from line-art extraction.
 */
export function analyzeUploadedImage(imageData) {
  const { data, width, height } = imageData;
  const total = width * height;
  let lightPixels = 0;
  let darkPixels = 0;
  let midPixels = 0;
  let saturatedPixels = 0;

  const step = Math.max(1, Math.floor(total / 25000));
  let sampled = 0;

  for (let i = 0; i < total; i += step) {
    const idx = i * 4;
    const a = data[idx + 3];
    // Composite over white if transparent
    const alpha = a / 255;
    const r = data[idx] * alpha + 255 * (1 - alpha);
    const g = data[idx + 1] * alpha + 255 * (1 - alpha);
    const b = data[idx + 2] * alpha + 255 * (1 - alpha);

    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const chroma = maxC - minC;

    if (chroma > 38) saturatedPixels++;
    if (lum > 205) lightPixels++;
    else if (lum < 95) darkPixels++;
    else midPixels++;
    sampled++;
  }

  const lightRatio = lightPixels / sampled;
  const midRatio = midPixels / sampled;
  const satRatio = saturatedPixels / sampled;

  const isLikelyLineArt = lightRatio > 0.52 && satRatio < 0.12 && midRatio < 0.38;
  return {
    isLikelyLineArt,
    lightRatio,
    midRatio,
    satRatio,
  };
}

/**
 * Convert a regular photo or shaded scan into a clean black-and-white empty coloring sheet
 * using 3x3 smoothing + Sobel edge detection + tone-preserving dark line extraction.
 */
export function convertPhotoToLineArt(srcImageData, edgeStrength = 1.35) {
  const { width, height, data } = srcImageData;
  const total = width * height;
  const lum = new Float32Array(total);

  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    const alpha = data[idx + 3] / 255;
    const r = data[idx] * alpha + 255 * (1 - alpha);
    const g = data[idx + 1] * alpha + 255 * (1 - alpha);
    const b = data[idx + 2] * alpha + 255 * (1 - alpha);
    lum[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  // 3x3 box blur to suppress sensor grain before Sobel
  const blurred = new Float32Array(total);
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - 1);
    const y2 = Math.min(height - 1, y + 1);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - 1);
      const x2 = Math.min(width - 1, x + 1);
      blurred[y * width + x] =
        (lum[y0 * width + x0] +
          lum[y0 * width + x] +
          lum[y0 * width + x2] +
          lum[y * width + x0] +
          lum[y * width + x] * 2 +
          lum[y * width + x2] +
          lum[y2 * width + x0] +
          lum[y2 * width + x] +
          lum[y2 * width + x2]) /
        10;
    }
  }

  const out = new ImageData(width, height);
  const outData = out.data;

  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - 1);
    const y2 = Math.min(height - 1, y + 1);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - 1);
      const x2 = Math.min(width - 1, x + 1);

      const tl = blurred[y0 * width + x0];
      const tc = blurred[y0 * width + x];
      const tr = blurred[y0 * width + x2];
      const ml = blurred[y * width + x0];
      const mr = blurred[y * width + x2];
      const bl = blurred[y2 * width + x0];
      const bc = blurred[y2 * width + x];
      const br = blurred[y2 * width + x2];

      const gx = -tl + tr - 2 * ml + 2 * mr - bl + br;
      const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;
      const mag = Math.sqrt(gx * gx + gy * gy) * edgeStrength;

      // Also keep very dark ink strokes from original
      const baseDarkness = Math.max(0, 72 - blurred[y * width + x]) * 2.2;
      const stroke = Math.min(255, Math.max(mag > 42 ? mag : 0, baseDarkness));
      const val = stroke > 48 ? Math.max(0, 255 - stroke * 1.45) : 255;

      const idx = (y * width + x) * 4;
      outData[idx] = val;
      outData[idx + 1] = val;
      outData[idx + 2] = val;
      outData[idx + 3] = 255;
    }
  }

  return out;
}

/**
 * Segment a coloring sheet ImageData into:
 * - inkImageData: transparent ImageData with crisp dark charcoal outlines
 * - cleanLineImageData: black-on-white clean coloring sheet ImageData
 * - regionMap: Int32Array(width * height) mapping each pixel to 1..numRegions (0 = hard ink core)
 * - distField: Float32Array(width * height) normalized 0..1 distance from region boundary
 * - regions: Array of region metadata sorted by importance (id 1..N)
 * - labeledCount: number of regions labeled with numbered badges for Gemini 4 Argon
 */
export function segmentColoringPage(srcImageData, options = {}) {
  const inkThreshold = options.inkThreshold ?? 172;
  const gapSeal = options.gapSeal ?? 1;
  const minRegionArea = options.minRegionArea ?? 20;

  const { width, height, data } = srcImageData;
  const total = width * height;

  const lum = new Uint8Array(total);
  const inkImageData = new ImageData(width, height);
  const inkData = inkImageData.data;
  const cleanLineImageData = new ImageData(width, height);
  const cleanData = cleanLineImageData.data;

  // Hard ink core vs soft anti-aliased ink ramp
  const hardCoreCutoff = Math.max(25, inkThreshold - 55);
  const rawBarrier = new Uint8Array(total);

  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    const alpha = data[idx + 3] / 255;
    const r = data[idx] * alpha + 255 * (1 - alpha);
    const g = data[idx + 1] * alpha + 255 * (1 - alpha);
    const b = data[idx + 2] * alpha + 255 * (1 - alpha);
    const l = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    lum[i] = l;

    if (l < inkThreshold) {
      rawBarrier[i] = 1;
      const t = Math.min(1, Math.max(0, (inkThreshold - l) / Math.max(1, inkThreshold - 28)));
      // Smooth S-curve for crisp anti-aliased ink
      const inkAlpha = Math.round(Math.pow(t, 0.85) * 255);
      inkData[idx] = 20;
      inkData[idx + 1] = 20;
      inkData[idx + 2] = 24;
      inkData[idx + 3] = inkAlpha;

      const cleanVal = Math.round(255 * (1 - Math.pow(t, 0.9)));
      cleanData[idx] = cleanVal;
      cleanData[idx + 1] = cleanVal;
      cleanData[idx + 2] = cleanVal;
      cleanData[idx + 3] = 255;
    } else {
      inkData[idx] = 0;
      inkData[idx + 1] = 0;
      inkData[idx + 2] = 0;
      inkData[idx + 3] = 0;

      cleanData[idx] = 255;
      cleanData[idx + 1] = 255;
      cleanData[idx + 2] = 255;
      cleanData[idx + 3] = 255;
    }
  }

  // Morphological dilation for gap sealing so tiny line breaks don't leak color
  let sealedBarrier = rawBarrier;
  if (gapSeal > 0) {
    sealedBarrier = new Uint8Array(total);
    const r = Math.min(3, gapSeal);
    for (let y = 0; y < height; y++) {
      const yMin = Math.max(0, y - r);
      const yMax = Math.min(height - 1, y + r);
      for (let x = 0; x < width; x++) {
        if (rawBarrier[y * width + x]) {
          sealedBarrier[y * width + x] = 1;
          continue;
        }
        let hit = 0;
        for (let yy = yMin; yy <= yMax && !hit; yy++) {
          const row = yy * width;
          const xMin = Math.max(0, x - r);
          const xMax = Math.min(width - 1, x + r);
          for (let xx = xMin; xx <= xMax; xx++) {
            if (rawBarrier[row + xx] && lum[row + xx] < inkThreshold - 18) {
              hit = 1;
              break;
            }
          }
        }
        sealedBarrier[y * width + x] = hit;
      }
    }
  }

  // Connected-Component BFS on non-barrier pixels
  const rawLabels = new Int32Array(total);
  const queue = new Int32Array(total);
  const rawRegions = [];
  let nextRawId = 1;

  for (let i = 0; i < total; i++) {
    if (sealedBarrier[i] || rawLabels[i] !== 0) continue;

    const id = nextRawId++;
    let head = 0;
    let tail = 0;
    queue[tail++] = i;
    rawLabels[i] = id;

    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;
    let sumX = 0;
    let sumY = 0;
    let touchesBorder = false;

    while (head < tail) {
      const curr = queue[head++];
      const y = (curr / width) | 0;
      const x = curr - y * width;

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      sumX += x;
      sumY += y;

      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
        touchesBorder = true;
      }

      // 4-connectivity keeps regions separated by diagonal 1px lines
      if (x > 0) {
        const n = curr - 1;
        if (!sealedBarrier[n] && rawLabels[n] === 0) {
          rawLabels[n] = id;
          queue[tail++] = n;
        }
      }
      if (x < width - 1) {
        const n = curr + 1;
        if (!sealedBarrier[n] && rawLabels[n] === 0) {
          rawLabels[n] = id;
          queue[tail++] = n;
        }
      }
      if (y > 0) {
        const n = curr - width;
        if (!sealedBarrier[n] && rawLabels[n] === 0) {
          rawLabels[n] = id;
          queue[tail++] = n;
        }
      }
      if (y < height - 1) {
        const n = curr + width;
        if (!sealedBarrier[n] && rawLabels[n] === 0) {
          rawLabels[n] = id;
          queue[tail++] = n;
        }
      }
    }

    const area = tail;
    rawRegions.push({
      rawId: id,
      area,
      minX,
      maxX,
      minY,
      maxY,
      meanX: sumX / area,
      meanY: sumY / area,
      touchesBorder,
    });
  }

  // Filter out tiny speckle regions (< minRegionArea) or keep them if there are very few regions
  const validRaw = rawRegions.filter((r) => r.area >= minRegionArea);
  if (validRaw.length === 0 && rawRegions.length > 0) {
    validRaw.push(...rawRegions);
  }

  // Sort regions so the most visually significant enclosed areas get numbered 1..MAX_ARGON_LABELED_REGIONS
  // We slightly prioritize interior object regions over tiny border slivers, while still including large background regions
  validRaw.sort((a, b) => {
    const scoreA = a.area * (a.touchesBorder ? 0.75 : 1.0);
    const scoreB = b.area * (b.touchesBorder ? 0.75 : 1.0);
    return scoreB - scoreA;
  });

  // Remap rawIds -> sorted 1..N ids
  const remap = new Int32Array(nextRawId);
  const regions = validRaw.map((r, idx) => {
    const newId = idx + 1;
    remap[r.rawId] = newId;
    return {
      id: newId,
      area: r.area,
      areaPct: Number(((r.area / total) * 100).toFixed(2)),
      minX: r.minX,
      maxX: r.maxX,
      minY: r.minY,
      maxY: r.maxY,
      cx: Math.round(r.meanX),
      cy: Math.round(r.meanY),
      maxDist: 0,
      touchesBorder: r.touchesBorder,
      isLabeled: newId <= MAX_ARGON_LABELED_REGIONS,
      neighbors: new Set(),
    };
  });

  const regionMap = new Int32Array(total);
  for (let i = 0; i < total; i++) {
    const rId = rawLabels[i];
    if (rId > 0) {
      regionMap[i] = remap[rId];
    }
  }

  // Expand region labels by (gapSeal + 2) iterations into anti-aliased fringe & tiny specks
  // so color reaches cleanly underneath the anti-aliased black ink lines (zero white halos!)
  const expandPasses = Math.max(2, gapSeal + 2);
  let currentMap = regionMap;
  for (let pass = 0; pass < expandPasses; pass++) {
    const nextMap = new Int32Array(currentMap);
    for (let y = 0; y < height; y++) {
      const row = y * width;
      for (let x = 0; x < width; x++) {
        const idx = row + x;
        if (currentMap[idx] !== 0) continue;
        // On last pass only stop at ultra-black ink core
        if (pass === expandPasses - 1 && lum[idx] < hardCoreCutoff) continue;

        let bestLabel = 0;
        if (x > 0 && currentMap[idx - 1] > 0) bestLabel = currentMap[idx - 1];
        else if (x < width - 1 && currentMap[idx + 1] > 0) bestLabel = currentMap[idx + 1];
        else if (y > 0 && currentMap[idx - width] > 0) bestLabel = currentMap[idx - width];
        else if (y < height - 1 && currentMap[idx + width] > 0) bestLabel = currentMap[idx + width];

        if (bestLabel > 0) {
          nextMap[idx] = bestLabel;
        }
      }
    }
    currentMap = nextMap;
  }

  // Compute 2-Pass Chamfer Distance Transform inside each region to find:
  // 1) Each region's Pole of Inaccessibility (cx, cy) — guaranteed deepest interior point for badge & seed
  // 2) Normalized distance field for watercolor/pencil edge shading
  const dist = new Float32Array(total);
  const INF = 1e6;

  for (let i = 0; i < total; i++) {
    dist[i] = currentMap[i] > 0 && !rawBarrier[i] ? INF : 0;
  }

  // Forward pass
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const idx = row + x;
      const rid = currentMap[idx];
      if (rid === 0 || dist[idx] === 0) continue;

      let d = dist[idx];
      if (x > 0) {
        const left = idx - 1;
        d = Math.min(d, currentMap[left] === rid ? dist[left] + 1 : 1);
      } else {
        d = 1;
      }
      if (y > 0) {
        const up = idx - width;
        d = Math.min(d, currentMap[up] === rid ? dist[up] + 1 : 1);
      } else {
        d = 1;
      }
      dist[idx] = d;
    }
  }

  // Backward pass + find maxDist pole of inaccessibility per region
  for (let y = height - 1; y >= 0; y--) {
    const row = y * width;
    for (let x = width - 1; x >= 0; x--) {
      const idx = row + x;
      const rid = currentMap[idx];
      if (rid === 0 || dist[idx] === 0) continue;

      let d = dist[idx];
      if (x < width - 1) {
        const right = idx + 1;
        d = Math.min(d, currentMap[right] === rid ? dist[right] + 1 : 1);
      } else {
        d = 1;
      }
      if (y < height - 1) {
        const down = idx + width;
        d = Math.min(d, currentMap[down] === rid ? dist[down] + 1 : 1);
      } else {
        d = 1;
      }
      dist[idx] = d;

      const reg = regions[rid - 1];
      if (reg && d > reg.maxDist) {
        reg.maxDist = d;
        reg.cx = x;
        reg.cy = y;
      }
    }
  }

  // Normalize distance field 0..1 within each region and build region adjacency graph
  const normDist = new Float32Array(total);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const idx = row + x;
      const rid = currentMap[idx];
      if (rid <= 0) continue;
      const reg = regions[rid - 1];
      if (reg && reg.maxDist > 0) {
        normDist[idx] = Math.min(1, dist[idx] / Math.min(reg.maxDist, 28));
      }

      // Check 2px step neighbors across thin ink lines to build region adjacency graph
      if (x + 3 < width) {
        const nRid = currentMap[idx + 3];
        if (nRid > 0 && nRid !== rid) {
          regions[rid - 1].neighbors.add(nRid);
          regions[nRid - 1].neighbors.add(rid);
        }
      }
      if (y + 3 < height) {
        const nRid = currentMap[idx + width * 3];
        if (nRid > 0 && nRid !== rid) {
          regions[rid - 1].neighbors.add(nRid);
          regions[nRid - 1].neighbors.add(rid);
        }
      }
    }
  }

  // Compute normalized 0..1000 coordinates for Gemini 4 Argon prompt
  for (const reg of regions) {
    reg.nx = Math.round((reg.cx / width) * 1000);
    reg.ny = Math.round((reg.cy / height) * 1000);
    reg.neighbors = Array.from(reg.neighbors);
  }

  return {
    width,
    height,
    inkImageData,
    cleanLineImageData,
    regionMap: currentMap,
    distField: normDist,
    regions,
    labeledCount: Math.min(regions.length, MAX_ARGON_LABELED_REGIONS),
  };
}

/**
 * Render the annotated Numbered Region Blueprint PNG dataURL + Clean Line Art PNG dataURL
 * to send to Google Gemini 4 Argon so it can see both the clean illustration and exact region IDs.
 */
export function buildArgonVisionImages(segmentation) {
  const { width, height, cleanLineImageData, regions, regionMap } = segmentation;

  // 1. Clean line art data URL
  const cleanCanvas = document.createElement('canvas');
  cleanCanvas.width = width;
  cleanCanvas.height = height;
  const cleanCtx = cleanCanvas.getContext('2d');
  cleanCtx.putImageData(cleanLineImageData, 0, 0);
  const cleanDataUrl = cleanCanvas.toDataURL('image/png');

  // 2. Annotated Blueprint with pastel region tints + crisp numbered tags [1..N]
  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = width;
  mapCanvas.height = height;
  const mapCtx = mapCanvas.getContext('2d');

  // Subtle pastel tint per region so region boundaries are visually unmistakable
  const tintedData = new ImageData(width, height);
  const srcClean = cleanLineImageData.data;
  const dst = tintedData.data;

  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    const rid = regionMap[i];
    const lineLum = srcClean[idx];
    if (rid > 0 && rid <= MAX_ARGON_LABELED_REGIONS && lineLum > 160) {
      // Golden-angle hue rotation for distinct subtle region tint
      const hue = ((rid * 137.5) % 360) * (Math.PI / 180);
      const rTint = 242 + Math.round(Math.cos(hue) * 11);
      const gTint = 242 + Math.round(Math.cos(hue - 2.09) * 11);
      const bTint = 242 + Math.round(Math.cos(hue + 2.09) * 11);
      dst[idx] = rTint;
      dst[idx + 1] = gTint;
      dst[idx + 2] = bTint;
      dst[idx + 3] = 255;
    } else {
      dst[idx] = srcClean[idx];
      dst[idx + 1] = srcClean[idx + 1];
      dst[idx + 2] = srcClean[idx + 2];
      dst[idx + 3] = 255;
    }
  }
  mapCtx.putImageData(tintedData, 0, 0);

  // Draw crisp numbered pills at each labeled region's Pole of Inaccessibility
  const labeledRegions = regions.filter((r) => r.isLabeled);
  mapCtx.textAlign = 'center';
  mapCtx.textBaseline = 'middle';

  for (const reg of labeledRegions) {
    const label = String(reg.id);
    const fontSize = reg.maxDist < 9 ? 9 : reg.maxDist < 16 ? 11 : 12;
    mapCtx.font = `700 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    const textW = mapCtx.measureText(label).width;
    const padX = 4;
    const pillW = Math.max(fontSize + 4, textW + padX * 2);
    const pillH = fontSize + 5;
    const rx = reg.cx - pillW / 2;
    const ry = reg.cy - pillH / 2;

    // High-contrast badge
    mapCtx.fillStyle = 'rgba(255, 255, 255, 0.94)';
    mapCtx.strokeStyle = '#18181b';
    mapCtx.lineWidth = 1.5;
    mapCtx.beginPath();
    mapCtx.roundRect(rx, ry, pillW, pillH, 4);
    mapCtx.fill();
    mapCtx.stroke();

    mapCtx.fillStyle = '#141212';
    mapCtx.fillText(label, reg.cx, reg.cy + 0.5);
  }

  const annotatedDataUrl = mapCanvas.toDataURL('image/png');
  return { cleanDataUrl, annotatedDataUrl };
}
