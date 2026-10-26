import { NormalizedEvent } from './ir';

export interface EventMappingRule {
  targetEvent: string;
  supportStatus: 'supported' | 'mapped' | 'unsupported';
  description: string;
  transform: (val1: string, val2: string) => Record<string, any>;
  hscriptHint?: string;
}

export const EVENT_REGISTRY: Record<string, EventMappingRule> = {
  'Camera Follow Pos': {
    targetEvent: 'FocusCamera',
    supportStatus: 'supported',
    description: 'Sets camera focus point or targets player (1) or opponent (0)',
    transform: (val1, val2) => {
      const isPlayer = val1 === '1' || val1.toLowerCase() === 'bf' || val1.toLowerCase() === 'boyfriend';
      const x = val1 && !isNaN(Number(val1)) ? Number(val1) : undefined;
      const y = val2 && !isNaN(Number(val2)) ? Number(val2) : undefined;
      if (x !== undefined && y !== undefined && val1 !== '0' && val1 !== '1') {
        return { x, y };
      }
      return { char: isPlayer ? 1 : 0 };
    },
  },
  'Set Cam Follow': {
    targetEvent: 'FocusCamera',
    supportStatus: 'supported',
    description: 'Focuses camera on specific character',
    transform: (val1) => ({
      char: val1 === '1' || val1.toLowerCase() === 'bf' ? 1 : 0,
    }),
  },
  'Add Camera Zoom': {
    targetEvent: 'ZoomCamera',
    supportStatus: 'supported',
    description: 'Adds an impulse zoom bump to the game camera',
    transform: (val1) => ({
      zoom: Number(val1) || 0.05,
    }),
  },
  'Set Cam Zoom': {
    targetEvent: 'ZoomCamera',
    supportStatus: 'supported',
    description: 'Changes base camera zoom level',
    transform: (val1) => ({
      zoom: Number(val1) || 1.0,
      mode: 'direct',
    }),
  },
  'Play Animation': {
    targetEvent: 'PlayAnimation',
    supportStatus: 'supported',
    description: 'Forces character to play animation prefix',
    transform: (val1, val2) => ({
      anim: val1,
      target: val2 === '0' || val2.toLowerCase() === 'dad' ? 'dad' : 'boyfriend',
    }),
  },
  'Hey!': {
    targetEvent: 'PlayAnimation',
    supportStatus: 'mapped',
    description: 'Triggers Hey cheer animation on boyfriend / girlfriend',
    transform: (val1) => ({
      anim: 'hey',
      target: val1 === '1' ? 'girlfriend' : 'boyfriend',
    }),
  },
  'Alt Idle Animation': {
    targetEvent: 'AltIdle',
    supportStatus: 'supported',
    description: 'Toggles alternative idle animation suffix (-alt)',
    transform: (val1, val2) => ({
      target: val1 === '0' || val1.toLowerCase() === 'dad' ? 'dad' : 'boyfriend',
      alt: val2 === '1' || val2.toLowerCase() === 'true' || val2.toLowerCase() === '-alt',
    }),
  },
  'Change Character': {
    targetEvent: 'ChangeCharacter',
    supportStatus: 'mapped',
    description: 'Swaps singer character mid-song',
    transform: (val1, val2) => ({
      target: val1 === '0' || val1.toLowerCase() === 'dad' ? 0 : 1,
      newCharacter: val2,
    }),
    hscriptHint: 'Use PlayState.instance.currentStage.getBoyfriend() / getDad() in HScript to swap character models.',
  },
  'Screen Shake': {
    targetEvent: 'ScreenShake',
    supportStatus: 'supported',
    description: 'Shakes the camera screen with duration and intensity',
    transform: (val1, val2) => {
      const parts = val1.split(',');
      const dur = parts[0] ? Number(parts[0]) : 0.5;
      const intensity = parts[1] ? Number(parts[1]) : (val2 ? Number(val2) : 0.05);
      return { duration: dur, intensity: intensity };
    },
  },
  'Change BPM': {
    targetEvent: 'ChangeBPM',
    supportStatus: 'supported',
    description: 'Changes active song BPM',
    transform: (val1) => ({
      bpm: Number(val1) || 100,
    }),
  },
  'Flash Camera': {
    targetEvent: 'CameraFlash',
    supportStatus: 'supported',
    description: 'Flashes camera white or specified color',
    transform: (val1, val2) => ({
      duration: Number(val1) || 0.5,
      color: val2 || '#ffffff',
    }),
  },
};

/**
 * Resolves a Psych Engine event into a normalized V-Slice event
 */
export function mapPsychEvent(
  timeMs: number,
  name: string,
  val1: string,
  val2: string
): NormalizedEvent {
  const rule = EVENT_REGISTRY[name];
  if (rule) {
    return {
      timeMs: Math.round(timeMs * 100) / 100,
      name: rule.targetEvent,
      parameters: rule.transform(val1, val2),
      rawValues: [val1, val2],
      supportStatus: rule.supportStatus,
      vSliceEquivalent: rule.targetEvent,
    };
  }

  // Unsupported or custom mod event
  return {
    timeMs: Math.round(timeMs * 100) / 100,
    name: name,
    parameters: { val1, val2 },
    rawValues: [val1, val2],
    supportStatus: 'unsupported',
  };
}
