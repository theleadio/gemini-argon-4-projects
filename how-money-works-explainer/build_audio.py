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
        "title": "THE BARTER PROBLEM",
        "window": [0.00, 7.70],
        "speech_start": 0.28,
        "shots": ["shot_01", "shot_02"],
        "text": "Why can paper bills or digits on a phone buy your coffee? Before money, people bartered—trading fish directly for bread!",
        "badge": "🐟 FISH  ⇄  🍞 BREAD"
    },
    {
        "id": "scene2",
        "num": 2,
        "title": "COMMODITY MONEY",
        "window": [7.70, 15.95],
        "speech_start": 7.92,
        "shots": ["shot_03", "shot_04"],
        "text": "What if the baker hated fish? Humans solved this with commodity money: shells, salt, and shiny gold coins everyone valued.",
        "badge": "🐚 SHELLS  ➔  🧂 SALT  ➔  🪙 GOLD"
    },
    {
        "id": "scene3",
        "num": 3,
        "title": "THE FIRST BANKNOTES",
        "window": [15.95, 23.80],
        "speech_start": 16.15,
        "shots": ["shot_05", "shot_06"],
        "text": "Hauling heavy gold was exhausting! So goldsmiths locked it in vaults and issued paper receipts—the very first banknotes.",
        "badge": "🏦 VAULT GOLD  ➔  📜 PAPER I.O.U."
    },
    {
        "id": "scene4",
        "num": 4,
        "title": "FIAT MONEY & TRUST",
        "window": [23.80, 30.20],
        "speech_start": 24.00,
        "shots": ["shot_07", "shot_08"],
        "text": "Today we use fiat money, which isn't backed by gold at all. It works because of shared trust and law.",
        "badge": "💵 FIAT MONEY = 🤝 SHARED TRUST"
    },
    {
        "id": "scene5",
        "num": 5,
        "title": "DIGITAL MONEY & BANKS",
        "window": [30.20, 36.85],
        "speech_start": 30.40,
        "shots": ["shot_09", "shot_10"],
        "text": "In fact, over ninety percent of money is digital! Banks lend out your deposits to help build homes and businesses.",
        "badge": "📱 90%+ DIGITAL  •  🏗️ BANK LENDING"
    },
    {
        "id": "scene6",
        "num": 6,
        "title": "HOW INFLATION HAPPENS",
        "window": [36.85, 44.70],
        "speech_start": 37.05,
        "shots": ["shot_11", "shot_12"],
        "text": "But when too much money chases too few goods, prices balloon! That is inflation—making every dollar buy less.",
        "badge": "📈 INFLATION: ☕ $1.50 ➔ $5.00 ➔ $10.00"
    },
    {
        "id": "scene7",
        "num": 7,
        "title": "CENTRAL BANK THERMOSTAT",
        "window": [44.70, 51.80],
        "speech_start": 44.90,
        "shots": ["shot_13", "shot_14"],
        "text": "Central banks act like an economic thermostat—raising interest rates to cool inflation, or cutting them to spark jobs.",
        "badge": "🎛️ INTEREST RATES: ❄️ COOL  ⇄  🔥 BOOST"
    },
    {
        "id": "scene8",
        "num": 8,
        "title": "A STORY OF SHARED TRUST",
        "window": [51.80, 60.00],
        "speech_start": 52.00,
        "shots": ["shot_15", "shot_16"],
        "text": "Money isn't just metal, paper, or pixels. It is humanity's greatest invention for cooperation—a shared story of trust!",
        "badge": "🌍 MONEY = HUMANITY'S LANGUAGE OF TRUST"
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
        env = np.exp(-t * 9.0) * (1.0 - np.exp(-t * 120.0))
        sig = 0.75 * np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(2 * np.pi * freq * 4.0 * t) * np.exp(-t * 18.0)
    elif kind == "bass":
        env = np.exp(-t * 5.5) * (1.0 - np.exp(-t * 80.0))
        sig = 0.8 * np.sin(2 * np.pi * freq * t) + 0.2 * np.sin(2 * np.pi * freq * 2.0 * t)
    elif kind == "chime":
        env = np.exp(-t * 4.0) * (1.0 - np.exp(-t * 200.0))
        sig = 0.6 * np.sin(2 * np.pi * freq * t) + 0.3 * np.sin(2 * np.pi * freq * 2.0 * t) + 0.1 * np.sin(2 * np.pi * freq * 3.0 * t)
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
    bpm = 116.0
    beat = 60.0 / bpm
    eighth = beat / 2.0

    # Cheerful C-major / G-major / Am / F cartoon progression
    chords = [
        ([261.63, 329.63, 392.00, 523.25], 130.81), # C
        ([196.00, 246.94, 293.66, 392.00], 98.00),  # G
        ([220.00, 261.63, 329.63, 440.00], 110.00), # Am
        ([174.61, 220.00, 261.63, 349.23], 87.31),  # F
    ]

    t = 0.0
    step = 0
    while t < DURATION - 0.2:
        chord_notes, bass_freq = chords[(step // 8) % len(chords)]
        # Bass on beats 0, 2, 4, 6
        if step % 2 == 0:
            bf = bass_freq if (step % 4 == 0) else bass_freq * 1.5
            b_note = synth_note(bf, beat * 0.9, kind="bass")
            add_sound(music, b_note, t, gain=0.16, pan=0.0)
        # Playful marimba arpeggio
        arp_pattern = [0, 1, 2, 3, 2, 1, 3, 2]
        note_freq = chord_notes[arp_pattern[step % 8]]
        m_note = synth_note(note_freq, eighth * 0.95, kind="marimba")
        pan = -0.25 if (step % 2 == 0) else 0.25
        add_sound(music, m_note, t, gain=0.11, pan=pan)

        # Gentle shaker on off-beats
        if step % 2 == 1:
            sh_len = int(SR * 0.045)
            rng = np.random.default_rng(step + 42)
            noise = rng.normal(0, 1, sh_len) * np.hanning(sh_len)
            add_sound(music, noise, t, gain=0.018, pan=0.15)

        t += eighth
        step += 1

    return music

def build_sfx():
    sfx = np.zeros((TOTAL_SAMPLES, 2), dtype=np.float32)

    # 1. Opening portal shimmer (0.05s)
    for i, f in enumerate([523.25, 659.25, 783.99, 1046.50, 1318.51]):
        add_sound(sfx, synth_note(f, 0.35, kind="chime"), 0.05 + i * 0.045, gain=0.12, pan=(i-2)*0.2)

    # 2. Scene transition pops & chimes at scene boundaries
    boundaries = [3.85, 7.70, 11.80, 15.95, 19.85, 23.80, 27.00, 30.20, 33.50, 36.85, 40.75, 44.70, 48.25, 51.80, 55.90]
    for idx, b in enumerate(boundaries):
        # Soft cartoon pop (frequency sweep up)
        dur = 0.12
        t = np.linspace(0, dur, int(SR * dur), endpoint=False)
        f_sweep = np.linspace(220, 680 if idx % 2 == 0 else 540, len(t))
        pop = np.sin(2 * np.pi * np.cumsum(f_sweep) / SR) * np.hanning(len(t))
        add_sound(sfx, pop, b - 0.04, gain=0.10, pan=0.0)

    # 3. Gold coin cha-ching at 12.0s and 20.0s
    for t_coin in [12.0, 20.0, 56.0]:
        add_sound(sfx, synth_note(1567.98, 0.25, kind="chime"), t_coin, gain=0.14, pan=0.2)
        add_sound(sfx, synth_note(2093.00, 0.45, kind="chime"), t_coin + 0.07, gain=0.16, pan=0.25)

    # 4. Finale celebratory major chord at 59.4s
    for f in [523.25, 659.25, 783.99, 1046.50]:
        add_sound(sfx, synth_note(f, 0.55, kind="chime"), 59.40, gain=0.12, pan=0.0)

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

        # Build word-level timestamps proportional to character length
        clean_text_for_words = s["text"].replace("—", " — ")
        words = clean_text_for_words.split()
        weights = [max(len(w.strip(".,!?—-")), 2) + (2.5 if any(p in w for p in ".,!?—") else 0) for w in words]
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

        # Format SRT / VTT
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
        # Map RMS to 0..1 mouth openness
        openness = min(1.0, max(0.0, (rms - 0.015) / 0.22))
        mouth_env.append(round(openness, 3))

    # Build background music & duck it when voiceover is active
    music = build_background_music()
    sfx = build_sfx()

    # Smooth ducking envelope at audio sample rate
    duck_env = np.ones(TOTAL_SAMPLES, dtype=np.float32) * 0.85
    for s in timeline_scenes:
        idx0 = max(0, int((s["speech_start"] - 0.12) * SR))
        idx1 = min(TOTAL_SAMPLES, int((s["speech_end"] + 0.15) * SR))
        duck_env[idx0:idx1] = 0.28

    # Smooth duck_env with 80ms moving average
    kernel_size = int(0.08 * SR)
    kernel = np.ones(kernel_size, dtype=np.float32) / kernel_size
    duck_env = np.convolve(duck_env, kernel, mode="same")

    # Fade out music over last 0.6s
    fade_len = int(0.6 * SR)
    duck_env[-fade_len:] *= np.linspace(1.0, 0.0, fade_len)

    master = vo_track + music * duck_env[:, None] + sfx * 0.65
    peak = np.max(np.abs(master))
    if peak > 0.98:
        master = master * (0.98 / peak)

    wavfile.write("assets/audio/voiceover_track.wav", SR, (vo_track * 32767).astype(np.int16))
    wavfile.write("assets/audio/master_audio.wav", SR, (master * 32767).astype(np.int16))

    # Also export master_audio.mp3 for web player
    subprocess.run([
        "ffmpeg", "-y", "-i", "assets/audio/master_audio.wav",
        "-c:a", "libmp3lame", "-b:a", "192k", "assets/audio/master_audio.mp3"
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    with open("how_money_works.srt", "w") as f:
        f.write("\n".join(srt_lines))
    with open("how_money_works.vtt", "w") as f:
        f.write("\n".join(vtt_lines))

    with open("assets/audio/timeline.json", "w") as f:
        json.dump({
            "duration": DURATION,
            "fps": fps,
            "total_frames": total_frames,
            "voice_model": "elevenlabs/eleven-v4",
            "voice_name": "charlie",
            "scenes": timeline_scenes,
            "mouth_env": mouth_env
        }, f, indent=2)

    print("Master audio and timeline.json generated successfully!")

if __name__ == "__main__":
    main()
