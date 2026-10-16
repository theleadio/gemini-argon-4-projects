import * as THREE from 'three';

export class CockpitAndCarMesh {
  constructor(deskGroup) {
    this.root = new THREE.Group();
    deskGroup.add(this.root);

    // Chassis group tilts with pitch & roll
    this.chassis = new THREE.Group();
    this.root.add(this.chassis);

    // 3rd-person exterior body group (visible in Chase Cam & reflections)
    this.exteriorGroup = new THREE.Group();
    this.chassis.add(this.exteriorGroup);

    // 1st-person interior cockpit group (steering wheel, dashboard, A-pillars, driver hands)
    this.cockpitGroup = new THREE.Group();
    this.chassis.add(this.cockpitGroup);

    this.wheels = [];
    this.steeringWheelPivot = null;
    this.dashCanvas = null;
    this.dashCtx = null;
    this.dashTex = null;
    this.lastDashDraw = 0;

    this._buildExteriorCar();
    this._buildFirstPersonCockpit();
  }

  _buildExteriorCar() {
    const bodyPaint = new THREE.MeshStandardMaterial({
      color: 0xff2a4b,
      metalness: 0.65,
      roughness: 0.22,
    });
    const carbonMat = new THREE.MeshStandardMaterial({
      color: 0x141821,
      metalness: 0.4,
      roughness: 0.4,
    });
    const cyanGlow = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

    // Front nose & sculpted hood (visible in both 1st-person cockpit POV and 3rd-person!)
    const nose = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.48, 2.2), bodyPaint);
    nose.position.set(0, 0.52, -1.25);
    nose.castShadow = true;
    this.chassis.add(nose);

    // Central white/cyan racing stripe on the hood (great visual reference in 1st-person POV)
    const hoodStripe = new THREE.Mesh(
      new THREE.PlaneGeometry(0.45, 2.1),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    hoodStripe.rotation.x = -Math.PI / 2;
    hoodStripe.position.set(0, 0.77, -1.25);
    this.chassis.add(hoodStripe);

    // Front fenders over left/right front wheels (visible out the windshield in 1st-person POV!)
    for (const side of [-1.05, 1.05]) {
      const fender = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.58, 1.7), bodyPaint);
      fender.position.set(side, 0.58, -1.2);
      this.chassis.add(fender);

      const ledStrip = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.12), cyanGlow);
      ledStrip.position.set(side, 0.62, -2.06);
      this.chassis.add(ledStrip);
    }

    // Front carbon splitter
    const splitter = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.12, 0.8), carbonMat);
    splitter.position.set(0, 0.25, -2.05);
    this.chassis.add(splitter);

    // Rear body tub & GT rear wing (hidden in Cockpit POV so camera isn't blocked, shown in Chase POV)
    const rearBody = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.65, 2.4), bodyPaint);
    rearBody.position.set(0, 0.62, 0.65);
    rearBody.castShadow = true;
    this.exteriorGroup.add(rearBody);

    const canopyGlass = new THREE.Mesh(
      new THREE.BoxGeometry(1.85, 0.55, 1.65),
      new THREE.MeshStandardMaterial({ color: 0x0b101b, metalness: 0.9, roughness: 0.1 })
    );
    canopyGlass.position.set(0, 1.08, 0.15);
    this.exteriorGroup.add(canopyGlass);

    // GT Wing
    const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.1, 0.55), carbonMat);
    wingBlade.position.set(0, 1.42, 1.68);
    this.exteriorGroup.add(wingBlade);

    for (const s of [-0.85, 0.85]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.55, 0.35), carbonMat);
      strut.position.set(s, 1.12, 1.62);
      this.exteriorGroup.add(strut);
    }

    // Twin Nitro Exhaust Thrusters at the back
    this.exhaustLeft = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.9, 12),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.0 })
    );
    this.exhaustLeft.rotation.x = Math.PI / 2;
    this.exhaustLeft.position.set(-0.5, 0.5, 2.25);
    this.chassis.add(this.exhaustLeft);

    this.exhaustRight = this.exhaustLeft.clone();
    this.exhaustRight.position.x = 0.5;
    this.chassis.add(this.exhaustRight);

    // 4 Detailed Wheels with rims
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x12141a, roughness: 0.8 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x00f0ff, metalness: 0.8, roughness: 0.2 });

    const wheelCoords = [
      { x: -1.25, y: 0.45, z: -1.25, front: true },
      { x: 1.25, y: 0.45, z: -1.25, front: true },
      { x: -1.28, y: 0.48, z: 1.25, front: false },
      { x: 1.28, y: 0.48, z: 1.25, front: false },
    ];

    for (const wc of wheelCoords) {
      const wPivot = new THREE.Group();
      wPivot.position.set(wc.x, wc.y, wc.z);

      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.42, 20), tireMat);
      tire.rotation.z = Math.PI / 2;
      wPivot.add(tire);

      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.44, 12), rimMat);
      rim.rotation.z = Math.PI / 2;
      wPivot.add(rim);

      this.chassis.add(wPivot);
      this.wheels.push({ pivot: wPivot, tire, front: wc.front });
    }
  }

  _buildFirstPersonCockpit() {
    // Everything inside `this.cockpitGroup` is engineered around the 1st-Person Driver Eye Camera
    // Driver eye position in local chassis space: (0, 1.26, 0.18) looking toward (0, 1.08, -4.0)
    const dashMat = new THREE.MeshStandardMaterial({
      color: 0x121621,
      roughness: 0.55,
      metalness: 0.3,
    });
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x1a2030,
      roughness: 0.4,
      metalness: 0.5,
    });
    const redStitchMat = new THREE.MeshStandardMaterial({
      color: 0xff2a4b,
      roughness: 0.35,
    });

    // Dashboard cowl directly in front of the driver
    const dashCowl = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.32, 0.85), dashMat);
    dashCowl.position.set(0, 0.86, -0.58);
    this.cockpitGroup.add(dashCowl);

    // Left & Right A-Pillars framing the 1st-Person Windshield
    for (const side of [-1, 1]) {
      const aPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 1.15, 10), pillarMat);
      aPillar.position.set(side * 0.96, 1.25, -0.45);
      aPillar.rotation.x = 0.58;
      aPillar.rotation.z = side * 0.16;
      this.cockpitGroup.add(aPillar);
    }

    // Upper windshield sun-strip / roll-bar header
    const sunStrip = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.08, 0.22), dashMat);
    sunStrip.position.set(0, 1.68, -0.18);
    this.cockpitGroup.add(sunStrip);

    // Live 3D Digital Dashboard Cluster Screen behind the steering wheel
    this.dashCanvas = document.createElement('canvas');
    this.dashCanvas.width = 256;
    this.dashCanvas.height = 128;
    this.dashCtx = this.dashCanvas.getContext('2d');
    this.dashTex = new THREE.CanvasTexture(this.dashCanvas);

    const dashScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.62, 0.28),
      new THREE.MeshBasicMaterial({ map: this.dashTex })
    );
    dashScreen.position.set(0, 1.07, -0.46);
    dashScreen.rotation.x = -0.18;
    this.cockpitGroup.add(dashScreen);

    // Steering Column
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.38, 12), pillarMat);
    column.rotation.x = Math.PI / 2 - 0.22;
    column.position.set(0, 1.0, -0.32);
    this.cockpitGroup.add(column);

    // Animated F1 / GT Steering Wheel Pivot
    this.steeringWheelPivot = new THREE.Group();
    this.steeringWheelPivot.position.set(0, 1.03, -0.20);
    this.steeringWheelPivot.rotation.x = -0.22;

    // Steering wheel outer rim
    const wheelRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.24, 0.032, 14, 32),
      dashMat
    );
    this.steeringWheelPivot.add(wheelRim);

    // Top-center red 12-o'clock marker ring on steering wheel
    const topMarker = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.07, 0.07),
      redStitchMat
    );
    topMarker.position.set(0, 0.24, 0);
    this.steeringWheelPivot.add(topMarker);

    // Steering wheel center hub & spokes
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.04, 16), pillarMat);
    hub.rotation.x = Math.PI / 2;
    this.steeringWheelPivot.add(hub);

    const crossbar = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.055, 0.03), pillarMat);
    this.steeringWheelPivot.add(crossbar);

    // Driver Racing Gloves gripping left & right sides of the wheel!
    const gloveMat = new THREE.MeshStandardMaterial({ color: 0xe61e3c, roughness: 0.5 });
    for (const side of [-1, 1]) {
      const glove = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.11), gloveMat);
      glove.position.set(side * 0.23, -0.02, 0.03);
      this.steeringWheelPivot.add(glove);
    }

    this.cockpitGroup.add(this.steeringWheelPivot);
  }

  updateVisuals(carState, deskHeightCm, cameraMode, elapsedTime) {
    // Position & orient car root on the desk surface
    this.root.position.set(carState.x, carState.y, carState.z);
    this.root.rotation.y = carState.heading;

    // Suspension pitch & roll
    this.chassis.rotation.x = carState.pitch;
    this.chassis.rotation.z = carState.roll;

    // Show/hide interior vs exterior parts based on camera mode
    // Mode 0: Cockpit 1st-Person POV, Mode 1: Hood POV, Mode 2: Chase 3rd-Person POV
    this.cockpitGroup.visible = cameraMode === 0;
    this.exteriorGroup.visible = cameraMode === 2;

    // Rotate steering wheel smoothly in 1st-Person Cockpit POV
    if (this.steeringWheelPivot) {
      this.steeringWheelPivot.rotation.z = -carState.steerAngle * 2.4;
    }

    // Spin wheels & turn front wheels
    for (const w of this.wheels) {
      if (w.front) {
        w.pivot.rotation.y = carState.steerAngle * 0.85;
      }
      w.tire.rotation.x -= carState.wheelSpinDelta;
    }

    // Nitro boost exhaust flame
    const boostAlpha = carState.isBoosting ? 0.85 : 0.0;
    this.exhaustLeft.material.opacity = boostAlpha;
    this.exhaustRight.material.opacity = boostAlpha;

    // Redraw 3D In-Cockpit Digital Dashboard screen
    if (cameraMode === 0 && elapsedTime - this.lastDashDraw > 0.08) {
      this.lastDashDraw = elapsedTime;
      const ctx = this.dashCtx;
      ctx.fillStyle = '#060a12';
      ctx.fillRect(0, 0, 256, 128);

      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, 248, 120);

      // RPM Bar across top of in-cockpit screen
      const rpmCols = Math.floor(carState.rpmNorm * 12);
      for (let i = 0; i < 12; i++) {
        ctx.fillStyle =
          i < rpmCols
            ? i < 6
              ? '#00e676'
              : i < 9
              ? '#ffb800'
              : '#ff2a4b'
            : '#1e293b';
        ctx.fillRect(14 + i * 19, 14, 15, 14);
      }

      // Speed & Gear
      const scaleKmh = Math.round(Math.abs(carState.speed) * 3.6);
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 46px monospace';
      ctx.fillText(`${scaleKmh}`, 18, 82);
      ctx.font = 'bold 16px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('KM/H', 18, 105);

      // Gear indicator box
      ctx.fillStyle = '#ff2a4b';
      ctx.fillRect(130, 42, 44, 52);
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 38px sans-serif';
      ctx.fillText(`${carState.gear}`, 141, 81);

      // Desk height mini telemetry inside cockpit
      ctx.fillStyle = '#00f0ff';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(`${deskHeightCm.toFixed(0)}CM`, 185, 74);

      this.dashTex.needsUpdate = true;
    }
  }
}
