// Procedural Web Audio API Synthesizer for Jelly Sound Effects
class JellyAudio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.lastSquishTime = 0;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playPop(pitchScale = 1.0) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const baseFreq = (260 + Math.random() * 140) * pitchScale;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 2.3, now + 0.09);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  playBoing(intensity = 0.6, sizeScale = 1.0) {
    if (!this.enabled) return;
    const nowMs = performance.now();
    if (nowMs - this.lastSquishTime < 45) return;
    this.lastSquishTime = nowMs;

    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const mod = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    const gain = this.ctx.createGain();

    const invSize = Math.max(0.55, Math.min(1.6, 1 / sizeScale));
    const baseFreq = (140 + Math.min(1, intensity) * 150) * invSize;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq * 0.75, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.45, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.95, now + 0.24);

    // Wobble FM modulation
    mod.type = 'sine';
    mod.frequency.setValueAtTime(26 * invSize, now);
    modGain.gain.setValueAtTime(35 * intensity, now);
    modGain.gain.exponentialRampToValueAtTime(1, now + 0.24);

    const vol = Math.min(0.24, Math.max(0.03, intensity * 0.22));
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    mod.connect(modGain);
    modGain.connect(osc.frequency);
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    mod.start(now);
    osc.stop(now + 0.26);
    mod.stop(now + 0.26);
  }

  playChomp() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    // Short crunchy noise burst + low thud
    const bufferSize = this.ctx.sampleRate * 0.12;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(650, now);
    filter.Q.setValueAtTime(1.8, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(now);

    // Squishy undertone
    this.playPop(0.7);
  }

  playStretch(stretchRatio = 1.2) {
    if (!this.enabled) return;
    const nowMs = performance.now();
    if (nowMs - this.lastSquishTime < 70) return;
    this.lastSquishTime = nowMs;

    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const freq = Math.min(600, 180 + stretchRatio * 95);
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.linearRampToValueAtTime(freq * 1.15, now + 0.06);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.07);
  }
}

window.jellyAudio = new JellyAudio();
