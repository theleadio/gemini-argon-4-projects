// Soft-Body Jelly Gummy Bear Physics & Translucent Renderer

const FLAVORS = [
  { id: 'cherry', name: 'Cherry Red', hex: '#ff2442', inner: '#ff8598', rim: '#9e0620' },
  { id: 'pineapple', name: 'Pineapple Gold', hex: '#ffb703', inner: '#fff07c', rim: '#b86b00' },
  { id: 'apple', name: 'Green Apple', hex: '#2ec4b6', inner: '#a8ff78', rim: '#0b7a53', displayHex: '#38d353' },
  { id: 'raspberry', name: 'Blue Raspberry', hex: '#00a8ff', inner: '#90e0ef', rim: '#004e89' },
  { id: 'grape', name: 'Grape Fizz', hex: '#9b5de5', inner: '#e0aaff', rim: '#4a148c' },
  { id: 'peach', name: 'Juicy Peach', hex: '#ff6b4a', inner: '#ffd166', rim: '#b52b10' },
  { id: 'watermelon', name: 'Watermelon Pink', hex: '#ff4d8d', inner: '#ffb3c6', rim: '#990f4b' },
  { id: 'cola', name: 'Classic Cola', hex: '#9c4118', inner: '#f4a261', rim: '#421604' },
  { id: 'lemon', name: 'Electric Lemon', hex: '#f4e409', inner: '#ffffb5', rim: '#9e8c00' },
  { id: 'rainbow', name: 'Rainbow Mystery', hex: '#ff3cac', inner: '#00f5d4', rim: '#560bad', isRainbow: true }
];

// Normalize Green Apple hex so it looks crisp green
FLAVORS[2].hex = '#2bd94f';

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function rgbToCss(rgb, alpha = 1) {
  return `rgba(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}, ${alpha})`;
}

function derivePalette(hex, isRainbow = false) {
  const base = hexToRgb(hex);
  const inner = {
    r: Math.min(255, base.r + (255 - base.r) * 0.58),
    g: Math.min(255, base.g + (255 - base.g) * 0.58),
    b: Math.min(255, base.b + (255 - base.b) * 0.58)
  };
  const rim = {
    r: Math.max(0, base.r * 0.42),
    g: Math.max(0, base.g * 0.42),
    b: Math.max(0, base.b * 0.42)
  };
  return { hex, base, inner, rim, isRainbow };
}

// Create the 28-point Gummy Bear silhouette in local rest coordinates (radius ~ 65px at scale=1)
function createGummyTemplate() {
  // Symmetric gummy bear contour (clockwise starting from top of head)
  // Carefully sculpted to have distinct round ears, chubby cheeks, stubby arms, round belly, and plump legs
  const rightSide = [
    { x: 0, y: -62, tag: 'headTop' },
    { x: 14, y: -61, tag: 'head' },
    // Right Ear (3 points)
    { x: 24, y: -74, tag: 'earR' },
    { x: 39, y: -73, tag: 'earR_tip' },
    { x: 43, y: -57, tag: 'earR' },
    // Right Cheek & Neck
    { x: 37, y: -42, tag: 'cheekR' },
    { x: 42, y: -27, tag: 'CheekLowR' },
    { x: 31, y: -15, tag: 'neckR' },
    // Right Arm / Paw
    { x: 48, y: -12, tag: 'armR' },
    { x: 56, y: 2, tag: 'armR_tip' },
    { x: 44, y: 14, tag: 'armR' },
    // Right Waist / Belly
    { x: 41, y: 27, tag: 'bellyR' },
    { x: 45, y: 42, tag: 'hipR' },
    // Right Foot / Leg
    { x: 47, y: 59, tag: 'legR' },
    { x: 34, y: 69, tag: 'legR_tip' },
    { x: 16, y: 65, tag: 'legR_in' },
    // Bottom center
    { x: 0, y: 54, tag: 'crotch' }
  ];

  const points = [];
  // Add right side
  for (let i = 0; i < rightSide.length; i++) {
    points.push({ x: rightSide[i].x, y: rightSide[i].y, tag: rightSide[i].tag });
  }
  // Mirror left side (excluding bottom and top center)
  for (let i = rightSide.length - 2; i >= 1; i--) {
    const p = rightSide[i];
    const tag = p.tag.replace('R', 'L');
    points.push({ x: -p.x, y: p.y, tag });
  }

  // Center the template so the centroid of all vertices is exactly (0, 0)
  // This guarantees shape-matching forces sum to zero net linear momentum.
  let meanX = 0;
  let meanY = 0;
  for (let i = 0; i < points.length; i++) {
    meanX += points[i].x;
    meanY += points[i].y;
  }
  meanX /= points.length;
  meanY /= points.length;
  for (let i = 0; i < points.length; i++) {
    points[i].x -= meanX;
    points[i].y -= meanY;
  }

  return points;
}

const BEAR_TEMPLATE = createGummyTemplate();
const TEMPLATE_OFFSET_Y = 10.5; // Visual offset from vertex centroid to geometric center

function computePolygonArea(nodes) {
  let area = 0;
  const n = nodes.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += nodes[i].x * nodes[j].y - nodes[j].x * nodes[i].y;
  }
  return area * 0.5;
}

class GummyBear {
  constructor(x, y, options = {}) {
    this.id = Math.random().toString(36).slice(2, 9);
    this.scale = options.scale || 1.0;
    this.colorHex = options.colorHex || FLAVORS[0].hex;
    this.isRainbow = Boolean(options.isRainbow);
    this.palette = derivePalette(this.colorHex, this.isRainbow);
    this.coating = options.coating || 'glossy';
    this.mood = options.mood || 'auto';

    this.nodes = [];
    this.springs = [];
    this.bites = []; // Local coordinates { lx, ly, r }

    // Build perimeter nodes from template
    const initialAngle = (Math.random() - 0.5) * 0.4;
    const cosA = Math.cos(initialAngle);
    const sinA = Math.sin(initialAngle);

    for (let i = 0; i < BEAR_TEMPLATE.length; i++) {
      const tp = BEAR_TEMPLATE[i];
      const rx = tp.x * this.scale;
      const ry = tp.y * this.scale;
      const wx = x + rx * cosA - ry * sinA;
      const wy = y + rx * sinA + ry * cosA;

      this.nodes.push({
        x: wx,
        y: wy,
        vx: (Math.random() - 0.5) * 2,
        vy: options.initialVy !== undefined ? options.initialVy : 2,
        rx, // rest local x
        ry, // rest local y
        baseRx: tp.x,
        baseRy: tp.y,
        tag: tp.tag,
        biteIndent: 1.0
      });
    }

    this.restArea = Math.abs(computePolygonArea(this.nodes.map(n => ({ x: n.rx, y: n.ry }))));
    this.cx = x;
    this.cy = y;
    this.angle = initialAngle;
    this.angularVel = 0;
    this.stretchMetric = 0;
    this.squishFlash = 0;
    this.blinkTimer = 80 + Math.random() * 180;
    this.isBlinking = false;
    this.rainbowOffset = Math.random() * 360;

    // Generate sour sugar crystals in local normalized coordinates
    this.sugarGrains = [];
    for (let i = 0; i < 68; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.sqrt(Math.random());
      const gx = Math.cos(angle) * dist * 40;
      const gy = Math.sin(angle) * dist * 58;
      this.sugarGrains.push({
        lx: gx,
        ly: gy,
        size: 2.0 + Math.random() * 2.4,
        rot: Math.random() * Math.PI
      });
    }

    this.buildSprings();
  }

  buildSprings() {
    this.springs = [];
    const n = this.nodes.length;

    const addSpring = (i, j, stiffnessMult = 1.0) => {
      const a = this.nodes[i];
      const b = this.nodes[j];
      const dx = a.rx - b.rx;
      const dy = a.ry - b.ry;
      const restLen = Math.hypot(dx, dy);
      this.springs.push({ i, j, restLen, stiffnessMult });
    };

    for (let i = 0; i < n; i++) {
      // Perimeter edge springs
      addSpring(i, (i + 1) % n, 1.0);
      // Bending resistance springs
      addSpring(i, (i + 2) % n, 0.75);
      addSpring(i, (i + 3) % n, 0.5);
      // Cross structural springs across the body
      addSpring(i, (i + 7) % n, 0.32);
      addSpring(i, (i + Math.floor(n / 2)) % n, 0.28);
    }

    // Extra symmetry cross-braces (left-to-right across ears, arms, waist, legs)
    for (let i = 1; i < Math.floor(n / 2); i++) {
      const mirrorIdx = n - i;
      addSpring(i, mirrorIdx, 0.45);
    }
  }

  setScale(newScale) {
    this.scale = Math.max(0.45, Math.min(2.4, newScale));
    let meanRx = 0;
    let meanRy = 0;
    for (const node of this.nodes) {
      node.rx = node.baseRx * this.scale * node.biteIndent;
      node.ry = node.baseRy * this.scale * node.biteIndent;
      meanRx += node.rx;
      meanRy += node.ry;
    }
    meanRx /= this.nodes.length;
    meanRy /= this.nodes.length;
    for (const node of this.nodes) {
      node.rx -= meanRx;
      node.ry -= meanRy;
    }
    this.restArea = Math.abs(computePolygonArea(this.nodes.map(n => ({ x: n.rx, y: n.ry }))));
    for (const s of this.springs) {
      const a = this.nodes[s.i];
      const b = this.nodes[s.j];
      s.restLen = Math.hypot(a.rx - b.rx, a.ry - b.ry);
    }
  }

  setColor(hex, isRainbow = false) {
    this.colorHex = hex;
    this.isRainbow = isRainbow;
    this.palette = derivePalette(hex, isRainbow);
  }

  // Convert a world point (wx, wy) to local unscaled bear coordinates
  worldToLocal(wx, wy) {
    const dx = wx - this.cx;
    const dy = wy - this.cy;
    const cosA = Math.cos(-this.angle);
    const sinA = Math.sin(-this.angle);
    return {
      lx: (dx * cosA - dy * sinA) / this.scale,
      ly: (dx * sinA + dy * cosA) / this.scale - TEMPLATE_OFFSET_Y
    };
  }

  // Convert local unscaled bear coordinates (lx, ly) to world coordinates
  localToWorld(lx, ly) {
    const sx = lx * this.scale;
    const sy = (ly + TEMPLATE_OFFSET_Y) * this.scale;
    const cosA = Math.cos(this.angle);
    const sinA = Math.sin(this.angle);
    return {
      x: this.cx + sx * cosA - sy * sinA,
      y: this.cy + sx * sinA + sy * cosA
    };
  }

  takeBite(wx, wy) {
    const local = this.worldToLocal(wx, wy);
    const biteRadius = 22 + Math.random() * 6;
    this.bites.push({
      lx: local.lx,
      ly: local.ly,
      r: biteRadius
    });

    // Also pull in nearby contour vertices slightly for physical deformation
    const shiftedLy = local.ly + TEMPLATE_OFFSET_Y;
    for (const node of this.nodes) {
      const dist = Math.hypot(node.baseRx - local.lx, node.baseRy - shiftedLy);
      if (dist < biteRadius * 1.45) {
        node.biteIndent = Math.max(0.58, node.biteIndent * 0.82);
        node.rx = node.baseRx * this.scale * node.biteIndent;
        node.ry = node.baseRy * this.scale * node.biteIndent;
      }
    }
    this.setScale(this.scale);
  }

  // Compute best-fit center of mass and rotation angle (Procrustes shape matching)
  computeShapeMatch() {
    let sumX = 0;
    let sumY = 0;
    const n = this.nodes.length;
    for (let i = 0; i < n; i++) {
      sumX += this.nodes[i].x;
      sumY += this.nodes[i].y;
    }
    this.cx = sumX / n;
    this.cy = sumY / n;

    // Optimal rotation angle aligning rest (rx, ry) to current (x - cx, y - cy)
    let dot = 0;
    let cross = 0;
    for (let i = 0; i < n; i++) {
      const node = this.nodes[i];
      const px = node.x - this.cx;
      const py = node.y - this.cy;
      dot += px * node.rx + py * node.ry;
      cross += node.rx * py - node.ry * px;
    }
    const newAngle = Math.atan2(cross, dot);
    let dAngle = newAngle - this.angle;
    while (dAngle > Math.PI) dAngle -= Math.PI * 2;
    while (dAngle < -Math.PI) dAngle += Math.PI * 2;
    this.angularVel = dAngle;
    this.angle = newAngle;
  }

  step(dt, worldConfig, grabbedState) {
    const n = this.nodes.length;
    const { gravity, stiffness, bounce, width, height } = worldConfig;

    // 1. Update center of mass & best-fit orientation
    this.computeShapeMatch();
    const cosA = Math.cos(this.angle);
    const sinA = Math.sin(this.angle);

    // 2. Apply external forces (gravity + shape-matching target force)
    const shapeStrength = 0.045 + Math.pow(stiffness, 1.7) * 0.28;
    const damping = 0.965 - stiffness * 0.03;

    let totalStretch = 0;

    for (let i = 0; i < n; i++) {
      const node = this.nodes[i];
      node.vy += gravity * dt;

      // Target position from rotated rest shape
      const tx = this.cx + node.rx * cosA - node.ry * sinA;
      const ty = this.cy + node.rx * sinA + node.ry * cosA;

      const dx = tx - node.x;
      const dy = ty - node.y;
      totalStretch += Math.hypot(dx, dy);

      node.vx += dx * shapeStrength;
      node.vy += dy * shapeStrength;
    }

    this.stretchMetric = totalStretch / (n * this.scale);

    // 3. Solve Spring Network
    const springRate = 0.18 + stiffness * 0.42;
    for (let sIdx = 0; sIdx < this.springs.length; sIdx++) {
      const s = this.springs[sIdx];
      const a = this.nodes[s.i];
      const b = this.nodes[s.j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 0.0001;
      const diff = (dist - s.restLen) / dist;
      const k = springRate * s.stiffnessMult * 0.5;

      const fx = dx * diff * k;
      const fy = dy * diff * k;

      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }

    // 4. Internal Jelly Pressure / Volume Preservation (Shoelace Area Constraint)
    // Using edge-weighted normals (Divergence Theorem) guarantees the sum of internal
    // pressure forces across all vertices is identically (0, 0) — no ghost drift!
    const currentArea = computePolygonArea(this.nodes);
    const areaError = (this.restArea - Math.abs(currentArea)) / (this.restArea || 1);
    const pressureCoeff = Math.max(-0.5, Math.min(0.6, areaError)) * (0.012 / this.scale) * (0.4 + stiffness * 0.6);

    for (let i = 0; i < n; i++) {
      const prev = this.nodes[(i - 1 + n) % n];
      const next = this.nodes[(i + 1) % n];
      // Edge-length weighted outward normal: sums to (0, 0) over closed loop
      const nx = (next.y - prev.y) * 0.5;
      const ny = -(next.x - prev.x) * 0.5;

      this.nodes[i].vx += nx * pressureCoeff;
      this.nodes[i].vy += ny * pressureCoeff;
    }

    // 5. Apply User Grab / Stretch Force if this bear is being dragged
    if (grabbedState && grabbedState.bear === this) {
      const { nodeIndex, pointerX, pointerY } = grabbedState;
      const primary = this.nodes[nodeIndex];

      for (let i = 0; i < n; i++) {
        const node = this.nodes[i];
        // Circular index distance around contour
        const idxDiff = Math.min(Math.abs(i - nodeIndex), n - Math.abs(i - nodeIndex));
        if (idxDiff <= 3) {
          const weight = idxDiff === 0 ? 1.0 : Math.pow(0.58, idxDiff);
          const offsetRx = (node.rx - primary.rx) * cosA - (node.ry - primary.ry) * sinA;
          const offsetRy = (node.rx - primary.rx) * sinA + (node.ry - primary.ry) * cosA;
          const targetX = pointerX + offsetRx * 0.5;
          const targetY = pointerY + offsetRy * 0.5;

          node.vx = (node.vx * 0.35) + (targetX - node.x) * 0.48 * weight;
          node.vy = (node.vy * 0.35) + (targetY - node.y) * 0.48 * weight;
        }
      }
    }

    // 6. Integrate positions & Wall Collisions
    let maxWallImpact = 0;
    const pad = 6;
    const floorY = height - pad;
    const ceilY = pad;
    const leftX = pad;
    const rightX = width - pad;

    for (let i = 0; i < n; i++) {
      const node = this.nodes[i];
      node.vx *= damping;
      node.vy *= damping;

      // Clamp extreme velocities for numerical stability
      const speed = Math.hypot(node.vx, node.vy);
      if (speed > 42) {
        node.vx = (node.vx / speed) * 42;
        node.vy = (node.vy / speed) * 42;
      }

      node.x += node.vx * dt;
      node.y += node.vy * dt;

      // Floor collision
      if (node.y > floorY) {
        const impact = Math.abs(node.vy);
        if (impact > maxWallImpact) maxWallImpact = impact;
        node.y = floorY;
        node.vy = -Math.abs(node.vy) * bounce;
        node.vx *= 0.88; // Floor friction
      } else if (node.y < ceilY) {
        const impact = Math.abs(node.vy);
        if (impact > maxWallImpact) maxWallImpact = impact;
        node.y = ceilY;
        node.vy = Math.abs(node.vy) * bounce;
      }

      // Left / Right wall collision
      if (node.x < leftX) {
        const impact = Math.abs(node.vx);
        if (impact > maxWallImpact) maxWallImpact = impact;
        node.x = leftX;
        node.vx = Math.abs(node.vx) * bounce;
      } else if (node.x > rightX) {
        const impact = Math.abs(node.vx);
        if (impact > maxWallImpact) maxWallImpact = impact;
        node.x = rightX;
        node.vx = -Math.abs(node.vx) * bounce;
      }
    }

    if (maxWallImpact > 7.5) {
      this.squishFlash = Math.min(1, maxWallImpact / 22);
      if (window.jellyAudio && maxWallImpact > 9.5) {
        window.jellyAudio.playBoing(Math.min(1, maxWallImpact / 24), this.scale);
      }
    } else {
      this.squishFlash *= 0.92;
    }

    // Blink animation timer
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      if (!this.isBlinking) {
        this.isBlinking = true;
        this.blinkTimer = 8;
      } else {
        this.isBlinking = false;
        this.blinkTimer = 110 + Math.random() * 200;
      }
    }
  }

  // Point-in-polygon hit test
  containsPoint(px, py) {
    const boundingR = 85 * this.scale;
    if (Math.hypot(px - this.cx, py - this.cy) > boundingR * 1.6) return false;

    let inside = false;
    const n = this.nodes.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = this.nodes[i].x, yi = this.nodes[i].y;
      const xj = this.nodes[j].x, yj = this.nodes[j].y;
      const intersect = ((yi > py) !== (yj > py)) &&
        (px < (xj - xi) * (py - yi) / ((yj - yi) || 0.00001) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  findClosestNode(px, py) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < this.nodes.length; i++) {
      const d = Math.hypot(this.nodes[i].x - px, this.nodes[i].y - py);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    return { index: bestIdx, distance: bestDist };
  }

  traceSmoothContour(ctx) {
    const pts = this.nodes;
    const n = pts.length;
    if (n < 3) return;

    ctx.beginPath();
    const firstMidX = (pts[n - 1].x + pts[0].x) * 0.5;
    const firstMidY = (pts[n - 1].y + pts[0].y) * 0.5;
    ctx.moveTo(firstMidX, firstMidY);

    for (let i = 0; i < n; i++) {
      const next = pts[(i + 1) % n];
      const midX = (pts[i].x + next.x) * 0.5;
      const midY = (pts[i].y + next.y) * 0.5;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
    }
    ctx.closePath();
  }

  draw(ctx, time) {
    ctx.save();
    let pal = this.palette;

    // Build smooth clip path for the gummy bear body + any bite cutouts
    this.traceSmoothContour(ctx);

    // Outer ambient drop shadow / neon bloom
    ctx.save();
    if (this.coating === 'neon') {
      ctx.shadowColor = this.colorHex;
      ctx.shadowBlur = 28 * this.scale;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    } else {
      ctx.shadowColor = 'rgba(8, 2, 18, 0.42)';
      ctx.shadowBlur = 18 * this.scale;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 8 * this.scale;
    }

    // Base translucent jelly fill
    const gradRadius = 72 * this.scale;
    const lightPos = this.localToWorld(-12, -18);
    const bodyGrad = ctx.createRadialGradient(
      lightPos.x, lightPos.y, 6 * this.scale,
      this.cx, this.cy, gradRadius
    );

    if (this.isRainbow) {
      const h1 = (time * 0.04 + this.rainbowOffset) % 360;
      const h2 = (h1 + 110) % 360;
      const h3 = (h1 + 220) % 360;
      bodyGrad.addColorStop(0, `hsla(${h1}, 95%, 76%, 0.92)`);
      bodyGrad.addColorStop(0.55, `hsla(${h2}, 92%, 56%, 0.88)`);
      bodyGrad.addColorStop(1, `hsla(${h3}, 88%, 34%, 0.94)`);
    } else {
      bodyGrad.addColorStop(0, rgbToCss(pal.inner, 0.93));
      bodyGrad.addColorStop(0.58, rgbToCss(pal.base, 0.88));
      bodyGrad.addColorStop(1, rgbToCss(pal.rim, 0.95));
    }

    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.restore();

    // Clip inside the gummy bear contour to draw subsurface details, highlights & sugar
    ctx.clip();

    // 1. Subsurface inner glow (warm gummy heart in torso & head)
    const bellyCenter = this.localToWorld(0, 14);
    const subsurfaceGrad = ctx.createRadialGradient(
      bellyCenter.x, bellyCenter.y, 2 * this.scale,
      bellyCenter.x, bellyCenter.y, 44 * this.scale
    );
    subsurfaceGrad.addColorStop(0, 'rgba(255, 255, 240, 0.34)');
    subsurfaceGrad.addColorStop(0.6, rgbToCss(pal.inner, 0.16));
    subsurfaceGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = subsurfaceGrad;
    ctx.beginPath();
    ctx.arc(bellyCenter.x, bellyCenter.y, 44 * this.scale, 0, Math.PI * 2);
    ctx.fill();

    // 2. Molded Gummy Bear Anatomy Ridges (Ears, Tummy U-groove, Paw Pads)
    this.drawMoldedAnatomy(ctx, pal);

    // 3. Glossy Specular Highlights
    this.drawSpecularHighlights(ctx);

    // 4. Sour Sugar Coating (if active)
    if (this.coating === 'sour') {
      this.drawSourSugar(ctx);
    }

    // 5. Cute Reactive Gummy Face
    this.drawFace(ctx);

    // 6. Inner rim contour stroke for gummy thickness
    this.traceSmoothContour(ctx);
    ctx.lineWidth = 3.2 * this.scale;
    ctx.strokeStyle = this.isRainbow
      ? 'rgba(255, 255, 255, 0.38)'
      : rgbToCss(pal.rim, 0.65);
    ctx.stroke();

    // 7. Bite marks visual chomp scallops along bitten edges
    if (this.bites.length > 0) {
      for (const b of this.bites) {
        const wp = this.localToWorld(b.lx, b.ly);
        const br = b.r * this.scale;
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(wp.x, wp.y, br, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Draw glistening gummy interior rim around bite
        ctx.beginPath();
        ctx.arc(wp.x, wp.y, br, 0, Math.PI * 2);
        ctx.lineWidth = 3.5 * this.scale;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  drawMoldedAnatomy(ctx, pal) {
    ctx.save();
    ctx.lineCap = 'round';

    // Ear dimples
    const earL = this.localToWorld(-31, -61);
    const earR = this.localToWorld(31, -61);
    ctx.fillStyle = rgbToCss(pal.rim, 0.28);
    ctx.beginPath();
    ctx.arc(earL.x, earL.y, 7.5 * this.scale, 0, Math.PI * 2);
    ctx.arc(earR.x, earR.y, 7.5 * this.scale, 0, Math.PI * 2);
    ctx.fill();

    // Classic Haribo-style molded chest & tummy U-rings
    const chestL = this.localToWorld(-18, -6);
    const chestMid = this.localToWorld(0, 5);
    const chestR = this.localToWorld(18, -6);

    ctx.beginPath();
    ctx.moveTo(chestL.x, chestL.y);
    ctx.quadraticCurveTo(chestMid.x, chestMid.y, chestR.x, chestR.y);
    ctx.lineWidth = 3.4 * this.scale;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.26)';
    ctx.stroke();

    // Round belly ridge
    const bellyTopL = this.localToWorld(-22, 16);
    const bellyBot = this.localToWorld(0, 44);
    const bellyTopR = this.localToWorld(22, 16);
    ctx.beginPath();
    ctx.moveTo(bellyTopL.x, bellyTopL.y);
    ctx.quadraticCurveTo(bellyBot.x, bellyBot.y, bellyTopR.x, bellyTopR.y);
    ctx.lineWidth = 3.2 * this.scale;
    ctx.strokeStyle = rgbToCss(pal.rim, 0.25);
    ctx.stroke();

    // Plump paw pads (hands & feet)
    const paws = [
      { lx: -44, ly: 2, r: 6.5 },
      { lx: 44, ly: 2, r: 6.5 },
      { lx: -32, ly: 57, r: 8.5 },
      { lx: 32, ly: 57, r: 8.5 }
    ];
    for (const paw of paws) {
      const wp = this.localToWorld(paw.lx, paw.ly);
      ctx.beginPath();
      ctx.arc(wp.x, wp.y, paw.r * this.scale, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fill();
      ctx.lineWidth = 1.6 * this.scale;
      ctx.strokeStyle = rgbToCss(pal.rim, 0.25);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawSpecularHighlights(ctx) {
    ctx.save();
    const glossAlpha = this.coating === 'glossy' ? 0.62 : (this.coating === 'neon' ? 0.5 : 0.28);

    // Forehead glossy arc
    const h1 = this.localToWorld(-19, -50);
    const h2 = this.localToWorld(-4, -55);
    const h3 = this.localToWorld(10, -49);
    ctx.beginPath();
    ctx.moveTo(h1.x, h1.y);
    ctx.quadraticCurveTo(h2.x, h2.y, h3.x, h3.y);
    ctx.lineWidth = 5.5 * this.scale;
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(255, 255, 255, ${glossAlpha})`;
    ctx.stroke();

    // Left tummy wet shine
    const b1 = this.localToWorld(-24, 12);
    const b2 = this.localToWorld(-26, 26);
    const b3 = this.localToWorld(-19, 36);
    ctx.beginPath();
    ctx.moveTo(b1.x, b1.y);
    ctx.quadraticCurveTo(b2.x, b2.y, b3.x, b3.y);
    ctx.lineWidth = 4.8 * this.scale;
    ctx.strokeStyle = `rgba(255, 255, 255, ${glossAlpha * 0.85})`;
    ctx.stroke();

    // Small specular dot near right ear & cheek
    const dotPos = this.localToWorld(-29, -63);
    ctx.fillStyle = `rgba(255, 255, 255, ${glossAlpha})`;
    ctx.beginPath();
    ctx.arc(dotPos.x, dotPos.y, 3.2 * this.scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawSourSugar(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
    for (let i = 0; i < this.sugarGrains.length; i++) {
      const g = this.sugarGrains[i];
      const wp = this.localToWorld(g.lx, g.ly);
      const sz = g.size * this.scale;
      ctx.save();
      ctx.translate(wp.x, wp.y);
      ctx.rotate(this.angle + g.rot);
      ctx.fillRect(-sz * 0.5, -sz * 0.5, sz, sz);
      ctx.restore();
    }
    ctx.restore();
  }

  drawFace(ctx) {
    ctx.save();
    const eyeL = this.localToWorld(-13.5, -34);
    const eyeR = this.localToWorld(13.5, -34);
    const snout = this.localToWorld(0, -24);

    // Determine effective expression
    let activeMood = this.mood;
    if (activeMood === 'auto') {
      if (this.stretchMetric > 9.5 || this.squishFlash > 0.35) {
        activeMood = 'shocked';
      } else if (Math.abs(this.angularVel) > 0.14) {
        activeMood = 'derp';
      } else {
        activeMood = 'happy';
      }
    }

    // Soft gummy snout bump
    ctx.beginPath();
    ctx.arc(snout.x, snout.y, 9.5 * this.scale, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fill();

    // Eyes
    const eyeRadius = 4.2 * this.scale;
    ctx.fillStyle = 'rgba(32, 10, 28, 0.82)';
    ctx.strokeStyle = 'rgba(32, 10, 28, 0.82)';
    ctx.lineWidth = 2.4 * this.scale;
    ctx.lineCap = 'round';

    if (activeMood === 'sleepy' || this.isBlinking) {
      // Closed happy/sleepy arcs
      for (const ep of [eyeL, eyeR]) {
        ctx.beginPath();
        ctx.arc(ep.x, ep.y, eyeRadius, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
      }
    } else if (activeMood === 'shocked') {
      // Wide "> <" or big O eyes when stretched/squished
      for (const ep of [eyeL, eyeR]) {
        ctx.beginPath();
        ctx.arc(ep.x, ep.y, eyeRadius * 1.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(ep.x - 1.2 * this.scale, ep.y - 1.2 * this.scale, eyeRadius * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(32, 10, 28, 0.82)';
      }
    } else if (activeMood === 'derp') {
      // Goofy asymmetric eyes
      ctx.beginPath();
      ctx.arc(eyeL.x, eyeL.y, eyeRadius * 1.3, 0, Math.PI * 2);
      ctx.arc(eyeR.x, eyeR.y, eyeRadius * 0.85, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(eyeL.x + 1.5 * this.scale, eyeL.y - 1.5 * this.scale, eyeRadius * 0.45, 0, Math.PI * 2);
      ctx.arc(eyeR.x - 1.2 * this.scale, eyeR.y + 1.0 * this.scale, eyeRadius * 0.35, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Classic cute glossy bead eyes
      for (const ep of [eyeL, eyeR]) {
        ctx.beginPath();
        ctx.arc(ep.x, ep.y, eyeRadius, 0, Math.PI * 2);
        ctx.fill();

        // Eye shine
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ep.x - 1.3 * this.scale, ep.y - 1.3 * this.scale, eyeRadius * 0.38, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(32, 10, 28, 0.82)';
      }
    }

    // Cute gummy nose triangle/oval
    const nosePos = this.localToWorld(0, -26.5);
    ctx.fillStyle = 'rgba(32, 10, 28, 0.78)';
    ctx.beginPath();
    ctx.arc(nosePos.x, nosePos.y, 3.1 * this.scale, 0, Math.PI * 2);
    ctx.fill();

    // Mouth
    const mouthCenter = this.localToWorld(0, -20.5);
    if (activeMood === 'shocked') {
      ctx.beginPath();
      ctx.arc(mouthCenter.x, mouthCenter.y + 2 * this.scale, 4.5 * this.scale, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(32, 10, 28, 0.78)';
      ctx.fill();
    } else {
      const mL = this.localToWorld(-5.5, -21);
      const mR = this.localToWorld(5.5, -21);
      const mBot = this.localToWorld(0, -16.5);
      ctx.beginPath();
      ctx.moveTo(mL.x, mL.y);
      ctx.quadraticCurveTo(mBot.x, mBot.y, mR.x, mR.y);
      ctx.strokeStyle = 'rgba(32, 10, 28, 0.78)';
      ctx.lineWidth = 2.2 * this.scale;
      ctx.stroke();

      if (activeMood === 'derp') {
        // Little pink tongue sticking out
        const tonguePos = this.localToWorld(2, -16.5);
        ctx.fillStyle = '#ff6b8b';
        ctx.beginPath();
        ctx.arc(tonguePos.x, tonguePos.y, 3.2 * this.scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }
}

// Soft-body Bear-to-Bear Collision Resolver
function resolveBearCollisions(bears, bounce = 0.75) {
  const count = bears.length;
  for (let i = 0; i < count; i++) {
    const A = bears[i];
    for (let j = i + 1; j < count; j++) {
      const B = bears[j];

      const dx = B.cx - A.cx;
      const dy = B.cy - A.cy;
      const dist = Math.hypot(dx, dy);
      const minRadius = 56 * (A.scale + B.scale);

      if (dist > minRadius * 1.35 || dist === 0) continue;

      // Push overlapping perimeter nodes apart smoothly
      const overlap = minRadius - dist;
      if (overlap > 0) {
        const nx = dx / dist;
        const ny = dy / dist;
        const push = overlap * 0.045 * (0.5 + bounce * 0.5);

        // Apply soft repulsion weighted to nodes facing the other bear
        for (let k = 0; k < A.nodes.length; k++) {
          const na = A.nodes[k];
          const toB = (na.x - A.cx) * nx + (na.y - A.cy) * ny;
          if (toB > 0) {
            na.vx -= nx * push * 1.35;
            na.vy -= ny * push * 1.35;
            na.x -= nx * overlap * 0.014;
            na.y -= ny * overlap * 0.014;
          }
        }

        for (let k = 0; k < B.nodes.length; k++) {
          const nb = B.nodes[k];
          const toA = (nb.x - B.cx) * (-nx) + (nb.y - B.cy) * (-ny);
          if (toA > 0) {
            nb.vx += nx * push * 1.35;
            nb.vy += ny * push * 1.35;
            nb.x += nx * overlap * 0.014;
            nb.y += ny * overlap * 0.014;
          }
        }

        // Direct node-to-node proximity repulsion for close contact
        for (let aIdx = 0; aIdx < A.nodes.length; aIdx += 2) {
          const na = A.nodes[aIdx];
          for (let bIdx = 0; bIdx < B.nodes.length; bIdx += 2) {
            const nb = B.nodes[bIdx];
            const ndx = nb.x - na.x;
            const ndy = nb.y - na.y;
            const ndist = Math.hypot(ndx, ndy);
            const minNodeDist = 14 * (A.scale + B.scale);
            if (ndist > 0 && ndist < minNodeDist) {
              const pen = (minNodeDist - ndist) * 0.22;
              const pnx = ndx / ndist;
              const pny = ndy / ndist;
              na.x -= pnx * pen;
              na.y -= pny * pen;
              nb.x += pnx * pen;
              nb.y += pny * pen;
              na.vx -= pnx * pen * bounce;
              na.vy -= pny * pen * bounce;
              nb.vx += pnx * pen * bounce;
              nb.vy += pny * pen * bounce;
            }
          }
        }
      }
    }
  }
}

window.FLAVORS = FLAVORS;
window.GummyBear = GummyBear;
window.resolveBearCollisions = resolveBearCollisions;
