import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// ============================================================================
// 1. SPECIFICATIONS & ARCHITECTURAL LAYER DEFINITIONS
// ============================================================================
const PHONE = {
  W: 7.76,      // 77.6 mm
  H: 16.30,     // 163.0 mm
  D: 0.82,      // 8.20 mm total sealed thickness
  R: 1.16       // Corner radius
};

const FINISHES = {
  desert: {
    name: 'Desert Titanium',
    titanium: 0xc8b29b,
    titaniumDark: 0x8d7964,
    backGlass: 0xb7a38e,
    accent: 0xd9be9f
  },
  natural: {
    name: 'Natural Titanium',
    titanium: 0xa8a59e,
    titaniumDark: 0x6e6c67,
    backGlass: 0x94928c,
    accent: 0xc2bfb8
  },
  obsidian: {
    name: 'Obsidian Titanium',
    titanium: 0x2c2e33,
    titaniumDark: 0x18191c,
    backGlass: 0x222428,
    accent: 0x7b8291
  },
  ultramarine: {
    name: 'Ultramarine Titanium',
    titanium: 0x45587c,
    titaniumDark: 0x29354d,
    backGlass: 0x364663,
    accent: 0x7896cc
  }
};

const LAYER_DATA = [
  {
    id: 'display',
    index: '01',
    name: 'Super Retina XDR OLED',
    sub: 'Ceramic Shield Gen 3 • 3000 nits',
    code: 'MOD-01 // FRONT DISPLAY ASSEMBLY',
    desc: '6.9-inch LTPO4 Super Retina XDR ProMotion display (1Hz–120Hz) bonded to next-generation Ceramic Shield with micro-crystalline anti-reflective coating and ultra-thin 1.15mm borders.',
    specs: [
      ['RESOLUTION', '2868 × 1320 (460 ppi)'],
      ['PEAK BRIGHTNESS', '3,000 nits Outdoor'],
      ['COVER MATERIAL', 'Ceramic Shield Gen 3'],
      ['BEZEL WIDTH', '1.15 mm Uniform']
    ],
    zSealed: 0.37,
    axialPos: [0, 0, 11.2],
    radialPos: [0, 1.2, 10.5],
    cascadePos: [-5.2, 3.6, 8.8],
    pinOffset: [4.2, 4.8, 0.2],
    thermalTemp: 0.28
  },
  {
    id: 'truedepth',
    index: '02',
    name: 'Under-Display TrueDepth Array',
    sub: 'Sub-micron VCSEL & IR Photonics',
    code: 'MOD-02 // BIOMETRIC PHOTONICS',
    desc: 'Miniaturized TrueDepth camera system integrating an under-panel flood illuminator, 30,000-point VCSEL laser dot projector, and 24MP autofocus RGB/IR sensor.',
    specs: [
      ['BIOMETRICS', 'Gen 4 Face ID Engine'],
      ['WAVEBAND', '940 nm Near-Infrared'],
      ['FRONT CAMERA', '24MP f/1.8 6P Autofocus'],
      ['INTERCONNECT', '2-Layer Polyimide FPC']
    ],
    zSealed: 0.26,
    axialPos: [-1.1, 4.9, 8.8],
    radialPos: [-5.8, 6.2, 7.2],
    cascadePos: [-3.8, 5.2, 6.7],
    pinOffset: [-3.4, 1.0, 0.2],
    thermalTemp: 0.35
  },
  {
    id: 'emishield',
    index: '03',
    name: 'EMI Shield & Graphene Plate',
    sub: 'CNC Stamped Steel + Pyrolytic Graphite',
    code: 'MOD-03 // STRUCTURAL THERMAL SHIELD',
    desc: 'Precision-stamped stainless steel mid-plate laminated with a 45µm synthetic pyrolytic graphite sheet to isolate high-frequency display interference and spread core heat.',
    specs: [
      ['CONDUCTIVITY', '1,650 W/m·K In-Plane'],
      ['THICKNESS', '0.22 mm Composite'],
      ['FASTENERS', '14× Tri-Point Micro Screws'],
      ['EMI ATTENUATION', '> 68 dB (Sub-6 / mmWave)']
    ],
    zSealed: 0.17,
    axialPos: [0, 0, 6.4],
    radialPos: [6.8, 2.2, 5.2],
    cascadePos: [-2.4, 1.8, 4.8],
    pinOffset: [4.2, -1.5, 0.1],
    thermalTemp: 0.58
  },
  {
    id: 'logicboard',
    index: '04',
    name: 'Stacked MLB & A20 Pro Silicon',
    sub: '2nm GAA Architecture • 16GB LPDDR6',
    code: 'MOD-04 // DUAL-SIDED MAIN LOGIC BOARD',
    desc: 'Ultra-compact 22-layer high-density interconnect (HDI) substrate housing the Apple A20 Pro 2nm SoC, 16GB unified LPDDR6 memory, C2 5G modem, and Wi-Fi 7 transceiver.',
    specs: [
      ['SOC SILICON', 'Apple A20 Pro (TSMC N2)'],
      ['TRANSISTORS', '28.4 Billion (GAA Nanosheet)'],
      ['NEURAL ENGINE', '32-Core (68 TOPS FP16)'],
      ['BOARD LAYOUT', 'Dual-Stacked SLP Substrate']
    ],
    zSealed: 0.08,
    axialPos: [-1.45, 0.6, 4.0],
    radialPos: [-6.6, 0.8, 2.8],
    cascadePos: [-1.4, 0.7, 2.9],
    pinOffset: [-3.1, -0.5, 0.2],
    thermalTemp: 0.98
  },
  {
    id: 'camera',
    index: '05',
    name: 'Pro Camera & Tetraprism Array',
    sub: 'Triple 48MP Sensors • 5×/10× Optical',
    code: 'MOD-05 // OPTICAL IMAGING SUBSYSTEM',
    desc: 'Triple 48MP Pro camera module featuring a 2nd-gen quad-pixel Fusion sensor with 3D sensor-shift OIS, 48MP Ultra Wide, and folded glass Tetraprism telephoto.',
    specs: [
      ['MAIN SENSOR', '48MP 1/1.14" Quad-Pixel'],
      ['TELEPHOTO', '48MP 120mm 5× Tetraprism'],
      ['ULTRA WIDE', '48MP 13mm f/2.0 Hybrid'],
      ['DEPTH RANGING', 'Direct ToF LiDAR Scanner']
    ],
    zSealed: 0.04,
    axialPos: [1.55, 4.55, 2.1],
    radialPos: [5.9, 5.6, 1.6],
    cascadePos: [1.2, 4.6, 1.4],
    pinOffset: [3.2, 1.4, 0.2],
    thermalTemp: 0.52
  },
  {
    id: 'chassis',
    index: '06',
    name: 'Grade 5 Titanium Unibody',
    sub: 'Ti-6Al-4V Frame + Bonded 100% Recycled Al',
    code: 'MOD-06 // STRUCTURAL MIDFRAME CHASSIS',
    desc: 'Aerospace-grade Ti-6Al-4V titanium outer band solid-state diffusion-bonded to a 100% recycled aluminum thermal substructure, featuring the sapphire Camera Control sensor.',
    specs: [
      ['ALLOY GRADE', 'Ti-6Al-4V (Grade 5)'],
      ['SURFACE FINISH', 'PVD + Fine Micro-Brush'],
      ['CONTROLS', 'Action + Sapphire Camera Ctrl'],
      ['INGRESS RATING', 'IP68 (6 meters / 30 min)']
    ],
    zSealed: 0.0,
    axialPos: [0, 0, 0.0],
    radialPos: [0, 0, 0.0],
    cascadePos: [0, 0, 0.0],
    pinOffset: [-4.3, -4.0, 0.0],
    thermalTemp: 0.44
  },
  {
    id: 'battery',
    index: '07',
    name: 'Steel-Cased L-Shape Battery',
    sub: '4,850 mAh • 18.85 Wh Silicon-Anode',
    code: 'MOD-07 // HIGH-DENSITY ENERGY CELL',
    desc: 'Laser-welded stainless steel enclosure increases volumetric cell density by 9% while acting as a rigid structural heat sink. Supports 45W USB-C PD and 25W MagSafe.',
    specs: [
      ['CAPACITY', '4,850 mAh / 18.85 Wh'],
      ['ENCLOSURE', '0.3mm Brushed SUS304 Steel'],
      ['CHEMISTRY', 'High-Silicon Anode Li-Ion'],
      ['RELEASE SYSTEM', 'Electrically Induced Adhesive']
    ],
    zSealed: -0.06,
    axialPos: [0.65, -0.85, -2.5],
    radialPos: [6.4, -1.8, -2.2],
    cascadePos: [1.5, -1.1, -1.9],
    pinOffset: [3.6, -1.2, 0.0],
    thermalTemp: 0.68
  },
  {
    id: 'taptic',
    index: '08',
    name: 'Taptic Engine & Thunderbolt 5',
    sub: 'Linear Reluctance Motor • 80 Gbps I/O',
    code: 'MOD-08 // ACOUSTIC & I/O LOWER DECK',
    desc: 'High-mass tungsten linear actuator for crisp haptic feedback, paired with the lower spatial audio woofer chamber and a titanium-reinforced Thunderbolt 5 USB-C port.',
    specs: [
      ['HAPTICS', '3rd-Gen Neodymium Taptic'],
      ['WIRED I/O', 'USB-C / Thunderbolt 5'],
      ['PEAK BANDWIDTH', 'Up to 80 Gbps Bi-Dir'],
      ['ACOUSTICS', 'Dual-Membrane Sealed Driver']
    ],
    zSealed: -0.14,
    axialPos: [0, -6.1, -4.8],
    radialPos: [-5.2, -6.4, -4.0],
    cascadePos: [2.4, -6.2, -3.7],
    pinOffset: [-3.8, -0.4, 0.0],
    thermalTemp: 0.38
  },
  {
    id: 'magsafe',
    index: '09',
    name: 'MagSafe Qi2.2 & Vapor Chamber',
    sub: '25W Nanocrystalline Coil + Copper Loop',
    code: 'MOD-09 // INDUCTIVE & VAPOR MATRIX',
    desc: 'Multi-strand Litz copper wireless charging coil surrounded by 36 N52SH rare-earth magnets, integrated directly over an ultra-thin sintered copper micro-vapor chamber.',
    specs: [
      ['WIRELESS POWER', '25W MagSafe / Qi2.2'],
      ['MAGNET ARRAY', '36× N52SH NdFeB Segments'],
      ['VAPOR CHAMBER', '0.28mm Sintered Copper Wick'],
      ['NFC / UWB', '2nd-Gen Ultra Wideband']
    ],
    zSealed: -0.25,
    axialPos: [0, -0.5, -7.4],
    radialPos: [-6.0, -1.2, -6.6],
    cascadePos: [3.6, -1.6, -5.8],
    pinOffset: [3.8, -2.2, 0.0],
    thermalTemp: 0.82
  },
  {
    id: 'backglass',
    index: '10',
    name: 'Matte Ceramic Glass & Sapphire',
    sub: 'Color-Infused Micro-Etched Rear Shell',
    code: 'MOD-10 // REAR ENCLOSURE & OPTICS HOOD',
    desc: 'Dual-ion-exchange strengthened rear glass featuring a sculpted 3D camera plateau, precision-milled titanium lens bezels, and anti-reflective sapphire crystal lens covers.',
    specs: [
      ['SURFACE TEXTURE', 'Nanocrystal Matte Etch'],
      ['LENS COVERS', '99.9% Pure Sapphire Crystal'],
      ['COATING', '7-Layer Super-Low Reflectance'],
      ['REPAIRABILITY', 'Dual-Entry Structural Frame']
    ],
    zSealed: -0.37,
    axialPos: [0, 0, -10.4],
    radialPos: [0, -1.0, -9.8],
    cascadePos: [5.2, -3.2, -8.2],
    pinOffset: [4.2, 3.6, -0.2],
    thermalTemp: 0.34
  }
];

// ============================================================================
// 2. PROCEDURAL HIGH-RES TEXTURE GENERATORS
// ============================================================================
function createRoundedRectShape(w, h, r) {
  const shape = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

function createRoundedRectPath(w, h, r) {
  const path = new THREE.Path();
  const x = -w / 2;
  const y = -h / 2;
  path.moveTo(x + r, y);
  path.lineTo(x + w - r, y);
  path.quadraticCurveTo(x + w, y, x + w, y + r);
  path.lineTo(x + w, y + h - r);
  path.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  path.lineTo(x + r, y + h);
  path.quadraticCurveTo(x, y + h, x, y + h - r);
  path.lineTo(x, y + r);
  path.quadraticCurveTo(x, y, x + r, y);
  return path;
}

function createOLEDDisplayTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 2150;
  const ctx = canvas.getContext('2d');

  // Deep Pro Wallpaper Gradient
  const bg = ctx.createLinearGradient(0, 0, 1024, 2150);
  bg.addColorStop(0.0, '#07080d');
  bg.addColorStop(0.28, '#1c1510');
  bg.addColorStop(0.55, '#463527');
  bg.addColorStop(0.78, '#171c28');
  bg.addColorStop(1.0, '#050609');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1024, 2150);

  // Flowing Titanium Pro Light Ribbons
  ctx.save();
  for (let i = 0; i < 4; i++) {
    const grad = ctx.createRadialGradient(
      280 + i * 160,
      780 + i * 210,
      40,
      512,
      1050,
      680
    );
    grad.addColorStop(0, i % 2 === 0 ? 'rgba(228, 195, 158, 0.52)' : 'rgba(110, 155, 235, 0.32)');
    grad.addColorStop(0.55, 'rgba(180, 140, 105, 0.14)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(512 + (i - 1.5) * 90, 1060 + (i - 1.5) * 110, 460, 290, (i * 0.42), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Subtle fine geometric CAD grid on wallpaper
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
  ctx.lineWidth = 1.5;
  for (let y = 160; y < 2000; y += 120) {
    ctx.beginPath();
    ctx.moveTo(60, y);
    ctx.lineTo(964, y);
    ctx.stroke();
  }

  // Status Bar Icons
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.font = '600 30px Inter, -apple-system, sans-serif';
  ctx.fillText('5G+', 118, 108);
  // Battery icon
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 3;
  ctx.strokeRect(860, 82, 68, 30);
  ctx.fillRect(865, 87, 54, 20);
  ctx.fillRect(931, 91, 5, 12);

  // Lockscreen Date & Time
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(232, 214, 192, 0.88)';
  ctx.font = '600 38px Inter, -apple-system, sans-serif';
  ctx.fillText('WEDNESDAY, OCTOBER 14', 512, 315);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 230px Inter, -apple-system, sans-serif';
  ctx.fillText('09:41', 512, 535);

  // Lockscreen Widgets Row
  const drawWidget = (cx, cy, label, val, sub) => {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.09)';
    ctx.beginPath();
    ctx.roundRect(cx - 190, cy - 75, 380, 150, 36);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(217, 190, 159, 0.9)';
    ctx.font = '600 22px JetBrains Mono, monospace';
    ctx.fillText(label, cx - 155, cy - 24);

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 36px Inter, sans-serif';
    ctx.fillText(val, cx - 155, cy + 22);

    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '500 21px Inter, sans-serif';
    ctx.fillText(sub, cx - 155, cy + 54);
  };

  drawWidget(300, 690, 'A20 PRO TELEMETRY', '2.0 nm GAA', '32-Core NPU • 68 TOPS');
  drawWidget(724, 690, 'THERMAL CHAMBER', '31.4°C OPTIMAL', 'Vapor Loop Active');

  // Bottom CAD Diagnostics Pill
  ctx.fillStyle = 'rgba(12, 14, 18, 0.72)';
  ctx.beginPath();
  ctx.roundRect(112, 1760, 800, 170, 44);
  ctx.fill();
  ctx.strokeStyle = 'rgba(217, 190, 159, 0.35)';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#d9be9f';
  ctx.font = '600 24px JetBrains Mono, monospace';
  ctx.fillText('IPHONE 18 PRO MAX // CAD EXPLODED DIAGNOSTIC', 158, 1824);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.font = '400 26px Inter, sans-serif';
  ctx.fillText('Super Retina XDR • ProMotion 120Hz • Ceramic Shield 3', 158, 1872);

  // Home Indicator Bar
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.beginPath();
  ctx.roundRect(332, 2085, 360, 14, 7);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function createA20ChipTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Silicon substrate sheen
  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, '#14161b');
  grad.addColorStop(0.5, '#232730');
  grad.addColorStop(1, '#101216');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Gold perimeter BGA/bond accents
  ctx.strokeStyle = 'rgba(218, 184, 136, 0.55)';
  ctx.lineWidth = 4;
  ctx.strokeRect(18, 18, 476, 476);

  // Subtle die floorplan grid lines
  ctx.strokeStyle = 'rgba(120, 170, 255, 0.08)';
  ctx.lineWidth = 2;
  for (let i = 40; i < 470; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 36);
    ctx.lineTo(i, 476);
    ctx.stroke();
  }

  // Laser-etched typography
  ctx.fillStyle = '#e5d1b8';
  ctx.textAlign = 'center';
  ctx.font = '700 66px Inter, -apple-system, sans-serif';
  ctx.fillText('A20 PRO', 256, 265);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.font = '500 26px JetBrains Mono, monospace';
  ctx.fillText('APL1W20 • 2NM GAA', 256, 330);
  ctx.fillText('TSMC N2P // TAIWAN', 256, 372);

  // Minimal geometric Apple emblem at top
  ctx.fillStyle = '#e5d1b8';
  ctx.beginPath();
  ctx.arc(256, 148, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(268, 108, 12, 6, -0.6, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createBatteryLabelTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  // Brushed stainless steel base
  const grad = ctx.createLinearGradient(0, 0, 1024, 1024);
  grad.addColorStop(0, '#2a2d34');
  grad.addColorStop(0.45, '#3b3f48');
  grad.addColorStop(1, '#23262c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 1024);

  // Micro brushed vertical grain
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 1;
  for (let x = 0; x < 1024; x += 4) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 1024);
    ctx.stroke();
  }

  // Technical silkscreen print
  ctx.fillStyle = 'rgba(235, 238, 245, 0.72)';
  ctx.font = '600 32px Inter, sans-serif';
  ctx.fillText('Rechargeable Li-ion Polymer Battery', 260, 320);

  ctx.font = '700 48px JetBrains Mono, monospace';
  ctx.fillStyle = '#e5cfa9';
  ctx.fillText('4850 mAh • 18.85 Wh', 260, 390);

  ctx.fillStyle = 'rgba(235, 238, 245, 0.55)';
  ctx.font = '500 24px JetBrains Mono, monospace';
  ctx.fillText('NOMINAL VOLTAGE: 3.89V === CHARGE LIMIT: 4.48V', 260, 445);
  ctx.fillText('APN: 616-01842 // STEEL THERMAL ENCLOSURE', 260, 488);
  ctx.fillText('DESIGNED BY APPLE IN CALIFORNIA', 260, 540);

  // Regulatory boxes
  ctx.strokeStyle = 'rgba(235, 238, 245, 0.45)';
  ctx.lineWidth = 3;
  ctx.strokeRect(260, 590, 96, 64);
  ctx.strokeRect(380, 590, 96, 64);
  ctx.strokeRect(500, 590, 130, 64);
  ctx.font = '700 28px JetBrains Mono, monospace';
  ctx.fillText('CE', 288, 632);
  ctx.fillText('UL', 410, 632);
  ctx.fillText('Li-ion', 520, 632);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ============================================================================
// 3. THREE.JS SCENE, CAMERA & POST-PROCESSING INITIALIZATION
// ============================================================================
const container = document.getElementById('canvas-container');
const labelsContainer = document.getElementById('labels-container');

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance'
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07080b);
scene.fog = new THREE.FogExp2(0x07080b, 0.012);

const pmremGenerator = new THREE.PMREMGenerator(renderer);
scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(
  38,
  window.innerWidth / window.innerHeight,
  0.1,
  200
);
camera.position.set(17.5, 8.2, 23.5);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.maxDistance = 58;
controls.minDistance = 6.5;
controls.target.set(0, 0.2, 0);

// Post-processing with subtle bloom for OLED & gold highlights
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.22, // strength
  0.45, // radius
  0.85  // threshold
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

// Studio Lighting Setup
const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(0xfff5e8, 2.4);
keyLight.position.set(18, 26, 22);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x8ab4ff, 1.45);
rimLight.position.set(-22, -12, -18);
scene.add(rimLight);

const fillLight = new THREE.DirectionalLight(0xffe0c2, 1.1);
fillLight.position.set(-16, 14, 16);
scene.add(fillLight);

// Subtle Engineering Floor Grid & Reference Rings
const envGroup = new THREE.Group();
scene.add(envGroup);

const gridHelper = new THREE.GridHelper(56, 56, 0x3b352d, 0x161820);
gridHelper.position.y = -11.5;
gridHelper.material.transparent = true;
gridHelper.material.opacity = 0.45;
envGroup.add(gridHelper);

const ringGeo = new THREE.RingGeometry(8.5, 8.56, 96);
ringGeo.rotateX(-Math.PI / 2);
const ringMat = new THREE.MeshBasicMaterial({
  color: 0xd9be9f,
  transparent: true,
  opacity: 0.22,
  side: THREE.DoubleSide
});
const floorRing = new THREE.Mesh(ringGeo, ringMat);
floorRing.position.y = -11.48;
envGroup.add(floorRing);

// ============================================================================
// 4. SHARED PBR MATERIALS PALETTE
// ============================================================================
const currentFinish = FINISHES.desert;

const MATS = {
  titanium: new THREE.MeshStandardMaterial({
    color: currentFinish.titanium,
    metalness: 0.88,
    roughness: 0.26
  }),
  titaniumDark: new THREE.MeshStandardMaterial({
    color: currentFinish.titaniumDark,
    metalness: 0.82,
    roughness: 0.35
  }),
  backGlass: new THREE.MeshPhysicalMaterial({
    color: currentFinish.backGlass,
    metalness: 0.15,
    roughness: 0.36,
    clearcoat: 0.65,
    clearcoatRoughness: 0.28,
    reflectivity: 0.8
  }),
  cameraPlateauGlass: new THREE.MeshPhysicalMaterial({
    color: currentFinish.backGlass,
    metalness: 0.18,
    roughness: 0.12,
    transmission: 0.25,
    thickness: 0.4,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06
  }),
  chromeLogo: new THREE.MeshStandardMaterial({
    color: 0xf5ece2,
    metalness: 0.98,
    roughness: 0.05
  }),
  oledScreen: new THREE.MeshStandardMaterial({
    map: createOLEDDisplayTexture(),
    emissive: new THREE.Color(0xffffff),
    emissiveMap: createOLEDDisplayTexture(),
    emissiveIntensity: 0.72,
    roughness: 0.08,
    metalness: 0.1
  }),
  bezelBlack: new THREE.MeshStandardMaterial({
    color: 0x08090c,
    roughness: 0.15,
    metalness: 0.3
  }),
  pcbBlack: new THREE.MeshStandardMaterial({
    color: 0x11151c,
    roughness: 0.38,
    metalness: 0.25
  }),
  goldContact: new THREE.MeshStandardMaterial({
    color: 0xe6be7a,
    metalness: 0.95,
    roughness: 0.16
  }),
  copper: new THREE.MeshStandardMaterial({
    color: 0xd47c4a,
    metalness: 0.92,
    roughness: 0.22
  }),
  graphene: new THREE.MeshStandardMaterial({
    color: 0x22252b,
    metalness: 0.68,
    roughness: 0.32
  }),
  steelShield: new THREE.MeshStandardMaterial({
    color: 0x8f949e,
    metalness: 0.88,
    roughness: 0.28
  }),
  sapphireLens: new THREE.MeshPhysicalMaterial({
    color: 0x0b1528,
    metalness: 0.1,
    roughness: 0.04,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    iridescence: 0.85,
    iridescenceIOR: 1.45
  }),
  a20Top: new THREE.MeshStandardMaterial({
    map: createA20ChipTexture(),
    roughness: 0.22,
    metalness: 0.65
  }),
  batterySteel: new THREE.MeshStandardMaterial({
    map: createBatteryLabelTexture(),
    metalness: 0.78,
    roughness: 0.30
  })
};

// ============================================================================
// 5. BUILD ALL 10 ARCHITECTURAL HARDWARE LAYERS
// ============================================================================
const phoneRoot = new THREE.Group();
scene.add(phoneRoot);

const layerGroups = new Map();
const interactiveMeshes = [];

function registerLayer(id, group) {
  group.userData.layerId = id;
  group.traverse((child) => {
    if (child.isMesh) {
      child.userData.layerId = id;
      child.userData.origMaterial = child.material;
      child.castShadow = true;
      child.receiveShadow = true;
      interactiveMeshes.push(child);
    }
  });
  layerGroups.set(id, group);
  phoneRoot.add(group);
}

// ----------------------------------------------------------------------------
// LAYER 01: Super Retina XDR OLED + Ceramic Shield Gen 3
// ----------------------------------------------------------------------------
function buildDisplayLayer() {
  const group = new THREE.Group();

  // Outer Ceramic Shield glass frame
  const bezelShape = createRoundedRectShape(PHONE.W - 0.16, PHONE.H - 0.16, PHONE.R - 0.06);
  const bezelGeo = new THREE.ExtrudeGeometry(bezelShape, {
    depth: 0.065,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.015,
    bevelSegments: 3,
    curveSegments: 24
  });
  bezelGeo.center();
  const bezelMesh = new THREE.Mesh(bezelGeo, MATS.bezelBlack);
  group.add(bezelMesh);

  // Active OLED illuminated panel
  const screenShape = createRoundedRectShape(PHONE.W - 0.38, PHONE.H - 0.38, PHONE.R - 0.15);
  const screenGeo = new THREE.ShapeGeometry(screenShape, 24);
  // Normalize UVs from [-W/2, W/2] to [0, 1]
  const pos = screenGeo.attributes.position;
  const uvs = new Float32Array(pos.count * 2);
  const sw = PHONE.W - 0.38;
  const sh = PHONE.H - 0.38;
  for (let i = 0; i < pos.count; i++) {
    uvs[i * 2] = (pos.getX(i) + sw / 2) / sw;
    uvs[i * 2 + 1] = (pos.getY(i) + sh / 2) / sh;
  }
  screenGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

  const screenMesh = new THREE.Mesh(screenGeo, MATS.oledScreen);
  screenMesh.position.z = 0.044;
  group.add(screenMesh);

  // Under-display compact Dynamic Island pill cutout
  const pillShape = createRoundedRectShape(1.65, 0.44, 0.22);
  const pillGeo = new THREE.ShapeGeometry(pillShape, 16);
  const pillMesh = new THREE.Mesh(pillGeo, MATS.bezelBlack);
  pillMesh.position.set(0, PHONE.H / 2 - 0.78, 0.048);
  group.add(pillMesh);

  // Tiny front camera sapphire pupil inside Dynamic Island
  const pupilGeo = new THREE.CircleGeometry(0.11, 20);
  const pupilMesh = new THREE.Mesh(pupilGeo, MATS.sapphireLens);
  pupilMesh.position.set(0.52, PHONE.H / 2 - 0.78, 0.051);
  group.add(pupilMesh);

  // Copper display driver IC & flex cable on underside of OLED
  const ddicGeo = new THREE.BoxGeometry(2.6, 0.42, 0.03);
  const ddicMesh = new THREE.Mesh(ddicGeo, MATS.goldContact);
  ddicMesh.position.set(0, -PHONE.H / 2 + 0.85, -0.045);
  group.add(ddicMesh);

  return group;
}

// ----------------------------------------------------------------------------
// LAYER 02: Under-Display Face ID & TrueDepth Photonics
// ----------------------------------------------------------------------------
function buildTrueDepthLayer() {
  const group = new THREE.Group();

  // Main black CNC sensor bracket positioned near top
  const bracketGeo = new THREE.BoxGeometry(2.85, 0.78, 0.24);
  const bracket = new THREE.Mesh(bracketGeo, MATS.pcbBlack);
  bracket.position.set(-0.35, 6.65, 0);
  group.add(bracket);

  // Gold-framed VCSEL Dot Projector, Flood Illuminator, and 24MP RGB/IR lens
  const lensOffsets = [-0.95, -0.15, 0.72];
  lensOffsets.forEach((ox, idx) => {
    const barrelGeo = new THREE.CylinderGeometry(0.24, 0.26, 0.28, 24);
    barrelGeo.rotateX(Math.PI / 2);
    const barrel = new THREE.Mesh(barrelGeo, idx === 1 ? MATS.copper : MATS.steelShield);
    barrel.position.set(-0.35 + ox, 6.65, 0.04);
    group.add(barrel);

    const glassGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.30, 24);
    glassGeo.rotateX(Math.PI / 2);
    const glass = new THREE.Mesh(glassGeo, MATS.sapphireLens);
    glass.position.set(-0.35 + ox, 6.65, 0.05);
    group.add(glass);
  });

  // Polyimide flex ribbons connecting down to Logic Board
  const flexGeo = new THREE.BoxGeometry(0.65, 2.2, 0.03);
  const flex = new THREE.Mesh(flexGeo, MATS.pcbBlack);
  flex.position.set(-1.1, 5.4, -0.05);
  group.add(flex);

  const connectorGeo = new THREE.BoxGeometry(0.75, 0.22, 0.06);
  const connector = new THREE.Mesh(connectorGeo, MATS.goldContact);
  connector.position.set(-1.1, 4.4, -0.03);
  group.add(connector);

  return group;
}

// ----------------------------------------------------------------------------
// LAYER 03: EMI Shielding & Graphene Thermal Spreader Plate
// ----------------------------------------------------------------------------
function buildEMIShieldLayer() {
  const group = new THREE.Group();

  const shieldShape = createRoundedRectShape(PHONE.W - 0.72, PHONE.H - 0.92, 0.72);
  // Cutout window for the camera module (top-right from front, or top-left)
  const camHole = createRoundedRectPath(3.2, 3.3, 0.45);
  // Translate camHole to top-right
  camHole.curves.forEach((c) => {
    if (c.v1) { c.v1.x += 1.5; c.v1.y += 5.2; }
    if (c.v2) { c.v2.x += 1.5; c.v2.y += 5.2; }
    if (c.v0) { c.v0.x += 1.5; c.v0.y += 5.2; }
  });
  shieldShape.holes.push(camHole);

  const shieldGeo = new THREE.ExtrudeGeometry(shieldShape, {
    depth: 0.04,
    bevelEnabled: false,
    curveSegments: 18
  });
  shieldGeo.center();
  const shieldMesh = new THREE.Mesh(shieldGeo, MATS.steelShield);
  group.add(shieldMesh);

  // Dark pyrolytic graphene thermal pad laminated in the center
  const grapheneGeo = new THREE.BoxGeometry(4.6, 9.8, 0.052);
  const grapheneMesh = new THREE.Mesh(grapheneGeo, MATS.graphene);
  grapheneMesh.position.set(-0.6, -1.2, 0);
  group.add(grapheneMesh);

  // Copper thermal bridge strips
  for (let i = -2; i <= 2; i++) {
    const stripGeo = new THREE.BoxGeometry(4.2, 0.14, 0.06);
    const strip = new THREE.Mesh(stripGeo, MATS.copper);
    strip.position.set(-0.6, -1.2 + i * 1.6, 0.01);
    group.add(strip);
  }

  return group;
}

// ----------------------------------------------------------------------------
// LAYER 04: Stacked MLB & Apple A20 Pro (2nm Silicon)
// ----------------------------------------------------------------------------
function buildLogicBoardLayer() {
  const group = new THREE.Group();

  // L-shaped / elongated vertical multi-layer PCB on left side
  const pcbShape = new THREE.Shape();
  pcbShape.moveTo(-3.2, -3.2);
  pcbShape.lineTo(-0.3, -3.2);
  pcbShape.lineTo(-0.3, 2.8);
  pcbShape.lineTo(0.4, 2.8);
  pcbShape.lineTo(0.4, 5.8);
  pcbShape.lineTo(-3.2, 5.8);
  pcbShape.closePath();

  const pcbGeo = new THREE.ExtrudeGeometry(pcbShape, {
    depth: 0.14,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.015,
    bevelSegments: 2
  });
  const pcbMesh = new THREE.Mesh(pcbGeo, MATS.pcbBlack);
  pcbMesh.position.z = -0.07;
  group.add(pcbMesh);

  // Gold edge perimeter trace strip
  const goldStripGeo = new THREE.BoxGeometry(0.12, 8.6, 0.16);
  const goldStrip = new THREE.Mesh(goldStripGeo, MATS.goldContact);
  goldStrip.position.set(-3.16, 1.3, 0);
  group.add(goldStrip);

  // Centerpiece: Apple A20 Pro SoC package
  const a20SubstrateGeo = new THREE.BoxGeometry(1.95, 1.95, 0.12);
  const a20Substrate = new THREE.Mesh(a20SubstrateGeo, MATS.goldContact);
  a20Substrate.position.set(-1.75, 1.45, 0.08);
  group.add(a20Substrate);

  const a20DieGeo = new THREE.BoxGeometry(1.82, 1.82, 0.14);
  const a20Die = new THREE.Mesh(a20DieGeo, MATS.a20Top);
  a20Die.position.set(-1.75, 1.45, 0.10);
  group.add(a20Die);

  // Secondary IC Packages: 1TB NAND, Apple C2 5G Modem, PMIC, Audio Codec
  const chips = [
    { x: -1.75, y: 3.85, w: 1.65, h: 1.35, mat: MATS.graphene },     // 1TB NAND Flash
    { x: -1.75, y: -0.75, w: 1.55, h: 1.45, mat: MATS.steelShield }, // Apple C2 5G Modem
    { x: -1.75, y: -2.35, w: 1.45, h: 0.95, mat: MATS.graphene },    // Power Management IC
    { x: -0.65, y: 4.95, w: 1.15, h: 0.95, mat: MATS.steelShield }   // Wi-Fi 7 / UWB Module
  ];

  chips.forEach((c) => {
    const icGeo = new THREE.BoxGeometry(c.w, c.h, 0.15);
    const icMesh = new THREE.Mesh(icGeo, c.mat);
    icMesh.position.set(c.x, c.y, 0.09);
    group.add(icMesh);
  });

  // Micro SMD capacitors & board-to-board B2B gold connectors
  for (let i = 0; i < 14; i++) {
    const capGeo = new THREE.BoxGeometry(0.18, 0.09, 0.12);
    const cap = new THREE.Mesh(capGeo, i % 2 === 0 ? MATS.goldContact : MATS.copper);
    cap.position.set(-0.55, -2.8 + i * 0.42, 0.09);
    group.add(cap);
  }

  return group;
}

// ----------------------------------------------------------------------------
// LAYER 05: Pro Camera System (Triple 48MP + Tetraprism Telephoto)
// ----------------------------------------------------------------------------
function buildCameraModuleLayer() {
  const group = new THREE.Group();

  // CNC Aluminum-Titanium optical housing block (top-right side)
  const housingGeo = new RoundedBoxGeometry(3.25, 3.45, 0.34, 4, 0.35);
  const housing = new THREE.Mesh(housingGeo, MATS.titaniumDark);
  housing.position.set(1.55, 5.15, 0);
  group.add(housing);

  // 3 Pro Lens Assemblies (Triangular Pro layout)
  const lenses = [
    { x: 2.32, y: 6.02, r: 0.66 }, // 48MP Ultra Wide
    { x: 2.32, y: 4.28, r: 0.70 }, // 48MP Fusion Main w/ Sensor-Shift
    { x: 0.82, y: 5.15, r: 0.66 }  // 48MP 5x/10x Tetraprism Telephoto
  ];

  lenses.forEach((l, idx) => {
    // Copper OIS electromagnetic actuator ring
    const coilGeo = new THREE.CylinderGeometry(l.r + 0.06, l.r + 0.06, 0.38, 32);
    coilGeo.rotateX(Math.PI / 2);
    const coil = new THREE.Mesh(coilGeo, idx === 1 ? MATS.copper : MATS.steelShield);
    coil.position.set(l.x, l.y, 0.02);
    group.add(coil);

    // Stepped metallic lens barrel
    const barrelGeo = new THREE.CylinderGeometry(l.r - 0.04, l.r, 0.48, 32);
    barrelGeo.rotateX(Math.PI / 2);
    const barrel = new THREE.Mesh(barrelGeo, MATS.bezelBlack);
    barrel.position.set(l.x, l.y, -0.06);
    group.add(barrel);

    // Multi-coated sapphire optical element
    const opticGeo = new THREE.CylinderGeometry(l.r * 0.72, l.r * 0.72, 0.52, 32);
    opticGeo.rotateX(Math.PI / 2);
    const optic = new THREE.Mesh(opticGeo, MATS.sapphireLens);
    optic.position.set(l.x, l.y, -0.07);
    group.add(optic);

    // Gold B2B flex connector on front side of camera module
    const fpcGeo = new THREE.BoxGeometry(0.65, 0.24, 0.22);
    const fpc = new THREE.Mesh(fpcGeo, MATS.goldContact);
    fpc.position.set(0.25, 4.3 + idx * 0.82, 0.1);
    group.add(fpc);
  });

  // LiDAR Scanner & Adaptive True Tone Flash
  const lidarGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.42, 24);
  lidarGeo.rotateX(Math.PI / 2);
  const lidar = new THREE.Mesh(lidarGeo, MATS.graphene);
  lidar.position.set(0.82, 3.92, -0.04);
  group.add(lidar);

  const flashGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.42, 24);
  flashGeo.rotateX(Math.PI / 2);
  const flashMat = new THREE.MeshStandardMaterial({
    color: 0xfff3d1,
    emissive: 0xffd28a,
    emissiveIntensity: 0.35,
    roughness: 0.2
  });
  const flash = new THREE.Mesh(flashGeo, flashMat);
  flash.position.set(0.82, 6.38, -0.04);
  group.add(flash);

  return group;
}

// ----------------------------------------------------------------------------
// LAYER 06: Grade 5 Titanium Structural Unibody Midframe
// ----------------------------------------------------------------------------
function buildTitaniumChassisLayer() {
  const group = new THREE.Group();

  // Outer perimeter shape with hollow CNC-machined interior cavity
  const outerShape = createRoundedRectShape(PHONE.W, PHONE.H, PHONE.R);
  const innerHole = createRoundedRectPath(PHONE.W - 0.62, PHONE.H - 0.62, PHONE.R - 0.28);
  outerShape.holes.push(innerHole);

  const bandGeo = new THREE.ExtrudeGeometry(outerShape, {
    depth: PHONE.D - 0.14,
    bevelEnabled: true,
    bevelThickness: 0.07,
    bevelSize: 0.06,
    bevelSegments: 5,
    curveSegments: 32
  });
  bandGeo.center();
  const bandMesh = new THREE.Mesh(bandGeo, MATS.titanium);
  group.add(bandMesh);

  // Bonded 100% recycled aluminum internal mid-plate web struts
  const crossBar1 = new THREE.Mesh(
    new THREE.BoxGeometry(PHONE.W - 0.5, 0.45, 0.12),
    MATS.titaniumDark
  );
  crossBar1.position.set(0, 3.25, 0);
  group.add(crossBar1);

  const crossBar2 = new THREE.Mesh(
    new THREE.BoxGeometry(PHONE.W - 0.5, 0.45, 0.12),
    MATS.titaniumDark
  );
  crossBar2.position.set(0, -5.25, 0);
  group.add(crossBar2);

  // Side Buttons: Action Button, Volume Up, Volume Down (Left side: -X)
  const leftButtons = [
    { y: 4.5, h: 0.72 }, // Action Button
    { y: 2.9, h: 1.25 }, // Volume Up
    { y: 1.2, h: 1.25 }  // Volume Down
  ];
  leftButtons.forEach((b) => {
    const btnGeo = new RoundedBoxGeometry(0.16, b.h, 0.26, 3, 0.05);
    const btn = new THREE.Mesh(btnGeo, MATS.titanium);
    btn.position.set(-PHONE.W / 2 - 0.04, b.y, 0);
    group.add(btn);
  });

  // Right Side Buttons: Power/Side Button + Camera Control Capacitive Sapphire Button (+X)
  const pwrGeo = new RoundedBoxGeometry(0.16, 1.95, 0.26, 3, 0.05);
  const pwrBtn = new THREE.Mesh(pwrGeo, MATS.titanium);
  pwrBtn.position.set(PHONE.W / 2 + 0.04, 2.35, 0);
  group.add(pwrBtn);

  // Sapphire Camera Control Button (Lower Right)
  const camCtrlGeo = new RoundedBoxGeometry(0.14, 1.45, 0.28, 3, 0.05);
  const camCtrl = new THREE.Mesh(camCtrlGeo, MATS.goldContact);
  camCtrl.position.set(PHONE.W / 2 + 0.02, -3.1, 0);
  group.add(camCtrl);

  return group;
}

// ----------------------------------------------------------------------------
// LAYER 07: Steel-Cased L-Shaped High-Density Battery (4,850 mAh)
// ----------------------------------------------------------------------------
function buildBatteryLayer() {
  const group = new THREE.Group();

  // Authentic L-Shaped Battery footprint wrapping around the Logic Board
  const batShape = new THREE.Shape();
  batShape.moveTo(-3.15, -5.1);
  batShape.lineTo(3.18, -5.1);
  batShape.lineTo(3.18, 3.05);
  batShape.lineTo(-0.05, 3.05);
  batShape.lineTo(-0.05, -3.45);
  batShape.lineTo(-3.15, -3.45);
  batShape.closePath();

  const batGeo = new THREE.ExtrudeGeometry(batShape, {
    depth: 0.36,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 4
  });

  // Map clean planar UVs for the stainless steel silkscreen label
  const pos = batGeo.attributes.position;
  const uvs = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uvs[i * 2] = (pos.getX(i) + 3.2) / 6.5;
    uvs[i * 2 + 1] = 1.0 - (pos.getY(i) + 5.2) / 8.4;
  }
  batGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

  const batMesh = new THREE.Mesh(batGeo, MATS.batterySteel);
  batMesh.position.z = -0.18;
  group.add(batMesh);

  // Battery BMS protection board & FPC ribbon at bottom-left
  const bmsGeo = new THREE.BoxGeometry(2.8, 0.35, 0.22);
  const bms = new THREE.Mesh(bmsGeo, MATS.pcbBlack);
  bms.position.set(0.2, -5.32, 0);
  group.add(bms);

  const tabGeo = new THREE.BoxGeometry(0.55, 0.42, 0.24);
  const tab = new THREE.Mesh(tabGeo, MATS.goldContact);
  tab.position.set(-0.6, -5.32, 0.02);
  group.add(tab);

  return group;
}

// ----------------------------------------------------------------------------
// LAYER 08: Taptic Engine, Spatial Audio Woofer & Thunderbolt 5 USB-C
// ----------------------------------------------------------------------------
function buildTapticAndUSBLayer() {
  const group = new THREE.Group();

  // Left: Taptic Engine (Linear Magnetic Reluctance Actuator)
  const tapticGeo = new RoundedBoxGeometry(2.75, 1.42, 0.32, 3, 0.1);
  const taptic = new THREE.Mesh(tapticGeo, MATS.steelShield);
  taptic.position.set(-1.65, -6.45, 0);
  group.add(taptic);

  // Copper coil window on Taptic Engine
  const coilAccent = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.65, 0.34),
    MATS.copper
  );
  coilAccent.position.set(-1.65, -6.45, 0);
  group.add(coilAccent);

  // Right: Lower Spatial Audio Speaker Acoustic Chamber
  const spkGeo = new RoundedBoxGeometry(2.45, 1.48, 0.34, 3, 0.1);
  const spk = new THREE.Mesh(spkGeo, MATS.pcbBlack);
  spk.position.set(1.75, -6.45, 0);
  group.add(spk);

  // Center: Titanium USB-C / Thunderbolt 5 Receptacle
  const usbShellGeo = new RoundedBoxGeometry(1.05, 0.95, 0.28, 3, 0.08);
  const usbShell = new THREE.Mesh(usbShellGeo, MATS.titanium);
  usbShell.position.set(0, -7.45, 0);
  group.add(usbShell);

  const usbTongue = new THREE.Mesh(
    new THREE.BoxGeometry(0.66, 0.55, 0.08),
    MATS.goldContact
  );
  usbTongue.position.set(0, -7.55, 0);
  group.add(usbTongue);

  return group;
}

// ----------------------------------------------------------------------------
// LAYER 09: MagSafe Qi2.2 Copper Coil & Sintered Vapor Chamber
// ----------------------------------------------------------------------------
function buildMagSafeAndVaporLayer() {
  const group = new THREE.Group();

  // Outer Graphite carrier film disc
  const filmGeo = new THREE.CylinderGeometry(2.95, 2.95, 0.04, 64);
  filmGeo.rotateX(Math.PI / 2);
  const film = new THREE.Mesh(filmGeo, MATS.graphene);
  film.position.set(0, -0.55, 0);
  group.add(film);

  // Concentric multi-strand copper induction coil rings
  for (let r = 1.45; r <= 2.38; r += 0.18) {
    const ringG = new THREE.TorusGeometry(r, 0.055, 12, 64);
    const ringM = new THREE.Mesh(ringG, MATS.copper);
    ringM.position.set(0, -0.55, -0.02);
    group.add(ringM);
  }

  // Outer radial N52SH magnet ring
  const magRingGeo = new THREE.RingGeometry(2.48, 2.82, 48);
  const magRing = new THREE.Mesh(magRingGeo, MATS.steelShield);
  magRing.position.set(0, -0.55, -0.025);
  group.add(magRing);

  // Vertical MagSafe alignment bar below ring
  const alignBarGeo = new RoundedBoxGeometry(0.42, 1.38, 0.06, 2, 0.12);
  const alignBar = new THREE.Mesh(alignBarGeo, MATS.steelShield);
  alignBar.position.set(0, -4.25, -0.02);
  group.add(alignBar);

  // Sintered Copper Vapor Chamber Heat Pipe extending up to the A20 Pro zone
  const vcGeo = new RoundedBoxGeometry(1.75, 4.8, 0.06, 3, 0.18);
  const vcMesh = new THREE.Mesh(vcGeo, MATS.copper);
  vcMesh.position.set(-1.55, 1.85, 0.03);
  group.add(vcMesh);

  return group;
}

// ----------------------------------------------------------------------------
// LAYER 10: Textured Matte Glass Back & Sapphire Camera Plateau
// ----------------------------------------------------------------------------
function buildBackGlassLayer() {
  const group = new THREE.Group();

  // Main Matte Ceramic-Glass Backplate
  const backShape = createRoundedRectShape(PHONE.W - 0.16, PHONE.H - 0.16, PHONE.R - 0.06);
  const backGeo = new THREE.ExtrudeGeometry(backShape, {
    depth: 0.07,
    bevelEnabled: true,
    bevelThickness: 0.018,
    bevelSize: 0.018,
    bevelSegments: 3,
    curveSegments: 24
  });
  backGeo.center();
  const backMesh = new THREE.Mesh(backGeo, MATS.backGlass);
  group.add(backMesh);

  // Sculpted Glossy Camera Plateau Bump (on rear side: -Z)
  const plateauGeo = new RoundedBoxGeometry(3.55, 3.72, 0.18, 5, 0.55);
  const plateau = new THREE.Mesh(plateauGeo, MATS.cameraPlateauGlass);
  plateau.position.set(1.52, 5.15, -0.10);
  group.add(plateau);

  // 3 Exterior Titanium Lens Bezels + Sapphire Crystal Hoods
  const extLenses = [
    { x: 2.32, y: 6.02, r: 0.72 },
    { x: 2.32, y: 4.28, r: 0.75 },
    { x: 0.82, y: 5.15, r: 0.72 }
  ];

  extLenses.forEach((l) => {
    const bezelGeo = new THREE.CylinderGeometry(l.r, l.r + 0.04, 0.24, 36);
    bezelGeo.rotateX(Math.PI / 2);
    const bezel = new THREE.Mesh(bezelGeo, MATS.titanium);
    bezel.position.set(l.x, l.y, -0.22);
    group.add(bezel);

    const innerRingGeo = new THREE.CylinderGeometry(l.r * 0.86, l.r * 0.86, 0.26, 36);
    innerRingGeo.rotateX(Math.PI / 2);
    const innerRing = new THREE.Mesh(innerRingGeo, MATS.bezelBlack);
    innerRing.position.set(l.x, l.y, -0.23);
    group.add(innerRing);

    const crystalGeo = new THREE.CylinderGeometry(l.r * 0.76, l.r * 0.76, 0.28, 36);
    crystalGeo.rotateX(Math.PI / 2);
    const crystal = new THREE.Mesh(crystalGeo, MATS.sapphireLens);
    crystal.position.set(l.x, l.y, -0.24);
    group.add(crystal);
  });

  // Exterior LiDAR & True Tone Flash Windows
  const lidarExtGeo = new THREE.CylinderGeometry(0.30, 0.30, 0.20, 24);
  lidarExtGeo.rotateX(Math.PI / 2);
  const lidarExt = new THREE.Mesh(lidarExtGeo, MATS.graphene);
  lidarExt.position.set(0.82, 3.92, -0.12);
  group.add(lidarExt);

  const flashExt = new THREE.Mesh(lidarExtGeo, MATS.chromeLogo);
  flashExt.position.set(0.82, 6.38, -0.12);
  group.add(flashExt);

  // Embedded Mirror-Chrome Apple Emblem on Back Glass
  const logoDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.75, 0.75, 0.02, 32),
    MATS.chromeLogo
  );
  logoDisc.rotateX(Math.PI / 2);
  logoDisc.position.set(0, -0.55, -0.05);
  group.add(logoDisc);

  const logoLeaf = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.02, 16),
    MATS.chromeLogo
  );
  logoLeaf.scale.set(1.4, 1, 0.65);
  logoLeaf.rotateX(Math.PI / 2);
  logoLeaf.position.set(0.18, 0.38, -0.05);
  group.add(logoLeaf);

  return group;
}

// Instantiate & Register All 10 Layers
registerLayer('display', buildDisplayLayer());
registerLayer('truedepth', buildTrueDepthLayer());
registerLayer('emishield', buildEMIShieldLayer());
registerLayer('logicboard', buildLogicBoardLayer());
registerLayer('camera', buildCameraModuleLayer());
registerLayer('chassis', buildTitaniumChassisLayer());
registerLayer('battery', buildBatteryLayer());
registerLayer('taptic', buildTapticAndUSBLayer());
registerLayer('magsafe', buildMagSafeAndVaporLayer());
registerLayer('backglass', buildBackGlassLayer());

// ============================================================================
// 6. 3D CAD ASSEMBLY GUIDE LINES (CONNECTING EXPLODED STACK)
// ============================================================================
const guideLinesGroup = new THREE.Group();
phoneRoot.add(guideLinesGroup);

const cornerOffsets = [
  [-PHONE.W * 0.42, PHONE.H * 0.44],
  [PHONE.W * 0.42, PHONE.H * 0.44],
  [-PHONE.W * 0.42, -PHONE.H * 0.44],
  [PHONE.W * 0.42, -PHONE.H * 0.44]
];

const guideLines = cornerOffsets.map(([cx, cy]) => {
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(cx, cy, -12),
    new THREE.Vector3(cx, cy, 12)
  ]);
  const mat = new THREE.LineDashedMaterial({
    color: 0xd9be9f,
    dashSize: 0.25,
    gapSize: 0.22,
    transparent: true,
    opacity: 0.32
  });
  const line = new THREE.Line(geo, mat);
  line.computeLineDistances();
  guideLinesGroup.add(line);
  return { line, cx, cy };
});

// ============================================================================
// 7. UI HUD BINDINGS, CALLOUT PINS & INTERACTION STATE
// ============================================================================
const state = {
  explosionTarget: 0.65,   // 65% initial exploded state
  explosionCurrent: 0.65,
  mode: 'axial',           // 'axial' | 'radial' | 'cascade'
  selectedLayerId: null,
  isolated: false,
  showLabels: true,
  xrayMode: false,
  thermalMode: false,
  autoRotate: true,
  screenAwake: true,
  camAnim: null
};

const layerListEl = document.getElementById('layer-list');
const calloutPins = new Map();

LAYER_DATA.forEach((layer) => {
  // Left Sidebar Item
  const btn = document.createElement('button');
  btn.className = 'layer-item';
  btn.dataset.layerId = layer.id;
  btn.innerHTML = `
    <div class="layer-num">${layer.index}</div>
    <div class="layer-info">
      <div class="layer-name">${layer.name}</div>
      <div class="layer-sub">${layer.sub}</div>
    </div>
  `;
  btn.addEventListener('click', () => selectLayer(layer.id));
  layerListEl.appendChild(btn);

  // Floating 3D Callout Pin
  const pin = document.createElement('div');
  pin.className = 'callout-pin';
  pin.dataset.layerId = layer.id;
  pin.innerHTML = `
    <span class="callout-dot"></span>
    <span class="callout-index">${layer.index}</span>
    <span>${layer.name}</span>
  `;
  pin.addEventListener('click', (e) => {
    e.stopPropagation();
    selectLayer(layer.id);
  });
  labelsContainer.appendChild(pin);
  calloutPins.set(layer.id, pin);
});

// Inspector DOM elements
const inspCode = document.getElementById('insp-code');
const inspTitle = document.getElementById('insp-title');
const inspSubtitle = document.getElementById('insp-subtitle');
const inspDesc = document.getElementById('insp-desc');
const inspSpecs = document.getElementById('insp-specs');
const btnResetSelection = document.getElementById('btn-reset-selection');
const btnIsolatePart = document.getElementById('btn-isolate-part');

function updateInspectorUI(layer) {
  if (!layer) {
    inspCode.textContent = 'SYS-OVERVIEW // 10 MODULES';
    inspTitle.textContent = 'iPhone 18 Pro Max';
    inspSubtitle.textContent = 'Grade 5 Titanium Unibody & Stacked Internal Architecture';
    inspDesc.textContent =
      'Click any component in the 3D viewport or layer stack to isolate its mechanical geometry, inspect manufacturing tolerances, and view thermal-structural specifications.';
    inspSpecs.innerHTML = `
      <div class="spec-card"><span class="spec-label">CHASSIS FOOTPRINT</span><span class="spec-value">163.0 × 77.6 × 8.15 mm</span></div>
      <div class="spec-card"><span class="spec-label">SILICON NODE</span><span class="spec-value">Apple A20 Pro (2nm GAA)</span></div>
      <div class="spec-card"><span class="spec-label">THERMAL SYSTEM</span><span class="spec-value">Copper Vapor Chamber + Graphene</span></div>
      <div class="spec-card"><span class="spec-label">BATTERY CELL</span><span class="spec-value">4,850 mAh Steel-Cased L-Cell</span></div>
    `;
    btnResetSelection.hidden = true;
    btnIsolatePart.classList.remove('active');
    return;
  }

  inspCode.textContent = layer.code;
  inspTitle.textContent = layer.name;
  inspSubtitle.textContent = layer.sub;
  inspDesc.textContent = layer.desc;
  inspSpecs.innerHTML = layer.specs
    .map(
      ([lbl, val]) => `
      <div class="spec-card">
        <span class="spec-label">${lbl}</span>
        <span class="spec-value">${val}</span>
      </div>
    `
    )
    .join('');
  btnResetSelection.hidden = false;
}

function applyMaterialVisualModes() {
  LAYER_DATA.forEach((layer) => {
    const group = layerGroups.get(layer.id);
    const isSelected = state.selectedLayerId === layer.id;
    const isDimmed = state.selectedLayerId && !isSelected;

    group.visible = !(state.isolated && isDimmed);

    group.traverse((child) => {
      if (!child.isMesh) return;

      if (state.thermalMode) {
        const t = layer.thermalTemp;
        const heatColor = new THREE.Color().setHSL((1.0 - t) * 0.62, 0.95, 0.48);
        child.material = new THREE.MeshStandardMaterial({
          color: heatColor,
          emissive: heatColor,
          emissiveIntensity: 0.45 + t * 0.4,
          roughness: 0.3,
          metalness: 0.2,
          wireframe: state.xrayMode,
          transparent: isDimmed,
          opacity: isDimmed ? 0.18 : 1.0
        });
        return;
      }

      if (state.xrayMode || isDimmed) {
        const baseColor = child.userData.origMaterial.color
          ? child.userData.origMaterial.color.clone()
          : new THREE.Color(0xcccccc);
        child.material = new THREE.MeshPhysicalMaterial({
          color: baseColor,
          roughness: 0.25,
          metalness: 0.4,
          wireframe: state.xrayMode && !isSelected,
          transparent: true,
          opacity: isDimmed ? 0.16 : 0.38
        });
      } else {
        child.material = child.userData.origMaterial;
      }
    });
  });
}

function selectLayer(layerId) {
  if (state.selectedLayerId === layerId) {
    state.selectedLayerId = null;
    state.isolated = false;
  } else {
    state.selectedLayerId = layerId;
    // Ensure phone is at least somewhat exploded so internal parts are visible
    if (state.explosionTarget < 0.45) {
      setExplosionValue(65);
    }
  }

  document.querySelectorAll('.layer-item').forEach((el) => {
    el.classList.toggle('active', el.dataset.layerId === state.selectedLayerId);
  });
  calloutPins.forEach((pin, id) => {
    pin.classList.toggle('active', id === state.selectedLayerId);
  });

  const layerObj = LAYER_DATA.find((l) => l.id === state.selectedLayerId) || null;
  updateInspectorUI(layerObj);
  applyMaterialVisualModes();

  if (layerObj) {
    const grp = layerGroups.get(layerObj.id);
    const targetPos = grp.position.clone();
    animateCameraTo(
      new THREE.Vector3(targetPos.x + 11.5, targetPos.y + 3.8, targetPos.z + 13.5),
      targetPos
    );
  }
}

btnResetSelection.addEventListener('click', () => {
  state.selectedLayerId = null;
  state.isolated = false;
  selectLayer(null);
  animateCameraTo(new THREE.Vector3(17.5, 8.2, 23.5), new THREE.Vector3(0, 0.2, 0));
});

btnIsolatePart.addEventListener('click', () => {
  if (!state.selectedLayerId) {
    selectLayer('logicboard');
  }
  state.isolated = !state.isolated;
  btnIsolatePart.classList.toggle('active', state.isolated);
  applyMaterialVisualModes();
});

// Screen Power Toggle
const btnScreenPower = document.getElementById('btn-screen-power');
btnScreenPower.addEventListener('click', () => {
  state.screenAwake = !state.screenAwake;
  MATS.oledScreen.emissiveIntensity = state.screenAwake ? 0.72 : 0.0;
  MATS.oledScreen.color.setHex(state.screenAwake ? 0xffffff : 0x111318);
  btnScreenPower.textContent = state.screenAwake ? 'Display: Awake' : 'Display: Sleep';
  btnScreenPower.classList.toggle('active', !state.screenAwake);
});

// Explosion Slider & Quick Buttons
const explosionSlider = document.getElementById('explosion-slider');
const explosionReadout = document.getElementById('explosion-readout');

function setExplosionValue(percent) {
  explosionSlider.value = percent;
  explosionReadout.textContent = `${Math.round(percent)}%`;
  state.explosionTarget = percent / 100;
}

explosionSlider.addEventListener('input', (e) => {
  setExplosionValue(parseFloat(e.target.value));
});

document.getElementById('btn-assemble').addEventListener('click', () => setExplosionValue(0));
document.getElementById('btn-explode').addEventListener('click', () => setExplosionValue(100));

// Explosion Vector Mode Chips
document.querySelectorAll('.mode-chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.mode-chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    state.mode = chip.dataset.mode;
    if (state.explosionTarget < 0.2) setExplosionValue(75);
  });
});

// Titanium Colorway Swatches
document.querySelectorAll('.swatch').forEach((swatch) => {
  swatch.addEventListener('click', () => {
    document.querySelectorAll('.swatch').forEach((s) => s.classList.remove('active'));
    swatch.classList.add('active');
    const finish = FINISHES[swatch.dataset.finish];
    if (!finish) return;
    MATS.titanium.color.setHex(finish.titanium);
    MATS.titaniumDark.color.setHex(finish.titaniumDark);
    MATS.backGlass.color.setHex(finish.backGlass);
    MATS.cameraPlateauGlass.color.setHex(finish.backGlass);
  });
});

// Top Right Mode Toggles
const toggleLabelsBtn = document.getElementById('toggle-labels');
toggleLabelsBtn.addEventListener('click', () => {
  state.showLabels = !state.showLabels;
  toggleLabelsBtn.classList.toggle('active', state.showLabels);
  labelsContainer.style.display = state.showLabels ? 'block' : 'none';
});

const toggleXrayBtn = document.getElementById('toggle-xray');
toggleXrayBtn.addEventListener('click', () => {
  state.xrayMode = !state.xrayMode;
  toggleXrayBtn.classList.toggle('active', state.xrayMode);
  applyMaterialVisualModes();
});

const toggleThermalBtn = document.getElementById('toggle-thermal');
toggleThermalBtn.addEventListener('click', () => {
  state.thermalMode = !state.thermalMode;
  toggleThermalBtn.classList.toggle('active', state.thermalMode);
  applyMaterialVisualModes();
});

const toggleRotateBtn = document.getElementById('toggle-rotate');
toggleRotateBtn.addEventListener('click', () => {
  state.autoRotate = !state.autoRotate;
  toggleRotateBtn.classList.toggle('active', state.autoRotate);
});

// Camera Presets
function animateCameraTo(newPos, newTarget) {
  state.camAnim = {
    startPos: camera.position.clone(),
    endPos: newPos.clone(),
    startTarget: controls.target.clone(),
    endTarget: newTarget.clone(),
    progress: 0
  };
}

const CAM_PRESETS = {
  iso: { pos: [17.5, 8.2, 23.5], target: [0, 0.2, 0] },
  side: { pos: [28.0, 0.5, 0.0], target: [0, 0, 0] },
  front: { pos: [0.0, 0.5, 27.0], target: [0, 0, 0] },
  silicon: { pos: [-9.5, 2.5, 11.5], target: [-1.5, 1.2, 2.5], select: 'logicboard' },
  camera: { pos: [9.5, 7.5, 11.0], target: [1.5, 5.0, 1.5], select: 'camera' },
  top: { pos: [0.2, 29.0, 4.0], target: [0, 0, 0] }
};

document.querySelectorAll('.preset-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.preset-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const p = CAM_PRESETS[btn.dataset.cam];
    if (!p) return;
    if (p.select) {
      if (state.selectedLayerId !== p.select) selectLayer(p.select);
    } else {
      animateCameraTo(new THREE.Vector3(...p.pos), new THREE.Vector3(...p.target));
    }
  });
});

// ============================================================================
// 8. 3D RAYCASTING (CLICK TO INSPECT ANY LAYER IN VIEWPORT)
// ============================================================================
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerDownPos = { x: 0, y: 0 };

renderer.domElement.addEventListener('pointerdown', (e) => {
  pointerDownPos = { x: e.clientX, y: e.clientY };
});

renderer.domElement.addEventListener('pointerup', (e) => {
  const dx = e.clientX - pointerDownPos.x;
  const dy = e.clientY - pointerDownPos.y;
  if (Math.hypot(dx, dy) > 5) return; // Ignore orbit drags

  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const hits = raycaster.intersectObjects(interactiveMeshes, false);
  if (hits.length > 0) {
    const hitLayerId = hits[0].object.userData.layerId;
    if (hitLayerId) selectLayer(hitLayerId);
  }
});

// ============================================================================
// 9. ANIMATION & RENDER LOOP
// ============================================================================
const clock = new THREE.Clock();
const tempVec = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.getElapsedTime();

  // Smooth spring damping toward target explosion factor
  state.explosionCurrent += (state.explosionTarget - state.explosionCurrent) * Math.min(1, dt * 8.5);
  const t = state.explosionCurrent;

  // Update each hardware layer position & subtle floating idle motion
  LAYER_DATA.forEach((layer, idx) => {
    const grp = layerGroups.get(layer.id);
    if (!grp) return;

    const vec =
      state.mode === 'radial'
        ? layer.radialPos
        : state.mode === 'cascade'
        ? layer.cascadePos
        : layer.axialPos;

    const floatY = Math.sin(elapsed * 1.6 + idx * 0.55) * 0.06 * Math.min(t, 1.0);

    grp.position.set(
      vec[0] * t,
      vec[1] * t + floatY,
       THREE.MathUtils.lerp(layer.zSealed, vec[2], t)
    );

    // Subtle rotation fan-out in cascade mode
    const targetRotY = state.mode === 'cascade' ? (idx - 4.5) * 0.04 * t : 0;
    grp.rotation.y += (targetRotY - grp.rotation.y) * 0.12;
  });

  // Update dashed assembly guide lines span
  const displayZ = layerGroups.get('display').position.z;
  const backZ = layerGroups.get('backglass').position.z;
  guideLines.forEach(({ line, cx, cy }) => {
    line.visible = t > 0.06 && state.mode === 'axial' && !state.isolated;
    if (line.visible) {
      const posAttr = line.geometry.attributes.position;
      posAttr.setXYZ(0, cx, cy, backZ);
      posAttr.setXYZ(1, cx, cy, displayZ);
      posAttr.needsUpdate = true;
      line.computeLineDistances();
    }
  });

  // Gentle turntable orbit when enabled
  if (state.autoRotate && !state.camAnim) {
    phoneRoot.rotation.y += dt * 0.16;
  }

  // Smooth camera transition choreography
  if (state.camAnim) {
    state.camAnim.progress += dt * 2.2;
    const p = Math.min(1, state.camAnim.progress);
    const ease = 1 - Math.pow(1 - p, 3);
    camera.position.lerpVectors(state.camAnim.startPos, state.camAnim.endPos, ease);
    controls.target.lerpVectors(state.camAnim.startTarget, state.camAnim.endTarget, ease);
    if (p >= 1) state.camAnim = null;
  }

  controls.update();

  // Project 3D Callout Pins to 2D Screen Space
  if (state.showLabels) {
    const labelOpacity = THREE.MathUtils.clamp((t - 0.12) * 2.5, 0, 1);
    LAYER_DATA.forEach((layer) => {
      const pin = calloutPins.get(layer.id);
      const grp = layerGroups.get(layer.id);
      if (!pin || !grp) return;

      if (!grp.visible || labelOpacity <= 0.02) {
        pin.style.opacity = '0';
        pin.style.pointerEvents = 'none';
        return;
      }

      tempVec.set(
        grp.position.x + layer.pinOffset[0],
        grp.position.y + layer.pinOffset[1],
        grp.position.z + layer.pinOffset[2]
      );
      tempVec.applyMatrix4(phoneRoot.matrixWorld);
      tempVec.project(camera);

      if (tempVec.z > 1) {
        pin.style.opacity = '0';
        return;
      }

      const x = (tempVec.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-(tempVec.y * 0.5) + 0.5) * window.innerHeight;
      pin.style.transform = `translate(-50%, -50%) translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      pin.style.opacity =
        state.selectedLayerId && state.selectedLayerId !== layer.id
          ? (labelOpacity * 0.35).toFixed(2)
          : labelOpacity.toFixed(2);
      pin.style.pointerEvents = 'auto';
    });
  }

  composer.render();
}

animate();

// Responsive resize handler
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});
