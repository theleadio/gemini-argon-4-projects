import math
import cv2
import numpy as np


def catmull_rom_spline(pts, num_interp=8, closed=False):
    """Generate smooth curve points through control points using Catmull-Rom spline."""
    pts = np.asarray(pts, dtype=np.float32)
    if len(pts) < 3:
        return pts.astype(np.int32)
    if closed:
        p = np.vstack([pts[-1:], pts, pts[:2]])
    else:
        p = np.vstack([pts[:1], pts, pts[-1:]])

    out = []
    for i in range(len(p) - 3):
        p0, p1, p2, p3 = p[i], p[i + 1], p[i + 2], p[i + 3]
        for t in np.linspace(0, 1, num_interp, endpoint=False):
            t2 = t * t
            t3 = t2 * t
            pt = 0.5 * (
                (2 * p1)
                + (-p0 + p2) * t
                + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
                + (-p0 + 3 * p1 - 3 * p2 + p3) * t3
            )
            out.append(pt)
    if not closed:
        out.append(pts[-1])
    return np.array(out, dtype=np.int32)


def draw_smooth_poly(img, pts, color, outline_color=None, outline_thick=2, closed=True, interp=8):
    """Draw a smooth spline-interpolated polygon with anti-aliased edges."""
    curve = catmull_rom_spline(pts, num_interp=interp, closed=closed)
    cv2.fillPoly(img, [curve], color, lineType=cv2.LINE_AA)
    if outline_color is not None and outline_thick > 0:
        cv2.polylines(img, [curve], closed, outline_color, outline_thick, lineType=cv2.LINE_AA)
    return curve


def draw_limb_2seg(img, hip, knee, foot, w_thigh, w_shin, w_foot, color, outline_color=None, claw_color=(230, 235, 240), dir_x=1):
    """Draw a tapered articulated leg (thigh -> knee -> ankle -> clawed foot)."""
    hx, hy = hip
    kx, ky = knee
    fx, fy = foot

    # Thigh vector & normal
    dx1, dy1 = kx - hx, ky - hy
    l1 = max(1.0, math.hypot(dx1, dy1))
    nx1, ny1 = -dy1 / l1, dx1 / l1

    # Shin vector & normal
    dx2, dy2 = fx - kx, fy - ky
    l2 = max(1.0, math.hypot(dx2, dy2))
    nx2, ny2 = -dy2 / l2, dx2 / l2

    thigh_pts = [
        (hx + nx1 * w_thigh, hy + ny1 * w_thigh),
        (kx + nx1 * (w_shin * 1.15), ky + ny1 * (w_shin * 1.15)),
        (fx + nx2 * (w_shin * 0.7), fy + ny2 * (w_shin * 0.7)),
        (fx + dir_x * w_foot, fy + w_shin * 0.2),
        (fx + dir_x * w_foot * 0.9, fy + w_shin * 0.65),
        (fx - nx2 * (w_shin * 0.7), fy + w_shin * 0.65),
        (kx - nx1 * (w_shin * 0.95), ky - ny1 * (w_shin * 0.95)),
        (hx - nx1 * (w_thigh * 0.85), hy - ny1 * (w_thigh * 0.85)),
    ]
    draw_smooth_poly(img, thigh_pts, color, outline_color, outline_thick=2, closed=True, interp=6)

    # Claws
    if claw_color is not None:
        for ci in range(3):
            cx = int(fx + dir_x * (w_foot * (0.65 + 0.25 * ci)))
            cy = int(fy + w_shin * 0.55)
            claw = np.array([
                [cx, cy - int(w_shin * 0.28)],
                [cx + int(dir_x * w_shin * 0.65), cy + int(w_shin * 0.12)],
                [cx - int(dir_x * w_shin * 0.1), cy + int(w_shin * 0.12)],
            ], dtype=np.int32)
            cv2.fillPoly(img, [claw], claw_color, lineType=cv2.LINE_AA)


def draw_eye(img, cx, cy, r, iris_color=(40, 210, 255), blink=0.0):
    """Draw an expressive dinosaur eye with pupil and specular highlight."""
    cx, cy, r = int(cx), int(cy), max(2, int(r))
    if blink > 0.85:
        cv2.line(img, (cx - r, cy), (cx + r, cy), (30, 35, 45), 2, cv2.LINE_AA)
        return
    cv2.circle(img, (cx, cy), r + 2, (25, 30, 38), -1, cv2.LINE_AA)
    cv2.circle(img, (cx, cy), r, iris_color, -1, cv2.LINE_AA)
    # Slit or round pupil
    cv2.ellipse(img, (cx + 1, cy), (max(1, r // 3), int(r * 0.78)), 0, 0, 360, (15, 18, 22), -1, cv2.LINE_AA)
    cv2.circle(img, (cx - r // 3, cy - r // 3), max(1, r // 3), (255, 255, 255), -1, cv2.LINE_AA)


def draw_shadow(img, cx, cy, rx, ry, alpha=0.32):
    """Draw a soft ground contact shadow."""
    cx, cy, rx, ry = int(cx), int(cy), max(4, int(rx)), max(2, int(ry))
    x0, y0 = max(0, cx - rx - 4), max(0, cy - ry - 4)
    x1, y1 = min(img.shape[1], cx + rx + 4), min(img.shape[0], cy + ry + 4)
    if x1 <= x0 or y1 <= y0:
        return
    roi = img[y0:y1, x0:x1]
    mask = np.zeros_like(roi, dtype=np.float32)
    cv2.ellipse(mask, (cx - x0, cy - y0), (rx, ry), 0, 0, 360, (alpha, alpha, alpha), -1, cv2.LINE_AA)
    img[y0:y1, x0:x1] = (roi.astype(np.float32) * (1.0 - mask)).astype(np.uint8)


# ==============================================================================
# 1. COELOPHYSIS / EORAPTOR (Triassic Sleek Bipedal Runner)
# ==============================================================================
def draw_coelophysis(img, cx, cy, scale=1.0, phase=0.0, tint="amber", facing=1):
    """Sleek agile Triassic early dinosaur running across Pangaea."""
    s = scale
    d = facing
    bob = math.sin(phase * 2) * 5 * s
    cy_b = cy + bob

    if tint == "amber":
        c_back = (42, 95, 165)     # Deep terracotta-brown in BGR
        c_body = (52, 125, 215)    # Warm amber-orange in BGR
        c_belly = (135, 195, 245)  # Cream-gold belly
        c_stripe = (32, 68, 125)   # Dorsal stripes
        c_outline = (25, 45, 78)
    else:
        c_back = (75, 115, 65)
        c_body = (95, 160, 82)
        c_belly = (165, 215, 160)
        c_stripe = (48, 82, 42)
        c_outline = (28, 48, 25)

    draw_shadow(img, cx, cy + 72 * s, 78 * s, 12 * s, 0.35)

    # Back leg (stride phase + pi)
    p_back = phase + math.pi
    hip = (cx - d * 12 * s, cy_b + 6 * s)
    knee_b = (hip[0] + d * (18 * math.sin(p_back) + 6) * s, hip[1] + (28 - 8 * math.cos(p_back)) * s)
    foot_b = (knee_b[0] + d * (22 * math.sin(p_back - 0.5) - 6) * s, cy + 68 * s - max(0, math.sin(p_back)) * 18 * s)
    draw_limb_2seg(img, hip, knee_b, foot_b, 14 * s, 8 * s, 16 * s, c_back, c_outline, dir_x=d)

    # Back arm
    arm_sh = (cx + d * 36 * s, cy_b - 6 * s)
    arm_el = (arm_sh[0] + d * 10 * s, arm_sh[1] + 16 * s)
    arm_hd = (arm_el[0] + d * 14 * s, arm_el[1] + (4 + 3 * math.sin(phase)) * s)
    draw_limb_2seg(img, arm_sh, arm_el, arm_hd, 6 * s, 4 * s, 7 * s, c_back, c_outline, dir_x=d)

    # Tail wave + S-neck + Torso polygon
    tail_w1 = math.sin(phase - 0.6) * 8 * s
    tail_w2 = math.sin(phase - 1.4) * 15 * s
    head_bob = math.sin(phase * 2 + 0.5) * 4 * s

    torso_pts = [
        (cx - d * 145 * s, cy_b - 12 * s + tail_w2),  # Tail tip
        (cx - d * 85 * s, cy_b - 14 * s + tail_w1),   # Mid tail top
        (cx - d * 30 * s, cy_b - 18 * s),             # Hip top
        (cx + d * 18 * s, cy_b - 22 * s),             # Back
        (cx + d * 42 * s, cy_b - 26 * s),             # Base of neck
        (cx + d * 58 * s, cy_b - 52 * s + head_bob),  # Mid neck
        (cx + d * 70 * s, cy_b - 68 * s + head_bob),  # Back of head
        (cx + d * 106 * s, cy_b - 62 * s + head_bob), # Snout tip
        (cx + d * 102 * s, cy_b - 53 * s + head_bob), # Upper jaw bottom
        (cx + d * 76 * s, cy_b - 50 * s + head_bob),  # Jaw hinge
        (cx + d * 68 * s, cy_b - 34 * s + head_bob),  # Throat
        (cx + d * 46 * s, cy_b - 2 * s),              # Chest
        (cx + d * 8 * s, cy_b + 16 * s),              # Belly
        (cx - d * 28 * s, cy_b + 10 * s),             # Under hip
        (cx - d * 85 * s, cy_b - 2 * s + tail_w1),    # Mid tail bottom
    ]
    draw_smooth_poly(img, torso_pts, c_body, c_outline, outline_thick=2, closed=True, interp=7)

    # Lower jaw
    jaw_open = (0.5 + 0.5 * math.sin(phase * 1.5)) * 5 * s
    jaw_pts = [
        (cx + d * 74 * s, cy_b - 52 * s + head_bob),
        (cx + d * 100 * s, cy_b - 48 * s + head_bob + jaw_open),
        (cx + d * 72 * s, cy_b - 44 * s + head_bob),
    ]
    draw_smooth_poly(img, jaw_pts, c_body, c_outline, outline_thick=2, closed=True, interp=5)

    # Counter-shading belly stripe
    belly_pts = [
        (cx + d * 56 * s, cy_b - 22 * s),
        (cx + d * 40 * s, cy_b + 1 * s),
        (cx + d * 8 * s, cy_b + 14 * s),
        (cx - d * 24 * s, cy_b + 8 * s),
        (cx + d * 12 * s, cy_b + 4 * s),
        (cx + d * 36 * s, cy_b - 8 * s),
    ]
    draw_smooth_poly(img, belly_pts, c_belly, None, closed=True, interp=5)

    # Tiger-like dorsal stripes along back & tail
    for si, sx_off in enumerate([-75, -52, -30, -10, 10, 28]):
        bx = cx + d * sx_off * s
        by = cy_b - 16 * s + (tail_w1 * 0.5 if sx_off < -35 else 0)
        stripe = np.array([
            [int(bx - d * 5 * s), int(by - 3 * s)],
            [int(bx + d * 5 * s), int(by - 3 * s)],
            [int(bx + d * 1 * s), int(by + 12 * s - si * 1.2 * s)],
        ], dtype=np.int32)
        cv2.fillPoly(img, [stripe], c_stripe, lineType=cv2.LINE_AA)

    # Eye
    draw_eye(img, cx + d * 80 * s, cy_b - 60 * s + head_bob, 4.5 * s, iris_color=(50, 230, 255))

    # Front leg (foreground)
    knee_f = (hip[0] + d * (18 * math.sin(phase) + 6) * s, hip[1] + (28 - 8 * math.cos(phase)) * s)
    foot_f = (knee_f[0] + d * (22 * math.sin(phase - 0.5) - 6) * s, cy + 68 * s - max(0, math.sin(phase)) * 18 * s)
    draw_limb_2seg(img, hip, knee_f, foot_f, 15 * s, 9 * s, 17 * s, c_body, c_outline, dir_x=d)

    # Front arm (foreground)
    arm_hd_f = (arm_el[0] + d * 15 * s, arm_el[1] + (4 - 3 * math.sin(phase)) * s)
    draw_limb_2seg(img, arm_sh, arm_el, arm_hd_f, 7 * s, 4.5 * s, 8 * s, c_body, c_outline, dir_x=d)


# ==============================================================================
# 2. BRACHIOSAURUS (Jurassic Towering Sauropod)
# ==============================================================================
def draw_brachiosaurus(img, cx, cy, scale=1.0, phase=0.0, facing=1):
    """Majestic long-necked Jurassic sauropod with animated neck sway and pillar legs."""
    s = scale
    d = facing
    sway = math.sin(phase) * 8 * s
    chew = math.sin(phase * 3) * 3 * s

    c_back = (95, 118, 72)      # Shaded teal-sage
    c_body = (122, 152, 92)     # Warm Jurassic sage-teal
    c_belly = (168, 198, 148)   # Soft pale belly
    c_spots = (82, 108, 62)     # Dorsal mottling
    c_outline = (42, 58, 35)

    draw_shadow(img, cx, cy + 122 * s, 140 * s, 18 * s, 0.35)

    # Back pillar legs
    leg_back_offsets = [(-52, 118, phase + math.pi), (42, 120, phase + math.pi * 0.5)]
    for lx_off, l_h, lp in leg_back_offsets:
        lx = cx + d * lx_off * s
        step_x = math.sin(lp) * 10 * s
        lift_y = max(0.0, math.cos(lp)) * 8 * s
        hip = (lx, cy + 15 * s)
        knee = (lx + d * step_x * 0.5, cy + 68 * s - lift_y * 0.5)
        foot = (lx + d * step_x, cy + l_h * s - lift_y)
        draw_limb_2seg(img, hip, knee, foot, 24 * s, 19 * s, 22 * s, c_back, c_outline, dir_x=d)

    # Massive sloping body + towering S-neck + long tail
    tail_sway = math.sin(phase - 0.8) * 12 * s
    body_pts = [
        (cx - d * 215 * s, cy + 68 * s + tail_sway),     # Tail tip
        (cx - d * 135 * s, cy + 36 * s + tail_sway * 0.5),
        (cx - d * 68 * s, cy - 8 * s),                   # Hip top
        (cx + d * 18 * s, cy - 38 * s),                  # High shoulder slope
        (cx + d * 55 * s, cy - 68 * s),                  # Neck base
        (cx + d * (82 + sway * 0.4) * s, cy - 165 * s),  # Mid neck
        (cx + d * (104 + sway) * s, cy - 265 * s),       # Upper neck
        (cx + d * (114 + sway) * s, cy - 295 * s),       # Nasal crest top!
        (cx + d * (146 + sway) * s, cy - 280 * s),       # Snout front
        (cx + d * (142 + sway) * s, cy - (266 - chew) * s), # Mouth bottom
        (cx + d * (116 + sway) * s, cy - 264 * s),       # Throat
        (cx + d * (102 + sway * 0.4) * s, cy - 155 * s), # Front neck mid
        (cx + d * 82 * s, cy - 35 * s),                  # Chest front
        (cx + d * 62 * s, cy + 32 * s),                  # Chest bottom
        (cx - d * 8 * s, cy + 44 * s),                   # Belly
        (cx - d * 68 * s, cy + 36 * s),                  # Under hip
        (cx - d * 140 * s, cy + 56 * s + tail_sway * 0.5),
    ]
    draw_smooth_poly(img, body_pts, c_body, c_outline, outline_thick=2, closed=True, interp=8)

    # Counter-shading along neck & belly
    belly_pts = [
        (cx + d * (100 + sway * 0.4) * s, cy - 155 * s),
        (cx + d * 78 * s, cy - 35 * s),
        (cx + d * 58 * s, cy + 28 * s),
        (cx - d * 10 * s, cy + 40 * s),
        (cx - d * 55 * s, cy + 32 * s),
        (cx - d * 10 * s, cy + 22 * s),
        (cx + d * 52 * s, cy + 8 * s),
        (cx + d * 70 * s, cy - 45 * s),
    ]
    draw_smooth_poly(img, belly_pts, c_belly, None, closed=True, interp=6)

    # Osteoderm / skin spots on shoulder and back
    for sx, sy, sr in [(-35, -2, 11), (-12, -14, 14), (15, -24, 12), (38, -42, 9), (-55, 8, 8), (62, -95, 7), (76, -145, 6)]:
        cv2.circle(img, (int(cx + d * sx * s), int(cy + sy * s)), max(2, int(sr * s)), c_spots, -1, cv2.LINE_AA)

    # Eye
    draw_eye(img, cx + d * (122 + sway) * s, cy - 278 * s, 5.5 * s, iris_color=(70, 215, 255))

    # Foreground pillar legs (longer forelimb, shorter hindlimb)
    leg_front_offsets = [(-42, 120, phase), (54, 122, phase + math.pi * 1.5)]
    for idx, (lx_off, l_h, lp) in enumerate(leg_front_offsets):
        lx = cx + d * lx_off * s
        step_x = math.sin(lp) * 10 * s
        lift_y = max(0.0, math.cos(lp)) * 8 * s
        hip_y = cy + (12 if idx == 0 else 4) * s
        hip = (lx, hip_y)
        knee = (lx + d * step_x * 0.5, cy + 68 * s - lift_y * 0.5)
        foot = (lx + d * step_x, cy + l_h * s - lift_y)
        w_t = (25 if idx == 0 else 28) * s
        draw_limb_2seg(img, hip, knee, foot, w_t, 20 * s, 24 * s, c_body, c_outline, dir_x=d)


# ==============================================================================
# 3. STEGOSAURUS (Jurassic Armored Herbivore with Dorsal Plates & Thagomizer)
# ==============================================================================
def draw_stegosaurus(img, cx, cy, scale=1.0, phase=0.0, facing=1):
    """Armored Stegosaurus with alternating diamond dorsal plates and spiked tail."""
    s = scale
    d = facing
    tail_wag = math.sin(phase * 1.5) * 10 * s

    c_back_leg = (65, 88, 125)
    c_body = (82, 118, 168)      # Slate-terracotta warm tone
    c_belly = (142, 175, 212)
    c_plate_back = (55, 75, 195) # Deep coral-red dorsal plates (back row)
    c_plate_front = (75, 105, 238) # Bright coral-amber dorsal plates (front row)
    c_outline = (32, 42, 62)

    draw_shadow(img, cx, cy + 72 * s, 115 * s, 14 * s, 0.35)

    # Back row of dorsal plates along the arched spine
    spine_curve = [
        (cx + d * 78 * s, cy + 8 * s, 12),
        (cx + d * 55 * s, cy - 16 * s, 22),
        (cx + d * 26 * s, cy - 42 * s, 34),
        (cx - d * 8 * s, cy - 54 * s, 42),
        (cx - d * 42 * s, cy - 44 * s, 36),
        (cx - d * 74 * s, cy - 22 * s, 26),
        (cx - d * 102 * s, cy + 2 * s + tail_wag * 0.4, 16),
    ]
    for px, py, ph in spine_curve:
        p_pts = np.array([
            [int(px - d * ph * 0.38 * s), int(py + 6 * s)],
            [int(px - d * ph * 0.52 * s), int(py - ph * 0.55 * s)],
            [int(px + d * ph * 0.08 * s), int(py - ph * 1.05 * s)],
            [int(px + d * ph * 0.48 * s), int(py - ph * 0.45 * s)],
            [int(px + d * ph * 0.35 * s), int(py + 6 * s)],
        ], dtype=np.int32)
        cv2.fillPoly(img, [p_pts], c_plate_back, lineType=cv2.LINE_AA)
        cv2.polylines(img, [p_pts], True, c_outline, 2, lineType=cv2.LINE_AA)

    # Front row of dorsal plates (shifted slightly)
    for i in range(len(spine_curve) - 1):
        px = 0.5 * (spine_curve[i][0] + spine_curve[i + 1][0])
        py = 0.5 * (spine_curve[i][1] + spine_curve[i + 1][1]) + 3 * s
        ph = 0.5 * (spine_curve[i][2] + spine_curve[i + 1][2]) * 1.08
        p_pts = np.array([
            [int(px - d * ph * 0.38 * s), int(py + 8 * s)],
            [int(px - d * ph * 0.52 * s), int(py - ph * 0.55 * s)],
            [int(px), int(py - ph * 1.08 * s)],
            [int(px + d * ph * 0.48 * s), int(py - ph * 0.45 * s)],
            [int(px + d * ph * 0.35 * s), int(py + 8 * s)],
        ], dtype=np.int32)
        cv2.fillPoly(img, [p_pts], c_plate_front, lineType=cv2.LINE_AA)
        cv2.polylines(img, [p_pts], True, c_outline, 2, lineType=cv2.LINE_AA)
        # Vascular lines on plates
        cv2.line(img, (int(px), int(py + 2 * s)), (int(px), int(py - ph * 0.85 * s)), (120, 165, 250), 1, cv2.LINE_AA)

    # Back legs
    for lx_off, l_w, lp in [(-38, 22, phase + math.pi), (45, 16, phase + math.pi * 0.5)]:
        lx = cx + d * lx_off * s
        step_x = math.sin(lp) * 9 * s
        draw_limb_2seg(
            img,
            (lx, cy + 12 * s),
            (lx + d * step_x * 0.5, cy + 42 * s),
            (lx + d * step_x, cy + 68 * s),
            l_w * s, (l_w * 0.75) * s, 18 * s, c_back_leg, c_outline, dir_x=d
        )

    # Arched body + small low head + tail
    body_pts = [
        (cx - d * 155 * s, cy + 22 * s + tail_wag),      # Tail tip
        (cx - d * 95 * s, cy - 12 * s + tail_wag * 0.4),
        (cx - d * 42 * s, cy - 42 * s),                  # High arch back
        (cx - d * 5 * s, cy - 50 * s),                   # Peak of arch
        (cx + d * 35 * s, cy - 34 * s),                  # Sloping shoulder
        (cx + d * 68 * s, cy - 4 * s),                   # Neck
        (cx + d * 96 * s, cy + 8 * s),                   # Small narrow head top
        (cx + d * 118 * s, cy + 18 * s),                 # Beak tip
        (cx + d * 95 * s, cy + 26 * s),                  # Jaw bottom
        (cx + d * 62 * s, cy + 24 * s),                  # Throat
        (cx + d * 10 * s, cy + 34 * s),                  # Belly
        (cx - d * 52 * s, cy + 28 * s),                  # Hip bottom
        (cx - d * 105 * s, cy + 20 * s + tail_wag * 0.4),
    ]
    draw_smooth_poly(img, body_pts, c_body, c_outline, outline_thick=2, closed=True, interp=7)

    # Thagomizer (4 tail spikes!)
    for sp_off, sp_ang in [(-132, -25), (-142, -15), (-136, 18), (-146, 28)]:
        bx = cx + d * sp_off * s
        by = cy + 16 * s + tail_wag * 0.85
        spike = np.array([
            [int(bx - d * 4 * s), int(by)],
            [int(bx - d * 26 * s), int(by + sp_ang * s)],
            [int(bx + d * 4 * s), int(by + 3 * s)],
        ], dtype=np.int32)
        cv2.fillPoly(img, [spike], (235, 242, 248), lineType=cv2.LINE_AA)
        cv2.polylines(img, [spike], True, c_outline, 2, lineType=cv2.LINE_AA)

    draw_eye(img, cx + d * 98 * s, cy + 14 * s, 4.0 * s, iris_color=(60, 220, 255))

    # Front legs (foreground)
    for lx_off, l_w, lp in [(-28, 24, phase), (52, 17, phase + math.pi * 1.5)]:
        lx = cx + d * lx_off * s
        step_x = math.sin(lp) * 9 * s
        draw_limb_2seg(
            img,
            (lx, cy + 14 * s),
            (lx + d * step_x * 0.5, cy + 42 * s),
            (lx + d * step_x, cy + 68 * s),
            l_w * s, (l_w * 0.78) * s, 19 * s, c_body, c_outline, dir_x=d
        )


# ==============================================================================
# 4. TYRANNOSAURUS REX (Cretaceous Apex Predator with Animated Roaring Jaw)
# ==============================================================================
def draw_trex(img, cx, cy, scale=1.0, phase=0.0, roar=0.5, facing=1):
    """Massive articulated T-Rex with serrated teeth, roaring jaw, and muscular tail."""
    s = scale
    d = facing
    bob = math.sin(phase) * 5 * s
    cy_b = cy + bob

    c_back = (45, 62, 52)       # Dark olive-charcoal shadow
    c_body = (62, 88, 72)       # Rich prehistoric olive-bronze (BGR)
    c_dorsal = (38, 52, 42)     # Dark dorsal armor ridge
    c_belly = (128, 168, 152)   # Warm sage-ochre underbelly
    c_mouth = (68, 62, 165)     # Crimson inner mouth
    c_outline = (22, 32, 26)

    draw_shadow(img, cx, cy + 108 * s, 128 * s, 16 * s, 0.38)

    # Back muscular leg
    hip = (cx - d * 18 * s, cy_b + 8 * s)
    p_b = phase + math.pi
    knee_b = (hip[0] + d * (16 * math.sin(p_b) + 12) * s, hip[1] + 44 * s)
    foot_b = (knee_b[0] + d * (18 * math.sin(p_b - 0.4) - 8) * s, cy + 104 * s - max(0, math.sin(p_b)) * 12 * s)
    draw_limb_2seg(img, hip, knee_b, foot_b, 32 * s, 18 * s, 28 * s, c_back, c_outline, dir_x=d)

    # Heavy tail + muscular torso + neck + upper skull
    tail_w = math.sin(phase - 0.7) * 10 * s
    head_y = cy_b - 68 * s + math.sin(phase * 1.5) * 4 * s

    torso_pts = [
        (cx - d * 215 * s, cy_b - 18 * s + tail_w),       # Tail tip
        (cx - d * 120 * s, cy_b - 28 * s + tail_w * 0.4), # Mid tail top
        (cx - d * 35 * s, cy_b - 38 * s),                 # Hip top
        (cx + d * 25 * s, cy_b - 44 * s),                 # Muscular back
        (cx + d * 68 * s, cy_b - 58 * s),                 # Thick neck
        (cx + d * 88 * s, head_y - 22 * s),               # Skull brow ridge!
        (cx + d * 148 * s, head_y - 16 * s),              # Massive snout top
        (cx + d * 156 * s, head_y + 4 * s),               # Upper snout front
        (cx + d * 146 * s, head_y + 16 * s),              # Maxilla tooth line front
        (cx + d * 92 * s, head_y + 14 * s),               # Jaw corner
        (cx + d * 78 * s, cy_b - 18 * s),                 # Throat
        (cx + d * 55 * s, cy_b + 22 * s),                 # Deep chest
        (cx - d * 5 * s, cy_b + 34 * s),                  # Belly
        (cx - d * 48 * s, cy_b + 22 * s),                 # Under hip
        (cx - d * 125 * s, cy_b + 4 * s + tail_w * 0.4),  # Under tail
    ]
    draw_smooth_poly(img, torso_pts, c_body, c_outline, outline_thick=2, closed=True, interp=7)

    # Counter-shading belly
    belly_pts = [
        (cx + d * 72 * s, cy_b - 14 * s),
        (cx + d * 52 * s, cy_b + 20 * s),
        (cx - d * 5 * s, cy_b + 31 * s),
        (cx - d * 45 * s, cy_b + 20 * s),
        (cx - d * 5 * s, cy_b + 14 * s),
        (cx + d * 45 * s, cy_b + 2 * s),
    ]
    draw_smooth_poly(img, belly_pts, c_belly, None, closed=True, interp=5)

    # Open roaring mouth interior & lower jaw
    jaw_drop = (8 + 24 * roar) * s
    mouth_interior = np.array([
        [int(cx + d * 94 * s), int(head_y + 12 * s)],
        [int(cx + d * 142 * s), int(head_y + 14 * s)],
        [int(cx + d * 136 * s), int(head_y + 14 * s + jaw_drop * 0.85)],
        [int(cx + d * 90 * s), int(head_y + 18 * s)],
    ], dtype=np.int32)
    cv2.fillPoly(img, [mouth_interior], c_mouth, lineType=cv2.LINE_AA)

    # Upper teeth (serrated row)
    for ti in range(6):
        tx = cx + d * (102 + ti * 7.2) * s
        ty = head_y + 14 * s
        t_h = (7 if ti in (2, 3) else 5) * s
        tooth = np.array([
            [int(tx - d * 2.2 * s), int(ty)],
            [int(tx), int(ty + t_h)],
            [int(tx + d * 2.2 * s), int(ty)],
        ], dtype=np.int32)
        cv2.fillPoly(img, [tooth], (242, 246, 250), lineType=cv2.LINE_AA)

    # Lower teeth
    for ti in range(5):
        tx = cx + d * (102 + ti * 7.0) * s
        ty = head_y + 14 * s + jaw_drop * (0.45 + 0.08 * ti)
        tooth = np.array([
            [int(tx - d * 2.0 * s), int(ty + 2 * s)],
            [int(tx), int(ty - 4.5 * s)],
            [int(tx + d * 2.0 * s), int(ty + 2 * s)],
        ], dtype=np.int32)
        cv2.fillPoly(img, [tooth], (242, 246, 250), lineType=cv2.LINE_AA)

    # Articulated lower mandible
    jaw_pts = [
        (cx + d * 82 * s, head_y + 8 * s),
        (cx + d * 142 * s, head_y + 14 * s + jaw_drop),
        (cx + d * 136 * s, head_y + 26 * s + jaw_drop),
        (cx + d * 78 * s, head_y + 24 * s),
    ]
    draw_smooth_poly(img, jaw_pts, c_body, c_outline, outline_thick=2, closed=True, interp=6)

    # Dorsal dark armor stripes along spine and tail
    for sx_off in range(-140, 70, 22):
        bx = cx + d * sx_off * s
        by = cy_b - 32 * s + (tail_w * 0.4 if sx_off < -50 else 0)
        stripe = np.array([
            [int(bx - d * 7 * s), int(by - 4 * s)],
            [int(bx + d * 7 * s), int(by - 4 * s)],
            [int(bx), int(by + 16 * s)],
        ], dtype=np.int32)
        cv2.fillPoly(img, [stripe], c_dorsal, lineType=cv2.LINE_AA)

    # Fierce eye under heavy brow ridge
    draw_eye(img, cx + d * 104 * s, head_y - 6 * s, 5.5 * s, iris_color=(30, 195, 255))
    # Brow ridge line
    cv2.line(
        img,
        (int(cx + d * 94 * s), int(head_y - 14 * s)),
        (int(cx + d * 114 * s), int(head_y - 10 * s)),
        c_outline, 3, cv2.LINE_AA
    )

    # Foreground muscular leg
    knee_f = (hip[0] + d * (16 * math.sin(phase) + 12) * s, hip[1] + 44 * s)
    foot_f = (knee_f[0] + d * (18 * math.sin(phase - 0.4) - 8) * s, cy + 104 * s - max(0, math.sin(phase)) * 12 * s)
    draw_limb_2seg(img, hip, knee_f, foot_f, 35 * s, 20 * s, 30 * s, c_body, c_outline, dir_x=d)

    # Iconic tiny 2-fingered forelimb
    arm_sh = (cx + d * 54 * s, cy_b + 4 * s)
    arm_el = (arm_sh[0] + d * 8 * s, arm_sh[1] + 16 * s)
    arm_hd = (arm_el[0] + d * 14 * s, arm_el[1] + 4 * s)
    draw_limb_2seg(img, arm_sh, arm_el, arm_hd, 8 * s, 5 * s, 8 * s, c_body, c_outline, dir_x=d)


# ==============================================================================
# 5. TRICERATOPS (Cretaceous Three-Horned Defender with Ornate Frill)
# ==============================================================================
def draw_triceratops(img, cx, cy, scale=1.0, phase=0.0, facing=-1):
    """Sturdy Triceratops with scalloped bony frill, two long brow horns, and nasal horn."""
    s = scale
    d = facing
    head_nod = math.sin(phase * 1.5) * 5 * s

    c_back_leg = (88, 72, 52)
    c_body = (118, 98, 68)       # Warm russet-slate (BGR)
    c_frill = (92, 82, 148)      # Ornate crimson-plum frill accent
    c_belly = (162, 148, 122)
    c_horn = (228, 238, 245)     # Ivory horns
    c_outline = (38, 32, 24)

    draw_shadow(img, cx, cy + 78 * s, 122 * s, 15 * s, 0.36)

    # Back legs
    for lx_off, l_w, lp in [(-45, 24, phase + math.pi), (38, 22, phase + math.pi * 0.5)]:
        lx = cx + d * lx_off * s
        step_x = math.sin(lp) * 8 * s
        draw_limb_2seg(
            img,
            (lx, cy + 12 * s),
            (lx + d * step_x * 0.5, cy + 44 * s),
            (lx + d * step_x, cy + 74 * s),
            l_w * s, (l_w * 0.8) * s, 20 * s, c_back_leg, c_outline, dir_x=d
        )

    # Muscular barrel body + short thick tail
    body_pts = [
        (cx - d * 138 * s, cy + 22 * s),          # Tail tip
        (cx - d * 88 * s, cy - 8 * s),            # Tail base
        (cx - d * 35 * s, cy - 38 * s),           # High rounded hip
        (cx + d * 25 * s, cy - 32 * s),           # Shoulder
        (cx + d * 55 * s, cy - 18 * s),           # Neck
        (cx + d * 52 * s, cy + 32 * s),           # Chest
        (cx - d * 12 * s, cy + 38 * s),           # Belly
        (cx - d * 62 * s, cy + 28 * s),           # Under hip
    ]
    draw_smooth_poly(img, body_pts, c_body, c_outline, outline_thick=2, closed=True, interp=7)

    # Foreground legs
    for lx_off, l_w, lp in [(-34, 26, phase), (46, 24, phase + math.pi * 1.5)]:
        lx = cx + d * lx_off * s
        step_x = math.sin(lp) * 8 * s
        draw_limb_2seg(
            img,
            (lx, cy + 14 * s),
            (lx + d * step_x * 0.5, cy + 44 * s),
            (lx + d * step_x, cy + 74 * s),
            l_w * s, (l_w * 0.8) * s, 20 * s, c_body, c_outline, dir_x=d
        )

    # Iconic Bony Neck Frill (Shield)
    hx = cx + d * 62 * s
    hy = cy - 8 * s + head_nod
    frill_pts = [
        (hx - d * 32 * s, hy - 58 * s),
        (hx - d * 8 * s, hy - 64 * s),
        (hx + d * 18 * s, hy - 42 * s),
        (hx + d * 14 * s, hy + 8 * s),
        (hx - d * 18 * s, hy + 2 * s),
        (hx - d * 36 * s, hy - 28 * s),
    ]
    draw_smooth_poly(img, frill_pts, c_frill, c_outline, outline_thick=3, closed=True, interp=6)

    # Decorative epoccipital studs along the frill rim
    for ang in np.linspace(-2.4, -0.5, 7):
        ex = int(hx - d * 8 * s + d * math.cos(ang) * 32 * s)
        ey = int(hy - 26 * s + math.sin(ang) * 38 * s)
        cv2.circle(img, (ex, ey), max(2, int(4.5 * s)), c_horn, -1, cv2.LINE_AA)
        cv2.circle(img, (ex, ey), max(2, int(4.5 * s)), c_outline, 1, cv2.LINE_AA)

    # Frill eye-spot pattern
    cv2.circle(img, (int(hx - d * 12 * s), int(hy - 34 * s)), max(3, int(11 * s)), (75, 185, 235), -1, cv2.LINE_AA)
    cv2.circle(img, (int(hx - d * 12 * s), int(hy - 34 * s)), max(2, int(5 * s)), (30, 45, 75), -1, cv2.LINE_AA)

    # Back brow horn
    horn_b = np.array([
        [int(hx + d * 10 * s), int(hy - 30 * s)],
        [int(hx + d * 78 * s), int(hy - 52 * s)],
        [int(hx + d * 18 * s), int(hy - 18 * s)],
    ], dtype=np.int32)
    cv2.fillPoly(img, [horn_b], (195, 205, 215), lineType=cv2.LINE_AA)
    cv2.polylines(img, [horn_b], True, c_outline, 2, lineType=cv2.LINE_AA)

    # Head & Parrot-like Beak
    head_pts = [
        (hx - d * 4 * s, hy - 26 * s),
        (hx + d * 36 * s, hy - 14 * s),
        (hx + d * 64 * s, hy + 8 * s),    # Snout
        (hx + d * 68 * s, hy + 24 * s),   # Hooked beak tip
        (hx + d * 44 * s, hy + 28 * s),   # Lower jaw
        (hx + d * 6 * s, hy + 22 * s),
    ]
    draw_smooth_poly(img, head_pts, c_body, c_outline, outline_thick=2, closed=True, interp=6)

    # Nasal horn (on snout)
    nasal_h = np.array([
        [int(hx + d * 46 * s), int(hy + 2 * s)],
        [int(hx + d * 62 * s), int(hy - 16 * s)],
        [int(hx + d * 56 * s), int(hy + 8 * s)],
    ], dtype=np.int32)
    cv2.fillPoly(img, [nasal_h], c_horn, lineType=cv2.LINE_AA)
    cv2.polylines(img, [nasal_h], True, c_outline, 2, lineType=cv2.LINE_AA)

    # Foreground long brow horn
    horn_f = np.array([
        [int(hx + d * 14 * s), int(hy - 24 * s)],
        [int(hx + d * 88 * s), int(hy - 42 * s)],
        [int(hx + d * 22 * s), int(hy - 10 * s)],
    ], dtype=np.int32)
    cv2.fillPoly(img, [horn_f], c_horn, lineType=cv2.LINE_AA)
    cv2.polylines(img, [horn_f], True, c_outline, 2, lineType=cv2.LINE_AA)

    draw_eye(img, hx + d * 24 * s, hy - 4 * s, 4.5 * s, iris_color=(50, 210, 255))


# ==============================================================================
# 6. PTEROSAUR (Soaring Winged Reptile)
# ==============================================================================
def draw_pterosaur(img, cx, cy, scale=1.0, phase=0.0, facing=1):
    """Pteranodon / Quetzalcoatlus with cranial crest and flapping wings."""
    s = scale
    d = facing
    flap = math.sin(phase * 2.5) * 28 * s

    c_wing_back = (65, 95, 145)
    c_wing_front = (88, 132, 198)
    c_body = (72, 112, 175)
    c_crest = (65, 165, 245)
    c_outline = (28, 42, 68)

    # Back wing
    w_back = [
        (cx - d * 10 * s, cy),
        (cx - d * 45 * s, cy - (38 - flap * 0.7) * s),
        (cx - d * 95 * s, cy - (18 - flap) * s),
        (cx - d * 35 * s, cy + 8 * s),
    ]
    draw_smooth_poly(img, w_back, c_wing_back, c_outline, outline_thick=2, closed=True, interp=5)

    # Body + long neck + cranial crest + pointed beak
    body_pts = [
        (cx - d * 38 * s, cy + 6 * s),     # Short tail
        (cx + d * 18 * s, cy - 6 * s),     # Shoulder
        (cx + d * 38 * s, cy - 16 * s),    # Neck
        (cx + d * 12 * s, cy - 34 * s),    # Backward cranial crest tip!
        (cx + d * 48 * s, cy - 24 * s),    # Head top
        (cx + d * 92 * s, cy - 14 * s),    # Long pointed beak tip!
        (cx + d * 46 * s, cy - 10 * s),    # Jaw bottom
        (cx + d * 12 * s, cy + 10 * s),    # Belly
    ]
    draw_smooth_poly(img, body_pts, c_body, c_outline, outline_thick=2, closed=True, interp=5)

    # Front wing
    w_front = [
        (cx + d * 8 * s, cy + 2 * s),
        (cx - d * 15 * s, cy + (32 + flap * 0.8) * s),
        (cx - d * 82 * s, cy + (48 + flap * 1.1) * s),
        (cx - d * 28 * s, cy + 8 * s),
    ]
    draw_smooth_poly(img, w_front, c_wing_front, c_outline, outline_thick=2, closed=True, interp=5)
    draw_eye(img, cx + d * 52 * s, cy - 18 * s, 3.0 * s, iris_color=(80, 235, 255))


# ==============================================================================
# 7. FOSSIL SKELETON & FEATHERED THEROPOD SCANNER (Act 5)
# ==============================================================================
def draw_theropod_skeleton_and_feathers(img, cx, cy, scale=1.0, scan_x=960, phase=0.0):
    """
    Draws an anatomical dinosaur skeleton across the frame, with an X-ray/plumage
    revelation effect wherever x < scan_x!
    """
    s = scale
    bone_col = (212, 232, 245)       # Ivory fossil bone
    bone_glow = (245, 225, 120)      # Cyan-amber blueprint highlight
    feather_body = (195, 125, 45)    # Iridescent turquoise-teal plumage (BGR)
    feather_wing = (85, 185, 245)    # Bright golden-amber wing feathers
    feather_tip = (145, 85, 225)     # Coral-magenta feather tips

    # If scan_x has passed over, draw vibrant feathered contour silhouette first!
    feather_overlay = img.copy()

    # Feathered dinosaur body + wing fan + tail frond on feather_overlay
    f_body = [
        (cx - 260 * s, cy - 15 * s),
        (cx - 120 * s, cy - 28 * s),
        (cx - 20 * s, cy - 42 * s),
        (cx + 55 * s, cy - 48 * s),
        (cx + 105 * s, cy - 108 * s),
        (cx + 135 * s, cy - 125 * s),
        (cx + 185 * s, cy - 110 * s),
        (cx + 135 * s, cy - 82 * s),
        (cx + 95 * s, cy - 12 * s),
        (cx + 25 * s, cy + 32 * s),
        (cx - 48 * s, cy + 24 * s),
        (cx - 150 * s, cy + 2 * s),
    ]
    draw_smooth_poly(feather_overlay, f_body, feather_body, (255, 220, 140), outline_thick=2, closed=True, interp=7)

    # Tail fan feathers (Microraptor / Deinonychus tail frond)
    for fi in range(9):
        fx = cx - (140 + fi * 15) * s
        fy = cy - (18 - fi * 0.5) * s
        f_top = np.array([
            [int(fx), int(fy)],
            [int(fx - 26 * s), int(fy - 28 * s)],
            [int(fx - 12 * s), int(fy - 4 * s)],
        ], dtype=np.int32)
        f_bot = np.array([
            [int(fx), int(fy + 8 * s)],
            [int(fx - 26 * s), int(fy + 34 * s)],
            [int(fx - 12 * s), int(fy + 12 * s)],
        ], dtype=np.int32)
        cv2.fillPoly(feather_overlay, [f_top], feather_wing, lineType=cv2.LINE_AA)
        cv2.fillPoly(feather_overlay, [f_bot], feather_tip, lineType=cv2.LINE_AA)

    # Forelimb wing primary feathers (Pennaceous feathers!)
    arm_base = (cx + 58 * s, cy - 8 * s)
    for wi in range(8):
        ang = 0.6 + wi * 0.16 + 0.05 * math.sin(phase + wi * 0.3)
        wx = arm_base[0] + math.cos(ang) * 42 * s
        wy = arm_base[1] + math.sin(ang) * 42 * s
        feather_p = np.array([
            [int(wx), int(wy)],
            [int(wx - 48 * s), int(wy + 38 * s)],
            [int(wx - 34 * s), int(wy + 46 * s)],
            [int(wx + 6 * s), int(wy + 8 * s)],
        ], dtype=np.int32)
        col = feather_wing if wi % 2 == 0 else feather_tip
        cv2.fillPoly(feather_overlay, [feather_p], col, lineType=cv2.LINE_AA)

    # Head crest feathers
    for ci in range(5):
        hx = cx + (118 - ci * 7) * s
        hy = cy - (118 - ci * 5) * s
        crest = np.array([
            [int(hx), int(hy)],
            [int(hx - 24 * s), int(hy - 22 * s)],
            [int(hx - 8 * s), int(hy + 4 * s)],
        ], dtype=np.int32)
        cv2.fillPoly(feather_overlay, [crest], feather_wing, lineType=cv2.LINE_AA)

    # Blend feather_overlay on the left of scan_x
    sx_clamped = max(0, min(img.shape[1], int(scan_x)))
    if sx_clamped > 0:
        img[:, :sx_clamped] = cv2.addWeighted(
            img[:, :sx_clamped], 0.35, feather_overlay[:, :sx_clamped], 0.65, 0
        )

    # Now draw the anatomical SKELETON on top across the whole dinosaur!
    # 1. Vertebral column (Tail + Dorsal + Cervical spine)
    spine_pts = [
        (cx - 255 * s, cy - 12 * s),
        (cx - 165 * s, cy - 18 * s),
        (cx - 75 * s, cy - 22 * s),
        (cx - 10 * s, cy - 28 * s),
        (cx + 52 * s, cy - 32 * s),
        (cx + 88 * s, cy - 68 * s),
        (cx + 112 * s, cy - 105 * s),
    ]
    spine_curve = catmull_rom_spline(spine_pts, num_interp=8, closed=False)
    for i in range(0, len(spine_curve) - 1, 2):
        p1 = tuple(spine_curve[i])
        p2 = tuple(spine_curve[i + 1])
        c = bone_glow if p1[0] < sx_clamped else bone_col
        cv2.line(img, p1, p2, c, max(2, int(6 * s)), cv2.LINE_AA)
        # Neural spine process
        cv2.line(img, p1, (p1[0] - int(3 * s), p1[1] - int(11 * s)), c, max(1, int(3 * s)), cv2.LINE_AA)

    # 2. Ribcage (Curved thoracic ribs + gastralia)
    for ri in range(8):
        rx = int(cx + (-12 + ri * 9) * s)
        ry = int(cy - 28 * s)
        r_len = int((46 - abs(ri - 3.5) * 6) * s)
        c = bone_glow if rx < sx_clamped else bone_col
        cv2.ellipse(
            img,
            (rx - int(6 * s), ry + r_len // 2),
            (int(12 * s), r_len // 2),
            12, -80, 95, c, max(2, int(3.5 * s)), cv2.LINE_AA
        )

    # 3. Pelvis (Ilium, Ischium, Pubis pointing backward like birds!)
    px, py = int(cx - 22 * s), int(cy - 24 * s)
    c_p = bone_glow if px < sx_clamped else bone_col
    cv2.ellipse(img, (px, py - int(4 * s)), (int(28 * s), int(10 * s)), -8, 0, 360, c_p, max(2, int(4 * s)), cv2.LINE_AA)
    # Backward-pointing pubis (key link between theropods and birds!)
    cv2.line(img, (px, py), (px - int(28 * s), py + int(36 * s)), c_p, max(2, int(4 * s)), cv2.LINE_AA)
    cv2.line(img, (px - int(8 * s), py), (px - int(38 * s), py + int(24 * s)), c_p, max(2, int(3.5 * s)), cv2.LINE_AA)

    # 4. Hindlimb skeleton (Femur -> Tibia -> Metatarsals -> Sickle Claw!)
    for leg_off, l_thick in [(-12, 4), (4, 6)]:
        hip = (int(cx + (-24 + leg_off) * s), int(cy - 18 * s))
        knee = (int(cx + (6 + leg_off) * s), int(cy + 26 * s))
        ankle = (int(cx + (-22 + leg_off) * s), int(cy + 74 * s))
        foot = (int(cx + (8 + leg_off) * s), int(cy + 108 * s))
        c_l = bone_glow if hip[0] < sx_clamped else bone_col
        cv2.line(img, hip, knee, c_l, max(2, int(l_thick * s)), cv2.LINE_AA)
        cv2.line(img, knee, ankle, c_l, max(2, int((l_thick - 1) * s)), cv2.LINE_AA)
        cv2.line(img, ankle, foot, c_l, max(2, int((l_thick - 1) * s)), cv2.LINE_AA)
        cv2.circle(img, knee, max(2, int(5 * s)), c_l, -1, cv2.LINE_AA)
        cv2.circle(img, ankle, max(2, int(4 * s)), c_l, -1, cv2.LINE_AA)
        # Iconic Deinonychus / Velociraptor raised sickle claw!
        cv2.ellipse(
            img,
            (foot[0] + int(8 * s), foot[1] - int(10 * s)),
            (int(14 * s), int(14 * s)),
            0, -110, 45, c_l, max(2, int(3.5 * s)), cv2.LINE_AA
        )
        cv2.line(img, foot, (foot[0] + int(24 * s), foot[1]), c_l, max(2, int(3 * s)), cv2.LINE_AA)

    # 5. Forelimb skeleton (Humerus -> Radius/Ulna -> Manus)
    sh = (int(cx + 52 * s), int(cy - 22 * s))
    el = (int(cx + 38 * s), int(cy + 12 * s))
    wr = (int(cx + 72 * s), int(cy + 22 * s))
    c_a = bone_glow if sh[0] < sx_clamped else bone_col
    cv2.line(img, sh, el, c_a, max(2, int(4.5 * s)), cv2.LINE_AA)
    cv2.line(img, el, wr, c_a, max(2, int(4 * s)), cv2.LINE_AA)
    for fi in range(3):
        cv2.line(img, wr, (wr[0] + int(18 * s), wr[1] + int((fi - 1) * 8 * s)), c_a, max(1, int(2.5 * s)), cv2.LINE_AA)

    # 6. Skull with antorbital fenestra & orbit
    sk_x, sk_y = int(cx + 114 * s), int(cy - 108 * s)
    c_sk = bone_glow if sk_x < sx_clamped else bone_col
    skull_pts = [
        (sk_x, sk_y - int(14 * s)),
        (sk_x + int(68 * s), sk_y - int(4 * s)),
        (sk_x + int(72 * s), sk_y + int(10 * s)),
        (sk_x + int(4 * s), sk_y + int(12 * s)),
    ]
    draw_smooth_poly(img, skull_pts, c_sk, (40, 55, 70), outline_thick=2, closed=True, interp=5)
    # Skull fenestrae (eye socket + nasal opening)
    cv2.circle(img, (sk_x + int(18 * s), sk_y - int(2 * s)), max(3, int(8 * s)), (22, 28, 38), -1, cv2.LINE_AA)
    cv2.ellipse(img, (sk_x + int(40 * s), sk_y + int(1 * s)), (int(10 * s), int(5 * s)), 0, 0, 360, (22, 28, 38), -1, cv2.LINE_AA)
    # Lower jaw bone
    cv2.line(img, (sk_x + int(4 * s), sk_y + int(16 * s)), (sk_x + int(66 * s), sk_y + int(18 * s)), c_sk, max(2, int(5 * s)), cv2.LINE_AA)


# ==============================================================================
# 8. MODERN BIRD IN FLIGHT (Act 6 Avian Dinosaur Descendant)
# ==============================================================================
def draw_soaring_bird(img, cx, cy, scale=1.0, phase=0.0, tint="bluebird", facing=1):
    """Graceful articulated bird taking flight in Act 6."""
    s = scale
    d = facing
    flap = math.sin(phase * 3.2) * 34 * s

    if tint == "eagle":
        c_wing_b = (55, 85, 135)
        c_body = (72, 115, 178)
        c_wing_f = (95, 148, 222)
        c_belly = (195, 225, 248)
    else:
        c_wing_b = (165, 95, 35)
        c_body = (215, 135, 52)
        c_wing_f = (245, 175, 78)
        c_belly = (225, 240, 252)
    c_outline = (25, 38, 55)

    # Back wing
    wb = [
        (cx, cy - 4 * s),
        (cx - d * 28 * s, cy - (45 - flap * 0.8) * s),
        (cx - d * 68 * s, cy - (28 - flap) * s),
        (cx - d * 18 * s, cy + 4 * s),
    ]
    draw_smooth_poly(img, wb, c_wing_b, c_outline, outline_thick=2, closed=True, interp=5)

    # Tail fan + streamlined body + head
    body = [
        (cx - d * 54 * s, cy + 12 * s),
        (cx - d * 48 * s, cy - 4 * s),
        (cx - d * 18 * s, cy - 8 * s),
        (cx + d * 18 * s, cy - 14 * s),
        (cx + d * 36 * s, cy - 22 * s),
        (cx + d * 52 * s, cy - 16 * s),
        (cx + d * 34 * s, cy - 6 * s),
        (cx + d * 8 * s, cy + 12 * s),
        (cx - d * 22 * s, cy + 10 * s),
    ]
    draw_smooth_poly(img, body, c_body, c_outline, outline_thick=2, closed=True, interp=6)

    # Golden beak
    beak = np.array([
        [int(cx + d * 48 * s), int(cy - 19 * s)],
        [int(cx + d * 64 * s), int(cy - 14 * s)],
        [int(cx + d * 48 * s), int(cy - 11 * s)],
    ], dtype=np.int32)
    cv2.fillPoly(img, [beak], (45, 195, 255), lineType=cv2.LINE_AA)

    # Front wing with primary feather tips
    wf = [
        (cx + d * 6 * s, cy),
        (cx - d * 16 * s, cy + (34 + flap * 0.9) * s),
        (cx - d * 64 * s, cy + (48 + flap * 1.1) * s),
        (cx - d * 24 * s, cy + 6 * s),
    ]
    draw_smooth_poly(img, wf, c_wing_f, c_outline, outline_thick=2, closed=True, interp=5)
    draw_eye(img, cx + d * 40 * s, cy - 16 * s, 3.2 * s, iris_color=(240, 245, 255))
