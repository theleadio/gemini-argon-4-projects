class ShufaSoundEngine {
  private ctx: AudioContext | null = null;
  private enabled = false;

  private ensureContext(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setEnabled(val: boolean): void {
    this.enabled = val;
    if (val) {
      this.ensureContext();
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Soft horsehair-on-Xuan-paper brush swish triggered on stroke start
   */
  public playStrokeBrush(durationMs = 260, pitchFactor = 1): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const dur = Math.max(0.08, Math.min(0.65, durationMs / 1000));
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      const env = Math.sin(t * Math.PI) * (1 - t * 0.4);
      data[i] = (Math.random() * 2 - 1) * env * 0.14;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(520 * pitchFactor, now);
    filter.frequency.exponentialRampToValueAtTime(980 * pitchFactor, now + dur);
    filter.Q.value = 2.4;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.09, now + dur * 0.25);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + dur);
  }

  /**
   * Gentle pentatonic Guqin harmonic pluck when a character completes
   */
  public playCharacterComplete(charIndex = 0): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    // Guqin pentatonic scale (Gong-Shang-Jue-Zhi-Yu): C4, D4, E4, G4, A4, C5
    const freqs = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
    const freq = freqs[charIndex % freqs.length];
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);

    const overtone = ctx.createOscillator();
    overtone.type = 'sine';
    overtone.frequency.setValueAtTime(freq * 2, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.075, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 1.35);

    const overtoneGain = ctx.createGain();
    overtoneGain.gain.setValueAtTime(0.001, now);
    overtoneGain.gain.linearRampToValueAtTime(0.025, now + 0.015);
    overtoneGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.65);

    osc.connect(gain);
    overtone.connect(overtoneGain);
    gain.connect(ctx.destination);
    overtoneGain.connect(ctx.destination);

    osc.start(now);
    overtone.start(now);
    osc.stop(now + 1.4);
    overtone.stop(now + 0.7);
  }

  /**
   * Warm stone-on-paper thud when the Cinnabar seal stamps at phrase completion
   */
  public playSealStamp(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(135, now);
    osc.frequency.exponentialRampToValueAtTime(46, now + 0.16);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }
}

export const soundEngine = new ShufaSoundEngine();
