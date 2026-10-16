import json
import math
import subprocess
import time
from PIL import Image, ImageDraw, ImageFont

W, H = 1920, 1080
FPS = 30
DURATION = 60.0
TOTAL_FRAMES = int(FPS * DURATION)

ZH_FONT_PATH = "/System/Library/Fonts/STHeiti Medium.ttc"
EN_ROUND_PATH = "/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf"

def load_fonts():
    return {
        "ch_num": ImageFont.truetype(EN_ROUND_PATH, 23),
        "ch_title": ImageFont.truetype(ZH_FONT_PATH, 30),
        "badge": ImageFont.truetype(ZH_FONT_PATH, 27),
        "caption": ImageFont.truetype(ZH_FONT_PATH, 38),
        "caption_active": ImageFont.truetype(ZH_FONT_PATH, 40),
        "banner_big": ImageFont.truetype(ZH_FONT_PATH, 54),
        "banner_sub": ImageFont.truetype(ZH_FONT_PATH, 29),
        "host_tag": ImageFont.truetype(ZH_FONT_PATH, 20),
        "timer": ImageFont.truetype(EN_ROUND_PATH, 22),
        "counter_big": ImageFont.truetype(ZH_FONT_PATH, 40),
        "coin_small": ImageFont.truetype(EN_ROUND_PATH, 22),
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
    sx = max(0.18, abs(math.cos(phase)))
    rx = int(radius * sx)
    ry = int(radius)
    thickness = int(6 * (1.0 - sx)) + 3
    draw.ellipse([cx - rx - thickness, cy - ry, cx + rx + thickness, cy + ry], fill=(180, 115, 10), outline=(25, 18, 10), width=3)
    draw.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=(255, 210, 45), outline=(25, 18, 10), width=3)
    if rx > 10:
        irx = max(4, int(rx * 0.72))
        iry = int(ry * 0.72)
        draw.ellipse([cx - irx, cy - iry, cx + irx, cy + iry], outline=(215, 145, 15), width=2)
    if sx > 0.45 and font:
        draw.text((cx, cy), "$", font=font, fill=(140, 80, 5), anchor="mm")

def draw_sparkle(draw, cx, cy, size, angle=0.0, color=(255, 240, 120)):
    pts = []
    for i in range(8):
        r = size if i % 2 == 0 else size * 0.32
        a = angle + i * (math.pi / 4.0)
        pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    draw.polygon(pts, fill=color, outline=(30, 22, 12))

def draw_xiaolin_avatar(draw, t, mouth_open, fonts):
    """Draws the animated XiaoLin (小林) host avatar in the bottom-left corner, lip-synced to ElevenLabs v4."""
    base_x = 128
    bob_y = math.sin(t * 4.8) * 4.5 - mouth_open * 3.5
    base_y = int(935 + bob_y)
    r = 72

    # Circular studio portrait frame
    draw.ellipse([base_x - r + 5, base_y - r + 7, base_x + r + 5, base_y + r + 7], fill=(12, 10, 8))
    draw.ellipse([base_x - r, base_y - r, base_x + r, base_y + r], fill=(254, 243, 199), outline=(255, 212, 52), width=6)
    draw.ellipse([base_x - r + 5, base_y - r + 5, base_x + r - 5, base_y + r - 5], outline=(25, 18, 12), width=3)

    # Back hair (dark bob)
    draw.ellipse([base_x - 50, base_y - 52, base_x + 50, base_y + 38], fill=(30, 27, 36), outline=(18, 15, 22), width=4)

    # Shoulders & signature XiaoLin yellow blazer
    draw.pieslice([base_x - 56, base_y + 18, base_x + 56, base_y + 92], start=180, end=360, fill=(250, 204, 21), outline=(25, 18, 12), width=4)
    # White inner shirt V-neck
    draw.polygon([(base_x - 16, base_y + 22), (base_x + 16, base_y + 22), (base_x, base_y + 54)], fill=(255, 255, 255), outline=(25, 18, 12))

    # Neck & Face
    draw.rectangle([base_x - 10, base_y + 8, base_x + 10, base_y + 26], fill=(255, 224, 196), outline=(25, 18, 12), width=3)
    draw.ellipse([base_x - 36, base_y - 42, base_x + 36, base_y + 22], fill=(255, 228, 202), outline=(25, 18, 12), width=4)

    # Side bangs / hair parting
    draw.pieslice([base_x - 38, base_y - 46, base_x + 38, base_y - 4], start=175, end=365, fill=(30, 27, 36), outline=(18, 15, 22), width=3)
    draw.polygon([(base_x - 12, base_y - 26), (base_x - 4, base_y - 40), (base_x + 6, base_y - 25)], fill=(255, 228, 202))

    # Eyes (blink every 3.2s)
    blink_phase = t % 3.2
    is_blinking = (blink_phase > 3.05)
    eye_y = base_y - 12
    for ex in [base_x - 15, base_x + 15]:
        if is_blinking:
            draw.line([(ex - 8, eye_y), (ex + 8, eye_y)], fill=(25, 18, 12), width=4)
        else:
            draw.ellipse([ex - 7, eye_y - 8, ex + 7, eye_y + 8], fill=(25, 18, 12))
            draw.ellipse([ex - 4, eye_y - 5, ex + 1, eye_y], fill=(255, 255, 255))

    # Eyebrows
    brow_lift = int(mouth_open * 5.0)
    draw.arc([base_x - 24, eye_y - 18 - brow_lift, base_x - 6, eye_y - 8 - brow_lift], start=195, end=345, fill=(25, 18, 12), width=3)
    draw.arc([base_x + 6, eye_y - 18 - brow_lift, base_x + 24, eye_y - 8 - brow_lift], start=195, end=345, fill=(25, 18, 12), width=3)

    # Rosy cheeks
    draw.ellipse([base_x - 29, base_y - 4, base_x - 17, base_y + 4], fill=(255, 148, 130))
    draw.ellipse([base_x + 17, base_y - 4, base_x + 29, base_y + 4], fill=(255, 148, 130))

    # Lip-synced Mouth
    my = base_y + 6
    if mouth_open < 0.06:
        draw.arc([base_x - 10, my - 6, base_x + 10, my + 6], start=15, end=165, fill=(25, 18, 12), width=3)
    else:
        mw = int(8 + mouth_open * 8)
        mh = int(4 + mouth_open * 13)
        draw.rounded_rectangle([base_x - mw, my - mh // 2, base_x + mw, my + mh], radius=6, fill=(185, 38, 52), outline=(25, 18, 12), width=3)
        if mh > 7:
            draw.rectangle([base_x - mw + 3, my - mh // 2 + 2, base_x + mw - 3, my - mh // 2 + 5], fill=(255, 255, 255))

    # Animated right hand holding a whiteboard marker
    wave = math.sin(t * 7.5) * (6.0 + mouth_open * 10.0)
    hx = base_x + r - 6
    hy = int(base_y + 12 - wave)
    # Marker pen
    draw.line([(hx - 6, hy + 8), (hx + 18, hy - 18)], fill=(30, 41, 59), width=9)
    draw.line([(hx + 14, hy - 14), (hx + 22, hy - 22)], fill=(239, 68, 68), width=7)
    # Hand
    draw.ellipse([hx - 11, hy - 10, hx + 11, hy + 10], fill=(255, 228, 202), outline=(25, 18, 12), width=3)

    # Host name badge at bottom of avatar
    draw_cartoon_box(draw, [42, 1002, 214, 1040], fill=(255, 212, 52), outline=(25, 18, 12), width=3, radius=12, shadow_offset=(3, 4))
    draw.text((128, 1021), "小林說 • 國債篇", font=fonts["host_tag"], fill=(25, 18, 12), anchor="mm")

def draw_scene_overlays(draw, scene_num, t, scene_progress, fonts):
    """Dynamic animated 2D overlays tailored to each of the 8 chapters."""
    if scene_num == 1:
        # Live ticking US National Debt Clock banner
        debt_val = 36_248_510_000_000 + int(t * 98_432_110)
        bx0, by0, bx1, by1 = 530, 114, 1390, 192
        draw_cartoon_box(draw, [bx0, by0, bx1, by1], fill=(127, 29, 29), outline=(254, 202, 202), width=4, radius=20)
        draw.text((960, 153), f"美債即時跳表：${debt_val:,}", font=fonts["counter_big"], fill=(254, 240, 138), anchor="mm")
    elif scene_num == 2:
        # Sparkling golden stars around the official Treasury Bond IOU
        for i in range(5):
            ang = t * 2.2 + i * (2 * math.pi / 5)
            cx = 960 + int(math.cos(ang) * 320)
            cy = 380 + int(math.sin(ang) * 140)
            draw_sparkle(draw, cx, cy, 20, angle=ang)
    elif scene_num == 3:
        # Spinning $40 interest coins floating across the top
        for i in range(5):
            cx = 400 + i * 280
            cy = int(200 + math.sin(t * 3.8 + i * 1.1) * 24)
            draw_spinning_coin(draw, cx, cy, 26, t * 4.5 + i * 0.8, fonts["coin_small"])
    elif scene_num == 4:
        # Live Seesaw Ticker: Bond Price vs Yield
        swing = math.sin(t * 3.2)
        price = 100.0 + swing * 6.5
        yield_pct = 4.00 - swing * 0.65
        bx0, by0, bx1, by1 = 540, 114, 1380, 190
        draw_cartoon_box(draw, [bx0, by0, bx1, by1], fill=(15, 23, 42), outline=(56, 189, 248), width=4, radius=20)
        draw.text((960, 152), f"價格 ${price:0.1f}  ↔  殖利率 {yield_pct:0.2f}% (反比蹺蹺板)", font=fonts["ch_title"], fill=(125, 211, 252), anchor="mm")
    elif scene_num == 5:
        # Rollover cycle counter badge
        bx0, by0, bx1, by1 = 560, 114, 1360, 190
        draw_cartoon_box(draw, [bx0, by0, bx1, by1], fill=(20, 83, 45), outline=(134, 239, 172), width=4, radius=20)
        draw.text((960, 152), "借新還舊循環：發新債 $1,000 → 償還到期舊債 $1,000", font=fonts["ch_title"], fill=(240, 253, 244), anchor="mm")
    elif scene_num == 6:
        # Shaking inflation alert ticker
        price = 2.50 + min(7.50, scene_progress * 9.5)
        sx = int(math.sin(t * 28.0) * 4) if scene_progress > 0.4 else 0
        sy = int(math.cos(t * 32.0) * 3) if scene_progress > 0.4 else 0
        bx0, by0, bx1, by1 = 570 + sx, 114 + sy, 1350 + sx, 190 + sy
        draw_cartoon_box(draw, [bx0, by0, bx1, by1], fill=(153, 27, 27), outline=(254, 202, 202), width=4, radius=20)
        draw.text((960 + sx, 152 + sy), f"印鈔過頭 → 物價飛天：一杯咖啡 ${price:0.2f} ↑", font=fonts["ch_title"], fill=(254, 240, 138), anchor="mm")
    elif scene_num == 7:
        mode_txt = "良性循環：基建科研 → GDP 增速 ＞ 利息成本" if scene_progress < 0.52 else "危險警訊：只借不投 → 利息吃光稅收（債務陷阱）"
        mode_col = (21, 128, 61) if scene_progress < 0.52 else (185, 28, 28)
        draw_cartoon_box(draw, [520, 114, 1400, 190], fill=mode_col, outline=(255, 255, 255), width=4, radius=20)
        draw.text((960, 152), mode_txt, font=fonts["ch_title"], fill=(255, 255, 255), anchor="mm")
    elif scene_num == 8:
        # Celebratory golden confetti across the finale
        rng_colors = [(255, 215, 0), (56, 189, 248), (244, 63, 94), (74, 222, 128), (168, 85, 247)]
        for i in range(26):
            cx = (i * 73 + int(math.sin(t * 2.5 + i) * 45)) % W
            cy = int((t * 155 + i * 47) % (H - 220))
            col = rng_colors[i % len(rng_colors)]
            ang = t * 4.0 + i
            dx = int(math.cos(ang) * 10)
            dy = int(math.sin(ang) * 6)
            draw.polygon([(cx - dx, cy - dy), (cx + dy, cy - dx), (cx + dx, cy + dy), (cx - dy, cy + dx)], fill=col, outline=(20, 16, 12))

def draw_word_synced_captions(draw, scene, t, fonts):
    """Draws phrase-by-phrase karaoke subtitles in the bottom speech bar."""
    bx0, by0, bx1, by1 = 236, 874, 1872, 1038
    draw.polygon([(238, 940), (202, 952), (238, 972)], fill=(24, 28, 44), outline=(255, 212, 52))
    draw_cartoon_box(draw, [bx0, by0, bx1, by1], fill=(24, 28, 44), outline=(255, 212, 52), width=5, radius=26, shadow_offset=(6, 8))

    words = scene["words"]
    active_word_idx = None
    for idx, w in enumerate(words):
        if w["start"] <= t <= w["end"]:
            active_word_idx = idx
            break

    # Split phrases into 2 balanced lines
    mid_idx = max(1, len(words) // 2)
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
    line_ys = [924, 988]

    for line_words, ly in zip(lines, line_ys):
        if not line_words:
            continue
        space_w = 16
        widths = []
        for _, w in line_words:
            bbox = fonts["caption"].getbbox(w["word"])
            widths.append(bbox[2] - bbox[0])
        total_w = sum(widths) + space_w * (len(line_words) - 1)
        cursor_x = (bx0 + bx1 - total_w) // 2

        for (w_idx, w), ww in zip(line_words, widths):
            is_active = (w_idx == active_word_idx)
            is_past = (t > w["end"])
            word_str = w["word"]

            if is_active:
                pad_x, pad_y = 12, 7
                draw.rounded_rectangle(
                    [cursor_x - pad_x, ly - 24 - pad_y, cursor_x + ww + pad_x, ly + 20 + pad_y],
                    radius=12,
                    fill=(255, 212, 52),
                    outline=(20, 15, 10),
                    width=3
                )
                draw.text((cursor_x + ww // 2, ly - 2), word_str, font=fonts["caption_active"], fill=(20, 15, 10), anchor="mm")
            else:
                txt_col = (255, 255, 255) if is_past else (182, 196, 218)
                draw.text((cursor_x + ww // 2 + 2, ly + 2), word_str, font=fonts["caption"], fill=(10, 12, 18), anchor="mm")
                draw.text((cursor_x + ww // 2, ly), word_str, font=fonts["caption"], fill=txt_col, anchor="mm")

            cursor_x += ww + space_w

def draw_hud(draw, scene, t, fonts):
    s_num = scene["num"]
    w0, w1 = scene["window"]
    local_t = max(0.0, t - w0)

    # 1. Top-Left Chapter Pill
    ch_box = [42, 30, 690, 98]
    draw_cartoon_box(draw, ch_box, fill=(255, 248, 225), outline=(25, 18, 12), width=5, radius=22)
    draw.rounded_rectangle([54, 40, 168, 88], radius=14, fill=(245, 158, 11), outline=(25, 18, 12), width=3)
    draw.text((111, 64), f"CH 0{s_num}/08", font=fonts["ch_num"], fill=(25, 18, 12), anchor="mm")
    draw.text((186, 64), scene["title"], font=fonts["ch_title"], fill=(25, 18, 12), anchor="lm")

    # 2. Top-Right Concept Formula Pill (with spring entrance)
    enter_p = min(1.0, local_t / 0.45)
    scale_y = ease_out_back(enter_p)
    badge_str = scene["badge"]
    bbox = fonts["badge"].getbbox(badge_str)
    bw = (bbox[2] - bbox[0]) + 56
    bx1 = W - 42
    bx0 = bx1 - bw
    by_center = 64
    bh_half = max(6, int(34 * scale_y))
    draw_cartoon_box(draw, [bx0, by_center - bh_half, bx1, by_center + bh_half], fill=(30, 41, 59), outline=(255, 212, 52), width=4, radius=20)
    if enter_p > 0.35:
        draw.text(((bx0 + bx1) // 2, by_center), badge_str, font=fonts["badge"], fill=(255, 235, 130), anchor="mm")

    # 3. Opening & Finale Title Banners
    if t < 1.7:
        alpha_p = 1.0 if t < 1.25 else max(0.0, (1.7 - t) / 0.45)
        if alpha_p > 0.05:
            y_off = int((1.0 - ease_out_back(min(1.0, t / 0.42))) * -120)
            draw_cartoon_box(draw, [420, 198 + y_off, 1500, 298 + y_off], fill=(255, 212, 52), outline=(25, 18, 12), width=6, radius=28)
            draw.text((960, 248 + y_off), "小林說風格 • 60秒搞懂什麼是「國債」", font=fonts["banner_big"], fill=(25, 18, 12), anchor="mm")

    if t > 57.0:
        enter = min(1.0, (t - 57.0) / 0.45)
        y_off = int((1.0 - ease_out_back(enter)) * -100)
        draw_cartoon_box(draw, [360, 114 + y_off, 1560, 228 + y_off], fill=(255, 212, 52), outline=(25, 18, 12), width=6, radius=28)
        draw.text((960, 154 + y_off), "60秒搞懂國債：向未來借錢的時光機", font=fonts["banner_big"], fill=(25, 18, 12), anchor="mm")
        draw.text((960, 202 + y_off), "官方欠條 I.O.U. • 價格與殖利率反比 • 借新還舊 • 國家信用", font=fonts["banner_sub"], fill=(120, 53, 15), anchor="mm")

    # 4. Bottom 8-Chapter Timeline Progress Bar
    bar_y0, bar_y1 = 1056, 1070
    bar_x0, bar_x1 = 236, 1730
    draw.rounded_rectangle([bar_x0, bar_y0, bar_x1, bar_y1], radius=6, fill=(15, 23, 42), outline=(71, 85, 105), width=2)
    fill_w = int((bar_x1 - bar_x0) * (t / DURATION))
    if fill_w > 8:
        draw.rounded_rectangle([bar_x0, bar_y0, bar_x0 + fill_w, bar_y1], radius=6, fill=(250, 204, 21))

    el = int(t)
    draw.rounded_rectangle([1742, 1046, 1872, 1076], radius=10, fill=(24, 28, 44), outline=(255, 212, 52), width=2)
    draw.text((1807, 1061), f"0:{el:02d} / 1:00", font=fonts["timer"], fill=(255, 240, 138), anchor="mm")

def get_camera_frame(upscaled_img, local_p, direction=1):
    uw, uh = upscaled_img.size
    p_smooth = ease_in_out_cubic(max(0.0, min(1.0, local_p)))
    if direction > 0:
        crop_scale = 1.0 - 0.08 * p_smooth
        pan_x = p_smooth
        pan_y = 0.4 + 0.2 * p_smooth
    else:
        crop_scale = 0.92 + 0.08 * p_smooth
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
    mask = Image.new("L", (W, H), 0)
    mdraw = ImageDraw.Draw(mask)
    cx, cy = 960, 500
    r = int(iris_radius)
    if r > 0:
        mdraw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
    bg = Image.new("RGB", (W, H), (24, 22, 30))
    out = Image.composite(frame_img, bg, mask)
    odraw = ImageDraw.Draw(out)
    if 5 < r < 1150:
        odraw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(255, 212, 52), width=10)
    return out

def main():
    t0 = time.time()
    with open("assets/audio/timeline.json", encoding="utf-8") as f:
        timeline = json.load(f)

    scenes = timeline["scenes"]
    mouth_env = timeline["mouth_env"]
    fonts = load_fonts()

    print("Preloading and upscaling 16 XiaoLinShuo storyboard shots...")
    shots_cache = {}
    for i in range(1, 17):
        sid = f"shot_{i:02d}"
        im = Image.open(f"assets/images/{sid}.png").convert("RGB")
        shots_cache[sid] = im.resize((2208, 1242), Image.Resampling.LANCZOS)

    out_mp4 = "national_debt_explainer.mp4"
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
        40: "assets/frames/verify_01_debt_clock.jpg",
        260: "assets/frames/verify_02_iou_bond.jpg",
        500: "assets/frames/verify_03_anatomy.jpg",
        780: "assets/frames/verify_04_seesaw.jpg",
        980: "assets/frames/verify_05_rollover.jpg",
        1250: "assets/frames/verify_06_inflation.jpg",
        1730: "assets/frames/verify_08_finale.jpg",
    }

    print(f"Rendering {TOTAL_FRAMES} frames at {W}x{H} ({FPS}fps)...")
    for f_idx in range(TOTAL_FRAMES):
        t = f_idx / FPS

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

        if s_num > 1 and (t - w0) < 0.18:
            iris_p = (t - w0) / 0.18
            frame = apply_iris_transition(frame, 200 + iris_p * 1000)
        elif s_num < 8 and (w1 - t) < 0.16:
            iris_p = (w1 - t) / 0.16
            frame = apply_iris_transition(frame, 200 + iris_p * 1000)

        draw = ImageDraw.Draw(frame)

        draw_scene_overlays(draw, s_num, t, scene_p, fonts)
        draw_hud(draw, active_scene, t, fonts)
        draw_word_synced_captions(draw, active_scene, t, fonts)

        mouth_open = mouth_env[f_idx] if f_idx < len(mouth_env) else 0.0
        draw_xiaolin_avatar(draw, t, mouth_open, fonts)

        if f_idx in sample_frames_to_save:
            frame.save(sample_frames_to_save[f_idx], quality=92)

        proc.stdin.write(frame.tobytes())

        if (f_idx + 1) % 300 == 0:
            elapsed = time.time() - t0
            print(f"  Rendered {f_idx + 1}/{TOTAL_FRAMES} frames ({elapsed:.1f}s)...")

    proc.stdin.close()
    proc.wait()

    subprocess.run(["cp", out_mp4, "explainer.mp4"], check=True)
    print(f"Done in {time.time() - t0:.1f}s! Output: {out_mp4} and explainer.mp4")

if __name__ == "__main__":
    main()
