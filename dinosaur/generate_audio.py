import os
import subprocess
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, lfilter

os.makedirs("build_audio", exist_ok=True)

# 12 timed narration segments across the 60.0s video (2 per Act)
SEGMENTS = [
    # Act 1: 0.0s - 9.0s (Triassic Dawn)
    {
        "id": "s01",
        "act": 1,
        "start": 0.5,
        "max_dur": 4.0,
        "text": "两亿三千万年前，在荒凉的盘古大陆上，最早的恐龙悄然诞生，",
        "sub": "两亿三千万年前 · 盘古大陆上最早的恐龙悄然诞生",
        "en": "230 Million Years Ago · The First Dinosaurs Emerge on Pangaea",
    },
    {
        "id": "s02",
        "act": 1,
        "start": 4.7,
        "max_dur": 4.0,
        "text": "敏捷的始盗龙与腔骨龙，开启了跨越一亿六千万年的演化传奇。",
        "sub": "敏捷的始盗龙与腔骨龙，开启了一亿六千万年的演化传奇",
        "en": "Agile Eoraptor & Coelophysis Begin a 165-Million-Year Dynasty",
    },
    # Act 2: 9.0s - 20.0s (Jurassic Giants)
    {
        "id": "s03",
        "act": 2,
        "start": 9.4,
        "max_dur": 5.0,
        "text": "进入侏罗纪，大陆裂解，温暖湿润的气候孕育出茂密的针叶林与蕨类。",
        "sub": "进入侏罗纪 · 大陆裂解，温暖气候孕育出茂密的远古森林",
        "en": "The Jurassic Period · Lush Conifer & Fern Forests Flourish",
    },
    {
        "id": "s04",
        "act": 2,
        "start": 14.6,
        "max_dur": 5.0,
        "text": "巨型腕龙演化出修长的脖颈，剑龙则披上骨板，挥动带刺的尾锤。",
        "sub": "腕龙演化出高耸长颈采食树冠，剑龙披上坚固骨板与尾刺",
        "en": "Towering Brachiosaurus & Armored Stegosaurus Rule the Land",
    },
    # Act 3: 20.0s - 32.0s (Cretaceous Peak)
    {
        "id": "s05",
        "act": 3,
        "start": 20.4,
        "max_dur": 5.4,
        "text": "白垩纪迎来了恐龙王朝的巅峰，物种多样性达到空前高度。",
        "sub": "白垩纪巅峰 · 恐龙王朝迎来了空前的繁盛与多样化",
        "en": "The Cretaceous Peak · The Golden Age of Dinosaur Diversity",
    },
    {
        "id": "s06",
        "act": 3,
        "start": 26.0,
        "max_dur": 5.6,
        "text": "顶级掠食者霸王龙与身披颈盾的三角龙正面对决，翼龙在天际翱翔。",
        "sub": "顶级掠食者霸王龙与三角龙正面对决，翼龙在天际展翅翱翔",
        "en": "Apex Predator T-Rex Clashes with Triceratops Under Soaring Pterosaurs",
    },
    # Act 4: 32.0s - 42.0s (Asteroid Impact)
    {
        "id": "s07",
        "act": 4,
        "start": 32.4,
        "max_dur": 4.5,
        "text": "然而在六千六百万年前，一颗直径十公里的小行星撞击地球。",
        "sub": "六千六百万年前 · 直径10公里的小行星撞击尤卡坦半岛",
        "en": "66 Million Years Ago · A 10-km Asteroid Strikes Chicxulub",
    },
    {
        "id": "s08",
        "act": 4,
        "start": 37.1,
        "max_dur": 4.6,
        "text": "遮天蔽日的尘埃阻断阳光，漫长的寒冬终结了非鸟恐龙的时代。",
        "sub": "遮天蔽日的尘埃阻断阳光，冲击与寒冬终结了非鸟恐龙时代",
        "en": "Global Ash Clouds Block the Sun, Ending the Non-Avian Dinosaurs",
    },
    # Act 5: 42.0s - 51.0s (Fossils & Discovery)
    {
        "id": "s09",
        "act": 5,
        "start": 42.4,
        "max_dur": 4.1,
        "text": "岁月将它们的骨骼封存于地层深处，化作跨越时空的化石密码。",
        "sub": "漫长岁月将骨骼封存于岩层深处，化作跨越时空的化石密码",
        "en": "Deep Geological Strata Preserve Their Skeletons as Fossils",
    },
    {
        "id": "s10",
        "act": 5,
        "start": 46.7,
        "max_dur": 4.0,
        "text": "古生物学家发现了羽毛印痕，揭示出恐龙充满活力的真实面貌。",
        "sub": "古生物学家发现羽毛印痕，重现了温血、披羽的真实恐龙面貌",
        "en": "Feather Impressions Reveal Active, Warm-Blooded Prehistoric Life",
    },
    # Act 6: 51.0s - 60.0s (Living Descendants: Birds)
    {
        "id": "s11",
        "act": 6,
        "start": 51.3,
        "max_dur": 4.0,
        "text": "其实恐龙并未完全灭绝，小型兽脚类恐龙演化成了现代鸟类。",
        "sub": "恐龙并未完全灭绝 · 兽脚类恐龙的一支演化成为现代鸟类",
        "en": "Dinosaurs Never Truly Vanished · Theropods Evolved into Modern Birds",
    },
    {
        "id": "s12",
        "act": 6,
        "start": 55.4,
        "max_dur": 4.2,
        "text": "今天每一只飞向蓝天的飞鸟，都是恐龙家族生生不息的血脉延续。",
        "sub": "今天每一只掠过天空的飞鸟，都是恐龙家族延续至今的血脉",
        "en": "Every Bird in the Sky Today Carries the Living Legacy of Dinosaurs",
    },
]

SR = 44100
DURATION = 60.0
TOTAL_SAMPLES = int(SR * DURATION)


def generate_tts_segments():
    voice_track = np.zeros(TOTAL_SAMPLES, dtype=np.float32)
    envelope = np.zeros(TOTAL_SAMPLES, dtype=np.float32)

    timing_report = []
    for seg in SEGMENTS:
        aiff_path = f"build_audio/{seg['id']}.aiff"
        wav_path = f"build_audio/{seg['id']}.wav"
        # Start with rate 195
        rate = 195
        subprocess.run(
            ["say", "-v", "Tingting", "-r", str(rate), "-o", aiff_path, seg["text"]],
            check=True,
        )
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-v",
                "error",
                "-i",
                aiff_path,
                "-ar",
                str(SR),
                "-ac",
                "1",
                wav_path,
            ],
            check=True,
        )
        sr, data = wavfile.read(wav_path)
        data = data.astype(np.float32) / 32768.0
        # Trim leading/trailing silence
        non_silent = np.where(np.abs(data) > 0.008)[0]
        if len(non_silent) > 0:
            s_idx = max(0, non_silent[0] - int(0.05 * SR))
            e_idx = min(len(data), non_silent[-1] + int(0.08 * SR))
            data = data[s_idx:e_idx]

        dur = len(data) / SR
        # If slightly too long for its slot, speed up TTS slightly
        if dur > seg["max_dur"]:
            new_rate = int(rate * (dur / (seg["max_dur"] - 0.15))) + 5
            subprocess.run(
                [
                    "say",
                    "-v",
                    "Tingting",
                    "-r",
                    str(new_rate),
                    "-o",
                    aiff_path,
                    seg["text"],
                ],
                check=True,
            )
            subprocess.run(
                [
                    "ffmpeg",
                    "-y",
                    "-v",
                    "error",
                    "-i",
                    aiff_path,
                    "-ar",
                    str(SR),
                    "-ac",
                    "1",
                    wav_path,
                ],
                check=True,
            )
            sr, data = wavfile.read(wav_path)
            data = data.astype(np.float32) / 32768.0
            non_silent = np.where(np.abs(data) > 0.008)[0]
            if len(non_silent) > 0:
                s_idx = max(0, non_silent[0] - int(0.05 * SR))
                e_idx = min(len(data), non_silent[-1] + int(0.08 * SR))
                data = data[s_idx:e_idx]
            dur = len(data) / SR

        # Normalize peak of voice segment
        peak = np.max(np.abs(data))
        if peak > 0:
            data = data / peak * 0.82

        # Smooth fade in/out (20ms)
        fade_len = int(0.02 * SR)
        if len(data) > 2 * fade_len:
            data[:fade_len] *= np.linspace(0, 1, fade_len)
            data[-fade_len:] *= np.linspace(1, 0, fade_len)

        start_sample = int(seg["start"] * SR)
        end_sample = min(TOTAL_SAMPLES, start_sample + len(data))
        actual_len = end_sample - start_sample
        voice_track[start_sample:end_sample] += data[:actual_len]

        # Ducking envelope (slightly wider than speech)
        pad_s = max(0, start_sample - int(0.15 * SR))
        pad_e = min(TOTAL_SAMPLES, end_sample + int(0.25 * SR))
        envelope[pad_s:pad_e] = 1.0

        timing_report.append((seg["id"], seg["start"], round(seg["start"] + dur, 2), dur))
        print(
            f"Segment {seg['id']}: {seg['start']:.2f}s -> {seg['start'] + dur:.2f}s (dur={dur:.2f}s, max={seg['max_dur']:.2f}s)"
        )

    # Smooth the ducking envelope
    kernel_size = int(0.25 * SR)
    kernel = np.ones(kernel_size) / kernel_size
    smooth_env = np.convolve(envelope, kernel, mode="same")
    return voice_track, smooth_env


def synth_note(freq, dur, sr=SR, harmonics=(1.0, 0.4, 0.15, 0.06), attack=0.08, release=0.3):
    t = np.linspace(0, dur, int(sr * dur), endpoint=False)
    wave = np.zeros_like(t)
    for i, amp in enumerate(harmonics):
        wave += amp * np.sin(2 * np.pi * freq * (i + 1) * t)
    env = np.ones_like(t)
    att_s = min(len(t) // 2, int(attack * sr))
    rel_s = min(len(t) // 2, int(release * sr))
    if att_s > 0:
        env[:att_s] = np.linspace(0, 1, att_s)
    if rel_s > 0:
        env[-rel_s:] = np.linspace(1, 0, rel_s)
    return wave * env


def generate_background_music():
    t = np.linspace(0, DURATION, TOTAL_SAMPLES, endpoint=False)
    left = np.zeros(TOTAL_SAMPLES, dtype=np.float32)
    right = np.zeros(TOTAL_SAMPLES, dtype=np.float32)

    # Chord progression across the 6 acts (evolving mood)
    # Act 1 (0-9s): Mysterious Triassic D minor / A minor
    # Act 2 (9-20s): Majestic Jurassic F major -> C major -> G major
    # Act 3 (20-32s): Intense Cretaceous D minor -> Bb major -> A7
    # Act 4 (32-42s): Cataclysmic Impact C minor -> Ab -> Gsus4
    # Act 5 (42-51s): Wonder & Discovery A minor -> F major -> C major
    # Act 6 (51-60s): Uplifting Flight C major -> G major -> F major -> C major
    chords = [
        (0.0, 4.5, [146.83, 220.00, 261.63, 329.63]),   # Dm9
        (4.5, 9.0, [110.00, 164.81, 220.00, 246.94]),   # Amadd9
        (9.0, 14.5, [174.61, 220.00, 261.63, 349.23]),  # Fmaj7
        (14.5, 20.0, [130.81, 196.00, 246.94, 329.63]), # Cmaj7
        (20.0, 26.0, [146.83, 220.00, 293.66, 349.23]), # Dm
        (26.0, 32.0, [116.54, 174.61, 233.08, 293.66]), # Bbmaj
        (32.0, 37.0, [130.81, 155.56, 196.00, 261.63]), # Cm (Impact)
        (37.0, 42.0, [103.83, 155.56, 207.65, 246.94]), # Abm/maj
        (42.0, 46.5, [110.00, 164.81, 220.00, 261.63]), # Am
        (46.5, 51.0, [174.61, 220.00, 261.63, 329.63]), # Fmaj7
        (51.0, 55.5, [130.81, 196.00, 261.63, 329.63]), # Cmaj
        (55.5, 60.0, [130.81, 196.00, 261.63, 392.00]), # Cmaj9 finale
    ]

    for start, end, freqs in chords:
        dur = end - start
        s_idx = int(start * SR)
        e_idx = min(TOTAL_SAMPLES, int(end * SR))
        seg_len = e_idx - s_idx
        for i, f in enumerate(freqs):
            note = synth_note(
                f,
                dur,
                harmonics=(1.0, 0.35, 0.12),
                attack=0.4,
                release=0.5,
            )[:seg_len]
            pan = 0.3 + 0.4 * (i / max(1, len(freqs) - 1))
            left[s_idx:e_idx] += note * (1 - pan) * 0.12
            right[s_idx:e_idx] += note * pan * 0.12
        # Add deep sub-bass root
        bass = synth_note(freqs[0] * 0.5, dur, harmonics=(1.0, 0.2), attack=0.3, release=0.4)[:seg_len]
        left[s_idx:e_idx] += bass * 0.10
        right[s_idx:e_idx] += bass * 0.10

    # Gentle arpeggio pulses (marimba/harp feel)
    arp_notes = [261.63, 329.63, 392.00, 523.25, 440.00, 349.23, 293.66, 392.00]
    step = 0.5
    for idx, pos in enumerate(np.arange(0.5, 59.0, step)):
        # Skip right around the asteroid explosion for dramatic contrast
        if 32.5 <= pos <= 36.5:
            continue
        f = arp_notes[idx % len(arp_notes)]
        if 20.0 <= pos < 32.0:
            f *= 0.75  # Darker in Cretaceous duel
        n_dur = 0.42
        note = synth_note(f, n_dur, harmonics=(1.0, 0.25, 0.05), attack=0.015, release=0.28)
        s_idx = int(pos * SR)
        e_idx = min(TOTAL_SAMPLES, s_idx + len(note))
        pan = 0.25 if idx % 2 == 0 else 0.75
        left[s_idx:e_idx] += note[: e_idx - s_idx] * (1 - pan) * 0.07
        right[s_idx:e_idx] += note[: e_idx - s_idx] * pan * 0.07

    # Sound Effects (SFX):
    # 1. Jurassic heavy footsteps (at 11.5s, 13.5s, 16.0s)
    for step_t in [11.5, 13.8, 16.2]:
        s_idx = int(step_t * SR)
        dur_s = int(0.45 * SR)
        if s_idx + dur_s < TOTAL_SAMPLES:
            tt = np.linspace(0, 0.45, dur_s)
            thud = np.sin(2 * np.pi * (65 * np.exp(-3.5 * tt)) * tt) * np.exp(-6 * tt) * 0.22
            left[s_idx : s_idx + dur_s] += thud
            right[s_idx : s_idx + dur_s] += thud

    # 2. Cretaceous T-Rex subtle low growl resonance (at 25.0s)
    s_idx = int(25.0 * SR)
    dur_s = int(1.2 * SR)
    if s_idx + dur_s < TOTAL_SAMPLES:
        tt = np.linspace(0, 1.2, dur_s)
        growl_freq = 95 + 25 * np.sin(2 * np.pi * 2.5 * tt)
        growl = (
            (np.sin(2 * np.pi * growl_freq * tt) + 0.5 * np.sin(2 * np.pi * growl_freq * 1.5 * tt))
            * np.exp(-2.2 * tt)
            * 0.14
        )
        left[s_idx : s_idx + dur_s] += growl
        right[s_idx : s_idx + dur_s] += growl

    # 3. Chicxulub Asteroid Impact Boom & Rumble (at 33.2s)
    s_idx = int(33.2 * SR)
    dur_s = int(3.2 * SR)
    if s_idx + dur_s < TOTAL_SAMPLES:
        tt = np.linspace(0, 3.2, dur_s)
        np.random.seed(42)
        noise = np.random.normal(0, 1, dur_s)
        b, a = butter(2, 220 / (SR / 2), btype="low")
        rumble = lfilter(b, a, noise) * np.exp(-1.1 * tt) * 0.45
        sub_drop = np.sin(2 * np.pi * (90 * np.exp(-1.2 * tt) + 28) * tt) * np.exp(-1.0 * tt) * 0.28
        impact = rumble + sub_drop
        left[s_idx : s_idx + dur_s] += impact
        right[s_idx : s_idx + dur_s] += impact

    # 4. Crystalline fossil scanner chime (at 44.0s, 46.5s)
    for chime_t, freq in [(43.8, 880.0), (44.1, 1174.66), (47.2, 1046.5), (47.5, 1318.5)]:
        s_idx = int(chime_t * SR)
        note = synth_note(freq, 0.6, harmonics=(1.0, 0.5), attack=0.01, release=0.5) * 0.06
        e_idx = min(TOTAL_SAMPLES, s_idx + len(note))
        left[s_idx:e_idx] += note[: e_idx - s_idx]
        right[s_idx:e_idx] += note[: e_idx - s_idx]

    # Fade out last 1.2s
    fade_out = int(1.2 * SR)
    left[-fade_out:] *= np.linspace(1, 0, fade_out)
    right[-fade_out:] *= np.linspace(1, 0, fade_out)

    return left, right


if __name__ == "__main__":
    voice, env = generate_tts_segments()
    bgm_l, bgm_r = generate_background_music()

    # Duck BGM slightly during voiceover so voice is crystal clear
    duck_factor = 1.0 - 0.52 * env
    mix_l = voice + bgm_l * duck_factor
    mix_r = voice + bgm_r * duck_factor

    stereo = np.stack([mix_l, mix_r], axis=1)
    peak = np.max(np.abs(stereo))
    if peak > 0.95:
        stereo = stereo / peak * 0.95

    stereo_int16 = (stereo * 32767).astype(np.int16)
    wavfile.write("build_audio/master_audio.wav", SR, stereo_int16)
    print("Saved build_audio/master_audio.wav successfully!")
