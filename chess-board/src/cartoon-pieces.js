/**
 * 3D Cartoon Figurine Builder for Chinese Chess (Xiangqi / 中國象棋)
 * Sculpts 7 distinct toy/chibi-style 3D characters:
 *  - General (帥/將): Chibi Emperor / Warlord with crown, cape, mustache & sword
 *  - Advisor (仕/士): Wise Strategist with winged scholar hat (烏紗帽) & feather fan
 *  - Elephant (相/象): Plump War Elephant with big ears, ivory tusks, curled trunk & jewel saddle
 *  - Horse (傌/馬): Heroic Cartoon Pony/Steed with sculpted mane, snout, ears & bridle
 *  - Chariot (俥/車): Armored Siege Wagon with spoked wheels, battlements & twin war flags
 *  - Cannon (炮/砲): Wheeled Bombard Cannon with flared barrel, fuse & stacked cannonballs
 *  - Soldier (兵/卒): Cute Chibi Footman with conical infantry helmet, round shield & spear
 */

import * as THREE from 'three';
import { RED, getPieceChar } from './xiangqi-engine.js';

const badgeTextureCache = new Map();

/**
 * Generates a crisp circular character medallion texture for the cartoon pedestal front/top badge.
 */
function getBadgeTexture(color, type) {
  const key = `${color}_${type}`;
  if (badgeTextureCache.has(key)) return badgeTextureCache.get(key);

  const size = 256;
  const half = size / 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const isRed = color === RED;

  // Glossy coin background
  const grad = ctx.createRadialGradient(half - 25, half - 25, 10, half, half, half);
  if (isRed) {
    grad.addColorStop(0, '#fff5e0');
    grad.addColorStop(0.78, '#ffe0a8');
    grad.addColorStop(1, '#d89b40');
  } else {
    grad.addColorStop(0, '#f4f7fb');
    grad.addColorStop(0.78, '#dce5f2');
    grad.addColorStop(1, '#8fa3be');
  }
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(half, half, half - 4, 0, Math.PI * 2);
  ctx.fill();

  // Outer ring
  ctx.strokeStyle = isRed ? '#d9261c' : '#1e293b';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.arc(half, half, half - 14, 0, Math.PI * 2);
  ctx.stroke();

  // Character
  const char = getPieceChar({ color, type });
  ctx.font = '900 148px "STKaiti", "Kaiti SC", "KaiTi", "PingFang TC", "Noto Serif TC", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText(char, half + 2, half + 8);

  ctx.fillStyle = isRed ? '#c81e17' : '#152238';
  ctx.fillText(char, half, half + 5);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  badgeTextureCache.set(key, tex);
  return tex;
}

/**
 * Palette definitions for Red (Crimson & Gold) and Black (Midnight Sapphire/Obsidian & Bronze/Jade)
 */
function getCartoonPalette(color) {
  const isRed = color === RED;
  return {
    isRed,
    primary: isRed ? 0xdc2626 : 0x25364d,      // Main armor / coat
    secondary: isRed ? 0xf97316 : 0x3b82f6,    // Trim / plume / sash
    gold: isRed ? 0xfbbf24 : 0xeab308,         // Royal gold / brass
    skin: 0xffdfc4,                            // Chibi character skin
    blush: 0xff8fa3,                           // Cute cheek blush
    wood: isRed ? 0x9a3412 : 0x334155,         // Carriage / shaft wood
    animalBody: isRed ? 0xf5ebe0 : 0x64748b,   // White/cream vs slate steed/elephant
    animalDark: isRed ? 0xd97706 : 0x1e293b,   // Mane / hooves / ears accent
    metal: isRed ? 0xb45309 : 0x1f2937,        // Cannon barrel / weapon iron
    pedestalBase: isRed ? 0x991b1b : 0x172030, // Chunky base color
    pedestalTop: isRed ? 0xfef3c7 : 0xe2e8f0,  // Top cushion platform
  };
}

/**
 * Helper to create toy-like glossy standard materials
 */
function makeMat(hex, roughness = 0.32, metalness = 0.08, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color: hex,
    roughness,
    metalness,
    ...extra,
  });
}

/**
 * Adds cute glossy cartoon eyes (with white catchlights and rosy cheeks) to a head group
 */
function addCartoonFace(headGroup, radius, pal, hasMustache = false, isFierce = false) {
  const eyeWhiteMat = makeMat(0xffffff, 0.15, 0.0);
  const pupilMat = makeMat(0x111111, 0.1, 0.0);
  const blushMat = makeMat(pal.blush, 0.5, 0.0);

  const eyeGeo = new THREE.SphereGeometry(radius * 0.16, 16, 12);
  const pupilGeo = new THREE.SphereGeometry(radius * 0.09, 12, 10);
  const glintGeo = new THREE.SphereGeometry(radius * 0.038, 8, 8);
  const cheekGeo = new THREE.SphereGeometry(radius * 0.12, 12, 10);

  [-1, 1].forEach((side) => {
    const ex = side * radius * 0.36;
    const ey = radius * 0.06;
    const ez = radius * 0.88;

    const white = new THREE.Mesh(eyeGeo, eyeWhiteMat);
    white.scale.set(0.85, 1.1, 0.5);
    white.position.set(ex, ey, ez);
    headGroup.add(white);

    const pupil = new THREE.Mesh(pupilGeo, pupilMat);
    pupil.scale.set(0.85, 1.1, 0.5);
    pupil.position.set(ex, ey, ez + radius * 0.05);
    headGroup.add(pupil);

    const glint = new THREE.Mesh(glintGeo, eyeWhiteMat);
    glint.position.set(ex + side * radius * 0.03, ey + radius * 0.05, ez + radius * 0.09);
    headGroup.add(glint);

    // Rosy cartoon cheek
    const cheek = new THREE.Mesh(cheekGeo, blushMat);
    cheek.scale.set(1.2, 0.65, 0.4);
    cheek.position.set(side * radius * 0.52, -radius * 0.12, radius * 0.78);
    headGroup.add(cheek);

    // Eyebrows
    if (isFierce) {
      const browGeo = new THREE.BoxGeometry(radius * 0.28, radius * 0.07, radius * 0.08);
      const brow = new THREE.Mesh(browGeo, pupilMat);
      brow.position.set(ex, ey + radius * 0.24, ez + radius * 0.04);
      brow.rotation.z = -side * 0.28;
      headGroup.add(brow);
    }
  });

  if (hasMustache) {
    const beardMat = makeMat(pal.isRed ? 0x292524 : 0x0f172a, 0.4, 0.0);
    const stacheGeo = new THREE.ConeGeometry(radius * 0.12, radius * 0.42, 12);
    [-1, 1].forEach((side) => {
      const m = new THREE.Mesh(stacheGeo, beardMat);
      m.position.set(side * radius * 0.2, -radius * 0.2, radius * 0.9);
      m.rotation.z = side * (Math.PI * 0.42);
      m.rotation.x = 0.2;
      headGroup.add(m);
    });
    // Goatee tuft
    const goatee = new THREE.Mesh(
      new THREE.ConeGeometry(radius * 0.13, radius * 0.35, 12),
      beardMat
    );
    goatee.position.set(0, -radius * 0.42, radius * 0.82);
    goatee.rotation.x = Math.PI * 0.88;
    headGroup.add(goatee);
  }
}

/**
 * Builds the chunky toy pedestal base with a front-tilted Chinese character badge (`字牌`)
 */
function createCartoonPedestal(color, type, pal) {
  const baseGroup = new THREE.Group();

  // Lower beveled base ring
  const lowerGeo = new THREE.CylinderGeometry(0.44, 0.48, 0.12, 36);
  const lowerMat = makeMat(pal.pedestalBase, 0.3, 0.12);
  const lowerMesh = new THREE.Mesh(lowerGeo, lowerMat);
  lowerMesh.position.y = 0.06;
  lowerMesh.castShadow = true;
  lowerMesh.receiveShadow = true;
  baseGroup.add(lowerMesh);

  // Gold collar rim
  const rimGeo = new THREE.TorusGeometry(0.43, 0.032, 14, 36);
  rimGeo.rotateX(Math.PI / 2);
  const goldMat = makeMat(pal.gold, 0.22, 0.65);
  const rimMesh = new THREE.Mesh(rimGeo, goldMat);
  rimMesh.position.y = 0.12;
  baseGroup.add(rimMesh);

  // Upper cushion platform
  const topGeo = new THREE.CylinderGeometry(0.39, 0.43, 0.06, 36);
  const topMat = makeMat(pal.pedestalTop, 0.35, 0.05);
  const topMesh = new THREE.Mesh(topGeo, topMat);
  topMesh.position.y = 0.15;
  topMesh.receiveShadow = true;
  baseGroup.add(topMesh);

  // Front & Back Character Medallion Badges (so readable from BOTH Red and Black camera views!)
  const badgeTex = getBadgeTexture(color, type);
  const badgeMat = new THREE.MeshStandardMaterial({
    map: badgeTex,
    roughness: 0.22,
    metalness: 0.1,
  });
  const badgeGeo = new THREE.CylinderGeometry(0.165, 0.165, 0.025, 28);
  badgeGeo.rotateX(Math.PI / 2);

  [1, -1].forEach((dir) => {
    const badge = new THREE.Mesh(badgeGeo, badgeMat);
    badge.position.set(0, 0.13, dir * 0.425);
    badge.rotation.x = -dir * 0.42; // Tilted upward toward camera
    if (dir === -1) {
      badge.rotation.y = Math.PI;
    }
    baseGroup.add(badge);
  });

  return baseGroup;
}

/**
 * 1. GENERAL (帥 / 將) — Chibi Emperor / Supreme Commander
 */
function buildGeneralFigurine(pal) {
  const fig = new THREE.Group();
  const primaryMat = makeMat(pal.primary, 0.3, 0.1);
  const goldMat = makeMat(pal.gold, 0.22, 0.7);
  const skinMat = makeMat(pal.skin, 0.38, 0.02);
  const secMat = makeMat(pal.secondary, 0.32, 0.1);

  // Armored Robe Torso
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.27, 0.38, 24), primaryMat);
  torso.position.y = 0.19;
  torso.castShadow = true;
  fig.add(torso);

  // Golden Belt & Jade Plaque
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.245, 0.06, 24), goldMat);
  belt.position.y = 0.16;
  fig.add(belt);

  // Royal Flowing Cape at back
  const cape = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.05), secMat);
  cape.position.set(0, 0.2, -0.18);
  cape.rotation.x = 0.18;
  cape.castShadow = true;
  fig.add(cape);

  // Broad Shoulder Pauldrons
  [-1, 1].forEach((s) => {
    const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), goldMat);
    pauldron.scale.set(1.1, 0.75, 1.0);
    pauldron.position.set(s * 0.22, 0.34, 0);
    fig.add(pauldron);

    // Chibi Arms
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.12, 8, 12), primaryMat);
    arm.position.set(s * 0.24, 0.22, 0.05);
    arm.rotation.z = -s * 0.25;
    arm.rotation.x = -0.35;
    fig.add(arm);
  });

  // Golden Command Sword held in front-right
  const swordGroup = new THREE.Group();
  const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 10), goldMat);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.025, 0.04), goldMat);
  guard.position.y = -0.05;
  const blade = new THREE.Mesh(
    new THREE.ConeGeometry(0.032, 0.26, 4),
    makeMat(0xf8fafc, 0.15, 0.85)
  );
  blade.rotation.x = Math.PI;
  blade.position.y = -0.18;
  swordGroup.add(hilt, guard, blade);
  swordGroup.position.set(0.23, 0.25, 0.16);
  swordGroup.rotation.x = 0.25;
  fig.add(swordGroup);

  // Cute Oversized Chibi Head
  const headGroup = new THREE.Group();
  headGroup.position.y = 0.54;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 24, 20), skinMat);
  head.castShadow = true;
  headGroup.add(head);

  addCartoonFace(headGroup, 0.19, pal, true, true);

  // Imperial Crown (冕冠 for Red / Horned General Helmet for Black)
  const crownBase = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.18, 0.11, 20), goldMat);
  crownBase.position.y = 0.16;
  headGroup.add(crownBase);

  if (pal.isRed) {
    // Imperial flat mortarboard top (冕冠)
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.03, 0.42), primaryMat);
    board.position.y = 0.22;
    headGroup.add(board);

    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.018, 0.43), goldMat);
    trim.position.y = 0.22;
    headGroup.add(trim);
  } else {
    // Warlord Plumed Helmet
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), primaryMat);
    dome.position.y = 0.17;
    headGroup.add(dome);

    const plume = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 12), makeMat(0xef4444, 0.4, 0.0));
    plume.scale.set(0.8, 1.5, 1.1);
    plume.position.set(0, 0.34, -0.03);
    headGroup.add(plume);
  }

  fig.add(headGroup);
  return fig;
}

/**
 * 2. ADVISOR (仕 / 士) — Chibi Royal Strategist / Mandarin Guard
 */
function buildAdvisorFigurine(pal) {
  const fig = new THREE.Group();
  const robeMat = makeMat(pal.primary, 0.35, 0.06);
  const trimMat = makeMat(pal.gold, 0.25, 0.55);
  const skinMat = makeMat(pal.skin, 0.38, 0.02);

  // Flowing Scholar Robe
  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.4, 24), robeMat);
  robe.position.y = 0.2;
  robe.castShadow = true;
  fig.add(robe);

  // Wide Mandarin Sleeves clasped in front
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.035, 12, 24), trimMat);
  collar.rotateX(Math.PI / 2);
  collar.position.y = 0.35;
  fig.add(collar);

  // Strategist Feather Fan (羽扇)
  const fanGroup = new THREE.Group();
  const fanBody = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 16, 12),
    makeMat(0xffffff, 0.25, 0.05)
  );
  fanBody.scale.set(0.9, 1.35, 0.22);
  const fanHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.14, 8), trimMat);
  fanHandle.position.y = -0.14;
  fanGroup.add(fanBody, fanHandle);
  fanGroup.position.set(0.18, 0.28, 0.14);
  fanGroup.rotation.z = -0.35;
  fig.add(fanGroup);

  // Head
  const headGroup = new THREE.Group();
  headGroup.position.y = 0.51;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.175, 24, 20), skinMat);
  head.castShadow = true;
  headGroup.add(head);

  addCartoonFace(headGroup, 0.175, pal, true, false);

  // Traditional Winged Mandarin Hat (烏紗帽)
  const hatCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.16, 0.15, 20),
    makeMat(0x1e1b18, 0.35, 0.1)
  );
  hatCap.position.y = 0.16;
  headGroup.add(hatCap);

  // Iconic horizontal hat wings (帽翅)
  const wingGeo = new THREE.BoxGeometry(0.48, 0.035, 0.07);
  const wings = new THREE.Mesh(wingGeo, trimMat);
  wings.position.set(0, 0.16, -0.06);
  headGroup.add(wings);

  fig.add(headGroup);
  return fig;
}

/**
 * 3. ELEPHANT (相 / 象) — Adorable Chubby War Elephant
 */
function buildElephantFigurine(pal) {
  const fig = new THREE.Group();
  const bodyMat = makeMat(pal.animalBody, 0.36, 0.04);
  const saddleMat = makeMat(pal.primary, 0.3, 0.1);
  const goldMat = makeMat(pal.gold, 0.22, 0.65);
  const ivoryMat = makeMat(0xfffbeb, 0.2, 0.05);

  // Four Stubby Elephant Legs
  const legGeo = new THREE.CylinderGeometry(0.075, 0.085, 0.18, 14);
  [
    [-0.14, 0.12],
    [0.14, 0.12],
    [-0.14, -0.12],
    [0.14, -0.12],
  ].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(legGeo, bodyMat);
    leg.position.set(lx, 0.09, lz);
    leg.castShadow = true;
    fig.add(leg);
  });

  // Plump Rounded Torso
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 20), bodyMat);
  torso.scale.set(1.0, 0.88, 1.18);
  torso.position.set(0, 0.25, -0.02);
  torso.castShadow = true;
  fig.add(torso);

  // Ornate Saddle Howdah Blanket & Gem on Back
  const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.28), saddleMat);
  saddle.position.set(0, 0.39, -0.02);
  fig.add(saddle);

  const saddleCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.08, 16), goldMat);
  saddleCrown.position.set(0, 0.48, -0.02);
  fig.add(saddleCrown);

  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.065, 16, 12), makeMat(pal.secondary, 0.15, 0.3));
  orb.position.set(0, 0.55, -0.02);
  fig.add(orb);

  // Cute Elephant Head
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.34, 0.21);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 22, 18), bodyMat);
  head.castShadow = true;
  headGroup.add(head);

  addCartoonFace(headGroup, 0.18, pal, false, false);

  // Big Floppy Cartoon Ears
  const earGeo = new THREE.SphereGeometry(0.16, 16, 12);
  [-1, 1].forEach((s) => {
    const ear = new THREE.Mesh(earGeo, bodyMat);
    ear.scale.set(0.28, 1.05, 0.85);
    ear.position.set(s * 0.21, 0.02, -0.02);
    ear.rotation.y = -s * 0.35;
    ear.castShadow = true;
    headGroup.add(ear);
  });

  // Curled Upward Elephant Trunk (象鼻)
  const trunkCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0, -0.02, 0.14),
    new THREE.Vector3(0, -0.14, 0.29),
    new THREE.Vector3(0, 0.08, 0.33)
  );
  const trunkGeo = new THREE.TubeGeometry(trunkCurve, 16, 0.048, 12, false);
  const trunk = new THREE.Mesh(trunkGeo, bodyMat);
   trunk.castShadow = true;
  headGroup.add(trunk);

  // White Ivory Tusks
  const tuskGeo = new THREE.ConeGeometry(0.032, 0.16, 12);
  [-1, 1].forEach((s) => {
    const tusk = new THREE.Mesh(tuskGeo, ivoryMat);
    tusk.position.set(s * 0.1, -0.08, 0.2);
    tusk.rotation.x = Math.PI * 0.35;
    tusk.rotation.z = -s * 0.2;
    headGroup.add(tusk);
  });

  fig.add(headGroup);
  return fig;
}

/**
 * 4. HORSE (傌 / 馬) — Heroic Cartoon War Steed / Pony
 */
function buildHorseFigurine(pal) {
  const fig = new THREE.Group();
  const coatMat = makeMat(pal.animalBody, 0.32, 0.05);
  const maneMat = makeMat(pal.animalDark, 0.38, 0.05);
  const armorMat = makeMat(pal.primary, 0.28, 0.15);
  const goldMat = makeMat(pal.gold, 0.22, 0.65);

  // Four Sturdy Hooves & Legs
  const legGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.22, 12);
  [
    [-0.11, 0.12],
    [0.11, 0.12],
    [-0.11, -0.14],
    [0.11, -0.14],
  ].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(legGeo, coatMat);
    leg.position.set(lx, 0.11, lz);
    leg.castShadow = true;
    fig.add(leg);
  });

  // Pony Barrel Body
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.145, 0.2, 12, 18), coatMat);
  body.rotation.x = Math.PI / 2;
  body.position.set(0, 0.26, -0.02);
  body.castShadow = true;
  fig.add(body);

  // Saddle & Chest Armor
  const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.09, 0.2), armorMat);
  saddle.position.set(0, 0.36, -0.03);
  fig.add(saddle);

  const chestBell = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 12), goldMat);
  chestBell.position.set(0, 0.27, 0.2);
  fig.add(chestBell);

  // Proud Arching Neck & Head
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.13, 0.26, 16), coatMat);
  neck.position.set(0, 0.42, 0.11);
  neck.rotation.x = 0.28;
  neck.castShadow = true;
  fig.add(neck);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.56, 0.16);

  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.135, 18, 16), coatMat);
  cranium.castShadow = true;
  headGroup.add(cranium);

  // Horse Snout / Muzzle
  const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.1, 0.16, 16), coatMat);
  snout.rotation.x = Math.PI * 0.42;
  snout.position.set(0, -0.03, 0.13);
  snout.castShadow = true;
  headGroup.add(snout);

  addCartoonFace(headGroup, 0.135, pal, false, false);

  // Perky Horse Ears
  const earGeo = new THREE.ConeGeometry(0.042, 0.12, 10);
  [-1, 1].forEach((s) => {
    const ear = new THREE.Mesh(earGeo, coatMat);
    ear.position.set(s * 0.08, 0.15, -0.01);
    ear.rotation.z = -s * 0.2;
    headGroup.add(ear);
  });

  // Sculpted Cartoon Mane Tuft
  for (let i = 0; i < 4; i++) {
    const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 10), maneMat);
    tuft.scale.set(0.6, 1.1, 1.2);
    tuft.position.set(0, 0.11 - i * 0.07, -0.09 - i * 0.025);
    headGroup.add(tuft);
  }

  fig.add(headGroup);

  // Bushy Tail
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.24, 12), maneMat);
  tail.position.set(0, 0.24, -0.26);
  tail.rotation.x = -0.65;
  fig.add(tail);

  return fig;
}

/**
 * 5. CHARIOT (俥 / 車) — Chunky Cartoon Armored War Wagon / Siege Tower
 */
function buildChariotFigurine(pal) {
  const fig = new THREE.Group();
  const bodyMat = makeMat(pal.primary, 0.3, 0.15);
  const woodMat = makeMat(pal.wood, 0.42, 0.08);
  const goldMat = makeMat(pal.gold, 0.22, 0.7);
  const secMat = makeMat(pal.secondary, 0.35, 0.08);

  // Heavy Armored Chariot Hull
  const hull = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.46), bodyMat);
  hull.position.y = 0.22;
  hull.castShadow = true;
  fig.add(hull);

  // Front Golden Ramming Shield / Bumper
  const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.28, 16, 1, false, -Math.PI / 3, (2 * Math.PI) / 3), goldMat);
  shield.position.set(0, 0.22, 0.08);
  fig.add(shield);

  // Top Battlement Crenelations (城垛)
  const crenPositions = [
    [-0.15, 0.16],
    [0, 0.16],
    [0.15, 0.16],
    [-0.15, -0.16],
    [0.15, -0.16],
    [-0.15, 0],
    [0.15, 0],
  ];
  const crenGeo = new THREE.BoxGeometry(0.09, 0.09, 0.09);
  crenPositions.forEach(([cx, cz]) => {
    const c = new THREE.Mesh(crenGeo, goldMat);
    c.position.set(cx, 0.41, cz);
    c.castShadow = true;
    fig.add(c);
  });

  // Two Big Spoked Cartoon War Wheels on Left & Right
  const tireGeo = new THREE.TorusGeometry(0.18, 0.042, 14, 28);
  tireGeo.rotateY(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.08, 16);
  hubGeo.rotateZ(Math.PI / 2);

  [-1, 1].forEach((s) => {
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(s * 0.25, 0.19, 0);

    const tire = new THREE.Mesh(tireGeo, woodMat);
    tire.castShadow = true;
    const hub = new THREE.Mesh(hubGeo, goldMat);
    wheelGroup.add(tire, hub);

    // Wheel spokes
    for (let k = 0; k < 4; k++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.34, 0.03), goldMat);
      spoke.rotation.x = (k * Math.PI) / 4;
      wheelGroup.add(spoke);
    }

    fig.add(wheelGroup);
  });

  // Twin War Flags (戰旗) on Back Corners
  [-0.13, 0.13].forEach((fx) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.36, 8), goldMat);
    pole.position.set(fx, 0.52, -0.15);
    fig.add(pole);

    const pennant = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 4), secMat);
    pennant.rotation.z = Math.PI / 2;
    pennant.position.set(fx, 0.62, -0.22);
    fig.add(pennant);
  });

  return fig;
}

/**
 * 6. CANNON (炮 / 砲) — Squat Cartoon Bombard Cannon on Wheeled Gun Carriage
 */
function buildCannonFigurine(pal) {
  const fig = new THREE.Group();
  const carriageMat = makeMat(pal.primary, 0.35, 0.1);
  const barrelMat = makeMat(pal.metal, 0.25, 0.68);
  const goldMat = makeMat(pal.gold, 0.2, 0.78);
  const darkHoleMat = makeMat(0x09090b, 0.8, 0.1);

  // Wooden Gun Carriage Side Cheeks
  const cheekGeo = new THREE.BoxGeometry(0.08, 0.18, 0.44);
  [-0.13, 0.13].forEach((cx) => {
    const cheek = new THREE.Mesh(cheekGeo, carriageMat);
    cheek.position.set(cx, 0.15, -0.02);
    cheek.castShadow = true;
    fig.add(cheek);
  });

  // 4 Small Brass Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.095, 0.095, 0.05, 18);
  wheelGeo.rotateZ(Math.PI / 2);
  [
    [-0.19, 0.13],
    [0.19, 0.13],
    [-0.19, -0.15],
    [0.19, -0.15],
  ].forEach(([wx, wz]) => {
    const w = new THREE.Mesh(wheelGeo, goldMat);
    w.position.set(wx, 0.095, wz);
    w.castShadow = true;
    fig.add(w);
  });

  // Tilted Flared Cartoon Cannon Barrel Group
  const barrelGroup = new THREE.Group();
  barrelGroup.position.set(0, 0.28, 0.0);
  barrelGroup.rotation.x = -0.36; // Aimed slightly upward & forward (+Z)

  // Main tapered barrel
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.145, 0.52, 24), barrelMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.castShadow = true;
  barrelGroup.add(barrel);

  // Flared Muzzle Lip at front
  const muzzle = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.032, 14, 24), goldMat);
  muzzle.position.z = 0.26;
  barrelGroup.add(muzzle);

  // Dark Bore Hole inside Muzzle
  const bore = new THREE.Mesh(new THREE.CircleGeometry(0.095, 20), darkHoleMat);
  bore.position.z = 0.265;
  barrelGroup.add(bore);

  // Reinforcing Gold Bands
  [-0.08, 0.08].forEach((bz) => {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.02, 12, 24), goldMat);
    band.position.z = bz;
    barrelGroup.add(band);
  });

  // Breech Knob & Glowing Spark Fuse at back
  const cascabel = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 14), barrelMat);
  cascabel.position.z = -0.25;
  barrelGroup.add(cascabel);

  const spark = new THREE.Mesh(
    new THREE.SphereGeometry(0.048, 12, 12),
    makeMat(0xffaa00, 0.1, 0.0, { emissive: 0xff5500, emissiveIntensity: 0.9 })
  );
  spark.position.set(0, 0.14, -0.28);
  barrelGroup.add(spark);

  fig.add(barrelGroup);

  // Stack of 3 Cute Cannonballs beside carriage
  const ballGeo = new THREE.SphereGeometry(0.065, 14, 12);
  [
    [0.24, 0.065, 0.02],
    [0.21, 0.065, -0.1],
    [0.22, 0.16, -0.04],
  ].forEach(([bx, by, bz]) => {
    const b = new THREE.Mesh(ballGeo, barrelMat);
    b.position.set(bx, by, bz);
    fig.add(b);
  });

  return fig;
}

/**
 * 7. SOLDIER (兵 / 卒) — Cute Chibi Foot Soldier with Conical Helmet, Spear & Shield
 */
function buildSoldierFigurine(pal) {
  const fig = new THREE.Group();
  const tunicMat = makeMat(pal.primary, 0.34, 0.08);
  const goldMat = makeMat(pal.gold, 0.24, 0.65);
  const skinMat = makeMat(pal.skin, 0.38, 0.02);
  const secMat = makeMat(pal.secondary, 0.32, 0.1);

  // Round Chibi Belly Tunic
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.19, 20, 16), tunicMat);
  torso.scale.set(1.0, 1.15, 0.95);
  torso.position.y = 0.19;
  torso.castShadow = true;
  fig.add(torso);

  // Belt & Buckle
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.024, 10, 24), goldMat);
  belt.rotateX(Math.PI / 2);
  belt.position.y = 0.16;
  fig.add(belt);

  // Round Buckler Shield on Left Arm
  const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.035, 20), goldMat);
  shield.rotation.z = Math.PI / 2;
  shield.rotation.y = 0.35;
  shield.position.set(-0.21, 0.22, 0.08);
  shield.castShadow = true;
  fig.add(shield);

  const shieldBoss = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), tunicMat);
  shieldBoss.position.set(-0.23, 0.22, 0.09);
  fig.add(shieldBoss);

  // Cute Upright Spear / Halberd on Right Side
  const spearGroup = new THREE.Group();
  spearGroup.position.set(0.22, 0.32, 0.08);
  spearGroup.rotation.x = 0.12;
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.56, 10),
    makeMat(pal.wood, 0.4, 0.1)
  );
  const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.09, 10), secMat);
  tassel.position.y = 0.22;
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.038, 0.14, 4),
    makeMat(0xf1f5f9, 0.18, 0.85)
  );
  tip.position.y = 0.31;
  spearGroup.add(shaft, tassel, tip);
  fig.add(spearGroup);

  // Big Expressive Chibi Head
  const headGroup = new THREE.Group();
  headGroup.position.y = 0.43;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.165, 22, 18), skinMat);
  head.castShadow = true;
  headGroup.add(head);

  addCartoonFace(headGroup, 0.165, pal, false, true);

  // Conical Infantry Helmet (斗笠盔 / 兵盔) with Pom-Pom
  const helmet = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.16, 24), goldMat);
  helmet.position.y = 0.17;
  helmet.castShadow = true;
  headGroup.add(helmet);

  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 12), secMat);
  pom.position.y = 0.26;
  headGroup.add(pom);

  fig.add(headGroup);
  return fig;
}

/**
 * Main factory: Creates a complete 3D Cartoon Piece Group (Pedestal Base + Character Figurine).
 * Orienting rule:
 *  - Red pieces (rows 5..9) face North (-Z, rotation.y = Math.PI) toward Black's side!
 *  - Black pieces (rows 0..4) face South (+Z, rotation.y = 0) toward Red's side!
 */
export function createCartoonPieceMesh(piece) {
  const root = new THREE.Group();
  const pal = getCartoonPalette(piece.color);

  // 1. Chunky Pedestal Base with Front & Back Character Medallions
  const pedestal = createCartoonPedestal(piece.color, piece.type, pal);
  root.add(pedestal);

  // 2. Sculpted 3D Cartoon Figurine standing atop the pedestal (y = 0.18)
  let figurine;
  switch (piece.type) {
    case 'k':
      figurine = buildGeneralFigurine(pal);
      break;
    case 'a':
      figurine = buildAdvisorFigurine(pal);
      break;
    case 'b':
      figurine = buildElephantFigurine(pal);
      break;
    case 'n':
      figurine = buildHorseFigurine(pal);
      break;
    case 'r':
      figurine = buildChariotFigurine(pal);
      break;
    case 'c':
      figurine = buildCannonFigurine(pal);
      break;
    case 'p':
    default:
      figurine = buildSoldierFigurine(pal);
      break;
  }

  figurine.position.y = 0.18;
  // Face the opponent across the Chu River!
  figurine.rotation.y = piece.color === RED ? Math.PI : 0;

  root.add(figurine);

  root.userData = {
    isPiece: true,
    isCartoon: true,
    uid: piece.uid,
    color: piece.color,
    type: piece.type,
    figurine,
    phaseOffset: (parseInt(piece.uid.replace(/\D/g, ''), 10) || 0) * 0.73,
  };

  return root;
}
