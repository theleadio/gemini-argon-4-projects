import math
import multiprocessing as mp
import os
import subprocess
import time
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

from dino_rigs import (
    catmull_rom_spline,
    draw_smooth_poly,
    draw_coelophysis,
    draw_brachiosaurus,
    draw_stegosaurus,
    draw_trex,
    draw_triceratops,
    draw_pterosaur,
    draw_theropod_skeleton_and_feathers,
    draw_soaring_bird,
)

W, H = 1920, 1080
FPS = 30
DURATION = 60.0
TOTAL_FRAMES = int(FPS * DURATION)

FONT_PATH_MAIN = "/System/Library/Fonts/Hiragino Sans GB.ttc"
FONT_PATH_BOLD = "/System/Library/Fonts/STHeiti Medium.ttc"
if not os.path.exists(FONT_PATH_MAIN):
    FONT_PATH_MAIN = FONT_PATH_BOLD

# Load fonts once per worker
FONTS = {}


def get_font(size, bold=False):
    key = (size, bold)
    if key not in FONTS:
        path = FONT_PATH_BOLD if bold else FONT_PATH_MAIN
        FONTS[key] = ImageFont.truetype(path, size)
    return FONTS[key]


# Exact subtitle timings matching generate_audio.py
SUBTITLES = [
    (0.40, 4.68, "两亿三千万年前 · 盘古大陆上最早的恐龙悄然诞生", "230 Million Years Ago · The First Dinosaurs Emerge on Pangaea"),
    (4.68, 8.85, "敏捷的始盗龙与腔骨龙，开启了一亿六千万年的演化传奇", "Agile Eoraptor & Coelophysis Begin a 165-Million-Year Dynasty"),
    (9.25, 14.35, "进入侏罗纪 · 大陆裂解，温暖气候孕育出茂密的远古森林", "The Jurassic Period · Lush Conifer & Fern Forests Flourish"),
    (14.50, 19.75, "腕龙演化出高耸长颈采食树冠，剑龙披上坚固骨板与尾刺", "Towering Brachiosaurus & Armored Stegosaurus Rule the Land"),
    (20.25, 25.75, "白垩纪巅峰 · 恐龙王朝迎来了空前的繁盛与多样化", "The Cretaceous Peak · The Golden Age of Dinosaur Diversity"),
    (25.90, 31.75, "顶级掠食者霸王龙与三角龙正面对决，翼龙在天际展翅翱翔", "Apex Predator T-Rex Clashes with Triceratops Under Soaring Pterosaurs"),
    (32.25, 36.85, "六千六百万年前 · 直径10公里的小行星撞击尤卡坦半岛", "66 Million Years Ago · A 10-km Asteroid Strikes Chicxulub"),
    (37.00, 41.80, "遮天蔽日的尘埃阻断阳光，冲击与寒冬终结了非鸟恐龙时代", "Global Ash Clouds Block the Sun, Ending the Non-Avian Dinosaurs"),
    (42.25, 46.60, "漫长岁月将骨骼封存于岩层深处，化作跨越时空的化石密码", "Deep Geological Strata Preserve Their Skeletons as Fossils"),
    (46.65, 50.85, "古生物学家发现羽毛印痕，重现了温血、披羽的真实恐龙面貌", "Feather Impressions Reveal Active, Warm-Blooded Prehistoric Life"),
    (51.15, 55.35, "恐龙并未完全灭绝 · 兽脚类恐龙的一支演化成为现代鸟类", "Dinosaurs Never Truly Vanished · Theropods Evolved into Modern Birds"),
    (55.38, 59.80, "今天每一只掠过天空的飞鸟，都是恐龙家族延续至今的血脉", "Every Bird in the Sky Today Carries the Living Legacy of Dinosaurs"),
]


def make_vertical_gradient(top_bgr, mid_bgr, bot_bgr, split_y=0.55):
    """Create a smooth 3-stop vertical gradient image (H, W, 3) uint8."""
    y = np.linspace(0, 1, H, dtype=np.float32)[:, None]
    c_top = np.array(top_bgr, dtype=np.float32)
    c_mid = np.array(mid_bgr, dtype=np.float32)
    c_bot = np.array(bot_bgr, dtype=np.float32)

    grad = np.zeros((H, 3), dtype=np.float32)
    mask1 = (y <= split_y).squeeze()
    t1 = (y[mask1] / max(0.01, split_y))
    grad[mask1] = c_top * (1 - t1) + c_mid * t1

    t2 = ((y[~mask1] - split_y) / max(0.01, 1.0 - split_y))
    grad[~mask1] = c_mid * (1 - t2) + c_bot * t2

    grad_u8 = np.clip(grad, 0, 255).astype(np.uint8)
    return np.broadcast_to(grad_u8[:, None, :], (H, W, 3)).copy()


def draw_glow_circle(img, cx, cy, radii_colors):
    """Draw multi-layered soft glowing orb (sun, fireball, aura)."""
    overlay = img.copy()
    for r, col, alpha in radii_colors:
        cv2.circle(overlay, (int(cx), int(cy)), int(r), col, -1, cv2.LINE_AA)
        cv2.addWeighted(overlay, alpha, img, 1.0 - alpha, 0, dst=img)


def draw_fern_cluster(img, cx, cy, scale=1.0, sway=0.0, color_dark=(42, 92, 48), color_light=(68, 148, 72)):
    """Draw an illustrated prehistoric fern / cycad bush with animated fronds."""
    s = scale
    fronds = [(-1.1, 75), (-0.7, 95), (-0.3, 110), (0.15, 105), (0.6, 90), (1.05, 72)]
    for idx, (base_ang, length) in enumerate(fronds):
        ang = base_ang + sway * (0.6 + 0.1 * (idx % 3))
        col = color_light if idx % 2 == 0 else color_dark
        pts = []
        for step in np.linspace(0, 1, 7):
            r = length * s * step
            curve_a = ang + step * step * (0.35 if base_ang >= 0 else -0.35)
            px = cx + math.sin(curve_a) * r
            py = cy - math.cos(curve_a) * r
            pts.append((int(px), int(py)))
        for i in range(len(pts) - 1):
            cv2.line(img, pts[i], pts[i + 1], col, max(2, int((5 - i * 0.5) * s)), cv2.LINE_AA)
            if i >= 1:
                leaf_len = (18 - i * 2.2) * s
                lx1 = int(pts[i][0] + math.cos(ang) * leaf_len)
                ly1 = int(pts[i][1] + math.sin(ang) * leaf_len * 0.4)
                lx2 = int(pts[i][0] - math.cos(ang) * leaf_len)
                ly2 = int(pts[i][1] - math.sin(ang) * leaf_len * 0.4)
                cv2.line(img, pts[i], (lx1, ly1), col, max(1, int(3 * s)), cv2.LINE_AA)
                cv2.line(img, pts[i], (lx2, ly2), col, max(1, int(3 * s)), cv2.LINE_AA)


def draw_araucaria_tree(img, tx, ty, h=380, scale=1.0, sway=0.0, trunk_col=(48, 68, 92), canopy_col=(62, 128, 75)):
    """Draw a prehistoric Jurassic Araucaria (monkey-puzzle conifer) tree."""
    s = scale
    top_x = tx + sway * 12 * s
    top_y = ty - h * s
    trunk = np.array([
        [int(tx - 14 * s), int(ty)],
        [int(top_x - 4 * s), int(top_y)],
        [int(top_x + 4 * s), int(top_y)],
        [int(tx + 14 * s), int(ty)],
    ], dtype=np.int32)
    cv2.fillPoly(img, [trunk], trunk_col, lineType=cv2.LINE_AA)

    tiers = [
        (0.58, 95, 22),
        (0.70, 115, 24),
        (0.82, 102, 22),
        (0.93, 82, 20),
        (1.02, 56, 18),
    ]
    for frac, rx, ry in tiers:
        cx = int(tx + (top_x - tx) * frac)
        cy = int(ty - h * s * frac)
        cv2.ellipse(img, (cx, cy + int(4 * s)), (int(rx * s), int(ry * s)), 0, 0, 360, (38, 82, 48), -1, cv2.LINE_AA)
        cv2.ellipse(img, (cx, cy), (int(rx * s), int(ry * s)), 0, 0, 360, canopy_col, -1, cv2.LINE_AA)


def draw_mountain_range(img, y_base, peaks, color, scroll_x=0.0):
    """Draw a stylized geometric/spline mountain range layer."""
    pts = [(0, H), (0, y_base)]
    for px, py in peaks:
        pts.append((int(px - scroll_x), int(py)))
    pts.extend([(W, y_base), (W, H)])
    cv2.fillPoly(img, [np.array(pts, dtype=np.int32)], color, lineType=cv2.LINE_AA)


# ==============================================================================
# ACT 1 (0.0s - 9.0s): TRIASSIC DAWN ON PANGAEA (三叠纪：盘古大陆的黎明)
# ==============================================================================
def render_act1(t):
    local_t = t
    img = make_vertical_gradient(
        top_bgr=(42, 32, 85),     # Deep Triassic dawn violet
        mid_bgr=(58, 108, 215),   # Warm amber-crimson horizon
        bot_bgr=(45, 78, 145),    # Red-bed desert floor
        split_y=0.62,
    )

    # Glowing Triassic Rising Sun
    sun_y = int(560 - local_t * 14)
    draw_glow_circle(img, 1420, sun_y, [
        (260, (80, 150, 250), 0.14),
        (165, (110, 195, 255), 0.25),
        (95, (185, 238, 255), 0.85),
    ])

    # Distant Permian-Triassic volcanic silhouettes & smoke plume
    volcano_peaks = [(-100, 620), (180, 440), (240, 440), (480, 610), (820, 520), (1180, 600), (1620, 480), (2050, 610)]
    draw_mountain_range(img, 640, volcano_peaks, (48, 52, 105), scroll_x=local_t * 12)

    # Volcanic lava glow & ash puffs on peak 1
    vx = int(210 - local_t * 12)
    draw_glow_circle(img, vx, 440, [(45, (40, 120, 255), 0.35), (18, (120, 220, 255), 0.75)])
    for i in range(5):
        py = int(410 - i * 32 - (local_t * 18) % 32)
        px = int(vx + math.sin(local_t * 1.5 + i) * 18 + i * 8)
        draw_glow_circle(img, px, py, [(22 + i * 7, (72, 70, 110), 0.28)])

    # Midground Pangaea red-sandstone mesas & dunes
    dune_pts = [
        (0, 740),
        (320, 665),
        (760, 710),
        (1240, 655),
        (1680, 695),
        (1920, 670),
        (1920, 1080),
        (0, 1080),
    ]
    draw_smooth_poly(img, dune_pts, (52, 88, 168), None, closed=True, interp=8)

    # Foreground Triassic red-earth floor
    fg_pts = [
        (0, 790),
        (480, 765),
        (1050, 785),
        (1560, 755),
        (1920, 775),
        (1920, 1080),
        (0, 1080),
    ]
    draw_smooth_poly(img, fg_pts, (38, 66, 132), None, closed=True, interp=8)

    # Animated Pangaea Supercontinent Holographic Map in upper-left sky
    map_cx, map_cy = 210, 285
    draw_glow_circle(img, map_cx, map_cy, [(125, (140, 180, 255), 0.14), (95, (180, 210, 255), 0.18)])
    cv2.circle(img, (map_cx, map_cy), 95, (120, 175, 240), 2, cv2.LINE_AA)
    # Latitude/longitude arcs
    cv2.ellipse(img, (map_cx, map_cy), (95, 38), 0, 0, 360, (90, 135, 195), 1, cv2.LINE_AA)
    cv2.ellipse(img, (map_cx, map_cy), (44, 95), 0, 0, 360, (90, 135, 195), 1, cv2.LINE_AA)
    # Pangaea C-shaped supercontinent vector silhouette
    pangaea_pts = [
        (map_cx - 28, map_cy - 62),
        (map_cx + 24, map_cy - 48),
        (map_cx + 38, map_cy - 16),
        (map_cx + 8, map_cy - 4),
        (map_cx + 34, map_cy + 24),
        (map_cx + 6, map_cy + 62),
        (map_cx - 24, map_cy + 48),
        (map_cx - 42, map_cy + 8),
        (map_cx - 34, map_cy - 28),
    ]
    draw_smooth_poly(img, pangaea_pts, (75, 155, 225), (175, 230, 255), outline_thick=2, closed=True, interp=5)
    cv2.line(img, (map_cx + 95, map_cy - 15), (345, 245), (140, 205, 255), 2, cv2.LINE_AA)

    # Prehistoric horsetail plants & sparse Triassic ferns
    sway = math.sin(local_t * 2.2) * 0.12
    for fx, fy, fs in [(180, 820, 0.75), (680, 790, 0.65), (1320, 800, 0.8), (1740, 830, 0.9)]:
        draw_fern_cluster(img, int(fx - local_t * 24), fy, scale=fs, sway=sway, color_dark=(42, 85, 62), color_light=(65, 128, 88))

    # Animated Coelophysis & Eoraptor pack running across Pangaea!
    # Background smaller runner
    x_bg = 380 + local_t * 95
    draw_coelophysis(img, x_bg, 710, scale=0.72, phase=local_t * 9.5 + 1.2, tint="green", facing=1)

    # Foreground hero Eoraptor / Coelophysis
    x_fg = 220 + local_t * 115
    draw_coelophysis(img, x_fg, 785, scale=1.18, phase=local_t * 10.5, tint="amber", facing=1)

    # Second companion runner entering from left
    x_fg2 = -80 + local_t * 122
    draw_coelophysis(img, x_fg2, 825, scale=0.95, phase=local_t * 11.0 + 2.4, tint="amber", facing=1)

    # Dust particles kicked up behind runners
    np.random.seed(101)
    for i in range(28):
        px = int((np.random.randint(0, W) - local_t * (60 + i * 3)) % W)
        py = int(680 + (i * 13) % 220 - math.sin(local_t * 2 + i) * 12)
        cv2.circle(img, (px, py), 2 + (i % 3), (125, 178, 235), -1, cv2.LINE_AA)

    cards = [
        (345, 205, "盘古超大陆 · PANGAEA", "二叠纪大灭绝后，幸存的主龙类演化出最早的恐龙"),
        (int(min(1320, max(520, x_fg - 110))), 545, "始盗龙 & 腔骨龙 (230 Ma)", "双足疾驰 · 中空骨骼 · 恐龙王朝的黎明先驱"),
    ]
    return img, cards


# ==============================================================================
# ACT 2 (9.0s - 20.0s): JURASSIC GIANTS (侏罗纪：巨龙与远古森林)
# ==============================================================================
def render_act2(t):
    local_t = t - 9.0
    img = make_vertical_gradient(
        top_bgr=(148, 118, 42),   # Lush cyan-teal Jurassic sky
        mid_bgr=(142, 188, 118),  # Warm misty emerald horizon
        bot_bgr=(58, 98, 52),     # Deep moss forest floor
        split_y=0.60,
    )

    # Diagonal golden sunbeams filtering through the Jurassic canopy
    beam_overlay = img.copy()
    for bx in [280, 680, 1120, 1520]:
        shift = int(math.sin(local_t * 0.6 + bx * 0.01) * 25)
        beam = np.array([
            [bx + shift, 0],
            [bx + 140 + shift, 0],
            [bx + 420 + shift, H],
            [bx + 190 + shift, H],
        ], dtype=np.int32)
        cv2.fillPoly(beam_overlay, [beam], (185, 235, 220), lineType=cv2.LINE_AA)
    cv2.addWeighted(beam_overlay, 0.12, img, 0.88, 0, dst=img)

    # Distant misty Jurassic mountains
    peaks = [(-50, 590), (280, 430), (640, 540), (1040, 395), (1460, 520), (1780, 445), (2020, 580)]
    draw_mountain_range(img, 600, peaks, (98, 138, 88), scroll_x=local_t * 8)

    # Background Araucaria conifer forest
    sway = math.sin(local_t * 1.6) * 0.15
    for tx, ty, th, ts in [(160, 690, 340, 0.78), (520, 680, 390, 0.88), (980, 695, 360, 0.82), (1420, 685, 420, 0.95), (1790, 700, 350, 0.80)]:
        draw_araucaria_tree(img, int(tx - local_t * 10), ty, h=th, scale=ts, sway=sway)

    # Midground rolling fern meadow
    meadow_pts = [
        (0, 685), (450, 660), (980, 690), (1480, 665), (1920, 685), (1920, 1080), (0, 1080)
    ]
    draw_smooth_poly(img, meadow_pts, (62, 112, 58), None, closed=True, interp=8)

    # Foreground lush floor
    fg_pts = [
        (0, 795), (520, 775), (1140, 805), (1620, 780), (1920, 795), (1920, 1080), (0, 1080)
    ]
    draw_smooth_poly(img, fg_pts, (42, 82, 42), None, closed=True, interp=8)

    # Towering Hero BRACHIOSAURUS on the left, grazing the high Araucaria canopy!
    brach_x = 460 + local_t * 18
    draw_brachiosaurus(img, brach_x, 665, scale=1.22, phase=local_t * 2.2, facing=1)

    # Second distant Brachiosaurus silhouette in the misty background
    draw_brachiosaurus(img, 860 + local_t * 10, 625, scale=0.62, phase=local_t * 2.0 + 1.5, facing=1)

    # Foreground Hero STEGOSAURUS walking on the right with vascular dorsal plates!
    stego_x = 1480 - local_t * 24
    draw_stegosaurus(img, stego_x, 785, scale=1.18, phase=local_t * 3.2, facing=-1)

    # Gliding Archaeopteryx / early feathered flyer between trees
    fly_x = 620 + local_t * 85
    fly_y = 330 + math.sin(local_t * 3.0) * 28
    draw_soaring_bird(img, fly_x, fly_y, scale=0.72, phase=local_t * 4.0, tint="eagle", facing=1)

    # Foreground lush Jurassic ferns
    for fx, fy, fs in [(110, 890, 1.1), (780, 875, 0.95), (1220, 895, 1.05), (1820, 885, 1.15)]:
        draw_fern_cluster(img, int(fx - local_t * 16), fy, scale=fs, sway=sway * 1.3)

    # Drifting golden pollen/spores
    np.random.seed(202)
    for i in range(32):
        px = int((np.random.randint(0, W) + local_t * (22 + i)) % W)
        py = int((np.random.randint(120, 860) - local_t * 15) % 760 + 100)
        cv2.circle(img, (px, py), 2 + (i % 3), (155, 238, 245), -1, cv2.LINE_AA)

    cards = [
        (int(brach_x + 195), 250, "腕龙 · Brachiosaurus", "体长 25米 · 高耸长颈直达15米树冠层"),
        (int(stego_x - 210), 590, "剑龙 · Stegosaurus", "背部17块骨板调节体温 · 四根尾刺防御掠食者"),
    ]
    return img, cards


# ==============================================================================
# ACT 3 (20.0s - 32.0s): CRETACEOUS PEAK DUEL (白垩纪巅峰：霸王龙 vs 三角龙)
# ==============================================================================
def render_act3(t):
    local_t = t - 20.0
    img = make_vertical_gradient(
        top_bgr=(58, 52, 98),     # Dramatic Cretaceous twilight-gold sky
        mid_bgr=(68, 128, 222),   # Fiery golden-orange horizon
        bot_bgr=(45, 72, 62),     # Warm Cretaceous floodplain
        split_y=0.58,
    )

    # Dramatic setting sun between the two titans
    draw_glow_circle(img, 960, 490, [
        (280, (65, 145, 245), 0.16),
        (170, (95, 185, 255), 0.28),
        (95, (165, 232, 255), 0.80),
    ])

    # Distant Cretaceous mountain ridges
    peaks = [(-50, 600), (310, 465), (680, 555), (1120, 480), (1540, 435), (1960, 590)]
    draw_mountain_range(img, 610, peaks, (52, 65, 95), scroll_x=local_t * 6)

    # Soaring Pterosaurs (Quetzalcoatlus / Pteranodon) in the sky!
    draw_pterosaur(img, 420 + local_t * 68, 255 + math.sin(local_t * 2.0) * 22, scale=0.95, phase=local_t * 3.0, facing=1)
    draw_pterosaur(img, 1480 - local_t * 58, 210 + math.cos(local_t * 2.2) * 18, scale=0.75, phase=local_t * 3.4 + 1.0, facing=-1)

    # Floodplain terrain
    ground_pts = [
        (0, 735), (480, 715), (960, 730), (1440, 710), (1920, 735), (1920, 1080), (0, 1080)
    ]
    draw_smooth_poly(img, ground_pts, (48, 78, 65), None, closed=True, interp=8)

    fg_pts = [
        (0, 815), (620, 795), (1280, 810), (1920, 790), (1920, 1080), (0, 1080)
    ]
    draw_smooth_poly(img, fg_pts, (36, 58, 48), None, closed=True, interp=8)

    # TYRANNOSAURUS REX advancing from the left & roaring!
    trex_x = 520 + min(85.0, local_t * 9.5)
    roar_amt = 0.5 + 0.5 * math.sin(local_t * 2.6 - 0.8)
    draw_trex(img, trex_x, 705, scale=1.32, phase=local_t * 3.2, roar=roar_amt, facing=1)

    # Sound-wave / roar shock rings when T-Rex roars wide
    if roar_amt > 0.72:
        mouth_x = int(trex_x + 165)
        mouth_y = int(705 - 75)
        for r_idx in range(3):
            rad = int(35 + r_idx * 28 + (local_t * 60) % 28)
            cv2.ellipse(img, (mouth_x, mouth_y), (rad, int(rad * 0.65)), 0, -45, 45, (110, 210, 255), 2, cv2.LINE_AA)

    # TRICERATOPS standing its ground on the right with lowered horns & ornate frill!
    tri_x = 1420 - min(75.0, local_t * 8.0)
    draw_triceratops(img, tri_x, 735, scale=1.28, phase=local_t * 3.0, facing=-1)

    # Foreground ferns & Cretaceous flowering plants (angiosperms!)
    sway = math.sin(local_t * 2.0) * 0.14
    for fx, fy, fs in [(140, 885, 0.95), (960, 895, 0.85), (1780, 880, 1.0)]:
        draw_fern_cluster(img, fx, fy, scale=fs, sway=sway)
        # Early Cretaceous flowers (magnolia-like blossoms)
        cv2.circle(img, (fx + 18, fy - 42), 7, (165, 145, 245), -1, cv2.LINE_AA)
        cv2.circle(img, (fx - 22, fy - 35), 6, (140, 215, 255), -1, cv2.LINE_AA)

    cards = [
        (int(trex_x - 140), 470, "霸王龙 · Tyrannosaurus rex", "体长 13米 · 咬合力高达6吨 · 陆地最强掠食者"),
        (int(tri_x - 110), 495, "三角龙 · Triceratops", "体长 9米 · 坚固骨质颈盾与三根长角正面对决"),
        (760, 185, "风神翼龙 · Quetzalcoatlus", "翼展可达10米以上 · 天空中的飞行巨兽"),
    ]
    return img, cards


# ==============================================================================
# ACT 4 (32.0s - 42.0s): CHICXULUB ASTEROID IMPACT (白垩纪末日：小行星撞击)
# ==============================================================================
def render_act4(t):
    local_t = t - 32.0
    impact_t = local_t - 1.2
    flash = math.exp(-((local_t - 1.35) ** 2) / 0.18) if local_t > 0.6 else 0.0

    # Sky darkens progressively after impact as ash clouds roll in
    darkness = min(1.0, max(0.0, (local_t - 2.0) / 5.5))
    top_c = (int(48 * (1 - 0.5 * darkness)), int(22 * (1 - 0.5 * darkness)), int(75 * (1 - 0.3 * darkness)))
    mid_c = (int(45 * (1 - 0.4 * darkness)), int(62 * (1 - 0.5 * darkness)), int(185 * (1 - 0.35 * darkness)))
    bot_c = (24, 28, 48)
    img = make_vertical_gradient(top_c, mid_c, bot_c, split_y=0.62)

    # Screen camera shake right after impact (1.2s to 3.8s)
    shake_x, shake_y = 0, 0
    if 1.1 < local_t < 4.0:
        amp = math.exp(-(local_t - 1.1) * 1.1) * 18
        shake_x = int(math.sin(local_t * 48) * amp)
        shake_y = int(math.cos(local_t * 42) * amp)

    # Impact horizon point
    imp_x, imp_y = 1360 + shake_x, 595 + shake_y

    if local_t < 1.35:
        # Giant 10-km Asteroid streaking across the sky toward Chicxulub!
        prog = local_t / 1.35
        ast_x = int(280 + prog * (imp_x - 280))
        ast_y = int(110 + prog * (imp_y - 110))
        for ti in range(18):
            frac = ti / 18.0
            tx = int(ast_x - frac * 380)
            ty = int(ast_y - frac * 210)
            r = int((1.0 - frac) * 58 + 8)
            col = (80, int(140 + (1 - frac) * 110), 255)
            draw_glow_circle(img, tx, ty, [(r, col, 0.22 * (1 - frac))])
        draw_glow_circle(img, ast_x, ast_y, [(95, (80, 165, 255), 0.35), (52, (180, 235, 255), 0.85)])
        ast_poly = [
            (ast_x - 32, ast_y - 18), (ast_x - 10, ast_y - 34), (ast_x + 28, ast_y - 24),
            (ast_x + 36, ast_y + 12), (ast_x + 12, ast_y + 32), (ast_x - 28, ast_y + 22)
        ]
        draw_smooth_poly(img, ast_poly, (75, 95, 135), (160, 225, 255), outline_thick=3, closed=True, interp=5)
    else:
        # Colossal Fireball Dome & Expanding Shockwave Rings on the Horizon!
        dome_r = int(min(620, 140 + impact_t * 115))
        draw_glow_circle(img, imp_x, imp_y, [
            (int(dome_r * 1.45), (45, 85, 235), 0.24 * (1 - 0.35 * darkness)),
            (dome_r, (75, 155, 255), 0.42 * (1 - 0.25 * darkness)),
            (int(dome_r * 0.55), (175, 235, 255), 0.78 * (1 - 0.25 * darkness)),
        ])
        # Supersonic shockwave ellipses
        for sw_i in range(3):
            sw_r = int((impact_t * 260 - sw_i * 140))
            if 40 < sw_r < 1600:
                cv2.ellipse(
                    img, (imp_x, imp_y), (sw_r, int(sw_r * 0.32)),
                    0, 180, 360, (145, 215, 255), max(1, 4 - sw_i), cv2.LINE_AA
                )

        # Billowing multi-puff volcanic/ejecta ash cloud column
        plume_h = int(min(380, 90 + impact_t * 50))
        for p_idx, (ox, oy, rx_m, ry_m) in enumerate([(-220, -20, 0.7, 0.45), (0, -45, 1.0, 0.55), (210, -15, 0.75, 0.45), (-90, 35, 0.55, 0.4), (110, 40, 0.55, 0.4)]):
            prx = int(min(520, (120 + impact_t * 95) * rx_m))
            pry = int(min(140, plume_h * ry_m))
            pcx = imp_x + int(ox * min(1.8, 0.6 + impact_t * 0.2))
            pcy = max(165, imp_y - plume_h + oy)
            # Warm fiery under-glow on cloud puffs
            cv2.ellipse(img, (pcx, pcy + 14), (prx, pry), 0, 0, 360, (48, 72, 145), -1, cv2.LINE_AA)
            cv2.ellipse(img, (pcx, pcy), (prx, pry), 0, 0, 360, (38, 34, 52), -1, cv2.LINE_AA)

    # Secondary burning ejecta meteors raining down across the sky
    if local_t > 1.6:
        np.random.seed(404)
        for mi in range(14):
            m_start = 1.4 + mi * 0.32
            if local_t > m_start:
                mt = (local_t - m_start) % 3.0
                mx = int((260 + mi * 125) - mt * 180) + shake_x
                my = int(125 + (mi % 4) * 40 + mt * 195) + shake_y
                if my < 620:
                    cv2.line(img, (mx + 52, my - 54), (mx, my), (75, 155, 255), 3, cv2.LINE_AA)
                    cv2.circle(img, (mx, my), 5, (200, 245, 255), -1, cv2.LINE_AA)

    # Silhouetted mountain range & ground with dramatic rim lighting
    peaks = [(-50, 620), (320, 510), (740, 585), (1160, 540), (1620, 520), (1980, 610)]
    draw_mountain_range(img, 630 + shake_y, peaks, (28, 24, 42), scroll_x=-shake_x)

    fg_pts = [
        (0, 775 + shake_y), (580, 755 + shake_y), (1240, 770 + shake_y), (1920, 750 + shake_y), (1920, 1080), (0, 1080)
    ]
    draw_smooth_poly(img, fg_pts, (20, 18, 32), None, closed=True, interp=8)

    # Dinosaurs in foreground looking toward the impact fireball (positioned cleanly below cards)
    draw_brachiosaurus(img, 420 + shake_x, 710 + shake_y, scale=0.88, phase=local_t * 1.2, facing=1)
    draw_trex(img, 840 + shake_x, 745 + shake_y, scale=0.98, phase=local_t * 1.5, roar=0.85, facing=1)

    # Falling volcanic ash snow in the second half of Act 4
    if darkness > 0.2:
        np.random.seed(409)
        for ai in range(45):
            ax = int((np.random.randint(0, W) - local_t * (30 + ai % 15)) % W)
            ay = int((np.random.randint(110, H) + local_t * (55 + ai % 20)) % H)
            cv2.circle(img, (ax, ay), 2 + (ai % 2), (165, 165, 178), -1, cv2.LINE_AA)

    # Flash overlay at exact moment of impact
    if flash > 0.02:
        white = np.full_like(img, 245)
        cv2.addWeighted(white, min(0.78, flash), img, 1.0 - min(0.78, flash), 0, dst=img)

    cards = [
        (80, 135, "希克苏鲁伯陨石撞击 · 66.0 Ma", "直径10公里小行星 · 释放能量相当于100万亿吨TNT"),
        (80, 232, "白垩纪-古近纪灭绝事件 (K-Pg)", "全球尘埃遮蔽阳光 · 约75%地球物种与非鸟恐龙灭绝"),
    ]
    return img, cards


# ==============================================================================
# ACT 5 (42.0s - 51.0s): FOSSILS & FEATHERED RECONSTRUCTION (化石密码与羽毛印痕)
# ==============================================================================
def render_act5(t):
    local_t = t - 42.0
    img = make_vertical_gradient(
        top_bgr=(44, 34, 24),     # Deep museum-blueprint slate
        mid_bgr=(38, 48, 62),     # Warm sedimentary rock amber-slate
        bot_bgr=(26, 32, 44),     # Deep earth crust
        split_y=0.52,
    )

    # Sedimentary Geological Strata Bands across background
    strata_colors = [
        (180, 260, (48, 56, 72)),
        (260, 360, (54, 68, 88)),
        (360, 480, (46, 62, 82)),
        (480, 620, (58, 76, 98)),
        (620, 760, (44, 58, 76)),
        (760, 920, (36, 46, 62)),
    ]
    for y0, y1, scol in strata_colors:
        pts = [(0, y0)]
        for x in range(0, W + 160, 160):
            wy = y0 + int(math.sin(x * 0.005 + y0 * 0.02) * 14)
            pts.append((x, wy))
        pts.extend([(W, y1), (0, y1)])
        cv2.fillPoly(img, [np.array(pts, dtype=np.int32)], scol, lineType=cv2.LINE_AA)

    # Subtle blueprint coordinate grid overlay
    grid_overlay = img.copy()
    for gx in range(0, W, 80):
        cv2.line(grid_overlay, (gx, 110), (gx, H - 120), (120, 165, 195), 1)
    for gy in range(110, H - 120, 80):
        cv2.line(grid_overlay, (0, gy), (W, gy), (120, 165, 195), 1)
    cv2.addWeighted(grid_overlay, 0.12, img, 0.88, 0, dst=img)

    # X-Ray Paleontology Scanner Beam sweeping from left to right!
    scan_prog = min(1.0, max(0.0, (local_t - 0.6) / 6.8))
    scan_x = int(260 + scan_prog * 1420)

    # Draw the Hero Anatomical Dinosaur Skeleton + Feathered Plumage Reveal!
    draw_theropod_skeleton_and_feathers(img, 960, 550, scale=1.50, scan_x=scan_x, phase=local_t * 3.0)

    # Glowing vertical laser scanner bar at scan_x
    if 0.02 < scan_prog < 0.98:
        laser_overlay = img.copy()
        cv2.rectangle(laser_overlay, (scan_x - 28, 120), (scan_x + 28, 860), (235, 225, 95), -1)
        cv2.addWeighted(laser_overlay, 0.24, img, 0.76, 0, dst=img)
        cv2.line(img, (scan_x, 120), (scan_x, 860), (255, 250, 190), 3, cv2.LINE_AA)

    # Anatomical callout pointer lines on the fossil/feathers
    callouts = [
        ((1130, 385), (1280, 260)),
        ((720, 525), (520, 290)),
        ((945, 710), (1240, 715)),
    ]
    for (p1, p2) in callouts:
        cv2.circle(img, p1, 6, (255, 230, 120), -1, cv2.LINE_AA)
        cv2.circle(img, p1, 12, (255, 230, 120), 2, cv2.LINE_AA)
        cv2.line(img, p1, p2, (220, 210, 130), 2, cv2.LINE_AA)

    cards = [
        (90, 210, "古生物学革命 · 羽毛恐龙复原", "中国辽西热河生物群等化石证实：众多兽脚类恐龙身披羽毛"),
        (1240, 200, "骨骼解剖密码 · 鸟类近亲", "叉骨、中空骨骼、后倾耻骨——连接恐龙与飞鸟的铁证"),
        (1240, 675, "镰刀状第二趾爪 · 捕猎利器", "驰龙类特有的高抬镰刀爪与平衡长尾，展现温血敏捷本能"),
    ]
    return img, cards


# ==============================================================================
# ACT 6 (51.0s - 60.0s): LIVING DESCENDANTS: BIRDS IN FLIGHT (飞向蓝天的恐龙后裔)
# ==============================================================================
def render_act6(t):
    local_t = t - 51.0
    img = make_vertical_gradient(
        top_bgr=(195, 125, 42),   # Radiant azure morning sky
        mid_bgr=(165, 215, 245),  # Warm golden-peach sunrise glow
        bot_bgr=(92, 148, 95),    # Lush modern green Earth
        split_y=0.62,
    )

    # Brilliant Sunrise of the Modern World
    draw_glow_circle(img, 1480, 440, [
        (320, (140, 215, 255), 0.22),
        (190, (185, 235, 255), 0.38),
        (95, (235, 252, 255), 0.90),
    ])

    # Distant modern mountain & serene lake horizon
    peaks = [(-50, 640), (340, 520), (760, 595), (1180, 510), (1620, 575), (1980, 630)]
    draw_mountain_range(img, 650, peaks, (118, 148, 112), scroll_x=local_t * 6)

    # Foreground green hillside
    hill_pts = [
        (0, 740), (540, 725), (1080, 765), (1620, 795), (1920, 815), (1920, 1080), (0, 1080)
    ]
    draw_smooth_poly(img, hill_pts, (64, 122, 68), None, closed=True, interp=8)

    # Seamless 4-Stage Evolutionary Trajectory Arc across the screen!
    # Connecting golden evolution arc from ground (bottom-left) to sky (top-right)
    arc_pts = [(240, 735), (620, 650), (1040, 485), (1480, 295)]
    arc_curve = catmull_rom_spline(arc_pts, num_interp=16, closed=False)
    for i in range(0, len(arc_curve) - 2, 2):
        cv2.line(img, tuple(arc_curve[i]), tuple(arc_curve[i + 1]), (145, 225, 255), 3, cv2.LINE_AA)

    # Stage 1: Running Feathered Theropod (bottom-left)
    draw_coelophysis(img, 260 + local_t * 8, 695, scale=0.88, phase=local_t * 9.0, tint="amber", facing=1)

    # Stage 2: Leaping Feathered Dromaeosaur / Microraptor (mid-left)
    draw_coelophysis(img, 630 + local_t * 10, 600 - math.sin(local_t * 3) * 12, scale=0.82, phase=local_t * 9.5 + 1.0, tint="green", facing=1)

    # Stage 3: Gliding Archaeopteryx (center-right)
    draw_soaring_bird(img, 1020 + local_t * 14, 465 + math.sin(local_t * 3.5) * 14, scale=1.05, phase=local_t * 3.8, tint="eagle", facing=1)

    # Stage 4: Modern Birds Soaring into the Sunrise Sky! (upper-right flock)
    draw_soaring_bird(img, 1420 + local_t * 22, 285 + math.cos(local_t * 3.2) * 16, scale=1.28, phase=local_t * 4.2, tint="bluebird", facing=1)

    # Companion flock of birds soaring across the sky
    flock = [
        (820, 240, 0.65, 0.5),
        (1180, 195, 0.78, 1.4),
        (1580, 180, 0.85, 2.2),
        (1680, 340, 0.72, 3.1),
        (1290, 320, 0.60, 0.9),
    ]
    for bx, by, bs, bp in flock:
        fx = bx + local_t * (28 * bs)
        fy = by + math.sin(local_t * 3.0 + bp) * 14
        draw_soaring_bird(img, fx, fy, scale=bs, phase=local_t * 4.0 + bp, tint="bluebird", facing=1)

    cards = [
        (95, 215, "演化从未止步 · 恐龙即飞鸟", "现代鸟类属于兽脚亚目手盗龙类——现存超过10,000种鸟类皆为恐龙后裔"),
    ]
    return img, cards


# ==============================================================================
# UI OVERLAYS: TIMELINE HUD, SPECIES CARDS, SUBTITLES & FINALE CARD
# ==============================================================================
def draw_rounded_box(draw, box, radius, fill, outline=None, width=2):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def render_ui_and_text(img_bgr, t, cards):
    """Render crisp Chinese typography, Top Geological Timeline HUD, Info Cards, and Subtitles via PIL RGBA."""
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(img_rgb).convert("RGBA")
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    # 1. TOP GEOLOGICAL TIMELINE BAR
    draw_rounded_box(
        draw, (50, 24, W - 50, 96), radius=18,
        fill=(14, 20, 32, 195), outline=(95, 165, 225, 160), width=2
    )

    eras = [
        (0.0, 9.0, "三叠纪 TRIASSIC", "252–201 Ma", (235, 135, 65)),
        (9.0, 20.0, "侏罗纪 JURASSIC", "201–145 Ma", (75, 195, 125)),
        (20.0, 32.0, "白垩纪 CRETACEOUS", "145–66 Ma", (240, 185, 65)),
        (32.0, 42.0, "K-Pg 大灭绝 IMPACT", "66.0 Ma", (245, 95, 95)),
        (42.0, 51.0, "化石发现 FOSSILS", "地层记忆", (95, 195, 245)),
        (51.0, 60.0, "现代飞鸟 AVIAN DINOS", "0 Ma · 今日", (120, 215, 255)),
    ]

    bar_x0, bar_x1 = 445, W - 70
    bar_w = bar_x1 - bar_x0

    # Title on top-left of HUD
    f_hud_title = get_font(24, bold=True)
    f_hud_sub = get_font(13, bold=False)
    draw.text((74, 36), "恐龙简史 · 跨越两亿年的传奇", font=f_hud_title, fill=(245, 250, 255, 255))
    draw.text((74, 67), "THE HISTORY OF DINOSAURS · 252 Ma–0 Ma", font=f_hud_sub, fill=(155, 195, 235, 230))

    f_era = get_font(17, bold=True)
    f_ma = get_font(13, bold=False)
    for s_t, e_t, e_name, e_ma, e_col in eras:
        x0 = int(bar_x0 + (s_t / DURATION) * bar_w)
        x1 = int(bar_x0 + (e_t / DURATION) * bar_w)
        active = s_t <= t < e_t or (e_t == 60.0 and t >= 51.0)
        bg_alpha = 215 if active else 75
        draw_rounded_box(
            draw, (x0 + 4, 34, x1 - 4, 86), radius=10,
            fill=(e_col[0], e_col[1], e_col[2], bg_alpha),
            outline=(255, 255, 255, 210 if active else 60),
            width=2 if active else 1
        )
        txt_col = (15, 20, 28, 255) if active else (225, 232, 240, 200)
        draw.text((x0 + 12, 39), e_name, font=f_era, fill=txt_col)
        draw.text((x0 + 12, 63), e_ma, font=f_ma, fill=txt_col)

    # Progress playhead dot along timeline
    play_x = int(bar_x0 + (t / DURATION) * bar_w)
    draw.ellipse((play_x - 7, 80, play_x + 7, 94), fill=(255, 245, 150, 255), outline=(20, 30, 45, 255), width=2)

    # 2. FLOATING SPECIES / INFO CALLOUT CARDS
    f_card_title = get_font(24, bold=True)
    f_card_desc = get_font(18, bold=False)
    for cx, cy, c_title, c_desc in cards:
        # Measure text width for dynamic card sizing
        tb1 = draw.textbbox((0, 0), c_title, font=f_card_title)
        tb2 = draw.textbbox((0, 0), c_desc, font=f_card_desc)
        cw = max(tb1[2] - tb1[0], tb2[2] - tb2[0]) + 44
        ch = 78
        cx_clamped = max(60, min(W - cw - 60, cx))
        cy_clamped = max(115, min(H - 220, cy))
        draw_rounded_box(
            draw, (cx_clamped, cy_clamped, cx_clamped + cw, cy_clamped + ch),
            radius=14, fill=(14, 22, 36, 195), outline=(115, 205, 255, 190), width=2
        )
        # Accent bar on left of card
        draw_rounded_box(
            draw, (cx_clamped + 10, cy_clamped + 14, cx_clamped + 16, cy_clamped + ch - 14),
            radius=3, fill=(255, 195, 75, 255)
        )
        draw.text((cx_clamped + 26, cy_clamped + 12), c_title, font=f_card_title, fill=(255, 232, 135, 255))
        draw.text((cx_clamped + 26, cy_clamped + 44), c_desc, font=f_card_desc, fill=(228, 238, 248, 245))

    # 3. ACT 6 EVOLUTION STAGE LABELS (when in Act 6)
    if t >= 51.0 and t < 57.4:
        f_stage = get_font(20, bold=True)
        stage_labels = [
            (170, 745, "① 兽脚类恐龙 (Theropod)"),
            (535, 650, "② 驰龙类/小盗龙 (Microraptor)"),
            (945, 520, "③ 始祖鸟 (Archaeopteryx)"),
            (1335, 345, "④ 现代飞鸟 (Modern Bird)"),
        ]
        for sx, sy, stxt in stage_labels:
            stb = draw.textbbox((0, 0), stxt, font=f_stage)
            sw = (stb[2] - stb[0]) + 32
            draw_rounded_box(draw, (sx, sy, sx + sw, sy + 38), radius=10, fill=(12, 24, 38, 195), outline=(140, 225, 255, 190), width=2)
            draw.text((sx + 16, sy + 7), stxt, font=f_stage, fill=(245, 252, 255, 255))

    # 4. GRAND FINALE TITLE OVERLAY (Last 2.6 seconds: 57.4s -> 60.0s)
    if t >= 57.4:
        alpha_fin = int(min(1.0, (t - 57.4) / 0.8) * 225)
        draw_rounded_box(
            draw, (420, 360, W - 420, 620), radius=26,
            fill=(12, 22, 38, alpha_fin), outline=(255, 215, 110, alpha_fin), width=3
        )
        f_big = get_font(54, bold=True)
        f_mid = get_font(26, bold=False)
        title_txt = "恐龙简史：生命从未止步"
        sub_txt = "从盘古大陆到浩瀚蓝天 · 跨越两亿三千万年的演化奇迹"
        tb_t = draw.textbbox((0, 0), title_txt, font=f_big)
        tb_s = draw.textbbox((0, 0), sub_txt, font=f_mid)
        draw.text(((W - (tb_t[2] - tb_t[0])) // 2, 415), title_txt, font=f_big, fill=(255, 238, 155, min(255, alpha_fin + 30)))
        draw.text(((W - (tb_s[2] - tb_s[0])) // 2, 505), sub_txt, font=f_mid, fill=(225, 242, 255, min(255, alpha_fin + 30)))

    # 5. SYNCHRONIZED BOTTOM SUBTITLE BAR
    active_sub = None
    for s_start, s_end, zh_txt, en_txt in SUBTITLES:
        if s_start <= t <= s_end:
            active_sub = (zh_txt, en_txt)
            break

    if active_sub is not None:
        zh_txt, en_txt = active_sub
        f_zh = get_font(36, bold=True)
        f_en = get_font(20, bold=False)
        tb_zh = draw.textbbox((0, 0), zh_txt, font=f_zh)
        tb_en = draw.textbbox((0, 0), en_txt, font=f_en)
        box_w = max(tb_zh[2] - tb_zh[0], tb_en[2] - tb_en[0]) + 84
        box_x0 = (W - box_w) // 2
        box_y0 = H - 132
        draw_rounded_box(
            draw, (box_x0, box_y0, box_x0 + box_w, H - 30),
            radius=20, fill=(10, 16, 26, 218), outline=(120, 195, 245, 170), width=2
        )
        zh_x = (W - (tb_zh[2] - tb_zh[0])) // 2
        en_x = (W - (tb_en[2] - tb_en[0])) // 2
        draw.text((zh_x, box_y0 + 14), zh_txt, font=f_zh, fill=(255, 255, 255, 255))
        draw.text((en_x, box_y0 + 62), en_txt, font=f_en, fill=(175, 215, 248, 235))

    combined = Image.alpha_composite(pil_img, overlay).convert("RGB")
    return cv2.cvtColor(np.array(combined), cv2.COLOR_RGB2BGR)


def render_scene_at_time(t):
    """Render the raw scene + cards for timestamp t."""
    if t < 9.0:
        return render_act1(t)
    elif t < 20.0:
        return render_act2(t)
    elif t < 32.0:
        return render_act3(t)
    elif t < 42.0:
        return render_act4(t)
    elif t < 51.0:
        return render_act5(t)
    else:
        return render_act6(t)


def render_frame(frame_idx):
    """Render a single frame with smooth cross-dissolve transitions at act boundaries."""
    t = frame_idx / FPS
    boundaries = [9.0, 20.0, 32.0, 42.0, 51.0]
    trans_half = 0.35  # 0.7s smooth crossfade between acts

    img, cards = render_scene_at_time(t)
    for b in boundaries:
        if abs(t - b) < trans_half:
            if t < b:
                img_next, _ = render_scene_at_time(b + 0.01)
                alpha = 0.5 * (1.0 - (b - t) / trans_half)
                img = cv2.addWeighted(img, 1.0 - alpha, img_next, alpha, 0)
            else:
                img_prev, _ = render_scene_at_time(b - 0.01)
                alpha = 0.5 * (1.0 - (t - b) / trans_half)
                img = cv2.addWeighted(img, 1.0 - alpha, img_prev, alpha, 0)
            break

    final_frame = render_ui_and_text(img, t, cards)

    # Smooth fade-in from black in first 0.5s, fade-out in last 0.4s
    if t < 0.5:
        final_frame = (final_frame.astype(np.float32) * (t / 0.5)).astype(np.uint8)
    elif t > 59.6:
        final_frame = (final_frame.astype(np.float32) * max(0.0, (60.0 - t) / 0.4)).astype(np.uint8)

    return final_frame


def render_chunk(args):
    """Worker process function: renders a range of frames directly to a chunk MP4 file."""
    chunk_id, start_f, end_f = args
    os.makedirs("build_chunks", exist_ok=True)
    chunk_path = f"build_chunks/chunk_{chunk_id:02d}.mp4"

    cmd = [
        "ffmpeg", "-y", "-v", "error",
        "-f", "rawvideo", "-vcodec", "rawvideo",
        "-s", f"{W}x{H}", "-pix_fmt", "bgr24",
        "-r", str(FPS), "-i", "-",
        "-c:v", "libx264", "-preset", "fast", "-crf", "18",
        "-pix_fmt", "yuv420p", chunk_path
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for f_idx in range(start_f, end_f):
        frame = render_frame(f_idx)
        proc.stdin.write(frame.tobytes())
    proc.stdin.close()
    proc.wait()
    return chunk_path


if __name__ == "__main__":
    t0 = time.time()
    os.makedirs("preview_frames", exist_ok=True)

    # First render 6 sample keyframes (1 per Act) so we can visually inspect them
    sample_times = [3.0, 14.0, 26.5, 34.0, 46.5, 55.5]
    for idx, st in enumerate(sample_times, 1):
        f_img = render_frame(int(st * FPS))
        cv2.imwrite(f"preview_frames/act_{idx}.png", f_img)
    print("Saved 6 preview frames to preview_frames/act_1..6.png")

    # Render all 1800 frames in parallel across 12 worker chunks
    num_chunks = 12
    frames_per_chunk = TOTAL_FRAMES // num_chunks
    tasks = []
    for cid in range(num_chunks):
        sf = cid * frames_per_chunk
        ef = TOTAL_FRAMES if cid == num_chunks - 1 else (cid + 1) * frames_per_chunk
        tasks.append((cid, sf, ef))

    print(f"Rendering {TOTAL_FRAMES} frames ({DURATION}s @ {FPS}fps, {W}x{H}) across {num_chunks} parallel workers...")
    with mp.Pool(processes=min(num_chunks, mp.cpu_count())) as pool:
        chunk_paths = pool.map(render_chunk, tasks)

    # Concatenate video chunks and mux with master_audio.wav
    concat_list_path = "build_chunks/concat.txt"
    with open(concat_list_path, "w") as f:
        for cp in chunk_paths:
            f.write(f"file '{os.path.abspath(cp)}'\n")

    output_video = "dinosaur_history_60s.mp4"
    subprocess.run([
        "ffmpeg", "-y", "-v", "error",
        "-f", "concat", "-safe", "0", "-i", concat_list_path,
        "-i", "build_audio/master_audio.wav",
        "-c:v", "copy",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest",
        output_video
    ], check=True)

    elapsed = time.time() - t0
    print(f"Successfully rendered {output_video} in {elapsed:.1f}s!")
