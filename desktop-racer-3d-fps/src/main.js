import * as THREE from 'three';
import { SoundEngine } from './soundEngine.js';
import { DeskEnvironment } from './deskEnvironment.js';
import { CockpitAndCarMesh } from './cockpitPOV.js';
import { TrackAndRaceManager } from './trackAndAI.js';

class DesktopRacerApp {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070a12);
    this.scene.fog = new THREE.FogExp2(0x070a12, 0.0022);

    this.camera = new THREE.PerspectiveCamera(
      68,
      window.innerWidth / window.innerHeight,
      0.08,
      650
    );

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // Camera modes: 0 = First-Person Cockpit POV (Default), 1 = Hood Bumper POV, 2 = 3rd-Person Chase POV
    this.cameraMode = 0;
    this.cameraLabels = ['COCKPIT 1ST-PERSON', 'HOOD BUMPER POV', 'CHASE 3RD-PERSON'];

    // Game modes: 'gp' (Grand Prix vs AI), 'tt' (Time Trial), 'free' (Free Roam Sandbox)
    this.gameMode = 'gp';
    this.gameRunning = false;

    this.input = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      drift: false,
      boost: false,
    };

    this.sound = new SoundEngine();
    this._setupLights();

    this.deskEnv = new DeskEnvironment(this.scene);
    this.raceMgr = new TrackAndRaceManager(this.deskEnv, this.sound);
    this.carVisuals = new CockpitAndCarMesh(this.deskEnv.deskGroup);

    // Attach car headlights to chassis so they illuminate mugs, phones, and monitors ahead in 1st-Person POV!
    const headlight = new THREE.SpotLight(0xe0f7ff, 2.4, 75, Math.PI / 4, 0.45, 1.2);
    headlight.position.set(0, 0.85, -1.6);
    const hlTarget = new THREE.Object3D();
    hlTarget.position.set(0, 0.2, -18);
    this.carVisuals.chassis.add(headlight);
    this.carVisuals.chassis.add(hlTarget);
    headlight.target = hlTarget;

    // Canvas contexts for Minimap & Rear-View Mirror
    this.minimapCanvas = document.getElementById('minimap-canvas');
    this.minimapCtx = this.minimapCanvas.getContext('2d');
    this.mirrorCanvas = document.getElementById('mirror-canvas');
    this.mirrorCtx = this.mirrorCanvas.getContext('2d');

    this._bindEvents();
    this.clock = new THREE.Clock();
    this.elapsedTime = 0;

    // Initial placement
    this.raceMgr.resetPlayer(0);
    this._animate();
  }

  _setupLights() {
    const ambient = new THREE.AmbientLight(0xdbeafe, 0.85);
    this.scene.add(ambient);

    const hemi = new THREE.HemisphereLight(0x88ccff, 0x1e1b18, 0.65);
    this.scene.add(hemi);

    const dirLight = new THREE.DirectionalLight(0xfffbeb, 1.45);
    dirLight.position.set(45, 95, 55);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 260;
    const d = 95;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    this.scene.add(dirLight);

    // Cyber RGB accent point lights over the desk
    const cyanLight = new THREE.PointLight(0x00f0ff, 1.2, 110);
    cyanLight.position.set(-45, 32, -25);
    this.scene.add(cyanLight);

    const redLight = new THREE.PointLight(0xff2a4b, 1.2, 110);
    redLight.position.set(48, 32, 20);
    this.scene.add(redLight);
  }

  _bindEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    window.addEventListener('keydown', (e) => {
      const code = e.code;
      if (code === 'KeyW' || code === 'ArrowUp') this.input.forward = true;
      if (code === 'KeyS' || code === 'ArrowDown') this.input.backward = true;
      if (code === 'KeyA' || code === 'ArrowLeft') this.input.left = true;
      if (code === 'KeyD' || code === 'ArrowRight') this.input.right = true;
      if (code === 'Space') this.input.drift = true;
      if (code === 'ShiftLeft' || code === 'ShiftRight') this.input.boost = true;

      // TT Racing Up/Down Table Controls
      if (code === 'KeyR' || code === 'PageUp') {
        this.deskEnv.manualDir = 1;
        document.getElementById('desk-up-btn').classList.add('active');
      }
      if (code === 'KeyF' || code === 'PageDown') {
        this.deskEnv.manualDir = -1;
        document.getElementById('desk-down-btn').classList.add('active');
      }
      if (code === 'Digit1') this.deskEnv.setPresetHeight(73);
      if (code === 'Digit2') this.deskEnv.setPresetHeight(96);
      if (code === 'Digit3') this.deskEnv.setPresetHeight(118);
      if (code === 'Digit4') {
        const on = this.deskEnv.toggleWaveMode();
        document.getElementById('desk-wave-btn').classList.toggle('active', on);
      }

      // Camera POV switch
      if (code === 'KeyC') this.cycleCameraMode();
      // Game mode switch
      if (code === 'KeyM') this.cycleGameMode();
      // Respawn car on track
      if (code === 'Backspace') {
        e.preventDefault();
        this.raceMgr.respawnOnNearestTrackPoint();
        this.showToast('CAR RESPAWNED ON TRACK');
      }
    });

    window.addEventListener('keyup', (e) => {
      const code = e.code;
      if (code === 'KeyW' || code === 'ArrowUp') this.input.forward = false;
      if (code === 'KeyS' || code === 'ArrowDown') this.input.backward = false;
      if (code === 'KeyA' || code === 'ArrowLeft') this.input.left = false;
      if (code === 'KeyD' || code === 'ArrowRight') this.input.right = false;
      if (code === 'Space') this.input.drift = false;
      if (code === 'ShiftLeft' || code === 'ShiftRight') this.input.boost = false;

      if (code === 'KeyR' || code === 'PageUp') {
        if (this.deskEnv.manualDir === 1) this.deskEnv.manualDir = 0;
        document.getElementById('desk-up-btn').classList.remove('active');
      }
      if (code === 'KeyF' || code === 'PageDown') {
        if (this.deskEnv.manualDir === -1) this.deskEnv.manualDir = 0;
        document.getElementById('desk-down-btn').classList.remove('active');
      }
    });

    // UI Buttons
    document.getElementById('btn-camera').addEventListener('click', () => this.cycleCameraMode());
    document.getElementById('btn-mode').addEventListener('click', () => this.cycleGameMode());
    document.getElementById('btn-audio').addEventListener('click', () => {
      this.sound.init();
      const on = this.sound.toggle();
      document.getElementById('audio-label').textContent = on ? 'ON' : 'MUTED';
    });
    document.getElementById('btn-reset').addEventListener('click', () => {
      this.raceMgr.respawnOnNearestTrackPoint();
      this.showToast('CAR RESPAWNED ON TRACK');
    });

    // TT Racing Sit/Stand Desk UI Panel Buttons
    const upBtn = document.getElementById('desk-up-btn');
    const downBtn = document.getElementById('desk-down-btn');

    const startUp = () => { this.deskEnv.manualDir = 1; upBtn.classList.add('active'); };
    const stopUp = () => { if (this.deskEnv.manualDir === 1) this.deskEnv.manualDir = 0; upBtn.classList.remove('active'); };
    const startDown = () => { this.deskEnv.manualDir = -1; downBtn.classList.add('active'); };
    const stopDown = () => { if (this.deskEnv.manualDir === -1) this.deskEnv.manualDir = 0; downBtn.classList.remove('active'); };

    upBtn.addEventListener('mousedown', startUp);
    upBtn.addEventListener('mouseup', stopUp);
    upBtn.addEventListener('mouseleave', stopUp);

    downBtn.addEventListener('mousedown', startDown);
    downBtn.addEventListener('mouseup', stopDown);
    downBtn.addEventListener('mouseleave', stopDown);

    document.querySelectorAll('.preset-btn[data-height]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const h = parseFloat(btn.getAttribute('data-height'));
        this.deskEnv.setPresetHeight(h);
        document.getElementById('desk-wave-btn').classList.remove('active');
      });
    });

    document.getElementById('desk-wave-btn').addEventListener('click', (e) => {
      const on = this.deskEnv.toggleWaveMode();
      e.currentTarget.classList.toggle('active', on);
      this.showToast(on ? '🌊 TT DESK DYNAMIC WAVE MODE ON!' : 'TT DESK MANUAL MODE');
    });

    // Start Modal Buttons
    document.getElementById('btn-start-gp').addEventListener('click', () => this.startGame('gp'));
    document.getElementById('btn-start-tt').addEventListener('click', () => this.startGame('tt'));
    document.getElementById('btn-start-free').addEventListener('click', () => this.startGame('free'));
  }

  startGame(mode) {
    this.sound.init();
    this.gameMode = mode;
    document.getElementById('mode-label').textContent =
      mode === 'gp' ? 'GRAND PRIX' : mode === 'tt' ? 'TIME TRIAL' : 'FREE ROAM';
    document.getElementById('start-overlay').classList.add('hidden');
    this.raceMgr.resetPlayer(this.elapsedTime);
    this.gameRunning = true;

    if (mode === 'gp') {
      // Enable dynamic table wave or mid-preset excitement
      this.showBanner('GO!');
    } else if (mode === 'tt') {
      this.showBanner('TIME TRIAL!');
    } else {
      this.showBanner('FREE ROAM!');
    }
  }

  cycleCameraMode() {
    this.cameraMode = (this.cameraMode + 1) % 3;
    document.getElementById('cam-label').textContent = this.cameraLabels[this.cameraMode];
    document.getElementById('cockpit-overlay').classList.toggle('active', this.cameraMode === 0);
    this.showToast(`CAMERA: ${this.cameraLabels[this.cameraMode]}`);
  }

  cycleGameMode() {
    const order = ['gp', 'tt', 'free'];
    const next = order[(order.indexOf(this.gameMode) + 1) % order.length];
    this.startGame(next);
  }

  showBanner(text) {
    const banner = document.getElementById('center-banner');
    banner.textContent = text;
    banner.classList.remove('hidden');
    clearTimeout(this._bannerTimer);
    this._bannerTimer = setTimeout(() => banner.classList.add('hidden'), 1300);
  }

  showToast(text) {
    const toast = document.getElementById('checkpoint-toast');
    toast.textContent = text;
    toast.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => toast.classList.add('hidden'), 1800);
  }

  _updateCamera(p, dt) {
    // Get car world position (including the TT Racing motorized desk vertical offset!)
    const deskY = this.deskEnv.getDeskWorldY();
    const carWorldX = p.x;
    const carWorldY = deskY + p.y;
    const carWorldZ = p.z;

    const fwdX = -Math.sin(p.heading);
    const fwdZ = -Math.cos(p.heading);
    const rightX = Math.cos(p.heading);
    const rightZ = -Math.sin(p.heading);

    // Subtle high-speed & desk-actuator vibration in First-Person POV
    const speedNorm = Math.min(1, Math.abs(p.speed) / 55);
    const vib =
      (speedNorm * 0.018 + (p.isBoosting ? 0.025 : 0) + Math.abs(this.deskEnv.heightVelocity) * 0.0015) *
      Math.sin(this.elapsedTime * 42);

    if (this.cameraMode === 0) {
      // =====================================================================
      // MODE 0: TRUE 1ST-PERSON COCKPIT POV (Inside the Micro-Supercar!)
      // =====================================================================
      const eyeForwardOffset = -0.05; // Just behind steering wheel looking over dashboard & hood
      const eyeHeight = 1.27 + vib;

      this.camera.position.set(
        carWorldX + fwdX * eyeForwardOffset,
        carWorldY + eyeHeight,
        carWorldZ + fwdZ * eyeForwardOffset
      );

      const lookDist = 18.0;
      const steerLookOffset = -p.steerAngle * 2.2;
      const lookX = carWorldX + fwdX * lookDist + rightX * steerLookOffset;
      const lookY = carWorldY + 1.05 - p.pitch * 12.0;
      const lookZ = carWorldZ + fwdZ * lookDist + rightZ * steerLookOffset;

      this.camera.lookAt(lookX, lookY, lookZ);
      this.camera.rotation.z += p.roll * 0.65;

      // Dynamic FOV widening under Nitro Boost
      const targetFov = p.isBoosting ? 78 : 68 + speedNorm * 6;
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, dt * 8);
      this.camera.updateProjectionMatrix();
    } else if (this.cameraMode === 1) {
      // =====================================================================
      // MODE 1: HOOD / BUMPER POV (Ultra-low high-speed sense of scale!)
      // =====================================================================
      this.camera.position.set(
        carWorldX + fwdX * 1.15,
        carWorldY + 0.88 + vib,
        carWorldZ + fwdZ * 1.15
      );
      this.camera.lookAt(
        carWorldX + fwdX * 22,
        carWorldY + 0.85 - p.pitch * 10,
        carWorldZ + fwdZ * 22
      );
      this.camera.rotation.z += p.roll * 0.5;
    } else {
      // =====================================================================
      // MODE 2: 3RD-PERSON CHASE CAM POV
      // =====================================================================
      const chaseDist = 7.8;
      const chaseHeight = 3.6;
      const targetCamPos = new THREE.Vector3(
        carWorldX - fwdX * chaseDist,
        carWorldY + chaseHeight,
        carWorldZ - fwdZ * chaseDist
      );
      this.camera.position.lerp(targetCamPos, Math.min(1, dt * 10));
      this.camera.lookAt(carWorldX + fwdX * 6, carWorldY + 1.1, carWorldZ + fwdZ * 6);
    }
  }

  _updateHUD(p) {
    // Speed, Gear, RPM LEDs
    const scaleKmh = Math.round(Math.abs(p.speed) * 3.6);
    document.getElementById('hud-speed').textContent = scaleKmh;
    document.getElementById('hud-gear').textContent = p.gear;

    const boostPct = Math.round(p.boost);
    document.getElementById('boost-pct').textContent = `${boostPct}%`;
    document.getElementById('boost-fill').style.width = `${boostPct}%`;

    const leds = document.querySelectorAll('#rpm-leds span');
    const activeCount = Math.round(p.rpmNorm * leds.length);
    leds.forEach((span, idx) => {
      span.className = '';
      if (idx < activeCount) {
        span.classList.add(idx < 5 ? 'on-green' : idx < 8 ? 'on-amber' : 'on-red');
      }
    });

    // Cockpit speed lines effect
    const speedLines = document.getElementById('speed-lines');
    speedLines.style.opacity = p.isBoosting ? '0.95' : Math.max(0, (scaleKmh - 110) / 140).toFixed(2);

    // Position, Lap & Timers
    const pos = this.raceMgr.getPlayerRacePosition(this.gameMode);
    document.getElementById('hud-pos').innerHTML =
      this.gameMode === 'gp' ? `${pos}<small>/4</small>` : `1<small>/1</small>`;
    document.getElementById('hud-lap').innerHTML =
      this.gameMode === 'free' ? `${p.lap}<small>/∞</small>` : `${p.lap}<small>/${p.maxLaps}</small>`;

    document.getElementById('hud-time').textContent = this._formatTime(p.currentLapTime);
    if (p.bestLapTime) {
      document.getElementById('hud-best').textContent = this._formatTime(p.bestLapTime);
    }

    // TT Racing Motorized Sit-Stand Desk Panel Readout
    document.getElementById('desk-height-val').textContent = this.deskEnv.heightCm.toFixed(1);
    document.getElementById('desk-g-indicator').textContent = `${this.deskEnv.verticalG.toFixed(2)}G`;

    const stateEl = document.getElementById('desk-state-text');
    if (Math.abs(this.deskEnv.heightVelocity) > 0.2) {
      stateEl.textContent =
        this.deskEnv.heightVelocity > 0 ? '▲ RAISING TABLE...' : '▼ LOWERING TABLE...';
      stateEl.style.color = '#00f0ff';
    } else if (this.deskEnv.waveMode) {
      stateEl.textContent = '🌊 DYNAMIC WAVE ACTIVE';
      stateEl.style.color = '#00e676';
    } else {
      stateEl.textContent =
        this.deskEnv.heightCm >= 92 ? 'STAND MODE • BRIDGE OPEN' : 'SIT MODE • STABLE';
      stateEl.style.color = '#ffb800';
    }
  }

  _drawRearViewMirror(p) {
    const ctx = this.mirrorCtx;
    const w = this.mirrorCanvas.width;
    const h = this.mirrorCanvas.height;

    // Sky / studio back wall & tabletop horizon
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#090d18');
    grad.addColorStop(0.48, '#161f33');
    grad.addColorStop(0.5, '#1d2432');
    grad.addColorStop(1, '#10141d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Perspective road lines behind the car
    ctx.strokeStyle = 'rgba(255, 42, 75, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w * 0.35, h * 0.5);
    ctx.lineTo(w * 0.08, h);
    ctx.moveTo(w * 0.65, h * 0.5);
    ctx.lineTo(w * 0.92, h);
    ctx.stroke();

    // Project objects & rival AI cars behind the player into the Rear-View Mirror!
    const backX = Math.sin(p.heading);
    const backZ = Math.cos(p.heading);
    const rightX = Math.cos(p.heading);
    const rightZ = -Math.sin(p.heading);

    // Draw desktop obstacles behind player
    for (const col of this.deskEnv.circleColliders) {
      const dx = col.x - p.x;
      const dz = col.z - p.z;
      const distBack = dx * backX + dz * backZ;
      if (distBack > 1 && distBack < 65) {
        const lat = dx * rightX + dz * rightZ;
        const fovAngle = lat / distBack;
        if (Math.abs(fovAngle) < 0.85) {
          const sx = w * 0.5 - fovAngle * (w * 0.55);
          const scale = Math.min(26, (col.r * 110) / distBack);
          ctx.fillStyle = '#334155';
          ctx.fillRect(sx - scale * 0.5, h * 0.52 - scale * 0.7, scale, scale);
        }
      }
    }

    // Draw AI Rival Cars in the Rear-View Mirror with glowing headlights!
    if (this.gameMode === 'gp') {
      for (const ai of this.raceMgr.aiCars) {
        const dx = ai.x - p.x;
        const dz = ai.z - p.z;
        const distBack = dx * backX + dz * backZ;
        if (distBack > 1 && distBack < 75) {
          const lat = dx * rightX + dz * rightZ;
          const fovAngle = lat / distBack;
          if (Math.abs(fovAngle) < 0.9) {
            const sx = w * 0.5 - fovAngle * (w * 0.55);
            const carW = Math.min(34, 180 / distBack);
            const carH = carW * 0.58;
            const sy = h * 0.56;

            ctx.fillStyle = `#${ai.color.toString(16).padStart(6, '0')}`;
            ctx.fillRect(sx - carW / 2, sy - carH / 2, carW, carH);

            // Rival headlights in mirror
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(sx - carW * 0.4, sy - 2, 4, 3);
            ctx.fillRect(sx + carW * 0.4 - 4, sy - 2, 4, 3);
          }
        }
      }
    }
  }

  _drawMinimap(p) {
    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;

    ctx.fillStyle = '#070b14';
    ctx.fillRect(0, 0, w, h);

    const mapX = (wx) => ((wx + this.deskEnv.deskWidth / 2) / this.deskEnv.deskWidth) * (w - 16) + 8;
    const mapZ = (wz) => ((wz + this.deskEnv.deskDepth / 2) / this.deskEnv.deskDepth) * (h - 16) + 8;

    // Desk perimeter
    ctx.strokeStyle = 'rgba(255, 42, 75, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(8, 8, w - 16, h - 16);

    // Track loop ribbon
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.38)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    this.raceMgr.trackPoints.forEach((pt, idx) => {
      const mx = mapX(pt.x);
      const mz = mapZ(pt.z);
      if (idx === 0) ctx.moveTo(mx, mz);
      else ctx.lineTo(mx, mz);
    });
    ctx.closePath();
    ctx.stroke();

    // Desktop Objects on Minimap
    for (const col of this.deskEnv.circleColliders) {
      ctx.fillStyle = col.name.includes('Mug')
        ? '#ffb800'
        : col.name.includes('Monitor')
        ? '#00f0ff'
        : '#ff2a4b';
      ctx.beginPath();
      ctx.arc(mapX(col.x), mapZ(col.z), Math.max(3, col.r * 0.9), 0, Math.PI * 2);
      ctx.fill();
    }

    // AI Rivals on Minimap
    if (this.gameMode === 'gp') {
      for (const ai of this.raceMgr.aiCars) {
        ctx.fillStyle = `#${ai.color.toString(16).padStart(6, '0')}`;
        ctx.beginPath();
        ctx.arc(mapX(ai.x), mapZ(ai.z), 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Player Car Arrow
    const px = mapX(p.x);
    const pz = mapZ(p.z);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(-p.heading);
    ctx.fillStyle = '#00f0ff';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.5, 5);
    ctx.lineTo(-4.5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  _formatTime(sec) {
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${String(mins).padStart(2, '0')}:${rem.toFixed(2).padStart(5, '0')}`;
  }

  _animate() {
    requestAnimationFrame(() => this._animate());

    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.elapsedTime += dt;

    const p = this.raceMgr.player;
    const pos = this.raceMgr.getPlayerRacePosition(this.gameMode);
    const leaderText = pos === 1 ? 'PLAYER #1 (YOU)' : 'CYBER-GT (AI)';

    // Update Motorized TT Racing Sit-Stand Desk & Animated Screens/Steam
    this.deskEnv.update(dt, this.elapsedTime, leaderText);

    if (this.gameRunning) {
      this.raceMgr.update(
        dt,
        this.elapsedTime,
        this.input,
        this.gameMode,
        (msg) => this.showToast(msg),
        (lap, best) => {
          this.showBanner(`LAP ${lap}`);
          this.showToast(`BEST LAP: ${this._formatTime(best)}`);
        }
      );
    }

    // Update 3D Car & 1st-Person Cockpit Steering Wheel + Digital Dash
    this.carVisuals.updateVisuals(p, this.deskEnv.heightCm, this.cameraMode, this.elapsedTime);

    // Update Camera (1st-Person Cockpit / Hood / Chase)
    this._updateCamera(p, dt);

    // Update Procedural Web Audio Engine
    const speedNorm = Math.min(1, Math.abs(p.speed) / 55);
    this.sound.update(
      speedNorm,
      p.rpmNorm,
      p.isDrifting,
      p.isBoosting,
      this.deskEnv.heightVelocity
    );

    // Update HUD, Rear-View Mirror, and Minimap
    this._updateHUD(p);
    this._drawRearViewMirror(p);
    this._drawMinimap(p);

    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new DesktopRacerApp();
});
