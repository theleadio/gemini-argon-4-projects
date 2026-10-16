// Main Application Controller for GummyBox Playground

(function () {
  const canvas = document.getElementById('jelly-canvas');
  const ctx = canvas.getContext('2d');

  // App State
  const state = {
    bears: [],
    particles: [],
    shockwaves: [],
    activeTool: 'grab',
    selectedFlavor: window.FLAVORS[0],
    customColor: '#ff2442',
    useCustomColor: false,
    coating: 'glossy',
    mood: 'auto',
    physics: {
      stiffness: 0.55,
      bounce: 0.75,
      scale: 1.0,
      gravity: 0.5,
      width: window.innerWidth,
      height: window.innerHeight
    },
    pointer: {
      x: 0,
      y: 0,
      prevX: 0,
      prevY: 0,
      vx: 0,
      vy: 0,
      isDown: false
    },
    grabbed: null, // { bear, nodeIndex, pointerX, pointerY }
    fps: 60
  };

  // Resize handler
  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.physics.width = window.innerWidth;
    state.physics.height = window.innerHeight;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // Particle & Visual Effect Helpers
  function spawnJellyParticles(x, y, colorHex, count = 14, speedMult = 1.0) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (2 + Math.random() * 8) * speedMult;
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2.5,
        r: 3 + Math.random() * 5.5,
        color: colorHex,
        alpha: 1,
        decay: 0.018 + Math.random() * 0.02
      });
    }
  }

  function spawnShockwave(x, y, colorHex, maxR = 120) {
    state.shockwaves.push({
      x,
      y,
      r: 8,
      maxR,
      color: colorHex,
      alpha: 0.85
    });
  }

  // Spawn a Gummy Bear
  function spawnBear(x, y, overrides = {}) {
    const flavor = overrides.flavor || state.selectedFlavor;
    const hex = overrides.colorHex || (state.useCustomColor ? state.customColor : flavor.hex);
    const isRainbow = overrides.isRainbow !== undefined ? overrides.isRainbow : Boolean(!state.useCustomColor && flavor.isRainbow);
    const scale = overrides.scale || state.physics.scale;

    const bear = new window.GummyBear(x, y, {
      scale,
      colorHex: hex,
      isRainbow,
      coating: overrides.coating || state.coating,
      mood: overrides.mood || state.mood,
      initialVy: overrides.initialVy !== undefined ? overrides.initialVy : 3
    });

    state.bears.push(bear);
    spawnJellyParticles(x, y, hex, 10, 0.8);
    if (window.jellyAudio) {
      window.jellyAudio.playPop(1.0 / Math.sqrt(scale));
    }
    updateBearCountUI();
    return bear;
  }

  function updateBearCountUI() {
    const el = document.getElementById('bear-count');
    if (el) el.textContent = state.bears.length;
  }

  // Build Flavor Swatches in Control Panel
  function initFlavorGrid() {
    const grid = document.getElementById('flavor-grid');
    const badge = document.getElementById('active-flavor-name');
    const customInput = document.getElementById('custom-color-input');

    window.FLAVORS.forEach((flavor, idx) => {
      const btn = document.createElement('button');
      btn.className = 'flavor-swatch' + (idx === 0 ? ' active' : '');
      btn.title = flavor.name;
      if (flavor.isRainbow) {
        btn.style.background = 'linear-gradient(135deg, #ff2442, #ffb703, #2bd94f, #00a8ff, #9b5de5)';
      } else {
        btn.style.background = `radial-gradient(circle at 35% 30%, ${flavor.inner}, ${flavor.hex} 65%, ${flavor.rim})`;
      }

      btn.addEventListener('click', () => {
        document.querySelectorAll('.flavor-swatch').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.selectedFlavor = flavor;
        state.useCustomColor = false;
        badge.textContent = flavor.name;
        customInput.value = flavor.hex;
        if (window.jellyAudio) window.jellyAudio.playPop(1.15);
      });

      grid.appendChild(btn);
    });

    customInput.addEventListener('input', (e) => {
      state.customColor = e.target.value;
      state.useCustomColor = true;
      document.querySelectorAll('.flavor-swatch').forEach(b => b.classList.remove('active'));
      badge.textContent = 'Custom Blend';
    });
  }

  // Find topmost bear at (x, y)
  function findBearAt(x, y) {
    for (let i = state.bears.length - 1; i >= 0; i--) {
      if (state.bears[i].containsPoint(x, y)) {
        return state.bears[i];
      }
    }
    // Fallback: check if very close to any perimeter node for easy ear/paw grabbing
    let closestBear = null;
    let bestDist = 26;
    for (let i = state.bears.length - 1; i >= 0; i--) {
      const b = state.bears[i];
      const nearest = b.findClosestNode(x, y);
      if (nearest.distance < bestDist * b.scale) {
        bestDist = nearest.distance;
        closestBear = b;
      }
    }
    return closestBear;
  }

  // Tool Actions on Pointer Down
  function handlePointerDown(x, y) {
    state.pointer.isDown = true;
    state.pointer.x = x;
    state.pointer.y = y;
    state.pointer.prevX = x;
    state.pointer.prevY = y;

    const hitBear = findBearAt(x, y);
    const tool = state.activeTool;

    if (tool === 'grab') {
      if (hitBear) {
        // Bring grabbed bear to front
        const idx = state.bears.indexOf(hitBear);
        if (idx > -1) {
          state.bears.splice(idx, 1);
          state.bears.push(hitBear);
        }
        const nearest = hitBear.findClosestNode(x, y);
        state.grabbed = {
          bear: hitBear,
          nodeIndex: nearest.index,
          pointerX: x,
          pointerY: y
        };
        if (window.jellyAudio) window.jellyAudio.playStretch(1.0);
      }
    } else if (tool === 'poke') {
      // Boop shockwave impulse
      spawnShockwave(x, y, '#00f5d4', 150);
      spawnJellyParticles(x, y, '#00f5d4', 12, 1.1);
      if (window.jellyAudio) window.jellyAudio.playBoing(0.9, 0.9);

      for (const b of state.bears) {
        for (const node of b.nodes) {
          const dx = node.x - x;
          const dy = node.y - y;
          const dist = Math.hypot(dx, dy);
          if (dist < 175) {
            const force = Math.pow(1 - dist / 175, 1.5) * 26;
            const nx = dist > 0.01 ? dx / dist : 0;
            const ny = dist > 0.01 ? dy / dist : -1;
            node.vx += nx * force;
            node.vy += ny * force - 4;
          }
        }
        b.squishFlash = 0.85;
      }
    } else if (tool === 'bite') {
      if (hitBear) {
        hitBear.takeBite(x, y);
        spawnJellyParticles(x, y, hitBear.colorHex, 22, 1.3);
        if (window.jellyAudio) window.jellyAudio.playChomp();

        // Jiggle the bitten bear
        for (const node of hitBear.nodes) {
          node.vx += (Math.random() - 0.5) * 14;
          node.vy += (Math.random() - 0.5) * 14 - 4;
        }
        hitBear.squishFlash = 1.0;

        // If bitten 5+ times, pop into 2 mini gummy bears!
        if (hitBear.bites.length >= 5) {
          const idx = state.bears.indexOf(hitBear);
          if (idx > -1) state.bears.splice(idx, 1);
          spawnShockwave(hitBear.cx, hitBear.cy, hitBear.colorHex, 110);
          spawnJellyParticles(hitBear.cx, hitBear.cy, hitBear.colorHex, 30, 1.5);
          if (hitBear.scale > 0.62) {
            const miniScale = Math.max(0.55, hitBear.scale * 0.68);
            spawnBear(hitBear.cx - 22, hitBear.cy, {
              scale: miniScale,
              colorHex: hitBear.colorHex,
              isRainbow: hitBear.isRainbow,
              coating: hitBear.coating
            });
            spawnBear(hitBear.cx + 22, hitBear.cy, {
              scale: miniScale,
              colorHex: hitBear.colorHex,
              isRainbow: hitBear.isRainbow,
              coating: hitBear.coating
            });
          }
          updateBearCountUI();
        }
      }
    } else if (tool === 'grow') {
      if (hitBear) {
        const nextScale = hitBear.scale >= 1.95 ? 0.6 : hitBear.scale + 0.22;
        hitBear.setScale(nextScale);
        spawnShockwave(hitBear.cx, hitBear.cy, hitBear.colorHex, 90 * nextScale);
        for (const node of hitBear.nodes) {
          const dx = node.x - hitBear.cx;
          const dy = node.y - hitBear.cy;
          const len = Math.hypot(dx, dy) || 1;
          node.vx += (dx / len) * 8;
          node.vy += (dy / len) * 8;
        }
        if (window.jellyAudio) window.jellyAudio.playBoing(0.75, nextScale);
      }
    } else if (tool === 'paint') {
      if (hitBear) {
        const hex = state.useCustomColor ? state.customColor : state.selectedFlavor.hex;
        const isRainbow = Boolean(!state.useCustomColor && state.selectedFlavor.isRainbow);
        hitBear.setColor(hex, isRainbow);
        hitBear.coating = state.coating;
        spawnJellyParticles(x, y, hex, 18, 1.1);
        if (window.jellyAudio) window.jellyAudio.playPop(1.25);
      }
    } else if (tool === 'vortex') {
      if (window.jellyAudio) window.jellyAudio.playPop(0.85);
    }
  }

  function handlePointerMove(x, y) {
    state.pointer.vx = x - state.pointer.x;
    state.pointer.vy = y - state.pointer.y;
    state.pointer.prevX = state.pointer.x;
    state.pointer.prevY = state.pointer.y;
    state.pointer.x = x;
    state.pointer.y = y;

    if (state.grabbed) {
      state.grabbed.pointerX = x;
      state.grabbed.pointerY = y;
      if (Math.hypot(state.pointer.vx, state.pointer.vy) > 14 && window.jellyAudio) {
        window.jellyAudio.playStretch(state.grabbed.bear.stretchMetric * 0.25);
      }
    } else if (state.pointer.isDown && state.activeTool === 'paint') {
      const hitBear = findBearAt(x, y);
      if (hitBear) {
        const hex = state.useCustomColor ? state.customColor : state.selectedFlavor.hex;
        const isRainbow = Boolean(!state.useCustomColor && state.selectedFlavor.isRainbow);
        if (hitBear.colorHex !== hex || hitBear.isRainbow !== isRainbow || hitBear.coating !== state.coating) {
          hitBear.setColor(hex, isRainbow);
          hitBear.coating = state.coating;
          spawnJellyParticles(x, y, hex, 8, 0.8);
          if (window.jellyAudio) window.jellyAudio.playPop(1.2);
        }
      }
    }
  }

  function handlePointerUp() {
    if (state.grabbed) {
      // Impart fling momentum on release
      const flingVx = Math.max(-28, Math.min(28, state.pointer.vx * 0.85));
      const flingVy = Math.max(-28, Math.min(28, state.pointer.vy * 0.85));
      for (const node of state.grabbed.bear.nodes) {
        node.vx += flingVx * 0.45;
        node.vy += flingVy * 0.45;
      }
      if (window.jellyAudio && Math.hypot(flingVx, flingVy) > 5) {
        window.jellyAudio.playBoing(0.65, state.grabbed.bear.scale);
      }
      state.grabbed = null;
    }
    state.pointer.isDown = false;
  }

  // Canvas Pointer Events
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    handlePointerDown(e.clientX, e.clientY);
  });

  canvas.addEventListener('pointermove', (e) => {
    handlePointerMove(e.clientX, e.clientY);
  });

  canvas.addEventListener('pointerup', () => {
    handlePointerUp();
  });

  canvas.addEventListener('pointercancel', () => {
    handlePointerUp();
  });

  // Double-click empty space to spawn a bear right there
  canvas.addEventListener('dblclick', (e) => {
    const hit = findBearAt(e.clientX, e.clientY);
    if (!hit) {
      spawnBear(e.clientX, e.clientY);
    }
  });

  // Bind UI Buttons & Controls
  function bindUIControls() {
    // Spawn 1 Bear
    document.getElementById('btn-spawn-one').addEventListener('click', () => {
      const x = state.physics.width * (0.28 + Math.random() * 0.44);
      const y = Math.min(140, state.physics.height * 0.18);
      spawnBear(x, y);
    });

    // Candy Rain (spawns 8 bears in a colorful shower)
    document.getElementById('btn-candy-rain').addEventListener('click', () => {
      for (let i = 0; i < 8; i++) {
        setTimeout(() => {
          const randomFlavor = window.FLAVORS[Math.floor(Math.random() * window.FLAVORS.length)];
          const x = state.physics.width * (0.18 + Math.random() * 0.64);
          const y = 75 + Math.random() * 40;
          spawnBear(x, y, {
            flavor: randomFlavor,
            colorHex: randomFlavor.hex,
            isRainbow: randomFlavor.isRainbow,
            scale: 0.75 + Math.random() * 0.45,
            initialVy: 5 + Math.random() * 4
          });
        }, i * 110);
      }
    });

    // Giant Boss Bear
    document.getElementById('btn-giant-bear').addEventListener('click', () => {
      const x = state.physics.width * 0.5;
      const y = Math.min(160, state.physics.height * 0.22);
      spawnBear(x, y, { scale: 1.85, initialVy: 6 });
    });

    // Shake Candy Jar
    document.getElementById('btn-shake').addEventListener('click', () => {
      if (window.jellyAudio) window.jellyAudio.playBoing(1.0, 0.8);
      for (const b of state.bears) {
        const joltX = (Math.random() - 0.5) * 38;
        const joltY = -(14 + Math.random() * 22);
        for (const node of b.nodes) {
          node.vx += joltX + (Math.random() - 0.5) * 12;
          node.vy += joltY + (Math.random() - 0.5) * 12;
        }
        b.squishFlash = 1.0;
      }
    });

    // Zero-G Toggle
    const btnZeroG = document.getElementById('btn-zero-g');
    const sliderGravity = document.getElementById('slider-gravity');
    const valGravity = document.getElementById('val-gravity');

    btnZeroG.addEventListener('click', () => {
      const isZero = btnZeroG.getAttribute('aria-pressed') === 'true';
      if (!isZero) {
        btnZeroG.setAttribute('aria-pressed', 'true');
        state.physics.gravity = 0;
        sliderGravity.value = '0';
        valGravity.textContent = 'Zero-G';
        // Give bears a gentle float nudge
        for (const b of state.bears) {
          for (const node of b.nodes) {
            node.vy -= 2.5 + Math.random() * 3;
            node.vx += (Math.random() - 0.5) * 4;
          }
        }
      } else {
        btnZeroG.setAttribute('aria-pressed', 'false');
        state.physics.gravity = 0.5;
        sliderGravity.value = '0.5';
        valGravity.textContent = 'Normal';
      }
      if (window.jellyAudio) window.jellyAudio.playPop(isZero ? 0.8 : 1.3);
    });

    // Sound Toggle
    const btnSound = document.getElementById('btn-sound');
    const soundIcon = document.getElementById('sound-icon');
    btnSound.addEventListener('click', () => {
      window.jellyAudio.enabled = !window.jellyAudio.enabled;
      btnSound.setAttribute('aria-pressed', String(window.jellyAudio.enabled));
      soundIcon.textContent = window.jellyAudio.enabled ? '🔊' : '🔇';
      if (window.jellyAudio.enabled) window.jellyAudio.playPop(1.1);
    });

    // Clear Bears
    document.getElementById('btn-clear').addEventListener('click', () => {
      for (const b of state.bears) {
        spawnJellyParticles(b.cx, b.cy, b.colorHex, 8, 1.1);
      }
      state.bears = [];
      state.grabbed = null;
      updateBearCountUI();
      if (window.jellyAudio) window.jellyAudio.playPop(0.65);
    });

    // Tool Dock Buttons
    document.querySelectorAll('.tool-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.activeTool = btn.dataset.tool;
        canvas.style.cursor = state.activeTool === 'grab' ? 'grab' : 'crosshair';
        if (window.jellyAudio) window.jellyAudio.playPop(1.1);
      });
    });

    // Coating Segmented Control
    document.querySelectorAll('#coating-control .seg-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#coating-control .seg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.coating = btn.dataset.coating;
        for (const b of state.bears) {
          b.coating = state.coating;
        }
        if (window.jellyAudio) window.jellyAudio.playPop(1.2);
      });
    });

    // Mood Segmented Control
    document.querySelectorAll('#mood-control .seg-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#mood-control .seg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.mood = btn.dataset.mood;
        for (const b of state.bears) {
          b.mood = state.mood;
        }
        if (window.jellyAudio) window.jellyAudio.playPop(1.1);
      });
    });

    // Physics Sliders
    const sliderStiffness = document.getElementById('slider-stiffness');
    const valSoftness = document.getElementById('val-softness');
    sliderStiffness.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      state.physics.stiffness = val;
      if (val < 0.3) valSoftness.textContent = 'Melty Blob';
      else if (val < 0.5) valSoftness.textContent = 'Extra Wiggly';
      else if (val < 0.7) valSoftness.textContent = 'Juicy Gummy';
      else valSoftness.textContent = 'Firm Chewy';
    });

    const sliderBounce = document.getElementById('slider-bounce');
    const valBounce = document.getElementById('val-bounce');
    sliderBounce.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      state.physics.bounce = val;
      valBounce.textContent = `${Math.round(val * 100)}%`;
    });

    const sliderSize = document.getElementById('slider-size');
    const valSize = document.getElementById('val-size');
    sliderSize.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      state.physics.scale = val;
      valSize.textContent = `${val.toFixed(2)}×`;
    });

    sliderGravity.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      state.physics.gravity = val;
      btnZeroG.setAttribute('aria-pressed', val === 0 ? 'true' : 'false');
      if (val < -0.05) valGravity.textContent = 'Anti-Gravity';
      else if (Math.abs(val) <= 0.05) valGravity.textContent = 'Zero-G';
      else if (val < 0.35) valGravity.textContent = 'Moon Float';
      else if (val < 0.7) valGravity.textContent = 'Normal';
      else valGravity.textContent = 'Heavy Syrup';
    });

    // Reset Physics Button
    document.getElementById('btn-reset-physics').addEventListener('click', () => {
      state.physics.stiffness = 0.55;
      state.physics.bounce = 0.75;
      state.physics.scale = 1.0;
      state.physics.gravity = 0.5;
      sliderStiffness.value = '0.55';
      valSoftness.textContent = 'Juicy Gummy';
      sliderBounce.value = '0.75';
      valBounce.textContent = '75%';
      sliderSize.value = '1.0';
      valSize.textContent = '1.0×';
      sliderGravity.value = '0.5';
      valGravity.textContent = 'Normal';
      btnZeroG.setAttribute('aria-pressed', 'false');
      if (window.jellyAudio) window.jellyAudio.playPop(1.0);
    });

    // Collapsible Control Panel
    const panel = document.getElementById('control-panel');
    const toggleBtn = document.getElementById('panel-toggle');
    const chevron = document.getElementById('panel-chevron');
    toggleBtn.addEventListener('click', () => {
      panel.classList.toggle('collapsed');
      chevron.textContent = panel.classList.contains('collapsed') ? '▸' : '▾';
    });

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        const x = state.physics.width * (0.25 + Math.random() * 0.5);
        spawnBear(x, 110);
      } else if (e.key >= '1' && e.key <= '6') {
        const idx = parseInt(e.key, 10) - 1;
        const toolBtns = document.querySelectorAll('.tool-btn');
        if (toolBtns[idx]) toolBtns[idx].click();
      }
    });
  }

  // Draw Background Candy Grid & Interactive Tool Overlays
  function drawBackground(ctx, time) {
    const w = state.physics.width;
    const h = state.physics.height;

    // Subtle floating candy bokeh bubbles in background
    ctx.save();
    for (let i = 0; i < 8; i++) {
      const bx = ((i * 237 + time * 0.012 * (i % 2 === 0 ? 1 : -1)) % (w + 200)) - 100;
      const by = ((i * 173 + Math.sin(time * 0.001 + i) * 40) % h);
      const br = 45 + (i % 3) * 28;
      const grad = ctx.createRadialGradient(bx, by, 4, bx, by, br);
      grad.addColorStop(0, 'rgba(255, 190, 240, 0.045)');
      grad.addColorStop(1, 'rgba(255, 190, 240, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function applyVortexTool() {
    if (!state.pointer.isDown || state.activeTool !== 'vortex') return;
    const px = state.pointer.x;
    const py = state.pointer.y;

    for (const b of state.bears) {
      for (const node of b.nodes) {
        const dx = node.x - px;
        const dy = node.y - py;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < 280) {
          const strength = (1 - dist / 280) * 1.45;
          // Tangential swirl + gentle inward pull
          const tx = -dy / dist;
          const ty = dx / dist;
          node.vx += (tx * 2.2 - (dx / dist) * 0.65) * strength;
          node.vy += (ty * 2.2 - (dy / dist) * 0.65) * strength;
        }
      }
    }
  }

  function drawOverlays(ctx, time) {
    // Draw Vortex swirl visual
    if (state.pointer.isDown && state.activeTool === 'vortex') {
      ctx.save();
      ctx.translate(state.pointer.x, state.pointer.y);
      ctx.rotate(time * 0.008);
      for (let r = 28; r <= 140; r += 36) {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 1.35);
        ctx.strokeStyle = `rgba(0, 245, 212, ${0.48 - r / 340})`;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
      ctx.restore();
    }

    // Draw elastic stretch tether when grabbing a bear
    if (state.grabbed) {
      const { bear, nodeIndex, pointerX, pointerY } = state.grabbed;
      const node = bear.nodes[nodeIndex];
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(node.x, node.y);
      ctx.lineTo(pointerX, pointerY);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 6]);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(pointerX, pointerY, 7, 0, Math.PI * 2);
      ctx.fillStyle = bear.colorHex;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.restore();
    }

    // Shockwaves
    for (let i = state.shockwaves.length - 1; i >= 0; i--) {
      const sw = state.shockwaves[i];
      sw.r += (sw.maxR - sw.r) * 0.18;
      sw.alpha *= 0.88;
      if (sw.alpha < 0.03) {
        state.shockwaves.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
      ctx.strokeStyle = sw.color;
      ctx.globalAlpha = sw.alpha;
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.restore();
    }

    // Jelly Particles
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.25;
      p.alpha -= p.decay;
      if (p.alpha <= 0) {
        state.particles.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();

      // Tiny glossy dot on jelly droplet
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.beginPath();
      ctx.arc(p.x - p.r * 0.28, p.y - p.r * 0.28, p.r * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Main Simulation & Render Loop
  let lastFrameTime = performance.now();
  let frameCount = 0;
  let fpsTimer = performance.now();
  const fpsEl = document.getElementById('fps-counter');

  function animate(now) {
    frameCount++;
    if (now - fpsTimer >= 500) {
      state.fps = Math.min(60, Math.round((frameCount * 1000) / (now - fpsTimer)));
      if (fpsEl) fpsEl.textContent = state.fps;
      frameCount = 0;
      fpsTimer = now;
    }
    lastFrameTime = now;

    ctx.clearRect(0, 0, state.physics.width, state.physics.height);
    drawBackground(ctx, now);

    applyVortexTool();

    // Run 3 physics substeps per frame for crisp, stable soft-body jelly
    const substeps = 3;
    const subDt = 1.0 / substeps;
    for (let s = 0; s < substeps; s++) {
      for (let i = 0; i < state.bears.length; i++) {
        state.bears[i].step(subDt, state.physics, state.grabbed);
      }
      window.resolveBearCollisions(state.bears, state.physics.bounce);
    }

    // Draw all Gummy Bears
    for (let i = 0; i < state.bears.length; i++) {
      state.bears[i].draw(ctx, now);
    }

    drawOverlays(ctx, now);

    requestAnimationFrame(animate);
  }

  // Initialize Playground with a Trio of Colorful Starter Gummy Bears
  initFlavorGrid();
  bindUIControls();

  const startW = state.physics.width;
  const starterFlavors = [window.FLAVORS[0], window.FLAVORS[1], window.FLAVORS[2], window.FLAVORS[3], window.FLAVORS[4]];
  starterFlavors.forEach((flv, i) => {
    setTimeout(() => {
      const offset = (i - 2) * 115;
      spawnBear(startW * 0.5 + offset, 130 + (i % 2) * 45, {
        flavor: flv,
        colorHex: flv.hex,
        scale: i === 2 ? 1.18 : 0.96
      });
    }, i * 120);
  });

  requestAnimationFrame(animate);
})();
