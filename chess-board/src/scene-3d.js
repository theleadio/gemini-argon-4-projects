/**
 * Three.js 3D Scene for Chinese Chess (Xiangqi / 中國象棋)
 * Features procedural high-DPI wood & calligraphy textures, bump maps, lathe-turned 3D discs,
 * brass hardware inlays, side capture trays, parabolic move/capture trajectories, and camera presets.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RED, BLACK, getPieceChar, inBounds } from './xiangqi-engine.js';
import { createCartoonPieceMesh } from './cartoon-pieces.js';

export const CELL_SIZE = 1.15;
export const BOARD_TOP_W = 11.2; // 8 * 1.15 = 9.2 grid width + 2.0 margins
export const BOARD_TOP_D = 12.6; // 9 * 1.15 = 10.35 grid depth + 2.25 margins
export const PIECE_RADIUS = 0.47;
export const PIECE_HEIGHT = 0.27;

export const THEMES = {
  rosewood: {
    id: 'rosewood',
    name: '紫檀黃楊 (Rosewood & Boxwood)',
    boardBg: '#3d1e12',
    boardGrain1: '#4c2617',
    boardGrain2: '#2c130a',
    frameColor: 0x261008,
    lineColor: '#d8a95b',
    riverTextColor: '#d8a95b',
    pieceBgRed: '#ecd3a2',
    pieceBgBlack: '#e6c994',
    pieceRimRed: '#c8a368',
    pieceRimBlack: '#bfa065',
    pieceBodyColor: 0xdab882,
    redInk: '#b51d18',
    blackInk: '#1c1917',
    ringRed: '#b51d18',
    ringBlack: '#24201c',
    ambientBg: 0x110d0b,
  },
  jade: {
    id: 'jade',
    name: '水墨和田玉 (Inkstone & Hetian Jade)',
    boardBg: '#1c2226',
    boardGrain1: '#232b30',
    boardGrain2: '#14191c',
    frameColor: 0x111518,
    lineColor: '#b5c4be',
    riverTextColor: '#c4d4ce',
    pieceBgRed: '#e8efe9',
    pieceBgBlack: '#dce6df',
    pieceRimRed: '#bfd0c4',
    pieceRimBlack: '#aebfb4',
    pieceBodyColor: 0xd2dfd6,
    redInk: '#be231d',
    blackInk: '#142620',
    ringRed: '#be231d',
    ringBlack: '#1c332b',
    ambientBg: 0x0c1013,
  },
  lacquer: {
    id: 'lacquer',
    name: '朱砂描金 (Obsidian & Gilt Lacquer)',
    boardBg: '#5c3419',
    boardGrain1: '#6e3f1f',
    boardGrain2: '#462611',
    frameColor: 0x1d110a,
    lineColor: '#241308',
    riverTextColor: '#2a1609',
    pieceBgRed: '#231614',
    pieceBgBlack: '#19191c',
    pieceRimRed: '#3a221e',
    pieceRimBlack: '#29292e',
    pieceBodyColor: 0x1c1716,
    redInk: '#ea3c2d',
    blackInk: '#dfb15b',
    ringRed: '#ea3c2d',
    ringBlack: '#dfb15b',
    ambientBg: 0x120e0c,
  },
};

export function boardToWorld(row, col) {
  return {
    x: (col - 4) * CELL_SIZE,
    z: (row - 4.5) * CELL_SIZE,
  };
}

export class XiangqiScene3D {
  constructor(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks; // { onSquareClick, onPieceHover }
    this.themeKey = 'rosewood';
    this.theme = THEMES[this.themeKey];
    this.pieceStyle = 'cartoon'; // 'cartoon' (3D Cartoon Figurines) or 'classic' (Traditional Discs)

    this.pieceMeshes = new Map(); // uid -> THREE.Group
    this.pieceAnimations = [];    // active parabolic animations
    this.cameraAnimation = null;

    this.selectedSquare = null;
    this.legalMoveTargets = [];
    this.blockedTargets = [];
    this.lastMove = null;
    this.hintMove = null;
    this.checkingSquares = [];
    this.hoveredSquare = null;

    this.pieceTextureCache = new Map();

    this.initScene();
    this.initLights();
    this.initBoard();
    this.initInteractionGrid();
    this.initIndicators();
    this.initEvents();

    this.clock = new THREE.Clock();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initScene() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.theme.ambientBg);
    this.scene.fog = new THREE.FogExp2(this.theme.ambientBg, 0.022);

    this.camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 120);
    this.camera.position.set(0, 12.2, 12.4);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;

    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxPolarAngle = Math.PI * 0.46;
    this.controls.minPolarAngle = 0.08;
    this.controls.minDistance = 7.5;
    this.controls.maxDistance = 28;
    this.controls.target.set(0, 0, 0.25);
    this.controls.update();
  }

  initLights() {
    this.ambientLight = new THREE.AmbientLight(0xfff4e4, 0.72);
    this.scene.add(this.ambientLight);

    // Warm studio key light from upper-right-front
    this.keyLight = new THREE.DirectionalLight(0xfff1dc, 2.1);
    this.keyLight.position.set(7.5, 16, 9.5);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.width = 2048;
    this.keyLight.shadow.mapSize.height = 2048;
    this.keyLight.shadow.camera.near = 2;
    this.keyLight.shadow.camera.far = 38;
    const d = 10.5;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.bias = -0.0004;
    this.scene.add(this.keyLight);

    // Cool moonlight rim light from back-left for sculptural separation
    this.rimLight = new THREE.DirectionalLight(0x9ec5eb, 0.85);
    this.rimLight.position.set(-9, 11, -10);
    this.scene.add(this.rimLight);

    // Subtle warm lantern fill over the Chu River
    this.centerLight = new THREE.PointLight(0xffcf8b, 0.55, 22);
    this.centerLight.position.set(0, 6.5, 0);
    this.scene.add(this.centerLight);
  }

  /**
   * Generates the 2048x2304 high-DPI board texture & bump map so every 3D intersection
   * aligns with mathematical precision.
   */
  generateBoardTextures(theme) {
    const W = 2048;
    const H = 2304; // Matches BOARD_TOP_W (11.2) : BOARD_TOP_D (12.6) = 8 : 9

    const colorCanvas = document.createElement('canvas');
    colorCanvas.width = W;
    colorCanvas.height = H;
    const ctx = colorCanvas.getContext('2d');

    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = W;
    bumpCanvas.height = H;
    const bCtx = bumpCanvas.getContext('2d');

    // 1. Base wood background
    ctx.fillStyle = theme.boardBg;
    ctx.fillRect(0, 0, W, H);

    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, W, H);

    // Procedural wood grain fibers
    for (let i = 0; i < 420; i++) {
      const y = (i / 420) * H;
      const wave = Math.sin(i * 0.17) * 14;
      ctx.fillStyle = i % 2 === 0 ? theme.boardGrain1 : theme.boardGrain2;
      ctx.globalAlpha = 0.08 + (Math.sin(i * 0.7) * 0.04 + 0.04);
      ctx.fillRect(0, y + wave, W, 3 + (i % 5));

      bCtx.fillStyle = i % 2 === 0 ? '#868686' : '#7a7a7a';
      bCtx.globalAlpha = 0.16;
      bCtx.fillRect(0, y + wave, W, 2);
    }
    ctx.globalAlpha = 1.0;
    bCtx.globalAlpha = 1.0;

    // Subtle radial vignette on board surface
    const vig = ctx.createRadialGradient(W / 2, H / 2, W * 0.15, W / 2, H / 2, W * 0.72);
    vig.addColorStop(0, 'rgba(255,235,200,0.05)');
    vig.addColorStop(1, 'rgba(0,0,0,0.34)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    // Coordinate mapping helper: world (x, z) -> canvas (px, py)
    const toPx = (row, col) => {
      const { x, z } = boardToWorld(row, col);
      const u = x / BOARD_TOP_W + 0.5;
      const v = z / BOARD_TOP_D + 0.5;
      return {
        x: u * W,
        y: v * H,
      };
    };

    const topLeft = toPx(0, 0);
    const bottomRight = toPx(9, 8);
    const gridW = bottomRight.x - topLeft.x;
    const gridH = bottomRight.y - topLeft.y;

    const strokeBoth = (drawFn, lineW, colorStyle = theme.lineColor, bumpStyle = '#404040') => {
      ctx.save();
      ctx.strokeStyle = colorStyle;
      ctx.lineWidth = lineW;
      ctx.lineCap = 'square';
      ctx.lineJoin = 'miter';
      drawFn(ctx);
      ctx.stroke();
      ctx.restore();

      bCtx.save();
      bCtx.strokeStyle = bumpStyle;
      bCtx.lineWidth = lineW + 2;
      bCtx.lineCap = 'square';
      drawFn(bCtx);
      bCtx.stroke();
      bCtx.restore();
    };

    // 2. Outer decorative double border around the 9x10 grid
    const pad = 22;
    strokeBoth((c) => {
      c.beginPath();
      c.rect(topLeft.x - pad, topLeft.y - pad, gridW + pad * 2, gridH + pad * 2);
    }, 8);

    // Corner decorative Chinese lattice L-motifs inside outer frame
    const cornerSize = 18;
    const corners = [
      [topLeft.x - pad, topLeft.y - pad, 1, 1],
      [bottomRight.x + pad, topLeft.y - pad, -1, 1],
      [topLeft.x - pad, bottomRight.y + pad, 1, -1],
      [bottomRight.x + pad, bottomRight.y + pad, -1, -1],
    ];
    strokeBoth((c) => {
      c.beginPath();
      for (const [cx, cy, sx, sy] of corners) {
        c.rect(
          sx > 0 ? cx : cx - cornerSize,
          sy > 0 ? cy : cy - cornerSize,
          cornerSize,
          cornerSize
        );
      }
    }, 3.5);

    // 3. Horizontal rank lines (rows 0..9)
    strokeBoth((c) => {
      c.beginPath();
      for (let r = 0; r < 10; r++) {
        const p0 = toPx(r, 0);
        const p8 = toPx(r, 8);
        c.moveTo(p0.x, p0.y);
        c.lineTo(p8.x, p8.y);
      }
    }, 4.5);

    // 4. Vertical file lines (cols 0..8; cols 1..7 break across the Chu River between row 4 and 5)
    strokeBoth((c) => {
      c.beginPath();
      for (let col = 0; col < 9; col++) {
        if (col === 0 || col === 8) {
          const pTop = toPx(0, col);
          const pBot = toPx(9, col);
          c.moveTo(pTop.x, pTop.y);
          c.lineTo(pBot.x, pBot.y);
        } else {
          const pTop = toPx(0, col);
          const pRiverTop = toPx(4, col);
          c.moveTo(pTop.x, pTop.y);
          c.lineTo(pRiverTop.x, pRiverTop.y);

          const pRiverBot = toPx(5, col);
          const pBot = toPx(9, col);
          c.moveTo(pRiverBot.x, pRiverBot.y);
          c.lineTo(pBot.x, pBot.y);
        }
      }
    }, 4.5);

    // 5. Nine-Point Palace Diagonals (九宮格斜線)
    strokeBoth((c) => {
      c.beginPath();
      // Black Palace (rows 0..2, cols 3..5)
      let a = toPx(0, 3), b = toPx(2, 5);
      c.moveTo(a.x, a.y); c.lineTo(b.x, b.y);
      a = toPx(0, 5); b = toPx(2, 3);
      c.moveTo(a.x, a.y); c.lineTo(b.x, b.y);

      // Red Palace (rows 7..9, cols 3..5)
      a = toPx(7, 3); b = toPx(9, 5);
      c.moveTo(a.x, a.y); c.lineTo(b.x, b.y);
      a = toPx(7, 5); b = toPx(9, 3);
      c.moveTo(a.x, a.y); c.lineTo(b.x, b.y);
    }, 3.8);

    // 6. Fiducial Crosses (炮位 & 兵卒位 十字花)
    const fiducialPoints = [
      // Cannons
      [2, 1], [2, 7],
      [7, 1], [7, 7],
      // Black Soldiers
      [3, 0], [3, 2], [3, 4], [3, 6], [3, 8],
      // Red Soldiers
      [6, 0], [6, 2], [6, 4], [6, 6], [6, 8],
    ];

    const gap = 11;
    const arm = 22;
    strokeBoth((c) => {
      c.beginPath();
      for (const [r, col] of fiducialPoints) {
        const pt = toPx(r, col);
        const quadrants = [];
        if (col > 0) {
          quadrants.push([-1, -1], [-1, 1]);
        }
        if (col < 8) {
          quadrants.push([1, -1], [1, 1]);
        }
        for (const [qx, qy] of quadrants) {
          const sx = pt.x + qx * gap;
          const sy = pt.y + qy * gap;
          c.moveTo(sx, sy + qy * arm);
          c.lineTo(sx, sy);
          c.lineTo(sx + qx * arm, sy);
        }
      }
    }, 3.6);

    // 7. Chu River & Han Border Calligraphy (楚河 / 漢界)
    const riverLeft = toPx(4.5, 2);
    const riverRight = toPx(4.5, 6);

    const drawRiverText = (targetCtx, fillStyle) => {
      targetCtx.save();
      targetCtx.fillStyle = fillStyle;
      targetCtx.font = '600 84px "STKaiti", "Kaiti SC", "KaiTi", "Songti SC", "Noto Serif TC", serif';
      targetCtx.textAlign = 'center';
      targetCtx.textBaseline = 'middle';

      // Left side: 楚 河
      targetCtx.fillText('楚   河', riverLeft.x, riverLeft.y);

      // Right side: 漢 界 (rotated or upright; upright traditional reading is crispest from camera)
      targetCtx.fillText('漢   界', riverRight.x, riverRight.y);
      targetCtx.restore();
    };

    drawRiverText(ctx, theme.riverTextColor);
    drawRiverText(bCtx, '#454545');

    // Central decorative compass medallion in the middle of the river (4.5, 4)
    const riverMid = toPx(4.5, 4);
    strokeBoth((c) => {
      c.beginPath();
      c.arc(riverMid.x, riverMid.y, 34, 0, Math.PI * 2);
      c.moveTo(riverMid.x - 24, riverMid.y);
      c.lineTo(riverMid.x + 24, riverMid.y);
      c.moveTo(riverMid.x, riverMid.y - 24);
      c.lineTo(riverMid.x, riverMid.y + 24);
    }, 2.5);

    const colorTex = new THREE.CanvasTexture(colorCanvas);
    colorTex.colorSpace = THREE.SRGBColorSpace;
    colorTex.anisotropy = 8;

    const bumpTex = new THREE.CanvasTexture(bumpCanvas);
    bumpTex.anisotropy = 8;

    return { colorTex, bumpTex };
  }

  initBoard() {
    this.boardGroup = new THREE.Group();
    this.scene.add(this.boardGroup);

    const { colorTex, bumpTex } = this.generateBoardTextures(this.theme);

    // 1. Top Playing Surface
    const topGeo = new THREE.PlaneGeometry(BOARD_TOP_W, BOARD_TOP_D);
    topGeo.rotateX(-Math.PI / 2);
    this.boardTopMat = new THREE.MeshStandardMaterial({
      map: colorTex,
      bumpMap: bumpTex,
      bumpScale: 0.028,
      roughness: 0.42,
      metalness: 0.06,
    });
    const topMesh = new THREE.Mesh(topGeo, this.boardTopMat);
    topMesh.receiveShadow = true;
    this.boardGroup.add(topMesh);

    // 2. Main Rosewood Table Body underneath
    const bodyW = BOARD_TOP_W + 0.9;
    const bodyD = BOARD_TOP_D + 0.9;
    const bodyH = 0.72;
    const bodyGeo = new THREE.BoxGeometry(bodyW, bodyH, bodyD);
    this.boardFrameMat = new THREE.MeshStandardMaterial({
      color: this.theme.frameColor,
      roughness: 0.36,
      metalness: 0.1,
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, this.boardFrameMat);
    bodyMesh.position.y = -bodyH / 2 - 0.005;
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    this.boardGroup.add(bodyMesh);

    // 3. Raised Outer Frame Rails around the playing surface
    const railThickness = 0.46;
    const railHeight = 0.11;
    const hRailGeo = new THREE.BoxGeometry(bodyW, railHeight, railThickness);
    const vRailGeo = new THREE.BoxGeometry(railThickness, railHeight, BOARD_TOP_D);

    const northRail = new THREE.Mesh(hRailGeo, this.boardFrameMat);
    northRail.position.set(0, railHeight / 2 - 0.02, -(BOARD_TOP_D + railThickness) / 2);
    northRail.castShadow = true;
    northRail.receiveShadow = true;

    const southRail = northRail.clone();
    southRail.position.z = (BOARD_TOP_D + railThickness) / 2;

    const westRail = new THREE.Mesh(vRailGeo, this.boardFrameMat);
    westRail.position.set(-(BOARD_TOP_W + railThickness) / 2, railHeight / 2 - 0.02, 0);
    westRail.castShadow = true;
    westRail.receiveShadow = true;

    const eastRail = westRail.clone();
    eastRail.position.x = (BOARD_TOP_W + railThickness) / 2;

    this.boardGroup.add(northRail, southRail, westRail, eastRail);

    // 4. Brass Corner Inlays (銅包角)
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd4a84f,
      roughness: 0.25,
      metalness: 0.85,
    });
    const cornerBracketGeo = new THREE.BoxGeometry(0.68, railHeight + 0.02, 0.68);
    const cx = (BOARD_TOP_W + railThickness) / 2 - 0.08;
    const cz = (BOARD_TOP_D + railThickness) / 2 - 0.08;
    [
      [-cx, -cz],
      [cx, -cz],
      [-cx, cz],
      [cx, cz],
    ].forEach(([x, z]) => {
      const bracket = new THREE.Mesh(cornerBracketGeo, brassMat);
      bracket.position.set(x, railHeight / 2 - 0.01, z);
      this.boardGroup.add(bracket);
    });

    // 5. Recessed Pedestal Base & Studio Table Plane
    const pedestalGeo = new THREE.BoxGeometry(bodyW - 0.8, 0.5, bodyD - 0.8);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x120905,
      roughness: 0.6,
    });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.y = -bodyH - 0.25;
    pedestal.receiveShadow = true;
    this.boardGroup.add(pedestal);

    // 6. Side Capture Trays (左/右吃子盤)
    this.createCaptureTrays(bodyH);

    // Subtle dark studio ground plane to catch shadows
    const floorGeo = new THREE.PlaneGeometry(80, 80);
    floorGeo.rotateX(-Math.PI / 2);
    this.floorMat = new THREE.MeshStandardMaterial({
      color: this.theme.ambientBg,
      roughness: 0.85,
      metalness: 0.05,
    });
    const floor = new THREE.Mesh(floorGeo, this.floorMat);
    floor.position.y = -bodyH - 0.5;
    floor.receiveShadow = true;
    this.scene.add(floor);
  }

  createCaptureTrays(bodyH) {
    const trayW = 2.55;
    const trayD = 9.4;
    const trayH = 0.35;
    const trayGeo = new THREE.BoxGeometry(trayW, trayH, trayD);

    const traySurfaceMat = new THREE.MeshStandardMaterial({
      color: 0x1c120d,
      roughness: 0.55,
      metalness: 0.08,
    });

    [-7.55, 7.55].forEach((xPos) => {
      const trayGroup = new THREE.Group();
      trayGroup.position.set(xPos, -bodyH + trayH / 2 - 0.12, 0);

      const base = new THREE.Mesh(trayGeo, this.boardFrameMat);
      base.receiveShadow = true;
      base.castShadow = true;
      trayGroup.add(base);

      const velvetGeo = new THREE.PlaneGeometry(trayW - 0.32, trayD - 0.32);
      velvetGeo.rotateX(-Math.PI / 2);
      const velvet = new THREE.Mesh(velvetGeo, traySurfaceMat);
      velvet.position.y = trayH / 2 + 0.005;
      velvet.receiveShadow = true;
      trayGroup.add(velvet);

      this.boardGroup.add(trayGroup);
    });
    this.traySurfaceY = -bodyH + trayH - 0.11;
  }

  /**
   * Invisible raycast targets at all 90 intersections (9x10) so clicking any intersection is effortless.
   */
  initInteractionGrid() {
    this.intersectionTargets = [];
    this.intersectionGroup = new THREE.Group();
    this.scene.add(this.intersectionGroup);

    const hitGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.08, 16);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });

    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const { x, z } = boardToWorld(r, c);
        const mesh = new THREE.Mesh(hitGeo, hitMat);
        mesh.position.set(x, 0.04, z);
        mesh.userData = { isIntersection: true, row: r, col: c };
        this.intersectionGroup.add(mesh);
        this.intersectionTargets.push(mesh);
      }
    }
  }

  /**
   * Visual indicator meshes for selected piece, legal moves, captures, check warning, and last move.
   */
  initIndicators() {
    this.indicatorGroup = new THREE.Group();
    this.scene.add(this.indicatorGroup);

    // Selected piece halo ring
    const selGeo = new THREE.RingGeometry(PIECE_RADIUS * 1.04, PIECE_RADIUS * 1.24, 48);
    selGeo.rotateX(-Math.PI / 2);
    this.selectionRingMat = new THREE.MeshBasicMaterial({
      color: 0xf5c869,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    this.selectionRing = new THREE.Mesh(selGeo, this.selectionRingMat);
    this.selectionRing.position.y = 0.015;
    this.selectionRing.visible = false;
    this.indicatorGroup.add(this.selectionRing);

    // Hover intersection ring
    const hovGeo = new THREE.RingGeometry(PIECE_RADIUS * 0.85, PIECE_RADIUS * 1.02, 36);
    hovGeo.rotateX(-Math.PI / 2);
    this.hoverRing = new THREE.Mesh(
      hovGeo,
      new THREE.MeshBasicMaterial({
        color: 0xffe4a0,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.42,
      })
    );
    this.hoverRing.position.y = 0.012;
    this.hoverRing.visible = false;
    this.indicatorGroup.add(this.hoverRing);

    // Dynamic markers container (rebuilt when selection/state changes)
    this.dynamicMarkers = new THREE.Group();
    this.indicatorGroup.add(this.dynamicMarkers);
  }

  /**
   * Generates a 512x512 procedural top medallion texture & bump map for a Xiangqi piece.
   */
  getPieceTopTextures(color, type) {
    const cacheKey = `${this.themeKey}_${color}_${type}`;
    if (this.pieceTextureCache.has(cacheKey)) {
      return this.pieceTextureCache.get(cacheKey);
    }

    const size = 512;
    const half = size / 2;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const bCanvas = document.createElement('canvas');
    bCanvas.width = size;
    bCanvas.height = size;
    const bCtx = bCanvas.getContext('2d');

    const isRed = color === RED;
    const bg = isRed ? this.theme.pieceBgRed : this.theme.pieceBgBlack;
    const rim = isRed ? this.theme.pieceRimRed : this.theme.pieceRimBlack;
    const ink = isRed ? this.theme.redInk : this.theme.blackInk;
    const ringCol = isRed ? this.theme.ringRed : this.theme.ringBlack;

    // 1. Radial wood/jade base
    const grad = ctx.createRadialGradient(half - 35, half - 35, 20, half, half, half);
    grad.addColorStop(0, bg);
    grad.addColorStop(0.78, bg);
    grad.addColorStop(1, rim);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Subtle wood grain across piece face
    ctx.save();
    ctx.strokeStyle = rim;
    ctx.globalAlpha = 0.14;
    ctx.lineWidth = 2;
    for (let i = 0; i < 64; i++) {
      const y = (i / 64) * size;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(size * 0.33, y + Math.sin(i) * 8, size * 0.66, y - Math.cos(i) * 8, size, y);
      ctx.stroke();
    }
    ctx.restore();

    // Bump base (slightly domed rim, recessed inner groove & character)
    const bGrad = bCtx.createRadialGradient(half, half, half * 0.65, half, half, half);
    bGrad.addColorStop(0, '#969696');
    bGrad.addColorStop(0.85, '#a8a8a8');
    bGrad.addColorStop(1, '#707070');
    bCtx.fillStyle = bGrad;
    bCtx.fillRect(0, 0, size, size);

    // 2. Carved concentric circular groove ring
    ctx.strokeStyle = ringCol;
    ctx.lineWidth = 13;
    ctx.beginPath();
    ctx.arc(half, half, 198, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(half, half, 180, 0, Math.PI * 2);
    ctx.stroke();

    bCtx.strokeStyle = '#323232';
    bCtx.lineWidth = 16;
    bCtx.beginPath();
    bCtx.arc(half, half, 198, 0, Math.PI * 2);
    bCtx.stroke();

    // 3. Carved Calligraphic Character
    const char = getPieceChar({ color, type });
    const fontSpec = '700 248px "STKaiti", "Kaiti SC", "KaiTi", "Songti SC", "Noto Serif TC", serif';

    // Subtle upper-left recessed shadow & lower-right bevel highlight
    ctx.save();
    ctx.font = fontSpec;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = 'rgba(255,255,255,0.32)';
    ctx.fillText(char, half + 3, half + 11);

    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillText(char, half - 2, half + 5);

    ctx.fillStyle = ink;
    ctx.fillText(char, half, half + 8);
    ctx.restore();

    bCtx.save();
    bCtx.font = fontSpec;
    bCtx.textAlign = 'center';
    bCtx.textBaseline = 'middle';
    bCtx.fillStyle = '#282828';
    bCtx.fillText(char, half, half + 8);
    bCtx.restore();

    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;

    const bumpMap = new THREE.CanvasTexture(bCanvas);
    bumpMap.anisotropy = 8;

    const result = { map, bumpMap };
    this.pieceTextureCache.set(cacheKey, result);
    return result;
  }

  /**
   * Builds either a 3D Cartoon Figurine mesh (default) or a traditional lathe-turned disc mesh.
   */
  createPieceMesh(piece) {
    if (this.pieceStyle === 'cartoon') {
      return createCartoonPieceMesh(piece);
    }

    const group = new THREE.Group();

    // Shared lathe profile for authentic beveled chess disc
    if (!this.latheBodyGeo) {
      const pts = [
        new THREE.Vector2(0.0, 0.0),
        new THREE.Vector2(PIECE_RADIUS * 0.92, 0.0),
        new THREE.Vector2(PIECE_RADIUS, 0.04),
        new THREE.Vector2(PIECE_RADIUS * 1.01, PIECE_HEIGHT * 0.5),
        new THREE.Vector2(PIECE_RADIUS * 0.96, PIECE_HEIGHT - 0.035),
        new THREE.Vector2(PIECE_RADIUS * 0.88, PIECE_HEIGHT),
        new THREE.Vector2(0.0, PIECE_HEIGHT),
      ];
      this.latheBodyGeo = new THREE.LatheGeometry(pts, 48);
    }

    const bodyMat = new THREE.MeshStandardMaterial({
      color: this.theme.pieceBodyColor,
      roughness: 0.34,
      metalness: 0.06,
    });

    const bodyMesh = new THREE.Mesh(this.latheBodyGeo, bodyMat);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    group.add(bodyMesh);

    // Top engraved medallion cap
    const { map, bumpMap } = this.getPieceTopTextures(piece.color, piece.type);
    const capGeo = new THREE.CircleGeometry(PIECE_RADIUS * 0.89, 48);
    capGeo.rotateX(-Math.PI / 2);

    const capMat = new THREE.MeshStandardMaterial({
      map,
      bumpMap,
      bumpScale: 0.024,
      roughness: 0.28,
      metalness: 0.08,
    });

    const capMesh = new THREE.Mesh(capGeo, capMat);
    capMesh.position.y = PIECE_HEIGHT + 0.002;
    capMesh.receiveShadow = true;
    group.add(capMesh);

    group.userData = {
      isPiece: true,
      uid: piece.uid,
      color: piece.color,
      type: piece.type,
      bodyMesh,
      capMesh,
    };

    return group;
  }

  /**
   * Synchronizes all 3D piece meshes with the engine's current board & captured trays.
   * If `animateMove` is provided, animates the moved piece (and any captured piece) along a parabolic arc.
   */
  syncWithEngine(engine, animateMove = null) {
    const activeUids = new Set();

    // 1. Active pieces on the 9x10 board
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const p = engine.board[r][c];
        if (!p) continue;
        activeUids.add(p.uid);

        let mesh = this.pieceMeshes.get(p.uid);
        const { x, z } = boardToWorld(r, c);

        if (!mesh) {
          mesh = this.createPieceMesh(p);
          mesh.position.set(x, 0, z);
          this.scene.add(mesh);
          this.pieceMeshes.set(p.uid, mesh);
        }

        mesh.userData.row = r;
        mesh.userData.col = c;
        mesh.userData.captured = false;

        if (animateMove && animateMove.piece.uid === p.uid) {
          const fromPos = boardToWorld(animateMove.fromRow, animateMove.fromCol);
          const arcHeight = animateMove.isJump ? 1.45 : 0.72;
          this.startPieceAnimation(
            mesh,
            new THREE.Vector3(fromPos.x, 0.28, fromPos.z),
            new THREE.Vector3(x, 0, z),
            arcHeight,
            0.34
          );
        } else if (!this.isAnimatingMesh(mesh)) {
          mesh.position.set(x, 0, z);
          mesh.rotation.set(0, 0, 0);
        }
      }
    }

    // 2. Captured pieces placed neatly in the left & right wooden trays
    const placeCapturedList = (list, sideSign) => {
      list.forEach((p, idx) => {
        activeUids.add(p.uid);
        let mesh = this.pieceMeshes.get(p.uid);
        if (!mesh) {
          mesh = this.createPieceMesh(p);
          this.scene.add(mesh);
          this.pieceMeshes.set(p.uid, mesh);
        }

        mesh.userData.row = -1;
        mesh.userData.col = -1;
        mesh.userData.captured = true;

        const colIdx = idx % 2;
        const rowIdx = Math.floor(idx / 2);
        const trayX = sideSign * 7.55 + (colIdx - 0.5) * 1.08;
        const trayZ = (rowIdx - 3.5) * 1.06;
        const targetVec = new THREE.Vector3(trayX, this.traySurfaceY, trayZ);

        if (animateMove && animateMove.captured && animateMove.captured.uid === p.uid) {
          const capFrom = boardToWorld(animateMove.toRow, animateMove.toCol);
          this.startPieceAnimation(
            mesh,
            new THREE.Vector3(capFrom.x, 0.1, capFrom.z),
            targetVec,
            2.1,
            0.48
          );
        } else if (!this.isAnimatingMesh(mesh)) {
          mesh.position.copy(targetVec);
          mesh.rotation.set(0, 0, 0);
        }
      });
    };

    placeCapturedList(engine.capturedByRed, 1);    // Right tray: Black pieces captured by Red
    placeCapturedList(engine.capturedByBlack, -1); // Left tray: Red pieces captured by Black

    // 3. Remove any stale meshes from previous games
    for (const [uid, mesh] of this.pieceMeshes.entries()) {
      if (!activeUids.has(uid)) {
        this.scene.remove(mesh);
        this.pieceMeshes.delete(uid);
      }
    }
  }

  isAnimatingMesh(mesh) {
    return this.pieceAnimations.some((a) => a.mesh === mesh);
  }

  startPieceAnimation(mesh, fromVec, toVec, arcHeight = 0.8, duration = 0.35) {
    this.pieceAnimations = this.pieceAnimations.filter((a) => a.mesh !== mesh);
    this.pieceAnimations.push({
      mesh,
      fromVec: fromVec.clone(),
      toVec: toVec.clone(),
      arcHeight,
      duration,
      elapsed: 0,
    });
  }

  /**
   * Updates board selection, legal move beads, capture rings, cannon screen markers, and check halos.
   */
  updateHighlights({
    selectedSquare = null,
    legalMoves = [],
    blockedMoves = [],
    lastMove = null,
    hintMove = null,
    checkingSquares = [],
  }) {
    this.selectedSquare = selectedSquare;
    this.legalMoveTargets = legalMoves;
    this.blockedTargets = blockedMoves;
    this.lastMove = lastMove;
    this.hintMove = hintMove;
    this.checkingSquares = checkingSquares;

    // Clear previous dynamic markers
    while (this.dynamicMarkers.children.length > 0) {
      const child = this.dynamicMarkers.children.pop();
      this.dynamicMarkers.remove(child);
    }

    // 1. Selection ring
    if (selectedSquare) {
      const { x, z } = boardToWorld(selectedSquare.row, selectedSquare.col);
      this.selectionRing.position.set(x, 0.018, z);
      this.selectionRing.visible = true;
    } else {
      this.selectionRing.visible = false;
    }

    // 2. Last move trail (origin dot + destination ring)
    if (lastMove) {
      const fromW = boardToWorld(lastMove.fromRow, lastMove.fromCol);
      const toW = boardToWorld(lastMove.toRow, lastMove.toCol);

      const origGeo = new THREE.RingGeometry(0.12, 0.24, 32);
      origGeo.rotateX(-Math.PI / 2);
      const origMat = new THREE.MeshBasicMaterial({
        color: 0xd99b38,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.72,
      });
      const origMesh = new THREE.Mesh(origGeo, origMat);
      origMesh.position.set(fromW.x, 0.012, fromW.z);
      this.dynamicMarkers.add(origMesh);

      const destGeo = new THREE.RingGeometry(PIECE_RADIUS * 1.02, PIECE_RADIUS * 1.15, 48);
      destGeo.rotateX(-Math.PI / 2);
      const destMesh = new THREE.Mesh(destGeo, origMat);
      destMesh.position.set(toW.x, 0.012, toW.z);
      this.dynamicMarkers.add(destMesh);
    }

    // 3. Legal move indicators (Jade/Gold bead for empty square, Crimson ring for capture)
    const moveDotGeo = new THREE.SphereGeometry(0.14, 24, 16);
    const moveRingGeo = new THREE.RingGeometry(0.19, 0.27, 32);
    moveRingGeo.rotateX(-Math.PI / 2);

    const moveMat = new THREE.MeshStandardMaterial({
      color: 0x52d69c,
      emissive: 0x1c7a50,
      roughness: 0.2,
    });
    const moveRingMat = new THREE.MeshBasicMaterial({
      color: 0x6ef0b4,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
    });

    const captureRingGeo = new THREE.RingGeometry(PIECE_RADIUS * 1.06, PIECE_RADIUS * 1.28, 48);
    captureRingGeo.rotateX(-Math.PI / 2);
    const captureMat = new THREE.MeshBasicMaterial({
      color: 0xff3b30,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });

    const screenRingGeo = new THREE.RingGeometry(PIECE_RADIUS * 1.02, PIECE_RADIUS * 1.14, 36);
    screenRingGeo.rotateX(-Math.PI / 2);
    const screenMat = new THREE.MeshBasicMaterial({
      color: 0xffb340,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65,
    });

    const drawnScreens = new Set();

    for (const move of legalMoves) {
      const { x, z } = boardToWorld(move.toRow, move.toCol);
      if (move.captured) {
        const capRing = new THREE.Mesh(captureRingGeo, captureMat);
        capRing.position.set(x, 0.024, z);
        capRing.userData = { pulse: true };
        this.dynamicMarkers.add(capRing);

        // If Cannon capture, subtly highlight the screen piece (炮架)
        if (move.screenPos) {
          const sKey = `${move.screenPos.row}_${move.screenPos.col}`;
          if (!drawnScreens.has(sKey)) {
            drawnScreens.add(sKey);
            const sw = boardToWorld(move.screenPos.row, move.screenPos.col);
            const sRing = new THREE.Mesh(screenRingGeo, screenMat);
            sRing.position.set(sw.x, 0.02, sw.z);
            this.dynamicMarkers.add(sRing);
          }
        }
      } else {
        const bead = new THREE.Mesh(moveDotGeo, moveMat);
        bead.scale.set(1, 0.45, 1);
        bead.position.set(x, 0.04, z);
        this.dynamicMarkers.add(bead);

        const ring = new THREE.Mesh(moveRingGeo, moveRingMat);
        ring.position.set(x, 0.015, z);
        ring.userData = { pulse: true };
        this.dynamicMarkers.add(ring);
      }
    }

    // 4. Blocked Horse-leg / Elephant-eye indicator (蹩馬腿 / 塞象眼)
    const drawnBlockers = new Set();
    for (const b of blockedMoves) {
      const bKey = `${b.blockerRow}_${b.blockerCol}`;
      if (drawnBlockers.has(bKey)) continue;
      drawnBlockers.add(bKey);

      const bw = boardToWorld(b.blockerRow, b.blockerCol);
      const blockGeo = new THREE.RingGeometry(PIECE_RADIUS * 1.0, PIECE_RADIUS * 1.1, 6);
      blockGeo.rotateX(-Math.PI / 2);
      const blockMat = new THREE.MeshBasicMaterial({
        color: 0xff6b4a,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.48,
      });
      const blockMesh = new THREE.Mesh(blockGeo, blockMat);
      blockMesh.position.set(bw.x, 0.02, bw.z);
      this.dynamicMarkers.add(blockMesh);
    }

    // 5. Check (將軍) danger aura under threatened General & checking pieces
    for (const sq of checkingSquares) {
      const cw = boardToWorld(sq.row, sq.col);
      const checkGeo = new THREE.RingGeometry(PIECE_RADIUS * 0.9, PIECE_RADIUS * 1.42, 48);
      checkGeo.rotateX(-Math.PI / 2);
      const checkMat = new THREE.MeshBasicMaterial({
        color: 0xff1e1e,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      });
      const checkMesh = new THREE.Mesh(checkGeo, checkMat);
      checkMesh.position.set(cw.x, 0.026, cw.z);
      checkMesh.userData = { pulse: true };
      this.dynamicMarkers.add(checkMesh);
    }

    // 6. Hint Move Trajectory Arc (提示着法)
    if (hintMove) {
      const fromW = boardToWorld(hintMove.fromRow, hintMove.fromCol);
      const toW = boardToWorld(hintMove.toRow, hintMove.toCol);

      const midX = (fromW.x + toW.x) / 2;
      const midZ = (fromW.z + toW.z) / 2;
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(fromW.x, PIECE_HEIGHT + 0.08, fromW.z),
        new THREE.Vector3(midX, 1.35, midZ),
        new THREE.Vector3(toW.x, PIECE_HEIGHT + 0.08, toW.z)
      );

      const tubeGeo = new THREE.TubeGeometry(curve, 32, 0.045, 12, false);
      const tubeMat = new THREE.MeshBasicMaterial({
        color: 0xffd452,
        transparent: true,
        opacity: 0.88,
      });
      const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
      this.dynamicMarkers.add(tubeMesh);

      const hintRingGeo = new THREE.RingGeometry(PIECE_RADIUS * 1.05, PIECE_RADIUS * 1.28, 48);
      hintRingGeo.rotateX(-Math.PI / 2);
      const hintFrom = new THREE.Mesh(hintRingGeo, tubeMat);
      hintFrom.position.set(fromW.x, 0.028, fromW.z);
      hintFrom.userData = { pulse: true };

      const hintTo = new THREE.Mesh(hintRingGeo, tubeMat);
      hintTo.position.set(toW.x, 0.028, toW.z);
      hintTo.userData = { pulse: true };

      this.dynamicMarkers.add(hintFrom, hintTo);
    }
  }

  /**
   * Switches the 3D material & calligraphy theme live.
   */
  setTheme(themeKey, engine) {
    if (!THEMES[themeKey]) return;
    this.themeKey = themeKey;
    this.theme = THEMES[themeKey];

    this.scene.background.setHex(this.theme.ambientBg);
    this.scene.fog.color.setHex(this.theme.ambientBg);
    this.floorMat.color.setHex(this.theme.ambientBg);
    this.boardFrameMat.color.setHex(this.theme.frameColor);

    const { colorTex, bumpTex } = this.generateBoardTextures(this.theme);
    this.boardTopMat.map.dispose();
    this.boardTopMat.bumpMap.dispose();
    this.boardTopMat.map = colorTex;
    this.boardTopMat.bumpMap = bumpTex;
    this.boardTopMat.needsUpdate = true;

    // Rebuild all piece meshes with the new theme materials
    for (const mesh of this.pieceMeshes.values()) {
      this.scene.remove(mesh);
    }
    this.pieceMeshes.clear();
    if (engine) {
      this.syncWithEngine(engine);
    }
  }

  /**
   * Switches between 3D Cartoon Figurines ('cartoon') and Classic Wooden Discs ('classic').
   */
  setPieceStyle(style, engine) {
    if (style !== 'cartoon' && style !== 'classic') return;
    this.pieceStyle = style;
    for (const mesh of this.pieceMeshes.values()) {
      this.scene.remove(mesh);
    }
    this.pieceMeshes.clear();
    if (engine) {
      this.syncWithEngine(engine);
    }
  }

  /**
   * Smoothly animates camera to preset views: 'red', 'black', 'top', or 'cinematic'.
   */
  setCameraView(view) {
    const presets = {
      red: { pos: new THREE.Vector3(0, 12.2, 12.4), target: new THREE.Vector3(0, 0.15, 0.25) },
      black: { pos: new THREE.Vector3(0, 12.2, -12.4), target: new THREE.Vector3(0, 0.15, -0.25) },
      top: { pos: new THREE.Vector3(0, 18.8, 0.01), target: new THREE.Vector3(0, 0, 0) },
      cinematic: { pos: new THREE.Vector3(9.4, 10.2, 10.2), target: new THREE.Vector3(0, 0.2, 0) },
    };

    const p = presets[view] || presets.red;
    this.cameraAnimation = {
      fromPos: this.camera.position.clone(),
      toPos: p.pos,
      fromTarget: this.controls.target.clone(),
      toTarget: p.target,
      elapsed: 0,
      duration: 0.75,
    };
  }

  initEvents() {
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.pointerDownPos = { x: 0, y: 0 };

    const dom = this.renderer.domElement;

    dom.addEventListener('pointerdown', (e) => {
      this.pointerDownPos = { x: e.clientX, y: e.clientY };
    });

    dom.addEventListener('pointermove', (e) => {
      const rect = dom.getBoundingClientRect();
      this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.handlePointerHover();
    });

    dom.addEventListener('pointerup', (e) => {
      const dist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
      if (dist > 7) return; // Ignore camera orbit drags

      const rect = dom.getBoundingClientRect();
      this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.handlePointerClick();
    });

    window.addEventListener('resize', () => this.handleResize());
  }

  raycastBoardSquare() {
    const pieceList = Array.from(this.pieceMeshes.values()).filter((m) => !m.userData.captured);
    this.raycaster.setFromCamera(this.pointer, this.camera);

    // 1. Check active 3D pieces first
    const pieceHits = this.raycaster.intersectObjects(pieceList, true);
    if (pieceHits.length > 0) {
      let obj = pieceHits[0].object;
      while (obj && !obj.userData?.isPiece) {
        obj = obj.parent;
      }
      if (obj && inBounds(obj.userData.row, obj.userData.col)) {
        return { row: obj.userData.row, col: obj.userData.col };
      }
    }

    // 2. Check board intersection cylinders
    const gridHits = this.raycaster.intersectObjects(this.intersectionTargets, false);
    if (gridHits.length > 0) {
      const { row, col } = gridHits[0].object.userData;
      return { row, col };
    }

    return null;
  }

  handlePointerHover() {
    const sq = this.raycastBoardSquare();
    this.hoveredSquare = sq;

    if (sq) {
      const { x, z } = boardToWorld(sq.row, sq.col);
      this.hoverRing.position.set(x, 0.014, z);
      this.hoverRing.visible = true;
      this.renderer.domElement.style.cursor = 'pointer';
    } else {
      this.hoverRing.visible = false;
      this.renderer.domElement.style.cursor = 'grab';
    }

    if (this.callbacks.onSquareHover) {
      this.callbacks.onSquareHover(sq);
    }
  }

  handlePointerClick() {
    const sq = this.raycastBoardSquare();
    if (sq && this.callbacks.onSquareClick) {
      this.callbacks.onSquareClick(sq.row, sq.col);
    }
  }

  handleResize() {
    if (!this.container) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const elapsed = this.clock.getElapsedTime();

    // 1. Update parabolic piece movement animations
    for (let i = this.pieceAnimations.length - 1; i >= 0; i--) {
      const anim = this.pieceAnimations[i];
      anim.elapsed += dt;
      const t = Math.min(anim.elapsed / anim.duration, 1);
      // Smooth cubic ease-out
      const ease = 1 - Math.pow(1 - t, 3);

      anim.mesh.position.lerpVectors(anim.fromVec, anim.toVec, ease);
      anim.mesh.position.y += Math.sin(ease * Math.PI) * anim.arcHeight;

      // Subtle tilt & cartoon squash-and-stretch during flight
      const jumpSin = Math.sin(ease * Math.PI);
      anim.mesh.rotation.x = jumpSin * 0.16;
      if (anim.mesh.userData.isCartoon && anim.mesh.userData.figurine) {
        const stretch = jumpSin * 0.22;
        anim.mesh.userData.figurine.scale.set(1 - stretch * 0.45, 1 + stretch, 1 - stretch * 0.45);
      }

      if (t >= 1) {
        anim.mesh.position.copy(anim.toVec);
        anim.mesh.rotation.set(0, 0, 0);
        if (anim.mesh.userData.isCartoon && anim.mesh.userData.figurine) {
          anim.mesh.userData.figurine.scale.set(1, 1, 1);
        }
        this.pieceAnimations.splice(i, 1);
      }
    }

    // 2. Smoothly levitate the currently selected piece, hovered piece, & animate 3D cartoon figurines
    for (const mesh of this.pieceMeshes.values()) {
      if (mesh.userData.captured || this.isAnimatingMesh(mesh)) continue;
      const isSelected =
        this.selectedSquare &&
        mesh.userData.row === this.selectedSquare.row &&
        mesh.userData.col === this.selectedSquare.col;
      const isHovered =
        this.hoveredSquare &&
        mesh.userData.row === this.hoveredSquare.row &&
        mesh.userData.col === this.hoveredSquare.col;

      const targetY = isSelected
        ? 0.38 + Math.sin(elapsed * 5.2) * 0.045
        : isHovered
        ? 0.1
        : 0;
      mesh.position.y += (targetY - mesh.position.y) * Math.min(1, dt * 14);

      if (mesh.userData.isCartoon && mesh.userData.figurine) {
        const fig = mesh.userData.figurine;
        const baseYaw = mesh.userData.color === RED ? Math.PI : 0;
        const phase = mesh.userData.phaseOffset || 0;

        if (isSelected) {
          // Excited cartoon bounce & cheerful look-around wiggle when selected
          const breath = Math.sin(elapsed * 8 + phase) * 0.08;
          fig.scale.set(1 - breath * 0.4, 1 + breath, 1 - breath * 0.4);
          fig.rotation.y = baseYaw + Math.sin(elapsed * 5.5) * 0.22;
        } else {
          // Gentle toy-like idle breathing animation
          const breath = Math.sin(elapsed * 2.6 + phase) * 0.028;
          fig.scale.set(1 - breath * 0.35, 1 + breath, 1 - breath * 0.35);
          fig.rotation.y = baseYaw + Math.sin(elapsed * 1.6 + phase) * 0.04;
        }
      }
    }

    // 3. Pulse dynamic rings
    for (const marker of this.dynamicMarkers.children) {
      if (marker.userData?.pulse) {
        const s = 1 + Math.sin(elapsed * 5.2) * 0.07;
        marker.scale.set(s, s, s);
      }
    }

    // 4. Camera preset transition
    if (this.cameraAnimation) {
      this.cameraAnimation.elapsed += dt;
      const t = Math.min(this.cameraAnimation.elapsed / this.cameraAnimation.duration, 1);
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      this.camera.position.lerpVectors(this.cameraAnimation.fromPos, this.cameraAnimation.toPos, ease);
      this.controls.target.lerpVectors(
        this.cameraAnimation.fromTarget,
        this.cameraAnimation.toTarget,
        ease
      );

      if (t >= 1) {
        this.cameraAnimation = null;
      }
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
