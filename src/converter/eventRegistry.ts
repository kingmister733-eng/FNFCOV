import { NormalizedEvent } from './ir';

export interface EventMappingRule {
  targetEvent: string;
  supportStatus: 'supported' | 'mapped' | 'unsupported';
  description: string;
  transform: (val1: string, val2: string) => Record<string, any>;
  hscriptHint?: string;
}

export const EVENT_REGISTRY: Record<string, EventMappingRule> = {
  // Only map events whose target IDs and parameter schemas are verified against
  // the official V-Slice event definitions. Unknown events remain unsupported.
  'Camera Follow Pos': {
    targetEvent: 'FocusCamera',
    supportStatus: 'mapped',
    description: 'Maps numeric camera coordinates to the official FocusCamera event',
    transform: (val1, val2) => {
      const x = Number(val1);
      const y = Number(val2);
      if (val1.trim() !== '' && val2.trim() !== '' && Number.isFinite(x) && Number.isFinite(y)) {
        return { char: -1, x, y };
      }
      const isPlayer = val1 === '1' || val1.toLowerCase() === 'bf' || val1.toLowerCase() === 'boyfriend';
      return { char: isPlayer ? 1 : 0 };
    },
  },
  'Play Animation': {
    targetEvent: 'PlayAnimation',
    supportStatus: 'mapped',
    description: 'Maps animation name and character target to official PlayAnimation parameters',
    transform: (val1, val2) => ({
      anim: val1,
      target: val2 === '0' || val2.toLowerCase() === 'dad' || val2.toLowerCase() === 'opponent'
        ? 'opponent'
        : val2.toLowerCase() === 'gf' || val2.toLowerCase() === 'girlfriend'
          ? 'girlfriend'
          : 'player',
      force: true,
    }),
  },
  'Hey!': {
    targetEvent: 'PlayAnimation',
    supportStatus: 'mapped',
    description: 'Maps Psych Hey event to official PlayAnimation where a matching hey animation exists',
    transform: (val1) => ({
      anim: 'hey',
      target: val1 === '1' ? 'girlfriend' : 'player',
      force: true,
    }),
  },
}

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
