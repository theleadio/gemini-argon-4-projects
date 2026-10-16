// Procedural Web Audio Synthesizer for Engine, Drift, Boost, Collisions, and TT Racing Motorized Desk
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.initialized = false;

    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.engineGain = null;

    this.driftNoise = null;
    this.driftFilter = null;
    this.driftGain = null;

    this.deskOsc = null;
    this.deskGain = null;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();

      // Engine harmonic oscillators
      this.engineOsc1 = this.ctx.createOscillator();
      this.engineOsc2 = this.ctx.createOscillator();
      const engineFilter = this.ctx.createBiquadFilter();
      this.engineGain = this.ctx.createGain();

      this.engineOsc1.type = 'sawtooth';
      this.engineOsc2.type = 'triangle';
      this.engineOsc1.frequency.value = 65;
      this.engineOsc2.frequency.value = 130;

      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 480;

      this.engineGain.gain.value = 0.0;

      this.engineOsc1.connect(engineFilter);
      this.engineOsc2.connect(engineFilter);
      engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);

      this.engineOsc1.start();
      this.engineOsc2.start();
      this.engineFilter = engineFilter;

      // White noise buffer for tire drift / boost
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      this.driftNoise = this.ctx.createBufferSource();
      this.driftNoise.buffer = noiseBuffer;
      this.driftNoise.loop = true;

      this.driftFilter = this.ctx.createBiquadFilter();
      this.driftFilter.type = 'bandpass';
      this.driftFilter.frequency.value = 1100;
      this.driftFilter.Q.value = 3.5;

      this.driftGain = this.ctx.createGain();
      this.driftGain.gain.value = 0.0;

      this.driftNoise.connect(this.driftFilter);
      this.driftFilter.connect(this.driftGain);
      this.driftGain.connect(this.ctx.destination);
      this.driftNoise.start();

      // TT Racing Motorized Sit-Stand Desk actuator sound
      this.deskOsc = this.ctx.createOscillator();
      const deskFilter = this.ctx.createBiquadFilter();
      this.deskGain = this.ctx.createGain();

      this.deskOsc.type = 'sawtooth';
      this.deskOsc.frequency.value = 148;
      deskFilter.type = 'bandpass';
      deskFilter.frequency.value = 260;
      deskFilter.Q.value = 4.0;
      this.deskGain.gain.value = 0.0;

      this.deskOsc.connect(deskFilter);
      deskFilter.connect(this.deskGain);
      this.deskGain.connect(this.ctx.destination);
      this.deskOsc.start();

      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio init skipped:', e);
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled && this.initialized) {
      this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      this.driftGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      this.deskGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    }
    return this.enabled;
  }

  update(speedNorm, rpmNorm, isDrifting, isBoosting, deskVel) {
    if (!this.initialized || !this.enabled) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const now = this.ctx.currentTime;
    const baseFreq = 52 + rpmNorm * 145 + speedNorm * 65 + (isBoosting ? 45 : 0);
    this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.03);
    this.engineOsc2.frequency.setTargetAtTime(baseFreq * 1.98, now, 0.03);
    this.engineFilter.frequency.setTargetAtTime(320 + rpmNorm * 950, now, 0.04);

    const targetEngGain = 0.035 + speedNorm * 0.055 + (isBoosting ? 0.03 : 0);
    this.engineGain.gain.setTargetAtTime(targetEngGain, now, 0.05);

    // Drift tire squeal
    const targetDriftGain = isDrifting && speedNorm > 0.18 ? Math.min(0.08, speedNorm * 0.09) : 0;
    this.driftFilter.frequency.setTargetAtTime(isBoosting ? 650 : 1250, now, 0.05);
    this.driftGain.gain.setTargetAtTime(targetDriftGain, now, 0.04);

    // Motorized Desk Up/Down servo motor sound
    const absDesk = Math.abs(deskVel);
    if (absDesk > 0.05) {
      const pitch = deskVel > 0 ? 158 : 132;
      this.deskOsc.frequency.setTargetAtTime(pitch + absDesk * 3, now, 0.04);
      this.deskGain.gain.setTargetAtTime(0.035, now, 0.04);
    } else {
      this.deskGain.gain.setTargetAtTime(0, now, 0.05);
    }
  }

  playTone(freq = 660, duration = 0.14, type = 'sine', vol = 0.08) {
    if (!this.initialized || !this.enabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  playCollision(intensity = 0.5) {
    if (!this.initialized || !this.enabled) return;
    this.playTone(95 + Math.random() * 50, 0.12, 'triangle', Math.min(0.14, intensity * 0.12));
  }

  playCheckpoint() {
    this.playTone(587.33, 0.1, 'sine', 0.07);
    setTimeout(() => this.playTone(880, 0.16, 'sine', 0.08), 70);
  }

  playLapComplete() {
    this.playTone(523.25, 0.11, 'triangle', 0.09);
    setTimeout(() => this.playTone(659.25, 0.11, 'triangle', 0.09), 90);
    setTimeout(() => this.playTone(783.99, 0.11, 'triangle', 0.09), 180);
    setTimeout(() => this.playTone(1046.5, 0.25, 'triangle', 0.11), 270);
  }
}
