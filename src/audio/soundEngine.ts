import { CharacterId, CharacterVoiceConfig } from '../types/fnf';

// Character vocal parameters
export const CHARACTER_VOICE_CONFIGS: Record<CharacterId, CharacterVoiceConfig> = {
  bf: {
    waveform: 'sawtooth',
    filterType: 'bandpass',
    baseFreqMultiplier: 1.0,
    formants: [700, 1800],
    qFactor: 4.5,
    vibratoRate: 6.0,
    vibratoDepth: 4.0,
    attack: 0.015,
    decay: 0.22,
    harmonicBoost: 1.4,
    noiseLevel: 0.03,
    characterBite: 'saw',
  },
  dad: {
    waveform: 'sawtooth',
    filterType: 'lowpass',
    baseFreqMultiplier: 0.5, // 1 octave lower
    formants: [400, 900],
    qFactor: 5.0,
    vibratoRate: 5.0,
    vibratoDepth: 6.0,
    attack: 0.04,
    decay: 0.35,
    harmonicBoost: 1.8,
    noiseLevel: 0.01,
    characterBite: 'organ',
  },
  pico: {
    waveform: 'square',
    filterType: 'bandpass',
    baseFreqMultiplier: 0.75,
    formants: [600, 1500],
    qFactor: 6.0,
    vibratoRate: 7.0,
    vibratoDepth: 3.0,
    attack: 0.01,
    decay: 0.18,
    harmonicBoost: 2.0,
    noiseLevel: 0.08, // snappy consonant attack
    characterBite: 'pulse',
  },
  mom: {
    waveform: 'sawtooth',
    filterType: 'bandpass',
    baseFreqMultiplier: 1.15,
    formants: [800, 2200],
    qFactor: 3.5,
    vibratoRate: 6.5,
    vibratoDepth: 8.0,
    attack: 0.03,
    decay: 0.38,
    harmonicBoost: 1.2,
    noiseLevel: 0.01,
    characterBite: 'saw',
  },
  spooky: {
    waveform: 'triangle',
    filterType: 'bandpass',
    baseFreqMultiplier: 1.35,
    formants: [950, 2600],
    qFactor: 5.5,
    vibratoRate: 8.0,
    vibratoDepth: 5.0,
    attack: 0.01,
    decay: 0.15,
    harmonicBoost: 2.2,
    noiseLevel: 0.04,
    characterBite: 'pulse',
  },
  whitty: {
    waveform: 'sawtooth',
    filterType: 'peaking',
    baseFreqMultiplier: 0.7,
    formants: [500, 1400],
    qFactor: 8.0,
    vibratoRate: 4.5,
    vibratoDepth: 12.0,
    attack: 0.01,
    decay: 0.45,
    harmonicBoost: 3.0,
    noiseLevel: 0.12,
    characterBite: 'distorted',
  },
  sans: {
    waveform: 'square',
    filterType: 'bandpass',
    baseFreqMultiplier: 0.65,
    formants: [450, 1100],
    qFactor: 6.0,
    vibratoRate: 0,
    vibratoDepth: 0,
    attack: 0.005,
    decay: 0.12,
    harmonicBoost: 1.5,
    noiseLevel: 0.02,
    characterBite: 'pulse',
  },
  sonicexe: {
    waveform: 'sawtooth',
    filterType: 'bandpass',
    baseFreqMultiplier: 0.8,
    formants: [350, 1600],
    qFactor: 7.0,
    vibratoRate: 11.0,
    vibratoDepth: 15.0,
    attack: 0.02,
    decay: 0.35,
    harmonicBoost: 2.8,
    noiseLevel: 0.09,
    characterBite: 'distorted',
  },
};

// Direction to base chromatic note mapping (Left, Down, Up, Right)
// In FNF, directions typically correspond to specific pitch steps
export const DIRECTION_NOTE_OFFSETS: Record<number, number> = {
  0: 0,  // Left: Base tonic note
  1: 3,  // Down: Minor third / fourth
  2: 7,  // Up: Fifth
  3: 10, // Right: Minor seventh / octave
};

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private instGain: GainNode | null = null;
  private voicesGain: GainNode | null = null;
  private isMuted: boolean = false;

  private currentBpm: number = 100;
  private backingInterval: number | null = null;
  private beatStep: number = 0;
  private isBackingPlaying: boolean = false;
  private onBeatCallback: ((beat: number) => void) | null = null;

  constructor() {
    // AudioContext will be initialized on user interaction
  }

  public init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.instGain = this.ctx.createGain();
      this.instGain.gain.setValueAtTime(0.75, this.ctx.currentTime);
      this.instGain.connect(this.masterGain);

      this.voicesGain = this.ctx.createGain();
      this.voicesGain.gain.setValueAtTime(0.9, this.ctx.currentTime);
      this.voicesGain.connect(this.masterGain);
    } catch (e) {
      console.warn('AudioContext failed to initialize', e);
    }
  }

  public resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setVolumes(master: number, inst: number, voices: number) {
    if (!this.ctx || !this.masterGain || !this.instGain || !this.voicesGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(master, now, 0.05);
    this.instGain.gain.setTargetAtTime(inst, now, 0.05);
    this.voicesGain.gain.setTargetAtTime(voices, now, 0.05);
  }

  public setOnBeat(cb: (beat: number) => void) {
    this.onBeatCallback = cb;
  }

  // Play authentic FNF character chromatic voice sound
  public playCharacterVoice(
    characterId: CharacterId,
    direction: number,
    pitchShiftSemitones: number = 0,
    durationMs: number = 220
  ) {
    this.resume();
    if (!this.ctx || !this.voicesGain) return;

    const config = CHARACTER_VOICE_CONFIGS[characterId] || CHARACTER_VOICE_CONFIGS.bf;
    const now = this.ctx.currentTime;
    const duration = Math.max(0.12, durationMs / 1000);

    // Calculate frequency
    // Standard middle C (C4 = 261.63Hz)
    const baseC4 = 261.63;
    const dirOffset = DIRECTION_NOTE_OFFSETS[direction] ?? 0;
    const totalSemitones = dirOffset + pitchShiftSemitones;
    const freq = baseC4 * Math.pow(2, totalSemitones / 12) * config.baseFreqMultiplier;

    // Primary vocal oscillator
    const osc1 = this.ctx.createOscillator();
    osc1.type = config.waveform;
    osc1.frequency.setValueAtTime(freq, now);

    // Subtle pitch bend at attack (characteristic of FNF singing)
    osc1.frequency.exponentialRampToValueAtTime(freq * 1.05, now + 0.02);
    osc1.frequency.exponentialRampToValueAtTime(freq, now + 0.06);

    // Sub/harmonic oscillator for rich body
    const osc2 = this.ctx.createOscillator();
    osc2.type = config.characterBite === 'organ' ? 'sine' : config.waveform;
    osc2.frequency.setValueAtTime(freq * (config.characterBite === 'organ' ? 0.5 : 2.0), now);

    // Vibrato LFO if character has it
    if (config.vibratoRate > 0) {
      const vibrato = this.ctx.createOscillator();
      const vibratoGain = this.ctx.createGain();
      vibrato.frequency.setValueAtTime(config.vibratoRate, now);
      vibratoGain.gain.setValueAtTime(config.vibratoDepth, now);
      vibrato.connect(vibratoGain);
      vibratoGain.connect(osc1.frequency);
      vibrato.start(now);
      vibrato.stop(now + duration + 0.1);
    }

    // Formant filter 1
    const filter1 = this.ctx.createBiquadFilter();
    filter1.type = config.filterType;
    filter1.frequency.setValueAtTime(config.formants[0], now);
    filter1.Q.setValueAtTime(config.qFactor, now);

    // Formant filter 2 for vocal resonance
    const filter2 = this.ctx.createBiquadFilter();
    filter2.type = 'peaking';
    filter2.frequency.setValueAtTime(config.formants[1], now);
    filter2.Q.setValueAtTime(config.qFactor * 0.8, now);
    filter2.gain.setValueAtTime(8, now);

    // Amp Envelope
    const ampGain = this.ctx.createGain();
    ampGain.gain.setValueAtTime(0.001, now);
    ampGain.gain.linearRampToValueAtTime(0.7 * config.harmonicBoost, now + config.attack);
    ampGain.gain.exponentialRampToValueAtTime(0.001, now + duration + config.decay);

    // Distortion wave shaper for Whitty or Sonic.EXE
    if (config.characterBite === 'distorted') {
      const distortion = this.ctx.createWaveShaper();
      (distortion as any).curve = this.makeDistortionCurve(30);
      distortion.oversample = '2x';
      filter2.connect(distortion);
      distortion.connect(ampGain);
    } else {
      filter2.connect(ampGain);
    }

    // Consonant noise burst (for snap / pronunciation)
    if (config.noiseLevel > 0) {
      this.playConsonantNoise(now, config.noiseLevel);
    }

    // Connect chain
    osc1.connect(filter1);
    osc2.connect(filter1);
    filter1.connect(filter2);
    ampGain.connect(this.voicesGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration + config.decay + 0.05);
    osc2.stop(now + duration + config.decay + 0.05);
  }

  // Audition a chromatic scale note
  public auditionNote(characterId: CharacterId, semitone: number) {
    this.resume();
    if (!this.ctx || !this.voicesGain) return;

    const config = CHARACTER_VOICE_CONFIGS[characterId] || CHARACTER_VOICE_CONFIGS.bf;
    const now = this.ctx.currentTime;
    const duration = 0.28;
    const freq = 261.63 * Math.pow(2, semitone / 12) * config.baseFreqMultiplier;

    const osc = this.ctx.createOscillator();
    osc.type = config.waveform;
    osc.frequency.setValueAtTime(freq, now);

    const filter = this.ctx.createBiquadFilter();
    filter.type = config.filterType;
    filter.frequency.setValueAtTime(config.formants[0], now);
    filter.Q.setValueAtTime(config.qFactor, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.65, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.voicesGain);

    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  // Play Miss Scratch sound
  public playMissSound() {
    this.resume();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.12);

    const noise = this.ctx.createBufferSource();
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.1, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);

    osc.connect(gain);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    noise.start(now);
    osc.stop(now + 0.15);
    noise.stop(now + 0.15);
  }

  // Play Hit Rating sound
  public playHitSound(rating: 'sick' | 'good' | 'bad' | 'shit') {
    this.resume();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    const pitch = rating === 'sick' ? 880 : rating === 'good' ? 660 : 440;
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(pitch * 1.4, now + 0.04);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.07);
  }

  // FNF Procedural Funk Instrumental Backing Engine
  public startBackingTrack(bpm: number, songKey: string = 'C_MINOR') {
    this.stopBackingTrack();
    this.resume();
    this.currentBpm = bpm;
    this.isBackingPlaying = true;
    this.beatStep = 0;

    // 16th note timing (4 steps per beat)
    const stepIntervalMs = (60 / bpm / 4) * 1000;

    this.backingInterval = window.setInterval(() => {
      this.playBackingStep(this.beatStep, songKey);
      if (this.beatStep % 4 === 0 && this.onBeatCallback) {
        this.onBeatCallback(Math.floor(this.beatStep / 4));
      }
      this.beatStep = (this.beatStep + 1) % 64; // 4-bar loop
    }, stepIntervalMs);
  }

  public stopBackingTrack() {
    if (this.backingInterval) {
      clearInterval(this.backingInterval);
      this.backingInterval = null;
    }
    this.isBackingPlaying = false;
    this.beatStep = 0;
  }

  private playBackingStep(step: number, key: string) {
    if (!this.ctx || !this.instGain) return;
    const now = this.ctx.currentTime;
    const beat16 = step % 16;

    // 1. Kick on 0, 8 (or funkin syncopations: 0, 6, 10)
    if (beat16 === 0 || beat16 === 6 || beat16 === 10) {
      this.playKick(now);
    }

    // 2. Snare on 4, 12 (standard 2 & 4 beat backbeat)
    if (beat16 === 4 || beat16 === 12) {
      this.playSnare(now);
    }

    // 3. Hi-hats on every 2 steps or 16ths
    if (beat16 % 2 === 0) {
      this.playHiHat(now, beat16 % 4 === 2);
    }

    // 4. Funky Synth Bassline
    const bassNotes = [65.4, 73.4, 77.8, 87.3, 98.0, 110.0]; // C2, D2, Eb2, F2, G2, A2
    if (beat16 === 0 || beat16 === 3 || beat16 === 6 || beat16 === 9 || beat16 === 12 || beat16 === 14) {
      const noteIdx = (Math.floor(step / 16) + (beat16 % 3)) % bassNotes.length;
      this.playBassSynth(now, bassNotes[noteIdx]);
    }

    // 5. Synth Chords on beat 0 and 8
    if (beat16 === 0 || beat16 === 8) {
      this.playChords(now, step);
    }
  }

  private playKick(now: number) {
    if (!this.ctx || !this.instGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.12);

    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(this.instGain);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  private playSnare(now: number) {
    if (!this.ctx || !this.instGain) return;

    // Tone body
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(210, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.08);

    const toneGain = this.ctx.createGain();
    toneGain.gain.setValueAtTime(0.35, now);
    toneGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    // Noise snap
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.15, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(1400, now);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.45, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(toneGain);
    toneGain.connect(this.instGain);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.instGain);

    osc.start(now);
    noise.start(now);
    osc.stop(now + 0.12);
    noise.stop(now + 0.18);
  }

  private playHiHat(now: number, isAccent: boolean) {
    if (!this.ctx || !this.instGain) return;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.05, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(7500, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(isAccent ? 0.28 : 0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isAccent ? 0.07 : 0.035));

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.instGain);

    noise.start(now);
    noise.stop(now + 0.08);
  }

  private playBassSynth(now: number, freq: number) {
    if (!this.ctx || !this.instGain) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, now);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, now);
    filter.frequency.exponentialRampToValueAtTime(180, now + 0.18);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.instGain);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  private playChords(now: number, step: number) {
    if (!this.ctx || !this.instGain) return;
    const bar = Math.floor(step / 16);
    // Cool minor progression (Cm -> Ab -> Fm -> G7)
    const chordSets = [
      [261.63, 311.13, 392.00], // Cm
      [207.65, 261.63, 311.13], // Ab
      [174.61, 207.65, 261.63], // Fm
      [196.00, 246.94, 293.66], // G
    ];
    const freqs = chordSets[bar % 4];

    freqs.forEach((f) => {
      if (!this.ctx || !this.instGain) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1100, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.instGain);

      osc.start(now);
      osc.stop(now + 0.4);
    });
  }

  private playConsonantNoise(now: number, level: number) {
    if (!this.ctx || !this.voicesGain) return;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.03, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2400, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(level * 0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.voicesGain);

    noise.start(now);
    noise.stop(now + 0.03);
  }

  private makeDistortionCurve(amount: number): Float32Array {
    const k = typeof amount === 'number' ? amount : 50;
    const nSamples = 44100;
    const curve = new Float32Array(nSamples);
    const deg = Math.PI / 180;
    for (let i = 0; i < nSamples; ++i) {
      const x = (i * 2) / nSamples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }
}

export const soundEngine = new SoundEngine();
