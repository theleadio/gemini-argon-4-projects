import * as THREE from 'three';

export class DeskEnvironment {
  constructor(scene) {
    this.scene = scene;

    // Root group that moves UP and DOWN when the TT Racing motorized desk adjusts height
    this.deskGroup = new THREE.Group();
    this.scene.add(this.deskGroup);

    // Static room group (floor, walls, TTRacing gaming chair, lower leg bases)
    this.roomGroup = new THREE.Group();
    this.scene.add(this.roomGroup);

    // Desk dimensions in world units (1 unit ≈ 1 cm on a giant 160x100cm executive sit-stand desk)
    this.deskWidth = 170;
    this.deskDepth = 108;
    this.deskThickness = 3.2;

    // TT Racing Motorized Sit-Stand Desk state (72.0 cm to 120.0 cm)
    this.heightCm = 76.0;
    this.targetHeightCm = 76.0;
    this.minHeightCm = 72.0;
    this.maxHeightCm = 120.0;
    this.heightVelocity = 0; // cm/s
    this.verticalG = 1.0;
    this.waveMode = false;
    this.wavePhase = 0;
    this.manualDir = 0; // -1 down, 0 idle, +1 up

    // Colliders: cilindrical & box obstacles on the desk
    this.circleColliders = []; // { x, z, r, name, bounce }
    this.boxColliders = [];    // { minX, maxX, minZ, maxZ, maxY, name }
    this.ramps = [];           // { minX, maxX, minZ, maxZ, startZ, endZ, startX, endX, baseH, topH, axis, dir, dynamicBridge }
    this.boostPads = [];       // { x, z, r }
    this.deskTriggerPads = []; // { x, z, r, action: 'up' | 'down' | 'wave' }

    // Animated elements
    this.steamParticles = [];
    this.animatedScreens = [];
    this.telescopicMidLegs = [];
    this.dynamicBridgeMesh = null;
    this.bridgeActive = false;

    this._buildRoomAndTTRacingChair();
    this._buildTTRacingDeskSurface();
    this._buildDualExternalMonitors();
    this._buildLaptops();
    this._buildHandphones();
    this._buildStudioMicrophone();
    this._buildCoffeeMugs();
    this._buildKeyboardMouseAndBooks();
    this._buildTrackBoostAndDeskPads();
  }

  // Convert desk height (cm) to world Y offset of deskGroup
  getDeskWorldY() {
    return (this.heightCm - 76.0) * 0.48;
  }

  setPresetHeight(cm) {
    this.waveMode = false;
    this.targetHeightCm = THREE.MathUtils.clamp(cm, this.minHeightCm, this.maxHeightCm);
  }

  toggleWaveMode() {
    this.waveMode = !this.waveMode;
    return this.waveMode;
  }

  update(dt, elapsedTime, raceLeaderText = 'PLAYER #1') {
    const prevVel = this.heightVelocity;

    if (this.manualDir !== 0) {
      this.waveMode = false;
      this.targetHeightCm = THREE.MathUtils.clamp(
        this.heightCm + this.manualDir * 16.0 * dt,
        this.minHeightCm,
        this.maxHeightCm
      );
    } else if (this.waveMode) {
      this.wavePhase += dt * 1.35;
      this.targetHeightCm = 95.0 + Math.sin(this.wavePhase) * 21.0;
    }

    const diff = this.targetHeightCm - this.heightCm;
    const maxSpeed = this.waveMode ? 24.0 : 16.0; // cm per second
    if (Math.abs(diff) > 0.05) {
      const step = Math.sign(diff) * Math.min(Math.abs(diff), maxSpeed * dt);
      this.heightCm += step;
      this.heightVelocity = step / Math.max(dt, 0.001);
    } else {
      this.heightCm = this.targetHeightCm;
      this.heightVelocity = 0;
    }

    // Calculate vertical G-force felt by the micro car on the moving table
    const accel = (this.heightVelocity - prevVel) / Math.max(dt, 0.016);
    this.verticalG = THREE.MathUtils.clamp(1.0 + accel * 0.012, 0.45, 1.65);

    // Apply height offset to the entire desk group
    const worldY = this.getDeskWorldY();
    this.deskGroup.position.y = worldY;

    // Update telescopic legs between floor and moving tabletop
    for (const leg of this.telescopicMidLegs) {
      leg.position.y = -22 + worldY * 0.5;
      leg.scale.y = 1 + worldY / 38;
    }

    // Deploy/retract the height-activated Laptop Overpass Bridge when height > 92cm
    this.bridgeActive = this.heightCm >= 92.0;
    if (this.dynamicBridgeMesh) {
      const targetRotX = this.bridgeActive ? 0 : 0.42;
      this.dynamicBridgeMesh.rotation.x = THREE.MathUtils.lerp(
        this.dynamicBridgeMesh.rotation.x,
        targetRotX,
        dt * 6
      );
      this.dynamicBridgeMesh.material.emissiveIntensity = this.bridgeActive ? 0.65 : 0.15;
    }

    // Animate coffee mug steam particles
    for (const p of this.steamParticles) {
      p.mesh.position.y += p.speed * dt;
      p.mesh.position.x = p.baseX + Math.sin(elapsedTime * 2.2 + p.phase) * 0.45;
      p.mesh.position.z = p.baseZ + Math.cos(elapsedTime * 1.8 + p.phase) * 0.45;
      const life = (p.mesh.position.y - p.minY) / (p.maxY - p.minY);
      p.mesh.material.opacity = Math.sin(life * Math.PI) * 0.38;
      const s = 0.7 + life * 1.4;
      p.mesh.scale.set(s, s, s);
      if (p.mesh.position.y >= p.maxY) {
        p.mesh.position.y = p.minY;
      }
    }

    // Update live screens periodically
    for (const scr of this.animatedScreens) {
      scr.update(elapsedTime, this.heightCm, raceLeaderText);
    }
  }

  // Evaluate surface elevation at (x, z) on the desk (accounting for ramps & laptop decks)
  getSurfaceHeightAt(x, z) {
    let h = 0;
    for (const r of this.ramps) {
      if (r.dynamicBridge && !this.bridgeActive) continue;
      if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) {
        if (r.type === 'flat') {
          h = Math.max(h, r.topH);
        } else if (r.axis === 'z') {
          const t = THREE.MathUtils.clamp((z - r.startZ) / (r.endZ - r.startZ), 0, 1);
          h = Math.max(h, THREE.MathUtils.lerp(r.baseH, r.topH, t));
        } else if (r.axis === 'x') {
          const t = THREE.MathUtils.clamp((x - r.startX) / (r.endX - r.startX), 0, 1);
          h = Math.max(h, THREE.MathUtils.lerp(r.baseH, r.topH, t));
        }
      }
    }
    return h;
  }

  _buildRoomAndTTRacingChair() {
    // Hardwood bedroom/studio floor at Y = -42
    const floorGeo = new THREE.PlaneGeometry(420, 420);
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 512;
    floorCanvas.height = 512;
    const fctx = floorCanvas.getContext('2d');
    fctx.fillStyle = '#1b1410';
    fctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 16; i++) {
      fctx.fillStyle = i % 2 === 0 ? '#241a14' : '#1e1510';
      fctx.fillRect(0, i * 32, 512, 30);
      fctx.strokeStyle = '#120c09';
      fctx.strokeRect(0, i * 32, 512, 32);
    }
    const floorTex = new THREE.CanvasTexture(floorCanvas);
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(8, 8);

    const floorMesh = new THREE.Mesh(
      floorGeo,
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.7 })
    );
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -42;
    floorMesh.receiveShadow = true;
    this.roomGroup.add(floorMesh);

    // Back studio wall with RGB acoustic panels
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x0f131d, roughness: 0.85 });
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(420, 220, 4), wallMat);
    backWall.position.set(0, 55, -72);
    this.roomGroup.add(backWall);

    // Neon RGB Wall Light Bars behind the monitors
    const neonColors = [0xff2a4b, 0x00f0ff, 0xff2a4b];
    for (let i = -1; i <= 1; i++) {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(42, 2.2, 1.5),
        new THREE.MeshBasicMaterial({ color: neonColors[i + 1] })
      );
      bar.position.set(i * 52, 28 + Math.abs(i) * 8, -69);
      bar.rotation.z = i * -0.18;
      this.roomGroup.add(bar);
    }

    // Fixed lower leg bases anchored to the floor
    const legBaseMat = new THREE.MeshStandardMaterial({ color: 0x181c24, metalness: 0.8, roughness: 0.3 });
    for (const side of [-66, 66]) {
      const foot = new THREE.Mesh(new THREE.BoxGeometry(8, 2.5, 68), legBaseMat);
      foot.position.set(side, -40.7, 0);
      this.roomGroup.add(foot);

      const outerColumn = new THREE.Mesh(new THREE.BoxGeometry(5.5, 26, 5.5), legBaseMat);
      outerColumn.position.set(side, -28, 0);
      this.roomGroup.add(outerColumn);

      const midColumn = new THREE.Mesh(
        new THREE.BoxGeometry(4.4, 26, 4.4),
        new THREE.MeshStandardMaterial({ color: 0x2c3342, metalness: 0.85, roughness: 0.25 })
      );
      midColumn.position.set(side, -22, 0);
      this.roomGroup.add(midColumn);
      this.telescopicMidLegs.push(midColumn);
    }

    // Giant TTRacing Gaming Chair parked at the front of the desk (South side, Z = +78)
    // As the table moves up and down, you see the chair backrest rise/fall in front of the desk!
    const chairGroup = new THREE.Group();
    chairGroup.position.set(8, -42, 78);
    chairGroup.rotation.y = Math.PI + 0.18;

    const blackLeather = new THREE.MeshStandardMaterial({ color: 0x161922, roughness: 0.45 });
    const redAccent = new THREE.MeshStandardMaterial({ color: 0xe61e3c, roughness: 0.4 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0x9aa4b8, metalness: 0.85, roughness: 0.2 });

    // Seat cushion
    const seat = new THREE.Mesh(new THREE.BoxGeometry(36, 5, 34), blackLeather);
    seat.position.set(0, 26, 0);
    chairGroup.add(seat);

    // Side bolsters on seat
    for (const s of [-16.5, 16.5]) {
      const bolster = new THREE.Mesh(new THREE.BoxGeometry(4, 7.5, 34), redAccent);
      bolster.position.set(s, 27.5, 0);
      chairGroup.add(bolster);
    }

    // Tall racing backrest (extends well above desk level so it's super visible!)
    const backrest = new THREE.Mesh(new THREE.BoxGeometry(32, 62, 5.5), blackLeather);
    backrest.position.set(0, 58, -14);
    backrest.rotation.x = -0.08;
    chairGroup.add(backrest);

    // Red racing shoulder wings
    for (const s of [-16, 16]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(5, 54, 7), redAccent);
      wing.position.set(s, 56, -13);
      wing.rotation.z = s > 0 ? -0.08 : 0.08;
      chairGroup.add(wing);
    }

    // Headrest pillow with "TTRACING" logo canvas
    const pillowCanvas = document.createElement('canvas');
    pillowCanvas.width = 256;
    pillowCanvas.height = 128;
    const pctx = pillowCanvas.getContext('2d');
    pctx.fillStyle = '#141720';
    pctx.fillRect(0, 0, 256, 128);
    pctx.strokeStyle = '#ff2a4b';
    pctx.lineWidth = 6;
    pctx.strokeRect(6, 6, 244, 116);
    pctx.fillStyle = '#ffffff';
    pctx.font = '900 34px sans-serif';
    pctx.textAlign = 'center';
    pctx.fillText('TTRACING', 128, 76);
    const pillowTex = new THREE.CanvasTexture(pillowCanvas);

    const headPillow = new THREE.Mesh(
      new THREE.BoxGeometry(20, 10, 4.5),
      new THREE.MeshStandardMaterial({ map: pillowTex, roughness: 0.5 })
    );
    headPillow.position.set(0, 81, -10.5);
    chairGroup.add(headPillow);

    // 4D Armrests
    for (const s of [-19, 19]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(2.5, 16, 2.5), chromeMat);
      post.position.set(s, 34, 2);
      chairGroup.add(post);
      const pad = new THREE.Mesh(new THREE.BoxGeometry(5.5, 2.2, 18), blackLeather);
      pad.position.set(s, 42, 2);
      chairGroup.add(pad);
    }

    // Hydraulic gas lift cylinder & 5-star wheelbase
    const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 24, 16), chromeMat);
    cylinder.position.set(0, 13, 0);
    chairGroup.add(cylinder);

    for (let i = 0; i < 5; i++) {
      const ang = (i * Math.PI * 2) / 5;
      const leg = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.2, 22), blackLeather);
      leg.position.set(Math.sin(ang) * 10, 2.5, Math.cos(ang) * 10);
      leg.rotation.y = ang;
      chairGroup.add(leg);
    }

    this.roomGroup.add(chairGroup);
  }

  _buildTTRacingDeskSurface() {
    // Carbon fiber & dark walnut hybrid tabletop texture
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#171b24';
    ctx.fillRect(0, 0, 1024, 1024);

    // Subtle carbon weave pattern
    ctx.fillStyle = '#1e2430';
    for (let y = 0; y < 1024; y += 16) {
      for (let x = 0; x < 1024; x += 16) {
        if ((x + y) % 32 === 0) {
          ctx.fillRect(x, y, 8, 8);
          ctx.fillRect(x + 8, y + 8, 8, 8);
        }
      }
    }

    // TTRacing Red Perimeter Stripe on the tabletop
    ctx.strokeStyle = '#ff2a4b';
    ctx.lineWidth = 10;
    ctx.strokeRect(18, 18, 988, 988);

    const deskTex = new THREE.CanvasTexture(canvas);
    deskTex.anisotropy = 4;

    const topGeo = new THREE.BoxGeometry(this.deskWidth, this.deskThickness, this.deskDepth);
    const topMat = new THREE.MeshStandardMaterial({
      map: deskTex,
      roughness: 0.42,
      metalness: 0.18,
    });
    const topMesh = new THREE.Mesh(topGeo, topMat);
    topMesh.position.set(0, -this.deskThickness / 2, 0);
    topMesh.receiveShadow = true;
    this.deskGroup.add(topMesh);

    // Glowing RGB LED strip around desk edge
    const ledFrame = new THREE.Mesh(
      new THREE.BoxGeometry(this.deskWidth + 0.5, 0.7, this.deskDepth + 0.5),
      new THREE.MeshBasicMaterial({ color: 0xff2a4b })
    );
    ledFrame.position.set(0, -0.7, 0);
    this.deskGroup.add(ledFrame);

    // 3D TT Racing Smart Desk Digital Controller mounted at front-right edge
    const ctrlGroup = new THREE.Group();
    ctrlGroup.position.set(62, 0.4, this.deskDepth / 2 - 2.2);
    const ctrlBody = new THREE.Mesh(
      new THREE.BoxGeometry(11, 1.4, 5.2),
      new THREE.MeshStandardMaterial({ color: 0x0b0e14, metalness: 0.6, roughness: 0.3 })
    );
    ctrlGroup.add(ctrlBody);

    const ctrlCanvas = document.createElement('canvas');
    ctrlCanvas.width = 256;
    ctrlCanvas.height = 128;
    const cctx = ctrlCanvas.getContext('2d');
    const ctrlTex = new THREE.CanvasTexture(ctrlCanvas);

    const ctrlScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(10.2, 4.4),
      new THREE.MeshBasicMaterial({ map: ctrlTex })
    );
    ctrlScreen.rotation.x = -Math.PI / 2;
    ctrlScreen.position.y = 0.72;
    ctrlGroup.add(ctrlScreen);
    this.deskGroup.add(ctrlGroup);

    this.animatedScreens.push({
      lastDraw: -1,
      update: (t, heightCm) => {
        if (t - this.animatedScreens[0].lastDraw < 0.12) return;
        this.animatedScreens[0].lastDraw = t;
        cctx.fillStyle = '#050811';
        cctx.fillRect(0, 0, 256, 128);
        cctx.strokeStyle = '#ff2a4b';
        cctx.lineWidth = 4;
        cctx.strokeRect(4, 4, 248, 120);
        cctx.fillStyle = '#00f0ff';
        cctx.font = 'bold 44px monospace';
        cctx.fillText(`${heightCm.toFixed(1)}cm`, 16, 62);
        cctx.fillStyle = '#ffb800';
        cctx.font = 'bold 20px sans-serif';
        cctx.fillText('TTRACING ▲ ▼ M1 M2', 16, 102);
        ctrlTex.needsUpdate = true;
      },
    });

    // XL Gaming Desk Mat in the center-south section (adds visual texture & grip zone)
    const matCanvas = document.createElement('canvas');
    matCanvas.width = 512;
    matCanvas.height = 256;
    const mctx = matCanvas.getContext('2d');
    mctx.fillStyle = '#101420';
    mctx.fillRect(0, 0, 512, 256);
    mctx.strokeStyle = '#00f0ff';
    mctx.lineWidth = 6;
    mctx.strokeRect(6, 6, 500, 244);
    mctx.fillStyle = 'rgba(255, 42, 75, 0.18)';
    mctx.beginPath();
    mctx.moveTo(0, 256);
    mctx.lineTo(240, 0);
    mctx.lineTo(310, 0);
    mctx.lineTo(70, 256);
    mctx.fill();
    mctx.fillStyle = '#ffffff';
    mctx.font = '900 26px sans-serif';
    mctx.fillText('TT RACING // PRO GAMING MAT', 270, 228);

    const deskMat = new THREE.Mesh(
      new THREE.BoxGeometry(84, 0.18, 38),
      new THREE.MeshStandardMaterial({
        map: new THREE.CanvasTexture(matCanvas),
        roughness: 0.75,
      })
    );
    deskMat.position.set(0, 0.09, 18);
    deskMat.receiveShadow = true;
    this.deskGroup.add(deskMat);
  }

  _buildDualExternalMonitors() {
    // =========================================================================
    // EXTERNAL MONITOR #1: 34" Ultrawide Curved Monitor (North Center)
    // =========================================================================
    const mon1Group = new THREE.Group();
    mon1Group.position.set(-10, 0, -40);

    const standMat = new THREE.MeshStandardMaterial({ color: 0x232936, metalness: 0.75, roughness: 0.3 });
    // Heavy V-shaped stand base & vertical pillar
    const pillar1 = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.2, 25, 20), standMat);
    pillar1.position.set(0, 12.5, -3);
    pillar1.castShadow = true;
    mon1Group.add(pillar1);

    // Collider for Monitor 1 pillar
    this.circleColliders.push({ x: -10, z: -43, r: 3.6, name: 'Ultrawide Monitor Stand', bounce: 0.65 });

    // Ultrawide screen frame (elevated 10.5 units above desk so car drives right underneath!)
    const screenW = 58;
    const screenH = 24;
    const bezel1 = new THREE.Mesh(
      new THREE.BoxGeometry(screenW, screenH, 2.0),
      new THREE.MeshStandardMaterial({ color: 0x11151e, metalness: 0.5, roughness: 0.35 })
    );
    bezel1.position.set(0, 22.5, 0);
    bezel1.castShadow = true;
    mon1Group.add(bezel1);

    // Live animated canvas texture for External Monitor #1
    const m1Canvas = document.createElement('canvas');
    m1Canvas.width = 512;
    m1Canvas.height = 256;
    const m1Ctx = m1Canvas.getContext('2d');
    const m1Tex = new THREE.CanvasTexture(m1Canvas);

    const screen1 = new THREE.Mesh(
      new THREE.PlaneGeometry(screenW - 2.2, screenH - 2.2),
      new THREE.MeshBasicMaterial({ map: m1Tex })
    );
    screen1.position.set(0, 22.5, 1.05);
    mon1Group.add(screen1);

    // Monitor Lightbar mounted on top of Ultrawide Monitor
    const lightbar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 36, 12),
      new THREE.MeshBasicMaterial({ color: 0xfff5e0 })
    );
    lightbar.rotation.z = Math.PI / 2;
    lightbar.position.set(0, 35.2, 2.2);
    mon1Group.add(lightbar);

    this.deskGroup.add(mon1Group);

    this.animatedScreens.push({
      lastDraw: -1,
      update: (t, heightCm, leader) => {
        if (t - this.animatedScreens[1].lastDraw < 0.1) return;
        this.animatedScreens[1].lastDraw = t;
        const grad = m1Ctx.createLinearGradient(0, 0, 0, 256);
        grad.addColorStop(0, '#0a0622');
        grad.addColorStop(0.6, '#2a0b3f');
        grad.addColorStop(1, '#091526');
        m1Ctx.fillStyle = grad;
        m1Ctx.fillRect(0, 0, 512, 256);

        // Synthwave grid lines
        m1Ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
        m1Ctx.lineWidth = 2;
        for (let i = 0; i < 10; i++) {
          const y = 140 + ((i * 12 + (t * 40) % 12));
          m1Ctx.beginPath();
          m1Ctx.moveTo(0, y);
          m1Ctx.lineTo(512, y);
          m1Ctx.stroke();
        }

        m1Ctx.fillStyle = '#ff2a4b';
        m1Ctx.font = '900 28px sans-serif';
        m1Ctx.fillText('TT RACING LIVE GP TELEMETRY', 24, 48);

        m1Ctx.fillStyle = '#00f0ff';
        m1Ctx.font = 'bold 22px monospace';
        m1Ctx.fillText(`TABLE HEIGHT: ${heightCm.toFixed(1)} CM`, 24, 88);
        m1Ctx.fillStyle = '#ffffff';
        m1Ctx.fillText(`RACE LEADER : ${leader}`, 24, 122);
        m1Ctx.fillStyle = '#00e676';
        m1Ctx.fillText(
          heightCm >= 92 ? 'OVERPASS BRIDGE: DEPLOYED [OPEN]' : 'OVERPASS BRIDGE: RAISE >92CM',
          24,
          228
        );
        m1Tex.needsUpdate = true;
      },
    });

    // =========================================================================
    // EXTERNAL MONITOR #2: 27" Secondary Studio Monitor (Northeast Angled)
    // =========================================================================
    const mon2Group = new THREE.Group();
    mon2Group.position.set(44, 0, -33);
    mon2Group.rotation.y = -0.46;

    const pillar2 = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.8, 22, 18), standMat);
    pillar2.position.set(0, 11, -2);
    pillar2.castShadow = true;
    mon2Group.add(pillar2);

    const worldPillar2X = 44 + Math.sin(-0.46) * -2;
    const worldPillar2Z = -33 + Math.cos(-0.46) * -2;
    this.circleColliders.push({
      x: worldPillar2X,
      z: worldPillar2Z,
      r: 3.3,
      name: '2nd External Monitor Stand',
      bounce: 0.65,
    });

    const bezel2 = new THREE.Mesh(
      new THREE.BoxGeometry(40, 23, 1.8),
      new THREE.MeshStandardMaterial({ color: 0x151922, metalness: 0.5, roughness: 0.35 })
    );
    bezel2.position.set(0, 21.5, 0);
    bezel2.castShadow = true;
    mon2Group.add(bezel2);

    const m2Canvas = document.createElement('canvas');
    m2Canvas.width = 512;
    m2Canvas.height = 256;
    const m2Ctx = m2Canvas.getContext('2d');
    const m2Tex = new THREE.CanvasTexture(m2Canvas);

    const screen2 = new THREE.Mesh(
      new THREE.PlaneGeometry(38, 21),
      new THREE.MeshBasicMaterial({ map: m2Tex })
    );
    screen2.position.set(0, 21.5, 0.95);
    mon2Group.add(screen2);
    this.deskGroup.add(mon2Group);

    this.animatedScreens.push({
      lastDraw: -1,
      update: (t) => {
        if (t - this.animatedScreens[2].lastDraw < 0.14) return;
        this.animatedScreens[2].lastDraw = t;
        m2Ctx.fillStyle = '#0c101a';
        m2Ctx.fillRect(0, 0, 512, 256);

        // Code IDE & Audio Visualizer bars on 2nd External Monitor
        m2Ctx.fillStyle = '#1e293b';
        m2Ctx.fillRect(14, 14, 230, 228);
        m2Ctx.fillStyle = '#00f0ff';
        m2Ctx.font = 'bold 18px monospace';
        m2Ctx.fillText('// MONITOR #2: DEV HUD', 24, 42);
        const lines = ['const desk = new TTRacing();', 'desk.enableUpDown(72, 120);', 'car.setPOV("COCKPIT_1ST");', 'track.spawnMugs(3);', 'track.spawnPhones(3);'];
        m2Ctx.fillStyle = '#a5f3fc';
        m2Ctx.font = '14px monospace';
        lines.forEach((l, idx) => m2Ctx.fillText(l, 24, 75 + idx * 28));

        // Equalizer bars
        for (let b = 0; b < 12; b++) {
          const bh = 25 + Math.abs(Math.sin(t * 5 + b * 0.7)) * 140;
          m2Ctx.fillStyle = b % 2 === 0 ? '#ff2a4b' : '#00e676';
          m2Ctx.fillRect(265 + b * 19, 230 - bh, 14, bh);
        }
        m2Tex.needsUpdate = true;
      },
    });
  }

  _buildLaptops() {
    // =========================================================================
    // LAPTOP #1: 16" Pro Creator Laptop (West Sector) - DRIVABLE KEYBOARD DECK!
    // =========================================================================
    const lap1X = -56;
    const lap1Z = -6;
    const lap1W = 24;
    const lap1D = 17;
    const lap1H = 1.6;

    const aluMat = new THREE.MeshStandardMaterial({ color: 0xb8c2d0, metalness: 0.75, roughness: 0.25 });
    const lap1Base = new THREE.Mesh(new THREE.BoxGeometry(lap1W, lap1H, lap1D), aluMat);
    lap1Base.position.set(lap1X, lap1H / 2, lap1Z);
    lap1Base.castShadow = true;
    lap1Base.receiveShadow = true;
    this.deskGroup.add(lap1Base);

    // Keyboard well on Laptop 1
    const kbMesh1 = new THREE.Mesh(
      new THREE.PlaneGeometry(lap1W - 3, lap1D - 5),
      new THREE.MeshStandardMaterial({ color: 0x151821, roughness: 0.6 })
    );
    kbMesh1.rotation.x = -Math.PI / 2;
    kbMesh1.position.set(lap1X, lap1H + 0.03, lap1Z - 1);
    this.deskGroup.add(kbMesh1);

    // Open screen hinged at the back of Laptop 1 (Z = lap1Z - lap1D/2)
    const lid1Group = new THREE.Group();
    lid1Group.position.set(lap1X, lap1H, lap1Z - lap1D / 2);
    lid1Group.rotation.x = -0.25;

    const lid1 = new THREE.Mesh(new THREE.BoxGeometry(lap1W, 15.5, 0.8), aluMat);
    lid1.position.set(0, 7.75, 0);
    lid1Group.add(lid1);

    const lap1Canvas = document.createElement('canvas');
    lap1Canvas.width = 512;
    lap1Canvas.height = 320;
    const l1ctx = lap1Canvas.getContext('2d');
    l1ctx.fillStyle = '#090d16';
    l1ctx.fillRect(0, 0, 512, 320);
    l1ctx.fillStyle = '#00f0ff';
    l1ctx.font = 'bold 26px monospace';
    l1ctx.fillText('PRO LAPTOP #1 // RAMP DECK', 24, 50);
    l1ctx.fillStyle = '#ff2a4b';
    l1ctx.fillRect(24, 70, 464, 6);
    l1ctx.fillStyle = '#e2e8f0';
    l1ctx.font = '20px monospace';
    l1ctx.fillText('> Drive up South Ruler Ramp!', 24, 125);
    l1ctx.fillText('> Raise Desk >92cm for Bridge!', 24, 165);
    l1ctx.fillStyle = '#00e676';
    l1ctx.fillText('STATUS: GPU RENDERING 120FPS', 24, 240);

    const lap1Screen = new THREE.Mesh(
      new THREE.PlaneGeometry(lap1W - 1.6, 14.2),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(lap1Canvas) })
    );
    lap1Screen.position.set(0, 7.75, 0.45);
    lid1Group.add(lap1Screen);
    this.deskGroup.add(lid1Group);

    // Collider for Laptop 1 lid at the back edge so you don't drive through the screen
    this.boxColliders.push({
      minX: lap1X - lap1W / 2,
      maxX: lap1X + lap1W / 2,
      minZ: lap1Z - lap1D / 2 - 1.5,
      maxZ: lap1Z - lap1D / 2 + 1.0,
      maxY: 18,
      name: 'Laptop #1 Screen Bezel',
    });

    // Ramp up onto Laptop #1 keyboard from South (Z from +11 down to +2.5)
    const ramp1Mesh = new THREE.Mesh(
      new THREE.BoxGeometry(16, 0.35, 10),
      new THREE.MeshStandardMaterial({ color: 0xffb800, metalness: 0.4, roughness: 0.4 })
    );
    ramp1Mesh.position.set(lap1X, lap1H / 2, lap1Z + lap1D / 2 + 4.5);
    ramp1Mesh.rotation.x = Math.atan2(lap1H, 9.5);
    this.deskGroup.add(ramp1Mesh);

    // Ramp off Laptop #1 toward East (X from -44 to -36)
    const ramp1East = new THREE.Mesh(
      new THREE.BoxGeometry(9, 0.35, 14),
      new THREE.MeshStandardMaterial({ color: 0x00f0ff, metalness: 0.5, roughness: 0.3 })
    );
    ramp1East.position.set(lap1X + lap1W / 2 + 4.2, lap1H / 2, lap1Z);
    ramp1East.rotation.z = -Math.atan2(lap1H, 8.5);
    this.deskGroup.add(ramp1East);

    // Register elevation zones for Laptop #1
    this.ramps.push({
      type: 'flat',
      minX: lap1X - lap1W / 2,
      maxX: lap1X + lap1W / 2,
      minZ: lap1Z - lap1D / 2 + 1,
      maxZ: lap1Z + lap1D / 2,
      baseH: lap1H,
      topH: lap1H,
    });
    this.ramps.push({
      type: 'slope',
      axis: 'z',
      minX: lap1X - 8,
      maxX: lap1X + 8,
      minZ: lap1Z + lap1D / 2,
      maxZ: lap1Z + lap1D / 2 + 9.5,
      startZ: lap1Z + lap1D / 2 + 9.5,
      endZ: lap1Z + lap1D / 2,
      baseH: 0,
      topH: lap1H,
    });
    this.ramps.push({
      type: 'slope',
      axis: 'x',
      minX: lap1X + lap1W / 2,
      maxX: lap1X + lap1W / 2 + 8.5,
      minZ: lap1Z - 7,
      maxZ: lap1Z + 7,
      startX: lap1X + lap1W / 2 + 8.5,
      endX: lap1X + lap1W / 2,
      baseH: 0,
      topH: lap1H,
    });

    // =========================================================================
    // LAPTOP #2: 15" RGB Gaming Laptop (Southeast Turn)
    // =========================================================================
    const lap2Group = new THREE.Group();
    const lap2X = 55;
    const lap2Z = 14;
    lap2Group.position.set(lap2X, 0, lap2Z);
    lap2Group.rotation.y = -0.55;

    const darkChassis = new THREE.MeshStandardMaterial({ color: 0x161922, metalness: 0.65, roughness: 0.3 });
    const lap2Base = new THREE.Mesh(new THREE.BoxGeometry(22, 1.8, 15.5), darkChassis);
    lap2Base.position.y = 0.9;
    lap2Base.castShadow = true;
    lap2Group.add(lap2Base);

    // RGB underglow on Gaming Laptop #2
    const rgbTrim = new THREE.Mesh(
      new THREE.BoxGeometry(22.4, 0.35, 15.9),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff })
    );
    rgbTrim.position.y = 0.2;
    lap2Group.add(rgbTrim);

    // RGB backlit keys
    const kb2Canvas = document.createElement('canvas');
    kb2Canvas.width = 256;
    kb2Canvas.height = 128;
    const k2ctx = kb2Canvas.getContext('2d');
    k2ctx.fillStyle = '#11131a';
    k2ctx.fillRect(0, 0, 256, 128);
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 14; c++) {
        k2ctx.fillStyle = `hsl(${(c * 25 + r * 20) % 360}, 90%, 60%)`;
        k2ctx.fillRect(12 + c * 17, 14 + r * 20, 13, 14);
      }
    }
    const kb2Plane = new THREE.Mesh(
      new THREE.PlaneGeometry(19, 10),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(kb2Canvas) })
    );
    kb2Plane.rotation.x = -Math.PI / 2;
    kb2Plane.position.set(0, 1.82, -1);
    lap2Group.add(kb2Plane);

    // Open screen on Gaming Laptop #2
    const lid2 = new THREE.Mesh(new THREE.BoxGeometry(22, 14, 0.8), darkChassis);
    lid2.position.set(0, 8.2, -7.8);
    lid2.rotation.x = -0.2;
    lap2Group.add(lid2);

    const l2Canvas = document.createElement('canvas');
    l2Canvas.width = 512;
    l2Canvas.height = 320;
    const l2ctx = l2Canvas.getContext('2d');
    l2ctx.fillStyle = '#12081c';
    l2ctx.fillRect(0, 0, 512, 320);
    l2ctx.fillStyle = '#ff2a4b';
    l2ctx.font = '900 28px sans-serif';
    l2ctx.fillText('GAMING LAPTOP #2 // RTX ON', 22, 54);
    l2ctx.fillStyle = '#00f0ff';
    l2ctx.font = '22px monospace';
    l2ctx.fillText('APEX CORNER TELEMETRY', 22, 105);
    l2ctx.fillStyle = '#ffb800';
    l2ctx.fillText('WATCH OUT FOR COFFEE MUGS!', 22, 155);

    const lap2Screen = new THREE.Mesh(
      new THREE.PlaneGeometry(20.4, 12.6),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(l2Canvas) })
    );
    lap2Screen.position.set(0, 8.2, -7.3);
    lap2Screen.rotation.x = -0.2;
    lap2Group.add(lap2Screen);

    this.deskGroup.add(lap2Group);

    // Add circle colliders approximating Gaming Laptop #2 footprint
    this.circleColliders.push({ x: lap2X - 4, z: lap2Z - 2, r: 7.5, name: 'Gaming Laptop #2', bounce: 0.6 });
    this.circleColliders.push({ x: lap2X + 4, z: lap2Z + 2, r: 7.5, name: 'Gaming Laptop #2', bounce: 0.6 });
  }

  _buildHandphones() {
    // =========================================================================
    // HANDPHONE #1: Flagship Smartphone lying flat on the South-West Chicane
    // (Low profile 0.45 unit thick — cars can drive right over its glowing screen!)
    // =========================================================================
    const p1Canvas = document.createElement('canvas');
    p1Canvas.width = 256;
    p1Canvas.height = 512;
    const p1ctx = p1Canvas.getContext('2d');
    const grad = p1ctx.createLinearGradient(0, 0, 256, 512);
    grad.addColorStop(0, '#ff2a4b');
    grad.addColorStop(0.5, '#3b0764');
    grad.addColorStop(1, '#00f0ff');
    p1ctx.fillStyle = grad;
    p1ctx.fillRect(0, 0, 256, 512);
    p1ctx.fillStyle = '#ffffff';
    p1ctx.font = 'bold 48px sans-serif';
    p1ctx.textAlign = 'center';
    p1ctx.fillText('11:28', 128, 110);
    p1ctx.fillStyle = 'rgba(0,0,0,0.55)';
    p1ctx.fillRect(20, 150, 216, 90);
    p1ctx.fillStyle = '#00f0ff';
    p1ctx.font = 'bold 20px sans-serif';
    p1ctx.fillText('📱 HANDPHONE #1', 128, 185);
    p1ctx.fillStyle = '#fff';
    p1ctx.font = '16px sans-serif';
    p1ctx.fillText('Slick Glass Drift Zone!', 128, 218);

    const phone1Group = new THREE.Group();
    phone1Group.position.set(-28, 0.22, 28);
    phone1Group.rotation.y = 0.35;

    const phoneBodyMat = new THREE.MeshStandardMaterial({ color: 0x1e2433, metalness: 0.85, roughness: 0.2 });
    const phone1Body = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.44, 13.8), phoneBodyMat);
    phone1Group.add(phone1Body);

    const phone1Screen = new THREE.Mesh(
      new THREE.PlaneGeometry(6.2, 13.0),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(p1Canvas) })
    );
    phone1Screen.rotation.x = -Math.PI / 2;
    phone1Screen.position.y = 0.24;
    phone1Group.add(phone1Screen);
    this.deskGroup.add(phone1Group);

    // =========================================================================
    // HANDPHONE #2: Smartphone on Upright MagSafe Wireless Stand (Center Island)
    // =========================================================================
    const phone2Group = new THREE.Group();
    phone2Group.position.set(16, 0, -6);
    phone2Group.rotation.y = -0.4;

    const standBase = new THREE.Mesh(
      new THREE.CylinderGeometry(3.4, 3.8, 0.8, 24),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.25 })
    );
    standBase.position.y = 0.4;
    phone2Group.add(standBase);

    const standRod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.6, 7.5, 12),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.25 })
    );
    standRod.position.set(0, 4.0, -0.8);
    standRod.rotation.x = 0.25;
    phone2Group.add(standRod);

    const p2Canvas = document.createElement('canvas');
    p2Canvas.width = 256;
    p2Canvas.height = 512;
    const p2ctx = p2Canvas.getContext('2d');
    p2ctx.fillStyle = '#06121e';
    p2ctx.fillRect(0, 0, 256, 512);
    p2ctx.strokeStyle = '#00e676';
    p2ctx.lineWidth = 8;
    p2ctx.strokeRect(10, 10, 236, 492);
    p2ctx.fillStyle = '#00e676';
    p2ctx.font = 'bold 28px monospace';
    p2ctx.textAlign = 'center';
    p2ctx.fillText('MAGSAFE PHONE', 128, 90);
    p2ctx.fillStyle = '#ffffff';
    p2ctx.font = 'bold 42px monospace';
    p2ctx.fillText('5G⚡100%', 128, 210);
    p2ctx.fillStyle = '#ffb800';
    p2ctx.font = '24px sans-serif';
    p2ctx.fillText('APEX RADAR ON', 128, 320);

    const phone2Mesh = new THREE.Mesh(new THREE.BoxGeometry(6.4, 12.8, 0.7), phoneBodyMat);
    phone2Mesh.position.set(0, 7.5, 0.2);
    phone2Mesh.rotation.x = -0.25;
    phone2Group.add(phone2Mesh);

    const phone2Scr = new THREE.Mesh(
      new THREE.PlaneGeometry(5.9, 12.1),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(p2Canvas) })
    );
    phone2Scr.position.set(0, 7.5, 0.58);
    phone2Scr.rotation.x = -0.25;
    phone2Group.add(phone2Scr);

    this.deskGroup.add(phone2Group);
    this.circleColliders.push({ x: 16, z: -6, r: 4.1, name: 'MagSafe Handphone Stand', bounce: 0.7 });

    // =========================================================================
    // HANDPHONE #3: Gaming Smartphone near North-East Chicane
    // =========================================================================
    const phone3Group = new THREE.Group();
    phone3Group.position.set(25, 0.25, -24);
    phone3Group.rotation.y = -0.9;
    const phone3Body = new THREE.Mesh(
      new THREE.BoxGeometry(6.6, 0.5, 13.5),
      new THREE.MeshStandardMaterial({ color: 0xff2a4b, metalness: 0.7, roughness: 0.25 })
    );
    phone3Group.add(phone3Body);

    const p3Scr = new THREE.Mesh(
      new THREE.PlaneGeometry(6.0, 12.6),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff })
    );
    p3Scr.rotation.x = -Math.PI / 2;
    p3Scr.position.y = 0.26;
    phone3Group.add(p3Scr);
    this.deskGroup.add(phone3Group);
  }

  _buildStudioMicrophone() {
    // =========================================================================
    // STUDIO CONDENSER MICROPHONE on Boom Stand + Shock Mount + Pop Filter
    // =========================================================================
    const micGroup = new THREE.Group();
    const micX = -18;
    const micZ = -10;
    micGroup.position.set(micX, 0, micZ);

    const darkMetal = new THREE.MeshStandardMaterial({ color: 0x1a1f2b, metalness: 0.8, roughness: 0.25 });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.9, roughness: 0.15 });

    // Heavy Weighted Cast-Iron Microphone Base
    const micBase = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 5.2, 1.4, 28), darkMetal);
    micBase.position.y = 0.7;
    micBase.castShadow = true;
    micGroup.add(micBase);

    // Glowing Red "ON AIR" LED Ring on the Mic Base
    const onAirRing = new THREE.Mesh(
      new THREE.TorusGeometry(4.85, 0.22, 12, 32),
      new THREE.MeshBasicMaterial({ color: 0xff2a4b })
    );
    onAirRing.rotation.x = Math.PI / 2;
    onAirRing.position.y = 1.42;
    micGroup.add(onAirRing);

    // Boom Stand Shaft & Articulated Arm
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, 15, 16), darkMetal);
    shaft.position.y = 8.0;
    micGroup.add(shaft);

    const boomArm = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 14, 12), darkMetal);
    boomArm.position.set(3.5, 15.5, 2.0);
    boomArm.rotation.z = -0.65;
    micGroup.add(boomArm);

    // Condenser Microphone Capsule + Gold/Silver Mesh Grille
    const capsuleGroup = new THREE.Group();
    capsuleGroup.position.set(7.5, 11.5, 3.2);

    const micBody = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 5.8, 24), darkMetal);
    capsuleGroup.add(micBody);

    const micGrille = new THREE.Mesh(
      new THREE.CylinderGeometry(2.05, 2.05, 4.2, 24),
      new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.3, wireframe: false })
    );
    micGrille.position.y = 4.6;
    capsuleGroup.add(micGrille);

    // Mute LED indicator on Mic body
    const micLed = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0x00e676 })
    );
    micLed.position.set(0, 1.2, 2.1);
    capsuleGroup.add(micLed);

    // Red Shock Mount Rings
    for (const ry of [-1.2, 1.5]) {
      const shockRing = new THREE.Mesh(
        new THREE.TorusGeometry(2.9, 0.22, 12, 28),
        new THREE.MeshStandardMaterial({ color: 0xff2a4b, metalness: 0.5, roughness: 0.3 })
      );
      shockRing.rotation.x = Math.PI / 2;
      shockRing.position.y = ry;
      capsuleGroup.add(shockRing);
    }

    // Circular Pop Filter in front of Microphone
    const popFilter = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 3.2, 0.35, 24),
      new THREE.MeshStandardMaterial({ color: 0x0f131a, transparent: true, opacity: 0.78 })
    );
    popFilter.rotation.x = Math.PI / 2;
    popFilter.position.set(0, 3.8, 4.2);
    capsuleGroup.add(popFilter);

    micGroup.add(capsuleGroup);
    this.deskGroup.add(micGroup);

    this.circleColliders.push({
      x: micX,
      z: micZ,
      r: 5.3,
      name: 'Studio Microphone Stand',
      bounce: 0.75,
    });
  }

  _buildCoffeeMugs() {
    // Helper to build a detailed ceramic mug with handle, liquid surface, and steam particles
    const createMug = (x, z, bodyColor, labelText, hasSteam = true) => {
      const mugGroup = new THREE.Group();
      mugGroup.position.set(x, 0, z);

      // Custom wrap label canvas for the mug
      const mCanvas = document.createElement('canvas');
      mCanvas.width = 512;
      mCanvas.height = 256;
      const mctx = mCanvas.getContext('2d');
      mctx.fillStyle = bodyColor;
      mctx.fillRect(0, 0, 512, 256);
      mctx.fillStyle = '#ffffff';
      mctx.font = '900 42px sans-serif';
      mctx.textAlign = 'center';
      mctx.fillText(labelText, 256, 140);
      mctx.strokeStyle = '#ff2a4b';
      mctx.lineWidth = 10;
      mctx.strokeRect(0, 20, 512, 216);

      const mugMat = new THREE.MeshStandardMaterial({
        map: new THREE.CanvasTexture(mCanvas),
        roughness: 0.22,
        metalness: 0.1,
      });

      const radius = 4.4;
      const height = 9.6;

      // Cork Coaster under the mug
      const coaster = new THREE.Mesh(
        new THREE.CylinderGeometry(5.2, 5.2, 0.4, 24),
        new THREE.MeshStandardMaterial({ color: 0x8c6239, roughness: 0.9 })
      );
      coaster.position.y = 0.2;
      mugGroup.add(coaster);

      // Outer mug cylinder
      const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.92, height, 28), mugMat);
      cylinder.position.y = height / 2 + 0.4;
      cylinder.castShadow = true;
      cylinder.receiveShadow = true;
      mugGroup.add(cylinder);

      // Rich Dark Coffee liquid at the top of the mug
      const coffee = new THREE.Mesh(
        new THREE.CircleGeometry(radius * 0.88, 24),
        new THREE.MeshStandardMaterial({ color: 0x2b1608, roughness: 0.15, metalness: 0.2 })
      );
      coffee.rotation.x = -Math.PI / 2;
      coffee.position.y = height + 0.25;
      mugGroup.add(coffee);

      // Mug Handle (Torus arc)
      const handle = new THREE.Mesh(
        new THREE.TorusGeometry(2.7, 0.68, 12, 24, Math.PI),
        new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.25 })
      );
      handle.rotation.z = -Math.PI / 2;
      handle.position.set(radius - 0.2, height / 2 + 0.4, 0);
      mugGroup.add(handle);

      this.deskGroup.add(mugGroup);

      // Register collision cylinder
      this.circleColliders.push({
        x,
        z,
        r: radius + 0.7,
        name: `Coffee Mug (${labelText})`,
        bounce: 0.8,
      });

      // Rising Steam Puffs
      if (hasSteam) {
        for (let i = 0; i < 4; i++) {
          const steamMesh = new THREE.Mesh(
            new THREE.SphereGeometry(1.1, 10, 10),
            new THREE.MeshBasicMaterial({
              color: 0xffffff,
              transparent: true,
              opacity: 0.25,
              depthWrite: false,
            })
          );
          const minY = height + 1.2;
          const maxY = height + 14.0;
          steamMesh.position.set(x, minY + (i / 4) * (maxY - minY), z);
          this.deskGroup.add(steamMesh);
          this.steamParticles.push({
            mesh: steamMesh,
            baseX: x,
            baseZ: z,
            minY,
            maxY,
            speed: 2.8 + i * 0.35,
            phase: i * 1.6,
          });
        }
      }
    };

    // Mug #1: Signature TT Racing Mug near East Hairpin
    createMug(35, 6, '#141824', 'TT RACING ☕', true);

    // Mug #2: White Coder Mug near North-West Ultrawide Sector
    createMug(-36, -26, '#e2e8f0', '10X DEV FUEL', true);

    // Mug #3: Cyan Espresso Mug near South-East Corner
    createMug(26, 33, '#0b3b49', 'NITRO BREW', true);
  }

  _buildKeyboardMouseAndBooks() {
    // =========================================================================
    // 75% Mechanical RGB Keyboard & Wireless Mouse (Center Desk Obstacle)
    // =========================================================================
    const kbX = -2;
    const kbZ = 10;
    const kbW = 25;
    const kbD = 10.5;
    const kbH = 1.9;

    const kbGroup = new THREE.Group();
    kbGroup.position.set(kbX, 0, kbZ);

    const kbCase = new THREE.Mesh(
      new THREE.BoxGeometry(kbW, kbH, kbD),
      new THREE.MeshStandardMaterial({ color: 0x1e2430, metalness: 0.5, roughness: 0.35 })
    );
    kbCase.position.y = kbH / 2;
    kbCase.castShadow = true;
    kbGroup.add(kbCase);

    const keycapCanvas = document.createElement('canvas');
    keycapCanvas.width = 512;
    keycapCanvas.height = 256;
    const kctx = keycapCanvas.getContext('2d');
    kctx.fillStyle = '#090d14';
    kctx.fillRect(0, 0, 512, 256);
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 15; c++) {
        kctx.fillStyle = r === 0 || c === 0 || c === 14 ? '#ff2a4b' : '#283142';
        kctx.fillRect(14 + c * 32, 16 + r * 38, 28, 32);
        kctx.strokeStyle = '#00f0ff';
        kctx.lineWidth = 2;
        kctx.strokeRect(14 + c * 32, 16 + r * 38, 28, 32);
      }
    }
    const keycapTop = new THREE.Mesh(
      new THREE.PlaneGeometry(kbW - 1.5, kbD - 1.5),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(keycapCanvas) })
    );
    keycapTop.rotation.x = -Math.PI / 2;
    keycapTop.position.y = kbH + 0.03;
    kbGroup.add(keycapTop);
    this.deskGroup.add(kbGroup);

    this.boxColliders.push({
      minX: kbX - kbW / 2,
      maxX: kbX + kbW / 2,
      minZ: kbZ - kbD / 2,
      maxZ: kbZ + kbD / 2,
      maxY: kbH + 1,
      name: 'Mechanical RGB Keyboard',
    });

    // Wireless Gaming Mouse beside the keyboard
    const mouseGroup = new THREE.Group();
    mouseGroup.position.set(18, 0, 12);
    const mouseBody = new THREE.Mesh(
      new THREE.BoxGeometry(4.4, 2.2, 7.6),
      new THREE.MeshStandardMaterial({ color: 0x151922, roughness: 0.3, metalness: 0.4 })
    );
    mouseBody.position.y = 1.1;
    mouseBody.castShadow = true;
    mouseGroup.add(mouseBody);
    this.deskGroup.add(mouseGroup);
    this.circleColliders.push({ x: 18, z: 12, r: 3.8, name: 'Wireless Gaming Mouse', bounce: 0.65 });

    // =========================================================================
    // HEIGHT-ACTIVATED OVERPASS BRIDGE (Connects North Straight to Laptop #1)
    // Deploys when TT Racing Motorized Table is raised >= 92 cm!
    // =========================================================================
    const bridgeGroup = new THREE.Group();
    bridgeGroup.position.set(-56, 0, 18);

    const bridgeMesh = new THREE.Mesh(
      new THREE.BoxGeometry(14, 0.45, 14),
      new THREE.MeshStandardMaterial({
        color: 0x00f0ff,
        emissive: 0x00f0ff,
        emissiveIntensity: 0.2,
        metalness: 0.6,
        roughness: 0.25,
      })
    );
    bridgeGroup.add(bridgeMesh);
    this.dynamicBridgeMesh = bridgeMesh;
    this.deskGroup.add(bridgeGroup);
  }

  _buildTrackBoostAndDeskPads() {
    // Glowing Nitro Boost Pads on the desk circuit
    const boostLocations = [
      { x: -12, z: 36, rot: 0 },
      { x: -56, z: -6, rot: Math.PI / 2 }, // On top of Laptop #1 Keyboard Deck!
      { x: 0, z: -32, rot: Math.PI },
      { x: 52, z: -8, rot: -Math.PI / 2 },
    ];

    for (const b of boostLocations) {
      const h = this.getSurfaceHeightAt(b.x, b.z);
      const pad = new THREE.Mesh(
        new THREE.PlaneGeometry(7.5, 4.8),
        new THREE.MeshBasicMaterial({
          color: 0x00f0ff,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.82,
        })
      );
      pad.rotation.x = -Math.PI / 2;
      pad.rotation.z = b.rot;
      pad.position.set(b.x, h + 0.14, b.z);
      this.deskGroup.add(pad);
      this.boostPads.push({ x: b.x, z: b.z, r: 4.5 });
    }

    // Interactive Drive-Over TT Racing Desk Height Trigger Pads on the desktop!
    const triggerConfigs = [
      { x: 26, z: 39, action: 'up', color: 0xff2a4b, label: '▲ DESK UP PAD' },
      { x: -38, z: -35, action: 'down', color: 0xffb800, label: '▼ DESK DN PAD' },
    ];

    for (const tc of triggerConfigs) {
      const padCanvas = document.createElement('canvas');
      padCanvas.width = 256;
      padCanvas.height = 128;
      const pctx = padCanvas.getContext('2d');
      pctx.fillStyle = '#0b0f19';
      pctx.fillRect(0, 0, 256, 128);
      pctx.strokeStyle = tc.action === 'up' ? '#ff2a4b' : '#ffb800';
      pctx.lineWidth = 10;
      pctx.strokeRect(6, 6, 244, 116);
      pctx.fillStyle = '#ffffff';
      pctx.font = '900 28px sans-serif';
      pctx.textAlign = 'center';
      pctx.fillText(tc.label, 128, 74);

      const padMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(11, 5.5),
        new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(padCanvas) })
      );
      padMesh.rotation.x = -Math.PI / 2;
      padMesh.position.set(tc.x, 0.15, tc.z);
      this.deskGroup.add(padMesh);

      this.deskTriggerPads.push({ x: tc.x, z: tc.z, r: 5.2, action: tc.action });
    }
  }
}
