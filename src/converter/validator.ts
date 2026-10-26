import { NormalizedMod, NormalizedSong, ConversionDiagnostic } from './ir';

export interface ValidationReport {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  repairedInvariants: string[];
}

export class Validator {
  /**
   * Validates a NormalizedMod and checks for missing assets or broken references
   */
  public static validateMod(mod: NormalizedMod): ValidationReport {
    const errors: string[] = [];
    const warnings: string[] = [];
    const repairedInvariants: string[] = [];

    if (mod.songs.size === 0 && mod.characters.size === 0) {
      errors.push('No valid songs or characters found in the source mod.');
    }

    // Check each song
    for (const [songId, song] of mod.songs) {
      // Validate BPM
      if (!song.bpm || song.bpm <= 0 || isNaN(song.bpm)) {
        errors.push(`Song "${song.name}" has invalid BPM (${song.bpm}).`);
      } else if (song.bpmSource === 'fallback-unverified') {
        warnings.push(`Song "${song.name}" uses an unverified fallback of 100 BPM. Requires manual repair.`);
      }

      // Check notes
      for (const [diff, notes] of Object.entries(song.notes)) {
        if (!Array.isArray(notes)) {
          errors.push(`Difficulty "${diff}" in "${song.name}" has invalid notes array.`);
          continue;
        }

        // Check note sorting
        let isSorted = true;
        for (let i = 1; i < notes.length; i++) {
          if (notes[i].timeMs < notes[i - 1].timeMs) {
            isSorted = false;
            break;
          }
        }
        if (!isSorted) {
          repairedInvariants.push(`Notes in "${song.name}" (${diff}) were out of order. Automatically sorted.`);
          notes.sort((a, b) => a.timeMs - b.timeMs);
        }

        // Check for negative sustains
        for (const n of notes) {
          if (n.sustainMs < 0) {
            n.sustainMs = 0;
            repairedInvariants.push(`Repaired negative sustain length in "${song.name}".`);
          }
        }
      }

      // Check referenced characters exist in mod or default game
      const defaultChars = ['bf', 'dad', 'gf', 'pico', 'mom', 'spooky', 'whitty', 'sans', 'monster', 'senpai', 'tankman', 'parents-christmas'];
      if (!defaultChars.includes(song.characters.player.toLowerCase()) && !mod.characters.has(song.characters.player.toLowerCase())) {
        warnings.push(`Song "${song.name}" references custom player character "${song.characters.player}" which was not found in characters/ folder.`);
      }
      if (!defaultChars.includes(song.characters.opponent.toLowerCase()) && !mod.characters.has(song.characters.opponent.toLowerCase())) {
        warnings.push(`Song "${song.name}" references custom opponent character "${song.characters.opponent}" which was not found in characters/ folder.`);
      }

      // Check audio for THIS song, not any unrelated song in the archive.
      const songKey = songId.toLowerCase().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
      const audioPaths = Array.from(mod.assetFiles.keys()).map((key) =>
        key.toLowerCase().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
      ).filter((key) => /\.(ogg|mp3|wav|mp4|m4a)$/i.test(key));
      const hasSongInst = audioPaths.some((key) => {
        const baseName = key.split('/').pop() || '';
        const isInstrumentalName = /^(inst|instrumental)(?:[-_.].*)?\.(ogg|mp3|wav|mp4|m4a)$/i.test(baseName);
        const isSongScoped = key.includes(`/songs/${songKey}/`) ||
          key.startsWith(`songs/${songKey}/`) ||
          key.includes(`/data/${songKey}/`) ||
          key.startsWith(`data/${songKey}/`) ||
          baseName.startsWith(`${songKey}-inst.`) ||
          baseName.startsWith(`${songKey}_inst.`);
        return isInstrumentalName && isSongScoped;
      });
      if (!hasSongInst) {
        warnings.push(`No song-specific instrumental track found for "${song.name}" (${songId}). Check the source mod's audio layout.`);
      }
    }

    // Check character asset references (PNG and XML)
    for (const [charId, char] of mod.characters) {
      const assetBase = char.assetPath.replace(/^characters\//i, '').replace(/\.(png|xml)$/i, '').replace(/^\/+|\/+$/g, '').toLowerCase();
      const assetPaths = Array.from(mod.assetFiles.keys()).map((key) =>
        key.toLowerCase().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
      );
      // Match the complete asset stem at a path boundary to avoid false positives.
      const hasPng = assetPaths.some((key) =>
        key === `characters/${assetBase}.png` ||
        key === `images/characters/${assetBase}.png` ||
        key.endsWith(`/${assetBase}.png`) ||
        key === `${assetBase}.png`
      );
      const hasXml = assetPaths.some((key) =>
        key === `characters/${assetBase}.xml` ||
        key === `images/characters/${assetBase}.xml` ||
        key.endsWith(`/${assetBase}.xml`) ||
        key === `${assetBase}.xml`
      );

      if (!hasPng) {
        warnings.push(`Character "${char.name}" references sprite image "${char.assetPath}.png" which is missing from mod assets.`);
      }
      if (!hasXml && char.renderType === 'sparrow') {
        warnings.push(`Character "${char.name}" is missing Sparrow XML sprite atlas "${char.assetPath}.xml".`);
      }
    }

    // Check script compatibility
    for (const [path, script] of mod.scripts) {
      if (script.compatibility === 'manual') {
        warnings.push(`Script "${script.name}" requires manual HScript adaptation (${script.issues.join('; ')}).`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      repairedInvariants,
    };
  }

  /**
   * Validates serialized V-Slice Chart JSON
   */
  public static validateVSliceChart(chartObj: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!chartObj || typeof chartObj !== 'object') {
      return { valid: false, errors: ['Chart JSON root is not an object.'] };
    }
    if (chartObj.version !== '2.0.0' && !chartObj.version?.startsWith('2.')) {
      errors.push(`V-Slice chart version should be "2.0.0", found "${chartObj.version}".`);
    }
    if (!chartObj.notes || typeof chartObj.notes !== 'object') {
      errors.push('Missing "notes" object in V-Slice chart.');
    }
    if (!Array.isArray(chartObj.events)) {
      errors.push('Missing "events" array in V-Slice chart.');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validates serialized V-Slice Metadata JSON
   */
  public static validateVSliceMetadata(metaObj: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!metaObj || typeof metaObj !== 'object') {
      return { valid: false, errors: ['Metadata JSON root is not an object.'] };
    }
    if (!metaObj.songName) {
      errors.push('Missing "songName" in V-Slice metadata.');
    }
    if (!metaObj.playData || typeof metaObj.playData !== 'object') {
      errors.push('Missing "playData" object in V-Slice metadata.');
    }
    if (!Array.isArray(metaObj.timeChanges) || metaObj.timeChanges.length === 0) {
      errors.push('Missing or empty "timeChanges" array in V-Slice metadata.');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
