import * as THREE from 'three';

export class TrackAndRaceManager {
  constructor(deskEnv, soundEngine) {
    this.deskEnv = deskEnv;
    this.deskGroup = deskEnv.deskGroup;
    this.sound = soundEngine;

    // Closed-loop waypoints around the desktop objects
    this.waypoints = [
      new THREE.Vector3(6, 0, 36),    // 0: Start/Finish Straight (South Mat)
      new THREE.Vector3(-24, 0, 35),  // 1: Past Handphone #1 (South-West)
      new THREE.Vector3(-48, 0, 24),  // 2: Approaching Laptop #1 Ramp
      new THREE.Vector3(-56, 0, -6),  // 3: Across Laptop #1 Deck / West Straight
      new THREE.Vector3(-50, 0, -32), // 4: North-West Corner (near Mug #2)
      new THREE.Vector3(-18, 0, -34), // 5: Under Ultrawide External Monitor #1
      new THREE.Vector3(14, 0, -31),  // 6: Past Studio Mic & Handphone #3
      new THREE.Vector3(44, 0, -20),  // 7: Under 2nd External Monitor #2 (North-East)
      new THREE.Vector3(52, 0, 0),    // 8: East Straight before Mug #1
      new THREE.Vector3(38, 0, 24),   // 9: Inside Gaming Laptop #2 & Mug #3
      new THREE.Vector3(24, 0, 36),   // 10: Entering Main Straight
    ];

    this.curve = new THREE.CatmullRomCurve3(this.waypoints, true, 'catmullrom', 0.45);
    this.trackPoints = this.curve.getSpacedPoints(220);

    // Player Physics State
    this.player = {
      x: 6,
      y: 0,
      z: 36,
      vx: 0,
      vz: 0,
      vy: 0,
      speed: 0,
      heading: Math.PI / 2, // Facing -X (West along South straight)
      steerAngle: 0,
      pitch: 0,
      roll: 0,
      wheelSpinDelta: 0,
      boost: 100,
      isBoosting: false,
      isDrifting: false,
      gear: 1,
      rpmNorm: 0.2,
      lap: 1,
      maxLaps: 3,
      checkpointIndex: 0,
      lapStartTime: 0,
      currentLapTime: 0,
      bestLapTime: null,
      totalProgress: 0,
      lastTriggerTime: 0,
    };

    this.aiCars = [];
    this.skidMarks = [];
    this.maxSkidMarks = 140;

    this._buildTrackVisuals();
    this._buildStartFinishGantry();
    this._buildAICars();
  }

  _buildTrackVisuals() {
    // Draw glowing racing lane border curbs & center dashed line on the desktop
    const trackWidth = 11.5;
    const numSamples = 180;

    const leftPosts = [];
    const rightPosts = [];

    for (let i = 0; i < numSamples; i++) {
      const t = i / numSamples;
      const pt = this.curve.getPointAt(t);
      const tan = this.curve.getTangentAt(t).normalize();
      const normal = new THREE.Vector3(-tan.z, 0, tan.x);

      const hCenter = this.deskEnv.getSurfaceHeightAt(pt.x, pt.z);

      // Center racing line chevron / dash every 2 steps
      if (i % 2 === 0) {
        const dash = new THREE.Mesh(
          new THREE.PlaneGeometry(0.45, 1.8),
          new THREE.MeshBasicMaterial({
            color: i % 8 === 0 ? 0x00f0ff : 0x334155,
            transparent: true,
            opacity: 0.65,
          })
        );
        dash.rotation.x = -Math.PI / 2;
        dash.rotation.z = Math.atan2(-tan.x, -tan.z);
        dash.position.set(pt.x, hCenter + 0.06, pt.z);
        this.deskGroup.add(dash);
      }

      // Red & White FIA Micro-Curbs along track edges
      const curbColor = i % 2 === 0 ? 0xff2a4b : 0xf8fafc;
      const curbMat = new THREE.MeshStandardMaterial({
        color: curbColor,
        roughness: 0.4,
      });

      for (const side of [-1, 1]) {
        const cx = pt.x + normal.x * (trackWidth * 0.52) * side;
        const cz = pt.z + normal.z * (trackWidth * 0.52) * side;
        const ch = this.deskEnv.getSurfaceHeightAt(cx, cz);

        const curb = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.14, 1.9), curbMat);
        curb.position.set(cx, ch + 0.07, cz);
        curb.rotation.y = Math.atan2(tan.x, tan.z);
        this.deskGroup.add(curb);
      }
    }
  }

  _buildStartFinishGantry() {
    // Start/Finish Checkerboard Strip + TT Racing Overhead Archway at (6, 0, 36)
    const gantryGroup = new THREE.Group();
    gantryGroup.position.set(6, 0, 36);
    gantryGroup.rotation.y = Math.PI / 2;

    // Checkerboard line on the desk mat
    const checkCanvas = document.createElement('canvas');
    checkCanvas.width = 256;
    checkCanvas.height = 64;
    const cctx = checkCanvas.getContext('2d');
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 16; x++) {
        cctx.fillStyle = (x + y) % 2 === 0 ? '#ffffff' : '#0f172a';
        cctx.fillRect(x * 16, y * 16, 16, 16);
      }
    }
    const startLine = new THREE.Mesh(
      new THREE.PlaneGeometry(11.5, 2.6),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(checkCanvas) })
    );
    startLine.rotation.x = -Math.PI / 2;
    startLine.position.y = 0.21;
    gantryGroup.add(startLine);

    // Archway pillars & banner
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.3 });
    for (const side of [-6.4, 6.4]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.8, 8.5, 0.8), pillarMat);
      post.position.set(side, 4.25, 0);
      gantryGroup.add(post);
    }

    const bannerCanvas = document.createElement('canvas');
    bannerCanvas.width = 512;
    bannerCanvas.height = 96;
    const bctx = bannerCanvas.getContext('2d');
    bctx.fillStyle = '#090d16';
    bctx.fillRect(0, 0, 512, 96);
    bctx.strokeStyle = '#ff2a4b';
    bctx.lineWidth = 8;
    bctx.strokeRect(4, 4, 504, 88);
    bctx.fillStyle = '#ffffff';
    bctx.font = '900 38px sans-serif';
    bctx.textAlign = 'center';
    bctx.fillText('TT RACING // START • FINISH', 256, 62);

    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(13.6, 2.2, 0.9),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bannerCanvas) })
    );
    banner.position.set(0, 8.2, 0);
    gantryGroup.add(banner);

    this.deskGroup.add(gantryGroup);
  }

  _buildAICars() {
    const aiConfigs = [
      { name: 'CYBER-GT', color: 0x00f0ff, startT: 0.035, speedMult: 0.94, laneOffset: -2.2 },
      { name: 'APEX-V8', color: 0xffb800, startT: 0.065, speedMult: 0.89, laneOffset: 2.1 },
      { name: 'NEON-RS', color: 0x00e676, startT: 0.095, speedMult: 0.84, laneOffset: -1.4 },
    ];

    for (const cfg of aiConfigs) {
      const group = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 0.65, 3.8),
        new THREE.MeshStandardMaterial({ color: cfg.color, metalness: 0.6, roughness: 0.25 })
      );
      body.position.y = 0.55;
      body.castShadow = true;
      group.add(body);

      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.48, 1.7),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.1 })
      );
      cabin.position.set(0, 1.0, 0.1);
      group.add(cabin);

      // Tail light strip so they are super visible in 1st-Person Cockpit POV!
      const tailLight = new THREE.Mesh(
        new THREE.BoxGeometry(2.0, 0.18, 0.12),
        new THREE.MeshBasicMaterial({ color: 0xff1744 })
      );
      tailLight.position.set(0, 0.65, 1.92);
      group.add(tailLight);

      this.deskGroup.add(group);
      this.aiCars.push({
        name: cfg.name,
        color: cfg.color,
        mesh: group,
        t: cfg.startT,
        lap: 1,
        speedMult: cfg.speedMult,
        laneOffset: cfg.laneOffset,
        x: 0,
        y: 0,
        z: 0,
        heading: 0,
        totalProgress: cfg.startT,
      });
    }
  }

  resetPlayer(elapsedTime = 0) {
    const p = this.player;
    p.x = 6;
    p.z = 36;
    p.y = this.deskEnv.getSurfaceHeightAt(p.x, p.z);
    p.vx = 0;
    p.vz = 0;
    p.vy = 0;
    p.speed = 0;
    p.heading = Math.PI / 2;
    p.steerAngle = 0;
    p.pitch = 0;
    p.roll = 0;
    p.boost = 100;
    p.lap = 1;
    p.checkpointIndex = 0;
    p.lapStartTime = elapsedTime;
    p.currentLapTime = 0;
    p.totalProgress = 0;

    this.aiCars.forEach((ai, idx) => {
      ai.t = 0.03 * (idx + 1);
      ai.lap = 1;
      ai.totalProgress = ai.t;
    });
  }

  respawnOnNearestTrackPoint() {
    const p = this.player;
    const wp = this.waypoints[p.checkpointIndex % this.waypoints.length];
    const nextWp = this.waypoints[(p.checkpointIndex + 1) % this.waypoints.length];
    p.x = wp.x;
    p.z = wp.z;
    p.y = this.deskEnv.getSurfaceHeightAt(p.x, p.z) + 0.5;
    p.vx = 0;
    p.vz = 0;
    p.vy = 0;
    p.speed = 0;
    p.heading = Math.atan2(-(nextWp.x - wp.x), -(nextWp.z - wp.z));
  }

  update(dt, elapsedTime, input, gameMode, onCheckpoint, onLapComplete) {
    const p = this.player;

    // 1. Steering with speed-sensitive authority
    const maxSteer = 0.58;
    const steerInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    const targetSteer = steerInput * maxSteer;
    p.steerAngle = THREE.MathUtils.lerp(p.steerAngle, targetSteer, dt * 10);

    // 2. Nitro Boost & Throttle
    p.isBoosting = input.boost && p.boost > 2 && input.forward;
    if (p.isBoosting) {
      p.boost = Math.max(0, p.boost - 28 * dt);
    } else {
      p.boost = Math.min(100, p.boost + 9 * dt);
    }

    const forwardX = -Math.sin(p.heading);
    const forwardZ = -Math.cos(p.heading);
    const rightX = Math.cos(p.heading);
    const rightZ = -Math.sin(p.heading);

    const accelRate = p.isBoosting ? 82.0 : 52.0;
    const brakeRate = 44.0;
    const topSpeed = p.isBoosting ? 64.0 : 45.0;

    let throttleForce = 0;
    if (input.forward) throttleForce += accelRate;
    if (input.backward) throttleForce -= brakeRate;

    p.vx += forwardX * throttleForce * dt;
    p.vz += forwardZ * throttleForce * dt;

    // Decompose velocity into forward & lateral (for drifting physics!)
    let fwdVel = p.vx * forwardX + p.vz * forwardZ;
    let latVel = p.vx * rightX + p.vz * rightZ;

    // Check if driving over Handphone #1 glass screen (extra slick drift surface!)
    const onPhoneGlass = Math.hypot(p.x - -28, p.z - 28) < 8.5;
    p.isDrifting = input.drift || Math.abs(latVel) > 6.5 || onPhoneGlass;

    const lateralGrip = input.drift ? 2.4 : onPhoneGlass ? 3.2 : 8.5;
    latVel = THREE.MathUtils.lerp(latVel, 0, Math.min(1, lateralGrip * dt));

    // Rolling resistance & aerodynamic drag
    fwdVel *= 1 - 1.15 * dt;
    fwdVel = THREE.MathUtils.clamp(fwdVel, -22, topSpeed);

    // Turn heading based on forward speed and steering angle
    if (Math.abs(fwdVel) > 0.4) {
      const turnRate = (input.drift ? 3.3 : 2.55) * p.steerAngle * (fwdVel >= 0 ? 1 : -1);
      const speedFactor = Math.min(1, Math.abs(fwdVel) / 14);
      p.heading += turnRate * speedFactor * dt;
    }

    // Reconstruct world velocity
    const newFwdX = -Math.sin(p.heading);
    const newFwdZ = -Math.cos(p.heading);
    const newRightX = Math.cos(p.heading);
    const newRightZ = -Math.sin(p.heading);

    p.vx = newFwdX * fwdVel + newRightX * latVel;
    p.vz = newFwdZ * fwdVel + newRightZ * latVel;
    p.speed = fwdVel;

    // Advance position
    p.x += p.vx * dt;
    p.z += p.vz * dt;

    // 3. Vertical elevation, jumps, and TT Racing Motorized Desk G-force coupling!
    const groundH = this.deskEnv.getSurfaceHeightAt(p.x, p.z);
    const effectiveGravity = 48.0 * this.deskEnv.verticalG;

    if (p.y > groundH + 0.08 || p.vy > 0) {
      p.vy -= effectiveGravity * dt;
      p.y += p.vy * dt;
      if (p.y <= groundH) {
        p.y = groundH;
        p.vy = 0;
      }
    } else {
      // Launch into air if cresting a ramp at speed or when desk drops rapidly!
      const prevGroundH = groundH;
      p.y = prevGroundH;
      if (this.deskEnv.verticalG < 0.72 && Math.abs(p.speed) > 22) {
        p.vy = 5.5;
      }
    }

    // 4. Keep car inside the TT Racing Tabletop boundaries (with safety energy barrier)
    const halfW = this.deskEnv.deskWidth / 2 - 2.6;
    const halfD = this.deskEnv.deskDepth / 2 - 2.6;
    if (p.x < -halfW) { p.x = -halfW; p.vx *= -0.45; this.sound.playCollision(0.5); }
    if (p.x > halfW)  { p.x = halfW;  p.vx *= -0.45; this.sound.playCollision(0.5); }
    if (p.z < -halfD) { p.z = -halfD; p.vz *= -0.45; this.sound.playCollision(0.5); }
    if (p.z > halfD)  { p.z = halfD;  p.vz *= -0.45; this.sound.playCollision(0.5); }

    // 5. Collisions with Mugs, Microphone, Monitors, Handphone Stand, and Gaming Laptop
    const carRadius = 1.65;
    for (const col of this.deskEnv.circleColliders) {
      const dx = p.x - col.x;
      const dz = p.z - col.z;
      const dist = Math.hypot(dx, dz);
      const minDist = carRadius + col.r;
      if (dist < minDist && dist > 0.001) {
        const nx = dx / dist;
        const nz = dz / dist;
        p.x = col.x + nx * minDist;
        p.z = col.z + nz * minDist;
        const dot = p.vx * nx + p.vz * nz;
        if (dot < 0) {
          p.vx -= (1 + col.bounce) * dot * nx;
          p.vz -= (1 + col.bounce) * dot * nz;
          this.sound.playCollision(Math.min(1, Math.abs(dot) / 15));
        }
      }
    }

    for (const box of this.deskEnv.boxColliders) {
      if (p.y < box.maxY) {
        const closestX = THREE.MathUtils.clamp(p.x, box.minX, box.maxX);
        const closestZ = THREE.MathUtils.clamp(p.z, box.minZ, box.maxZ);
        const dx = p.x - closestX;
        const dz = p.z - closestZ;
        const dist = Math.hypot(dx, dz);
        if (dist < carRadius && dist > 0.0001) {
          const nx = dx / dist;
          const nz = dz / dist;
          p.x = closestX + nx * carRadius;
          p.z = closestZ + nz * carRadius;
          const dot = p.vx * nx + p.vz * nz;
          if (dot < 0) {
            p.vx -= 1.5 * dot * nx;
            p.vz -= 1.5 * dot * nz;
            this.sound.playCollision(0.6);
          }
        }
      }
    }

    // 6. Check Boost Pads & Drive-Over TT Racing Desk Height Trigger Pads
    for (const bp of this.deskEnv.boostPads) {
      if (Math.hypot(p.x - bp.x, p.z - bp.z) < bp.r) {
        p.boost = Math.min(100, p.boost + 35 * dt);
        p.vx += newFwdX * 26 * dt;
        p.vz += newFwdZ * 26 * dt;
      }
    }

    if (elapsedTime - p.lastTriggerTime > 1.5) {
      for (const tp of this.deskEnv.deskTriggerPads) {
        if (Math.hypot(p.x - tp.x, p.z - tp.z) < tp.r) {
          p.lastTriggerTime = elapsedTime;
          if (tp.action === 'up') {
            this.deskEnv.setPresetHeight(Math.min(118, this.deskEnv.heightCm + 20));
            if (onCheckpoint) onCheckpoint('▲ TABLE RISING! OVERPASS DEPLOYING!');
          } else if (tp.action === 'down') {
            this.deskEnv.setPresetHeight(Math.max(73, this.deskEnv.heightCm - 20));
            if (onCheckpoint) onCheckpoint('▼ TABLE DROPPING! LOW-G BOOST!');
          }
          this.sound.playCheckpoint();
        }
      }
    }

    // 7. Compute Gear, RPM, Pitch, Roll, and Tire Skidmarks
    const absSpd = Math.abs(p.speed);
    const normSpd = THREE.MathUtils.clamp(absSpd / 55, 0, 1);
    p.gear = p.speed < -1 ? 'R' : Math.min(6, Math.max(1, Math.floor(normSpd * 5.8) + 1));
    p.rpmNorm = THREE.MathUtils.clamp(((normSpd * 5.8) % 1) * 0.75 + (input.forward ? 0.25 : 0.08), 0.1, 1.0);
    p.wheelSpinDelta = p.speed * dt * 1.6;

    const targetPitch = (input.forward ? -0.032 : input.backward ? 0.04 : 0) + (p.vy * 0.008);
    const targetRoll = -p.steerAngle * THREE.MathUtils.clamp(absSpd / 35, 0, 1) * 0.09;
    p.pitch = THREE.MathUtils.lerp(p.pitch, targetPitch, dt * 8);
    p.roll = THREE.MathUtils.lerp(p.roll, targetRoll, dt * 8);

    if (p.isDrifting && absSpd > 12 && p.y <= groundH + 0.1) {
      this._spawnSkidmark(p.x, groundH + 0.05, p.z, p.heading);
    }

    // 8. Checkpoints & Lap Counter
    p.currentLapTime = elapsedTime - p.lapStartTime;
    const nextIdx = (p.checkpointIndex + 1) % this.waypoints.length;
    const targetWP = this.waypoints[nextIdx];
    if (Math.hypot(p.x - targetWP.x, p.z - targetWP.z) < 17.5) {
      p.checkpointIndex = nextIdx;
      if (nextIdx === 0) {
        // Completed a full lap around the desktop!
        if (p.currentLapTime > 4.0) {
          if (!p.bestLapTime || p.currentLapTime < p.bestLapTime) {
            p.bestLapTime = p.currentLapTime;
          }
          p.lapStartTime = elapsedTime;
          this.sound.playLapComplete();
          if (gameMode !== 'free') {
            p.lap = Math.min(p.maxLaps, p.lap + 1);
          } else {
            p.lap += 1;
          }
          if (onLapComplete) onLapComplete(p.lap, p.bestLapTime);
        }
      } else if (nextIdx % 3 === 0) {
        this.sound.playCheckpoint();
        if (onCheckpoint) onCheckpoint(`SECTOR ${nextIdx / 3} CLEAR`);
      }
    }
    p.totalProgress = (p.lap - 1) + p.checkpointIndex / this.waypoints.length;

    // 9. Update AI Rival Cars (active in Grand Prix mode)
    const showAI = gameMode === 'gp';
    for (const ai of this.aiCars) {
      ai.mesh.visible = showAI;
      if (!showAI) continue;

      const baseRate = 0.072 * ai.speedMult;
      ai.t += baseRate * dt;
      if (ai.t >= 1.0) {
        ai.t -= 1.0;
        ai.lap += 1;
      }
      ai.totalProgress = (ai.lap - 1) + ai.t;

      const pt = this.curve.getPointAt(ai.t);
      const tan = this.curve.getTangentAt(ai.t).normalize();
      const normal = new THREE.Vector3(-tan.z, 0, tan.x);

      ai.x = pt.x + normal.x * ai.laneOffset;
      ai.z = pt.z + normal.z * ai.laneOffset;
      ai.y = this.deskEnv.getSurfaceHeightAt(ai.x, ai.z);
      ai.heading = Math.atan2(-tan.x, -tan.z);

      ai.mesh.position.set(ai.x, ai.y, ai.z);
      ai.mesh.rotation.y = ai.heading;
    }
  }

  getPlayerRacePosition(gameMode) {
    if (gameMode !== 'gp') return 1;
    let pos = 1;
    for (const ai of this.aiCars) {
      if (ai.totalProgress > this.player.totalProgress) pos++;
    }
    return pos;
  }

  _spawnSkidmark(x, y, z, heading) {
    const mark = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 0.65),
      new THREE.MeshBasicMaterial({ color: 0x090b10, transparent: true, opacity: 0.45 })
    );
    mark.rotation.x = -Math.PI / 2;
    mark.rotation.z = heading;
    mark.position.set(x, y, z);
    this.deskGroup.add(mark);
    this.skidMarks.push(mark);

    if (this.skidMarks.length > this.maxSkidMarks) {
      const old = this.skidMarks.shift();
      this.deskGroup.remove(old);
      old.geometry.dispose();
    }
  }
}
