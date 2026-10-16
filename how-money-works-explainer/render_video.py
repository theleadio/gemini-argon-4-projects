import json
import math
import subprocess
import time
import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H = 1920, 1080
FPS = 30
DURATION = 60.0
TOTAL_FRAMES = int(FPS * DURATION)

FONT_PATH = "/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf"
FONT_IMPACT = "/System/Library/Fonts/Supplemental/Impact.ttf"

def load_fonts():
    return {
        "ch_num": ImageFont.truetype(FONT_PATH, 24),
        "ch_title": ImageFont.truetype(FONT_PATH, 28),
        "badge": ImageFont.truetype(FONT_PATH, 26),
        "caption": ImageFont.truetype(FONT_PATH, 36),
        "caption_active": ImageFont.truetype(FONT_PATH, 38),
        "banner_big": ImageFont.truetype(FONT_PATH, 58),
        "banner_sub": ImageFont.truetype(FONT_PATH, 30),
        "coin_crest": ImageFont.truetype(FONT_PATH, 34),
        "coin_small": ImageFont.truetype(FONT_PATH, 22),
        "timer": ImageFont.truetype(FONT_PATH, 22),
        "counter_big": ImageFont.truetype(FONT_PATH, 46),
    }

CLEAN_BADGES = {
    1: "BREAD  <-->  FISH   (DIRECT BARTER)",
    2: "SHELLS  -->  SALT  -->  GOLD COINS",
    3: "HEAVY GOLD  -->  PAPER RECEIPTS",
    4: "FIAT MONEY  =  SHARED TRUST & LAW",
    5: "90%+ DIGITAL  •  BANK LENDING",
    6: "INFLATION:  $1.50  -->  $5.00  -->  $10.00",
    7: "INTEREST RATES:  COOL  <-->  BOOST",
    8: "MONEY  =  HUMANITY'S STORY OF TRUST",
}

def ease_out_back(x):
    c1 = 1.70158
    c3 = c1 + 1.0
    return 1.0 + c3 * pow(x - 1.0, 3) + c1 * pow(x - 1.0, 2)

def ease_in_out_cubic(x):
    return 4 * x * x * x if x < 0.5 else 1 - pow(-2 * x + 2, 3) / 2

def draw_cartoon_box(draw, box, fill, outline=(22, 18, 14), width=5, radius=22, shadow_offset=(6, 7), shadow_color=(15, 12, 10)):
    x0, y0, x1, y1 = box
    if shadow_offset:
        sx, sy = shadow_offset
        draw.rounded_rectangle([x0 + sx, y0 + sy, x1 + sx, y1 + sy], radius=radius, fill=shadow_color)
    draw.rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=fill, outline=outline, width=width)

def draw_spinning_coin(draw, cx, cy, radius, phase, font):
    # Horizontal scale simulates 3D coin spin
    sx = max(0.18, abs(math.cos(phase)))
    rx = int(radius * sx)
    ry = int(radius)
    # Coin edge thickness
    thickness = int(6 * (1.0 - sx)) + 3
    draw.ellipse([cx - rx - thickness, cy - ry, cx + rx + thickness, cy + ry], fill=(180, 115, 10), outline=(25, 18, 10), width=3)
    draw.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=(255, 210, 45), outline=(25, 18, 10), width=3)
    if rx > 10:
        irx = max(4, int(rx * 0.72))
        iry = int(ry * 0.72)
        draw.ellipse([cx - irx, cy - iry, cx + irx, cy + iry], outline=(215, 145, 15), width=2)
    if sx > 0.45 and font:
        draw.text((cx, cy), "$", font=font, fill=(140, 80, 5), anchor="mm")

def draw_sparkle(draw, cx, cy, size, angle=0.0, color=(255, 245, 150)):
    pts = []
    for i in range(8):
        r = size if i % 2 == 0 else size * 0.32
        a = angle + i * (math.pi / 4.0)
        pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    draw.polygon(pts, fill=color, outline=(30, 22, 12))

def draw_professor_penny(draw, t, mouth_open, fonts):
    # Mascot position in bottom-left
    base_x = 132
    bob_y = math.sin(t * 4.5) * 5.0 - mouth_open * 4.0
    base_y = int(948 + bob_y)
    r = 68

    # Cartoon gloved hands on left & right
    hand_wave = math.sin(t * 7.0) * (8.0 + mouth_open * 12.0)
    lh_x, lh_y = base_x - r - 22, int(base_y + 10 + hand_wave)
    rh_x, rh_y = base_x + r + 22, int(base_y - 6 - hand_wave)
    # Arms
    draw.line([(base_x - r + 8, base_y + 15), (lh_x, lh_y)], fill=(25, 18, 12), width=10)
    draw.line([(base_x + r - 8, base_y + 10), (rh_x, rh_y)], fill=(25, 18, 12), width=10)
    # White cartoon gloves
    for hx, hy in [(lh_x, lh_y), (rh_x, rh_y)]:
        draw.ellipse([hx - 16, hy - 14, hx + 16, hy + 14], fill=(255, 255, 255), outline=(25, 18, 12), width=4)
        draw.ellipse([hx - 8, hy - 18, hx + 8, hy - 4], fill=(255, 255, 255), outline=(25, 18, 12), width=3)

    # Drop shadow
    draw.ellipse([base_x - r + 6, base_y - r + 8, base_x + r + 6, base_y + r + 8], fill=(12, 10, 8))
    # Outer 3D Gold Rim
    draw.ellipse([base_x - r - 5, base_y - r, base_x + r + 5, base_y + r + 6], fill=(204, 132, 12), outline=(25, 18, 12), width=5)
    # Main Gold Face
    draw.ellipse([base_x - r, base_y - r, base_x + r, base_y + r], fill=(255, 212, 52), outline=(25, 18, 12), width=5)
    # Inner coin ring
    ir = r - 11
    draw.ellipse([base_x - ir, base_y - ir, base_x + ir, base_y + ir], fill=(255, 222, 82), outline=(218, 152, 20), width=3)

    # Specular shine arc (top-left)
    draw.ellipse([base_x - r + 18, base_y - r + 14, base_x - r + 42, base_y - r + 30], fill=(255, 248, 200))

    # Top tiny graduation/banker hat or "$" crest
    draw.text((base_x, base_y - 42), "$", font=fonts["coin_crest"], fill=(185, 115, 10), anchor="mm")

    # Eyes (blink every 3.4s for 0.14s)
    blink_phase = t % 3.4
    is_blinking = (blink_phase > 3.24)
    eye_y = base_y - 12
    for ex in [base_x - 21, base_x + 21]:
        if is_blinking:
            draw.line([(ex - 13, eye_y), (ex + 13, eye_y)], fill=(25, 18, 12), width=5)
        else:
            draw.ellipse([ex - 14, eye_y - 17, ex + 14, eye_y + 17], fill=(255, 255, 255), outline=(25, 18, 12), width=4)
            # Pupil looks slightly right toward the caption/scene
            px = ex + 3 + int(math.sin(t * 1.8) * 2)
            py = eye_y + 1
            draw.ellipse([px - 7, py - 9, px + 7, py + 9], fill=(22, 18, 15))
            draw.ellipse([px - 5, py - 6, px - 1, py - 2], fill=(255, 255, 255))

    # Expressive eyebrows
    brow_lift = int(mouth_open * 7.0)
    draw.arc([base_x - 37, eye_y - 29 - brow_lift, base_x - 7, eye_y - 12 - brow_lift], start=200, end=340, fill=(25, 18, 12), width=5)
    draw.arc([base_x + 7, eye_y - 29 - brow_lift, base_x + 37, eye_y - 12 - brow_lift], start=200, end=340, fill=(25, 18, 12), width=5)

    # Rosy cartoon cheeks
    draw.ellipse([base_x - 46, base_y + 2, base_x - 28, base_y + 14], fill=(255, 138, 101))
    draw.ellipse([base_x + 28, base_y + 2, base_x + 46, base_y + 14], fill=(255, 138, 101))

    # Lip-synced Mouth
    my = base_y + 24
    if mouth_open < 0.07:
        # Happy cartoon smile
        draw.arc([base_x - 22, my - 14, base_x + 22, my + 12], start=15, end=165, fill=(25, 18, 12), width=5)
    else:
        mw = int(18 + mouth_open * 12)
        mh = int(6 + mouth_open * 20)
        draw.rounded_rectangle([base_x - mw, my - mh // 2, base_x + mw, my + mh], radius=10, fill=(95, 18, 28), outline=(25, 18, 12), width=4)
        # White teeth bar at top
        if mh > 10:
            draw.rectangle([base_x - mw + 5, my - mh // 2 + 3, base_x + mw - 5, my - mh // 2 + 8], fill=(255, 255, 255))
        # Pink tongue arc at bottom
        draw.ellipse([base_x - mw // 2 - 2, my + mh // 3, base_x + mw // 2 + 2, my + mh - 2], fill=(255, 115, 135))

    # Cute red cartoon bowtie at bottom of coin
    by = base_y + r - 2
    draw.polygon([(base_x, by), (base_x - 24, by - 13), (base_x - 24, by + 13)], fill=(230, 57, 70), outline=(25, 18, 12))
    draw.polygon([(base_x, by), (base_x + 24, by - 13), (base_x + 24, by + 13)], fill=(230, 57, 70), outline=(25, 18, 12))
    draw.ellipse([base_x - 7, by - 7, base_x + 7, by + 7], fill=(255, 90, 100), outline=(25, 18, 12), width=3)

def draw_scene_overlays(draw, scene_num, t, scene_progress, fonts):
    # Dynamic animated 2D cartoon overlays tailored to each chapter
    if scene_num == 1:
        # Floating animated coins & question sparkles around the time portal
        for i in range(4):
            cx = 960 + int(math.sin(t * 2.5 + i * 1.6) * 140)
            cy = 240 + i * 130 + int(math.cos(t * 3.2 + i) * 18)
            draw_sparkle(draw, cx, cy, 18 + (i % 2) * 6, angle=t * 2.0 + i)
    elif scene_num == 2:
        # Spinning cartoon gold coins rising in celebration
        for i in range(5):
            cx = 360 + i * 300
            cy = int(230 + math.sin(t * 3.5 + i * 1.1) * 28)
            draw_spinning_coin(draw, cx, cy, 28, t * 4.5 + i * 0.9, fonts["coin_small"])
    elif scene_num == 3:
        if scene_progress < 0.5:
            # Animated sweat drops flying off the fisherman hauling gold
            for i in range(4):
                p = (t * 2.4 + i * 0.25) % 1.0
                sx = int(1120 + (i - 1.5) * 45 + p * 60)
                sy = int(310 - math.sin(p * math.pi) * 55 + p * 85)
                draw.ellipse([sx - 7, sy - 11, sx + 7, sy + 11], fill=(100, 210, 255), outline=(20, 30, 50), width=3)
        else:
            # Glowing sparkles around the first paper banknote receipt
            for i in range(5):
                ang = t * 2.2 + i * (2 * math.pi / 5)
                cx = 690 + int(math.cos(ang) * 115)
                cy = 430 + int(math.sin(ang) * 85)
                draw_sparkle(draw, cx, cy, 18, angle=ang)
    elif scene_num == 4:
        # Golden trust waves / sparkles connecting citizens
        for i in range(6):
            ang = t * 1.8 + i * (math.pi / 3)
            cx = 960 + int(math.cos(ang) * 260)
            cy = 440 + int(math.sin(ang) * 130)
            draw_sparkle(draw, cx, cy, 20, angle=-ang, color=(255, 230, 90))
    elif scene_num == 5:
        # Live animated digital percentage counter badge (0% -> 90% DIGITAL)
        pct = min(90, int(scene_progress * 180))
        bx0, by0, bx1, by1 = 665, 118, 1255, 204
        draw_cartoon_box(draw, [bx0, by0, bx1, by1], fill=(15, 28, 55), outline=(56, 189, 248), width=5, radius=24)
        draw.text((960, 161), f"DIGITAL MONEY: {pct}%+", font=fonts["counter_big"], fill=(103, 232, 249), anchor="mm")
    elif scene_num == 6:
        # Live inflating coffee price ticker badge ($1.50 -> $5.00 -> $10.00!)
        price = 1.50 + min(8.50, scene_progress * 11.0)
        shake_x = int(math.sin(t * 28.0) * 5) if scene_progress > 0.45 else 0
        shake_y = int(math.cos(t * 32.0) * 4) if scene_progress > 0.45 else 0
        bx0, by0, bx1, by1 = 640 + shake_x, 118 + shake_y, 1280 + shake_x, 204 + shake_y
        draw_cartoon_box(draw, [bx0, by0, bx1, by1], fill=(153, 27, 27), outline=(254, 202, 202), width=5, radius=24)
        draw.text((935 + shake_x, 161 + shake_y), f"COFFEE PRICE: ${price:0.2f}", font=fonts["counter_big"], fill=(254, 240, 138), anchor="mm")
        # Crisp vector upward arrow inside the right side of the badge
        ax, ay = 1222 + shake_x, 161 + shake_y
        draw.polygon([(ax, ay - 22), (ax - 18, ay + 4), (ax - 7, ay + 4), (ax - 7, ay + 22), (ax + 7, ay + 22), (ax + 7, ay + 4), (ax + 18, ay + 4)], fill=(254, 240, 138), outline=(25, 18, 12))
    elif scene_num == 7:
        # Thermostat status indicator pill
        mode_txt = "COOLING INFLATION (RATES UP)" if scene_progress < 0.5 else "SPARKING JOBS & LOANS (RATES DOWN)"
        mode_col = (14, 116, 144) if scene_progress < 0.5 else (21, 128, 61)
        draw_cartoon_box(draw, [600, 118, 1320, 198], fill=mode_col, outline=(255, 255, 255), width=4, radius=22)
        draw.text((960, 158), mode_txt, font=fonts["ch_title"], fill=(255, 255, 255), anchor="mm")
    elif scene_num == 8:
        # Celebratory golden confetti & spinning coins across the finale!
        rng_Colors = [(255, 215, 0), (56, 189, 248), (244, 63, 94), (74, 222, 128), (168, 85, 247)]
        for i in range(28):
            cx = (i * 73 + int(math.sin(t * 2.5 + i) * 45)) % W
            cy = int((t * 160 + i * 47) % (H - 220))
            col = rng_Colors[i % len(rng_Colors)]
            ang = t * 4.0 + i
            dx = int(math.cos(ang) * 11)
            dy = int(math.sin(ang) * 7)
            draw.polygon([(cx - dx, cy - dy), (cx + dy, cy - dx), (cx + dx, cy + dy), (cx - dy, cy + dx)], fill=col, outline=(20, 16, 12))

def draw_word_synced_captions(draw, scene, t, fonts):
    # Speech bubble box at bottom right of Professor Penny
    bx0, by0, bx1, by1 = 236, 874, 1872, 1038
    # Speech bubble tail pointing to Professor Penny
    draw.polygon([(238, 945), (200, 956), (238, 978)], fill=(24, 28, 44), outline=(255, 212, 52))
    draw_cartoon_box(draw, [bx0, by0, bx1, by1], fill=(24, 28, 44), outline=(255, 212, 52), width=5, radius=26, shadow_offset=(6, 8))

    words = scene["words"]
    # Find single active word index
    active_word_idx = None
    for idx, w in enumerate(words):
        if w["start"] <= t <= w["end"]:
            active_word_idx = idx
            break

    # Split words into 2 balanced lines
    mid_idx = len(words) // 2
    total_chars = sum(len(w["word"]) for w in words)
    acc = 0
    for idx, w in enumerate(words):
        acc += len(w["word"])
        if acc >= total_chars / 2:
            mid_idx = idx + 1
            break

    lines = [
        [(idx, words[idx]) for idx in range(0, mid_idx)],
        [(idx, words[idx]) for idx in range(mid_idx, len(words))]
    ]
    line_ys = [924, 986]

    for line_words, ly in zip(lines, line_ys):
        if not line_words:
            continue
        space_w = 14
        widths = []
        for _, w in line_words:
            bbox = fonts["caption"].getbbox(w["word"])
            widths.append(bbox[2] - bbox[0])
        total_w = sum(widths) + space_w * (len(line_words) - 1)
        cursor_x = (bx0 + bx1 - total_w) // 2

        for (w_idx, w), ww in zip(line_words, widths):
            is_active = (w_idx == active_word_idx) and (w["word"] != "—")
            is_past = (t > w["end"])
            word_str = w["word"]

            if is_active:
                pad_x, pad_y = 10, 6
                draw.rounded_rectangle(
                    [cursor_x - pad_x, ly - 24 - pad_y, cursor_x + ww + pad_x, ly + 18 + pad_y],
                    radius=12,
                    fill=(255, 212, 52),
                    outline=(20, 15, 10),
                    width=3
                )
                draw.text((cursor_x + ww // 2, ly - 3), word_str, font=fonts["caption_active"], fill=(20, 15, 10), anchor="mm")
            else:
                txt_col = (255, 255, 255) if is_past else (186, 198, 218)
                draw.text((cursor_x + ww // 2 + 2, ly + 2), word_str, font=fonts["caption"], fill=(10, 12, 18), anchor="mm")
                draw.text((cursor_x + ww // 2, ly), word_str, font=fonts["caption"], fill=txt_col, anchor="mm")

            cursor_x += ww + space_w

def draw_hud(draw, scene, t, fonts):
    s_num = scene["num"]
    w0, w1 = scene["window"]
    local_t = max(0.0, t - w0)

    # 1. Top-Left Chapter Pill
    ch_box = [42, 32, 650, 100]
    draw_cartoon_box(draw, ch_box, fill=(255, 248, 225), outline=(25, 18, 12), width=5, radius=22)
    # Chapter number circle
    draw.rounded_rectangle([54, 42, 168, 90], radius=14, fill=(245, 158, 11), outline=(25, 18, 12), width=3)
    draw.text((111, 66), f"CH 0{s_num}/08", font=fonts["ch_num"], fill=(25, 18, 12), anchor="mm")
    draw.text((188, 66), scene["title"], font=fonts["ch_title"], fill=(25, 18, 12), anchor="lm")

    # 2. Top-Right Concept Formula Pill (with spring entrance)
    enter_p = min(1.0, local_t / 0.45)
    scale_y = ease_out_back(enter_p)
    badge_str = CLEAN_BADGES[s_num]
    bbox = fonts["badge"].getbbox(badge_str)
    bw = (bbox[2] - bbox[0]) + 56
    bx1 = W - 42
    bx0 = bx1 - bw
    by_center = 66
    bh_half = max(6, int(34 * scale_y))
    draw_cartoon_box(draw, [bx0, by_center - bh_half, bx1, by_center + bh_half], fill=(30, 41, 59), outline=(255, 212, 52), width=4, radius=20)
    if enter_p > 0.35:
        draw.text(((bx0 + bx1) // 2, by_center), badge_str, font=fonts["badge"], fill=(255, 235, 130), anchor="mm")

    # 3. Opening & Finale Title Banners
    if t < 1.8:
        alpha_p = 1.0 if t < 1.35 else max(0.0, (1.8 - t) / 0.45)
        if alpha_p > 0.05:
            y_off = int((1.0 - ease_out_back(min(1.0, t / 0.45))) * -120)
            draw_cartoon_box(draw, [440, 122 + y_off, 1480, 220 + y_off], fill=(255, 212, 52), outline=(25, 18, 12), width=6, radius=28)
            draw.text((960, 171 + y_off), "HOW MONEY WORKS", font=fonts["banner_big"], fill=(25, 18, 12), anchor="mm")

    if t > 57.2:
        enter = min(1.0, (t - 57.2) / 0.45)
        y_off = int((1.0 - ease_out_back(enter)) * -100)
        draw_cartoon_box(draw, [360, 118 + y_off, 1560, 232 + y_off], fill=(255, 212, 52), outline=(25, 18, 12), width=6, radius=28)
        draw.text((960, 158 + y_off), "HOW MONEY WORKS", font=fonts["banner_big"], fill=(25, 18, 12), anchor="mm")
        draw.text((960, 206 + y_off), "Metal • Paper • Pixels • Shared Human Trust", font=fonts["banner_sub"], fill=(120, 53, 15), anchor="mm")

    # 4. Bottom 8-Chapter Timeline Progress Bar
    bar_y0, bar_y1 = 1058, 1072
    bar_x0, bar_x1 = 236, 1730
    draw.rounded_rectangle([bar_x0, bar_y0, bar_x1, bar_y1], radius=6, fill=(15, 23, 42), outline=(71, 85, 105), width=2)
    fill_w = int((bar_x1 - bar_x0) * (t / DURATION))
    if fill_w > 8:
        draw.rounded_rectangle([bar_x0, bar_y0, bar_x0 + fill_w, bar_y1], radius=6, fill=(250, 204, 21))

    # Timer pill at bottom-right
    rem = int(math.ceil(DURATION - t))
    el = int(t)
    draw.text((1805, 1064), f"0:{el:02d} / 1:00", font=fonts["timer"], fill=(226, 232, 240), anchor="mm")

def get_camera_frame(upscaled_img, local_p, direction=1):
    # upscaled_img is (2208, 1242) = 1.15x of (1920, 1080)
    uw, uh = upscaled_img.size
    # Smoothly zoom between 1.00 and 1.10 and pan horizontally
    p_smooth = ease_in_out_cubic(max(0.0, min(1.0, local_p)))
    if direction > 0:
        crop_scale = 1.0 - 0.085 * p_smooth
        pan_x = p_smooth
        pan_y = 0.4 + 0.2 * p_smooth
    else:
        crop_scale = 0.915 + 0.085 * p_smooth
        pan_x = 1.0 - p_smooth
        pan_y = 0.6 - 0.2 * p_smooth

    cw = int(W + (uw - W) * crop_scale)
    ch = int(H + (uh - H) * crop_scale)
    max_dx = uw - cw
    max_dy = uh - ch
    x0 = int(max_dx * pan_x)
    y0 = int(max_dy * pan_y)
    cropped = upscaled_img.crop((x0, y0, x0 + cw, y0 + ch))
    return cropped.resize((W, H), Image.Resampling.BILINEAR)

def apply_iris_transition(frame_img, iris_radius):
    # Classic cartoon circular iris wipe around center (960, 500)
    mask = Image.new("L", (W, H), 0)
    mdraw = ImageDraw.Draw(mask)
    cx, cy = 960, 500
    r = int(iris_radius)
    if r > 0:
        mdraw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
    bg = Image.new("RGB", (W, H), (18, 16, 24))
    out = Image.composite(frame_img, bg, mask)
    odraw = ImageDraw.Draw(out)
    if 5 < r < 1150:
        odraw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(255, 212, 52), width=10)
    return out

def main():
    t0 = time.time()
    with open("assets/audio/timeline.json") as f:
        timeline = json.load(f)

    scenes = timeline["scenes"]
    mouth_env = timeline["mouth_env"]
    fonts = load_fonts()

    # Preload and upscale all 16 cartoon shots once
    print("Preloading and upscaling 16 cartoon shots...")
    shots_cache = {}
    for i in range(1, 17):
        sid = f"shot_{i:02d}"
        im = Image.open(f"assets/images/{sid}.png").convert("RGB")
        shots_cache[sid] = im.resize((2208, 1242), Image.Resampling.LANCZOS)

    # Start FFmpeg pipe to encode H.264 MP4 + mux master_audio.wav
    out_mp4 = "how_money_works_explainer.mp4"
    ffmpeg_cmd = [
        "ffmpeg", "-y",
        "-f", "rawvideo",
        "-vcodec", "rawvideo",
        "-pix_fmt", "rgb24",
        "-s", f"{W}x{H}",
        "-r", str(FPS),
        "-i", "-",
        "-i", "assets/audio/master_audio.wav",
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "18",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        "-movflags", "+faststart",
        out_mp4
    ]

    proc = subprocess.Popen(ffmpeg_cmd, stdin=subprocess.PIPE, stderr=subprocess.DEVNULL)

    sample_frames_to_save = {
        45: "assets/frames/verify_01_barter.jpg",
        300: "assets/frames/verify_02_commodity.jpg",
        620: "assets/frames/verify_03_banknotes.jpg",
        1020: "assets/frames/verify_05_digital_bank.jpg",
        1250: "assets/frames/verify_06_inflation.jpg",
        1740: "assets/frames/verify_08_finale.jpg",
    }

    print(f"Rendering {TOTAL_FRAMES} frames at {W}x{H} ({FPS}fps)...")
    for f_idx in range(TOTAL_FRAMES):
        t = f_idx / FPS

        # Find active scene
        active_scene = scenes[-1]
        for s in scenes:
            if s["window"][0] <= t <= s["window"][1]:
                active_scene = s
                break

        w0, w1 = active_scene["window"]
        scene_dur = w1 - w0
        scene_p = (t - w0) / scene_dur
        s_num = active_scene["num"]

        shot_a_id, shot_b_id = active_scene["shots"]
        mid_t = (w0 + w1) / 2.0

        # Render camera motion for Shot A / Shot B with 0.45s cross-dissolve at mid_t
        blend_half = 0.22
        if t < mid_t - blend_half:
            p_a = (t - w0) / (mid_t - w0)
            frame = get_camera_frame(shots_cache[shot_a_id], p_a, direction=1 if s_num % 2 == 1 else -1)
        elif t > mid_t + blend_half:
            p_b = (t - mid_t) / (w1 - mid_t)
            frame = get_camera_frame(shots_cache[shot_b_id], p_b, direction=-1 if s_num % 2 == 1 else 1)
        else:
            p_a = min(1.0, (t - w0) / (mid_t - w0))
            p_b = max(0.0, (t - mid_t + blend_half) / (w1 - mid_t))
            fa = get_camera_frame(shots_cache[shot_a_id], p_a, direction=1 if s_num % 2 == 1 else -1)
            fb = get_camera_frame(shots_cache[shot_b_id], p_b, direction=-1 if s_num % 2 == 1 else 1)
            alpha = (t - (mid_t - blend_half)) / (2 * blend_half)
            frame = Image.blend(fa, fb, max(0.0, min(1.0, alpha)))

        # Subtle cartoon iris transition at scene boundaries (first/last 0.20s of scene)
        if s_num > 1 and (t - w0) < 0.20:
            iris_p = (t - w0) / 0.20
            frame = apply_iris_transition(frame, 180 + iris_p * 1020)
        elif s_num < 8 and (w1 - t) < 0.18:
            iris_p = (w1 - t) / 0.18
            frame = apply_iris_transition(frame, 180 + iris_p * 1020)

        draw = ImageDraw.Draw(frame)

        # Draw scene-specific animated cartoon overlays
        draw_scene_overlays(draw, s_num, t, scene_p, fonts)

        # Draw HUD (top chapter card, concept badge, title banners, bottom progress bar)
        draw_hud(draw, active_scene, t, fonts)

        # Draw word-by-word synced cartoon captions
        draw_word_synced_captions(draw, active_scene, t, fonts)

        # Draw Professor Penny (lip-synced to ElevenLabs v4 voiceover!)
        mouth_open = mouth_env[f_idx] if f_idx < len(mouth_env) else 0.0
        draw_professor_penny(draw, t, mouth_open, fonts)

        if f_idx in sample_frames_to_save:
            frame.save(sample_frames_to_save[f_idx], quality=90)

        proc.stdin.write(frame.tobytes())

        if (f_idx + 1) % 300 == 0:
            elapsed = time.time() - t0
            print(f"  Rendered {f_idx + 1}/{TOTAL_FRAMES} frames ({elapsed:.1f}s)...")

    proc.stdin.close()
    proc.wait()

    # Copy to explainer.mp4 as convenience alias
    subprocess.run(["cp", out_mp4, "explainer.mp4"], check=True)
    print(f"Done in {time.time() - t0:.1f}s! Output: {out_mp4} and explainer.mp4")

if __name__ == "__main__":
    main()
