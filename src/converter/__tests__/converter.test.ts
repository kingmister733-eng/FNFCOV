import { describe, it, expect } from 'vitest';
import { SchemaParser } from '../schemaParser';
import { ScriptAnalyzer } from '../scriptAnalyzer';
import { Validator } from '../validator';
import { OutputSerializer } from '../outputSerializer';
import { SafeZip } from '../safeZip';
import { ModConverter } from '../modConverter';
import { mapPsychLaneToVSlice } from '../laneMapper';
import JSZip from 'jszip';

describe('Psych Engine ➔ V-Slice Conversion Suite', () => {
  // Test 1: Basic song with standard notes
  it('1. Correctly converts a basic song with standard notes and lane mapping', () => {
    const psychChart = JSON.stringify({
      song: {
        song: 'TestSong',
        bpm: 120,
        speed: 1.5,
        player1: 'bf',
        player2: 'dad',
        notes: [
          {
            sectionNotes: [
              [0, 0, 0], // Left Opponent (mustHit = false)
              [250, 1, 0], // Down Opponent
              [500, 4, 0], // Left Player (note index 4 in mustHit=false is Player)
            ],
            mustHitSection: false,
            lengthInSteps: 16,
          },
          {
            sectionNotes: [
              [1000, 0, 0], // Left Player (note index 0 in mustHit=true is Player)
              [1250, 4, 0], // Left Opponent (note index 4 in mustHit=true is Opponent)
            ],
            mustHitSection: true,
            lengthInSteps: 16,
          },
        ],
      },
    });

    const { song, diagnostics } = SchemaParser.parsePsychChart(psychChart, 'normal');
    expect(song).toBeDefined();
    expect(song!.name).toBe('TestSong');
    expect(song!.bpm).toBe(120);

    const notes = song!.notes.normal;
    expect(notes.length).toBe(5);

    // Section 1 (mustHit: false): V-Slice uses 0..3 for player and 4..7 for opponent.
    // 0 -> Opponent lane 4
    expect(notes[0].lane).toBe(4);
    // 1 -> Opponent lane 5
    expect(notes[1].lane).toBe(5);
    // 4 -> Player lane 0
    expect(notes[2].lane).toBe(0);

    // Section 2 (mustHit: true):
    // 0 -> Player lane 0
    expect(notes[3].lane).toBe(0);
    // 4 -> Opponent lane 4
    expect(notes[4].lane).toBe(4);
  });

  // Test 2: Song with sustain notes
  it('2. Preserves sustain notes and clamps negative lengths', () => {
    const psychChart = JSON.stringify({
      song: {
        song: 'SustainSong',
        bpm: 100,
        notes: [
          {
            sectionNotes: [
              [100, 2, 450], // Valid sustain: Up
              [600, 3, -50], // Negative sustain error
            ],
            mustHitSection: true,
            lengthInSteps: 16,
          },
        ],
      },
    });

    const { song } = SchemaParser.parsePsychChart(psychChart, 'normal');
    const notes = song!.notes.normal;
    expect(notes[0].sustainMs).toBe(450);
    expect(notes[1].sustainMs).toBe(0); // Clamped to 0
  });

  // Test 3: Song with multiple BPM changes
  it('3. Accurately tracks multiple BPM changes across sections with time calculation', () => {
    const psychChart = JSON.stringify({
      song: {
        song: 'BpmSong',
        bpm: 100, // Section 1: 100 BPM (step = 150ms, 16 steps = 2400ms)
        notes: [
          {
            sectionNotes: [[0, 0, 0]],
            lengthInSteps: 16,
            mustHitSection: true,
          },
          {
            sectionNotes: [[2400, 1, 0]],
            lengthInSteps: 16,
            mustHitSection: true,
            changeBPM: true,
            bpm: 150, // Section 2: 150 BPM
          },
          {
            sectionNotes: [[4000, 2, 0]],
            lengthInSteps: 16,
            mustHitSection: true,
            changeBPM: true,
            bpm: 200, // Section 3: 200 BPM
          },
        ],
      },
    });

    const { song } = SchemaParser.parsePsychChart(psychChart, 'normal');
    expect(song!.timeChanges.length).toBe(3);
    expect(song!.timeChanges[0].bpm).toBe(100);
    expect(song!.timeChanges[0].timeMs).toBe(0);
    expect(song!.timeChanges[1].bpm).toBe(150);
    expect(song!.timeChanges[1].timeMs).toBe(2400);
    expect(song!.timeChanges[2].bpm).toBe(200);
  });

  // Test 4: Song with several difficulties
  it('4. Correctly organizes and merges multi-difficulty charts', () => {
    const easyChart = JSON.stringify({
      song: { song: 'MultiDiff', bpm: 120, speed: 1.2, notes: [{ sectionNotes: [[0, 0, 0]], mustHitSection: true }] },
    });
    const hardChart = JSON.stringify({
      song: { song: 'MultiDiff', bpm: 120, speed: 2.2, notes: [{ sectionNotes: [[0, 0, 0], [100, 1, 0]], mustHitSection: true }] },
    });

    const parsedEasy = SchemaParser.parsePsychChart(easyChart, 'easy');
    const parsedHard = SchemaParser.parsePsychChart(hardChart, 'hard');

    expect(parsedEasy.song!.scrollSpeed.easy).toBe(1.2);
    expect(parsedHard.song!.scrollSpeed.hard).toBe(2.2);
    expect(parsedEasy.song!.notes.easy.length).toBe(1);
    expect(parsedHard.song!.notes.hard.length).toBe(2);
  });

  // Test 5: Song with custom note types
  it('5. Preserves custom note types and alt animation flags', () => {
    const psychChart = JSON.stringify({
      song: {
        song: 'NoteTypeSong',
        bpm: 130,
        notes: [
          {
            sectionNotes: [
              [0, 0, 0, 'Hurt Note'],
              [200, 1, 0, 'Alt Animation'],
              [400, 2, 100, 'Warning Note'],
            ],
            mustHitSection: true,
            altAnim: false,
          },
        ],
      },
    });

    const { song } = SchemaParser.parsePsychChart(psychChart, 'normal');
    const notes = song!.notes.normal;
    expect(notes[0].noteType).toBe('Hurt Note');
    expect(notes[1].altAnim).toBe(true);
    expect(notes[2].noteType).toBe('Warning Note');
  });

  // Test 6: Song with events
  it('6. Maps Psych events to official V-Slice event schema and preserves parameters', () => {
    const psychChart = JSON.stringify({
      song: {
        song: 'EventsSong',
        bpm: 140,
        notes: [],
        events: [
          [1000, [['Camera Follow Pos', '120', '80']]],
          [2000, [['Add Camera Zoom', '0.08', '']]],
          [3000, [['Play Animation', 'singUP', 'dad']]],
        ],
      },
    });

    const { song } = SchemaParser.parsePsychChart(psychChart, 'normal');
    expect(song!.events.length).toBe(3);

    expect(song!.events[0].name).toBe('FocusCamera');
    expect(song!.events[0].parameters).toMatchObject({ char: -1, x: 120, y: 80 });
    expect(song!.events[0].supportStatus).toBe('mapped');

    // ZoomCamera is not a registered official V-Slice event ID; preserve it as unsupported.
    expect(song!.events[1].name).toBe('Add Camera Zoom');
    expect(song!.events[1].supportStatus).toBe('unsupported');
    expect(song!.events[1].rawValues).toEqual(['0.08', '']);

    expect(song!.events[2].name).toBe('PlayAnimation');
    expect(song!.events[2].parameters.anim).toBe('singUP');
    expect(song!.events[2].parameters.target).toBe('dad');
    expect(song!.events[2].parameters.force).toBe(true);
  });

  // Test 7: Custom character with multiple animations
  it('7. Converts Psych character definition into V-Slice character schema', () => {
    const psychChar = JSON.stringify({
      animations: [
        { anim: 'idle', name: 'Dad idle', fps: 24, loop: false, offsets: [0, 0] },
        { anim: 'singLEFT', name: 'Dad Sing Left', fps: 24, loop: false, offsets: [-10, 5] },
      ],
      image: 'characters/DADDY_DEAREST',
      healthbar_colors: [175, 102, 206],
      flip_x: false,
      healthicon: 'dad',
      sing_duration: 6.1,
      scale: 1.0,
      camera_position: [50, -50],
      position: [100, 100],
    });

    const { character } = SchemaParser.parsePsychCharacter(psychChar, 'dad');
    expect(character).toBeDefined();
    expect(character!.assetPath).toBe('DADDY_DEAREST');
    expect(character!.healthBarColor).toBe('#af66ce'); // [175, 102, 206]
    expect(character!.animations.length).toBe(2);
    expect(character!.animations[1].offsets).toEqual([-10, 5]);
  });

  // Test 8: Stage with multiple sprites
  it('8. Converts Psych stage JSON into V-Slice stage schema', () => {
    const psychStage = JSON.stringify({
      defaultZoom: 0.85,
      isPixelStage: false,
      camera_speed: 1.2,
      boyfriend: [770, 450],
      girlfriend: [400, 130],
      opponent: [100, 100],
      camera_boyfriend: [20, -10],
      hide_girlfriend: true,
    });

    const { stage } = SchemaParser.parsePsychStage(psychStage, 'mainStage');
    expect(stage).toBeDefined();
    expect(stage!.defaultZoom).toBe(0.85);
    expect(stage!.characters.boyfriend.position).toEqual([770, 450]);
    expect(stage!.characters.girlfriend.hidden).toBe(true);
  });

  // Test 9: Mod with Lua scripts
  it('9. Analyzes Psych Lua scripts and detects callbacks, functions, and issues', () => {
    const luaScript = `
      function onCreate()
        makeLuaSprite('bg', 'stageback', -600, -200)
        addLuaSprite('bg', false)
      end

      function onStepHit()
        if curStep == 64 then
          doTweenZoom('camz', 'camGame', 1.2, 0.5, 'quadInOut')
        end
      end
    `;

    const { script } = ScriptAnalyzer.analyzeLuaScript('data/test/script.lua', luaScript);
    expect(script.detectedCallbacks).toContain('onCreate');
    expect(script.detectedCallbacks).toContain('onStepHit');
    expect(script.detectedFunctions).toContain('makeLuaSprite');
    expect(script.detectedFunctions).toContain('doTweenZoom');
    expect(script.generatedHScriptDraft).toBeDefined();
    expect(script.generatedHScriptDraft).toContain('import flixel.FlxSprite');
  });

  // Test 10: Complete mod containing multiple songs and characters
  it('10. Safely converts a complete mod ZIP package and validates generated V-Slice bundle', async () => {
    const inputZip = new JSZip();

    // Add song
    inputZip.file(
      'data/bopeebo/bopeebo.json',
      JSON.stringify({
        song: {
          song: 'Bopeebo',
          bpm: 100,
          speed: 1.6,
          notes: [{ sectionNotes: [[0, 0, 0], [150, 4, 0]], mustHitSection: true }],
        },
      })
    );

    // Add character
    inputZip.file(
      'characters/bf.json',
      JSON.stringify({
        animations: [{ anim: 'idle', name: 'BF idle', fps: 24, offsets: [0, 0] }],
        image: 'characters/BOYFRIEND',
        healthbar_colors: [49, 176, 213],
      })
    );

    // Add audio asset
    inputZip.file('songs/bopeebo/Inst.ogg', new Uint8Array([0x4f, 0x67, 0x67, 0x53]));

    const zipBuffer = await inputZip.generateAsync({ type: 'uint8array' });
    const result = await ModConverter.convertPsychModZip(zipBuffer, 'MyTestMod.zip', '0.4.x');

    expect(result.success).toBe(true);
    expect(result.stats.songsCount).toBe(1);
    expect(result.stats.charactersCount).toBe(1);
    expect(result.zipBlob).toBeDefined();

    // Verify generated ZIP content structure
    const outputZip = await JSZip.loadAsync(result.zipBlob!);
    expect(outputZip.file('_polymod_meta.json')).not.toBeNull();
    expect(outputZip.file('songs/bopeebo/bopeebo-chart.json')).not.toBeNull();
    expect(outputZip.file('songs/bopeebo/bopeebo-metadata.json')).not.toBeNull();
    expect(outputZip.file('data/characters/bf.json')).not.toBeNull();
    expect(outputZip.file('CONVERSION_REPORT.md')).not.toBeNull();
  });

  // Test 11: Missing assets and malformed JSON
  it('11. Handles malformed JSON and detects missing asset references safely', () => {
    const malformedJson = `{ "song": { "song": "Broken", "bpm": `;
    const { song, diagnostics } = SchemaParser.parsePsychChart(malformedJson);
    expect(song).toBeUndefined();
    expect(diagnostics[0].level).toBe('error');
    expect(diagnostics[0].message).toContain('Syntax error');
  });

  // Test 12: Legacy Psych chart structures
  it('12. Accurately handles legacy Psych chart structures without root song wrapper', () => {
    const legacyChart = JSON.stringify({
      song: 'LegacySong',
      bpm: 110,
      speed: 1.4,
      player1: 'bf',
      player2: 'dad',
      notes: [
        {
          sectionNotes: [[0, 0, 0]],
          mustHitSection: false,
          lengthInSteps: 16,
        },
      ],
    });

    const { song } = SchemaParser.parsePsychChart(legacyChart);
    expect(song).toBeDefined();
    expect(song!.name).toBe('LegacySong');
    expect(song!.notes.normal.length).toBe(1);
  });

  // Test 13: Songpack Multi-Song Discovery (Critical bug fix test!)
  it('13. Discovers multiple songs in a songpack where charts lack song property, preventing overwrites', async () => {
    const songpackZip = new JSZip();

    // Song 1: "niceboy" (no song property in JSON, parent dir is niceboy)
    songpackZip.file(
      'data/niceboy/niceboy-hard.json',
      JSON.stringify({
        notes: [{ sectionNotes: [[0, 0, 0]], mustHitSection: true }],
        bpm: 155,
      })
    );
    // Song 1 easy difficulty
    songpackZip.file(
      'data/niceboy/niceboy-easy.json',
      JSON.stringify({
        notes: [{ sectionNotes: [[0, 0, 0]], mustHitSection: true }],
        bpm: 155,
      })
    );

    // Song 2: "fanchart-two"
    songpackZip.file(
      'data/fanchart-two/hard.json',
      JSON.stringify({
        notes: [{ sectionNotes: [[100, 1, 0]], mustHitSection: false }],
        bpm: 170,
      })
    );

    // Song 3: "speed-clash"
    songpackZip.file(
      'data/speed-clash/speed-clash.json',
      JSON.stringify({
        notes: [{ sectionNotes: [[200, 2, 0]], mustHitSection: true }],
        bpm: 210,
      })
    );

    const buffer = await songpackZip.generateAsync({ type: 'uint8array' });
    const result = await ModConverter.convertPsychModZip(buffer, 'niceboys_fancharts_songpack_1.zip', '0.8.x');

    expect(result.success).toBe(true);
    // Must convert all 3 songs separately, NOT overwrite into a single "Unknown Song"!
    expect(result.stats.songsCount).toBe(3);
    expect(result.outputFileName).toContain('niceboys_fancharts_songpack_1');

    const songIds = Array.from(result.jsonReport.songs.map((s: any) => s.id));
    expect(songIds).toContain('niceboy');
    expect(songIds).toContain('fanchart-two');
    expect(songIds).toContain('speed-clash');

    // niceboy should have both easy and hard difficulties merged into the same song
    const niceboySong = result.jsonReport.songs.find((s: any) => s.id === 'niceboy');
    expect(niceboySong.difficulties).toContain('hard');
    expect(niceboySong.difficulties).toContain('easy');
    expect(niceboySong.bpm).toBe(155);
  });

  // Test 14: Deterministic BPM recovery rules
  it('14. Recovers BPM from section 0 or events when root is missing, and marks unrecovered as fallback', () => {
    // 14a. Recovered from section 0
    const chartSectionBpm = JSON.stringify({
      song: {
        song: 'SectionBpmSong',
        bpm: 0, // Invalid root BPM
        notes: [{ sectionNotes: [], bpm: 165, mustHitSection: true }],
      },
    });
    const resA = SchemaParser.parsePsychChart(chartSectionBpm);
    expect(resA.song!.bpm).toBe(165);
    expect(resA.song!.bpmDerived).toBe(true);
    expect(resA.song!.bpmSource).toBe('section');

    // 14b. Recovered from Change BPM event
    const chartEventBpm = JSON.stringify({
      song: {
        song: 'EventBpmSong',
        notes: [{ sectionNotes: [] }],
        events: [[0, [['Change BPM', '185', '']]]],
      },
    });
    const resB = SchemaParser.parsePsychChart(chartEventBpm);
    expect(resB.song!.bpm).toBe(185);
    expect(resB.song!.bpmDerived).toBe(true);
    expect(resB.song!.bpmSource).toBe('event');

    // 14c. Completely missing BPM marked as fallback-unverified
    const chartMissingBpm = JSON.stringify({
      song: {
        song: 'NoBpmSong',
        notes: [{ sectionNotes: [] }],
      },
    });
    const resC = SchemaParser.parsePsychChart(chartMissingBpm);
    expect(resC.song!.bpm).toBe(100);
    expect(resC.song!.bpmDerived).toBe(false);
    expect(resC.song!.bpmSource).toBe('fallback-unverified');
    expect(resC.diagnostics.some((d) => d.level === 'warning' && d.message.includes('fallback'))).toBe(true);
  });

  // Test 15: Song-specific event merging and deduplication
  it('15. Merges events only to their corresponding song once, without leaking across songs', async () => {
    const pack = new JSZip();

    // Song A with dedicated events.json
    pack.file('data/song-alpha/song-alpha-hard.json', JSON.stringify({ song: 'song-alpha', bpm: 120, notes: [] }));
    pack.file('data/song-alpha/song-alpha-easy.json', JSON.stringify({ song: 'song-alpha', bpm: 120, notes: [] }));
    pack.file(
      'data/song-alpha/events.json',
      JSON.stringify({
        events: [[1200, [['Camera Follow Pos', '1', '']]]],
      })
    );

    // Song B with dedicated events.json
    pack.file('data/song-beta/song-beta.json', JSON.stringify({ song: 'song-beta', bpm: 140, notes: [] }));
    pack.file(
      'data/song-beta/events.json',
      JSON.stringify({
        events: [[2400, [['Add Camera Zoom', '0.1', '']]]],
      })
    );

    const buffer = await pack.generateAsync({ type: 'uint8array' });
    const result = await ModConverter.convertPsychModZip(buffer, 'PackEventsTest.zip', '0.8.x');

    const songAlpha = result.jsonReport.songs.find((s: any) => s.id === 'song-alpha');
    const songBeta = result.jsonReport.songs.find((s: any) => s.id === 'song-beta');

    // Events must only belong to songAlpha (exactly 1 event, not re-merged for each difficulty!)
    expect(songAlpha.eventsCount).toBe(1);

    // Events must only belong to songBeta
    expect(songBeta.eventsCount).toBe(1);
  });

  // Test 16: Complete file manifest and evidence-based status
  it('16. Generates full source file manifest and computes evidence-based status', async () => {
    const pack = new JSZip();
    pack.file('data/test/test-hard.json', JSON.stringify({ song: 'test', bpm: 130, notes: [] }));
    pack.file('songs/test/Inst.ogg', new Uint8Array([0x4f, 0x67, 0x67, 0x53]));

    const buffer = await pack.generateAsync({ type: 'uint8array' });
    const result = await ModConverter.convertPsychModZip(buffer, 'ManifestTest.zip', '0.8.x');

    expect(result.fileManifest.length).toBeGreaterThanOrEqual(2);
    expect(result.fileManifest.some((m) => m.classifiedType === 'chart' && m.conversionResult === 'converted')).toBe(true);
    expect(result.fileManifest.some((m) => m.classifiedType === 'audio' && m.conversionResult === 'copied')).toBe(true);
    expect(result.status).toBe('Converted and validated');
  });

  // Test 17: Asset path normalization (audio in data/ and character images outside images/)
  it('17. Normalizes audio paths and character image paths according to V-Slice Polymod requirements', async () => {
    const pack = new JSZip();
    pack.file('data/my-song/my-song.json', JSON.stringify({ song: 'my-song', bpm: 120, notes: [] }));
    // Audio placed inside data/<song>/
    pack.file('data/my-song/Inst.ogg', new Uint8Array([0x4f, 0x67, 0x67, 0x53]));
    pack.file('data/my-song/Voices.ogg', new Uint8Array([0x4f, 0x67, 0x67, 0x53]));
    // Character atlas placed directly in characters/
    pack.file('characters/custom_char.png', new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
    pack.file('characters/custom_char.xml', '<TextureAtlas imagePath="custom_char.png"></TextureAtlas>');

    const buffer = await pack.generateAsync({ type: 'uint8array' });
    const result = await ModConverter.convertPsychModZip(buffer, 'AssetNormalizationTest.zip', '0.8.x');

    // Unpack generated result to verify files inside ZIP
    const { files: outputFiles } = await SafeZip.unpackZip(result.zipBlob!);

    // Audio should be mirrored to songs/my-song/Inst.ogg and Voices.ogg for V-Slice audio loader
    expect(outputFiles.has('songs/my-song/Inst.ogg')).toBe(true);
    expect(outputFiles.has('songs/my-song/Voices.ogg')).toBe(true);

    // Character assets should be mirrored to images/characters/ for Paths.image() resolution
    expect(outputFiles.has('images/characters/custom_char.png')).toBe(true);
    expect(outputFiles.has('images/characters/custom_char.xml')).toBe(true);
  });

  // Test 18: Full V-Slice 0.8.x and 0.4.x schema compliance
  it('18. Output conforms strictly to verified V-Slice 0.8.x schema in docs/FORMAT_MAPPING.md', async () => {
    const pack = new JSZip();
    pack.file(
      'data/bopeebo/bopeebo.json',
      JSON.stringify({
        song: {
          song: 'Bopeebo',
          bpm: 100,
          speed: 1.6,
          player1: 'bf',
          player2: 'dad',
          gfVersion: 'gf',
          stage: 'stage',
          notes: [
            {
              mustHitSection: true,
              lengthInSteps: 16,
              sectionNotes: [[0, 0, 0, '']],
            },
          ],
        },
      })
    );

    const buffer = await pack.generateAsync({ type: 'uint8array' });
    const result = await ModConverter.convertPsychModZip(buffer, 'BopeeboTest.zip', '0.8.x');
    const { files: outputFiles } = await SafeZip.unpackZip(result.zipBlob!);

    // Polymod metadata
    expect(outputFiles.has('_polymod_meta.json')).toBe(true);
    const polymodMeta = JSON.parse(outputFiles.get('_polymod_meta.json')!.text!);
    expect(polymodMeta.api_version).toBe('0.8.0');
    expect(polymodMeta.title).toBe('BopeeboTest');

    // Chart schema
    expect(outputFiles.has('songs/bopeebo/bopeebo-chart.json')).toBe(true);
    const chart = JSON.parse(outputFiles.get('songs/bopeebo/bopeebo-chart.json')!.text!);
    expect(chart.version).toBe('2.0.0');
    expect(chart.scrollSpeed).toHaveProperty('default');
    expect(chart.notes).toHaveProperty('normal');
    expect(chart.events).toBeInstanceOf(Array);

    // Metadata schema
    expect(outputFiles.has('songs/bopeebo/bopeebo-metadata.json')).toBe(true);
    const meta = JSON.parse(outputFiles.get('songs/bopeebo/bopeebo-metadata.json')!.text!);
    expect(meta.version).toBe('2.2.4');
    expect(meta.songName).toBe('Bopeebo');
    expect(meta.playData.characters.player).toBe('bf');
    expect(meta.playData.stage).toBe('stage');
    expect(meta.timeChanges[0].bpm).toBe(100);
    expect(meta.generatedBy).toBe('FNFCOV Psych-to-V-Slice Mod Converter');
    expect(meta.offsets.instrumental).toBe(0);
    expect(meta.playData.songVariations).toEqual([]);
  });

  // Test 19: Exhaustive lane mapping tests for all lanes and both mustHitSection values
  it('19. Exhaustively tests dedicated lane mapping for all indexes 0..11 and out-of-range', () => {
    // When mustHitSection is false, V-Slice data 0..3 is player and 4..7 is opponent.
    // 0..3 -> Opponent 4..7 (Left, Down, Up, Right)
    // 4..7 -> Player 0..3 (Left, Down, Up, Right)
    // 8..11 -> Extra/GF 8..11 (Left, Down, Up, Right)
    for (let i = 0; i < 4; i++) {
      const res = mapPsychLaneToVSlice(i, false);
      expect(res.lane).toBe(4 + i);
      expect(res.direction).toBe(i);
      expect(res.targetSide).toBe('opponent');
      expect(res.isThirdStrumline).toBe(false);
    }
    for (let i = 4; i < 8; i++) {
      const res = mapPsychLaneToVSlice(i, false);
      expect(res.lane).toBe(i % 4);
      expect(res.direction).toBe(i % 4);
      expect(res.targetSide).toBe('player');
      expect(res.isThirdStrumline).toBe(false);
    }
    for (let i = 8; i < 12; i++) {
      const res = mapPsychLaneToVSlice(i, false);
      expect(res.lane).toBe(i);
      expect(res.direction).toBe(i % 4);
      expect(res.targetSide).toBe('extra');
      expect(res.isThirdStrumline).toBe(true);
    }

    // When mustHitSection is true:
    // 0..3 -> Player 0..3 (Left, Down, Up, Right)
    // 4..7 -> Opponent 4..7 (Left, Down, Up, Right)
    // 8..11 -> Extra/GF 8..11 (Left, Down, Up, Right)
    for (let i = 0; i < 4; i++) {
      const res = mapPsychLaneToVSlice(i, true);
      expect(res.lane).toBe(i);
      expect(res.direction).toBe(i);
      expect(res.targetSide).toBe('player');
      expect(res.isThirdStrumline).toBe(false);
    }
    for (let i = 4; i < 8; i++) {
      const res = mapPsychLaneToVSlice(i, true);
      expect(res.lane).toBe(i);
      expect(res.direction).toBe(i % 4);
      expect(res.targetSide).toBe('opponent');
      expect(res.isThirdStrumline).toBe(false);
    }
    for (let i = 8; i < 12; i++) {
      const res = mapPsychLaneToVSlice(i, true);
      expect(res.lane).toBe(i);
      expect(res.direction).toBe(i % 4);
      expect(res.targetSide).toBe('extra');
      expect(res.isThirdStrumline).toBe(true);
    }

    // Out of range (extended strumline 12+)
    const extendedRes = mapPsychLaneToVSlice(12, true);
    expect(extendedRes.isThirdStrumline).toBe(true);
    expect(extendedRes.lane).toBe(8);
    expect(extendedRes.warning).toBeDefined();
  });

  // Test 20: Primary Regression Case — "niceboys fancharts songpack 1"
  it('20. Regression: Songpack with multiple songs and difficulties is not collapsed into one "Unknown Song"', async () => {
    const pack = new JSZip();

    // Chart 1: "niceboy" (easy, normal, hard) in a songpack directory
    // Even if chart JSON has a generic "song": "Unknown Song" or empty,
    // the converter MUST identify the song from path/folder/filename!
    pack.file(
      'niceboys fancharts songpack 1/data/niceboy/niceboy-easy.json',
      JSON.stringify({
        song: {
          song: 'Unknown Song', // Generic placeholder in template
          bpm: 145,
          notes: [{ mustHitSection: true, lengthInSteps: 16, sectionNotes: [[0, 0, 0]] }],
        },
      })
    );
    pack.file(
      'niceboys fancharts songpack 1/data/niceboy/niceboy.json',
      JSON.stringify({
        song: {
          song: 'Unknown Song',
          bpm: 145,
          notes: [{ mustHitSection: true, lengthInSteps: 16, sectionNotes: [[0, 1, 0]] }],
        },
      })
    );
    pack.file(
      'niceboys fancharts songpack 1/data/niceboy/niceboy-hard.json',
      JSON.stringify({
        song: {
          song: 'Unknown Song',
          bpm: 145,
          notes: [{ mustHitSection: true, lengthInSteps: 16, sectionNotes: [[0, 2, 0]] }],
        },
      })
    );
    pack.file(
      'niceboys fancharts songpack 1/data/niceboy/events.json',
      JSON.stringify({
        events: [[500, [['Add Camera Zoom', '0.05', '0.02']]]],
      })
    );
    pack.file('niceboys fancharts songpack 1/songs/niceboy/Inst.ogg', new Uint8Array([0x4f, 0x67, 0x67, 0x53]));

    // Chart 2: "fanchart-remix" (normal and hard)
    pack.file(
      'niceboys fancharts songpack 1/data/fanchart-remix/fanchart-remix.json',
      JSON.stringify({
        song: {
          song: '', // Empty song string
          bpm: 170,
          notes: [{ mustHitSection: false, lengthInSteps: 16, sectionNotes: [[0, 0, 0]] }],
        },
      })
    );
    pack.file(
      'niceboys fancharts songpack 1/data/fanchart-remix/fanchart-remix-hard.json',
      JSON.stringify({
        song: {
          bpm: 170,
          notes: [{ mustHitSection: false, lengthInSteps: 16, sectionNotes: [[0, 3, 0]] }],
        },
      })
    );
    pack.file('niceboys fancharts songpack 1/songs/fanchart-remix/Inst.ogg', new Uint8Array([0x4f, 0x67, 0x67, 0x53]));

    // Chart 3: "b-side-duel" (hard only)
    pack.file(
      'niceboys fancharts songpack 1/data/b-side-duel/hard.json',
      JSON.stringify({
        song: {
          song: 'B-Side Duel',
          bpm: 190,
          notes: [{ mustHitSection: true, lengthInSteps: 16, sectionNotes: [[0, 0, 0]] }],
        },
      })
    );
    pack.file('niceboys fancharts songpack 1/songs/b-side-duel/Inst.ogg', new Uint8Array([0x4f, 0x67, 0x67, 0x53]));

    const buffer = await pack.generateAsync({ type: 'uint8array' });
    const result = await ModConverter.convertPsychModZip(buffer, 'niceboys_fancharts_songpack_1.zip', '0.8.x');

    // 1. MUST discover 3 distinct songs, NOT 1!
    expect(result.stats.songsCount).toBe(3);

    // 2. Song IDs must be derived properly and NOT be "unknown-song"
    expect(result.jsonReport.songs.some((s: any) => s.id === 'niceboy')).toBe(true);
    expect(result.jsonReport.songs.some((s: any) => s.id === 'fanchart-remix')).toBe(true);
    expect(result.jsonReport.songs.some((s: any) => s.id === 'b-side-duel')).toBe(true);
    expect(result.jsonReport.songs.some((s: any) => s.id === 'unknown-song')).toBe(false);

    // 3. Difficulties must be merged into their parent song
    const niceboySong = result.jsonReport.songs.find((s: any) => s.id === 'niceboy');
    expect(niceboySong.difficulties).toContain('easy');
    expect(niceboySong.difficulties).toContain('normal');
    expect(niceboySong.difficulties).toContain('hard');

    // 4. Events must only be merged into "niceboy", exactly once
    expect(niceboySong.eventsCount).toBe(1);

    // 5. BPMs are verified from charts (145, 170, 190), NOT fallen back to 100!
    expect(niceboySong.bpm).toBe(145);
    expect(niceboySong.bpmSource).toBe('chart');
  });

  // Test 21: BPM precedence and unverified fallback flagging
  it('21. Properly enforces BPM precedence and flags unverified BPM as "Requires manual repair"', async () => {
    const pack = new JSZip();

    // Chart with missing BPM anywhere
    pack.file(
      'data/nobpm/nobpm.json',
      JSON.stringify({
        song: {
          song: 'No Bpm Song',
          // no bpm, no section bpm, no events
          notes: [{ mustHitSection: true, sectionNotes: [[0, 0, 0]] }],
        },
      })
    );

    const buffer = await pack.generateAsync({ type: 'uint8array' });
    const result = await ModConverter.convertPsychModZip(buffer, 'NoBpmTest.zip', '0.8.x');

    const song = result.jsonReport.songs[0];
    expect(song.bpmSource).toBe('fallback-unverified');
    expect(song.bpm).toBe(100);

    // Because BPM was unverified, status must be "Requires manual repair", NEVER "Converted and validated"
    expect(result.status).toBe('Requires manual repair');
  });

  // Test 22: Script compatibility analysis and manual adaptation status
  it('22. Analyzes complex Lua scripts, generates HScript skeleton, and reports manual repair status', async () => {
    const pack = new JSZip();

    pack.file('data/mysong/mysong.json', JSON.stringify({ song: 'mysong', bpm: 120, notes: [] }));
    pack.file('songs/mysong/Inst.ogg', new Uint8Array([0x4f, 0x67, 0x67, 0x53]));

    // Complex Lua script using custom shaders and OS FFI
    const complexLua = `
      function onCreate()
        initLuaShader("vignette")
        setSpriteShader("bg", "vignette")
      end
    `;
    pack.file('scripts/shader_fx.lua', complexLua);

    const buffer = await pack.generateAsync({ type: 'uint8array' });
    const result = await ModConverter.convertPsychModZip(buffer, 'ShaderModTest.zip', '0.8.x');

    expect(result.stats.scriptsCount).toBe(1);
    const script = result.jsonReport.scripts[0];
    expect(script.compatibility).toBe('manual');
    expect(script.issues.some((i: string) => i.includes('Shader'))).toBe(true);

    // Status must reflect manual work needed
    expect(result.status).toBe('Requires manual repair');

    // HScript skeleton must be generated
    const { files: outputFiles } = await SafeZip.unpackZip(result.zipBlob!);
    expect(outputFiles.has('scripts/shader_fx.hscript')).toBe(true);
  });

  // Test 23: Standalone songpack without week or stage files
  it('23. Handles standalone songpacks without fabricating fake weeks and logs informative notices', async () => {
    const pack = new JSZip();
    pack.file('data/freeplay-only/freeplay-only.json', JSON.stringify({ song: 'freeplay-only', bpm: 130, notes: [] }));
    pack.file('songs/freeplay-only/Inst.ogg', new Uint8Array([0x4f, 0x67, 0x67, 0x53]));

    const buffer = await pack.generateAsync({ type: 'uint8array' });
    const result = await ModConverter.convertPsychModZip(buffer, 'StandaloneSongpack.zip', '0.8.x');

    expect(result.stats.weeksCount).toBe(0);
    expect(result.stats.stagesCount).toBe(0);

    // Diagnostics should inform user of native Freeplay registration
    expect(result.diagnostics.some((d) => d.message.includes('Standalone songpack detected'))).toBe(true);
    expect(result.diagnostics.some((d) => d.message.includes('default V-Slice stage'))).toBe(true);
  });
  // Test 24: JSON assets under data/ are not all charts
  it('24. Preserves non-chart JSON inside a song data folder without parsing it as a song', async () => {
    const pack = new JSZip();
    pack.file('data/test-song/test-song.json', JSON.stringify({
      song: { song: 'test-song', bpm: 120, notes: [{ sectionNotes: [], mustHitSection: true }] },
    }));
    pack.file('data/test-song/metadata-custom.json', JSON.stringify({
      title: 'Custom metadata',
      credits: ['artist'],
    }));

    const buffer = await pack.generateAsync({ type: 'uint8array' });
    const result = await ModConverter.convertPsychModZip(buffer, 'JsonClassificationTest.zip', '0.8.x');
    const { files: outputFiles } = await SafeZip.unpackZip(result.zipBlob!);

    expect(result.stats.songsCount).toBe(1);
    expect(outputFiles.has('data/test-song/metadata-custom.json')).toBe(true);
    expect(JSON.parse(outputFiles.get('data/test-song/metadata-custom.json')!.text!).title).toBe('Custom metadata');
  });

});
