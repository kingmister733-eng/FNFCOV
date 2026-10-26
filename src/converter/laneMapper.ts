/**
 * Dedicated Psych Engine to V-Slice Lane & Direction Mapper
 *
 * Implements authoritative note lane translation rules between
 * Psych Engine section-based charting and Friday Night Funkin' V-Slice 0.8.x.
 */

export interface LaneMappingResult {
  lane: number; // V-Slice target lane index (0..3: Opponent, 4..7: Player, 8..11: Extra/GF)
  direction: 0 | 1 | 2 | 3; // 0=Left, 1=Down, 2=Up, 3=Right
  targetSide: 'opponent' | 'player' | 'extra';
  isThirdStrumline: boolean;
  warning?: string;
}

/**
 * Maps a Psych Engine raw lane/direction index to official V-Slice lane index.
 *
 * In Psych Engine:
 * Each section has a boolean `mustHitSection`.
 * When `mustHitSection === false` (Opponent camera / section focus):
 *   - Lanes 0..3: Opponent notes (Left, Down, Up, Right)
 *   - Lanes 4..7: Player / Boyfriend notes (Left, Down, Up, Right)
 *   - Lanes 8..11: Extra strumline / Girlfriend notes
 *
 * When `mustHitSection === true` (Player camera / section focus):
 *   - Lanes 0..3: Player / Boyfriend notes (Left, Down, Up, Right)
 *   - Lanes 4..7: Opponent notes (Left, Down, Up, Right)
 *   - Lanes 8..11: Extra strumline / Girlfriend notes
 *
 * In V-Slice Target Schema (v2.0.0):
 *   - Lanes 0..3: Opponent strumline (0=Left, 1=Down, 2=Up, 3=Right)
 *   - Lanes 4..7: Player / Boyfriend strumline (4=Left, 5=Down, 6=Up, 7=Right)
 *   - Lanes 8..11: Third strumline / Girlfriend (8=Left, 9=Down, 10=Up, 11=Right)
 */
export function mapPsychLaneToVSlice(sourceLane: number, mustHitSection: boolean): LaneMappingResult {
  const direction = (Math.abs(Math.floor(sourceLane)) % 4) as 0 | 1 | 2 | 3;
  let warning: string | undefined;

  if (sourceLane < 0) {
    warning = `Negative lane index ${sourceLane} detected; clamped to direction ${direction}.`;
  }

  // Strumline 1 & 2: Primary lanes (0..7)
  if (sourceLane >= 0 && sourceLane < 4) {
    if (mustHitSection) {
      // Psych 0..3 in mustHitSection=true is PLAYER
      return {
        lane: 4 + direction,
        direction,
        targetSide: 'player',
        isThirdStrumline: false,
      };
    } else {
      // Psych 0..3 in mustHitSection=false is OPPONENT
      return {
        lane: direction,
        direction,
        targetSide: 'opponent',
        isThirdStrumline: false,
      };
    }
  }

  if (sourceLane >= 4 && sourceLane < 8) {
    if (mustHitSection) {
      // Psych 4..7 in mustHitSection=true is OPPONENT
      return {
        lane: direction,
        direction,
        targetSide: 'opponent',
        isThirdStrumline: false,
      };
    } else {
      // Psych 4..7 in mustHitSection=false is PLAYER
      return {
        lane: 4 + direction,
        direction,
        targetSide: 'player',
        isThirdStrumline: false,
      };
    }
  }

  // Strumline 3: Girlfriend / Extra lanes (8..11)
  if (sourceLane >= 8 && sourceLane < 12) {
    return {
      lane: 8 + direction,
      direction,
      targetSide: 'extra',
      isThirdStrumline: true,
    };
  }

  // Out of range (> 11) - extra characters or extended multi-strumline charts
  warning = `Extended lane index ${sourceLane} is beyond standard 12-lane support; mapped to extra strumline ${8 + direction}.`;
  return {
    lane: 8 + direction,
    direction,
    targetSide: 'extra',
    isThirdStrumline: true,
    warning,
  };
}
