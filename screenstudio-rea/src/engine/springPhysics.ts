import {
  CursorTelemetryEvent,
  SpringParams,
  SpringPresetName,
  ZoomBlock,
} from '../types/project';

/**
 * Exact spring presets reconstructed from Screen Studio's spring configuration
 * (`vP = { stiffness: 0x7d (125), damping: 0xc (12), mass: 1.5, clamp: true, precision: 0.002 }`).
 */
export const SPRING_PRESETS: Record<SpringPresetName, SpringParams> = {
  rapid: {
    stiffness: 260,
    damping: 20,
    mass: 1.0,
    clamp: true,
    precision: 0.002,
  },
  quick: {
    stiffness: 180,
    damping: 15,
    mass: 1.2,
    clamp: true,
    precision: 0.002,
  },
  default: {
    stiffness: 125, // 0x7d in dist-electron/index.js
    damping: 12, // 0xc in dist-electron/index.js
    mass: 1.5,
    clamp: true,
    precision: 0.002,
  },
  mellow: {
    stiffness: 85,
    damping: 12,
    mass: 1.8,
    clamp: true,
    precision: 0.002,
  },
  slow: {
    stiffness: 52,
    damping: 10,
    mass: 2.2,
    clamp: true,
    precision: 0.002,
  },
};

/**
 * Reconstructed from `Lme({ stiffness, damping, mass })` in `dist-electron/index.js`.
 * Determines stable integration timestep in milliseconds (16.666ms vs 1ms sub-stepping).
 */
export function computeSpringStepMs({ stiffness, damping, mass }: SpringParams): number {
  const frameMs = 1000 / 60;
  const omega = Math.sqrt(stiffness / mass);
  const dampingRatio = damping / mass;
  return (frameMs / 1000) * Math.max(omega, dampingRatio) <= 0.5 ? frameMs : 1;
}

/**
 * Reconstructed from `Rme(dtMs, current, velocity, target, stiffness, damping, mass, clamp, precision)`
 * in `dist-electron/index.js`.
 */
export function stepSpring1D(
  dtMs: number,
  current: number,
  velocity: number,
  target: number,
  params: SpringParams
): [number, number] {
  const dt = dtMs / 1000;
  const springForce = -(current - target) * params.stiffness;
  const dampingForce = -velocity * params.damping;
  const acceleration = (springForce + dampingForce) / params.mass;

  let nextVelocity = velocity + acceleration * dt;
  let nextPosition = current + nextVelocity * dt;

  if (params.clamp) {
    const overshot =
      (current < target && nextPosition > target) ||
      (current > target && nextPosition < target);
    if (overshot) {
      nextPosition = target;
      nextVelocity = 0;
    }
  }

  const dist = Math.abs(nextPosition - target);
  if (Math.abs(nextVelocity) < params.precision && dist < params.precision) {
    return [target, 0];
  }
  return [nextPosition, nextVelocity];
}

/**
 * Computes unit step response curve (0 -> 1) and settling duration (`Bme` in `dist-electron/index.js`)
 * for UI visualization in the Inspector.
 */
export function computeSpringCurve(params: SpringParams, durationMs = 1200, samples = 80): {
  points: { tMs: number; value: number }[];
  settlingMs: number;
} {
  if (params.mass <= 0) {
    return { points: [{ tMs: 0, value: 1 }], settlingMs: 0 };
  }
  const dtMs = computeSpringStepMs(params);
  let pos = 0;
  let vel = 0;
  let settlingMs = durationMs;
  let settled = false;

  const sampleInterval = durationMs / samples;
  const points: { tMs: number; value: number }[] = [{ tMs: 0, value: 0 }];
  let nextSampleAt = sampleInterval;

  for (let t = dtMs; t <= durationMs; t += dtMs) {
    [pos, vel] = stepSpring1D(dtMs, pos, vel, 1, params);
    if (!settled && pos === 1 && vel === 0) {
      settlingMs = Math.round(t);
      settled = true;
    }
    if (t >= nextSampleAt) {
      points.push({ tMs: Math.round(t), value: pos });
      nextSampleAt += sampleInterval;
    }
  }

  return { points, settlingMs };
}

export interface EvaluatedCursorState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  angleRad: number;
  isPressed: boolean;
  clickRippleProgress: number | null; // 0..1 when recent click occurred
  cursorShape: 'arrow' | 'pointer' | 'ibeam';
  opacity: number;
  activeKeystroke: string | null;
}

/**
 * Evaluates raw InputRecorder telemetry (`CursorTelemetryEvent[]`) through Screen Studio's
 * spring-damper filter up to `timeMs`, including idle-hiding, loop-back, click scale/ripple,
 * and velocity vectors for directional motion blur.
 */
export function evaluateCursorAtTime(
  events: CursorTelemetryEvent[],
  timeMs: number,
  totalDurationMs: number,
  params: SpringParams,
  options: { hideWhenIdle: boolean; loopCursorPosition: boolean }
): EvaluatedCursorState {
  if (events.length === 0) {
    return {
      x: 0.5,
      y: 0.5,
      vx: 0,
      vy: 0,
      speed: 0,
      angleRad: 0,
      isPressed: false,
      clickRippleProgress: null,
      cursorShape: 'arrow',
      opacity: 1,
      activeKeystroke: null,
    };
  }

  const firstEvent = events[0];
  let x = firstEvent.x;
  let y = firstEvent.y;
  let vx = 0;
  let vy = 0;

  // Step in 8ms increments for deterministic real-time scrubbing
  const stepMs = 8;
  let eventIdx = 0;
  let targetX = firstEvent.x;
  let targetY = firstEvent.y;
  let cursorShape: 'arrow' | 'pointer' | 'ibeam' = firstEvent.cursorShape;
  let isPressed = false;
  let lastClickMs = -9999;
  let lastMoveMs = 0;
  let activeKeystroke: string | null = null;
  let lastKeystrokeMs = -9999;

  const clampedTime = Math.max(0, Math.min(timeMs, totalDurationMs));

  for (let t = 0; t <= clampedTime; t += stepMs) {
    while (eventIdx < events.length && events[eventIdx].timeMs <= t) {
      const ev = events[eventIdx];
      targetX = ev.x;
      targetY = ev.y;
      cursorShape = ev.cursorShape;
      if (ev.type === 'move') {
        lastMoveMs = ev.timeMs;
      } else if (ev.type === 'mousedown' || ev.type === 'click') {
        isPressed = true;
        lastClickMs = ev.timeMs;
        lastMoveMs = ev.timeMs;
      } else if (ev.type === 'mouseup') {
        isPressed = false;
      } else if (ev.type === 'keystroke' && ev.keystroke) {
        activeKeystroke = ev.keystroke;
        lastKeystrokeMs = ev.timeMs;
      }
      eventIdx++;
    }

    // Loop cursor back to start position over final 900ms if enabled
    let effectiveTargetX = targetX;
    let effectiveTargetY = targetY;
    if (options.loopCursorPosition && totalDurationMs - t < 900) {
      effectiveTargetX = firstEvent.x;
      effectiveTargetY = firstEvent.y;
    }

    // Auto-release click press after 180ms if only a discrete 'click' event was logged
    if (isPressed && t - lastClickMs > 180) {
      isPressed = false;
    }

    [x, vx] = stepSpring1D(stepMs, x, vx, effectiveTargetX, params);
    [y, vy] = stepSpring1D(stepMs, y, vy, effectiveTargetY, params);
  }

  const speed = Math.hypot(vx, vy);
  const angleRad = Math.atan2(vy, vx);
  const timeSinceClick = clampedTime - lastClickMs;
  const clickRippleProgress =
    timeSinceClick >= 0 && timeSinceClick <= 520 ? timeSinceClick / 520 : null;

  let opacity = 1;
  if (options.hideWhenIdle) {
    const idleFor = clampedTime - lastMoveMs;
    if (idleFor > 1800) {
      opacity = Math.max(0, 1 - (idleFor - 1800) / 350);
    }
  }

  if (clampedTime - lastKeystrokeMs > 1100) {
    activeKeystroke = null;
  }

  return {
    x,
    y,
    vx,
    vy,
    speed,
    angleRad,
    isPressed,
    clickRippleProgress,
    cursorShape,
    opacity,
    activeKeystroke,
  };
}

export interface EvaluatedCameraZoom {
  scale: number;
  centerX: number; // normalized 0..1
  centerY: number; // normalized 0..1
  velocityScale: number;
  velocityPan: number;
  activeBlock: ZoomBlock | null;
  glassLoupe: boolean;
}

/**
 * Evaluates the camera zoom & pan state (`containInZoomArea` / `getBoundsAtTime` in `BEy_VAkj.js`)
 * using Screen Studio's spring physics across all timeline `ZoomBlock`s.
 */
export function evaluateZoomAtTime(
  zooms: ZoomBlock[],
  cursorEvents: CursorTelemetryEvent[],
  timeMs: number,
  defaultSpring: SpringParams
): EvaluatedCameraZoom {
  let scale = 1;
  let vScale = 0;
  let centerX = 0.5;
  let vCenterX = 0;
  let centerY = 0.5;
  let vCenterY = 0;

  const stepMs = 16;
  let activeBlock: ZoomBlock | null = null;
  let eventIdx = 0;
  let latestCursorX = 0.5;
  let latestCursorY = 0.5;

  for (let t = 0; t <= timeMs; t += stepMs) {
    while (eventIdx < cursorEvents.length && cursorEvents[eventIdx].timeMs <= t) {
      latestCursorX = cursorEvents[eventIdx].x;
      latestCursorY = cursorEvents[eventIdx].y;
      eventIdx++;
    }

    const block = zooms.find((z) => t >= z.startMs && t <= z.endMs) ?? null;
    activeBlock = block;

    const springParams = block
      ? SPRING_PRESETS[block.springPreset] ?? defaultSpring
      : defaultSpring;

    const targetScale = block ? block.scale : 1.0;
    let targetX = 0.5;
    let targetY = 0.5;

    if (block) {
      if (block.mode === 'auto-cursor') {
        targetX = latestCursorX;
        targetY = latestCursorY;
      } else {
        targetX = block.targetX;
        targetY = block.targetY;
      }
      // Clamp target center so zoomed viewport stays inside [0, 1] (`containInZoomArea`)
      const halfSpan = 0.5 / Math.max(1, targetScale);
      targetX = Math.max(halfSpan, Math.min(1 - halfSpan, targetX));
      targetY = Math.max(halfSpan, Math.min(1 - halfSpan, targetY));
    }

    [scale, vScale] = stepSpring1D(stepMs, scale, vScale, targetScale, springParams);
    [centerX, vCenterX] = stepSpring1D(stepMs, centerX, vCenterX, targetX, springParams);
    [centerY, vCenterY] = stepSpring1D(stepMs, centerY, vCenterY, targetY, springParams);
  }

  return {
    scale,
    centerX,
    centerY,
    velocityScale: Math.abs(vScale),
    velocityPan: Math.hypot(vCenterX, vCenterY),
    activeBlock,
    glassLoupe: activeBlock?.glassLoupe ?? false,
  };
}
