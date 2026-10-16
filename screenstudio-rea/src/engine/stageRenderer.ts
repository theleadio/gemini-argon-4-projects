import {
  CameraLayoutMode,
  SSStudioProject,
} from '../types/project';
import { WALLPAPER_CATALOG } from '../data/catalog';
import {
  EvaluatedCameraZoom,
  EvaluatedCursorState,
  evaluateCursorAtTime,
  evaluateZoomAtTime,
  SPRING_PRESETS,
} from './springPhysics';

export interface StageRenderContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  project: SSStudioProject;
  timeMs: number;
  screenVideoEl?: HTMLVideoElement | null;
  webcamVideoEl?: HTMLVideoElement | null;
  selectedMaskId?: string | null;
  selectedZoomId?: string | null;
  showGizmos?: boolean;
}

export interface StageMetrics {
  cursor: EvaluatedCursorState;
  zoom: EvaluatedCameraZoom;
  activeLayout: CameraLayoutMode;
  activeSliceSpeed: number;
  screenRect: { x: number; y: number; w: number; h: number };
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function renderStageFrame(params: StageRenderContext): StageMetrics {
  const {
    ctx,
    width,
    height,
    project,
    timeMs,
    screenVideoEl,
    webcamVideoEl,
    selectedMaskId,
    selectedZoomId,
    showGizmos = true,
  } = params;

  const {
    stageConfig,
    cursorConfig,
    cameraConfig,
    captionsConfig,
    zooms,
    masks,
    captions,
    cameraLayouts,
    slices,
    cursorEvents,
    durationMs,
  } = project;

  const activeSpring =
    SPRING_PRESETS[cursorConfig.springPreset] ?? cursorConfig.customSpring;

  const cursor = evaluateCursorAtTime(
    cursorEvents,
    timeMs,
    durationMs,
    activeSpring,
    {
      hideWhenIdle: cursorConfig.hideWhenIdle,
      loopCursorPosition: cursorConfig.loopCursorPosition,
    }
  );

  const zoom = evaluateZoomAtTime(zooms, cursorEvents, timeMs, activeSpring);

  const activeLayoutBlock = cameraLayouts.find(
    (b) => timeMs >= b.startMs && timeMs <= b.endMs
  );
  const activeLayout: CameraLayoutMode = cameraConfig.enabled
    ? activeLayoutBlock?.layout ?? cameraConfig.defaultLayout
    : 'hidden';

  const activeSlice = slices.find(
    (s) => timeMs >= s.startMs && timeMs <= s.endMs
  );
  const activeSliceSpeed = activeSlice?.speed ?? 1.0;

  ctx.save();
  ctx.clearRect(0, 0, width, height);

  // 1. Render Wallpaper Background
  const wallpaper =
    WALLPAPER_CATALOG.find((w) => w.id === stageConfig.wallpaperId) ??
    WALLPAPER_CATALOG[0];

  const rad = (wallpaper.angle * Math.PI) / 180;
  const gx = Math.cos(rad) * width;
  const gy = Math.sin(rad) * height;
  const bgGrad = ctx.createLinearGradient(0, 0, gx, gy);
  bgGrad.addColorStop(0, wallpaper.stops[0]);
  bgGrad.addColorStop(0.52, wallpaper.stops[1]);
  bgGrad.addColorStop(1, wallpaper.stops[2]);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Soft mesh accent orb in background
  const meshGrad = ctx.createRadialGradient(
    width * 0.78,
    height * 0.22,
    width * 0.02,
    width * 0.78,
    height * 0.22,
    width * 0.55
  );
  meshGrad.addColorStop(0, `${wallpaper.meshAccent}44`);
  meshGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = meshGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Compute Screen Frame Geometry inside Stage Padding
  const padX = width * stageConfig.paddingRatio;
  const padY = height * stageConfig.paddingRatio;
  let availW = width - padX * 2;
  const availH = height - padY * 2;
  let offsetX = padX;

  if (activeLayout === 'split-screen') {
    availW = (width - padX * 2.4) * 0.68;
    offsetX = padX;
  }

  const targetFrameAspect =
    stageConfig.deviceFrame === 'iphone-16-pro'
      ? 9 / 19.5
      : stageConfig.deviceFrame === 'ipad-pro-m4'
      ? 4 / 3
      : 16 / 10;
  let screenW = availW;
  let screenH = screenW / targetFrameAspect;
  if (screenH > availH) {
    screenH = availH;
    screenW = screenH * targetFrameAspect;
  }
  const screenX =
    activeLayout === 'split-screen'
      ? offsetX
      : (width - screenW) / 2;
  const screenY = (height - screenH) / 2;

  // 3. Apply Camera Zoom Transform (unless Glass Loupe mode is active)
  ctx.save();
  const isFullZoom = !zoom.glassLoupe && zoom.scale > 1.002;
  if (isFullZoom) {
    const focusPxX = screenX + zoom.centerX * screenW;
    const focusPxY = screenY + zoom.centerY * screenH;

    // Optional directional zoom motion blur ghost pass
    if (cursorConfig.motionBlurZoom > 0.05 && zoom.velocityPan > 0.04) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.26, zoom.velocityPan * cursorConfig.motionBlurZoom * 0.45);
      const blurScale = 1 + (zoom.scale - 1) * 0.94;
      ctx.translate(width / 2, height / 2);
      ctx.scale(blurScale, blurScale);
      ctx.translate(-focusPxX, -focusPxY);
      drawScreenWindowAndContent(
        ctx,
        screenX,
        screenY,
        screenW,
        screenH,
        project,
        timeMs,
        cursor,
        screenVideoEl
      );
      ctx.restore();
    }

    ctx.translate(width / 2, height / 2);
    ctx.scale(zoom.scale, zoom.scale);
    ctx.translate(-focusPxX, -focusPxY);
  }

  // Adaptive Video Border Glow (`videoBorderColors` / `StageGlowMap`)
  if (stageConfig.useAdaptiveBorderGlow) {
    ctx.save();
    const glowColors = project.recordingSource.videoBorderColors;
    const glowGrad = ctx.createLinearGradient(
      screenX,
      screenY,
      screenX + screenW,
      screenY + screenH
    );
    glowGrad.addColorStop(0, `${glowColors[0]}66`);
    glowGrad.addColorStop(0.5, `${glowColors[1]}66`);
    glowGrad.addColorStop(1, `${glowColors[2]}66`);
    ctx.shadowColor = glowColors[1];
    ctx.shadowBlur = Math.max(28, width * 0.045);
    ctx.fillStyle = glowGrad;
    roundRectPath(
      ctx,
      screenX - 4,
      screenY - 4,
      screenW + 8,
      screenH + 8,
      stageConfig.cornerRadiusPx + 4
    );
    ctx.fill();
    ctx.restore();
  }

  // Draw Window / Device Frame + Screen Content + Masks + Cursor
  if (activeLayout !== 'fullscreen') {
    drawScreenWindowAndContent(
      ctx,
      screenX,
      screenY,
      screenW,
      screenH,
      project,
      timeMs,
      cursor,
      screenVideoEl
    );

    // Draw Active Privacy Masks (`MaskBlock`)
    for (const mask of masks) {
      const isSelectedMask = showGizmos && selectedMaskId === mask.id;
      const isActiveAtTime = timeMs >= mask.startMs && timeMs <= mask.endMs;
      if (isActiveAtTime || isSelectedMask) {
        const shiftOffset = mask.trackShift
          ? Math.sin(timeMs / 950) * 0.012
          : 0;
        const mx = screenX + mask.x * screenW;
        const my = screenY + (mask.y + shiftOffset) * screenH;
        const mw = mask.width * screenW;
        const mh = mask.height * screenH;

        ctx.save();
        if (!isActiveAtTime) {
          ctx.globalAlpha = 0.55;
        }
        roundRectPath(ctx, mx, my, mw, mh, 8);
        ctx.clip();

        if (mask.style === 'solid') {
          ctx.fillStyle = '#0B0C0E';
          ctx.fillRect(mx, my, mw, mh);
        } else if (mask.style === 'pixelate') {
          const cell = Math.max(6, Math.round(mask.intensity * 0.8));
          for (let py = my; py < my + mh; py += cell) {
            for (let px = mx; px < mx + mw; px += cell) {
              const shade = ((Math.floor(px / cell) + Math.floor(py / cell)) % 2) === 0
                ? 'rgba(30, 41, 59, 0.92)'
                : 'rgba(51, 65, 85, 0.92)';
              ctx.fillStyle = shade;
              ctx.fillRect(px, py, cell, cell);
            }
          }
        } else {
          // Frosted blur redaction surface
          ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
          ctx.fillRect(mx, my, mw, mh);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
          ctx.lineWidth = 1;
          ctx.strokeRect(mx + 0.5, my + 0.5, mw - 1, mh - 1);
        }

        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = `500 ${Math.max(9, Math.round(screenW * 0.012))}px "JetBrains Mono", monospace`;
        ctx.fillText(`REDACTED · ${mask.label}`, mx + 8, my + mh / 2 + 4);
        ctx.restore();

        if (isSelectedMask) {
          ctx.save();
          ctx.strokeStyle = '#F59E0B';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 4]);
          roundRectPath(ctx, mx - 2, my - 2, mw + 4, mh + 4, 9);
          ctx.stroke();
          ctx.setLineDash([]);

          // Draw 4 interactive corner resize handles
          const corners = [
            [mx, my],
            [mx + mw, my],
            [mx, my + mh],
            [mx + mw, my + mh],
          ];
          for (const [hx, hy] of corners) {
            ctx.fillStyle = '#F59E0B';
            ctx.strokeStyle = '#0B0C0E';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(hx, hy, 5.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
          ctx.restore();
        }
      }
    }

    // Draw Spring-Smoothed Cursor (`evaluateCursorAtTime`)
    drawSpringCursor(
      ctx,
      screenX,
      screenY,
      screenW,
      screenH,
      cursor,
      cursorConfig.sizeScale,
      cursorConfig.clickRipple,
      cursorConfig.highlightCursor,
      cursorConfig.motionBlurCursor
    );
  }

  ctx.restore(); // End full-screen camera zoom transform

  // 4. Glass Loupe Zoom Mode (`Glass Loupe zoom` from D8qyO3i92.js)
  if (zoom.glassLoupe && zoom.scale > 1.04 && activeLayout !== 'fullscreen') {
    const loupeCenterX = screenX + zoom.centerX * screenW;
    const loupeCenterY = screenY + zoom.centerY * screenH;
    const loupeRadius = Math.min(screenW, screenH) * 0.24;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = 32;
    ctx.shadowOffsetY = 12;
    ctx.beginPath();
    ctx.arc(loupeCenterX, loupeCenterY, loupeRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#0B0C0E';
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(loupeCenterX, loupeCenterY, loupeRadius, 0, Math.PI * 2);
    ctx.clip();

    ctx.translate(loupeCenterX, loupeCenterY);
    ctx.scale(zoom.scale, zoom.scale);
    ctx.translate(-loupeCenterX, -loupeCenterY);

    drawScreenWindowAndContent(
      ctx,
      screenX,
      screenY,
      screenW,
      screenH,
      project,
      timeMs,
      cursor,
      screenVideoEl
    );
    drawSpringCursor(
      ctx,
      screenX,
      screenY,
      screenW,
      screenH,
      cursor,
      cursorConfig.sizeScale,
      cursorConfig.clickRipple,
      cursorConfig.highlightCursor,
      0
    );
    ctx.restore();

    // Specular glass rim around Loupe
    ctx.save();
    ctx.beginPath();
    ctx.arc(loupeCenterX, loupeCenterY, loupeRadius, 0, Math.PI * 2);
    const rimGrad = ctx.createLinearGradient(
      loupeCenterX - loupeRadius,
      loupeCenterY - loupeRadius,
      loupeCenterX + loupeRadius,
      loupeCenterY + loupeRadius
    );
    rimGrad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
    rimGrad.addColorStop(0.5, 'rgba(99, 102, 241, 0.55)');
    rimGrad.addColorStop(1, 'rgba(255, 255, 255, 0.2)');
    ctx.strokeStyle = rimGrad;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }

  // 5. Draw Manual Zoom Target Gizmo if a manual zoom block is selected
  if (showGizmos && selectedZoomId) {
    const selZoom = zooms.find((z) => z.id === selectedZoomId);
    if (selZoom) {
      const zx = screenX + selZoom.targetX * screenW;
      const zy = screenY + selZoom.targetY * screenH;
      ctx.save();
      ctx.strokeStyle = '#6366F1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(zx, zy, 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(zx - 20, zy);
      ctx.lineTo(zx + 20, zy);
      ctx.moveTo(zx, zy - 20);
      ctx.lineTo(zx, zy + 20);
      ctx.stroke();
      ctx.restore();
    }
  }

  // 6. Draw Webcam Overlay (`ProjectCameraConfig` + `activeLayout`)
  if (activeLayout !== 'hidden') {
    drawWebcamOverlay(
      ctx,
      width,
      height,
      screenX,
      screenY,
      screenW,
      screenH,
      project,
      activeLayout,
      timeMs,
      webcamVideoEl
    );
  }

  // 7. Draw Floating Keystroke HUD Pill if active
  if (cursor.activeKeystroke) {
    drawKeystrokePill(ctx, width, height, cursor.activeKeystroke);
  }

  // 8. Draw Timed Captions Overlay (`ProjectCaptionsConfig`)
  if (captionsConfig.enabled) {
    const activeCaption = captions.find(
      (c) => timeMs >= c.startMs && timeMs <= c.endMs
    );
    if (activeCaption) {
      drawCaptionOverlay(
        ctx,
        width,
        height,
        activeCaption.text,
        activeCaption.type === 'sound-label',
        (timeMs - activeCaption.startMs) /
          Math.max(1, activeCaption.endMs - activeCaption.startMs),
        captionsConfig.positionY,
        captionsConfig.fontSizeScale,
        captionsConfig.style
      );
    }
  }

  ctx.restore();

  return {
    cursor,
    zoom,
    activeLayout,
    activeSliceSpeed,
    screenRect: { x: screenX, y: screenY, w: screenW, h: screenH },
  };
}

function drawScreenWindowAndContent(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  project: SSStudioProject,
  timeMs: number,
  cursor: EvaluatedCursorState,
  screenVideoEl?: HTMLVideoElement | null
) {
  const { stageConfig } = project;
  const radius = stageConfig.deviceFrame === 'none' ? 0 : stageConfig.cornerRadiusPx;

  // Drop shadow
  if (stageConfig.shadowIntensity > 0) {
    ctx.save();
    ctx.shadowColor = `rgba(0, 0, 0, ${0.72 * stageConfig.shadowIntensity})`;
    ctx.shadowBlur = 44 * stageConfig.shadowIntensity;
    ctx.shadowOffsetY = 18 * stageConfig.shadowIntensity;
    ctx.fillStyle = '#0D0F14';
    roundRectPath(ctx, x, y, w, h, radius);
    ctx.fill();
    ctx.restore();
  }

  // Inset bezel if configured
  ctx.save();
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.clip();

  ctx.fillStyle = '#0D0F14';
  ctx.fillRect(x, y, w, h);

  const headerH =
    stageConfig.deviceFrame === 'macos-window' ||
    stageConfig.deviceFrame === 'macbook-pro-16'
      ? Math.max(24, Math.round(h * 0.056))
      : 0;

  // macOS Window Titlebar & Traffic Lights
  if (headerH > 0) {
    const barGrad = ctx.createLinearGradient(x, y, x, y + headerH);
    barGrad.addColorStop(0, '#181B22');
    barGrad.addColorStop(1, '#12141A');
    ctx.fillStyle = barGrad;
    ctx.fillRect(x, y, w, headerH);

    const dotR = Math.max(4, Math.round(headerH * 0.18));
    const dotY = y + headerH / 2;
    const colors = ['#FF5F56', '#FFBD2E', '#27C93F'];
    colors.forEach((col, i) => {
      ctx.beginPath();
      ctx.arc(x + 16 + i * (dotR * 3.1), dotY, dotR, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
    });

    // Window title
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.font = `500 ${Math.max(10, Math.round(headerH * 0.38))}px "Inter", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(project.recordingSource.name, x + w / 2, dotY + 4);
    ctx.textAlign = 'left';

    // Hairline bottom divider
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(x, y + headerH - 1, w, 1);
  }

  const contentY = y + headerH;
  const contentH = h - headerH;

  if (screenVideoEl && screenVideoEl.videoWidth > 0 && screenVideoEl.readyState >= 2) {
    ctx.drawImage(screenVideoEl, x, contentY, w, contentH);
  } else if (project.isDemoProject) {
    drawInteractiveSimulatedAppSurface(
      ctx,
      x,
      contentY,
      w,
      contentH,
      project,
      timeMs,
      cursor
    );
  } else {
    drawCleanLiveCaptureCanvas(
      ctx,
      x,
      contentY,
      w,
      contentH,
      project,
      timeMs,
      cursor
    );
  }

  // Subtle inner glass rim
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 1.5;
  roundRectPath(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, radius);
  ctx.stroke();

  ctx.restore();
}

/**
 * Clean user recording canvas when `isDemoProject` is false and OS ScreenCaptureKit
 * video frames are not attached (or permission is pending).
 */
function drawCleanLiveCaptureCanvas(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  project: SSStudioProject,
  timeMs: number,
  cursor: EvaluatedCursorState
) {
  ctx.save();
  ctx.fillStyle = '#0B0D13';
  ctx.fillRect(x, y, w, h);

  // Subtle dot-matrix grid
  const step = Math.max(24, Math.round(w * 0.035));
  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
  for (let gx = x + step; gx < x + w; gx += step) {
    for (let gy = y + step; gy < y + h; gy += step) {
      ctx.fillRect(gx, gy, 1.5, 1.5);
    }
  }

  // Draw recorded cursor trajectory path up to timeMs
  const pastEvents = project.cursorEvents.filter((e) => e.timeMs <= timeMs);
  if (pastEvents.length > 1) {
    ctx.beginPath();
    pastEvents.forEach((ev, idx) => {
      const px = x + ev.x * w;
      const py = y + ev.y * h;
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.38)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Draw recorded click waypoints
  project.cursorEvents
    .filter((e) => e.type === 'click' && e.timeMs <= timeMs)
    .forEach((ev, idx) => {
      const px = x + ev.x * w;
      const py = y + ev.y * h;
      ctx.beginPath();
      ctx.arc(px, py, 8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(99, 102, 241, 0.28)';
      ctx.fill();
      ctx.strokeStyle = '#818CF8';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#E2E8F0';
      ctx.font = `600 ${Math.max(9, Math.round(w * 0.011))}px "JetBrains Mono", monospace`;
      ctx.fillText(`#${idx + 1}`, px + 11, py + 4);
    });

  // Center status watermark
  const fontTitle = Math.max(13, Math.round(w * 0.018));
  const fontSub = Math.max(10, Math.round(w * 0.0125));
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
  ctx.font = `600 ${fontTitle}px "Inter", sans-serif`;
  ctx.fillText(
    `Live Session · ${project.recordingSource.name}`,
    x + w / 2,
    y + h * 0.45
  );

  ctx.fillStyle = 'rgba(148, 163, 184, 0.72)';
  ctx.font = `400 ${fontSub}px "JetBrains Mono", monospace`;
  ctx.fillText(
    `Move & click anywhere on this stage to record spring cursor & auto-zoom keyframes · (${cursor.x.toFixed(
      2
    )}, ${cursor.y.toFixed(2)})`,
    x + w / 2,
    y + h * 0.52
  );
  ctx.textAlign = 'left';

  ctx.restore();
}

/**
 * Renders a rich, high-resolution interactive technical workspace inside the simulated recording
 * so the user immediately sees Screen Studio's auto-zoom, cursor physics, mask redaction,
 * and audio waveform sync in action even before recording their own screen.
 */
function drawInteractiveSimulatedAppSurface(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  project: SSStudioProject,
  timeMs: number,
  cursor: EvaluatedCursorState
) {
  ctx.save();
  ctx.fillStyle = '#0A0C10';
  ctx.fillRect(x, y, w, h);

  // Left navigation rail
  const sidebarW = w * 0.22;
  ctx.fillStyle = '#10131A';
  ctx.fillRect(x, y, sidebarW, h);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(x + sidebarW - 1, y, 1, h);

  const fontSm = Math.max(9, Math.round(w * 0.0125));
  const fontMd = Math.max(11, Math.round(w * 0.015));
  const fontLg = Math.max(13, Math.round(w * 0.019));

  ctx.fillStyle = '#6366F1';
  ctx.font = `600 ${fontSm}px "JetBrains Mono", monospace`;
  ctx.fillText('REA ARTIFACT GRAPH', x + w * 0.018, y + h * 0.07);

  const navItems = [
    { label: 'open_binary (Mach-O)', active: timeMs < 5500 },
    { label: 'polyrecorder-prod.hop', active: timeMs >= 5500 && timeMs < 11000 },
    { label: 'native-audio.node (MLX)', active: timeMs >= 11000 },
    { label: 'SpringSolver (125 / 12)', active: false },
    { label: 'WebCodecs VideoEncoder', active: false },
  ];

  navItems.forEach((item, idx) => {
    const iy = y + h * (0.12 + idx * 0.09);
    if (item.active) {
      ctx.fillStyle = 'rgba(99, 102, 241, 0.18)';
      roundRectPath(ctx, x + w * 0.012, iy - h * 0.032, sidebarW - w * 0.024, h * 0.065, 6);
      ctx.fill();
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.45)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.fillStyle = item.active ? '#F8FAFC' : 'rgba(255,255,255,0.52)';
    ctx.font = `500 ${fontSm}px "JetBrains Mono", monospace`;
    ctx.fillText(item.label, x + w * 0.024, iy + 3);
  });

  // Top status strip inside recorded app (includes API key area that Mask #1 redacts!)
  const mainX = x + sidebarW + w * 0.025;
  const mainW = w - sidebarW - w * 0.05;

  ctx.fillStyle = '#141821';
  roundRectPath(ctx, mainX, y + h * 0.04, mainW, h * 0.11, 8);
  ctx.fill();

  ctx.fillStyle = '#E2E8F0';
  ctx.font = `600 ${fontMd}px "Inter", sans-serif`;
  ctx.fillText('Target: /Applications/Screen Studio.app (v4.0.4-4926)', mainX + 14, y + h * 0.105);

  // Sensitive token area (covered by Mask #1 between 2.0s and 9.5s)
  ctx.fillStyle = '#F59E0B';
  ctx.font = `500 ${fontSm}px "JetBrains Mono", monospace`;
  ctx.fillText('TEAM_ID=SXF593CX2N · TOKEN=sk_live_98f2a4c', x + w * 0.63, y + h * 0.105);

  // Card 1: Spring Physics & Polyrecorder Telemetry
  const cardY = y + h * 0.19;
  const cardH = h * 0.38;
  ctx.fillStyle = '#131722';
  roundRectPath(ctx, mainX, cardY, mainW * 0.48, cardH, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.stroke();

  ctx.fillStyle = '#94A3B8';
  ctx.font = `600 ${fontSm}px "JetBrains Mono", monospace`;
  ctx.fillText('POLYRECORDER NDJSON STREAM', mainX + 14, cardY + h * 0.065);

  const lines = [
    `{"channel":"display","fps":120,"scale":2.0}`,
    `{"cursor":{"x":${cursor.x.toFixed(3)},"y":${cursor.y.toFixed(3)}}}`,
    `{"spring":{"k":${project.cursorConfig.customSpring.stiffness},"c":${project.cursorConfig.customSpring.damping},"m":${project.cursorConfig.customSpring.mass}}}`,
    `{"audio":"MossFormer2_SE_48K + TF-Restormer"}`,
  ];
  lines.forEach((ln, idx) => {
    ctx.fillStyle = idx === 1 ? '#38BDF8' : '#CBD5E1';
    ctx.font = `400 ${fontSm}px "JetBrains Mono", monospace`;
    ctx.fillText(ln, mainX + 14, cardY + h * (0.14 + idx * 0.068));
  });

  // Card 2: Interactive Spring Response Curve inside simulated window
  const rightCardX = mainX + mainW * 0.51;
  const rightCardW = mainW * 0.49;
  ctx.fillStyle = '#131722';
  roundRectPath(ctx, rightCardX, cardY, rightCardW, cardH, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.35)';
  ctx.stroke();

  ctx.fillStyle = '#E2E8F0';
  ctx.font = `600 ${fontSm}px "JetBrains Mono", monospace`;
  ctx.fillText('DAMPED HARMONIC SPRING (Rme / Lme)', rightCardX + 14, cardY + h * 0.065);

  // Draw animated spring wave
  ctx.beginPath();
  const plotX = rightCardX + 16;
  const plotY = cardY + cardH * 0.72;
  const plotW = rightCardW - 32;
  const plotH = cardH * 0.46;
  for (let i = 0; i <= 60; i++) {
    const u = i / 60;
    const tSec = u * 0.8;
    const omega = Math.sqrt(project.cursorConfig.customSpring.stiffness / project.cursorConfig.customSpring.mass);
    const zeta = project.cursorConfig.customSpring.damping / (2 * Math.sqrt(project.cursorConfig.customSpring.stiffness * project.cursorConfig.customSpring.mass));
    const env = Math.exp(-zeta * omega * tSec);
    const resp = 1 - env * Math.cos(omega * Math.sqrt(Math.max(0.01, 1 - zeta * zeta)) * tSec);
    const px = plotX + u * plotW;
    const py = plotY - resp * plotH;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.strokeStyle = '#818CF8';
  ctx.lineWidth = 2.2;
  ctx.stroke();

  // Bottom Card: Audio Chain & MossFormer2 Visualizer
  const botY = y + h * 0.61;
  const botH = h * 0.33;
  ctx.fillStyle = '#131722';
  roundRectPath(ctx, mainX, botY, mainW, botH, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.stroke();

  ctx.fillStyle = '#10B981';
  ctx.font = `600 ${fontSm}px "JetBrains Mono", monospace`;
  ctx.fillText(
    'NATIVE-AUDIO.NODE · COREML MOSSFORMER2 (48KHZ) + APPLE MLX TF-RESTORMER',
    mainX + 14,
    botY + h * 0.065
  );

  // Animated spectrum bars
  const barCount = 42;
  const barStartX = mainX + 16;
  const barAvailW = mainW - 32;
  const barW = (barAvailW / barCount) * 0.64;
  for (let i = 0; i < barCount; i++) {
    const phase = timeMs * 0.008 + i * 0.42;
    const amp =
      0.22 +
      0.55 * Math.abs(Math.sin(phase) * Math.cos(phase * 0.55)) *
        (project.audioConfig.mossFormer2NoiseReduction ? 1.15 : 0.75);
    const bh = Math.min(botH * 0.58, amp * botH * 0.58);
    const bx = barStartX + i * (barAvailW / barCount);
    const by = botY + botH - 14 - bh;
    ctx.fillStyle = i % 3 === 0 ? '#6366F1' : '#10B981';
    roundRectPath(ctx, bx, by, barW, bh, 3);
    ctx.fill();
  }

  ctx.restore();
}

function drawSpringCursor(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  screenW: number,
  screenH: number,
  cursor: EvaluatedCursorState,
  sizeScale: number,
  clickRipple: boolean,
  highlightCursor: boolean,
  motionBlurCursor: number
) {
  if (cursor.opacity <= 0.01) return;

  const cx = screenX + cursor.x * screenW;
  const cy = screenY + cursor.y * screenH;
  const baseSize = Math.max(16, screenW * 0.022) * sizeScale;

  ctx.save();
  ctx.globalAlpha = cursor.opacity;

  // Highlight spotlight halo around cursor
  if (highlightCursor) {
    const haloR = baseSize * 2.1;
    const haloGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, haloR);
    haloGrad.addColorStop(0, 'rgba(250, 204, 21, 0.28)');
    haloGrad.addColorStop(1, 'rgba(250, 204, 21, 0)');
    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
    ctx.fill();
  }

  // Click Ripple Ring
  if (clickRipple && cursor.clickRippleProgress !== null) {
    const p = cursor.clickRippleProgress;
    const rippleR = baseSize * (0.6 + p * 2.4);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, rippleR, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(99, 102, 241, ${(1 - p) * 0.85})`;
    ctx.lineWidth = Math.max(2, (1 - p) * 4);
    ctx.stroke();
    ctx.restore();
  }

  // Directional Motion Blur Trail (`motionBlurCursor`)
  if (motionBlurCursor > 0.05 && cursor.speed > 0.15) {
    const steps = 4;
    for (let s = 1; s <= steps; s++) {
      const trailOffset = s * motionBlurCursor * 10;
      const tx = cx - Math.cos(cursor.angleRad) * trailOffset;
      const ty = cy - Math.sin(cursor.angleRad) * trailOffset;
      ctx.save();
      ctx.globalAlpha = cursor.opacity * (0.22 / s);
      drawMacOSCursorVector(ctx, tx, ty, baseSize, cursor.isPressed);
      ctx.restore();
    }
  }

  // Main Crisp macOS Cursor
  drawMacOSCursorVector(ctx, cx, cy, baseSize, cursor.isPressed);
  ctx.restore();
}

function drawMacOSCursorVector(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  isPressed: boolean
) {
  const pressScale = isPressed ? 0.84 : 1.0;
  const s = (size / 24) * pressScale;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);

  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;

  // Classic macOS pointer polygon (`assets/cursors/cursor-macos.svg`)
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 20.5);
  ctx.lineTo(4.8, 15.8);
  ctx.lineTo(8.5, 23.2);
  ctx.lineTo(11.4, 21.8);
  ctx.lineTo(7.8, 14.4);
  ctx.lineTo(14.2, 14.4);
  ctx.closePath();

  ctx.fillStyle = '#0B0C0E';
  ctx.fill();
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineJoin = 'round';
  ctx.stroke();

  ctx.restore();
}

function drawWebcamOverlay(
  ctx: CanvasRenderingContext2D,
  stageW: number,
  stageH: number,
  screenX: number,
  screenY: number,
  screenW: number,
  screenH: number,
  project: SSStudioProject,
  layout: CameraLayoutMode,
  timeMs: number,
  webcamVideoEl?: HTMLVideoElement | null
) {
  const { cameraConfig } = project;
  let camX = 0;
  let camY = 0;
  let camW = 0;
  let camH = 0;

  if (layout === 'fullscreen') {
    camW = stageW * 0.84;
    camH = stageH * 0.82;
    camX = (stageW - camW) / 2;
    camY = (stageH - camH) / 2;
  } else if (layout === 'split-screen') {
    const padX = stageW * project.stageConfig.paddingRatio;
    camW = (stageW - padX * 2.4) * 0.29;
    camH = screenH;
    camX = screenX + screenW + padX * 0.4;
    camY = screenY;
  } else {
    camW = Math.min(stageW, stageH) * cameraConfig.sizeRatio;
    camH = camW;
    const margin = Math.max(18, stageW * 0.025);
    if (layout === 'corner-br') {
      camX = screenX + screenW - camW - margin;
      camY = screenY + screenH - camH - margin;
    } else if (layout === 'corner-bl') {
      camX = screenX + margin;
      camY = screenY + screenH - camH - margin;
    } else {
      camX = screenX + screenW - camW - margin;
      camY = screenY + margin;
    }
  }

  const radius =
    layout === 'split-screen' || layout === 'fullscreen'
      ? project.stageConfig.cornerRadiusPx
      : Math.max(12, (Math.min(camW, camH) / 2) * cameraConfig.roundness * 2);

  ctx.save();
  if (cameraConfig.shadow > 0) {
    ctx.shadowColor = `rgba(0, 0, 0, ${0.68 * cameraConfig.shadow})`;
    ctx.shadowBlur = 28 * cameraConfig.shadow;
    ctx.shadowOffsetY = 10 * cameraConfig.shadow;
  }
  ctx.fillStyle = '#111318';
  roundRectPath(ctx, camX, camY, camW, camH, radius);
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRectPath(ctx, camX, camY, camW, camH, radius);
  ctx.clip();

  if (cameraConfig.mirror) {
    ctx.translate(camX + camW, camY);
    ctx.scale(-1, 1);
    ctx.translate(-camX, -camY);
  }

  if (webcamVideoEl && webcamVideoEl.readyState >= 2) {
    ctx.drawImage(webcamVideoEl, camX, camY, camW, camH);
  } else {
    // Stylized presenter studio view with ONNX PP-MattingV2 backdrop
    const backdropGrad = ctx.createLinearGradient(
      camX,
      camY,
      camX + camW,
      camY + camH
    );
    if (cameraConfig.aiMattingModel !== 'none') {
      backdropGrad.addColorStop(0, '#1e1b4b');
      backdropGrad.addColorStop(0.5, '#312e81');
      backdropGrad.addColorStop(1, '#0f172a');
    } else {
      backdropGrad.addColorStop(0, '#18181b');
      backdropGrad.addColorStop(1, '#27272a');
    }
    ctx.fillStyle = backdropGrad;
    ctx.fillRect(camX, camY, camW, camH);

    // Subtle speaking pulse halo
    const pulse = 1 + Math.sin(timeMs * 0.012) * 0.04;
    const cx = camX + camW / 2;
    const cy = camY + camH * 0.44;
    const headR = Math.min(camW, camH) * 0.19 * pulse;

    // Shoulders
    ctx.fillStyle = '#CBD5E1';
    ctx.beginPath();
    ctx.ellipse(
      cx,
      camY + camH * 0.92,
      Math.min(camW, camH) * 0.36,
      Math.min(camW, camH) * 0.28,
      0,
      Math.PI,
      0
    );
    ctx.fill();

    // Head silhouette
    ctx.beginPath();
    ctx.arc(cx, cy, headR, 0, Math.PI * 2);
    ctx.fillStyle = '#E2E8F0';
    ctx.fill();
  }

  ctx.restore();

  // Rim border + ONNX Matting badge when hovered/active
  ctx.save();
  roundRectPath(ctx, camX, camY, camW, camH, radius);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.24)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawKeystrokePill(
  ctx: CanvasRenderingContext2D,
  stageW: number,
  stageH: number,
  keystroke: string
) {
  ctx.save();
  const fontPx = Math.max(13, Math.round(stageW * 0.016));
  ctx.font = `600 ${fontPx}px "JetBrains Mono", monospace`;
  const textW = ctx.measureText(keystroke).width;
  const pillW = textW + 32;
  const pillH = fontPx + 18;
  const px = (stageW - pillW) / 2;
  const py = stageH * 0.11;

  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 18;
  ctx.fillStyle = 'rgba(15, 17, 23, 0.88)';
  roundRectPath(ctx, px, py, pillW, pillH, 10);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.fillStyle = '#F8FAFC';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(keystroke, stageW / 2, py + pillH / 2 + 1);
  ctx.restore();
}

function drawCaptionOverlay(
  ctx: CanvasRenderingContext2D,
  stageW: number,
  stageH: number,
  text: string,
  isSoundLabel: boolean,
  progress: number,
  positionY: number,
  fontSizeScale: number,
  style: 'glass-pill' | 'karaoke-highlight' | 'editorial-serif'
) {
  ctx.save();
  const baseFontPx = Math.max(14, Math.round(stageW * 0.0195 * fontSizeScale));
  ctx.font =
    style === 'editorial-serif'
      ? `italic 400 ${Math.round(baseFontPx * 1.18)}px "Instrument Serif", Georgia, serif`
      : `600 ${baseFontPx}px "Inter", sans-serif`;

  const words = text.split(' ');
  const activeWordIdx = Math.min(
    words.length - 1,
    Math.floor(progress * words.length)
  );

  const fullWidth = ctx.measureText(text).width;
  const boxW = Math.min(stageW * 0.86, fullWidth + 36);
  const boxH = baseFontPx + 22;
  const bx = (stageW - boxW) / 2;
  const by = stageH * positionY - boxH / 2;

  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = 20;
  ctx.fillStyle = isSoundLabel
    ? 'rgba(16, 185, 129, 0.22)'
    : 'rgba(11, 12, 16, 0.82)';
  roundRectPath(ctx, bx, by, boxW, boxH, 999);
  ctx.fill();

  ctx.strokeStyle = isSoundLabel
    ? 'rgba(16, 185, 129, 0.55)'
    : 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textBaseline = 'middle';
  if (style === 'karaoke-highlight' && !isSoundLabel && words.length > 1) {
    let cursorX = (stageW - fullWidth) / 2;
    const centerY = by + boxH / 2 + 1;
    words.forEach((word, idx) => {
      const wWithSpace = idx < words.length - 1 ? `${word} ` : word;
      const wLen = ctx.measureText(wWithSpace).width;
      if (idx === activeWordIdx) {
        ctx.fillStyle = 'rgba(99, 102, 241, 0.35)';
        roundRectPath(
          ctx,
          cursorX - 4,
          centerY - baseFontPx * 0.62,
          ctx.measureText(word).width + 8,
          baseFontPx * 1.24,
          6
        );
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
      } else if (idx < activeWordIdx) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.52)';
      }
      ctx.textAlign = 'left';
      ctx.fillText(word, cursorX, centerY);
      cursorX += wLen;
    });
  } else {
    ctx.fillStyle = isSoundLabel ? '#6EE7B7' : '#F8FAFC';
    ctx.textAlign = 'center';
    ctx.fillText(text, stageW / 2, by + boxH / 2 + 1);
  }

  ctx.restore();
}
