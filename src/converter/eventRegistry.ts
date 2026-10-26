import { NormalizedEvent } from './ir';

export interface EventMappingRule {
  targetEvent: string;
  supportStatus: 'supported' | 'mapped' | 'unsupported';
  description: string;
  transform: (val1: string, val2: string) => Record<string, any>;
  hscriptHint?: string;
}

export const EVENT_REGISTRY: Record<string, EventMappingRule> = {
  // This mapping is only called after the Psych target has been recognized.
  'Play Animation': {
    targetEvent: 'PlayAnimation',
    supportStatus: 'mapped',
    description: 'Maps Psych animation name and verified character target to official V-Slice PlayAnimation parameters',
    transform: (val1, val2) => ({
      anim: val1,
      target: val2,
      force: true,
    }),
  },
};

function unsupportedEvent(timeMs: number, name: string, val1: string, val2: string): NormalizedEvent {
  return {
    timeMs: Math.round(timeMs * 100) / 100,
    name,
    parameters: { val1, val2 },
    rawValues: [val1, val2],
    supportStatus: 'unsupported',
  };
}

/**
 * Resolves a Psych Engine event into a normalized V-Slice event.
 * Camera Follow Pos is a coordinate event, not a character selector. Empty
 * coordinates reset Psych's automatic follow and have no verified direct
 * V-Slice equivalent, so they must not be guessed into a FocusCamera target.
 */
export function mapPsychEvent(
  timeMs: number,
  name: string,
  val1: string,
  val2: string
): NormalizedEvent {
  if (name === 'Camera Follow Pos') {
    const x = Number(val1);
    const y = Number(val2);
    if (val1.trim() !== '' && val2.trim() !== '' && Number.isFinite(x) && Number.isFinite(y)) {
      return {
        timeMs: Math.round(timeMs * 100) / 100,
        name: 'FocusCamera',
        parameters: { char: -1, x, y },
        rawValues: [val1, val2],
        supportStatus: 'mapped',
        vSliceEquivalent: 'FocusCamera',
      };
    }
    return unsupportedEvent(timeMs, name, val1, val2);
  }

  if (name === 'Play Animation') {
    const rawTarget = val2.trim().toLowerCase();
    const target =
      rawTarget === '0' || rawTarget === 'dad' || rawTarget === 'opponent'
        ? 'opponent'
        : rawTarget === '1' || rawTarget === 'bf' || rawTarget === 'boyfriend' || rawTarget === 'player'
          ? 'player'
          : rawTarget === '2' || rawTarget === 'gf' || rawTarget === 'girlfriend'
            ? 'girlfriend'
            : undefined;

    if (!target) return unsupportedEvent(timeMs, name, val1, val2);

    const rule = EVENT_REGISTRY[name];
    return {
      timeMs: Math.round(timeMs * 100) / 100,
      name: rule.targetEvent,
      parameters: rule.transform(val1, target),
      rawValues: [val1, val2],
      supportStatus: rule.supportStatus,
      vSliceEquivalent: rule.targetEvent,
    };
  }

  // Psych's Hey! event may target BF, GF, or both and includes duration
  // semantics that are not equivalent to a single V-Slice PlayAnimation event.
  // Keep it unsupported rather than silently dropping half of its behavior.
  return unsupportedEvent(timeMs, name, val1, val2);
}
