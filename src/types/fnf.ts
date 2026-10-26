export type NoteDirection = 0 | 1 | 2 | 3; // 0: Left, 1: Down, 2: Up, 3: Right

export interface Note {
  id: string;
  time: number; // millisecond timestamp in the song
  direction: NoteDirection;
  isPlayer: boolean; // true = Player (BF side), false = Opponent (Dad side)
  length?: number; // sustain length in ms (0 = tap note)
  hit?: boolean;
  missed?: boolean;
}

export type HitRating = 'sick' | 'good' | 'bad' | 'shit' | 'miss';

export type CharacterId =
  | 'bf'
  | 'dad'
  | 'pico'
  | 'mom'
  | 'spooky'
  | 'whitty'
  | 'sans'
  | 'sonicexe';

export interface CharacterVoiceConfig {
  waveform: OscillatorType;
  filterType: BiquadFilterType;
  baseFreqMultiplier: number;
  formants: [number, number]; // [formant1, formant2] resonant frequencies
  qFactor: number;
  vibratoRate: number;
  vibratoDepth: number;
  attack: number;
  decay: number;
  harmonicBoost: number;
  noiseLevel: number;
  characterBite: 'sine' | 'saw' | 'pulse' | 'distorted' | 'organ';
}

export interface CharacterInfo {
  id: CharacterId;
  name: string;
  subtitle: string;
  color: string; // Hex for arrows/glow
  healthColor: string; // Color for healthbar
  badgeBg: string;
  avatarEmoji: string;
  iconSrc: string;
  description: string;
  voiceStyle: string;
  voiceConfig: CharacterVoiceConfig;
  defaultPitchShift: number; // Semitones
}

export interface SongData {
  id: string;
  name: string;
  composer: string;
  bpm: number;
  defaultSpeed: number; // Scroll speed
  defaultPlayer: CharacterId;
  defaultOpponent: CharacterId;
  difficulty: 'Easy' | 'Normal' | 'Hard' | 'Erect';
  genre: string;
  durationMs: number;
  notes: Note[];
}

export interface CoverPreset {
  id: string;
  title: string;
  songId: string;
  player: CharacterId;
  opponent: CharacterId;
  playerPitchShift: number;
  opponentPitchShift: number;
  speedMultiplier: number;
  tag: string;
}

export interface GameSettings {
  downscroll: boolean;
  botplay: boolean;
  keybinds: {
    left: string;
    down: string;
    up: string;
    right: string;
  };
  scrollSpeed: number;
  audioOffsetMs: number;
  masterVolume: number;
  instVolume: number;
  voicesVolume: number;
  showHitStats: boolean;
}

export interface GameState {
  score: number;
  combo: number;
  maxCombo: number;
  health: number; // 0 to 100 (50 is neutral, 0 is loss, 100 is win)
  ratingCounts: {
    sick: number;
    good: number;
    bad: number;
    shit: number;
    miss: number;
  };
  totalHits: number;
  accuracy: number;
}
