import { NormalizedEvent } from './ir';

/**
 * Only map events whose target IDs and value keys exist in the official V-Slice
 * event registry. Psych-only events are deliberately preserved as unsupported
 * instead of being emitted under invented event IDs that the game ignores.
 */
export interface EventMappingRule {
  targetEvent: string;
  supportStatus: 'supported' | 'mapped' | 'unsupported';
  description: string;
  transform: (val1: string, val2: string) => Record<string, any>;
  hscriptHint?: string;
}

const targetName = (value: string): string => {
  const v = value.trim().toLowerCase();
  if (v === '0' || v === 'dad' || v === 'opponent') return 'dad';
  if (v === '2' || v === 'gf' || v === 'girlfriend') return 'girlfriend';
  if (v === '1' || v === 'bf' || v === 'boyfriend' || v === 'player') return 'boyfriend';
  return value || 'boyfriend';
};

export const EVENT_REGISTRY: Record<string, EventMappingRule> = {
  'Camera Follow Pos': {
    targetEvent: 'FocusCamera',
    supportStatus: 'mapped',
    description: 'Maps Psych camera coordinates to V-Slice static camera focus',
    transform: (val1, val2) => {
      const x = Number(val1);
      const y = Number(val2);
      if (!val1.trim() || !val2.trim() || !Number.isFinite(x) || !Number.isFinite(y)) {
        return { char: -1 };
      }
      return { char: -1, x, y };
    },
  },
  'Play Animation': {
    targetEvent: 'PlayAnimation',
    supportStatus: 'mapped',
    description: 'Maps animation name and target to official V-Slice PlayAnimation fields',
    transform: (val1, val2) => ({ anim: val1, target: targetName(val2), force: true }),
  },
  'Hey!': {
    targetEvent: 'PlayAnimation',
    supportStatus: 'mapped',
    description: 'Maps the legacy Hey event to PlayAnimation; availability depends on target character animations',
    transform: (val1) => ({
      anim: 'hey',
      target: val1 === '1' ? 'girlfriend' : 'boyfriend',
      force: true,
    }),
  },
};

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
      parameters: rule.transform(val1 ?? '', val2 ?? ''),
      rawValues: [val1 ?? '', val2 ?? ''],
      supportStatus: rule.supportStatus,
      vSliceEquivalent: rule.targetEvent,
    };
  }

  // Keep the original event and values for diagnostics/manual porting. Do not
  // pretend that unsupported Psych events are executable V-Slice events.
  return {
    timeMs: Math.round(timeMs * 100) / 100,
    name,
    parameters: { val1: val1 ?? '', val2: val2 ?? '' },
    rawValues: [val1 ?? '', val2 ?? ''],
    supportStatus: 'unsupported',
  };
}
