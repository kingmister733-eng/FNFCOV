import {
  NormalizedSong,
  NormalizedNote,
  NormalizedTimeChange,
  NormalizedCharacter,
  NormalizedStage,
  NormalizedWeek,
  NormalizedEvent,
  ConversionDiagnostic,
} from './ir';
import { mapPsychEvent } from './eventRegistry';
import { mapPsychLaneToVSlice } from './laneMapper';

export class SchemaParser {
  /**
   * Safely parses JSON with line/column contextual error reporting
   */
  public static safeParseJson(jsonString: string, contextFileName: string = 'JSON'): { data?: any; error?: string } {
    if (!jsonString || typeof jsonString !== 'string') {
      return { error: `${contextFileName} is empty or undefined.` };
    }
    try {
      return { data: JSON.parse(jsonString) };
    } catch (err: any) {
      const match = err.message.match(/position (\d+)/);
      let lineInfo = '';
      if (match && match[1]) {
        const pos = parseInt(match[1], 10);
        const upToPos = jsonString.slice(0, pos);
        const line = upToPos.split('\n').length;
        const col = pos - upToPos.lastIndexOf('\n');
        lineInfo = ` at line ${line}, column ${col}`;
      }
      return { error: `Syntax error in ${contextFileName}${lineInfo}: ${err.message}` };
    }
  }

  /**
   * Deterministically derives song name and ID using the strict fallback hierarchy
   */
  /**
   * Deterministically derives song name and ID using the strict fallback hierarchy.
   * Avoids collapsing different songs into generic names like "Unknown Song" or "Song".
   */
  public static deriveSongIdentifier(
    songData: any,
    filePath?: string
  ): { songName: string; songId: string; source: string } {
    const GENERIC_NAMES = new Set([
      'unknown',
      'unknown song',
      'song',
      'song name',
      'test',
      'untitled',
      'new song',
      'chart',
      'custom song',
      'hard',
      'normal',
      'easy',
      'erect',
      'nightmare',
    ]);

    // Helper to format clean display title from slug/id
    const formatDisplayTitle = (raw: string): string => {
      return raw
        .split(/[-_ ]+/)
        .filter((w) => w.length > 0)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    };

    // Candidate 1: Chart explicit song property
    let explicitName: string | undefined;
    if (songData && typeof songData.song === 'string' && songData.song.trim().length > 0) {
      explicitName = songData.song.trim();
    } else if (songData && typeof songData.songName === 'string' && songData.songName.trim().length > 0) {
      explicitName = songData.songName.trim();
    } else if (songData && typeof songData.songId === 'string' && songData.songId.trim().length > 0) {
      explicitName = songData.songId.trim();
    }

    // Candidate 2: Derive from file path and directory structure
    let pathCandidate: string | undefined;
    let pathSource = 'file_path';

    if (filePath) {
      const cleanPath = filePath.replace(/\\/g, '/');
      const segments = cleanPath.split('/').filter((s) => s.length > 0);
      const fileName = segments[segments.length - 1] || '';
      const parentDir = segments.length > 1 ? segments[segments.length - 2] : '';

      // Strip difficulty suffix from filename
      // e.g. "niceboy-hard.json" -> "niceboy", "dadbattle-easy.json" -> "dadbattle"
      const baseName = fileName
        .replace(/\.json$/i, '')
        .replace(/-(?:easy|normal|hard|erect|nightmare|pico|bf|alt)$/i, '');

      const isBaseGeneric = GENERIC_NAMES.has(baseName.toLowerCase());

      // If parent dir is a specific song directory (not generic mod root containers)
      const nonSongDirs = new Set([
        'data',
        'songs',
        'mods',
        'assets',
        'shared',
        'preload',
        'source',
        'songpack',
        'songpacks',
        'fancharts',
        'custom_chars',
      ]);

      const isParentNonSong = !parentDir || nonSongDirs.has(parentDir.toLowerCase());

      if (!isParentNonSong && !GENERIC_NAMES.has(parentDir.toLowerCase())) {
        // e.g. data/niceboy/hard.json -> parentDir "niceboy" is authoritative song dir
        pathCandidate = parentDir;
        pathSource = 'parent_directory';
      } else if (!isBaseGeneric && baseName.length > 0) {
        // e.g. niceboy-hard.json -> baseName "niceboy"
        pathCandidate = baseName;
        pathSource = 'chart_filename';
      } else if (parentDir && !GENERIC_NAMES.has(parentDir.toLowerCase())) {
        pathCandidate = parentDir;
        pathSource = 'parent_directory';
      }
    }

    // Decision Logic:
    // If explicitName is valid and not a generic placeholder, use it
    if (explicitName && !GENERIC_NAMES.has(explicitName.toLowerCase())) {
      const cleanId = explicitName.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-');
      return {
        songName: explicitName,
        songId: cleanId,
        source: 'chart.song',
      };
    }

    // If explicitName was generic but we have a valid path candidate, use path candidate!
    if (pathCandidate && !GENERIC_NAMES.has(pathCandidate.toLowerCase())) {
      const cleanId = pathCandidate.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-');
      return {
        songName: formatDisplayTitle(pathCandidate),
        songId: cleanId,
        source: pathSource,
      };
    }

    // If explicitName is present even if somewhat generic, use it before blind fallback
    if (explicitName && explicitName.length > 0) {
      const cleanId = explicitName.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-');
      return {
        songName: explicitName,
        songId: cleanId,
        source: 'chart.song_fallback',
      };
    }

    // Fallback: derive unique identifier from filename if possible
    if (filePath) {
      const rawFile = filePath.split('/').pop()?.replace(/\.json$/i, '') || 'song';
      const cleanId = rawFile.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      return {
        songName: formatDisplayTitle(rawFile),
        songId: cleanId,
        source: 'file_fallback',
      };
    }

    return {
      songName: 'Unidentified Song',
      songId: 'unidentified-song',
      source: 'unresolved',
    };
  }

  /**
   * Recovers base BPM using verified source data rules with full fallback hierarchy
   */
  public static recoverBaseBpm(
    songData: any,
    songName: string,
    rootData?: any,
    siblingBpm?: number
  ): { bpm: number; derived: boolean; source: 'chart' | 'section' | 'event' | 'sibling' | 'fallback-unverified'; diagnostic?: ConversionDiagnostic } {
    // 1. Root song-level BPM in songData
    const rootBpm = Number(songData?.bpm);
    if (rootBpm && isFinite(rootBpm) && rootBpm > 0) {
      return { bpm: rootBpm, derived: false, source: 'chart' };
    }

    // 2. Root BPM in outer JSON object (legacy Psych/FNF)
    const outerBpm = Number(rootData?.bpm);
    if (outerBpm && isFinite(outerBpm) && outerBpm > 0) {
      return {
        bpm: outerBpm,
        derived: true,
        source: 'chart',
        diagnostic: {
          level: 'info',
          category: 'chart',
          message: `Base BPM was recovered from root JSON object (${outerBpm} BPM) for "${songName}".`,
        },
      };
    }

    // 3. Alternative BPM field names (initialBPM, startBPM)
    const altBpm = Number(songData?.initialBPM || songData?.startBPM || rootData?.initialBPM);
    if (altBpm && isFinite(altBpm) && altBpm > 0) {
      return {
        bpm: altBpm,
        derived: true,
        source: 'chart',
        diagnostic: {
          level: 'info',
          category: 'chart',
          message: `Base BPM was recovered from initialBPM property (${altBpm} BPM) for "${songName}".`,
        },
      };
    }

    // 4. Section 0 BPM
    const rawSections = Array.isArray(songData?.notes) ? songData.notes : [];
    if (rawSections.length > 0 && rawSections[0]) {
      const s0Bpm = Number(rawSections[0].bpm);
      if (s0Bpm && isFinite(s0Bpm) && s0Bpm > 0) {
        return {
          bpm: s0Bpm,
          derived: true,
          source: 'section',
          diagnostic: {
            level: 'info',
            category: 'chart',
            message: `Base BPM was recovered from section 0 (${s0Bpm} BPM) for "${songName}".`,
          },
        };
      }
    }

    // 5. Scan subsequent sections for any specified BPM
    for (let i = 1; i < rawSections.length; i++) {
      const sec = rawSections[i];
      if (sec && sec.bpm && Number(sec.bpm) > 0) {
        const foundBpm = Number(sec.bpm);
        return {
          bpm: foundBpm,
          derived: true,
          source: 'section',
          diagnostic: {
            level: 'info',
            category: 'chart',
            message: `Base BPM was recovered from section ${i} (${foundBpm} BPM) for "${songName}".`,
          },
        };
      }
    }

    // 6. Scan chart events for earliest "Change BPM" event
    if (Array.isArray(songData?.events)) {
      for (const rawEvt of songData.events) {
        if (Array.isArray(rawEvt) && Array.isArray(rawEvt[1])) {
          for (const sub of rawEvt[1]) {
            if (Array.isArray(sub) && sub[0] === 'Change BPM') {
              const bpmVal = Number(sub[1]);
              if (bpmVal && isFinite(bpmVal) && bpmVal > 0) {
                return {
                  bpm: bpmVal,
                  derived: true,
                  source: 'event',
                  diagnostic: {
                    level: 'info',
                    category: 'chart',
                    message: `Base BPM was recovered from "Change BPM" event (${bpmVal} BPM) for "${songName}".`,
                  },
                };
              }
            }
          }
        }
      }
    }

    // 7. Inherit verified BPM from sibling difficulty of the same song if available
    if (siblingBpm && isFinite(siblingBpm) && siblingBpm > 0) {
      return {
        bpm: siblingBpm,
        derived: true,
        source: 'sibling',
        diagnostic: {
          level: 'info',
          category: 'chart',
          message: `Base BPM (${siblingBpm} BPM) was inherited from another difficulty of "${songName}".`,
        },
      };
    }

    // 8. Unrecoverable fallback (explicitly marked as unverified!)
    return {
      bpm: 100,
      derived: false,
      source: 'fallback-unverified',
      diagnostic: {
        level: 'warning',
        category: 'chart',
        message: `BPM could not be found or derived from chart or events for "${songName}". A fallback of 100 BPM was assigned and marked as unverified.`,
        actionNeeded: 'Verify and set the song BPM in the generated metadata.json.',
      },
    };
  }

  /**
   * Parses a Psych Engine chart into a NormalizedSong IR object
   */
  public static parsePsychChart(
    chartJson: string,
    difficulty: string = 'normal',
    filePath?: string,
    siblingBpm?: number
  ): { song?: NormalizedSong; diagnostics: ConversionDiagnostic[] } {
    const diagnostics: ConversionDiagnostic[] = [];

    const parseRes = this.safeParseJson(chartJson, filePath || `chart-${difficulty}`);
    if (parseRes.error || !parseRes.data) {
      diagnostics.push({
        level: 'error',
        category: 'chart',
        file: filePath,
        message: parseRes.error || 'Failed to parse chart JSON',
        details: parseRes.error,
      });
      return { diagnostics };
    }

    const root = parseRes.data;
    let songData: any;
    if (root.song && typeof root.song === 'object') {
      songData = root.song;
    } else if (typeof root === 'object') {
      songData = root;
    }

    if (!songData || typeof songData !== 'object') {
      diagnostics.push({
        level: 'error',
        category: 'chart',
        file: filePath,
        message: `Invalid Psych Engine chart structure: Missing root "song" object in ${filePath || 'chart'}.`,
      });
      return { diagnostics };
    }

    // 1. Identify song deterministically
    const idResult = this.deriveSongIdentifier(songData, filePath);
    const songId = idResult.songId;
    const songName = idResult.songName;

    if (idResult.source === 'unresolved') {
      diagnostics.push({
        level: 'warning',
        category: 'chart',
        file: filePath,
        message: `Song name could not be determined from chart properties or file path "${filePath}". Assigned temporary ID "${songId}".`,
      });
    }

    // 2. Recover base BPM using root data and sibling BPM if present
    const bpmResult = this.recoverBaseBpm(songData, songName, root, siblingBpm);
    const baseBpm = bpmResult.bpm;
    if (bpmResult.diagnostic) {
      diagnostics.push(bpmResult.diagnostic);
    }

    const speed = Number(songData.speed) || 1.6;
    const player = songData.player1 || 'bf';
    const opponent = songData.player2 || 'dad';
    const girlfriend = songData.gfVersion || songData.player3 || 'gf';
    const stage = songData.stage || 'stage';

    // 3. Parse Sections, BPM changes, and Notes
    const rawSections = Array.isArray(songData.notes) ? songData.notes : [];
    const notes: NormalizedNote[] = [];
    const timeChanges: NormalizedTimeChange[] = [
      {
        timeMs: 0,
        beat: 0,
        bpm: baseBpm,
        numerator: 4,
        denominator: 4,
        beatTuple: [4, 4, 4, 4],
      },
    ];

    let currentBpm = baseBpm;
    let accumulatedTimeMs = 0;
    let accumulatedBeats = 0;

    for (let sIdx = 0; sIdx < rawSections.length; sIdx++) {
      const section = rawSections[sIdx];
      if (!section) continue;

      const lengthInSteps = Number(section.lengthInSteps) || 16;
      const sectionBeats = lengthInSteps / 4;

      // Check section-level BPM change
      if (section.changeBPM && section.bpm && section.bpm > 0 && section.bpm !== currentBpm) {
        currentBpm = Number(section.bpm);
        timeChanges.push({
          timeMs: Math.round(accumulatedTimeMs * 100) / 100,
          beat: Math.round(accumulatedBeats * 100) / 100,
          bpm: currentBpm,
          numerator: 4,
          denominator: 4,
          beatTuple: [4, 4, 4, 4],
        });
        diagnostics.push({
          level: 'info',
          category: 'chart',
          message: `Detected section BPM change to ${currentBpm} at measure ${sIdx + 1} (${Math.round(accumulatedTimeMs)}ms) in "${songName}".`,
        });
      }

      const mustHitSection = Boolean(section.mustHitSection);
      const isAltSection = Boolean(section.altAnim);

      if (Array.isArray(section.sectionNotes)) {
        for (const rawNote of section.sectionNotes) {
          if (!Array.isArray(rawNote) || rawNote.length < 2) continue;

          const time = Number(rawNote[0]);
          const rawDir = Number(rawNote[1]);
          let sustain = Number(rawNote[2]) || 0;
          const noteType = rawNote[3] !== undefined ? String(rawNote[3]).trim() : undefined;

          if (isNaN(time) || isNaN(rawDir)) {
            diagnostics.push({
              level: 'warning',
              category: 'chart',
              message: `Ignored corrupted note with NaN values at section ${sIdx + 1} in "${songName}".`,
            });
            continue;
          }

          if (sustain < 0) {
            diagnostics.push({
              level: 'repair',
              category: 'chart',
              message: `Repaired negative sustain length (${sustain}ms) at ${time}ms to 0 in "${songName}".`,
            });
            sustain = 0;
          }

          // Authoritative Lane Mapping via dedicated mapper
          const laneMapping = mapPsychLaneToVSlice(rawDir, mustHitSection);
          const vSliceLane = laneMapping.lane;
          if (laneMapping.warning) {
            diagnostics.push({
              level: 'warning',
              category: 'chart',
              message: `${laneMapping.warning} (section ${sIdx + 1}, time ${time}ms in "${songName}")`,
            });
          }

          const hasAltAnim = isAltSection || (noteType ? noteType.toLowerCase().includes('alt') : false);

          notes.push({
            timeMs: Math.round(time * 100) / 100,
            lane: vSliceLane,
            sustainMs: Math.round(sustain * 100) / 100,
            noteType: noteType && noteType !== '' ? noteType : undefined,
            altAnim: hasAltAnim || undefined,
          });
        }
      }

      const beatDurationMs = (60 / currentBpm) * 1000;
      const sectionDurationMs = sectionBeats * beatDurationMs;
      accumulatedTimeMs += sectionDurationMs;
      accumulatedBeats += sectionBeats;
    }

    notes.sort((a, b) => a.timeMs - b.timeMs);

    // Deduplicate notes that land on the exact same millisecond and lane
    const uniqueNotes: NormalizedNote[] = [];
    let duplicates = 0;
    for (const note of notes) {
      const prev = uniqueNotes[uniqueNotes.length - 1];
      if (prev && Math.abs(prev.timeMs - note.timeMs) < 1.5 && prev.lane === note.lane) {
        duplicates++;
        continue;
      }
      uniqueNotes.push(note);
    }
    if (duplicates > 0) {
      diagnostics.push({
        level: 'repair',
        category: 'chart',
        message: `Removed ${duplicates} duplicate overlapping notes on the same millisecond and lane in "${songName}".`,
      });
    }

    // Note types are engine-specific identifiers. Keep their names, but warn
    // because a matching V-Slice NoteKind must exist for their behavior to work.
    const customNoteTypes = Array.from(new Set(uniqueNotes.map((note) => note.noteType).filter((type): type is string => Boolean(type))));
    if (customNoteTypes.length > 0) {
      diagnostics.push({
        level: 'warning',
        category: 'chart',
        file: filePath,
        message: `Psych note types were found: ${customNoteTypes.join(', ')}. Their names are preserved, but Psych note-type behavior is not converted automatically.`,
        actionNeeded: 'Verify each note kind exists in V-Slice or implement an equivalent V-Slice NoteKind/script.',
      });
    }

    const untypedAltNotes = uniqueNotes.filter((note) => note.altAnim && !note.noteType).length;
    if (untypedAltNotes > 0) {
      diagnostics.push({
        level: 'warning',
        category: 'chart',
        file: filePath,
        message: `${untypedAltNotes} note(s) rely on Psych section Alt Animation flags, which have no direct field in the serialized V-Slice chart.`,
        actionNeeded: 'Map these notes to a verified V-Slice note kind or script before treating the chart as fully converted.',
      });
    }

    // 4. Embedded Events processing
    const rawEvents: any[] = Array.isArray(songData.events) ? songData.events : [];
    const events: NormalizedEvent[] = rawEvents
      .flatMap((rawEvt: any) => {
        if (!Array.isArray(rawEvt) || rawEvt.length < 2) return [];
        const time = Number(rawEvt[0]);
        const subEvents = Array.isArray(rawEvt[1]) ? rawEvt[1] : [];
        return subEvents.map((sub: any) => {
          const name = String(sub[0] || 'Unknown');
          const val1 = sub[1] !== undefined ? String(sub[1]) : '';
          const val2 = sub[2] !== undefined ? String(sub[2]) : '';
          return mapPsychEvent(time, name, val1, val2);
        });
      })
      .sort((a, b) => a.timeMs - b.timeMs);

    const unsupportedEvents = events.filter((event) => event.supportStatus === 'unsupported');
    if (unsupportedEvents.length > 0) {
      const unsupportedNames = Array.from(new Set(unsupportedEvents.map((event) => event.name)));
      diagnostics.push({
        level: 'warning',
        category: 'event',
        file: filePath,
        message: `${unsupportedEvents.length} event instance(s) have no verified V-Slice equivalent: ${unsupportedNames.join(', ')}.`,
        actionNeeded: 'Review the conversion report and implement or replace unsupported events in V-Slice before expecting identical gameplay.',
      });
    }

    const song: NormalizedSong = {
      id: songId,
      name: songName,
      artist: songData.artist || 'Kawai Sprite',
      charter: songData.charter || 'Psych Engine Import',
      bpm: baseBpm,
      bpmDerived: bpmResult.derived,
      bpmSource: bpmResult.source,
      scrollSpeed: {
        [difficulty.toLowerCase()]: speed,
      },
      timeChanges,
      notes: {
        [difficulty.toLowerCase()]: uniqueNotes,
      },
      events,
      characters: {
        player,
        opponent,
        girlfriend,
      },
      stage,
      difficulties: [difficulty.toLowerCase()],
      rawSourceFiles: filePath ? [filePath] : [],
    };

    return { song, diagnostics };
  }

  /**
   * Parses a dedicated Psych Engine events.json file for a specific song
   */
  public static parsePsychEvents(
    eventsJson: string,
    songId: string,
    filePath?: string
  ): { events: NormalizedEvent[]; diagnostics: ConversionDiagnostic[] } {
    const diagnostics: ConversionDiagnostic[] = [];
    const parseRes = this.safeParseJson(eventsJson, filePath || 'events.json');

    if (parseRes.error || !parseRes.data) {
      diagnostics.push({
        level: 'error',
        category: 'event',
        file: filePath,
        message: parseRes.error || 'Failed to parse events.json',
      });
      return { events: [], diagnostics };
    }

    const data = parseRes.data;
    const rawEvents = Array.isArray(data.events) ? data.events : [];
    const events: NormalizedEvent[] = [];

    for (const rawEvt of rawEvents) {
      if (!Array.isArray(rawEvt) || rawEvt.length < 2) continue;
      const time = Number(rawEvt[0]);
      const subEvents = Array.isArray(rawEvt[1]) ? rawEvt[1] : [];

      for (const sub of subEvents) {
        if (!Array.isArray(sub) || sub.length < 1) continue;
        const name = String(sub[0] || 'Unknown');
        const val1 = sub[1] !== undefined ? String(sub[1]) : '';
        const val2 = sub[2] !== undefined ? String(sub[2]) : '';
        events.push(mapPsychEvent(time, name, val1, val2));
      }
    }

    events.sort((a, b) => a.timeMs - b.timeMs);
    const unsupportedEvents = events.filter((event) => event.supportStatus === 'unsupported');
    if (unsupportedEvents.length > 0) {
      const unsupportedNames = Array.from(new Set(unsupportedEvents.map((event) => event.name)));
      diagnostics.push({
        level: 'warning',
        category: 'event',
        file: filePath,
        message: `${unsupportedEvents.length} standalone event instance(s) have no verified V-Slice equivalent: ${unsupportedNames.join(', ')}.`,
        actionNeeded: 'Review the conversion report and implement or replace unsupported events in V-Slice before expecting identical gameplay.',
      });
    }
    diagnostics.push({
      level: 'info',
      category: 'event',
      file: filePath,
      message: `Parsed ${events.length} standalone events from "${filePath || 'events.json'}" for song "${songId}".`,
    });

    return { events, diagnostics };
  }

  /**
   * Parses a Psych Engine Character JSON
   */
  public static parsePsychCharacter(
    charJson: string,
    charId: string,
    filePath?: string
  ): { character?: NormalizedCharacter; diagnostics: ConversionDiagnostic[] } {
    const diagnostics: ConversionDiagnostic[] = [];
    const parseRes = this.safeParseJson(charJson, filePath || `character-${charId}`);
    if (parseRes.error || !parseRes.data) {
      diagnostics.push({
        level: 'error',
        category: 'character',
        file: filePath,
        message: parseRes.error || 'Failed to parse character JSON',
      });
      return { diagnostics };
    }

    const data = parseRes.data;

    let hexColor = '#31b0d5';
    if (Array.isArray(data.healthbar_colors) && data.healthbar_colors.length >= 3) {
      const [r, g, b] = data.healthbar_colors;
      hexColor = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    }

    const animations = Array.isArray(data.animations)
      ? data.animations.map((a: any) => ({
          name: a.anim || 'idle',
          prefix: a.name || a.anim || 'idle',
          fps: Number(a.fps) || 24,
          loop: Boolean(a.loop),
          frameIndices: Array.isArray(a.indices) && a.indices.length > 0 ? a.indices : undefined,
          offsets:
            Array.isArray(a.offsets) && a.offsets.length >= 2
              ? ([Number(a.offsets[0]), Number(a.offsets[1])] as [number, number])
              : ([0, 0] as [number, number]),
        }))
      : [];

    const character: NormalizedCharacter = {
      id: charId,
      name: data.name || charId,
      assetPath: data.image ? data.image.replace(/^characters\//, '') : charId,
      scale: Number(data.scale) || 1.0,
      singDuration: Number(data.sing_duration) || 4.0,
      flipX: Boolean(data.flip_x),
      healthIcon: data.healthicon || charId,
      healthBarColor: hexColor,
      positionOffsets:
        Array.isArray(data.position) && data.position.length >= 2 ? [data.position[0], data.position[1]] : [0, 0],
      cameraOffsets:
        Array.isArray(data.camera_position) && data.camera_position.length >= 2
          ? [data.camera_position[0], data.camera_position[1]]
          : [0, 0],
      animations,
      renderType: 'sparrow',
    };

    return { character, diagnostics };
  }

  /**
   * Parses a Psych Engine Stage JSON
   */
  public static parsePsychStage(
    stageJson: string,
    stageId: string,
    filePath?: string
  ): { stage?: NormalizedStage; diagnostics: ConversionDiagnostic[] } {
    const diagnostics: ConversionDiagnostic[] = [];
    const parseRes = this.safeParseJson(stageJson, filePath || `stage-${stageId}`);
    if (parseRes.error || !parseRes.data) {
      diagnostics.push({
        level: 'error',
        category: 'stage',
        file: filePath,
        message: parseRes.error || 'Failed to parse stage JSON',
      });
      return { diagnostics };
    }

    const data = parseRes.data;

    const stage: NormalizedStage = {
      id: stageId,
      name: data.name || stageId,
      defaultZoom: Number(data.defaultZoom) || 0.9,
      isPixel: Boolean(data.isPixelStage),
      cameraSpeed: Number(data.camera_speed) || 1.0,
      characters: {
        boyfriend: {
          position: Array.isArray(data.boyfriend) ? [data.boyfriend[0], data.boyfriend[1]] : [770, 450],
          cameraOffsets: Array.isArray(data.camera_boyfriend)
            ? [data.camera_boyfriend[0], data.camera_boyfriend[1]]
            : [0, 0],
        },
        girlfriend: {
          position: Array.isArray(data.girlfriend) ? [data.girlfriend[0], data.girlfriend[1]] : [400, 130],
          cameraOffsets: Array.isArray(data.camera_girlfriend)
            ? [data.camera_girlfriend[0], data.camera_girlfriend[1]]
            : [0, 0],
          hidden: Boolean(data.hide_girlfriend),
        },
        opponent: {
          position: Array.isArray(data.opponent) ? [data.opponent[0], data.opponent[1]] : [100, 100],
          cameraOffsets: Array.isArray(data.camera_opponent)
            ? [data.camera_opponent[0], data.camera_opponent[1]]
            : [0, 0],
        },
      },
      layers: [],
    };

    // Psych stage JSON stores character positions, but stage props are commonly
    // created by stage Lua/HScript. They are not represented in this JSON, so
    // never imply that the background scene was fully converted from this file alone.
    diagnostics.push({
      level: 'warning',
      category: 'stage',
      file: filePath,
      message: `Psych stage "${stageId}" positions were parsed, but stage props/background objects are not present in the JSON and need conversion from the stage script/assets.`,
      actionNeeded: 'Review the generated V-Slice stage and manually port stage Lua/HScript objects into data/stages JSON props or a V-Slice stage script.',
    });

    return { stage, diagnostics };
  }

  /**
   * Parses a Psych Engine Week JSON
   */
  public static parsePsychWeek(
    weekJson: string,
    weekId: string,
    filePath?: string
  ): { week?: NormalizedWeek; diagnostics: ConversionDiagnostic[] } {
    const diagnostics: ConversionDiagnostic[] = [];
    const parseRes = this.safeParseJson(weekJson, filePath || `week-${weekId}`);
    if (parseRes.error || !parseRes.data) {
      diagnostics.push({
        level: 'error',
        category: 'metadata',
        file: filePath,
        message: parseRes.error || 'Failed to parse week JSON',
      });
      return { diagnostics };
    }

    const data = parseRes.data;
    const songs = Array.isArray(data.songs)
      ? data.songs.map((s: any) => (Array.isArray(s) ? s[0] : typeof s === 'string' ? s : s.name || 'Song'))
      : [];

    const week: NormalizedWeek = {
      id: weekId,
      name: data.storyName || data.weekName || weekId,
      songs,
      difficulties: Array.isArray(data.difficulties) ? data.difficulties : ['easy', 'normal', 'hard'],
      characters: {
        opponent: Array.isArray(data.weekCharacters) ? data.weekCharacters[0] || 'dad' : 'dad',
        player: Array.isArray(data.weekCharacters) ? data.weekCharacters[1] || 'bf' : 'bf',
        girlfriend: Array.isArray(data.weekCharacters) ? data.weekCharacters[2] || 'gf' : 'gf',
      },
      unlocked: !data.locked,
      hideStoryMode: Boolean(data.hideStoryMode),
      hideFreeplay: Boolean(data.hideFreeplay),
      order: Number(data.order) || 1,
    };

    return { week, diagnostics };
  }
}
