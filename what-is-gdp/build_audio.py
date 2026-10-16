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
        "title": "THE $110 TRILLION NUMBER",
        "window": [0.00, 7.80],
        "speech_start": 0.15,
        "shots": ["shot_01", "shot_02"],
        "text": "Politicians love pointing to one giant number: GDP—now over a hundred trillion dollars globally! Wait, what does it actually measure?",
        "badge": "🌍 GLOBAL GDP  >  $110 TRILLION",
        "formula_highlight": "GDP"
    },
    {
        "id": "scene2",
        "num": 2,
        "title": "GROSS DOMESTIC PRODUCT",
        "window": [7.80, 15.05],
        "speech_start": 7.95,
        "shots": ["shot_03", "shot_04"],
        "text": "GDP means Gross Domestic Product: the total price tag of every brand-new good or service sold, from lattes to rocket launches!",
        "badge": "☕ LATTES  +  💇 HAIRCUTS  +  🚀 ROCKETS",
        "formula_highlight": "TOTAL OUTPUT"
    },
    {
        "id": "scene3",
        "num": 3,
        "title": "FINAL GOODS & BORDERS",
        "window": [15.05, 22.05],
        "speech_start": 15.20,
        "shots": ["shot_05", "shot_06"],
        "text": "Here is the catch: we only count the final receipt—never raw ingredients twice—and only things made inside a country's borders.",
        "badge": "🧾 FINAL RECEIPT ONLY  •  🗺️ INSIDE BORDERS",
        "formula_highlight": "NO DOUBLE COUNTING"
    },
    {
        "id": "scene4",
        "num": 4,
        "title": "THE SECRET FORMULA (C)",
        "window": [22.05, 30.35],
        "speech_start": 22.20,
        "shots": ["shot_07", "shot_08"],
        "text": "The secret formula is C + I + G + Net Exports! C is consumer spending—nearly 70% of America's economy.",
        "badge": "📐 GDP = C + I + G + NX   (C ≈ 70%)",
        "formula_highlight": "C"
    },
    {
        "id": "scene5",
        "num": 5,
        "title": "INVESTMENT, GOVT & TRADE",
        "window": [30.35, 38.10],
        "speech_start": 30.50,
        "shots": ["shot_09", "shot_10"],
        "text": "I is business investment in robots and factories. G is government building bridges and schools, plus exports minus imports!",
        "badge": "🤖 I (BIZ)  +  🌉 G (GOVT)  +  🚢 (EX - IM)",
        "formula_highlight": "I + G + NX"
    },
    {
        "id": "scene6",
        "num": 6,
        "title": "NOMINAL VS. REAL GDP",
        "window": [38.10, 44.95],
        "speech_start": 38.25,
        "shots": ["shot_11", "shot_12"],
        "text": "Wait—what if prices just inflated? That is why economists use Real GDP, stripping out inflation to reveal true growth.",
        "badge": "🎈 POP INFLATION  ➔  📈 REAL GDP GROWTH",
        "formula_highlight": "REAL GDP"
    },
    {
        "id": "scene7",
        "num": 7,
        "title": "KUZNETS' 1934 WARNING",
        "window": [44.95, 52.70],
        "speech_start": 45.10,
        "shots": ["shot_13", "shot_14"],
        "text": "Plot twist! Simon Kuznets invented GDP in 1934, warning Congress it is not well-being. It ignores clean air and parenting!",
        "badge": "⚠️ 1934 WARNING: OUTPUT ≠ WELL-BEING",
        "formula_highlight": "BLIND SPOTS"
    },
    {
        "id": "scene8",
        "num": 8,
        "title": "SPEEDOMETER VS. COMPASS",
        "window": [52.70, 60.00],
        "speech_start": 52.85,
        "shots": ["shot_15", "shot_16"],
        "text": "GDP is an economic speedometer: it shows how fast our engine spins, just not if we are driving somewhere worth going—and that is huge!",
        "badge": "⏱️ SPEEDOMETER (HOW FAST) ≠ 🧭 COMPASS (WHERE TO)",
        "formula_highlight": "HUGE IF TRUE"
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


def synth_note(freq, dur, sr=SR, kind="pluck"):
    t = np.linspace(0, dur, int(sr * dur), endpoint=False)
    if kind == "pluck":
        # Crisp futuristic synth pluck (Huge If True / Vox style)
        env = np.exp(-t * 8.5) * (1.0 - np.exp(-t * 160.0))
        sig = (
            0.70 * np.sin(2 * np.pi * freq * t)
            + 0.22 * np.sin(2 * np.pi * freq * 2.0 * t) * np.exp(-t * 10.0)
            + 0.08 * np.sin(2 * np.pi * freq * 3.0 * t) * np.exp(-t * 16.0)
        )
    elif kind == "sub_bass":
        env = np.exp(-t * 4.5) * (1.0 - np.exp(-t * 90.0))
        sig = 0.82 * np.sin(2 * np.pi * freq * t) + 0.18 * np.tanh(2.5 * np.sin(2 * np.pi * freq * t))
    elif kind == "chime":
        env = np.exp(-t * 4.2) * (1.0 - np.exp(-t * 220.0))
        sig = (
            0.60 * np.sin(2 * np.pi * freq * t)
            + 0.28 * np.sin(2 * np.pi * freq * 2.0 * t)
            + 0.12 * np.sin(2 * np.pi * freq * 4.0 * t)
        )
    elif kind == "pad":
        env = np.sin(np.pi * t / dur) ** 0.7
        sig = 0.5 * np.sin(2 * np.pi * freq * t) + 0.5 * np.sin(2 * np.pi * (freq * 1.003) * t)
    return sig * env


def add_sound(buf, sound, start_sec, gain=1.0, pan=0.0):
    idx = int(start_sec * SR)
    if idx < 0 or idx >= len(buf):
        return
    n = min(len(sound), len(buf) - idx)
    if sound.ndim == 1:
        l_gain = gain * math.cos((pan + 1) * math.pi / 4)
        r_gain = gain * math.sin((pan + 1) * math.pi / 4)
        buf[idx:idx + n, 0] += sound[:n] * l_gain
        buf[idx:idx + n, 1] += sound[:n] * r_gain
    else:
        buf[idx:idx + n] += sound[:n] * gain


def build_background_music():
    """Optimistic, curious tech-journalism synth bed (120 BPM, Fmaj7 - G6 - Am7 - Cmaj7)."""
    music = np.zeros((TOTAL_SAMPLES, 2), dtype=np.float32)
    bpm = 120.0
    beat = 60.0 / bpm       # 0.5s
    sixteenth = beat / 4.0  # 0.125s
    eighth = beat / 2.0     # 0.25s

    chords = [
        ([349.23, 440.00, 523.25, 659.25], 87.31),   # Fmaj7
        ([392.00, 493.88, 587.33, 659.25], 98.00),   # G6
        ([440.00, 523.25, 659.25, 783.99], 110.00),  # Am7
        ([261.63, 329.63, 392.00, 493.88], 130.81),  # Cmaj7
    ]

    t = 0.0
    step = 0
    while t < DURATION - 0.15:
        chord_idx = (step // 8) % len(chords)
        chord_notes, bass_freq = chords[chord_idx]

        # Warm ambient pad at the start of every 8-eighth-note bar (2.0s)
        if step % 8 == 0:
            for i, nf in enumerate(chord_notes[:3]):
                pad_sig = synth_note(nf * 0.5, eighth * 8.0, kind="pad")
                add_sound(music, pad_sig, t, gain=0.045, pan=(i - 1) * 0.3)

        # Driving pulse bass on beats 0, 2, 4, 6
        if step % 2 == 0:
            bf = bass_freq if (step % 4 == 0) else bass_freq * 2.0
            b_note = synth_note(bf, beat * 0.88, kind="sub_bass")
            add_sound(music, b_note, t, gain=0.15, pan=0.0)

        # Curious arpeggiated synth pluck on eighth notes
        arp_pattern = [0, 1, 2, 3, 2, 1, 3, 2]
        note_freq = chord_notes[arp_pattern[step % 8]]
        p_note = synth_note(note_freq, eighth * 0.9, kind="pluck")
        pan = -0.3 if (step % 2 == 0) else 0.3
        add_sound(music, p_note, t, gain=0.10, pan=pan)

        # Subtle hi-hat / shaker tick on off-beats
        if step % 2 == 1:
            sh_len = int(SR * 0.035)
            rng = np.random.default_rng(step + 101)
            noise = rng.normal(0, 1, sh_len) * np.hanning(sh_len)
            add_sound(music, noise, t, gain=0.015, pan=0.18)

        t += eighth
        step += 1

    return music


def build_sfx():
    sfx = np.zeros((TOTAL_SAMPLES, 2), dtype=np.float32)

    # 1. Opening "HUGE IF TRUE" neon power-up chime (0.05s)
    for i, f in enumerate([523.25, 659.25, 783.99, 1046.50, 1318.51]):
        add_sound(sfx, synth_note(f, 0.38, kind="chime"), 0.04 + i * 0.04, gain=0.12, pan=(i - 2) * 0.2)

    # 2. Shot & Scene transition holographic whoosh/pops at every shot cut & scene boundary
    boundaries = []
    for s in SCENES:
        w0, w1 = s["window"]
        mid = round((w0 + w1) / 2.0, 3)
        boundaries.append(mid)
        if w1 < DURATION - 0.1:
            boundaries.append(w1)

    for idx, b in enumerate(boundaries):
        dur = 0.11
        t = np.linspace(0, dur, int(SR * dur), endpoint=False)
        f0, f1 = (240, 720) if idx % 2 == 0 else (300, 580)
        f_sweep = np.linspace(f0, f1, len(t))
        pop = np.sin(2 * np.pi * np.cumsum(f_sweep) / SR) * np.hanning(len(t))
        add_sound(sfx, pop, b - 0.04, gain=0.085, pan=0.0)

    # 3. Price-tag / Formula highlight pings (Scene 2 price tags, Scene 4 C+I+G+NX, Scene 6 inflation pop)
    for t_ping in [11.4, 23.4, 24.1, 24.8, 25.5, 41.5]:
        add_sound(sfx, synth_note(1318.51, 0.22, kind="chime"), t_ping, gain=0.12, pan=0.2)
        add_sound(sfx, synth_note(1760.00, 0.32, kind="chime"), t_ping + 0.06, gain=0.13, pan=0.25)

    # 4. Finale "AND THAT IS HUGE!" celebratory chord at 59.2s
    for f in [523.25, 659.25, 783.99, 1046.50, 1318.51]:
        add_sound(sfx, synth_note(f, 0.65, kind="chime"), 59.20, gain=0.13, pan=0.0)

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

        # Normalize clip peak to 0.88
        peak = np.max(np.abs(data))
        if peak > 0:
            data = data * (0.88 / peak)

        add_sound(vo_track, data, start_t, gain=1.0)

        # Build word-level timestamps proportional to character length & punctuation pauses
        clean_text_for_words = s["text"].replace("—", " — ")
        words = clean_text_for_words.split()
        weights = [
            max(len(w.strip(".,!?—-:")), 2) + (2.4 if any(p in w for p in ".,!?—:") else 0)
            for w in words
        ]
        total_w = sum(weights)
        w_cursor = start_t
        word_timings = []
        for w, wt in zip(words, weights):
            w_dur = dur * (wt / total_w)
            word_timings.append({
                "word": w,
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
            if ms == 1000:
                s_i += 1
                ms = 0
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
        chunk = vo_track[f_idx * samples_per_frame:(f_idx + 1) * samples_per_frame, 0]
        rms = float(np.sqrt(np.mean(chunk ** 2))) if len(chunk) > 0 else 0.0
        openness = min(1.0, max(0.0, (rms - 0.015) / 0.22))
        mouth_env.append(round(openness, 3))

    # Build background music & duck when voiceover is active
    music = build_background_music()
    sfx = build_sfx()

    duck_env = np.ones(TOTAL_SAMPLES, dtype=np.float32) * 0.85
    for s in timeline_scenes:
        idx0 = max(0, int((s["speech_start"] - 0.12) * SR))
        idx1 = min(TOTAL_SAMPLES, int((s["speech_end"] + 0.15) * SR))
        duck_env[idx0:idx1] = 0.26

    kernel_size = int(0.08 * SR)
    kernel = np.ones(kernel_size, dtype=np.float32) / kernel_size
    duck_env = np.convolve(duck_env, kernel, mode="same")

    fade_len = int(0.6 * SR)
    duck_env[-fade_len:] *= np.linspace(1.0, 0.0, fade_len)

    master = vo_track + music * duck_env[:, None] + sfx * 0.65
    peak = np.max(np.abs(master))
    if peak > 0.98:
        master = master * (0.98 / peak)

    wavfile.write("assets/audio/voiceover_track.wav", SR, (vo_track * 32767).astype(np.int16))
    wavfile.write("assets/audio/master_audio.wav", SR, (master * 32767).astype(np.int16))

    subprocess.run([
        "ffmpeg", "-y", "-i", "assets/audio/master_audio.wav",
        "-c:a", "libmp3lame", "-b:a", "192k", "assets/audio/master_audio.mp3"
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    with open("what_is_gdp.srt", "w") as f:
        f.write("\n".join(srt_lines))
    with open("what_is_gdp.vtt", "w") as f:
        f.write("\n".join(vtt_lines))

    with open("assets/audio/timeline.json", "w") as f:
        json.dump({
            "duration": DURATION,
            "fps": fps,
            "total_frames": total_frames,
            "voice_model": "elevenlabs/eleven-v4",
            "voice_style": "Cleo Abram (Huge If True) — Optimistic Tech & Economics Host",
            "scenes": timeline_scenes,
            "mouth_env": mouth_env
        }, f, indent=2)

    print("Master audio, subtitles, and timeline.json generated successfully!")


if __name__ == "__main__":
    main()
