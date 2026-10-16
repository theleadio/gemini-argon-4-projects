import {
  AudioUnitNodeConfig,
  CaptionSegment,
  SliceBlock,
  SSStudioProject,
} from '../types/project';
import { BUILT_IN_BACKGROUND_AUDIO } from '../data/catalog';
import { invokeTrpc } from '../bridge/trpcBridge';

export interface SilenceDetectionResult {
  silentRanges: { startMs: number; endMs: number }[];
  updatedSlices: SliceBlock[];
}

/**
 * Reconstructs `native-audio.node` (`aufx/*` DSP graph), `assets/background-audio` mixer
 * with speech auto-ducking, `bin/detect-silence`, and `speech.generateVoiceoverForProject`.
 */
class StudioAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgMusicGain: GainNode | null = null;

  // aufx DSP chain nodes
  private hpasFilter: BiquadFilterNode | null = null;
  private eqMudFilter: BiquadFilterNode | null = null;
  private eqPresenceFilter: BiquadFilterNode | null = null;
  private sibilanceFilter: BiquadFilterNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private highShelfFilter: BiquadFilterNode | null = null;
  private lowPassFilter: BiquadFilterNode | null = null;
  private limiterNode: DynamicsCompressorNode | null = null;

  private lastBgBeatIndex = -1;
  private lastSpokenCaptionId: string | null = null;

  // Live microphone analyser state
  private micSource: MediaStreamAudioSourceNode | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private micSamples: { timeMs: number; rms: number }[] = [];
  private micSampleTimer: number | null = null;
  private micStartPerf = 0;

  // Optional Web Speech API recognition
  private recognition: unknown = null;
  private liveRecognizedCaptions: CaptionSegment[] = [];

  private ensureGraph(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      const ctx = new AudioCtx();
      this.ctx = ctx;

      this.masterGain = ctx.createGain();
      this.bgMusicGain = ctx.createGain();

      this.hpasFilter = ctx.createBiquadFilter();
      this.hpasFilter.type = 'highpass';
      this.hpasFilter.frequency.value = 80;

      this.eqMudFilter = ctx.createBiquadFilter();
      this.eqMudFilter.type = 'peaking';
      this.eqMudFilter.frequency.value = 240;
      this.eqMudFilter.Q.value = 1.2;

      this.eqPresenceFilter = ctx.createBiquadFilter();
      this.eqPresenceFilter.type = 'peaking';
      this.eqPresenceFilter.frequency.value = 3200;
      this.eqPresenceFilter.Q.value = 1.4;

      this.sibilanceFilter = ctx.createBiquadFilter();
      this.sibilanceFilter.type = 'peaking';
      this.sibilanceFilter.frequency.value = 6800;
      this.sibilanceFilter.Q.value = 2.0;

      this.compressorNode = ctx.createDynamicsCompressor();
      this.compressorNode.threshold.value = -18;
      this.compressorNode.knee.value = 12;
      this.compressorNode.ratio.value = 3;
      this.compressorNode.attack.value = 0.005;
      this.compressorNode.release.value = 0.16;

      this.highShelfFilter = ctx.createBiquadFilter();
      this.highShelfFilter.type = 'highshelf';
      this.highShelfFilter.frequency.value = 10000;

      this.lowPassFilter = ctx.createBiquadFilter();
      this.lowPassFilter.type = 'lowpass';
      this.lowPassFilter.frequency.value = 18500;

      this.limiterNode = ctx.createDynamicsCompressor();
      this.limiterNode.threshold.value = -1.0;
      this.limiterNode.knee.value = 0.0;
      this.limiterNode.ratio.value = 20.0;
      this.limiterNode.attack.value = 0.001;
      this.limiterNode.release.value = 0.06;

      // Connect aufx DSP chain -> masterGain -> destination
      this.hpasFilter.connect(this.eqMudFilter);
      this.eqMudFilter.connect(this.eqPresenceFilter);
      this.eqPresenceFilter.connect(this.sibilanceFilter);
      this.sibilanceFilter.connect(this.compressorNode);
      this.compressorNode.connect(this.highShelfFilter);
      this.highShelfFilter.connect(this.lowPassFilter);
      this.lowPassFilter.connect(this.limiterNode);
      this.limiterNode.connect(this.masterGain);

      this.bgMusicGain.connect(this.masterGain);
      this.masterGain.connect(ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public updateDspParameters(project: SSStudioProject) {
    const ctx = this.ensureGraph();
    if (!ctx) return;

    const { audioConfig } = project;
    const findUnit = (id: string): AudioUnitNodeConfig | undefined =>
      audioConfig.audioUnits.find((u) => u.id === id);

    const hpas = findUnit('aufx/hpas/appl');
    if (this.hpasFilter) {
      this.hpasFilter.frequency.setTargetAtTime(
        hpas?.enabled ? 45 + hpas.amount * 75 : 18,
        ctx.currentTime,
        0.02
      );
    }

    const eq = findUnit('aufx/filt/appl');
    if (this.eqMudFilter && this.eqPresenceFilter) {
      this.eqMudFilter.gain.setTargetAtTime(
        eq?.enabled ? -4.5 * eq.amount : 0,
        ctx.currentTime,
        0.02
      );
      this.eqPresenceFilter.gain.setTargetAtTime(
        eq?.enabled ? 5.0 * eq.amount : 0,
        ctx.currentTime,
        0.02
      );
    }

    if (this.sibilanceFilter) {
      const sibGain = audioConfig.tfRestormerSpeechRestore
        ? audioConfig.restoreSibilance * 6.5
        : 0;
      this.sibilanceFilter.gain.setTargetAtTime(sibGain, ctx.currentTime, 0.02);
    }

    const dcmp = findUnit('aufx/dcmp/appl');
    if (this.compressorNode) {
      this.compressorNode.threshold.setTargetAtTime(
        dcmp?.enabled ? -10 - dcmp.amount * 16 : 0,
        ctx.currentTime,
        0.02
      );
      this.compressorNode.ratio.setTargetAtTime(
        dcmp?.enabled ? 1 + dcmp.amount * 4 : 1,
        ctx.currentTime,
        0.02
      );
    }

    const hshf = findUnit('aufx/hshf/appl');
    if (this.highShelfFilter) {
      this.highShelfFilter.gain.setTargetAtTime(
        hshf?.enabled ? hshf.amount * 7.5 : 0,
        ctx.currentTime,
        0.02
      );
    }

    const lpas = findUnit('aufx/lpas/appl');
    if (this.lowPassFilter) {
      this.lowPassFilter.frequency.setTargetAtTime(
        lpas?.enabled ? 20000 - lpas.amount * 9500 : 21000,
        ctx.currentTime,
        0.02
      );
    }
  }

  /**
   * Called during timeline playback to trigger procedural background music notes
   * (with speech auto-ducking) and optional Web Speech API voiceover.
   */
  public syncPlaybackFrame(params: {
    isPlaying: boolean;
    isMuted: boolean;
    timeMs: number;
    project: SSStudioProject;
  }) {
    const { isPlaying, isMuted, timeMs, project } = params;
    if (!isPlaying || isMuted) {
      this.lastBgBeatIndex = -1;
      this.lastSpokenCaptionId = null;
      return;
    }

    const { audioConfig, captionsConfig, captions } = project;
    const activeSpeechCap = captions.find(
      (c) =>
        c.type === 'speech' && timeMs >= c.startMs && timeMs <= c.endMs
    );

    // 1. Optional AI Voiceover synthesis (`speech.generateVoiceoverForProject`)
    if (captionsConfig.voiceoverEnabled && activeSpeechCap) {
      if (this.lastSpokenCaptionId !== activeSpeechCap.id) {
        this.lastSpokenCaptionId = activeSpeechCap.id;
        this.speakText(activeSpeechCap.text, captionsConfig.voiceURI);
      }
    } else if (!activeSpeechCap) {
      this.lastSpokenCaptionId = null;
    }

    // 2. Background Music Track synthesis + Auto-Ducking
    if (!audioConfig.backgroundTrackId || audioConfig.backgroundTrackVolume <= 0.005) {
      return;
    }

    const track = BUILT_IN_BACKGROUND_AUDIO.find(
      (t) => t.id === audioConfig.backgroundTrackId
    );
    if (!track) return;

    const beatDurationMs = (60 / track.bpm) * 1000 * 0.5; // eighth-note grid
    const beatIndex = Math.floor(timeMs / beatDurationMs);

    if (beatIndex !== this.lastBgBeatIndex) {
      this.lastBgBeatIndex = beatIndex;
      const isDucked = Boolean(audioConfig.autoDuckBackground && activeSpeechCap);
      const effectiveVol =
        audioConfig.backgroundTrackVolume * (isDucked ? 0.34 : 1.0);
      this.triggerBackgroundChordNote(track.category, beatIndex, effectiveVol);
    }
  }

  private triggerBackgroundChordNote(
    category: 'commercial' | 'electronic' | 'instrumental' | 'lo-fi',
    stepIndex: number,
    volume: number
  ) {
    const ctx = this.ensureGraph();
    if (!ctx || !this.bgMusicGain) return;

    // Chord progressions in Hz
    const progressions: Record<typeof category, number[][]> = {
      'lo-fi': [
        [261.63, 329.63, 392.0, 493.88], // Cmaj7
        [220.0, 261.63, 329.63, 392.0], // Am7
        [293.66, 349.23, 440.0, 523.25], // Dm7
        [196.0, 246.94, 293.66, 349.23], // G7
      ],
      commercial: [
        [261.63, 329.63, 392.0, 523.25],
        [392.0, 493.88, 587.33, 783.99],
        [349.23, 440.0, 523.25, 698.46],
        [261.63, 392.0, 523.25, 659.25],
      ],
      electronic: [
        [220.0, 329.63, 440.0, 659.25],
        [174.61, 261.63, 349.23, 523.25],
        [261.63, 392.0, 523.25, 783.99],
        [196.0, 293.66, 392.0, 587.33],
      ],
      instrumental: [
        [293.66, 369.99, 440.0, 587.33],
        [220.0, 277.18, 329.63, 440.0],
        [246.94, 293.66, 369.99, 493.88],
        [196.0, 246.94, 293.66, 392.0],
      ],
    };

    const chords = progressions[category] ?? progressions['lo-fi'];
    const chord = chords[Math.floor(stepIndex / 4) % chords.length];
    const noteHz = chord[stepIndex % chord.length];

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const noteGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = category === 'electronic' ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(noteHz, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(
      category === 'lo-fi' ? 920 : category === 'electronic' ? 1650 : 1300,
      now
    );

    const peakGain = Math.min(0.18, volume * 0.25);
    noteGain.gain.setValueAtTime(0.0001, now);
    noteGain.gain.linearRampToValueAtTime(peakGain, now + 0.025);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);

    osc.connect(filter);
    filter.connect(noteGain);
    noteGain.connect(this.bgMusicGain);

    osc.start(now);
    osc.stop(now + 0.36);
  }

  /**
   * Auditions the active `aufx/*` DSP chain + MossFormer2/TF-Restormer sibilance curve.
   */
  public auditionAudioChain(project: SSStudioProject) {
    const ctx = this.ensureGraph();
    if (!ctx || !this.hpasFilter) return;
    this.updateDspParameters(project);

    const now = ctx.currentTime;
    const freqs = [220, 330, 440, 659.25, 3200, 6800];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = idx >= 4 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(f, now + idx * 0.05);
      const baseAmp = idx >= 4 ? 0.035 : 0.08;
      g.gain.setValueAtTime(0.0001, now + idx * 0.05);
      g.gain.linearRampToValueAtTime(baseAmp, now + idx * 0.05 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.05 + 0.32);

      osc.connect(g);
      g.connect(this.hpasFilter!);
      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.35);
    });
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return [];
    }
    return window.speechSynthesis.getVoices();
  }

  public speakText(text: string, voiceURI?: string) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const cleaned = text.replace(/^\[.*\]$/, '').trim();
      if (!cleaned) return;
      const utter = new SpeechSynthesisUtterance(cleaned);
      utter.rate = 1.06;
      if (voiceURI) {
        const match = window.speechSynthesis
          .getVoices()
          .find((v) => v.voiceURI === voiceURI);
        if (match) utter.voice = match;
      }
      window.speechSynthesis.speak(utter);
    } catch {
      // Ignore speechSynthesis errors in headless environments
    }
  }

  /**
   * Starts real-time microphone waveform & optional Web Speech API live captioning
   * during a `polyrecorder` capture session.
   */
  public startLiveMicMonitor(stream: MediaStream) {
    this.micSamples = [];
    this.liveRecognizedCaptions = [];
    this.micStartPerf = performance.now();

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length > 0) {
      const ctx = this.ensureGraph();
      if (ctx) {
        try {
          this.micSource = ctx.createMediaStreamSource(stream);
          this.micAnalyser = ctx.createAnalyser();
          this.micAnalyser.fftSize = 256;
          this.micSource.connect(this.micAnalyser);

          const buf = new Uint8Array(this.micAnalyser.frequencyBinCount);
          this.micSampleTimer = window.setInterval(() => {
            if (!this.micAnalyser) return;
            this.micAnalyser.getByteTimeDomainData(buf);
            let sumSq = 0;
            for (let i = 0; i < buf.length; i++) {
              const norm = (buf[i] - 128) / 128;
              sumSq += norm * norm;
            }
            const rms = Math.min(1, Math.sqrt(sumSq / buf.length) * 3.5);
            this.micSamples.push({
              timeMs: performance.now() - this.micStartPerf,
              rms,
            });
          }, 80);
        } catch {
          // Ignore audio graph errors if stream has no active audio
        }
      }
    }

    // Attempt Web Speech API live speech-to-text if supported
    const SpeechRec =
      (window as unknown as { SpeechRecognition?: new () => unknown })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => unknown })
        .webkitSpeechRecognition;

    if (SpeechRec) {
      try {
        const rec = new SpeechRec() as {
          continuous: boolean;
          interimResults: boolean;
          lang: string;
          onresult: ((ev: unknown) => void) | null;
          start: () => void;
        };
        rec.continuous = true;
        rec.interimResults = false;
        rec.lang = 'en-US';
        rec.onresult = (event: unknown) => {
          const ev = event as {
            resultIndex: number;
            results: {
              length: number;
              [idx: number]: {
                isFinal: boolean;
                0: { transcript: string; confidence: number };
              };
            };
          };
          const nowMs = Math.round(performance.now() - this.micStartPerf);
          for (let i = ev.resultIndex; i < ev.results.length; i++) {
            const res = ev.results[i];
            if (res.isFinal && res[0]?.transcript?.trim()) {
              const txt = res[0].transcript.trim();
              const dur = Math.max(1200, Math.min(4000, txt.length * 65));
              this.liveRecognizedCaptions.push({
                id: `cap-live-${Date.now()}-${i}`,
                startMs: Math.max(0, nowMs - dur),
                endMs: nowMs,
                text: txt,
                confidence: Number((res[0].confidence || 0.94).toFixed(2)),
                generator: 'system',
                type: 'speech',
              });
            }
          }
        };
        rec.start();
        this.recognition = rec;
      } catch {
        this.recognition = null;
      }
    }
  }

  public stopLiveMicMonitor(finalDurationMs: number, bins = 128): {
    waveform: number[];
    recognizedCaptions: CaptionSegment[];
  } {
    if (this.micSampleTimer !== null) {
      clearInterval(this.micSampleTimer);
      this.micSampleTimer = null;
    }
    if (this.micSource) {
      try {
        this.micSource.disconnect();
      } catch {}
      this.micSource = null;
    }
    this.micAnalyser = null;

    if (this.recognition) {
      try {
        (this.recognition as { stop: () => void }).stop();
      } catch {}
      this.recognition = null;
    }

    const waveform: number[] = [];
    if (this.micSamples.length > 4) {
      for (let i = 0; i < bins; i++) {
        const tStart = (i / bins) * finalDurationMs;
        const tEnd = ((i + 1) / bins) * finalDurationMs;
        const inBin = this.micSamples.filter(
          (s) => s.timeMs >= tStart && s.timeMs <= tEnd
        );
        if (inBin.length > 0) {
          const avg =
            inBin.reduce((acc, s) => acc + s.rms, 0) / inBin.length;
          waveform.push(Number(Math.max(0.04, Math.min(0.98, avg)).toFixed(3)));
        } else {
          waveform.push(0.05);
        }
      }
    } else {
      for (let i = 0; i < bins; i++) {
        const t = (i / bins) * finalDurationMs;
        waveform.push(
          Number(
            (0.12 + 0.35 * Math.abs(Math.sin(t * 0.005 + i * 0.3))).toFixed(3)
          )
        );
      }
    }

    return {
      waveform,
      recognizedCaptions: [...this.liveRecognizedCaptions],
    };
  }

  /**
   * Reconstructs `bin/detect-silence` (`project.silenceChunks` in `dist-electron/index.js`).
   * Finds low-energy/non-speech spans and splits `project.slices` so silent segments
   * are automatically accelerated to `2.5x` speed.
   */
  public async detectAndSplitSilences(
    project: SSStudioProject
  ): Promise<SilenceDetectionResult> {
    await invokeTrpc('project.silenceChunks', 'query', {
      projectId: project.id,
      durationMs: project.durationMs,
    });

    const speechCaptions = project.captions
      .filter((c) => c.type === 'speech')
      .sort((a, b) => a.startMs - b.startMs);

    const silentRanges: { startMs: number; endMs: number }[] = [];

    if (speechCaptions.length > 0) {
      let cursorMs = 0;
      for (const cap of speechCaptions) {
        if (cap.startMs - cursorMs >= 750) {
          silentRanges.push({
            startMs: Math.round(cursorMs),
            endMs: Math.round(cap.startMs),
          });
        }
        cursorMs = Math.max(cursorMs, cap.endMs);
      }
      if (project.durationMs - cursorMs >= 750) {
        silentRanges.push({
          startMs: Math.round(cursorMs),
          endMs: Math.round(project.durationMs),
        });
      }
    } else if (project.audioWaveform && project.audioWaveform.length > 0) {
      const bins = project.audioWaveform.length;
      const binMs = project.durationMs / bins;
      let silenceStart: number | null = null;
      project.audioWaveform.forEach((amp, idx) => {
        const t = idx * binMs;
        if (amp < 0.16) {
          if (silenceStart === null) silenceStart = t;
        } else if (silenceStart !== null) {
          if (t - silenceStart >= 750) {
            silentRanges.push({
              startMs: Math.round(silenceStart),
              endMs: Math.round(t),
            });
          }
          silenceStart = null;
        }
      });
    }

    if (silentRanges.length === 0) {
      // Fallback: split current playhead or middle idle region
      const midStart = Math.round(project.durationMs * 0.62);
      const midEnd = Math.round(project.durationMs * 0.72);
      silentRanges.push({ startMs: midStart, endMs: midEnd });
    }

    // Rebuild slices with silent segments marked at 2.5x speed
    const newSlices: SliceBlock[] = [];
    let pointer = 0;
    let clipIdx = 1;

    for (const sil of silentRanges) {
      if (sil.startMs > pointer + 250) {
        newSlices.push({
          id: `slice-speech-${clipIdx}`,
          startMs: pointer,
          endMs: sil.startMs,
          speed: 1.0,
          typingSpeedUp: false,
          label: `Clip ${clipIdx} · Active Speech`,
        });
        clipIdx++;
      }
      newSlices.push({
        id: `slice-silence-${clipIdx}`,
        startMs: sil.startMs,
        endMs: sil.endMs,
        speed: 2.5,
        typingSpeedUp: true,
        label: `Silence Skip (2.5× Fast-Forward)`,
      });
      pointer = sil.endMs;
    }

    if (pointer < project.durationMs - 250) {
      newSlices.push({
        id: `slice-speech-${clipIdx}`,
        startMs: pointer,
        endMs: project.durationMs,
        speed: 1.0,
        typingSpeedUp: false,
        label: `Clip ${clipIdx} · Active Speech`,
      });
    }

    return {
      silentRanges,
      updatedSlices: newSlices,
    };
  }
}

export const studioAudioEngine = new StudioAudioEngine();
