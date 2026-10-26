import {
  NormalizedMod,
  NormalizedSong,
  NormalizedCharacter,
  NormalizedStage,
  NormalizedWeek,
} from './ir';

export interface SerializedFile {
  path: string;
  content: string | Uint8Array;
  isBinary?: boolean;
}

export class OutputSerializer {
  /**
   * Serializes a NormalizedMod into the full V-Slice directory file bundle
   */
  public static serializeToVSlice(mod: NormalizedMod): SerializedFile[] {
    const files: SerializedFile[] = [];

    // 1. Polymod Root Metadata: _polymod_meta.json (Official V-Slice 0.8.x & 0.4.x)
    const authorName = mod.author || 'Psych Engine Modder';
    const polymodMeta = {
      title: mod.title || 'Converted Mod',
      description: mod.description || 'Converted from Psych Engine using FNFCOV Converter.',
      homepage: '',
      contributors: [
        {
          name: authorName,
          role: 'Creator',
        },
      ],
      author: authorName,
      api_version: mod.targetVersion === '0.8.x' ? '0.8.0' : '0.4.0',
      mod_version: '1.0.0',
      license: 'Apache 2.0',
    };
    files.push({
      path: '_polymod_meta.json',
      content: JSON.stringify(polymodMeta, null, 2),
    });

    // 2. Songs & Charts
    for (const [songId, song] of mod.songs) {
      // <songId>-chart.json
      const vSliceChartNotes: Record<string, any[]> = {};
      const scrollSpeedMap: Record<string, number> = {};

      for (const [diff, notes] of Object.entries(song.notes)) {
        vSliceChartNotes[diff] = notes.map((n) => {
          const noteObj: any = {
            t: Math.round(n.timeMs * 100) / 100,
            d: n.lane,
          };
          if (n.sustainMs > 0) {
            noteObj.l = Math.round(n.sustainMs * 100) / 100;
          }
          if (n.noteType) {
            noteObj.k = n.noteType;
          }
          return noteObj;
        });

        scrollSpeedMap[diff] = song.scrollSpeed[diff] || 1.6;
      }

      scrollSpeedMap.default = scrollSpeedMap.normal || 1.6;

      const vSliceEvents = song.events.map((e) => ({
        t: Math.round(e.timeMs * 100) / 100,
        e: e.name,
        v: e.parameters,
      }));

      const vSliceChart = {
        version: '2.0.0',
        scrollSpeed: scrollSpeedMap,
        events: vSliceEvents,
        notes: vSliceChartNotes,
        generatedBy: 'FNFCOV Psych-to-V-Slice Mod Converter',
      };

      files.push({
        path: `data/songs/${songId}/${songId}-chart.json`,
        content: JSON.stringify(vSliceChart, null, 2),
      });

      // <songId>-metadata.json
      const timeChanges =
        song.timeChanges.length > 0
          ? song.timeChanges.map((tc) => ({
              t: Math.round(tc.timeMs * 100) / 100,
              b: Math.round(tc.beat * 100) / 100,
              bpm: tc.bpm,
              n: tc.numerator,
              d: tc.denominator,
              bt: tc.beatTuple,
            }))
          : [
              {
                t: 0,
                b: 0,
                bpm: song.bpm,
                n: 4,
                d: 4,
                bt: [4, 4, 4, 4],
              },
            ];

      const vSliceMetadata = {
        version: '2.2.4',
        songName: song.name,
        artist: song.artist,
        charter: song.charter,
        divisions: 16,
        looped: false,
        playData: {
          album: 'volume1',
          characters: {
            player: song.characters.player,
            girlfriend: song.characters.girlfriend,
            opponent: song.characters.opponent,
          },
          stage: song.stage,
          noteStyle: 'funkin',
          ratings: {},
          difficulties: song.difficulties.length > 0 ? song.difficulties : ['easy', 'normal', 'hard'],
          songVariations: [],
          previewStart: 0,
          previewEnd: 15000,
        },
        offsets: {
          instrumental: 0,
          altInstrumentals: {},
          vocals: {},
          altVocals: {},
        },
        timeChanges,
        timeFormat: 'ms',
        generatedBy: 'FNFCOV Psych-to-V-Slice Mod Converter',
      };

      files.push({
        path: `data/songs/${songId}/${songId}-metadata.json`,
        content: JSON.stringify(vSliceMetadata, null, 2),
      });
    }

    // 3. Characters
    for (const [charId, char] of mod.characters) {
      const cleanAssetPath = char.assetPath.startsWith('characters/')
        ? char.assetPath
        : `characters/${char.assetPath}`;

      const vChar = {
        version: '1.0.0',
        name: char.name,
        assetPath: cleanAssetPath,
        renderType: char.renderType,
        scale: char.scale,
        singDuration: char.singDuration,
        flipX: char.flipX,
        healthIcon: {
          id: char.healthIcon,
          scale: 1.0,
          flipX: false,
        },
        healthBarColor: char.healthBarColor,
        positionOffsets: char.positionOffsets,
        cameraOffsets: char.cameraOffsets,
        animations: char.animations.map((a) => ({
          name: a.name,
          prefix: a.prefix,
          fps: a.fps,
          looped: a.loop,
          frameIndices: a.frameIndices,
          offsets: a.offsets,
        })),
      };

      files.push({
        path: `data/characters/${charId}.json`,
        content: JSON.stringify(vChar, null, 2),
      });
    }

    // 4. Stages
    for (const [stageId, stage] of mod.stages) {
      const vStage = {
        version: '1.0.0',
        name: stage.name,
        defaultZoom: stage.defaultZoom,
        isPixel: stage.isPixel,
        cameraSpeed: stage.cameraSpeed,
        characters: {
          boyfriend: {
            position: stage.characters.boyfriend.position,
            cameraOffsets: stage.characters.boyfriend.cameraOffsets,
          },
          girlfriend: {
            position: stage.characters.girlfriend.position,
            cameraOffsets: stage.characters.girlfriend.cameraOffsets,
            hidden: stage.characters.girlfriend.hidden,
          },
          opponent: {
            position: stage.characters.opponent.position,
            cameraOffsets: stage.characters.opponent.cameraOffsets,
          },
        },
      };

      files.push({
        path: `data/stages/${stageId}.json`,
        content: JSON.stringify(vStage, null, 2),
      });
    }

    // 5. Weeks / Levels
    for (const [weekId, week] of mod.weeks) {
      const vLevel = {
        version: '1.0.0',
        name: week.name,
        songs: week.songs,
        difficulties: week.difficulties,
        characters: {
          opponent: week.characters.opponent,
          player: week.characters.player,
          girlfriend: week.characters.girlfriend,
        },
        unlocked: week.unlocked,
        hideStoryMode: week.hideStoryMode,
        hideFreeplay: week.hideFreeplay,
      };

      files.push({
        path: `data/levels/${weekId}.json`,
        content: JSON.stringify(vLevel, null, 2),
      });
    }

    // 6. Scripts (HScript drafts and analysis)
    for (const [scriptPath, script] of mod.scripts) {
      const baseName = script.name.replace(/\.[^.]+$/, '');
      if (script.generatedHScriptDraft) {
        files.push({
          path: `scripts/${baseName}.hscript`,
          content: script.generatedHScriptDraft,
        });
      }
    }

    // 7. Asset Files (Audio, Images, XMLs)
    for (const [assetPath, data] of mod.assetFiles) {
      files.push({
        path: assetPath,
        content: data,
        isBinary: true,
      });
    }

    // 8. Conversion Reports inside package
    const reportMd = this.generateMarkdownReport(mod);
    files.push({
      path: 'CONVERSION_REPORT.md',
      content: reportMd,
    });

    const reportJson = this.generateJsonReport(mod);
    files.push({
      path: 'CONVERSION_REPORT.json',
      content: JSON.stringify(reportJson, null, 2),
    });

    return files;
  }

  public static generateMarkdownReport(mod: NormalizedMod): string {
    const errorCount = mod.diagnostics.filter((d) => d.level === 'error').length;
    const warnCount = mod.diagnostics.filter((d) => d.level === 'warning').length;
    const repairCount = mod.diagnostics.filter((d) => d.level === 'repair').length;

    let md = `# FNF Psych Engine ➔ V-Slice Conversion Audit Report\n\n`;
    md += `**Mod Title**: ${mod.title}\n`;
    md += `**Source Engine**: Psych Engine ${mod.sourceVersion || '(Auto-detected structure)'}\n`;
    md += `**Target Engine**: Official Friday Night Funkin' V-Slice (${mod.targetVersion})\n`;
    md += `**Evidence-Based Status**: **${mod.status}**\n\n`;

    md += `## Conversion Statistics\n`;
    md += `- **Files Discovered**: ${mod.fileManifest.length}\n`;
    md += `- **Songs Converted**: ${mod.songs.size}\n`;
    md += `- **Characters Converted**: ${mod.characters.size}\n`;
    md += `- **Stages Converted**: ${mod.stages.size} ${mod.stages.size === 0 ? '*(None present in source — standard for standalone songpacks)*' : ''}\n`;
    md += `- **Weeks Converted**: ${mod.weeks.size} ${mod.weeks.size === 0 ? '*(None present in source — standard for standalone songpacks)*' : ''}\n`;
    md += `- **Scripts Analyzed**: ${mod.scripts.size} ${mod.scripts.size === 0 ? '*(No custom Lua scripts in source archive)*' : ''}\n`;
    md += `- **Assets Preserved & Copied**: ${mod.assetFiles.size}\n`;
    md += `- **Invariants & Repaired Notes**: ${repairCount}\n\n`;

    md += `## Converted Songs & BPM Breakdown\n\n`;
    if (mod.songs.size === 0) {
      md += `*No songs could be converted from the source archive.*\n\n`;
    } else {
      for (const [id, song] of mod.songs) {
        const bpmStatus =
          song.bpmSource === 'chart'
            ? '✓ Verified from chart'
            : song.bpmSource === 'section'
            ? '✓ Recovered from section data'
            : song.bpmSource === 'event'
            ? '✓ Recovered from BPM event'
            : song.bpmSource === 'sibling'
            ? '✓ Inherited from sibling difficulty'
            : '⚠️ Fallback (Unverified in source)';

        md += `### Song: **${song.name}** (\`${id}\`)\n`;
        md += `- **Base BPM**: ${song.bpm} (${bpmStatus})\n`;
        md += `- **Difficulties**: ${song.difficulties.join(', ')}\n`;
        md += `- **Total Notes**: ${Object.values(song.notes).reduce((acc, arr) => acc + arr.length, 0)}\n`;
        md += `- **Events Count**: ${song.events.length}\n`;
        md += `- **Cast**: Player: \`${song.characters.player}\`, Opponent: \`${song.characters.opponent}\`, GF: \`${song.characters.girlfriend}\`\n`;
        md += `- **Source Files**: ${song.rawSourceFiles.map((f) => `\`${f}\``).join(', ')}\n\n`;
      }
    }

    if (mod.diagnostics.length > 0) {
      md += `## Diagnostics & Validation Log\n\n`;
      mod.diagnostics.forEach((diag) => {
        const icon =
          diag.level === 'error'
            ? '❌'
            : diag.level === 'warning'
            ? '⚠️'
            : diag.level === 'repair'
            ? '🔧'
            : 'ℹ️';
        const fileRef = diag.file ? ` [\`${diag.file}\`]` : '';
        md += `- ${icon} **[${diag.category.toUpperCase()}]**${fileRef} ${diag.message}\n`;
        if (diag.actionNeeded) md += `  - *Action*: ${diag.actionNeeded}\n`;
      });
      md += `\n`;
    }

    if (mod.scripts.size > 0) {
      md += `## Script Compatibility Analysis\n\n`;
      for (const [path, script] of mod.scripts) {
        md += `### \`${script.name}\` (${script.compatibility.toUpperCase()})\n`;
        md += `- **Detected Callbacks**: ${script.detectedCallbacks.length > 0 ? script.detectedCallbacks.join(', ') : 'None'}\n`;
        md += `- **Recommended Action**: ${script.recommendedAction}\n`;
        if (script.issues.length > 0) {
          script.issues.forEach((issue) => (md += `- ⚠️ ${issue}\n`));
        }
        md += `\n`;
      }
    }

    if (mod.fileManifest.length > 0) {
      md += `## Discovered File Manifest\n\n`;
      md += `| Source Path | Type | Status | Target Path / Details |\n`;
      md += `| :--- | :--- | :--- | :--- |\n`;
      mod.fileManifest.forEach((entry) => {
        const out = entry.outputPath ? `\`${entry.outputPath}\`` : entry.reasonForSkipping || '-';
        md += `| \`${entry.sourcePath}\` | ${entry.classifiedType} | **${entry.conversionResult}** | ${out} |\n`;
      });
      md += `\n`;
    }

    md += `## Target Engine Import Instructions\n`;
    md += `1. Place the generated zip archive (or extracted directory) into your Friday Night Funkin' V-Slice \`mods/\` folder.\n`;
    md += `2. Launch FNF and verify the mod appears in the in-game Mod Menu.\n`;
    md += `3. Enjoy playing your Psych Engine songpack in official V-Slice!\n`;

    return md;
  }

  public static generateJsonReport(mod: NormalizedMod): any {
    return {
      modTitle: mod.title,
      sourceEngine: mod.sourceEngine,
      targetVersion: mod.targetVersion,
      status: mod.status,
      statistics: {
        filesDiscovered: mod.fileManifest.length,
        songsCount: mod.songs.size,
        charactersCount: mod.characters.size,
        stagesCount: mod.stages.size,
        weeksCount: mod.weeks.size,
        scriptsCount: mod.scripts.size,
        assetsPreserved: mod.assetFiles.size,
      },
      songs: Array.from(mod.songs.values()).map((s) => ({
        id: s.id,
        name: s.name,
        bpm: s.bpm,
        bpmDerived: s.bpmDerived,
        bpmSource: s.bpmSource,
        difficulties: s.difficulties,
        notesCount: Object.values(s.notes).reduce((acc, arr) => acc + arr.length, 0),
        eventsCount: s.events.length,
        characters: s.characters,
        sourceFiles: s.rawSourceFiles,
      })),
      characters: Array.from(mod.characters.keys()),
      stages: Array.from(mod.stages.keys()),
      weeks: Array.from(mod.weeks.keys()),
      scripts: Array.from(mod.scripts.values()).map((s) => ({
        name: s.name,
        path: s.path,
        compatibility: s.compatibility,
        callbacks: s.detectedCallbacks,
        functions: s.detectedFunctions,
        issues: s.issues,
        recommendedAction: s.recommendedAction,
      })),
      diagnostics: mod.diagnostics,
      manifest: mod.fileManifest,
    };
  }
}
