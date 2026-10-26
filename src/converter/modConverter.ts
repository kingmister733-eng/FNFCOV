import {
  NormalizedMod,
  NormalizedSong,
  NormalizedStage,
  ConversionDiagnostic,
  SourceFileEntry,
  ConversionStatus,
} from './ir';
import { SchemaParser } from './schemaParser';
import { ScriptAnalyzer } from './scriptAnalyzer';
import { Validator } from './validator';
import { OutputSerializer } from './outputSerializer';
import { SafeZip, UnpackedFile } from './safeZip';

export interface ModConversionProgress {
  step: string;
  percent: number;
}

export interface ModConversionResult {
  success: boolean;
  status: ConversionStatus;
  zipBlob?: Blob;
  outputFileName: string;
  modTitle: string;
  stats: {
    filesDiscoveredCount: number;
    songsCount: number;
    notesCount: number;
    charactersCount: number;
    stagesCount: number;
    weeksCount: number;
    scriptsCount: number;
    assetsPreservedCount: number;
  };
  fileManifest: SourceFileEntry[];
  markdownReport: string;
  jsonReport: any;
  diagnostics: ConversionDiagnostic[];
  validationErrors: string[];
  validationWarnings: string[];
  normalizedMod?: NormalizedMod;
}

export class ModConverter {
  /**
   * Complete pipeline for converting a Psych Engine Mod ZIP to an official V-Slice Mod ZIP
   */
  public static async convertPsychModZip(
    zipInput: Blob | ArrayBuffer | Uint8Array,
    originalFileName: string = 'mod.zip',
    targetVersion: '0.4.x' | '0.8.x' = '0.8.x',
    onProgress?: (progress: ModConversionProgress) => void
  ): Promise<ModConversionResult> {
    const diagnostics: ConversionDiagnostic[] = [];
    const fileManifest: SourceFileEntry[] = [];

    // Step 1: Unpack ZIP archive safely with Zip-Slip protection
    if (onProgress) onProgress({ step: 'Безопасное чтение ZIP-архива...', percent: 5 });
    const { files, errors: zipErrors } = await SafeZip.unpackZip(zipInput, (pct, cur) => {
      if (onProgress) onProgress({ step: `Извлечение: ${cur.split('/').pop()}`, percent: Math.round(pct * 0.3) });
    });

    if (zipErrors.length > 0) {
      zipErrors.forEach((err) => diagnostics.push({ level: 'error', category: 'asset', message: err }));
    }

    if (files.size === 0) {
      return this.buildFailedResult('ZIP-архив пуст или не содержит доступных файлов.', originalFileName);
    }

    // Step 2: Initialize Normalized Mod IR
    const modTitle = originalFileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    const normalizedMod: NormalizedMod = {
      id: modTitle.toLowerCase().replace(/\s+/g, '-'),
      title: modTitle,
      description: 'Converted from Psych Engine using FNFCOV Mod Converter.',
      author: 'Psych Engine Modder',
      sourceEngine: 'psych',
      targetVersion,
      songs: new Map(),
      characters: new Map(),
      stages: new Map(),
      weeks: new Map(),
      scripts: new Map(),
      assetFiles: new Map(),
      diagnostics,
      fileManifest,
      status: 'Converted and validated',
    };

    if (onProgress) onProgress({ step: 'Классификация и аудит файлов архива...', percent: 35 });

    // Step 3: Phase 1 — Manifest Classification & Indexing
    const chartEntries: { path: string; file: UnpackedFile }[] = [];
    const eventsEntries: { path: string; file: UnpackedFile }[] = [];
    const characterEntries: { path: string; file: UnpackedFile }[] = [];
    const stageEntries: { path: string; file: UnpackedFile }[] = [];
    const weekEntries: { path: string; file: UnpackedFile }[] = [];
    const scriptEntries: { path: string; file: UnpackedFile }[] = [];

    // Non-chart files to exclude from chart parsing
    const nonChartFiles = new Set([
      'events.json',
      'dialogue.json',
      'cutscenes.json',
      'cutscene.json',
      'mod.json',
      'pack.json',
      '_polymod_meta.json',
      'metadata.json',
      'freeplaysonglist.txt',
      'weeklist.txt',
    ]);

    for (const [path, file] of files) {
      const lower = path.toLowerCase();
      const fileName = path.split('/').pop() || path;
      const lowerFileName = fileName.toLowerCase();

      // Skip macOS metadata and hidden files
      if (fileName.startsWith('._') || lower.includes('__macosx')) {
        fileManifest.push({
          sourcePath: path,
          classifiedType: 'other',
          parsingResult: 'n/a',
          conversionResult: 'skipped',
          warnings: [],
          errors: [],
          reasonForSkipping: 'macOS system metadata file',
        });
        continue;
      }

      // 3.1 JSON Classification
      if (lower.endsWith('.json')) {
        // Character JSONs
        if (lower.includes('characters/') || lower.includes('custom_chars/')) {
          characterEntries.push({ path, file });
          continue;
        }

        // Stage JSONs
        if (lower.includes('stages/') || lower.includes('custom_stages/')) {
          stageEntries.push({ path, file });
          continue;
        }

        // Week JSONs
        if (lower.includes('weeks/')) {
          weekEntries.push({ path, file });
          continue;
        }

        // Events JSONs (separate events file)
        if (lowerFileName === 'events.json' || lowerFileName.endsWith('-events.json') || lower.includes('/events/')) {
          eventsEntries.push({ path, file });
          continue;
        }

        // Known metadata or non-chart JSON
        if (nonChartFiles.has(lowerFileName)) {
          fileManifest.push({
            sourcePath: path,
            classifiedType: 'metadata',
            parsingResult: 'success',
            conversionResult: 'copied',
            outputPath: path,
            warnings: [],
            errors: [],
          });
          normalizedMod.assetFiles.set(path, file.data);
          continue;
        }

        // Verify if JSON is a chart by inspecting content or path
        let isChart = false;
        if (file.text) {
          const trimmed = file.text.trim();
          if (
            trimmed.includes('"notes"') ||
            trimmed.includes('"sectionNotes"') ||
            trimmed.includes('"mustHitSection"') ||
            (trimmed.includes('"song"') && (trimmed.includes('"bpm"') || trimmed.includes('"speed"')))
          ) {
            isChart = true;
          }
        }

        // Do not classify every JSON below data/ or songs/ as a chart: mods also
        // store metadata, dialogue, character configs and other JSON in those trees.
        // Use chart-shaped content first, then a conservative legacy chart filename
        // rule for malformed/older charts so they still reach the parser diagnostics.
        const normalizedPath = path.replace(/\\\\/g, '/');
        const pathParts = normalizedPath.split('/').filter(Boolean);
        const fileStem = lowerFileName.replace(/\\.json$/i, '');
        const dataIndex = pathParts.findIndex((part) => ['data', 'songs'].includes(part.toLowerCase()));
        let legacyChartPath = false;
        if (dataIndex >= 0 && pathParts[dataIndex + 1] && pathParts[dataIndex + 2]) {
          const songDir = pathParts[dataIndex + 1].toLowerCase();
          const difficultyNames = new Set(['easy', 'normal', 'hard', 'erect', 'nightmare', 'pico', 'bf', 'alt']);
          legacyChartPath =
            fileStem === songDir ||
            difficultyNames.has(fileStem) ||
            new RegExp('^' + songDir.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\        if (isChart || lower.includes('data/') || lower.includes('songs/')) {
          chartEntries.push({ path, file });
        } else {') + '-(easy|normal|hard|erect|nightmare|pico|bf|alt)
          fileManifest.push({
            sourcePath: path,
            classifiedType: 'metadata',
            parsingResult: 'success',
            conversionResult: 'copied',
            outputPath: path,
            warnings: [],
            errors: [],
          });
          normalizedMod.assetFiles.set(path, file.data);
        }
        continue;
      }

      // 3.2 Lua Scripts
      if (lower.endsWith('.lua')) {
        if (lower.includes('stages/')) {
          // Stage Lua script
          stageEntries.push({ path, file });
        }
        scriptEntries.push({ path, file });
        continue;
      }

      // 3.3 Audio Files
      if (lower.endsWith('.ogg') || lower.endsWith('.mp3') || lower.endsWith('.wav')) {
        let targetPath = path;
        if (lower.startsWith('mods/')) {
          targetPath = path.replace(/^mods\/[^/]+\//, '');
        }
        if (targetPath.toLowerCase().startsWith('assets/')) {
          targetPath = targetPath.replace(/^assets\//i, '');
        }

        // If audio was stored in data/<song>/Inst.ogg or data/<song>/Voices.ogg, mirror to songs/<song>/
        if (targetPath.toLowerCase().startsWith('data/')) {
          const parts = targetPath.split('/');
          if (parts.length >= 3) {
            const fileNameOnly = parts[parts.length - 1].toLowerCase();
            if (fileNameOnly.startsWith('inst') || fileNameOnly.startsWith('voices')) {
              const songDir = parts[parts.length - 2];
              const mirrorPath = `songs/${songDir}/${parts[parts.length - 1]}`;
              normalizedMod.assetFiles.set(mirrorPath, file.data);
            }
          }
        }

        normalizedMod.assetFiles.set(targetPath, file.data);
        fileManifest.push({
          sourcePath: path,
          classifiedType: 'audio',
          parsingResult: 'n/a',
          conversionResult: 'copied',
          outputPath: targetPath,
          warnings: [],
          errors: [],
        });
        continue;
      }

      // 3.4 Image & Atlas Files
      if (lower.endsWith('.png') || lower.endsWith('.xml') || lower.endsWith('.ttf') || lower.endsWith('.otf')) {
        let targetPath = path;
        if (lower.startsWith('mods/')) {
          targetPath = path.replace(/^mods\/[^/]+\//, '');
        }
        if (targetPath.toLowerCase().startsWith('assets/')) {
          targetPath = targetPath.replace(/^assets\//i, '');
        }

        normalizedMod.assetFiles.set(targetPath, file.data);

        // If character asset was placed in characters/ without images/, mirror to images/characters/
        if (targetPath.toLowerCase().startsWith('characters/')) {
          normalizedMod.assetFiles.set(`images/${targetPath}`, file.data);
        }

        // If icon was placed in icons/ without images/, mirror to images/icons/
        if (targetPath.toLowerCase().startsWith('icons/')) {
          normalizedMod.assetFiles.set(`images/${targetPath}`, file.data);
        }

        fileManifest.push({
          sourcePath: path,
          classifiedType: lower.endsWith('.xml') ? 'atlas' : lower.endsWith('.png') ? 'image' : 'font',
          parsingResult: 'n/a',
          conversionResult: 'copied',
          outputPath: targetPath,
          warnings: [],
          errors: [],
        });
        continue;
      }

      // 3.5 Other miscellaneous files
      fileManifest.push({
        sourcePath: path,
        classifiedType: 'other',
        parsingResult: 'n/a',
        conversionResult: 'copied',
        outputPath: path,
        warnings: [],
        errors: [],
      });
      normalizedMod.assetFiles.set(path, file.data);
    }

    if (onProgress) onProgress({ step: 'Парсинг и конвертация чартов песен...', percent: 50 });

    // Step 4: Phase 2 — Multi-Song & Difficulty Chart Processing
    for (const { path, file } of chartEntries) {
      if (!file.text) continue;

      const lower = path.toLowerCase();
      let diff = 'normal';
      if (lower.includes('-easy') || lower.includes('/easy.json') || lower.endsWith('easy.json')) diff = 'easy';
      else if (lower.includes('-hard') || lower.includes('/hard.json') || lower.endsWith('hard.json')) diff = 'hard';
      else if (lower.includes('-erect') || lower.includes('/erect.json') || lower.endsWith('erect.json')) diff = 'erect';
      else if (lower.includes('-nightmare') || lower.includes('/nightmare.json') || lower.endsWith('nightmare.json')) diff = 'nightmare';
      else if (lower.includes('-pico') || lower.includes('/pico.json') || lower.endsWith('pico.json')) diff = 'pico';

      // Check if this song was already partially parsed (e.g. another difficulty) to inherit verified BPM
      let siblingBpm: number | undefined;
      const preliminaryId = SchemaParser.deriveSongIdentifier({}, path).songId;
      const existingCandidate = normalizedMod.songs.get(preliminaryId);
      if (existingCandidate && existingCandidate.bpmSource !== 'fallback-unverified') {
        siblingBpm = existingCandidate.bpm;
      }

      const { song, diagnostics: chartDiags } = SchemaParser.parsePsychChart(file.text, diff, path, siblingBpm);
      diagnostics.push(...chartDiags);

      if (song) {
        const existing = normalizedMod.songs.get(song.id);
        if (existing) {
          // Merge difficulty notes and scrollSpeed into existing song
          existing.notes[diff] = song.notes[diff];
          existing.scrollSpeed[diff] = song.scrollSpeed[diff] || 1.6;
          if (!existing.difficulties.includes(diff)) {
            existing.difficulties.push(diff);
          }
          if (!existing.rawSourceFiles.includes(path)) {
            existing.rawSourceFiles.push(path);
          }
          // If existing had unverified BPM but this difficulty had verified BPM, update existing!
          if (existing.bpmSource === 'fallback-unverified' && song.bpmSource !== 'fallback-unverified') {
            existing.bpm = song.bpm;
            existing.bpmSource = song.bpmSource;
            existing.bpmDerived = song.bpmDerived;
            existing.timeChanges = song.timeChanges;
          }
        } else {
          normalizedMod.songs.set(song.id, song);
        }

        fileManifest.push({
          sourcePath: path,
          classifiedType: 'chart',
          targetSongId: song.id,
          parsingResult: 'success',
          conversionResult: 'converted',
          outputPath: `data/songs/${song.id}/${song.id}-chart.json`,
          warnings: chartDiags.filter((d) => d.level === 'warning').map((d) => d.message),
          errors: chartDiags.filter((d) => d.level === 'error').map((d) => d.message),
        });
      } else {
        fileManifest.push({
          sourcePath: path,
          classifiedType: 'chart',
          parsingResult: 'failed',
          conversionResult: 'failed',
          warnings: chartDiags.filter((d) => d.level === 'warning').map((d) => d.message),
          errors: chartDiags.filter((d) => d.level === 'error').map((d) => d.message),
        });
      }
    }

    // Step 5: Phase 3 — Song-Specific Event Merging (EXACTLY ONCE PER SONG)
    const mergedSongEventFiles = new Set<string>();

    for (const { path, file } of eventsEntries) {
      if (!file.text) continue;

      const cleanPath = path.replace(/\\/g, '/');
      const segments = cleanPath.split('/').filter((s) => s.length > 0);
      const parentDir = segments.length > 1 ? segments[segments.length - 2].toLowerCase() : '';
      const eventFileName = segments[segments.length - 1] || '';

      // Match with song in normalizedMod
      let matchedSong: NormalizedSong | undefined = normalizedMod.songs.get(parentDir);

      if (!matchedSong) {
        // Try matching by raw source files
        for (const s of normalizedMod.songs.values()) {
          if (s.rawSourceFiles.some((f) => f.includes(`/${parentDir}/`))) {
            matchedSong = s;
            break;
          }
        }
      }

      // Check if event filename includes song name (e.g. niceboy-events.json)
      if (!matchedSong) {
        for (const s of normalizedMod.songs.values()) {
          if (eventFileName.toLowerCase().startsWith(s.id)) {
            matchedSong = s;
            break;
          }
        }
      }

      // If only one song exists in entire mod, safely pair with it
      if (!matchedSong && normalizedMod.songs.size === 1) {
        matchedSong = Array.from(normalizedMod.songs.values())[0];
      }

      if (matchedSong) {
        const mergeKey = `${matchedSong.id}::${path}`;
        if (mergedSongEventFiles.has(mergeKey)) {
          // Already merged this exact events file for this song
          continue;
        }
        mergedSongEventFiles.add(mergeKey);

        const { events, diagnostics: evtDiags } = SchemaParser.parsePsychEvents(
          file.text,
          matchedSong.id,
          path
        );
        diagnostics.push(...evtDiags);

        // Deduplicate and merge events into song
        let newlyAddedCount = 0;
        for (const newEvt of events) {
          const alreadyExists = matchedSong.events.some(
            (e) =>
              Math.abs(e.timeMs - newEvt.timeMs) < 2 &&
              e.name === newEvt.name &&
              JSON.stringify(e.parameters) === JSON.stringify(newEvt.parameters)
          );
          if (!alreadyExists) {
            matchedSong.events.push(newEvt);
            newlyAddedCount++;
          }
        }

        matchedSong.events.sort((a, b) => a.timeMs - b.timeMs);

        diagnostics.push({
          level: 'info',
          category: 'event',
          file: path,
          message: `Merged ${newlyAddedCount} external events from "${path}" into song "${matchedSong.name}".`,
        });

        fileManifest.push({
          sourcePath: path,
          classifiedType: 'events',
          targetSongId: matchedSong.id,
          parsingResult: 'success',
          conversionResult: 'merged',
          outputPath: `data/songs/${matchedSong.id}/${matchedSong.id}-chart.json (events)`,
          warnings: [],
          errors: [],
        });
      } else {
        diagnostics.push({
          level: 'info',
          category: 'event',
          file: path,
          message: `Standalone events file "${path}" could not be unambiguously paired with a specific song in multi-song pack.`,
        });
        fileManifest.push({
          sourcePath: path,
          classifiedType: 'events',
          parsingResult: 'success',
          conversionResult: 'skipped',
          warnings: ['Standalone events.json could not be matched with any specific song in the mod.'],
          errors: [],
          reasonForSkipping: 'No matching song directory found',
        });
      }
    }

    if (onProgress) onProgress({ step: 'Парсинг персонажей, сцен и скриптов...', percent: 65 });

    // Step 6: Phase 4 — Characters Conversion
    for (const { path, file } of characterEntries) {
      if (!file.text) continue;
      const fileName = path.split('/').pop() || path;
      const charId = fileName.replace('.json', '').toLowerCase();

      const { character, diagnostics: charDiags } = SchemaParser.parsePsychCharacter(file.text, charId, path);
      diagnostics.push(...charDiags);

      if (character) {
        normalizedMod.characters.set(charId, character);
        fileManifest.push({
          sourcePath: path,
          classifiedType: 'character',
          parsingResult: 'success',
          conversionResult: 'converted',
          outputPath: `data/characters/${charId}.json`,
          warnings: charDiags.filter((d) => d.level === 'warning').map((d) => d.message),
          errors: charDiags.filter((d) => d.level === 'error').map((d) => d.message),
        });
      } else {
        fileManifest.push({
          sourcePath: path,
          classifiedType: 'character',
          parsingResult: 'failed',
          conversionResult: 'failed',
          warnings: [],
          errors: charDiags.map((d) => d.message),
        });
      }
    }

    // Step 7: Phase 5 — Stages Conversion (including Lua stages)
    for (const { path, file } of stageEntries) {
      const fileName = path.split('/').pop() || path;
      const stageId = fileName.replace(/\.[^.]+$/, '').toLowerCase();

      if (path.toLowerCase().endsWith('.json') && file.text) {
        const { stage, diagnostics: stageDiags } = SchemaParser.parsePsychStage(file.text, stageId, path);
        diagnostics.push(...stageDiags);
        if (stage) {
          normalizedMod.stages.set(stageId, stage);
          fileManifest.push({
            sourcePath: path,
            classifiedType: 'stage',
            parsingResult: 'success',
            conversionResult: 'converted',
            outputPath: `data/stages/${stageId}.json`,
            warnings: [],
            errors: [],
          });
        }
      } else if (path.toLowerCase().endsWith('.lua')) {
        // Lua stage: create valid V-Slice stage baseline definition
        if (!normalizedMod.stages.has(stageId)) {
          const defaultStage: NormalizedStage = {
            id: stageId,
            name: stageId,
            defaultZoom: 0.9,
            isPixel: false,
            cameraSpeed: 1.0,
            characters: {
              boyfriend: { position: [770, 450], cameraOffsets: [0, 0] },
              girlfriend: { position: [400, 130], cameraOffsets: [0, 0] },
              opponent: { position: [100, 100], cameraOffsets: [0, 0] },
            },
            layers: [],
          };
          normalizedMod.stages.set(stageId, defaultStage);
          diagnostics.push({
            level: 'info',
            category: 'stage',
            file: path,
            message: `Created V-Slice stage definition for Lua-only stage "${stageId}".`,
          });
          fileManifest.push({
            sourcePath: path,
            classifiedType: 'stage',
            parsingResult: 'repaired',
            conversionResult: 'converted',
            outputPath: `data/stages/${stageId}.json`,
            warnings: ['Stage relies on Lua script for visuals; generated baseline stage anchors.'],
            errors: [],
          });
        }
      }
    }

    // If mod does not define any custom stages, log informative notice
    if (normalizedMod.stages.size === 0) {
      diagnostics.push({
        level: 'info',
        category: 'stage',
        message: 'Mod does not define custom stage JSONs or scripts; default V-Slice stage "stage" will be used.',
      });
    }

    // Step 8: Phase 6 — Weeks Conversion
    for (const { path, file } of weekEntries) {
      if (!file.text) continue;
      const fileName = path.split('/').pop() || path;
      const weekId = fileName.replace('.json', '').toLowerCase();

      const { week, diagnostics: weekDiags } = SchemaParser.parsePsychWeek(file.text, weekId, path);
      diagnostics.push(...weekDiags);
      if (week) {
        normalizedMod.weeks.set(weekId, week);
        fileManifest.push({
          sourcePath: path,
          classifiedType: 'week',
          parsingResult: 'success',
          conversionResult: 'converted',
          outputPath: `data/levels/${weekId}.json`,
          warnings: [],
          errors: [],
        });
      }
    }

    // If mod is a standalone songpack without week files, log informative notice
    if (normalizedMod.weeks.size === 0) {
      diagnostics.push({
        level: 'info',
        category: 'metadata',
        message: 'Standalone songpack detected: Mod contains standalone song charts without story mode weeks. Songs will appear directly in Freeplay.',
      });
    }

    // Step 9: Phase 7 — Scripts Compatibility Analysis
    for (const { path, file } of scriptEntries) {
      if (!file.text) continue;
      const { script, diagnostics: scriptDiags } = ScriptAnalyzer.analyzeLuaScript(path, file.text);
      diagnostics.push(...scriptDiags);
      normalizedMod.scripts.set(path, script);

      fileManifest.push({
        sourcePath: path,
        classifiedType: 'script',
        parsingResult: 'success',
        conversionResult: script.compatibility === 'manual' ? 'skipped' : 'converted',
        outputPath: `scripts/${script.name.replace(/\.[^.]+$/, '')}.hscript`,
        warnings: script.issues,
        errors: [],
        reasonForSkipping: script.compatibility === 'manual' ? 'Requires manual HScript/Haxe adaptation (unsupported Lua shaders/FFI)' : undefined,
      });
    }

    if (onProgress) onProgress({ step: 'Верификация ссылок ассетов и аудио...', percent: 75 });

    // Step 10: Phase 8 — Asset Resolution & Mirroring
    // 10.1 Verify and mirror character assets into images/characters/
    for (const [charId, char] of normalizedMod.characters) {
      const charBase = char.assetPath.replace(/^characters\//, '');
      const expectedPng = `images/characters/${charBase}.png`;
      const expectedXml = `images/characters/${charBase}.xml`;

      // Check if image exists in assetFiles
      let foundPng = normalizedMod.assetFiles.has(expectedPng);
      let foundXml = normalizedMod.assetFiles.has(expectedXml);

      if (!foundPng) {
        // Search alternative locations
        for (const [k, v] of normalizedMod.assetFiles) {
          if (k.toLowerCase().endsWith(`/${charBase.toLowerCase()}.png`) || k.toLowerCase() === `${charBase.toLowerCase()}.png`) {
            normalizedMod.assetFiles.set(expectedPng, v);
            foundPng = true;
            break;
          }
        }
      }

      if (!foundXml) {
        for (const [k, v] of normalizedMod.assetFiles) {
          if (k.toLowerCase().endsWith(`/${charBase.toLowerCase()}.xml`) || k.toLowerCase() === `${charBase.toLowerCase()}.xml`) {
            normalizedMod.assetFiles.set(expectedXml, v);
            foundXml = true;
            break;
          }
        }
      }

      if (!foundPng) {
        diagnostics.push({
          level: 'warning',
          category: 'asset',
          message: `Character "${char.name}" (${charId}) references sprite sheet "${expectedPng}" which was not found in mod assets.`,
          actionNeeded: `Ensure ${expectedPng} is included in the mod archive.`,
        });
      }
    }

    // 10.2 Verify and mirror song audio into songs/<songId>/
    for (const [songId, song] of normalizedMod.songs) {
      const expectedInst = `songs/${songId}/Inst.ogg`;
      let foundInst = normalizedMod.assetFiles.has(expectedInst);

      if (!foundInst) {
        for (const [k, v] of normalizedMod.assetFiles) {
          const lowerK = k.toLowerCase();
          if (lowerK.includes(songId) && lowerK.endsWith('inst.ogg')) {
            normalizedMod.assetFiles.set(expectedInst, v);
            foundInst = true;
            break;
          }
        }
      }

      if (!foundInst) {
        diagnostics.push({
          level: 'warning',
          category: 'asset',
          message: `Song "${song.name}" does not have an instrumental track "${expectedInst}".`,
          actionNeeded: `Provide ${expectedInst} for playback.`,
        });
      }
    }

    if (onProgress) onProgress({ step: 'Строгая валидация и сборка...', percent: 85 });

    // Step 11: Strict Validation & Evidence-Based Status Calculation
    const validation = Validator.validateMod(normalizedMod);

    const errorCount = diagnostics.filter((d) => d.level === 'error').length + validation.errors.length;
    const warningCount = diagnostics.filter((d) => d.level === 'warning').length + validation.warnings.length;

    // Check if any song required unverified fallback BPM
    const hasUnverifiedBpm = Array.from(normalizedMod.songs.values()).some(
      (s) => s.bpmSource === 'fallback-unverified'
    );

    // Check if any scripts require manual porting
    const hasManualScripts = Array.from(normalizedMod.scripts.values()).some(
      (s) => s.compatibility === 'manual'
    );

    let finalStatus: ConversionStatus = 'Converted and validated';
    if (errorCount > 0 && normalizedMod.songs.size === 0 && normalizedMod.characters.size === 0) {
      finalStatus = 'Failed validation';
    } else if (errorCount > 0) {
      finalStatus = 'Partially converted';
    } else if (hasUnverifiedBpm || hasManualScripts) {
      finalStatus = 'Requires manual repair';
    } else if (warningCount > 0) {
      finalStatus = 'Converted with warnings';
    }

    normalizedMod.status = finalStatus;

    // Step 12: Output Serialization
    const serializedFiles = OutputSerializer.serializeToVSlice(normalizedMod);

    // Step 13: Packaging ZIP
    if (onProgress) onProgress({ step: 'Упаковка V-Slice ZIP-архива...', percent: 92 });
    const zipBlob = await SafeZip.packZip(serializedFiles, (pct) => {
      if (onProgress) onProgress({ step: 'Завершение компрессии...', percent: pct });
    });

    const markdownReport = OutputSerializer.generateMarkdownReport(normalizedMod);
    const jsonReport = OutputSerializer.generateJsonReport(normalizedMod);

    // Compute total notes
    let totalNotes = 0;
    for (const song of normalizedMod.songs.values()) {
      for (const notes of Object.values(song.notes)) {
        totalNotes += notes.length;
      }
    }

    const outName = `${modTitle.replace(/\s+/g, '_')}_VSlice_${targetVersion}.zip`;

    if (onProgress) onProgress({ step: 'Завершено!', percent: 100 });

    return {
      success: normalizedMod.songs.size > 0 || normalizedMod.characters.size > 0,
      status: finalStatus,
      zipBlob,
      outputFileName: outName,
      modTitle,
      stats: {
        filesDiscoveredCount: files.size,
        songsCount: normalizedMod.songs.size,
        notesCount: totalNotes,
        charactersCount: normalizedMod.characters.size,
        stagesCount: normalizedMod.stages.size,
        weeksCount: normalizedMod.weeks.size,
        scriptsCount: normalizedMod.scripts.size,
        assetsPreservedCount: normalizedMod.assetFiles.size,
      },
      fileManifest,
      markdownReport,
      jsonReport,
      diagnostics: normalizedMod.diagnostics,
      validationErrors: validation.errors,
      validationWarnings: validation.warnings,
      normalizedMod,
    };
  }

  private static buildFailedResult(error: string, originalFileName: string): ModConversionResult {
    return {
      success: false,
      status: 'Failed validation',
      outputFileName: `error_${originalFileName}`,
      modTitle: 'Failed Mod',
      stats: {
        filesDiscoveredCount: 0,
        songsCount: 0,
        notesCount: 0,
        charactersCount: 0,
        stagesCount: 0,
        weeksCount: 0,
        scriptsCount: 0,
        assetsPreservedCount: 0,
      },
      fileManifest: [],
      markdownReport: `# Conversion Failed\n\n${error}`,
      jsonReport: { error },
      diagnostics: [{ level: 'error', category: 'metadata', message: error }],
      validationErrors: [error],
      validationWarnings: [],
    };
  }
}
, 'i').test(fileStem);
        }

        if (isChart || legacyChartPath) {
          chartEntries.push({ path, file });
        } else {
          fileManifest.push({
            sourcePath: path,
            classifiedType: 'metadata',
            parsingResult: 'success',
            conversionResult: 'copied',
            outputPath: path,
            warnings: [],
            errors: [],
          });
          normalizedMod.assetFiles.set(path, file.data);
        }
        continue;
      }

      // 3.2 Lua Scripts
      if (lower.endsWith('.lua')) {
        if (lower.includes('stages/')) {
          // Stage Lua script
          stageEntries.push({ path, file });
        }
        scriptEntries.push({ path, file });
        continue;
      }

      // 3.3 Audio Files
      if (lower.endsWith('.ogg') || lower.endsWith('.mp3') || lower.endsWith('.wav')) {
        let targetPath = path;
        if (lower.startsWith('mods/')) {
          targetPath = path.replace(/^mods\/[^/]+\//, '');
        }
        if (targetPath.toLowerCase().startsWith('assets/')) {
          targetPath = targetPath.replace(/^assets\//i, '');
        }

        // If audio was stored in data/<song>/Inst.ogg or data/<song>/Voices.ogg, mirror to songs/<song>/
        if (targetPath.toLowerCase().startsWith('data/')) {
          const parts = targetPath.split('/');
          if (parts.length >= 3) {
            const fileNameOnly = parts[parts.length - 1].toLowerCase();
            if (fileNameOnly.startsWith('inst') || fileNameOnly.startsWith('voices')) {
              const songDir = parts[parts.length - 2];
              const mirrorPath = `songs/${songDir}/${parts[parts.length - 1]}`;
              normalizedMod.assetFiles.set(mirrorPath, file.data);
            }
          }
        }

        normalizedMod.assetFiles.set(targetPath, file.data);
        fileManifest.push({
          sourcePath: path,
          classifiedType: 'audio',
          parsingResult: 'n/a',
          conversionResult: 'copied',
          outputPath: targetPath,
          warnings: [],
          errors: [],
        });
        continue;
      }

      // 3.4 Image & Atlas Files
      if (lower.endsWith('.png') || lower.endsWith('.xml') || lower.endsWith('.ttf') || lower.endsWith('.otf')) {
        let targetPath = path;
        if (lower.startsWith('mods/')) {
          targetPath = path.replace(/^mods\/[^/]+\//, '');
        }
        if (targetPath.toLowerCase().startsWith('assets/')) {
          targetPath = targetPath.replace(/^assets\//i, '');
        }

        normalizedMod.assetFiles.set(targetPath, file.data);

        // If character asset was placed in characters/ without images/, mirror to images/characters/
        if (targetPath.toLowerCase().startsWith('characters/')) {
          normalizedMod.assetFiles.set(`images/${targetPath}`, file.data);
        }

        // If icon was placed in icons/ without images/, mirror to images/icons/
        if (targetPath.toLowerCase().startsWith('icons/')) {
          normalizedMod.assetFiles.set(`images/${targetPath}`, file.data);
        }

        fileManifest.push({
          sourcePath: path,
          classifiedType: lower.endsWith('.xml') ? 'atlas' : lower.endsWith('.png') ? 'image' : 'font',
          parsingResult: 'n/a',
          conversionResult: 'copied',
          outputPath: targetPath,
          warnings: [],
          errors: [],
        });
        continue;
      }

      // 3.5 Other miscellaneous files
      fileManifest.push({
        sourcePath: path,
        classifiedType: 'other',
        parsingResult: 'n/a',
        conversionResult: 'copied',
        outputPath: path,
        warnings: [],
        errors: [],
      });
      normalizedMod.assetFiles.set(path, file.data);
    }

    if (onProgress) onProgress({ step: 'Парсинг и конвертация чартов песен...', percent: 50 });

    // Step 4: Phase 2 — Multi-Song & Difficulty Chart Processing
    for (const { path, file } of chartEntries) {
      if (!file.text) continue;

      const lower = path.toLowerCase();
      let diff = 'normal';
      if (lower.includes('-easy') || lower.includes('/easy.json') || lower.endsWith('easy.json')) diff = 'easy';
      else if (lower.includes('-hard') || lower.includes('/hard.json') || lower.endsWith('hard.json')) diff = 'hard';
      else if (lower.includes('-erect') || lower.includes('/erect.json') || lower.endsWith('erect.json')) diff = 'erect';
      else if (lower.includes('-nightmare') || lower.includes('/nightmare.json') || lower.endsWith('nightmare.json')) diff = 'nightmare';
      else if (lower.includes('-pico') || lower.includes('/pico.json') || lower.endsWith('pico.json')) diff = 'pico';

      // Check if this song was already partially parsed (e.g. another difficulty) to inherit verified BPM
      let siblingBpm: number | undefined;
      const preliminaryId = SchemaParser.deriveSongIdentifier({}, path).songId;
      const existingCandidate = normalizedMod.songs.get(preliminaryId);
      if (existingCandidate && existingCandidate.bpmSource !== 'fallback-unverified') {
        siblingBpm = existingCandidate.bpm;
      }

      const { song, diagnostics: chartDiags } = SchemaParser.parsePsychChart(file.text, diff, path, siblingBpm);
      diagnostics.push(...chartDiags);

      if (song) {
        const existing = normalizedMod.songs.get(song.id);
        if (existing) {
          // Merge difficulty notes and scrollSpeed into existing song
          existing.notes[diff] = song.notes[diff];
          existing.scrollSpeed[diff] = song.scrollSpeed[diff] || 1.6;
          if (!existing.difficulties.includes(diff)) {
            existing.difficulties.push(diff);
          }
          if (!existing.rawSourceFiles.includes(path)) {
            existing.rawSourceFiles.push(path);
          }
          // If existing had unverified BPM but this difficulty had verified BPM, update existing!
          if (existing.bpmSource === 'fallback-unverified' && song.bpmSource !== 'fallback-unverified') {
            existing.bpm = song.bpm;
            existing.bpmSource = song.bpmSource;
            existing.bpmDerived = song.bpmDerived;
            existing.timeChanges = song.timeChanges;
          }
        } else {
          normalizedMod.songs.set(song.id, song);
        }

        fileManifest.push({
          sourcePath: path,
          classifiedType: 'chart',
          targetSongId: song.id,
          parsingResult: 'success',
          conversionResult: 'converted',
          outputPath: `data/songs/${song.id}/${song.id}-chart.json`,
          warnings: chartDiags.filter((d) => d.level === 'warning').map((d) => d.message),
          errors: chartDiags.filter((d) => d.level === 'error').map((d) => d.message),
        });
      } else {
        fileManifest.push({
          sourcePath: path,
          classifiedType: 'chart',
          parsingResult: 'failed',
          conversionResult: 'failed',
          warnings: chartDiags.filter((d) => d.level === 'warning').map((d) => d.message),
          errors: chartDiags.filter((d) => d.level === 'error').map((d) => d.message),
        });
      }
    }

    // Step 5: Phase 3 — Song-Specific Event Merging (EXACTLY ONCE PER SONG)
    const mergedSongEventFiles = new Set<string>();

    for (const { path, file } of eventsEntries) {
      if (!file.text) continue;

      const cleanPath = path.replace(/\\/g, '/');
      const segments = cleanPath.split('/').filter((s) => s.length > 0);
      const parentDir = segments.length > 1 ? segments[segments.length - 2].toLowerCase() : '';
      const eventFileName = segments[segments.length - 1] || '';

      // Match with song in normalizedMod
      let matchedSong: NormalizedSong | undefined = normalizedMod.songs.get(parentDir);

      if (!matchedSong) {
        // Try matching by raw source files
        for (const s of normalizedMod.songs.values()) {
          if (s.rawSourceFiles.some((f) => f.includes(`/${parentDir}/`))) {
            matchedSong = s;
            break;
          }
        }
      }

      // Check if event filename includes song name (e.g. niceboy-events.json)
      if (!matchedSong) {
        for (const s of normalizedMod.songs.values()) {
          if (eventFileName.toLowerCase().startsWith(s.id)) {
            matchedSong = s;
            break;
          }
        }
      }

      // If only one song exists in entire mod, safely pair with it
      if (!matchedSong && normalizedMod.songs.size === 1) {
        matchedSong = Array.from(normalizedMod.songs.values())[0];
      }

      if (matchedSong) {
        const mergeKey = `${matchedSong.id}::${path}`;
        if (mergedSongEventFiles.has(mergeKey)) {
          // Already merged this exact events file for this song
          continue;
        }
        mergedSongEventFiles.add(mergeKey);

        const { events, diagnostics: evtDiags } = SchemaParser.parsePsychEvents(
          file.text,
          matchedSong.id,
          path
        );
        diagnostics.push(...evtDiags);

        // Deduplicate and merge events into song
        let newlyAddedCount = 0;
        for (const newEvt of events) {
          const alreadyExists = matchedSong.events.some(
            (e) =>
              Math.abs(e.timeMs - newEvt.timeMs) < 2 &&
              e.name === newEvt.name &&
              JSON.stringify(e.parameters) === JSON.stringify(newEvt.parameters)
          );
          if (!alreadyExists) {
            matchedSong.events.push(newEvt);
            newlyAddedCount++;
          }
        }

        matchedSong.events.sort((a, b) => a.timeMs - b.timeMs);

        diagnostics.push({
          level: 'info',
          category: 'event',
          file: path,
          message: `Merged ${newlyAddedCount} external events from "${path}" into song "${matchedSong.name}".`,
        });

        fileManifest.push({
          sourcePath: path,
          classifiedType: 'events',
          targetSongId: matchedSong.id,
          parsingResult: 'success',
          conversionResult: 'merged',
          outputPath: `data/songs/${matchedSong.id}/${matchedSong.id}-chart.json (events)`,
          warnings: [],
          errors: [],
        });
      } else {
        diagnostics.push({
          level: 'info',
          category: 'event',
          file: path,
          message: `Standalone events file "${path}" could not be unambiguously paired with a specific song in multi-song pack.`,
        });
        fileManifest.push({
          sourcePath: path,
          classifiedType: 'events',
          parsingResult: 'success',
          conversionResult: 'skipped',
          warnings: ['Standalone events.json could not be matched with any specific song in the mod.'],
          errors: [],
          reasonForSkipping: 'No matching song directory found',
        });
      }
    }

    if (onProgress) onProgress({ step: 'Парсинг персонажей, сцен и скриптов...', percent: 65 });

    // Step 6: Phase 4 — Characters Conversion
    for (const { path, file } of characterEntries) {
      if (!file.text) continue;
      const fileName = path.split('/').pop() || path;
      const charId = fileName.replace('.json', '').toLowerCase();

      const { character, diagnostics: charDiags } = SchemaParser.parsePsychCharacter(file.text, charId, path);
      diagnostics.push(...charDiags);

      if (character) {
        normalizedMod.characters.set(charId, character);
        fileManifest.push({
          sourcePath: path,
          classifiedType: 'character',
          parsingResult: 'success',
          conversionResult: 'converted',
          outputPath: `data/characters/${charId}.json`,
          warnings: charDiags.filter((d) => d.level === 'warning').map((d) => d.message),
          errors: charDiags.filter((d) => d.level === 'error').map((d) => d.message),
        });
      } else {
        fileManifest.push({
          sourcePath: path,
          classifiedType: 'character',
          parsingResult: 'failed',
          conversionResult: 'failed',
          warnings: [],
          errors: charDiags.map((d) => d.message),
        });
      }
    }

    // Step 7: Phase 5 — Stages Conversion (including Lua stages)
    for (const { path, file } of stageEntries) {
      const fileName = path.split('/').pop() || path;
      const stageId = fileName.replace(/\.[^.]+$/, '').toLowerCase();

      if (path.toLowerCase().endsWith('.json') && file.text) {
        const { stage, diagnostics: stageDiags } = SchemaParser.parsePsychStage(file.text, stageId, path);
        diagnostics.push(...stageDiags);
        if (stage) {
          normalizedMod.stages.set(stageId, stage);
          fileManifest.push({
            sourcePath: path,
            classifiedType: 'stage',
            parsingResult: 'success',
            conversionResult: 'converted',
            outputPath: `data/stages/${stageId}.json`,
            warnings: [],
            errors: [],
          });
        }
      } else if (path.toLowerCase().endsWith('.lua')) {
        // Lua stage: create valid V-Slice stage baseline definition
        if (!normalizedMod.stages.has(stageId)) {
          const defaultStage: NormalizedStage = {
            id: stageId,
            name: stageId,
            defaultZoom: 0.9,
            isPixel: false,
            cameraSpeed: 1.0,
            characters: {
              boyfriend: { position: [770, 450], cameraOffsets: [0, 0] },
              girlfriend: { position: [400, 130], cameraOffsets: [0, 0] },
              opponent: { position: [100, 100], cameraOffsets: [0, 0] },
            },
            layers: [],
          };
          normalizedMod.stages.set(stageId, defaultStage);
          diagnostics.push({
            level: 'info',
            category: 'stage',
            file: path,
            message: `Created V-Slice stage definition for Lua-only stage "${stageId}".`,
          });
          fileManifest.push({
            sourcePath: path,
            classifiedType: 'stage',
            parsingResult: 'repaired',
            conversionResult: 'converted',
            outputPath: `data/stages/${stageId}.json`,
            warnings: ['Stage relies on Lua script for visuals; generated baseline stage anchors.'],
            errors: [],
          });
        }
      }
    }

    // If mod does not define any custom stages, log informative notice
    if (normalizedMod.stages.size === 0) {
      diagnostics.push({
        level: 'info',
        category: 'stage',
        message: 'Mod does not define custom stage JSONs or scripts; default V-Slice stage "stage" will be used.',
      });
    }

    // Step 8: Phase 6 — Weeks Conversion
    for (const { path, file } of weekEntries) {
      if (!file.text) continue;
      const fileName = path.split('/').pop() || path;
      const weekId = fileName.replace('.json', '').toLowerCase();

      const { week, diagnostics: weekDiags } = SchemaParser.parsePsychWeek(file.text, weekId, path);
      diagnostics.push(...weekDiags);
      if (week) {
        normalizedMod.weeks.set(weekId, week);
        fileManifest.push({
          sourcePath: path,
          classifiedType: 'week',
          parsingResult: 'success',
          conversionResult: 'converted',
          outputPath: `data/levels/${weekId}.json`,
          warnings: [],
          errors: [],
        });
      }
    }

    // If mod is a standalone songpack without week files, log informative notice
    if (normalizedMod.weeks.size === 0) {
      diagnostics.push({
        level: 'info',
        category: 'metadata',
        message: 'Standalone songpack detected: Mod contains standalone song charts without story mode weeks. Songs will appear directly in Freeplay.',
      });
    }

    // Step 9: Phase 7 — Scripts Compatibility Analysis
    for (const { path, file } of scriptEntries) {
      if (!file.text) continue;
      const { script, diagnostics: scriptDiags } = ScriptAnalyzer.analyzeLuaScript(path, file.text);
      diagnostics.push(...scriptDiags);
      normalizedMod.scripts.set(path, script);

      fileManifest.push({
        sourcePath: path,
        classifiedType: 'script',
        parsingResult: 'success',
        conversionResult: script.compatibility === 'manual' ? 'skipped' : 'converted',
        outputPath: `scripts/${script.name.replace(/\.[^.]+$/, '')}.hscript`,
        warnings: script.issues,
        errors: [],
        reasonForSkipping: script.compatibility === 'manual' ? 'Requires manual HScript/Haxe adaptation (unsupported Lua shaders/FFI)' : undefined,
      });
    }

    if (onProgress) onProgress({ step: 'Верификация ссылок ассетов и аудио...', percent: 75 });

    // Step 10: Phase 8 — Asset Resolution & Mirroring
    // 10.1 Verify and mirror character assets into images/characters/
    for (const [charId, char] of normalizedMod.characters) {
      const charBase = char.assetPath.replace(/^characters\//, '');
      const expectedPng = `images/characters/${charBase}.png`;
      const expectedXml = `images/characters/${charBase}.xml`;

      // Check if image exists in assetFiles
      let foundPng = normalizedMod.assetFiles.has(expectedPng);
      let foundXml = normalizedMod.assetFiles.has(expectedXml);

      if (!foundPng) {
        // Search alternative locations
        for (const [k, v] of normalizedMod.assetFiles) {
          if (k.toLowerCase().endsWith(`/${charBase.toLowerCase()}.png`) || k.toLowerCase() === `${charBase.toLowerCase()}.png`) {
            normalizedMod.assetFiles.set(expectedPng, v);
            foundPng = true;
            break;
          }
        }
      }

      if (!foundXml) {
        for (const [k, v] of normalizedMod.assetFiles) {
          if (k.toLowerCase().endsWith(`/${charBase.toLowerCase()}.xml`) || k.toLowerCase() === `${charBase.toLowerCase()}.xml`) {
            normalizedMod.assetFiles.set(expectedXml, v);
            foundXml = true;
            break;
          }
        }
      }

      if (!foundPng) {
        diagnostics.push({
          level: 'warning',
          category: 'asset',
          message: `Character "${char.name}" (${charId}) references sprite sheet "${expectedPng}" which was not found in mod assets.`,
          actionNeeded: `Ensure ${expectedPng} is included in the mod archive.`,
        });
      }
    }

    // 10.2 Verify and mirror song audio into songs/<songId>/
    for (const [songId, song] of normalizedMod.songs) {
      const expectedInst = `songs/${songId}/Inst.ogg`;
      let foundInst = normalizedMod.assetFiles.has(expectedInst);

      if (!foundInst) {
        for (const [k, v] of normalizedMod.assetFiles) {
          const lowerK = k.toLowerCase();
          if (lowerK.includes(songId) && lowerK.endsWith('inst.ogg')) {
            normalizedMod.assetFiles.set(expectedInst, v);
            foundInst = true;
            break;
          }
        }
      }

      if (!foundInst) {
        diagnostics.push({
          level: 'warning',
          category: 'asset',
          message: `Song "${song.name}" does not have an instrumental track "${expectedInst}".`,
          actionNeeded: `Provide ${expectedInst} for playback.`,
        });
      }
    }

    if (onProgress) onProgress({ step: 'Строгая валидация и сборка...', percent: 85 });

    // Step 11: Strict Validation & Evidence-Based Status Calculation
    const validation = Validator.validateMod(normalizedMod);

    const errorCount = diagnostics.filter((d) => d.level === 'error').length + validation.errors.length;
    const warningCount = diagnostics.filter((d) => d.level === 'warning').length + validation.warnings.length;

    // Check if any song required unverified fallback BPM
    const hasUnverifiedBpm = Array.from(normalizedMod.songs.values()).some(
      (s) => s.bpmSource === 'fallback-unverified'
    );

    // Check if any scripts require manual porting
    const hasManualScripts = Array.from(normalizedMod.scripts.values()).some(
      (s) => s.compatibility === 'manual'
    );

    let finalStatus: ConversionStatus = 'Converted and validated';
    if (errorCount > 0 && normalizedMod.songs.size === 0 && normalizedMod.characters.size === 0) {
      finalStatus = 'Failed validation';
    } else if (errorCount > 0) {
      finalStatus = 'Partially converted';
    } else if (hasUnverifiedBpm || hasManualScripts) {
      finalStatus = 'Requires manual repair';
    } else if (warningCount > 0) {
      finalStatus = 'Converted with warnings';
    }

    normalizedMod.status = finalStatus;

    // Step 12: Output Serialization
    const serializedFiles = OutputSerializer.serializeToVSlice(normalizedMod);

    // Step 13: Packaging ZIP
    if (onProgress) onProgress({ step: 'Упаковка V-Slice ZIP-архива...', percent: 92 });
    const zipBlob = await SafeZip.packZip(serializedFiles, (pct) => {
      if (onProgress) onProgress({ step: 'Завершение компрессии...', percent: pct });
    });

    const markdownReport = OutputSerializer.generateMarkdownReport(normalizedMod);
    const jsonReport = OutputSerializer.generateJsonReport(normalizedMod);

    // Compute total notes
    let totalNotes = 0;
    for (const song of normalizedMod.songs.values()) {
      for (const notes of Object.values(song.notes)) {
        totalNotes += notes.length;
      }
    }

    const outName = `${modTitle.replace(/\s+/g, '_')}_VSlice_${targetVersion}.zip`;

    if (onProgress) onProgress({ step: 'Завершено!', percent: 100 });

    return {
      success: normalizedMod.songs.size > 0 || normalizedMod.characters.size > 0,
      status: finalStatus,
      zipBlob,
      outputFileName: outName,
      modTitle,
      stats: {
        filesDiscoveredCount: files.size,
        songsCount: normalizedMod.songs.size,
        notesCount: totalNotes,
        charactersCount: normalizedMod.characters.size,
        stagesCount: normalizedMod.stages.size,
        weeksCount: normalizedMod.weeks.size,
        scriptsCount: normalizedMod.scripts.size,
        assetsPreservedCount: normalizedMod.assetFiles.size,
      },
      fileManifest,
      markdownReport,
      jsonReport,
      diagnostics: normalizedMod.diagnostics,
      validationErrors: validation.errors,
      validationWarnings: validation.warnings,
      normalizedMod,
    };
  }

  private static buildFailedResult(error: string, originalFileName: string): ModConversionResult {
    return {
      success: false,
      status: 'Failed validation',
      outputFileName: `error_${originalFileName}`,
      modTitle: 'Failed Mod',
      stats: {
        filesDiscoveredCount: 0,
        songsCount: 0,
        notesCount: 0,
        charactersCount: 0,
        stagesCount: 0,
        weeksCount: 0,
        scriptsCount: 0,
        assetsPreservedCount: 0,
      },
      fileManifest: [],
      markdownReport: `# Conversion Failed\n\n${error}`,
      jsonReport: { error },
      diagnostics: [{ level: 'error', category: 'metadata', message: error }],
      validationErrors: [error],
      validationWarnings: [],
    };
  }
}
