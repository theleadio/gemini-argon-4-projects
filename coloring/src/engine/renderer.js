/**
 * Argon Atelier — Multi-Finish Pigment Renderer & Layer Compositor
 *
 * Supports 4 real-time artistic finishes underneath the anti-aliased ink layer:
 * - "watercolor": Directional gradient + pigment edge pooling (via Chamfer distance field) + cold-press paper grain
 * - "pencil": Botanical colored-pencil cross-hatch tooth + interior core luminosity
 * - "cel": Crisp 3-tone anime/editorial cel shading (highlight band, base tone, shadow rim)
 * - "flat": Pure solid pigment fill
 */

export function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return { r: 255, g: 255, b: 255 };
  let clean = hex.trim().replace(/^#/, '');
  if (clean.length === 3) {
    clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
  }
  const num = parseInt(clean, 16);
  if (Number.isNaN(num)) return { r: 220, g: 220, b: 220 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function rgbToHex(r, g, b) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

/**
 * Derive a harmonious secondary highlight/gradient color if not explicitly provided
 */
export function deriveSecondaryHex(primaryHex) {
  const { r, g, b } = hexToRgb(primaryHex);
  // Shift toward warm sunlit highlight
  const nr = Math.min(255, Math.round(r + (255 - r) * 0.28));
  const ng = Math.min(255, Math.round(g + (252 - g) * 0.26));
  const nb = Math.min(255, Math.round(b + (245 - b) * 0.22));
  return rgbToHex(nr, ng, nb);
}

/**
 * Render the Region Pigment ImageData for all currently colored regions.
 */
export function renderRegionPigmentBuffer(segmentation, regionColorsMap, finishMode = 'watercolor') {
  const { width, height, regionMap, distField, regions } = segmentation;
  const out = new ImageData(width, height);
  const data = out.data;

  // Pre-compile lookup tables by region ID (1..N) for fast inner pixel loop
  const maxId = regions.length;
  const hasColor = new Uint8Array(maxId + 1);
  const r1Arr = new Uint8Array(maxId + 1);
  const g1Arr = new Uint8Array(maxId + 1);
  const b1Arr = new Uint8Array(maxId + 1);
  const r2Arr = new Uint8Array(maxId + 1);
  const g2Arr = new Uint8Array(maxId + 1);
  const b2Arr = new Uint8Array(maxId + 1);
  const minXArr = new Int32Array(maxId + 1);
  const minYArr = new Int32Array(maxId + 1);
  const invSpanArr = new Float32Array(maxId + 1);

  for (let id = 1; id <= maxId; id++) {
    const entry = regionColorsMap.get(id);
    if (!entry || !entry.color) continue;
    hasColor[id] = 1;
    const c1 = hexToRgb(entry.color);
    const c2 = hexToRgb(entry.secondaryColor || deriveSecondaryHex(entry.color));
    r1Arr[id] = c1.r;
    g1Arr[id] = c1.g;
    b1Arr[id] = c1.b;
    r2Arr[id] = c2.r;
    g2Arr[id] = c2.g;
    b2Arr[id] = c2.b;

    const reg = regions[id - 1];
    minXArr[id] = reg.minX;
    minYArr[id] = reg.minY;
    const span = Math.max(12, reg.maxX - reg.minX + (reg.maxY - reg.minY));
    invSpanArr[id] = 1 / span;
  }

  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const i = row + x;
      const idx = i * 4;
      const rid = regionMap[i];

      if (rid <= 0 || !hasColor[rid]) {
        // Warm paper white for uncolored areas
        data[idx] = 255;
        data[idx + 1] = 255;
        data[idx + 2] = 255;
        data[idx + 3] = 255;
        continue;
      }

      const r1 = r1Arr[rid];
      const g1 = g1Arr[rid];
      const b1 = b1Arr[rid];
      const r2 = r2Arr[rid];
      const g2 = g2Arr[rid];
      const b2 = b2Arr[rid];

      // Normalized diagonal position within region bounding box (0 = top-left, 1 = bottom-right)
      const gradT = Math.min(
        1,
        Math.max(0, (x - minXArr[rid] + (y - minYArr[rid])) * invSpanArr[rid])
      );
      const d = distField[i]; // 0 at ink outline, 1 in deep interior

      let r = r1;
      let g = g1;
      let b = b1;

      if (finishMode === 'flat') {
        r = r1;
        g = g1;
        b = b1;
      } else if (finishMode === 'watercolor') {
        // Blend primary and secondary across region + edge pigment pooling + paper grain
        const blend = gradT * 0.55 + (1 - d) * 0.2;
        r = r1 * (1 - blend) + r2 * blend;
        g = g1 * (1 - blend) + g2 * blend;
        b = b1 * (1 - blend) + b2 * blend;

        // Watercolor edge pooling (darker/richer near ink boundary, airy center)
        const edgePool = d < 0.28 ? -12 * (1 - d / 0.28) : d > 0.72 ? 8 * ((d - 0.72) / 0.28) : 0;
        // Subtle deterministic cold-press paper tooth
        const hash = ((x * 73856093) ^ (y * 19349663)) & 255;
        const grain = ((hash / 255) - 0.5) * 7;

        r += edgePool + grain;
        g += edgePool + grain;
        b += edgePool + grain;
      } else if (finishMode === 'pencil') {
        // Colored pencil cross-hatch texture + white paper tooth showing through slightly in center
        const hatch1 = Math.sin((x + y) * 0.95);
        const hatch2 = Math.sin((x - y * 0.6) * 0.85);
        const tooth = (hatch1 * 0.6 + hatch2 * 0.4) * 11;
        const centerLift = d * 18;

        r = r1 * (1 - gradT * 0.35) + r2 * (gradT * 0.35) + tooth + centerLift;
        g = g1 * (1 - gradT * 0.35) + g2 * (gradT * 0.35) + tooth + centerLift;
        b = b1 * (1 - gradT * 0.35) + b2 * (gradT * 0.35) + tooth + centerLift;
      } else if (finishMode === 'cel') {
        // Crisp 3-band cel shading
        const lightMetric = (1 - gradT) * 0.65 + d * 0.35;
        if (lightMetric > 0.72) {
          // Highlight band
          r = r2 + (255 - r2) * 0.18;
          g = g2 + (255 - g2) * 0.18;
          b = b2 + (255 - b2) * 0.18;
        } else if (lightMetric < 0.32 || d < 0.15) {
          // Shadow band
          r = r1 * 0.84;
          g = g1 * 0.84;
          b = b1 * 0.84;
        } else {
          r = r1;
          g = g1;
          b = b1;
        }
      }

      data[idx] = r < 0 ? 0 : r > 255 ? 255 : r;
      data[idx + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
      data[idx + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
      data[idx + 3] = 255;
    }
  }

  return out;
}
