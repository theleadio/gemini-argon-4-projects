/**
 * Argon Atelier — Curated Starter Empty Coloring Book Pages
 *
 * Each starter sheet is drawn with crisp closed black ink contours on a 760x760 white canvas
 * so users can either upload their own coloring photo or test Gemini 4 Argon immediately.
 */

export const SAMPLE_COLORING_PAGES = [
  {
    id: 'cottage',
    title: 'Alpine Valley Cottage',
    category: 'Landscape & Architecture',
    regionsEstimate: 'Landscape',
    recommendedStyle: 'ghibli-gouache',
    defaultPrompt:
      'Color as a sunlit Studio Ghibli alpine valley with a golden yellow sun and rays, warm terracotta roof, timber cottage walls, snow-capped mountains, cerulean sky, and vibrant wildflowers.',
  },
  {
    id: 'owl',
    title: 'Celestial Clockwork Owl',
    category: 'Fantasy & Character',
    regionsEstimate: 'Fantasy',
    recommendedStyle: 'midnight-celestial',
    defaultPrompt:
      'Color the owl with rich tawny and cream feathers, luminous golden eyes, brass clockwork gears, a glowing crescent moon, and a deep twilight sky.',
  },
  {
    id: 'koi',
    title: 'Kyoto Koi & Lotus Pond',
    category: 'Nature & Aquatic',
    regionsEstimate: 'Aquatic',
    recommendedStyle: 'natural-vibrant',
    defaultPrompt:
      'Color one koi vibrant vermilion-orange and white, the second koi calico gold and ink-blue, with coral pink lotus blossoms, emerald lily pads, and turquoise pond water.',
  },
  {
    id: 'botanical',
    title: 'Botanical Glass Terrarium',
    category: 'Botanical Illustration',
    regionsEstimate: 'Botanical',
    recommendedStyle: 'autumn-botanical',
    defaultPrompt:
      'Color with lush tropical greens for the monstera and fern, dusty rose and coral for the lotus flower, jade succulent leaves, brass frame, and warm cream backdrop.',
  },
  {
    id: 'mandala',
    title: 'Monarch Stained-Glass Rose',
    category: 'Stained Glass & Mandala',
    regionsEstimate: 'Mandala',
    recommendedStyle: 'risograph-pop',
    defaultPrompt:
      'Color like a vibrant cathedral stained-glass window with monarch orange and gold butterfly wings, cobalt and teal outer rings, and ruby flower petals.',
  },
  {
    id: 'ramen',
    title: 'Lantern Ramen Yatai Stall',
    category: 'Cozy Street Scene',
    regionsEstimate: 'Street Scene',
    recommendedStyle: 'ghibli-gouache',
    defaultPrompt:
      'Color as a cozy warm-lit Japanese ramen stall at dusk with glowing red-orange paper lanterns, indigo noren curtains, warm wood counter, and a rich bowl of ramen.',
  },
];

export function renderSamplePageToImageData(pageId = 'cottage', size = 760) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Pure white paper background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = '#111114';
  ctx.fillStyle = '#FFFFFF';
  ctx.lineWidth = 3.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const s = size / 760;
  ctx.save();
  ctx.scale(s, s);

  if (pageId === 'cottage') {
    drawAlpineCottage(ctx);
  } else if (pageId === 'owl') {
    drawClockworkOwl(ctx);
  } else if (pageId === 'koi') {
    drawKoiPond(ctx);
  } else if (pageId === 'botanical') {
    drawBotanicalTerrarium(ctx);
  } else if (pageId === 'mandala') {
    drawMonarchMandala(ctx);
  } else if (pageId === 'ramen') {
    drawRamenStall(ctx);
  } else {
    drawAlpineCottage(ctx);
  }

  // Outer framing border so edge regions close cleanly
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#111114';
  ctx.strokeRect(4, 4, 752, 752);

  ctx.restore();
  return ctx.getImageData(0, 0, size, size);
}

function fillAndStroke(ctx) {
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.stroke();
}

function drawCloud(ctx, cx, cy, scale = 1) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.moveTo(-55, 20);
  ctx.bezierCurveTo(-75, 20, -80, -10, -50, -15);
  ctx.bezierCurveTo(-45, -45, -5, -50, 10, -25);
  ctx.bezierCurveTo(30, -45, 65, -30, 60, -5);
  ctx.bezierCurveTo(85, -5, 80, 20, 55, 20);
  ctx.closePath();
  fillAndStroke(ctx);
  ctx.restore();
}

function drawFlower(ctx, cx, cy, r = 18, petals = 6) {
  for (let i = 0; i < petals; i++) {
    const a = (i * Math.PI * 2) / petals;
    const px = cx + Math.cos(a) * r * 0.85;
    const py = cy + Math.sin(a) * r * 0.85;
    ctx.beginPath();
    ctx.arc(px, py, r * 0.55, 0, Math.PI * 2);
    fillAndStroke(ctx);
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
  fillAndStroke(ctx);
}

function drawPineTree(ctx, x, baseY, w, h) {
  // Trunk
  ctx.beginPath();
  ctx.rect(x - w * 0.14, baseY - h * 0.22, w * 0.28, h * 0.22);
  fillAndStroke(ctx);

  // 3 layered foliage tiers
  const tiers = [
    { yBottom: baseY - h * 0.18, yTop: baseY - h * 0.55, width: w },
    { yBottom: baseY - h * 0.44, yTop: baseY - h * 0.78, width: w * 0.8 },
    { yBottom: baseY - h * 0.66, yTop: baseY - h, width: w * 0.58 },
  ];
  for (const t of tiers) {
    ctx.beginPath();
    ctx.moveTo(x, t.yTop);
    ctx.lineTo(x + t.width / 2, t.yBottom);
    ctx.lineTo(x - t.width / 2, t.yBottom);
    ctx.closePath();
    fillAndStroke(ctx);
  }
}

function drawAlpineCottage(ctx) {
  // Sun & rays in upper left
  const sunX = 140;
  const sunY = 125;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI * 2) / 8;
    ctx.beginPath();
    ctx.moveTo(sunX + Math.cos(a) * 48, sunY + Math.sin(a) * 48);
    ctx.lineTo(sunX + Math.cos(a - 0.16) * 78, sunY + Math.sin(a - 0.16) * 78);
    ctx.lineTo(sunX + Math.cos(a + 0.16) * 78, sunY + Math.sin(a + 0.16) * 78);
    ctx.closePath();
    fillAndStroke(ctx);
  }
  ctx.beginPath();
  ctx.arc(sunX, sunY, 48, 0, Math.PI * 2);
  fillAndStroke(ctx);

  // Clouds
  drawCloud(ctx, 360, 95, 0.95);
  drawCloud(ctx, 610, 115, 0.85);

  // Distant Mountain Range (3 peaks with snow caps)
  const peaks = [
    { x1: 0, px: 190, py: 185, x2: 390, base: 450 },
    { x1: 220, px: 445, py: 150, x2: 670, base: 450 },
    { x1: 450, px: 640, py: 205, x2: 760, base: 450 },
  ];
  for (const p of peaks) {
    ctx.beginPath();
    ctx.moveTo(p.x1, p.base);
    ctx.lineTo(p.px, p.py);
    ctx.lineTo(p.x2, p.base);
    ctx.closePath();
    fillAndStroke(ctx);

    // Snow cap region
    const capRatio = 0.34;
    const lx = p.px + (p.x1 - p.px) * capRatio;
    const ly = p.py + (p.base - p.py) * capRatio;
    const rx = p.px + (p.x2 - p.px) * capRatio;
    const ry = p.py + (p.base - p.py) * capRatio;
    ctx.beginPath();
    ctx.moveTo(p.px, p.py);
    ctx.lineTo(rx, ry);
    ctx.lineTo(p.px + 18, ry - 14);
    ctx.lineTo(p.px - 15, ry + 6);
    ctx.lineTo(lx, ly);
    ctx.closePath();
    fillAndStroke(ctx);
  }

  // Rolling Valley Hills
  ctx.beginPath();
  ctx.moveTo(0, 445);
  ctx.quadraticCurveTo(220, 380, 470, 445);
  ctx.lineTo(470, 760);
  ctx.lineTo(0, 760);
  ctx.closePath();
  fillAndStroke(ctx);

  ctx.beginPath();
  ctx.moveTo(310, 455);
  ctx.quadraticCurveTo(540, 385, 760, 440);
  ctx.lineTo(760, 760);
  ctx.lineTo(310, 760);
  ctx.closePath();
  fillAndStroke(ctx);

  // Foreground Meadow
  ctx.beginPath();
  ctx.moveTo(0, 520);
  ctx.quadraticCurveTo(380, 475, 760, 525);
  ctx.lineTo(760, 760);
  ctx.lineTo(0, 760);
  ctx.closePath();
  fillAndStroke(ctx);

  // Pine Trees flanking the cottage
  drawPineTree(ctx, 105, 535, 115, 220);
  drawPineTree(ctx, 655, 545, 125, 240);

  // Cottage Chimney
  ctx.beginPath();
  ctx.rect(455, 225, 46, 110);
  fillAndStroke(ctx);
  ctx.beginPath();
  ctx.rect(448, 213, 60, 16);
  fillAndStroke(ctx);

  // Cottage Main Walls
  ctx.beginPath();
  ctx.rect(235, 345, 290, 195);
  fillAndStroke(ctx);

  // Decorative Half-Timber Beams on Cottage Wall
  ctx.beginPath();
  ctx.rect(235, 430, 290, 14);
  fillAndStroke(ctx);

  // Pitched Roof Overhang & Shingle Bands
  ctx.beginPath();
  ctx.moveTo(380, 205);
  ctx.lineTo(560, 360);
  ctx.lineTo(200, 360);
  ctx.closePath();
  fillAndStroke(ctx);

  ctx.beginPath();
  ctx.moveTo(380, 224);
  ctx.lineTo(532, 355);
  ctx.lineTo(228, 355);
  ctx.closePath();
  fillAndStroke(ctx);

  // Round Attic Window
  ctx.beginPath();
  ctx.arc(380, 298, 28, 0, Math.PI * 2);
  fillAndStroke(ctx);
  ctx.beginPath();
  ctx.moveTo(352, 298);
  ctx.lineTo(408, 298);
  ctx.moveTo(380, 270);
  ctx.lineTo(380, 326);
  ctx.stroke();

  // Arched Wooden Front Door
  ctx.beginPath();
  ctx.moveTo(345, 540);
  ctx.lineTo(345, 445);
  ctx.arc(380, 445, 35, Math.PI, 0, false);
  ctx.lineTo(415, 540);
  ctx.closePath();
  fillAndStroke(ctx);

  // Door Window & Plank Lines
  ctx.beginPath();
  ctx.arc(380, 452, 15, 0, Math.PI * 2);
  fillAndStroke(ctx);

  // Left & Right Windows with Shutters & Flower Boxes
  for (const wx of [282, 478]) {
    ctx.beginPath();
    ctx.rect(wx - 26, 380, 52, 48);
    fillAndStroke(ctx);
    ctx.beginPath();
    ctx.moveTo(wx, 380);
    ctx.lineTo(wx, 428);
    ctx.moveTo(wx - 26, 404);
    ctx.lineTo(wx + 26, 404);
    ctx.stroke();
    // Window box
    ctx.beginPath();
    ctx.rect(wx - 32, 428, 64, 16);
    fillAndStroke(ctx);
  }

  // Winding Cobblestone Path
  ctx.beginPath();
  ctx.moveTo(345, 540);
  ctx.bezierCurveTo(330, 610, 250, 670, 235, 760);
  ctx.lineTo(455, 760);
  ctx.bezierCurveTo(440, 665, 425, 610, 415, 540);
  ctx.closePath();
  fillAndStroke(ctx);

  // Stepping Stones inside Path
  const stones = [
    { x: 380, y: 575, rx: 28, ry: 12 },
    { x: 368, y: 625, rx: 34, ry: 14 },
    { x: 350, y: 680, rx: 40, ry: 16 },
    { x: 345, y: 735, rx: 44, ry: 16 },
  ];
  for (const st of stones) {
    ctx.beginPath();
    ctx.ellipse(st.x, st.y, st.rx, st.ry, 0, 0, Math.PI * 2);
    fillAndStroke(ctx);
  }

  // Foreground Wildflowers & Bushes
  drawFlower(ctx, 130, 645, 24, 6);
  drawFlower(ctx, 215, 695, 22, 6);
  drawFlower(ctx, 565, 650, 25, 6);
  drawFlower(ctx, 645, 705, 22, 6);
}

function drawClockworkOwl(ctx) {
  // Crescent Moon in upper left
  ctx.beginPath();
  ctx.arc(155, 155, 78, 0.35, Math.PI * 1.65, false);
  ctx.quadraticCurveTo(115, 155, 190, 90);
  ctx.closePath();
  fillAndStroke(ctx);

  // Celestial Stars
  const stars = [
    { x: 330, y: 90, r: 26 },
    { x: 615, y: 120, r: 30 },
    { x: 110, y: 330, r: 22 },
    { x: 655, y: 310, r: 24 },
  ];
  for (const st of stars) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const rad = i % 2 === 0 ? st.r : st.r * 0.38;
      const px = st.x + Math.cos(a) * rad;
      const py = st.y + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    fillAndStroke(ctx);
  }

  // Interlocking Clockwork Gears behind Owl
  const drawGear = (gx, gy, outerR, innerR, teeth = 10) => {
    ctx.beginPath();
    for (let i = 0; i < teeth * 2; i++) {
      const a1 = (i * Math.PI) / teeth;
      const a2 = ((i + 0.7) * Math.PI) / teeth;
      const r = i % 2 === 0 ? outerR : outerR - 16;
      ctx.lineTo(gx + Math.cos(a1) * r, gy + Math.sin(a1) * r);
      ctx.lineTo(gx + Math.cos(a2) * r, gy + Math.sin(a2) * r);
    }
    ctx.closePath();
    fillAndStroke(ctx);

    ctx.beginPath();
    ctx.arc(gx, gy, innerR, 0, Math.PI * 2);
    fillAndStroke(ctx);

    ctx.beginPath();
    ctx.arc(gx, gy, innerR * 0.45, 0, Math.PI * 2);
    fillAndStroke(ctx);
  };

  drawGear(565, 235, 86, 52, 10);
  drawGear(205, 445, 78, 46, 9);
  drawGear(585, 455, 74, 42, 8);

  // Tail Feathers (underneath branch)
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.ellipse(380 + i * 28, 610, 22, 75, -i * 0.08, 0, Math.PI * 2);
    fillAndStroke(ctx);
  }

  // Owl Body Torso
  ctx.beginPath();
  ctx.ellipse(380, 425, 138, 165, 0, 0, Math.PI * 2);
  fillAndStroke(ctx);

  // Owl Belly Patch with Scalloped Feather Rows
  ctx.beginPath();
  ctx.ellipse(380, 450, 92, 118, 0, 0, Math.PI * 2);
  fillAndStroke(ctx);

  const featherRows = [
    { y: 385, cols: 3 },
    { y: 430, cols: 4 },
    { y: 475, cols: 3 },
    { y: 520, cols: 2 },
  ];
  for (const row of featherRows) {
    const startX = 380 - ((row.cols - 1) * 38) / 2;
    for (let c = 0; c < row.cols; c++) {
      ctx.beginPath();
      ctx.ellipse(startX + c * 38, row.y, 17, 22, 0, 0, Math.PI * 2);
      fillAndStroke(ctx);
    }
  }

  // Left & Right Folded Wings (with layered flight feathers)
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(380 + dir * 95, 310);
    ctx.bezierCurveTo(
      380 + dir * 195,
      340,
      380 + dir * 190,
      505,
      380 + dir * 105,
      565
    );
    ctx.bezierCurveTo(
      380 + dir * 75,
      490,
      380 + dir * 75,
      380,
      380 + dir * 95,
      310
    );
    ctx.closePath();
    fillAndStroke(ctx);

    // Wing feather bands
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.ellipse(
        380 + dir * (122 + k * 8),
        395 + k * 46,
        28,
        18,
        dir * 0.45,
        0,
        Math.PI * 2
      );
      fillAndStroke(ctx);
    }
  }

  // Owl Head & Ear Tufts
  ctx.beginPath();
  ctx.moveTo(265, 255);
  ctx.lineTo(220, 145);
  ctx.lineTo(325, 195);
  ctx.closePath();
  fillAndStroke(ctx);

  ctx.beginPath();
  ctx.moveTo(495, 255);
  ctx.lineTo(540, 145);
  ctx.lineTo(435, 195);
  ctx.closePath();
  fillAndStroke(ctx);

  ctx.beginPath();
  ctx.ellipse(380, 260, 122, 96, 0, 0, Math.PI * 2);
  fillAndStroke(ctx);

  // Facial Discs around Eyes
  for (const ex of [328, 432]) {
    ctx.beginPath();
    ctx.arc(ex, 262, 52, 0, Math.PI * 2);
    fillAndStroke(ctx);

    ctx.beginPath();
    ctx.arc(ex, 262, 34, 0, Math.PI * 2);
    fillAndStroke(ctx);

    ctx.beginPath();
    ctx.arc(ex, 262, 17, 0, Math.PI * 2);
    fillAndStroke(ctx);
  }

  // Forehead Crown Diamond
  ctx.beginPath();
  ctx.moveTo(380, 178);
  ctx.lineTo(402, 215);
  ctx.lineTo(380, 245);
  ctx.lineTo(358, 215);
  ctx.closePath();
  fillAndStroke(ctx);

  // Beak
  ctx.beginPath();
  ctx.moveTo(380, 272);
  ctx.lineTo(402, 302);
  ctx.lineTo(380, 336);
  ctx.lineTo(358, 302);
  ctx.closePath();
  fillAndStroke(ctx);

  // Oak Branch & Leaves
  ctx.beginPath();
  ctx.moveTo(60, 585);
  ctx.quadraticCurveTo(380, 555, 700, 595);
  ctx.lineTo(700, 632);
  ctx.quadraticCurveTo(380, 592, 60, 622);
  ctx.closePath();
  fillAndStroke(ctx);

  // Owl Talons gripping branch
  for (const tx of [330, 348, 366, 394, 412, 430]) {
    ctx.beginPath();
    ctx.ellipse(tx, 582, 9, 20, 0, 0, Math.PI * 2);
    fillAndStroke(ctx);
  }

  // Oak Leaves on Branch
  const leaves = [
    { x: 145, y: 555, a: -0.5 },
    { x: 195, y: 635, a: 0.6 },
    { x: 565, y: 555, a: 0.4 },
    { x: 625, y: 640, a: -0.4 },
  ];
  for (const lf of leaves) {
    ctx.save();
    ctx.translate(lf.x, lf.y);
    ctx.rotate(lf.a);
    ctx.beginPath();
    ctx.ellipse(0, 0, 38, 20, 0, 0, Math.PI * 2);
    fillAndStroke(ctx);
    ctx.beginPath();
    ctx.moveTo(-32, 0);
    ctx.lineTo(32, 0);
    ctx.stroke();
    ctx.restore();
  }
}

function drawKoiPond(ctx) {
  // Concentric Water Ripple Rings
  const ripples = [
    { x: 380, y: 380, r: 310 },
    { x: 380, y: 380, r: 225 },
    { x: 210, y: 210, r: 85 },
    { x: 560, y: 555, r: 90 },
  ];
  for (const rp of ripples) {
    ctx.beginPath();
    ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
    fillAndStroke(ctx);
  }

  // Lily Pads around pond
  const pads = [
    { x: 145, y: 560, r: 74, notch: 0.4 },
    { x: 615, y: 175, r: 72, notch: 3.5 },
    { x: 145, y: 175, r: 62, notch: 1.2 },
    { x: 610, y: 585, r: 66, notch: 2.6 },
  ];
  for (const p of pads) {
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.arc(p.x, p.y, p.r, p.notch + 0.25, p.notch + Math.PI * 2 - 0.25);
    ctx.closePath();
    fillAndStroke(ctx);
  }

  // Helper to draw a sculpted Koi fish
  const drawKoi = (cx, cy, rot) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);

    // Pectoral & Pelvic Fins
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(-25, side * 62, 42, 22, side * 0.55, 0, Math.PI * 2);
      fillAndStroke(ctx);

      ctx.beginPath();
      ctx.ellipse(55, side * 46, 28, 15, side * 0.45, 0, Math.PI * 2);
      fillAndStroke(ctx);
    }

    // Flowing Caudal Tail Fin (2 lobes)
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(115, 0);
      ctx.bezierCurveTo(165, side * 10, 210, side * 65, 185, side * 85);
      ctx.bezierCurveTo(155, side * 95, 125, side * 45, 105, 0);
      ctx.closePath();
      fillAndStroke(ctx);
    }

    // Main Koi Body
    ctx.beginPath();
    ctx.moveTo(-135, 0);
    ctx.bezierCurveTo(-115, -68, 35, -62, 120, 0);
    ctx.bezierCurveTo(35, 62, -115, 68, -135, 0);
    ctx.closePath();
    fillAndStroke(ctx);

    // Calico Color Spots / Scale Patches on Koi Back
    ctx.beginPath();
    ctx.ellipse(-55, -12, 34, 24, 0.2, 0, Math.PI * 2);
    fillAndStroke(ctx);

    ctx.beginPath();
    ctx.ellipse(18, 14, 30, 20, -0.25, 0, Math.PI * 2);
    fillAndStroke(ctx);

    ctx.beginPath();
    ctx.ellipse(72, -6, 22, 16, 0.1, 0, Math.PI * 2);
    fillAndStroke(ctx);

    // Dorsal Fin Ridge
    ctx.beginPath();
    ctx.ellipse(-5, 0, 56, 12, 0, 0, Math.PI * 2);
    fillAndStroke(ctx);

    // Eyes
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(-102, side * 24, 9, 0, Math.PI * 2);
      fillAndStroke(ctx);
    }

    ctx.restore();
  };

  drawKoi(285, 315, -0.45);
  drawKoi(475, 455, Math.PI - 0.45);

  // Blooming Lotus Flowers on the Pads
  drawFlower(ctx, 145, 560, 42, 8);
  drawFlower(ctx, 615, 175, 40, 8);
}

function drawBotanicalTerrarium(ctx) {
  // Decorative Hanging Ring & Chain at Top
  ctx.beginPath();
  ctx.arc(380, 62, 24, 0, Math.PI * 2);
  fillAndStroke(ctx);

  // Geometric Glass Terrarium Outer Facets
  const topApex = { x: 380, y: 86 };
  const upperL = { x: 175, y: 235 };
  const upperM = { x: 380, y: 215 };
  const upperR = { x: 585, y: 235 };
  const lowerL = { x: 135, y: 525 };
  const lowerM = { x: 380, y: 555 };
  const lowerR = { x: 625, y: 525 };
  const baseL = { x: 235, y: 685 };
  const baseR = { x: 525, y: 685 };

  const poly = (pts) => {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    fillAndStroke(ctx);
  };

  // Facet panels
  poly([topApex, upperL, upperM]);
  poly([topApex, upperM, upperR]);
  poly([upperL, lowerL, lowerM, upperM]);
  poly([upperM, lowerM, lowerR, upperR]);
  poly([lowerL, baseL, baseR, lowerM]);
  poly([lowerM, baseR, lowerR]);

  // Terrarium Soil & Pebbles Layer at Bottom
  poly([
    { x: 162, y: 545 },
    { x: 380, y: 568 },
    { x: 598, y: 545 },
    baseR,
    baseL,
  ]);

  const pebbles = [
    { x: 265, y: 625, rx: 32, ry: 18 },
    { x: 345, y: 645, rx: 38, ry: 20 },
    { x: 435, y: 632, rx: 34, ry: 18 },
    { x: 505, y: 615, rx: 26, ry: 16 },
  ];
  for (const pb of pebbles) {
    ctx.beginPath();
    ctx.ellipse(pb.x, pb.y, pb.rx, pb.ry, 0, 0, Math.PI * 2);
    fillAndStroke(ctx);
  }

  // Central Blooming Lotus / Protea inside Terrarium
  drawFlower(ctx, 380, 395, 76, 8);
  drawFlower(ctx, 380, 395, 44, 6);

  // Left Tropical Leaf Clusters
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.translate(245, 495 - i * 48);
    ctx.rotate(-0.55 + i * 0.12);
    ctx.beginPath();
    ctx.ellipse(0, 0, 48, 22, 0, 0, Math.PI * 2);
    fillAndStroke(ctx);
    ctx.restore();
  }

  // Right Botanical Fern / Leaves
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.translate(515, 495 - i * 48);
    ctx.rotate(0.55 - i * 0.12);
    ctx.beginPath();
    ctx.ellipse(0, 0, 48, 22, 0, 0, Math.PI * 2);
    fillAndStroke(ctx);
    ctx.restore();
  }

  // Corner Botanical Flourishes outside Terrarium
  drawFlower(ctx, 95, 115, 32, 6);
  drawFlower(ctx, 665, 115, 32, 6);
  drawFlower(ctx, 95, 655, 32, 6);
  drawFlower(ctx, 665, 655, 32, 6);
}

function drawMonarchMandala(ctx) {
  const cx = 380;
  const cy = 380;

  // Outer Stained-Glass Sunburst Ring
  const rays = 16;
  for (let i = 0; i < rays; i++) {
    const a1 = (i * Math.PI * 2) / rays;
    const a2 = ((i + 1) * Math.PI * 2) / rays;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, 330, a1, a2);
    ctx.closePath();
    fillAndStroke(ctx);
  }

  // Middle Scalloped Lotus Petals (12 petals)
  const petals = 12;
  for (let i = 0; i < petals; i++) {
    const a = (i * Math.PI * 2) / petals;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(55, -140, 65, -245, 0, -275);
    ctx.bezierCurveTo(-65, -245, -55, -140, 0, 0);
    ctx.closePath();
    fillAndStroke(ctx);
    ctx.restore();
  }

  // Inner Medallion Circle
  ctx.beginPath();
  ctx.arc(cx, cy, 195, 0, Math.PI * 2);
  fillAndStroke(ctx);

  // Monarch Butterfly Wings (Upper & Lower Left/Right)
  for (const dir of [-1, 1]) {
    // Upper Forewing
    ctx.beginPath();
    ctx.moveTo(cx, cy - 25);
    ctx.bezierCurveTo(
      cx + dir * 95,
      cy - 175,
      cx + dir * 245,
      cy - 155,
      cx + dir * 215,
      cy - 20
    );
    ctx.bezierCurveTo(
      cx + dir * 185,
      cy + 30,
      cx + dir * 75,
      cy + 15,
      cx,
      cy - 25
    );
    ctx.closePath();
    fillAndStroke(ctx);

    // Forewing Stained-Glass Cells
    ctx.beginPath();
    ctx.ellipse(
      cx + dir * 125,
      cy - 68,
      46,
      26,
      dir * -0.35,
      0,
      Math.PI * 2
    );
    fillAndStroke(ctx);

    ctx.beginPath();
    ctx.arc(cx + dir * 175, cy - 95, 18, 0, Math.PI * 2);
    fillAndStroke(ctx);

    // Lower Hindwing
    ctx.beginPath();
    ctx.moveTo(cx, cy + 5);
    ctx.bezierCurveTo(
      cx + dir * 165,
      cy + 15,
      cx + dir * 195,
      cy + 145,
      cx + dir * 105,
      cy + 165
    );
    ctx.bezierCurveTo(
      cx + dir * 35,
      cy + 175,
      cx + dir * 15,
      cy + 85,
      cx,
      cy + 5
    );
    ctx.closePath();
    fillAndStroke(ctx);

    // Hindwing Cell
    ctx.beginPath();
    ctx.ellipse(
      cx + dir * 92,
      cy + 92,
      36,
      24,
      dir * 0.4,
      0,
      Math.PI * 2
    );
    fillAndStroke(ctx);
  }

  // Butterfly Body & Head
  ctx.beginPath();
  ctx.ellipse(cx, cy + 10, 18, 95, 0, 0, Math.PI * 2);
  fillAndStroke(ctx);

  ctx.beginPath();
  ctx.arc(cx, cy - 95, 20, 0, Math.PI * 2);
  fillAndStroke(ctx);
}

function drawRamenStall(ctx) {
  // Striped Slanted Yatai Roof
  const roofCols = 7;
  const roofLeft = 75;
  const roofW = 610;
  const colW = roofW / roofCols;
  for (let i = 0; i < roofCols; i++) {
    ctx.beginPath();
    ctx.rect(roofLeft + i * colW, 75, colW, 85);
    fillAndStroke(ctx);
  }

  // Noren Curtain Panels hanging below roof
  for (let i = 0; i < 5; i++) {
    const nx = 105 + i * 112;
    ctx.beginPath();
    ctx.roundRect(nx, 160, 102, 95, [0, 0, 18, 18]);
    fillAndStroke(ctx);

    ctx.beginPath();
    ctx.arc(nx + 51, 206, 24, 0, Math.PI * 2);
    fillAndStroke(ctx);
  }

  // Hanging Paper Lanterns on Left & Right
  for (const lx of [135, 625]) {
    ctx.beginPath();
    ctx.ellipse(lx, 335, 46, 62, 0, 0, Math.PI * 2);
    fillAndStroke(ctx);

    ctx.beginPath();
    ctx.rect(lx - 24, 265, 48, 14);
    fillAndStroke(ctx);

    ctx.beginPath();
    ctx.rect(lx - 24, 392, 48, 14);
    fillAndStroke(ctx);
  }

  // Wooden Stall Counter & Front Panels
  ctx.beginPath();
  ctx.rect(75, 525, 610, 36);
  fillAndStroke(ctx);

  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.rect(95 + i * 142, 561, 142, 155);
    fillAndStroke(ctx);
  }

  // Steaming Hero Ramen Bowl on Counter
  // Toppings peeking above rim (Egg halves, Nori sheets, Chashu pork)
  ctx.beginPath();
  ctx.rect(415, 315, 58, 85);
  fillAndStroke(ctx);

  ctx.beginPath();
  ctx.rect(455, 330, 58, 85);
  fillAndStroke(ctx);

  // Soft-boiled Ajitama Egg Halves
  for (const ex of [305, 365]) {
    ctx.beginPath();
    ctx.ellipse(ex, 378, 28, 36, -0.15, 0, Math.PI * 2);
    fillAndStroke(ctx);
    ctx.beginPath();
    ctx.arc(ex, 382, 14, 0, Math.PI * 2);
    fillAndStroke(ctx);
  }

  // Narutomaki Fish Cake with Spiral
  ctx.beginPath();
  ctx.arc(435, 392, 26, 0, Math.PI * 2);
  fillAndStroke(ctx);
  ctx.beginPath();
  ctx.arc(435, 392, 11, 0, Math.PI * 2);
  fillAndStroke(ctx);

  // Bowl Rim & Broth Surface
  ctx.beginPath();
  ctx.ellipse(380, 405, 138, 34, 0, 0, Math.PI * 2);
  fillAndStroke(ctx);

  // Main Ceramic Bowl Body
  ctx.beginPath();
  ctx.moveTo(242, 405);
  ctx.bezierCurveTo(245, 515, 515, 515, 518, 405);
  ctx.closePath();
  fillAndStroke(ctx);

  // Bowl Decorative Band & Foot
  ctx.beginPath();
  ctx.rect(325, 502, 110, 23);
  fillAndStroke(ctx);
}
