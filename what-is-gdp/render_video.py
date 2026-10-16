import json
import math
import os
import subprocess
import time
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1920, 1080
VW, VH = 1080, 1920
FPS = 30
DURATION = 60.0
TOTAL_FRAMES = int(FPS * DURATION)

FONT_PATH = "/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf"
FONT_IMPACT = "/System/Library/Fonts/Supplemental/Impact.ttf"

# Signature Cleo Abram ("Huge If True") Neon Studio Palette
BG_DARK = (7, 11, 20)
PANEL_BG = (13, 20, 36)
PANEL_INNER = (18, 28, 48)
NEON_YELLOW = (255, 230, 0)
NEON_CYAN = (0, 240, 255)
NEON_GREEN = (52, 211, 153)
NEON_RED = (251, 113, 133)
NEON_PURPLE = (192, 132, 252)
INK_DARK = (10, 14, 24)
TEXT_WHITE = (248, 250, 252)
TEXT_MUTED = (148, 163, 184)

CLEAN_BADGES = {
    1: "GLOBAL GDP  >  $110 TRILLION",
    2: "LATTES  +  HAIRCUTS  +  ROCKETS",
    3: "FINAL RECEIPT ONLY  •  INSIDE BORDERS",
    4: "GDP = C + I + G + NX   (C = 68%)",
    5: "I (BIZ)  +  G (GOVT)  +  (EX - IM)",
    6: "STRIP INFLATION  -->  REAL GDP",
    7: "1934 WARNING: OUTPUT != WELL-BEING",
    8: "SPEEDOMETER (SPEED) != COMPASS (PURPOSE)",
}

# Preferred vertical focal center (0.0=top, 0.5=center) for 800x748 stage crop from 768x1376 portrait
SHOT_Y_FOCUS = {
    "shot_01": 0.36,
    "shot_02": 0.48,
    "shot_03": 0.44,
    "shot_04": 0.50,
    "shot_05": 0.48,
    "shot_06": 0.48,
    "shot_07": 0.44,
    "shot_08": 0.48,
    "shot_09": 0.48,
    "shot_10": 0.48,
    "shot_11": 0.45,
    "shot_12": 0.48,
    "shot_13": 0.46,
    "shot_14": 0.48,
    "shot_15": 0.48,
    "shot_16": 0.38,
}


def load_fonts():
    return {
        "ch_num": ImageFont.truetype(FONT_PATH, 22),
        "ch_title": ImageFont.truetype(FONT_PATH, 27),
        "badge": ImageFont.truetype(FONT_PATH, 24),
        "caption": ImageFont.truetype(FONT_PATH, 35),
        "caption_active": ImageFont.truetype(FONT_PATH, 37),
        "banner_big": ImageFont.truetype(FONT_PATH, 52),
        "banner_sub": ImageFont.truetype(FONT_PATH, 26),
        "card_title": ImageFont.truetype(FONT_PATH, 26),
        "card_sub": ImageFont.truetype(FONT_PATH, 20),
        "card_body": ImageFont.truetype(FONT_PATH, 22),
        "big_num": ImageFont.truetype(FONT_PATH, 62),
        "med_num": ImageFont.truetype(FONT_PATH, 36),
        "formula": ImageFont.truetype(FONT_PATH, 25),
        "small_tag": ImageFont.truetype(FONT_PATH, 18),
        "timer": ImageFont.truetype(FONT_PATH, 21),
        # Vertical video fonts
        "v_ch": ImageFont.truetype(FONT_PATH, 26),
        "v_badge": ImageFont.truetype(FONT_PATH, 26),
        "v_cap": ImageFont.truetype(FONT_PATH, 31),
        "v_cap_active": ImageFont.truetype(FONT_PATH, 33),
    }


def ease_out_back(x):
    x = max(0.0, min(1.0, x))
    c1 = 1.70158
    c3 = c1 + 1.0
    return 1.0 + c3 * pow(x - 1.0, 3) + c1 * pow(x - 1.0, 2)


def ease_in_out_cubic(x):
    x = max(0.0, min(1.0, x))
    return 4 * x * x * x if x < 0.5 else 1 - pow(-2 * x + 2, 3) / 2


def draw_neon_box(draw, box, fill, outline=NEON_CYAN, width=4, radius=22, shadow_offset=(6, 7), shadow_color=(3, 6, 12)):
    x0, y0, x1, y1 = box
    if shadow_offset:
        sx, sy = shadow_offset
        draw.rounded_rectangle([x0 + sx, y0 + sy, x1 + sx, y1 + sy], radius=radius, fill=shadow_color)
    draw.rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=fill, outline=outline, width=width)


def draw_sparkle(draw, cx, cy, size, angle=0.0, color=NEON_YELLOW):
    pts = []
    for i in range(8):
        r = size if i % 2 == 0 else size * 0.32
        a = angle + i * (math.pi / 4.0)
        pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    draw.polygon(pts, fill=color, outline=INK_DARK)


def draw_cleo_host_avatar(draw, base_x, base_y, r, t, mouth_open, fonts):
    """Draws the animated Cleo-style 'Huge If True' host in her signature neon-yellow blazer, lip-synced to ElevenLabs v4."""
    bob_y = math.sin(t * 4.6) * 4.0 - mouth_open * 3.5
    cy = int(base_y + bob_y)
    cx = base_x

    # Drop shadow & Dual-Neon Studio Ring (Yellow left, Cyan right)
    draw.ellipse([cx - r + 5, cy - r + 7, cx + r + 5, cy + r + 7], fill=(4, 6, 12))
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(16, 26, 46), outline=NEON_CYAN, width=5)
    draw.arc([cx - r, cy - r, cx + r, cy + r], start=110, end=290, fill=NEON_YELLOW, width=5)

    # Back wavy dark-brown hair
    draw.ellipse([cx - 46, cy - 52, cx + 46, cy + 36], fill=(28, 22, 24), outline=(12, 10, 14), width=3)
    draw.ellipse([cx - 50, cy - 18, cx - 22, cy + 32], fill=(32, 25, 28))
    draw.ellipse([cx + 22, cy - 18, cx + 50, cy + 32], fill=(32, 25, 28))

    # Signature Bright Yellow Blazer shoulders & lapels
    draw.pieslice([cx - 58, cy + 16, cx + 58, cy + 92], start=180, end=360, fill=NEON_YELLOW, outline=INK_DARK, width=4)
    # Black inner top & silver necklace
    draw.polygon([(cx - 18, cy + 20), (cx + 18, cy + 20), (cx, cy + 56)], fill=(18, 20, 28), outline=INK_DARK)
    draw.arc([cx - 13, cy + 16, cx + 13, cy + 36], start=10, end=170, fill=(226, 232, 240), width=2)
    # Blazer lapels
    draw.line([(cx - 18, cy + 22), (cx - 8, cy + 52)], fill=INK_DARK, width=3)
    draw.line([(cx + 18, cy + 22), (cx + 8, cy + 52)], fill=INK_DARK, width=3)

    # Neck & Face
    draw.rectangle([cx - 10, cy + 7, cx + 10, cy + 25], fill=(245, 208, 182), outline=INK_DARK, width=2)
    draw.ellipse([cx - 34, cy - 42, cx + 34, cy + 21], fill=(250, 216, 190), outline=INK_DARK, width=3)

    # Center-parted wavy hair top
    draw.pieslice([cx - 36, cy - 46, cx + 36, cy - 8], start=180, end=360, fill=(28, 22, 24))
    draw.polygon([(cx - 8, cy - 26), (cx, cy - 42), (cx + 8, cy - 26)], fill=(250, 216, 190))

    # Eyes (blink every 3.3s)
    blink_phase = t % 3.3
    is_blinking = (blink_phase > 3.14)
    eye_y = cy - 13
    for ex in [cx - 14, cx + 14]:
        if is_blinking:
            draw.line([(ex - 8, eye_y), (ex + 8, eye_y)], fill=INK_DARK, width=3)
        else:
            draw.ellipse([ex - 7, eye_y - 8, ex + 7, eye_y + 8], fill=(255, 255, 255), outline=INK_DARK, width=2)
            px = ex + 1 + int(math.sin(t * 2.0) * 1.5)
            draw.ellipse([px - 4, eye_y - 5, px + 4, eye_y + 5], fill=(35, 24, 20))
            draw.ellipse([px - 3, eye_y - 4, px, eye_y - 1], fill=(255, 255, 255))

    # Expressive eyebrows
    brow_lift = int(mouth_open * 5.0)
    draw.arc([cx - 23, eye_y - 17 - brow_lift, cx - 5, eye_y - 8 - brow_lift], start=195, end=345, fill=(28, 22, 24), width=3)
    draw.arc([cx + 5, eye_y - 17 - brow_lift, cx + 23, eye_y - 8 - brow_lift], start=195, end=345, fill=(28, 22, 24), width=3)

    # Warm cheeks
    draw.ellipse([cx - 27, cy - 3, cx - 16, cy + 4], fill=(244, 140, 125))
    draw.ellipse([cx + 16, cy - 3, cx + 27, cy + 4], fill=(244, 140, 125))

    # Lip-synced Mouth
    my = cy + 6
    if mouth_open < 0.06:
        draw.arc([cx - 11, my - 6, cx + 11, my + 6], start=12, end=168, fill=(190, 45, 65), width=3)
    else:
        mw = int(8 + mouth_open * 8)
        mh = int(4 + mouth_open * 13)
        draw.rounded_rectangle([cx - mw, my - mh // 2, cx + mw, my + mh], radius=6, fill=(135, 22, 42), outline=INK_DARK, width=2)
        if mh > 7:
            draw.rectangle([cx - mw + 3, my - mh // 2 + 2, cx + mw - 3, my - mh // 2 + 5], fill=(255, 255, 255))

    # "HUGE IF TRUE" mini studio badge at bottom of avatar circle
    tag_y = cy + r - 4
    draw.rounded_rectangle([cx - 64, tag_y - 14, cx + 64, tag_y + 14], radius=10, fill=INK_DARK, outline=NEON_YELLOW, width=2)
    draw.text((cx, tag_y), "HUGE IF TRUE", font=fonts["small_tag"], fill=NEON_YELLOW, anchor="mm")


def get_stage_crop(portrait_img, shot_id, local_p, target_size=(800, 748), direction=1):
    """Extracts a smooth Ken Burns 800x748 stage frame from the 920x1648 upscaled portrait image."""
    uw, uh = portrait_img.size  # (920, 1648)
    tw, th = target_size
    p_smooth = ease_in_out_cubic(local_p)

    # Zoom factor between 1.00 and 1.10 of target width
    if direction > 0:
        scale = 1.12 - 0.10 * p_smooth
        pan_x = p_smooth
        pan_y_off = -0.04 + 0.08 * p_smooth
    else:
        scale = 1.02 + 0.10 * p_smooth
        pan_x = 1.0 - p_smooth
        pan_y_off = 0.04 - 0.08 * p_smooth

    cw = min(uw, int(tw * scale))
    ch = min(uh, int(th * scale))

    focus_y = SHOT_Y_FOCUS.get(shot_id, 0.46) + pan_y_off
    cx_min = (uw - cw) * 0.2
    cx_max = (uw - cw) * 0.8
    x0 = int(cx_min + (cx_max - cx_min) * pan_x)
    y0 = int(max(0, min(uh - ch, (uh * focus_y) - ch * 0.5)))

    cropped = portrait_img.crop((x0, y0, x0 + cw, y0 + ch))
    return cropped.resize((tw, th), Image.Resampling.BILINEAR)


def draw_master_equation_bar(draw, scene_num, t, fonts):
    """Draws the interactive GDP = C + I + G + (X - M) master formula bar at the top of the right deck."""
    bx0, by0, bx1, by1 = 884, 108, 1872, 224
    draw_neon_box(draw, [bx0, by0, bx1, by1], fill=PANEL_BG, outline=NEON_CYAN, width=3, radius=20)

    draw.text((912, 132), "MASTER EQUATION", font=fonts["small_tag"], fill=NEON_CYAN, anchor="lm")
    draw.text((1844, 132), "EXPENDITURE APPROACH", font=fonts["small_tag"], fill=TEXT_MUTED, anchor="rm")

    active_map = {
        1: ["GDP"],
        2: ["GDP", "C", "I", "G", "NX"],
        3: ["GDP"],
        4: ["C"],
        5: ["I", "G", "NX"],
        6: ["GDP"],
        7: ["GDP"],
        8: ["GDP"],
    }
    highlights = active_map.get(scene_num, ["GDP"])

    items = [
        ("GDP", "$110T+ TOTAL", 974, 146),
        ("=", "", 1064, 24),
        ("C", "68% CONSUMER", 1164, 152),
        ("+", "", 1256, 24),
        ("I", "18% BUSINESS", 1348, 144),
        ("+", "", 1436, 24),
        ("G", "17% GOVT", 1520, 128),
        ("+", "", 1600, 24),
        ("NX", "-3% EXPORTS", 1696, 148),
    ]

    cy = 180
    for code, sub, cx, pw in items:
        if code in ["=", "+"]:
            draw.text((cx, cy), code, font=fonts["med_num"], fill=TEXT_WHITE, anchor="mm")
        else:
            is_hi = code in highlights
            pulse = int(math.sin(t * 6.0) * 2) if is_hi else 0
            fill_c = NEON_YELLOW if is_hi else PANEL_INNER
            txt_c = INK_DARK if is_hi else TEXT_WHITE
            sub_c = (40, 30, 5) if is_hi else TEXT_MUTED
            out_c = (255, 255, 255) if is_hi else (56, 189, 248)
            hw = pw // 2 + pulse
            draw.rounded_rectangle([cx - hw, cy - 30 - pulse, cx + hw, cy + 28 + pulse], radius=12, fill=fill_c, outline=out_c, width=3)
            draw.text((cx, cy - 8), code, font=fonts["formula"], fill=txt_c, anchor="mm")
            draw.text((cx, cy + 15), sub, font=fonts["small_tag"], fill=sub_c, anchor="mm")


def draw_right_infographic_deck(draw, scene_num, t, scene_p, fonts):
    """Draws the chapter-specific animated holographic data dashboard on the right side (884..1872, 242..856)."""
    dx0, dy0, dx1, dy1 = 884, 242, 1872, 856
    draw_neon_box(draw, [dx0, dy0, dx1, dy1], fill=PANEL_BG, outline=NEON_YELLOW if scene_num % 2 == 1 else NEON_CYAN, width=4, radius=24)

    cx_mid = (dx0 + dx1) // 2

    if scene_num == 1:
        # Chapter 1: Live Rolling $110T Global GDP Counter + World GDP Growth Bar Chart
        draw.text((cx_mid, 288), "GLOBAL ECONOMIC OUTPUT (WORLD BANK / IMF)", font=fonts["card_title"], fill=NEON_CYAN, anchor="mm")

        val = min(110.4, 35.0 + ease_out_back(min(1.0, scene_p * 1.45)) * 75.4)
        draw_neon_box(draw, [940, 322, 1816, 442], fill=PANEL_INNER, outline=NEON_YELLOW, width=3, radius=18, shadow_offset=None)
        draw.text((cx_mid, 368), f"${val:0.1f} TRILLION", font=fonts["big_num"], fill=NEON_YELLOW, anchor="mm")
        draw.text((cx_mid, 418), "ALL GOODS & SERVICES PRODUCED ON EARTH PER YEAR", font=fonts["small_tag"], fill=TEXT_WHITE, anchor="mm")

        # Animated 5-bar historical growth chart
        bars = [
            ("1990", 23, NEON_CYAN),
            ("2000", 34, NEON_CYAN),
            ("2010", 66, NEON_CYAN),
            ("2020", 85, NEON_YELLOW),
            ("NOW", 110, NEON_YELLOW),
        ]
        base_y = 790
        max_h = 260
        for idx, (yr, tr_val, col) in enumerate(bars):
            bx = 980 + idx * 185
            grow = ease_out_back(max(0.18, min(1.0, (scene_p + 0.15 - idx * 0.08) * 2.2)))
            bh = max(18, int((tr_val / 115.0) * max_h * grow))
            draw.rounded_rectangle([bx, base_y - bh, bx + 110, base_y], radius=10, fill=col, outline=INK_DARK, width=3)
            draw.text((bx + 55, base_y - bh - 22), f"${int(round(tr_val * grow))}T", font=fonts["card_body"], fill=col, anchor="mm")
            draw.text((bx + 55, base_y + 24), yr, font=fonts["card_sub"], fill=TEXT_WHITE, anchor="mm")

    elif scene_num == 2:
        # Chapter 2: G-D-P Acronym Decoder + Live Price Tag Stream
        draw.text((cx_mid, 286), "WHAT DOES 'G.D.P.' ACTUALLY STAND FOR?", font=fonts["card_title"], fill=NEON_YELLOW, anchor="mm")

        cards = [
            ("G — GROSS", "Total added value of everything produced", NEON_YELLOW, 0.05),
            ("D — DOMESTIC", "Inside a nation's geographic borders", NEON_CYAN, 0.22),
            ("P — PRODUCT", "Brand-new goods AND services sold", NEON_GREEN, 0.38),
        ]
        for idx, (head, desc, col, delay) in enumerate(cards):
            appear = ease_out_back(max(0.0, min(1.0, (scene_p - delay) * 3.0)))
            cy0 = 324 + idx * 108
            w_cur = int(860 * appear)
            if w_cur > 60:
                draw.rounded_rectangle([948, cy0, 948 + w_cur, cy0 + 88], radius=16, fill=PANEL_INNER, outline=col, width=3)
                if appear > 0.5:
                    draw.text((980, cy0 + 30), head, font=fonts["card_title"], fill=col, anchor="lm")
                    draw.text((980, cy0 + 64), desc, font=fonts["card_sub"], fill=TEXT_WHITE, anchor="lm")

        # Bottom live receipt ticker: Lattes to Rocket Launches
        draw.rounded_rectangle([948, 662, 1808, 822], radius=18, fill=(10, 16, 28), outline=NEON_YELLOW, width=3)
        draw.text((cx_mid, 692), "LIVE NATIONAL PRICE-TAG REGISTER", font=fonts["small_tag"], fill=NEON_YELLOW, anchor="mm")
        items = [
            ("Morning Latte", "+$5.50", NEON_YELLOW),
            ("Salon Haircut", "+$45.00", NEON_CYAN),
            ("AI Microchip", "+$350.00", NEON_GREEN),
            ("Rocket Launch", "+$67,000,000", NEON_YELLOW),
        ]
        for i, (lbl, pr, col) in enumerate(items):
            ix = 975 + (i % 2) * 415
            iy = 732 + (i // 2) * 48
            draw.text((ix, iy), f"• {lbl}:", font=fonts["card_sub"], fill=TEXT_WHITE, anchor="lm")
            draw.text((ix + 225, iy), pr, font=fonts["card_body"], fill=col, anchor="lm")

    elif scene_num == 3:
        # Chapter 3: Final Receipt Only (No Double Counting) + Domestic Border Rule
        draw.text((cx_mid, 286), "RULE #1: NEVER COUNT RAW INGREDIENTS TWICE", font=fonts["card_title"], fill=NEON_CYAN, anchor="mm")

        steps = [
            ("1. COFFEE BEANS", "$1.00 Wholesale", "SKIP (Intermediate)", NEON_RED, 940),
            ("2. FRESH MILK", "$0.75 Wholesale", "SKIP (Intermediate)", NEON_RED, 1236),
            ("3. FINAL LATTE", "$5.50 Receipt", "COUNTED IN GDP!", NEON_GREEN, 1532),
        ]
        for title, price, status, col, sx in steps:
            draw.rounded_rectangle([sx, 326, sx + 268, 520], radius=18, fill=PANEL_INNER, outline=col, width=3)
            draw.text((sx + 134, 366), title, font=fonts["card_body"], fill=TEXT_WHITE, anchor="mm")
            draw.text((sx + 134, 416), price, font=fonts["card_title"], fill=col, anchor="mm")
            draw.rounded_rectangle([sx + 20, 456, sx + 248, 498], radius=10, fill=INK_DARK, outline=col, width=2)
            draw.text((sx + 134, 477), status, font=fonts["small_tag"], fill=col, anchor="mm")

        # Rule #2: Inside Borders
        draw.rounded_rectangle([940, 558, 1816, 820], radius=20, fill=PANEL_INNER, outline=NEON_YELLOW, width=3)
        draw.text((cx_mid, 598), "RULE #2: 'DOMESTIC' = MADE INSIDE NATIONAL BORDERS", font=fonts["card_title"], fill=NEON_YELLOW, anchor="mm")
        draw.text((972, 660), "[YES] Foreign automaker builds car in Ohio  -->  COUNTS in U.S. GDP", font=fonts["card_body"], fill=NEON_GREEN, anchor="lm")
        draw.text((972, 715), "[NO]  U.S. firm builds phone overseas       -->  COUNTS in Foreign GDP", font=fonts["card_body"], fill=NEON_RED, anchor="lm")
        draw.text((972, 772), "[NO]  Used / second-hand car resales        -->  $0 (Counted when new!)", font=fonts["card_sub"], fill=TEXT_MUTED, anchor="lm")

    elif scene_num == 4:
        # Chapter 4: C = Consumer Spending (~68-70% of US Economy)
        draw.text((cx_mid, 286), "COMPONENT 'C': CONSUMER SPENDING POWERHOUSE", font=fonts["card_title"], fill=NEON_YELLOW, anchor="mm")

        pct = min(68.4, ease_out_back(min(1.0, scene_p * 1.5)) * 68.4)
        draw.rounded_rectangle([940, 322, 1816, 468], radius=18, fill=PANEL_INNER, outline=NEON_YELLOW, width=3)
        draw.text((1140, 380), f"{pct:0.0f}%", font=fonts["big_num"], fill=NEON_YELLOW, anchor="mm")
        draw.text((1140, 434), "OF AMERICA'S GDP", font=fonts["small_tag"], fill=TEXT_WHITE, anchor="mm")
        draw.text((1320, 362), "Every swipe, tap & household bill:", font=fonts["card_body"], fill=NEON_CYAN, anchor="lm")
        draw.text((1320, 402), "• Healthcare, Rent & Utilities (Services)", font=fonts["card_sub"], fill=TEXT_WHITE, anchor="lm")
        draw.text((1320, 434), "• Groceries, Cars, Phones & Coffee (Goods)", font=fonts["card_sub"], fill=TEXT_WHITE, anchor="lm")

        shares = [
            ("C — Consumer Spending (Households)", 0.68, "68%", NEON_YELLOW),
            ("I — Business Investment (Factories/Tech)", 0.18, "18%", NEON_CYAN),
            ("G — Government Infrastructure & Schools", 0.17, "17%", NEON_GREEN),
            ("NX — Net Exports (Exports minus Imports)", 0.06, "-3%", NEON_RED),
        ]
        for idx, (lbl, frac, pct_str, col) in enumerate(shares):
            by = 504 + idx * 80
            draw.text((948, by), lbl, font=fonts["card_sub"], fill=TEXT_WHITE, anchor="lm")
            draw.text((1808, by), pct_str, font=fonts["card_body"], fill=col, anchor="rm")
            bar_w = int(860 * frac * ease_in_out_cubic(min(1.0, scene_p * 1.6)))
            draw.rounded_rectangle([948, by + 18, 1808, by + 44], radius=8, fill=INK_DARK, outline=(45, 60, 85), width=2)
            if bar_w > 12:
                draw.rounded_rectangle([948, by + 18, 948 + bar_w, by + 44], radius=8, fill=col)

    elif scene_num == 5:
        # Chapter 5: I (Business Investment) + G (Government) + NX (Exports - Imports)
        draw.text((cx_mid, 286), "THE OTHER 3 ENGINES:  I  +  G  +  NET EXPORTS", font=fonts["card_title"], fill=NEON_CYAN, anchor="mm")

        pillars = [
            ("I — BUSINESS INVESTMENT", "Robots, AI servers, factories, R&D & new housing construction", "18% OF GDP", NEON_YELLOW, 0.0),
            ("G — GOVERNMENT SPENDING", "Highways, bridges, public schools, defense & space agencies", "17% OF GDP", NEON_CYAN, 0.25),
            ("NX — NET EXPORTS (X - M)", "Add domestic Exports sold abroad (+) minus foreign Imports (-)", "TRADE BALANCE", NEON_GREEN, 0.50),
        ]
        for idx, (title, desc, badge_r, col, trig) in enumerate(pillars):
            is_active = scene_p >= trig
            cy0 = 328 + idx * 168
            out_c = col if is_active else (50, 65, 90)
            draw.rounded_rectangle([940, cy0, 1816, cy0 + 144], radius=18, fill=PANEL_INNER, outline=out_c, width=4 if is_active else 2)
            draw.text((974, cy0 + 44), title, font=fonts["card_title"], fill=col if is_active else TEXT_MUTED, anchor="lm")
            draw.rounded_rectangle([1580, cy0 + 22, 1788, cy0 + 64], radius=10, fill=INK_DARK, outline=col, width=2)
            draw.text((1684, cy0 + 43), badge_r, font=fonts["small_tag"], fill=col, anchor="mm")
            draw.text((974, cy0 + 98), desc, font=fonts["card_sub"], fill=TEXT_WHITE if is_active else TEXT_MUTED, anchor="lm")

    elif scene_num == 6:
        # Chapter 6: Nominal GDP (Inflated Air) vs Real GDP (True Output Growth)
        draw.text((cx_mid, 286), "STRIPPING OUT INFLATION: NOMINAL VS. REAL GDP", font=fonts["card_title"], fill=NEON_YELLOW, anchor="mm")

        draw.rounded_rectangle([940, 326, 1360, 636], radius=18, fill=PANEL_INNER, outline=NEON_RED, width=3)
        draw.text((1150, 366), "NOMINAL GDP", font=fonts["card_title"], fill=NEON_RED, anchor="mm")
        draw.text((1150, 404), "Today's Inflated Prices", font=fonts["card_sub"], fill=TEXT_MUTED, anchor="mm")
        draw.text((1150, 476), "10 Cups × $10", font=fonts["med_num"], fill=TEXT_WHITE, anchor="mm")
        draw.text((1150, 538), "= $100 GDP?!", font=fonts["med_num"], fill=NEON_RED, anchor="mm")
        draw.text((1150, 596), "Looks 2x bigger, but 0 new coffee!", font=fonts["small_tag"], fill=NEON_RED, anchor="mm")

        draw.rounded_rectangle([1396, 326, 1816, 636], radius=18, fill=PANEL_INNER, outline=NEON_GREEN, width=4)
        draw.text((1606, 366), "REAL GDP", font=fonts["card_title"], fill=NEON_GREEN, anchor="mm")
        draw.text((1606, 404), "Constant Base-Year Prices", font=fonts["card_sub"], anchor="mm", fill=TEXT_MUTED)
        draw.text((1606, 476), "15 Cups × $5", font=fonts["med_num"], fill=TEXT_WHITE, anchor="mm")
        draw.text((1606, 538), "= +50% REAL!", font=fonts["med_num"], fill=NEON_GREEN, anchor="mm")
        draw.text((1606, 596), "Measures true physical output!", font=fonts["small_tag"], fill=NEON_GREEN, anchor="mm")

        draw.rounded_rectangle([940, 668, 1816, 820], radius=18, fill=INK_DARK, outline=NEON_CYAN, width=3)
        draw.text((cx_mid, 716), "REAL GDP  =  NOMINAL GDP  ÷  PRICE DEFLATOR", font=fonts["card_title"], fill=NEON_CYAN, anchor="mm")
        draw.text((cx_mid, 774), "Economists always track REAL GDP to see if living standards truly rose.", font=fonts["card_sub"], fill=TEXT_WHITE, anchor="mm")

    elif scene_num == 7:
        # Chapter 7: Simon Kuznets' 1934 Warning — What GDP Counts vs. Ignores
        draw.text((cx_mid, 286), "SIMON KUZNETS (1934): 'GDP IS NOT WELL-BEING!'", font=fonts["card_title"], fill=NEON_YELLOW, anchor="mm")

        draw.rounded_rectangle([940, 328, 1362, 820], radius=18, fill=PANEL_INNER, outline=NEON_RED, width=3)
        draw.text((1151, 370), "BOOSTS GDP (+$)", font=fonts["card_title"], fill=NEON_RED, anchor="mm")
        bad_items = [
            ("Traffic Jam Gas Burned", "+$$$"),
            ("Pollution Cleanup Bills", "+$$$"),
            ("Storm Rebuilding Costs", "+$$$"),
            ("Overwork & Burnout", "+$$$"),
        ]
        for i, (lbl, tag) in enumerate(bad_items):
            iy = 440 + i * 88
            draw.rounded_rectangle([966, iy - 26, 1336, iy + 34], radius=12, fill=INK_DARK, outline=(90, 40, 50), width=2)
            draw.text((984, iy + 4), lbl, font=fonts["card_sub"], fill=TEXT_WHITE, anchor="lm")
            draw.text((1318, iy + 4), tag, font=fonts["card_body"], fill=NEON_RED, anchor="rm")

        draw.rounded_rectangle([1394, 328, 1816, 820], radius=18, fill=PANEL_INNER, outline=NEON_GREEN, width=3)
        draw.text((1605, 370), "IGNORED BY GDP ($0)", font=fonts["card_title"], fill=NEON_GREEN, anchor="mm")
        good_items = [
            ("Parenting & Childcare", "$0.00"),
            ("Clean Air & Forests", "$0.00"),
            ("Volunteer Community Work", "$0.00"),
            ("Rest, Health & Happiness", "$0.00"),
        ]
        for i, (lbl, tag) in enumerate(good_items):
            iy = 440 + i * 88
            draw.rounded_rectangle([1420, iy - 26, 1790, iy + 34], radius=12, fill=INK_DARK, outline=(35, 90, 70), width=2)
            draw.text((1438, iy + 4), lbl, font=fonts["card_sub"], fill=TEXT_WHITE, anchor="lm")
            draw.text((1772, iy + 4), tag, font=fonts["card_body"], fill=NEON_CYAN, anchor="rm")

    elif scene_num == 8:
        # Chapter 8: Economic Speedometer vs. Human Compass Finale
        draw.text((cx_mid, 286), "THE TAKEAWAY: SPEEDOMETER VS. COMPASS", font=fonts["card_title"], fill=NEON_YELLOW, anchor="mm")

        scx, scy, sr = 1155, 505, 135
        draw.ellipse([scx - sr, scy - sr, scx + sr, scy + sr], fill=PANEL_INNER, outline=NEON_YELLOW, width=5)
        draw.arc([scx - sr + 16, scy - sr + 16, scx + sr - 16, scy + sr - 16], start=135, end=45, fill=NEON_CYAN, width=10)
        needle_ang = math.radians(150 + (0.65 + 0.25 * math.sin(t * 5.0)) * 240)
        nx = scx + int(math.cos(needle_ang) * (sr - 28))
        ny = scy + int(math.sin(needle_ang) * (sr - 28))
        draw.line([(scx, scy), (nx, ny)], fill=NEON_YELLOW, width=7)
        draw.ellipse([scx - 14, scy - 14, scx + 14, scy + 14], fill=NEON_YELLOW, outline=INK_DARK, width=3)
        draw.text((scx, scy + sr + 32), "GDP = SPEEDOMETER", font=fonts["card_title"], fill=NEON_YELLOW, anchor="mm")
        draw.text((scx, scy + sr + 66), "How fast the engine spins", font=fonts["card_sub"], fill=TEXT_WHITE, anchor="mm")

        ccx, ccy, cr = 1605, 505, 135
        draw.ellipse([ccx - cr, ccy - cr, ccx + cr, ccy + cr], fill=PANEL_INNER, outline=NEON_CYAN, width=5)
        for lbl, ang_deg in [("N", -90), ("E", 0), ("S", 90), ("W", 180)]:
            ra = math.radians(ang_deg)
            lx = ccx + int(math.cos(ra) * (cr - 26))
            ly = ccy + int(math.sin(ra) * (cr - 26))
            draw.text((lx, ly), lbl, font=fonts["card_body"], fill=NEON_CYAN if lbl == "N" else TEXT_MUTED, anchor="mm")
        c_ang = math.radians(-55 + math.sin(t * 2.5) * 18)
        cnx = ccx + int(math.cos(c_ang) * (cr - 42))
        cny = ccy + int(math.sin(c_ang) * (cr - 42))
        csx = ccx - int(math.cos(c_ang) * (cr - 42))
        csy = ccy - int(math.sin(c_ang) * (cr - 42))
        draw.line([(ccx, ccy), (cnx, cny)], fill=NEON_GREEN, width=7)
        draw.line([(ccx, ccy), (csx, csy)], fill=NEON_RED, width=5)
        draw.ellipse([ccx - 12, ccy - 12, ccx + 12, ccy + 12], fill=TEXT_WHITE, outline=INK_DARK, width=3)
        draw.text((ccx, ccy + cr + 32), "WELL-BEING = COMPASS", font=fonts["card_title"], fill=NEON_CYAN, anchor="mm")
        draw.text((ccx, ccy + cr + 66), "Are we heading somewhere good?", font=fonts["card_sub"], fill=TEXT_WHITE, anchor="mm")

        draw.rounded_rectangle([940, 742, 1816, 830], radius=16, fill=NEON_YELLOW, outline=INK_DARK, width=3)
        draw.text((cx_mid, 786), "MEASURE SPEED WITH GDP — STEER WITH HUMAN FLOURISHING!", font=fonts["card_body"], fill=INK_DARK, anchor="mm")


def draw_word_synced_captions(draw, scene, t, fonts, box=(236, 874, 1872, 1038), font_key="caption", active_key="caption_active"):
    bx0, by0, bx1, by1 = box
    draw_neon_box(draw, [bx0, by0, bx1, by1], fill=(15, 23, 42), outline=NEON_YELLOW, width=4, radius=24, shadow_offset=(5, 7))

    words = scene["words"]
    active_word_idx = None
    for idx, w in enumerate(words):
        if w["start"] <= t <= w["end"]:
            active_word_idx = idx
            break

    max_line_w = (bx1 - bx0) - 56
    space_w = 12
    lines = []
    cur_line = []
    cur_w = 0

    for idx, w in enumerate(words):
        bbox = fonts[font_key].getbbox(w["word"])
        ww = bbox[2] - bbox[0]
        if cur_line and (cur_w + space_w + ww > max_line_w):
            lines.append(cur_line)
            cur_line = [(idx, w, ww)]
            cur_w = ww
        else:
            cur_line.append((idx, w, ww))
            cur_w = ww if len(cur_line) == 1 else cur_w + space_w + ww
    if cur_line:
        lines.append(cur_line)

    n_lines = len(lines)
    box_h = by1 - by0
    line_step = min(56, (box_h - 24) // max(1, n_lines))
    start_y = (by0 + by1) // 2 - int((n_lines - 1) * line_step * 0.5)

    for l_idx, line_words in enumerate(lines):
        ly = start_y + l_idx * line_step
        total_w = sum(ww for _, _, ww in line_words) + space_w * (len(line_words) - 1)
        cursor_x = (bx0 + bx1 - total_w) // 2

        for w_idx, w, ww in line_words:
            is_active = (w_idx == active_word_idx) and (w["word"] != "—")
            is_past = (t > w["end"])
            word_str = w["word"]

            if is_active:
                pad_x, pad_y = 8, 4
                draw.rounded_rectangle(
                    [cursor_x - pad_x, ly - 20 - pad_y, cursor_x + ww + pad_x, ly + 16 + pad_y],
                    radius=10,
                    fill=NEON_YELLOW,
                    outline=INK_DARK,
                    width=3
                )
                draw.text((cursor_x + ww // 2, ly - 2), word_str, font=fonts[active_key], fill=INK_DARK, anchor="mm")
            else:
                txt_col = TEXT_WHITE if is_past else (165, 180, 205)
                draw.text((cursor_x + ww // 2 + 2, ly + 2), word_str, font=fonts[font_key], fill=INK_DARK, anchor="mm")
                draw.text((cursor_x + ww // 2, ly), word_str, font=fonts[font_key], fill=txt_col, anchor="mm")

            cursor_x += ww + space_w


def draw_widescreen_hud(draw, scene, shot_id, t, fonts):
    s_num = scene["num"]
    w0, w1 = scene["window"]
    local_t = max(0.0, t - w0)

    # 1. Top-Left Chapter Pill
    draw_neon_box(draw, [48, 24, 680, 92], fill=PANEL_BG, outline=NEON_YELLOW, width=4, radius=20)
    draw.rounded_rectangle([60, 34, 178, 82], radius=12, fill=NEON_YELLOW, outline=INK_DARK, width=2)
    draw.text((119, 58), f"CH 0{s_num}/08", font=fonts["ch_num"], fill=INK_DARK, anchor="mm")
    draw.text((196, 58), scene["title"], font=fonts["ch_title"], fill=TEXT_WHITE, anchor="lm")

    # 2. Top-Right Concept Formula Badge
    enter_p = min(1.0, local_t / 0.45)
    scale_y = ease_out_back(enter_p)
    badge_str = CLEAN_BADGES[s_num]
    bbox = fonts["badge"].getbbox(badge_str)
    bw = (bbox[2] - bbox[0]) + 54
    bx1 = W - 48
    bx0 = bx1 - bw
    by_center = 58
    bh_half = max(6, int(34 * scale_y))
    draw_neon_box(draw, [bx0, by_center - bh_half, bx1, by_center + bh_half], fill=PANEL_BG, outline=NEON_CYAN, width=4, radius=20)
    if enter_p > 0.35:
        draw.text(((bx0 + bx1) // 2, by_center), badge_str, font=fonts["badge"], fill=NEON_CYAN, anchor="mm")

    # 3. Left Stage Camera Label Pill
    draw.rounded_rectangle([68, 804, 342, 842], radius=10, fill=(10, 15, 28), outline=NEON_CYAN, width=2)
    draw.ellipse([84, 817, 96, 829], fill=NEON_RED)
    draw.text((108, 823), f"STUDIO CAM • {shot_id.upper()}", font=fonts["small_tag"], fill=TEXT_WHITE, anchor="lm")

    # 4. Finale Celebration Overlay Banner (57.4s..60.0s)
    if t > 57.4:
        enter = min(1.0, (t - 57.4) / 0.45)
        y_off = int((1.0 - ease_out_back(enter)) * -90)
        draw_neon_box(draw, [380, 114 + y_off, 1540, 224 + y_off], fill=NEON_YELLOW, outline=INK_DARK, width=5, radius=26)
        draw.text((960, 152 + y_off), "WHAT IS GDP? — HUGE IF TRUE", font=fonts["banner_big"], fill=INK_DARK, anchor="mm")
        draw.text((960, 198 + y_off), "C + I + G + NX • Real Output • Speedometer vs. Human Compass", font=fonts["banner_sub"], fill=(30, 41, 59), anchor="mm")

    # 5. Bottom 8-Chapter Timeline Progress Bar
    bar_y0, bar_y1 = 1054, 1068
    bar_x0, bar_x1 = 236, 1730
    draw.rounded_rectangle([bar_x0, bar_y0, bar_x1, bar_y1], radius=6, fill=(15, 23, 42), outline=(71, 85, 105), width=2)
    fill_w = int((bar_x1 - bar_x0) * (t / DURATION))
    if fill_w > 8:
        draw.rounded_rectangle([bar_x0, bar_y0, bar_x0 + fill_w, bar_y1], radius=6, fill=NEON_CYAN)

    el = int(t)
    draw.text((1805, 1060), f"0:{el:02d} / 1:00", font=fonts["timer"], fill=TEXT_WHITE, anchor="mm")


def render_widescreen_studio(scenes, mouth_env, fonts, shots_cache):
    out_mp4 = "what_is_gdp_explainer.mp4"
    ffmpeg_cmd = [
        "ffmpeg", "-y",
        "-f", "rawvideo", "-vcodec", "rawvideo",
        "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
        "-i", "-",
        "-i", "assets/audio/master_audio.wav",
        "-c:v", "libx264", "-preset", "fast", "-crf", "18",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest", "-movflags", "+faststart",
        out_mp4
    ]
    proc = subprocess.Popen(ffmpeg_cmd, stdin=subprocess.PIPE, stderr=subprocess.DEVNULL)

    os.makedirs("assets/frames", exist_ok=True)
    sample_frames_to_save = {
        45: "assets/frames/verify_01_110t_economy.jpg",
        300: "assets/frames/verify_02_gdp_meaning.jpg",
        540: "assets/frames/verify_03_final_receipt.jpg",
        780: "assets/frames/verify_04_formula_c.jpg",
        1020: "assets/frames/verify_05_i_g_nx.jpg",
        1250: "assets/frames/verify_06_real_gdp.jpg",
        1480: "assets/frames/verify_07_kuznets_warning.jpg",
        1710: "assets/frames/verify_08_speedometer.jpg",
    }

    # Pre-build dark studio grid background
    studio_bg = Image.new("RGB", (W, H), BG_DARK)
    bg_draw = ImageDraw.Draw(studio_bg)
    for gx in range(0, W, 80):
        bg_draw.line([(gx, 0), (gx, H)], fill=(12, 18, 32), width=1)
    for gy in range(0, H, 80):
        bg_draw.line([(0, gy), (W, gy)], fill=(12, 18, 32), width=1)
    # Top & side subtle neon studio trim lines
    bg_draw.line([(0, 4), (W // 2, 4)], fill=NEON_YELLOW, width=6)
    bg_draw.line([(W // 2, 4), (W, 4)], fill=NEON_CYAN, width=6)

    t0 = time.time()
    print(f"Rendering Widescreen Studio Broadcast ({W}x{H}, {TOTAL_FRAMES} frames)...")
    stage_size = (800, 748)

    for f_idx in range(TOTAL_FRAMES):
        t = f_idx / FPS

        active_scene = scenes[-1]
        for s in scenes:
            if s["window"][0] <= t <= s["window"][1]:
                active_scene = s
                break

        w0, w1 = active_scene["window"]
        scene_dur = w1 - w0
        scene_p = max(0.0, min(1.0, (t - w0) / scene_dur))
        s_num = active_scene["num"]

        shot_a_id, shot_b_id = active_scene["shots"]
        mid_t = (w0 + w1) / 2.0
        blend_half = 0.22

        if t < mid_t - blend_half:
            p_a = (t - w0) / (mid_t - w0)
            stage_img = get_stage_crop(shots_cache[shot_a_id], shot_a_id, p_a, stage_size, direction=1 if s_num % 2 == 1 else -1)
            cur_shot_id = shot_a_id
        elif t > mid_t + blend_half:
            p_b = (t - mid_t) / (w1 - mid_t)
            stage_img = get_stage_crop(shots_cache[shot_b_id], shot_b_id, p_b, stage_size, direction=-1 if s_num % 2 == 1 else 1)
            cur_shot_id = shot_b_id
        else:
            p_a = min(1.0, (t - w0) / (mid_t - w0))
            p_b = max(0.0, (t - mid_t + blend_half) / (w1 - mid_t))
            fa = get_stage_crop(shots_cache[shot_a_id], shot_a_id, p_a, stage_size, direction=1 if s_num % 2 == 1 else -1)
            fb = get_stage_crop(shots_cache[shot_b_id], shot_b_id, p_b, stage_size, direction=-1 if s_num % 2 == 1 else 1)
            alpha = (t - (mid_t - blend_half)) / (2 * blend_half)
            stage_img = Image.blend(fa, fb, max(0.0, min(1.0, alpha)))
            cur_shot_id = shot_a_id if alpha < 0.5 else shot_b_id

        frame = studio_bg.copy()
        draw = ImageDraw.Draw(frame)

        # Left Stage Neon Frame & Paste 800x748 Shot
        draw_neon_box(draw, [44, 104, 852, 860], fill=INK_DARK, outline=NEON_YELLOW if s_num % 2 == 1 else NEON_CYAN, width=5, radius=24)
        frame.paste(stage_img, (48, 108))

        # Right Master Equation Bar + Chapter Infographic Dashboard
        draw_master_equation_bar(draw, s_num, t, fonts)
        draw_right_infographic_deck(draw, s_num, t, scene_p, fonts)

        # Widescreen HUD & Progress Bar
        draw_widescreen_hud(draw, active_scene, cur_shot_id, t, fonts)

        # Word-by-word Synced Kinetic Captions
        draw_word_synced_captions(draw, active_scene, t, fonts)

        # Lip-Synced Cleo-Style Host Avatar in bottom-left
        mouth_open = mouth_env[f_idx] if f_idx < len(mouth_env) else 0.0
        draw_cleo_host_avatar(draw, 132, 948, 68, t, mouth_open, fonts)

        if f_idx in sample_frames_to_save:
            frame.save(sample_frames_to_save[f_idx], quality=92)

        proc.stdin.write(frame.tobytes())

        if (f_idx + 1) % 300 == 0:
            print(f"  [16:9] Rendered {f_idx + 1}/{TOTAL_FRAMES} frames ({time.time() - t0:.1f}s)...")

    proc.stdin.close()
    proc.wait()
    subprocess.run(["cp", out_mp4, "explainer.mp4"], check=True)
    print(f"Widescreen Studio Video complete in {time.time() - t0:.1f}s -> {out_mp4} & explainer.mp4")


def get_vertical_cam_frame(upscaled_portrait, local_p, direction=1):
    """Smooth Ken Burns pan/zoom on 1080x1920 vertical canvas from 1200x2150 upscaled portrait."""
    uw, uh = upscaled_portrait.size
    p_smooth = ease_in_out_cubic(local_p)
    if direction > 0:
        crop_scale = 1.0 - 0.08 * p_smooth
        pan_x = p_smooth
        pan_y = 0.35 + 0.25 * p_smooth
    else:
        crop_scale = 0.92 + 0.08 * p_smooth
        pan_x = 1.0 - p_smooth
        pan_y = 0.60 - 0.25 * p_smooth

    cw = int(VW + (uw - VW) * crop_scale)
    ch = int(VH + (uh - VH) * crop_scale)
    x0 = int((uw - cw) * pan_x)
    y0 = int((uh - ch) * pan_y)
    return upscaled_portrait.crop((x0, y0, x0 + cw, y0 + ch)).resize((VW, VH), Image.Resampling.BILINEAR)


def render_vertical_short(scenes, mouth_env, fonts, vertical_cache):
    out_mp4 = "what_is_gdp_vertical.mp4"
    ffmpeg_cmd = [
        "ffmpeg", "-y",
        "-f", "rawvideo", "-vcodec", "rawvideo",
        "-pix_fmt", "rgb24", "-s", f"{VW}x{VH}", "-r", str(FPS),
        "-i", "-",
        "-i", "assets/audio/master_audio.wav",
        "-c:v", "libx264", "-preset", "fast", "-crf", "19",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest", "-movflags", "+faststart",
        out_mp4
    ]
    proc = subprocess.Popen(ffmpeg_cmd, stdin=subprocess.PIPE, stderr=subprocess.DEVNULL)

    t0 = time.time()
    print(f"Rendering 9:16 Vertical Short ({VW}x{VH}, {TOTAL_FRAMES} frames)...")

    for f_idx in range(TOTAL_FRAMES):
        t = f_idx / FPS
        active_scene = scenes[-1]
        for s in scenes:
            if s["window"][0] <= t <= s["window"][1]:
                active_scene = s
                break

        w0, w1 = active_scene["window"]
        s_num = active_scene["num"]
        shot_a_id, shot_b_id = active_scene["shots"]
        mid_t = (w0 + w1) / 2.0
        blend_half = 0.22

        if t < mid_t - blend_half:
            p_a = (t - w0) / (mid_t - w0)
            frame = get_vertical_cam_frame(vertical_cache[shot_a_id], p_a, direction=1 if s_num % 2 == 1 else -1)
        elif t > mid_t + blend_half:
            p_b = (t - mid_t) / (w1 - mid_t)
            frame = get_vertical_cam_frame(vertical_cache[shot_b_id], p_b, direction=-1 if s_num % 2 == 1 else 1)
        else:
            p_a = min(1.0, (t - w0) / (mid_t - w0))
            p_b = max(0.0, (t - mid_t + blend_half) / (w1 - mid_t))
            fa = get_vertical_cam_frame(vertical_cache[shot_a_id], p_a, direction=1 if s_num % 2 == 1 else -1)
            fb = get_vertical_cam_frame(vertical_cache[shot_b_id], p_b, direction=-1 if s_num % 2 == 1 else 1)
            alpha = (t - (mid_t - blend_half)) / (2 * blend_half)
            frame = Image.blend(fa, fb, max(0.0, min(1.0, alpha)))

        draw = ImageDraw.Draw(frame)

        # Top Chapter Pill + Formula Pill for 9:16 Vertical Short
        draw_neon_box(draw, [44, 42, 1036, 118], fill=(12, 18, 34), outline=NEON_YELLOW, width=4, radius=22)
        draw.rounded_rectangle([58, 54, 198, 106], radius=12, fill=NEON_YELLOW, outline=INK_DARK, width=2)
        draw.text((128, 80), f"CH 0{s_num}/08", font=fonts["ch_num"], fill=INK_DARK, anchor="mm")
        draw.text((220, 80), active_scene["title"], font=fonts["v_ch"], fill=TEXT_WHITE, anchor="lm")

        draw_neon_box(draw, [84, 134, 996, 198], fill=(15, 23, 42), outline=NEON_CYAN, width=3, radius=18)
        draw.text((540, 166), CLEAN_BADGES[s_num], font=fonts["v_badge"], fill=NEON_CYAN, anchor="mm")

        # Bottom Word-Synced Captions & Lip-Synced Avatar for 9:16
        mouth_open = mouth_env[f_idx] if f_idx < len(mouth_env) else 0.0
        draw_word_synced_captions(
            draw, active_scene, t, fonts,
            box=(44, 1540, 1036, 1790),
            font_key="v_cap",
            active_key="v_cap_active"
        )
        draw_cleo_host_avatar(draw, 130, 1435, 66, t, mouth_open, fonts)

        # Bottom progress bar
        draw.rounded_rectangle([44, 1830, 1036, 1848], radius=8, fill=(15, 23, 42), outline=(71, 85, 105), width=2)
        fw = int(992 * (t / DURATION))
        if fw > 8:
            draw.rounded_rectangle([44, 1830, 44 + fw, 1848], radius=8, fill=NEON_YELLOW)

        if f_idx == 45:
            frame.save("assets/frames/verify_vertical_01.jpg", quality=92)

        proc.stdin.write(frame.tobytes())

        if (f_idx + 1) % 450 == 0:
            print(f"  [9:16] Rendered {f_idx + 1}/{TOTAL_FRAMES} frames ({time.time() - t0:.1f}s)...")

    proc.stdin.close()
    proc.wait()
    print(f"9:16 Vertical Short complete in {time.time() - t0:.1f}s -> {out_mp4}")


def main():
    with open("assets/audio/timeline.json") as f:
        timeline = json.load(f)

    scenes = timeline["scenes"]
    mouth_env = timeline["mouth_env"]
    fonts = load_fonts()

    print("Preloading and upscaling 16 shots...")
    shots_cache = {}
    vertical_cache = {}
    for i in range(1, 17):
        sid = f"shot_{i:02d}"
        im = Image.open(f"assets/images/{sid}.png").convert("RGB")
        shots_cache[sid] = im.resize((920, 1648), Image.Resampling.LANCZOS)
        vertical_cache[sid] = im.resize((1200, 2150), Image.Resampling.LANCZOS)

    render_widescreen_studio(scenes, mouth_env, fonts, shots_cache)
    render_vertical_short(scenes, mouth_env, fonts, vertical_cache)


if __name__ == "__main__":
    main()
