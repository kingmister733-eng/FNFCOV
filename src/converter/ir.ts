/**
 * Intermediate Representation (IR) for FNF Mod Conversion
 * Provides a normalized internal representation between Psych Engine and V-Slice schemas.
 */

export interface SourceFileEntry {
  sourcePath: string;
  classifiedType:
    | 'chart'
    | 'events'
    | 'character'
    | 'stage'
    | 'week'
    | 'script'
    | 'audio'
    | 'image'
    | 'atlas'
    | 'font'
    | 'metadata'
    | 'other';
  detectedSchema?: string;
  targetSongId?: string;
  parsingResult: 'success' | 'repaired' | 'failed' | 'n/a';
  conversionResult: 'converted' | 'copied' | 'skipped' | 'failed' | 'merged';
  outputPath?: string;
  warnings: string[];
  errors: string[];
  reasonForSkipping?: string;
}

export type ConversionStatus =
  | 'Converted and validated'
  | 'Converted with warnings'
  | 'Partially converted'
  | 'Requires manual repair'
  | 'Failed validation';

export interface NormalizedMod {
  id: string;
  title: string;
  description: string;
  author: string;
  sourceEngine: 'psych' | 'vslice' | 'unknown';
  sourceVersion?: string;
  targetVersion: '0.4.x' | '0.8.x';
  songs: Map<string, NormalizedSong>;
  characters: Map<string, NormalizedCharacter>;
  stages: Map<string, NormalizedStage>;
  weeks: Map<string, NormalizedWeek>;
  scripts: Map<string, NormalizedScript>;
  assetFiles: Map<string, Uint8Array>;
  diagnostics: ConversionDiagnostic[];
  fileManifest: SourceFileEntry[];
  status: ConversionStatus;
}

export interface NormalizedSong {
  id: string;
  name: string;
  artist: string;
  charter: string;
  bpm: number;
  bpmDerived: boolean;
  bpmSource: 'chart' | 'section' | 'event' | 'sibling' | 'fallback-unverified';
  scrollSpeed: Record<string, number>; // difficulty -> speed
  timeChanges: NormalizedTimeChange[];
  notes: Record<string, NormalizedNote[]>; // difficulty -> notes
  events: NormalizedEvent[];
  characters: {
    player: string;
    girlfriend: string;
    opponent: string;
    instrumental?: string;
  };
  stage: string;
  difficulties: string[];
  rawSourceFiles: string[];
}

export interface NormalizedNote {
  timeMs: number;
  lane: number; // 0..3: Opponent, 4..7: Player, 8..11: Extra/GF
  sustainMs: number;
  noteType?: string;
  altAnim?: boolean;
}

export interface NormalizedTimeChange {
  timeMs: number;
  beat: number;
  bpm: number;
  numerator: number;
  denominator: number;
  beatTuple: number[];
}

export interface NormalizedEvent {
  timeMs: number;
  name: string;
  parameters: Record<string, any>;
  rawValues?: [string, string];
  supportStatus: 'supported' | 'mapped' | 'unsupported';
  vSliceEquivalent?: string;
}

export interface NormalizedAnimation {
  name: string;
  prefix: string;
  fps: number;
  loop: boolean;
  frameIndices?: number[];
  offsets: [number, number];
}

export interface NormalizedCharacter {
  id: string;
  name: string;
  assetPath: string;
  scale: number;
  singDuration: number;
  flipX: boolean;
  healthIcon: string;
  healthBarColor: string; // Hex format #RRGGBB
  positionOffsets: [number, number];
  cameraOffsets: [number, number];
  animations: NormalizedAnimation[];
  renderType: 'sparrow' | 'packer';
}

export interface NormalizedStage {
  id: string;
  name: string;
  defaultZoom: number;
  isPixel: boolean;
  cameraSpeed: number;
  characters: {
    boyfriend: { position: [number, number]; cameraOffsets: [number, number] };
    girlfriend: { position: [number, number]; cameraOffsets: [number, number]; hidden?: boolean };
    opponent: { position: [number, number]; cameraOffsets: [number, number] };
  };
  layers: NormalizedStageLayer[];
}

export interface NormalizedStageLayer {
  name: string;
  assetPath: string;
  position: [number, number];
  scrollFactor: [number, number];
  scale: [number, number];
  zIndex: number;
  animated: boolean;
}

export interface NormalizedWeek {
  id: string;
  name: string;
  songs: string[];
  difficulties: string[];
  characters: {
    opponent: string;
    player: string;
    girlfriend: string;
  };
  unlocked: boolean;
  hideStoryMode: boolean;
  hideFreeplay: boolean;
  order: number;
}

export interface NormalizedScript {
  path: string;
  name: string;
  sourceLanguage: 'lua' | 'hscript' | 'haxe';
  compatibility: 'automatic' | 'partial' | 'manual';
  detectedCallbacks: string[];
  detectedFunctions: string[];
  issues: string[];
  recommendedAction: string;
  generatedHScriptDraft?: string;
}

export interface ConversionDiagnostic {
  level: 'error' | 'warning' | 'info' | 'repair';
  category: 'chart' | 'character' | 'stage' | 'event' | 'script' | 'asset' | 'metadata';
  file?: string;
  message: string;
  details?: string;
  actionNeeded?: string;
}
