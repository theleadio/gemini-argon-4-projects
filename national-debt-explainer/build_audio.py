import json
import math
import subprocess
import numpy as np
from scipy.io import wavfile

SR = 44100
DURATION = 60.0
TOTAL_SAMPLES = int(SR * DURATION)

SCENES = [
    {
        "id": "scene1",
        "num": 1,
        "title": "國家為什麼會欠一屁股債？",
        "en_title": "WHY COUNTRIES BORROW",
        "window": [0.00, 6.30],
        "speech_start": 0.22,
        "shots": ["shot_01", "shot_02"],
        "text": "哈囉大家好！美國國債衝破三十六兆美元，等一下——國家這麼有錢，為什麼還會欠一屁股債？",
        "tokens": ["哈囉大家好！", "美國國債", "衝破三十六兆美元，", "等一下——", "國家這麼有錢，", "為什麼還會", "欠一屁股債？"],
        "badge": "財政赤字：稅收 $4.9T  <  支出 $6.7T"
    },
    {
        "id": "scene2",
        "num": 2,
        "title": "國債本質＝國家級官方欠條",
        "en_title": "BOND = SOVEREIGN I.O.U.",
        "window": [6.30, 14.30],
        "speech_start": 6.50,
        "shots": ["shot_03", "shot_04"],
        "text": "其實超簡單！當政府花錢比稅收還多，就會出現財政赤字。這時政府打一張官方欠條借錢，就叫國債！",
        "tokens": ["其實超簡單！", "當政府花錢", "比稅收還多，", "就會出現財政赤字。", "這時政府打一張", "官方欠條借錢，", "就叫國債！"],
        "badge": "國債 (Treasury Bond) ＝ 國家官方欠條 (I.O.U.)"
    },
    {
        "id": "scene3",
        "num": 3,
        "title": "拆解欠條：本金、利息、到期日",
        "en_title": "ANATOMY OF A BOND",
        "window": [14.30, 21.95],
        "speech_start": 14.50,
        "shots": ["shot_05", "shot_06"],
        "text": "欠條寫得很清楚：借政府一千塊，每年付四十塊利息，到期還本金。有國家信用擔保，全球都在搶！",
        "tokens": ["欠條寫得很清楚：", "借政府一千塊，", "每年付四十塊利息，", "到期還本金。", "有國家信用擔保，", "全球都在搶！"],
        "badge": "本金 $1,000 ＋ 票息 4%/年 ＋ 10年到期還本"
    },
    {
        "id": "scene4",
        "num": 4,
        "title": "誰在買國債？價格與殖利率蹺蹺板",
        "en_title": "PRICE vs. YIELD SEESAW",
        "window": [21.95, 28.90],
        "speech_start": 22.15,
        "shots": ["shot_07", "shot_08"],
        "text": "退休基金、銀行和各國央行都是大買家！國債還能二手買賣：搶著買、價格漲，殖利率就會跌！",
        "tokens": ["退休基金、銀行", "和各國央行", "都是大買家！", "國債還能二手買賣：", "搶著買、價格漲，", "殖利率就會跌！"],
        "badge": "債市鐵律：債券價格 ↑  ↔  殖利率 (Yield) ↓"
    },
    {
        "id": "scene5",
        "num": 5,
        "title": "欠幾十兆怎麼還？借新還舊！",
        "en_title": "THE ROLLOVER SECRET",
        "window": [28.90, 37.55],
        "speech_start": 29.10,
        "shots": ["shot_09", "shot_10"],
        "text": "那欠幾十兆怎麼還？答案很扎心：不用還清！舊債到期就發新債，拿新債主的錢還舊債，這就叫借新還舊！",
        "tokens": ["那欠幾十兆怎麼還？", "答案很扎心：", "不用還清！", "舊債到期就發新債，", "拿新債主的錢還舊債，", "這就叫借新還舊！"],
        "badge": "借新還舊 (Rollover)：發新債 → 還舊債"
    },
    {
        "id": "scene6",
        "num": 6,
        "title": "央行印鈔買債？小心通膨怪獸！",
        "en_title": "QE & INFLATION MONSTER",
        "window": [37.55, 45.45],
        "speech_start": 37.75,
        "shots": ["shot_11", "shot_12"],
        "text": "萬一沒人買新債呢？央行雖然能印鈔買債，但錢印太多物價會飛天，引發通膨，等於全民幫國債買單！",
        "tokens": ["萬一沒人買新債呢？", "央行雖然能印鈔買債，", "但錢印太多", "物價會飛天，", "引發通膨，", "等於全民幫國債買單！"],
        "badge": "印鈔買債 (QE) 過頭 → 物價飛天 (全民買單)"
    },
    {
        "id": "scene7",
        "num": 7,
        "title": "推進器還是債務陷阱？看 GDP 增速",
        "en_title": "GDP GROWTH vs. DEBT TRAP",
        "window": [45.45, 53.20],
        "speech_start": 45.65,
        "shots": ["shot_13", "shot_14"],
        "text": "所以國債好不好？只要借錢搞基建與科研，讓經濟成長跑贏利息，就是推進器；反之就會掉進債務陷阱！",
        "tokens": ["所以國債好不好？", "只要借錢搞基建與科研，", "讓經濟成長跑贏利息，", "就是推進器；", "反之就會掉進", "債務陷阱！"],
        "badge": "良性循環：GDP 經濟增速 (g) ＞ 債務利率 (r)"
    },
    {
        "id": "scene8",
        "num": 8,
        "title": "小林總結：向未來借錢的時光機",
        "en_title": "TIME MACHINE OF TRUST",
        "window": [53.20, 60.00],
        "speech_start": 53.40,
        "shots": ["shot_15", "shot_16"],
        "text": "總結來說，國債就是向未來借錢的時光機，唯一的燃料就是信任！我是小林，我們下期見，拜拜！",
        "tokens": ["總結來說，", "國債就是向未來借錢的", "時光機，", "唯一的燃料就是信任！", "我是小林，", "我們下期見，拜拜！"],
        "badge": "國債 ＝ 跨時空借錢時光機 × 國家信用"
    }
]

def load_wav_mono_or_stereo(path):
    sr, data = wavfile.read(path)
    if data.dtype == np.int16:
        data = data.astype(np.float32) / 32768.0
    elif data.dtype == np.int32:
        data = data.astype(np.float32) / 2147483648.0
    if data.ndim == 1:
        data = np.column_stack([data, data])
    return sr, data

def synth_note(freq, dur, sr=SR, kind="marimba"):
    t = np.linspace(0, dur, int(sr * dur), endpoint=False)
    if kind == "marimba":
        env = np.exp(-t * 9.5) * (1.0 - np.exp(-t * 140.0))
        sig = 0.78 * np.sin(2 * np.pi * freq * t) + 0.22 * np.sin(2 * np.pi * freq * 4.0 * t) * np.exp(-t * 20.0)
    elif kind == "bass":
        env = np.exp(-t * 5.0) * (1.0 - np.exp(-t * 90.0))
        sig = 0.82 * np.sin(2 * np.pi * freq * t) + 0.18 * np.sin(2 * np.pi * freq * 2.0 * t)
    elif kind == "chime":
        env = np.exp(-t * 4.2) * (1.0 - np.exp(-t * 210.0))
        sig = 0.65 * np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(2 * np.pi * freq * 2.0 * t) + 0.10 * np.sin(2 * np.pi * freq * 3.0 * t)
    return sig * env

def add_sound(buf, sound, start_sec, gain=1.0, pan=0.0):
    idx = int(start_sec * SR)
    if idx < 0 or idx >= len(buf):
        return
    n = min(len(sound), len(buf) - idx)
    if sound.ndim == 1:
        l_gain = gain * math.cos((pan + 1) * math.pi / 4)
        r_gain = gain * math.sin((pan + 1) * math.pi / 4)
        buf[idx:idx+n, 0] += sound[:n] * l_gain
        buf[idx:idx+n, 1] += sound[:n] * r_gain
    else:
        buf[idx:idx+n] += sound[:n] * gain

def build_background_music():
    music = np.zeros((TOTAL_SAMPLES, 2), dtype=np.float32)
    bpm = 120.0
    beat = 60.0 / bpm
    eighth = beat / 2.0

    # Upbeat, smart XiaoLinShuo-style F-major / C-major / Dm / Bb progression
    chords = [
        ([349.23, 440.00, 523.25, 698.46], 174.61), # F
        ([261.63, 329.63, 392.00, 523.25], 130.81), # C
        ([293.66, 349.23, 440.00, 587.33], 146.83), # Dm
        ([233.08, 293.66, 349.23, 466.16], 116.54), # Bb
    ]

    t = 0.0
    step = 0
    while t < DURATION - 0.2:
        chord_notes, bass_freq = chords[(step // 8) % len(chords)]
        if step % 2 == 0:
            bf = bass_freq if (step % 4 == 0) else bass_freq * 1.5
            b_note = synth_note(bf, beat * 0.9, kind="bass")
            add_sound(music, b_note, t, gain=0.15, pan=0.0)
        arp_pattern = [0, 1, 2, 3, 2, 1, 3, 2]
        note_freq = chord_notes[arp_pattern[step % 8]]
        m_note = synth_note(note_freq, eighth * 0.92, kind="marimba")
        pan = -0.22 if (step % 2 == 0) else 0.22
        add_sound(music, m_note, t, gain=0.10, pan=pan)

        if step % 2 == 1:
            sh_len = int(SR * 0.04)
            rng = np.random.default_rng(step + 101)
            noise = rng.normal(0, 1, sh_len) * np.hanning(sh_len)
            add_sound(music, noise, t, gain=0.015, pan=0.12)

        t += eighth
        step += 1

    return music

def build_sfx():
    sfx = np.zeros((TOTAL_SAMPLES, 2), dtype=np.float32)

    # 1. Opening XiaoLin whiteboard chime (0.04s)
    for i, f in enumerate([523.25, 659.25, 783.99, 1046.50]):
        add_sound(sfx, synth_note(f, 0.30, kind="chime"), 0.04 + i * 0.04, gain=0.11, pan=(i - 1.5) * 0.2)

    # 2. Crisp whiteboard pop at every scene & half-scene cut
    boundaries = []
    for s in SCENES:
        w0, w1 = s["window"]
        mid = (w0 + w1) / 2.0
        if w0 > 0:
            boundaries.append(w0)
        boundaries.append(mid)

    for idx, b in enumerate(boundaries):
        dur = 0.10
        t = np.linspace(0, dur, int(SR * dur), endpoint=False)
        f_sweep = np.linspace(260, 720 if idx % 2 == 0 else 580, len(t))
        pop = np.sin(2 * np.pi * np.cumsum(f_sweep) / SR) * np.hanning(len(t))
        add_sound(sfx, pop, b - 0.03, gain=0.09, pan=0.0)

    # 3. Cash/Bond coupon cha-ching chimes at key moments
    for t_coin in [10.2, 18.0, 33.2, 56.5]:
        add_sound(sfx, synth_note(1567.98, 0.22, kind="chime"), t_coin, gain=0.13, pan=0.2)
        add_sound(sfx, synth_note(2093.00, 0.40, kind="chime"), t_coin + 0.065, gain=0.15, pan=0.25)

    # 4. Finale celebratory major chord at 59.45s
    for f in [523.25, 659.25, 783.99, 1046.50]:
        add_sound(sfx, synth_note(f, 0.50, kind="chime"), 59.45, gain=0.12, pan=0.0)

    return sfx

def main():
    vo_track = np.zeros((TOTAL_SAMPLES, 2), dtype=np.float32)

    timeline_scenes = []
    srt_lines = []
    vtt_lines = ["WEBVTT\n"]

    for s in SCENES:
        sid = s["id"]
        wav_path = f"assets/audio/{sid}.wav"
        sr, data = load_wav_mono_or_stereo(wav_path)
        assert sr == SR, f"Expected {SR}, got {sr}"
        dur = len(data) / SR
        start_t = s["speech_start"]
        end_t = start_t + dur

        # Normalize clip peak to 0.90
        peak = np.max(np.abs(data))
        if peak > 0:
            data = data * (0.90 / peak)

        add_sound(vo_track, data, start_t, gain=1.0)

        # Build phrase-level timestamps proportional to character length + punctuation pause
        tokens = s["tokens"]
        weights = []
        for tk in tokens:
            clean_len = len([c for c in tk if c not in "，。！？：；——、"])
            punct_bonus = 1.6 if any(p in tk for p in "，。！？：；——") else 0.3
            weights.append(max(clean_len, 1) + punct_bonus)
        total_w = sum(weights)
        w_cursor = start_t
        word_timings = []
        for tk, wt in zip(tokens, weights):
            w_dur = dur * (wt / total_w)
            word_timings.append({
                "word": tk,
                "start": round(w_cursor, 3),
                "end": round(w_cursor + w_dur, 3)
            })
            w_cursor += w_dur

        w0, w1 = s["window"]
        mid = round((w0 + w1) / 2.0, 3)
        scene_info = {
            **s,
            "speech_end": round(end_t, 3),
            "speech_duration": round(dur, 3),
            "shot_windows": [
                {"shot": s["shots"][0], "start": w0, "end": mid},
                {"shot": s["shots"][1], "start": mid, "end": w1},
            ],
            "words": word_timings
        }
        timeline_scenes.append(scene_info)

        def fmt_srt(sec):
            h = int(sec // 3600)
            m = int((sec % 3600) // 60)
            s_i = int(sec % 60)
            ms = int(round((sec - int(sec)) * 1000))
            return f"{h:02d}:{m:02d}:{s_i:02d},{ms:03d}"

        def fmt_vtt(sec):
            return fmt_srt(sec).replace(",", ".")

        srt_lines.append(f"{s['num']}\n{fmt_srt(start_t)} --> {fmt_srt(end_t)}\n{s['text']}\n")
        vtt_lines.append(f"{fmt_vtt(start_t)} --> {fmt_vtt(end_t)}\n{s['text']}\n")

    # Compute 30fps lip-sync amplitude envelope (1800 frames)
    fps = 30
    total_frames = int(DURATION * fps)
    samples_per_frame = SR // fps
    mouth_env = []
    for f_idx in range(total_frames):
        chunk = vo_track[f_idx * samples_per_frame : (f_idx + 1) * samples_per_frame, 0]
        rms = float(np.sqrt(np.mean(chunk ** 2))) if len(chunk) > 0 else 0.0
        openness = min(1.0, max(0.0, (rms - 0.015) / 0.22))
        mouth_env.append(round(openness, 3))

    music = build_background_music()
    sfx = build_sfx()

    # Smooth ducking envelope when voiceover is active
    duck_env = np.ones(TOTAL_SAMPLES, dtype=np.float32) * 0.82
    for s in timeline_scenes:
        idx0 = max(0, int((s["speech_start"] - 0.10) * SR))
        idx1 = min(TOTAL_SAMPLES, int((s["speech_end"] + 0.12) * SR))
        duck_env[idx0:idx1] = 0.24

    kernel_size = int(0.08 * SR)
    kernel = np.ones(kernel_size, dtype=np.float32) / kernel_size
    duck_env = np.convolve(duck_env, kernel, mode="same")

    fade_len = int(0.55 * SR)
    duck_env[-fade_len:] *= np.linspace(1.0, 0.0, fade_len)

    master = vo_track + music * duck_env[:, None] + sfx * 0.62
    peak = np.max(np.abs(master))
    if peak > 0.98:
        master = master * (0.98 / peak)

    wavfile.write("assets/audio/voiceover_track.wav", SR, (vo_track * 32767).astype(np.int16))
    wavfile.write("assets/audio/master_audio.wav", SR, (master * 32767).astype(np.int16))

    subprocess.run([
        "ffmpeg", "-y", "-i", "assets/audio/master_audio.wav",
        "-c:a", "libmp3lame", "-b:a", "192k", "assets/audio/master_audio.mp3"
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    with open("national_debt.srt", "w", encoding="utf-8") as f:
        f.write("\n".join(srt_lines))
    with open("national_debt.vtt", "w", encoding="utf-8") as f:
        f.write("\n".join(vtt_lines))

    with open("assets/audio/timeline.json", "w", encoding="utf-8") as f:
        json.dump({
            "duration": DURATION,
            "fps": fps,
            "total_frames": total_frames,
            "voice_model": "elevenlabs/eleven-v4",
            "voice_name": "lily",
            "style": "XiaoLinShuo (小林說)",
            "scenes": timeline_scenes,
            "mouth_env": mouth_env
        }, f, ensure_ascii=False, indent=2)

    print("Master audio, subtitles, and timeline.json generated successfully!")

if __name__ == "__main__":
    main()
