# Psych Engine ➔ Friday Night Funkin' V-Slice Format Specification & Mapping

This document provides a comprehensive, field-by-field and path-by-path specification comparing **Psych Engine** (v0.6.3 – v1.0.x) with the official **Friday Night Funkin' V-Slice** (v0.4.x / v0.8.x / v0.8.1+) Polymod format.

---

## 1. Authoritative Reference Sources

1. **Official FNF Modding Documentation**:  
   [https://funkincrew.github.io/funkin-modding-docs/](https://funkincrew.github.io/funkin-modding-docs/)
2. **Official Documentation Source Repository**:  
   [https://github.com/FunkinCrew/funkin-modding-docs](https://github.com/FunkinCrew/funkin-modding-docs)
3. **Psych Engine Source Repository**:  
   [https://github.com/ShadowMario/FNF-PsychEngine](https://github.com/ShadowMario/FNF-PsychEngine)
4. **Psych Engine Wiki & Documentation**:  
   [https://github.com/ShadowMario/FNF-PsychEngine/wiki](https://github.com/ShadowMario/FNF-PsychEngine/wiki)
5. **Psych Engine Lua Scripting API Reference**:  
   [https://shadowmario.github.io/psychengine.lua/](https://shadowmario.github.io/psychengine.lua/)
6. **V-Stuff (Reference Psych ➔ V-Slice Tool by Brenninho123)**:  
   [https://brenninho123.github.io/V-Stuff/](https://brenninho123.github.io/V-Stuff/)

---

## 2. Directory Structure Comparison

### 2.1 Psych Engine Mod Structure (Source)

```
<mod_root>/
├── mod.json                     (Optional Psych mod metadata)
├── data/
│   └── <song_id>/
│       ├── <song_id>.json       (Normal difficulty chart or bundled chart)
│       ├── <song_id>-easy.json  (Easy difficulty chart)
│       ├── <song_id>-hard.json  (Hard difficulty chart)
│       ├── <song_id>-erect.json (Erect difficulty chart)
│       └── events.json          (Separate song events stream)
├── songs/
│   └── <song_id>/
│       ├── Inst.ogg             (Instrumental track)
│       ├── Voices.ogg           (Combined vocal track)
│       ├── Voices-bf.ogg        (Player vocal track)
│       └── Voices-opponent.ogg  (Opponent vocal track)
├── characters/
│   ├── <character_id>.json      (Character definition)
│   └── ...
├── stages/
│   ├── <stage_id>.json          (Stage definition JSON)
│   └── <stage_id>.lua           (Stage script or Lua-only stage)
├── weeks/
│   ├── <week_id>.json           (Story week definition)
│   └── ...
├── scripts/
│   └── <script_name>.lua        (Global mod scripts)
├── custom_events/
│   └── <event_name>.lua / .txt  (Custom event definitions)
├── images/
│   ├── characters/
│   │   ├── <char>.png           (Sprite sheet)
│   │   └── <char>.xml           (Sparrow atlas XML)
│   ├── icons/
│   │   └── icon-<char>.png      (Health bar icon)
│   └── ...
└── sounds/ / music/             (SFX and menu music)
```

### 2.2 Official FNF V-Slice Structure (Target, v0.8.x & v0.4.x)

```
<target_mod_root>/
├── _polymod_meta.json                  (Required Polymod metadata)
├── data/
│   ├── songs/
│   │   └── <song_id>/
│   │       ├── <song_id>-chart.json    (Unified multi-difficulty chart & events)
│   │       └── <song_id>-metadata.json (Song metadata, timing changes, character refs)
│   ├── characters/
│   │   └── <character_id>.json         (Target character schema v1.0.0)
│   ├── stages/
│   │   └── <stage_id>.json             (Target stage schema v1.0.0)
│   └── levels/
│       └── <level_id>.json             (Target week/level schema v1.0.0)
├── songs/
│   └── <song_id>/
│       ├── Inst.ogg                    (Default instrumental)
│       ├── Inst-erect.ogg              (Erect variation instrumental)
│       ├── Voices.ogg                  (Default voices)
│       ├── Voices-player.ogg           (Player voices)
│       └── Voices-opponent.ogg         (Opponent voices)
├── images/
│   ├── characters/
│   │   ├── <char>.png
│   │   └── <char>.xml
│   └── icons/
│       └── icon-<char>.png
├── scripts/
│   └── <script_name>.hscript           (HScript bridge scripts)
├── CONVERSION_REPORT.md                (Detailed human-readable audit log)
└── CONVERSION_REPORT.json              (Machine-readable diagnostics manifest)
```

---

## 3. Mod Metadata: `_polymod_meta.json`

### Source Format (Psych Engine)
- File: `mod.json` or `pack.json` at mod root (often missing in loose mods or songpacks).
- Fields: `name`, `description`, `color`, `restart`, `runsOnVersion`.

### Target Format (V-Slice Polymod)
- File: `_polymod_meta.json` at mod root (**Mandatory** for Polymod engine discovery).

```json
{
  "title": "My Converted Mod",
  "description": "Converted from Psych Engine using FNFCOV Mod Converter.",
  "author": "Psych Engine Modder",
  "api_version": "0.8.0",
  "mod_version": "1.0.0",
  "license": "Apache 2.0"
}
```

| Target Property | Type | Requirement | Description |
|---|---|---|---|
| `title` | `string` | **Required** | Display name of the mod in the V-Slice mods menu. |
| `description` | `string` | **Required** | Short summary of the mod. |
| `author` | `string` | **Required** | Mod creator or charter name. |
| `api_version` | `string` | **Required** | Polymod API compatibility (`0.8.0` for 0.8.x, `0.4.0` for 0.4.x). |
| `mod_version` | `string` | **Required** | Semantic versioning string (`1.0.0`). |
| `license` | `string` | **Required** | Mod licensing statement. |

---

## 4. Song Chart Schema: `<song_id>-chart.json`

### 4.1 Psych Engine Source Schema
In Psych Engine, charts are stored per-difficulty in `data/<song_id>/<difficulty>.json`:
```json
{
  "song": {
    "song": "Bopeebo",
    "bpm": 100,
    "speed": 1.6,
    "needsVoices": true,
    "player1": "bf",
    "player2": "dad",
    "gfVersion": "gf",
    "stage": "stage",
    "notes": [
      {
        "lengthInSteps": 16,
        "mustHitSection": true,
        "bpm": 100,
        "changeBPM": false,
        "sectionNotes": [
          [0.0, 4, 0.0, ""],
          [240.0, 5, 120.0, "Alt Animation"]
        ]
      }
    ],
    "events": [
      [2400.0, [["Add Camera Zoom", "0.05", "0.03"]]]
    ]
  }
}
```

*Legacy Exception*: Older Psych Engine 0.3 - 0.5 charts set `"song": "Bopeebo"` as a string at root, with `bpm`, `speed`, and `notes` siblings to `song`. The converter normalizes both automatically.

### 4.2 Official V-Slice Target Schema
File: `data/songs/<song_id>/<song_id>-chart.json`
```json
{
  "version": "2.0.0",
  "scrollSpeed": {
    "easy": 1.4,
    "normal": 1.6,
    "hard": 1.8,
    "default": 1.6
  },
  "events": [
    {
      "t": 2400.0,
      "e": "ZoomCamera",
      "v": {
        "zoom": 0.05,
        "rate": 0.03
      }
    }
  ],
  "notes": {
    "normal": [
      {
        "t": 0.0,
        "d": 4
      },
      {
        "t": 240.0,
        "d": 5,
        "l": 120.0,
        "k": "Alt Animation"
      }
    ]
  },
  "generatedBy": "FNFCOV Psych-to-V-Slice Mod Converter"
}
```

### 4.3 Detailed Chart Field Mapping

| Psych Engine (Source) | V-Slice (Target) | Conversion Rule |
|---|---|---|
| `song.speed` | `scrollSpeed[difficulty]` | Copied into difficulty map; `default` set to normal or fallback (1.6). |
| `sectionNotes[i][0]` | `note.t` | Timestamp in milliseconds (float rounded to 2 decimal places). |
| `sectionNotes[i][1]` + `mustHitSection` | `note.d` | **Explicit Lane Mapping** (see section 4.4). |
| `sectionNotes[i][2]` | `note.l` | Sustain length in ms. Omitted if `0` or negative. |
| `sectionNotes[i][3]` | `note.k` | Note kind/type string. Omitted if empty or `"Default Note"`. |
| `song.events` + `events.json` | `events` | Merged into unified array ordered by timestamp `t`. |

### 4.4 Lane / Direction Mapping Rules

In Psych Engine, notes in a section use relative index 0..7 depending on `mustHitSection`:

```
Psych Engine:
If mustHitSection == true:
  Lanes 0..3: Boyfriend (Player)
  Lanes 4..7: Dad / Opponent
If mustHitSection == false:
  Lanes 0..3: Dad / Opponent
  Lanes 4..7: Boyfriend (Player)

V-Slice Target Schema:
  Lanes 0..3: Opponent (Left=0, Down=1, Up=2, Right=3)
  Lanes 4..7: Player / Boyfriend (Left=4, Down=5, Up=6, Right=7)
  Lanes 8..11: Girlfriend / Third Strumline (Left=8, Down=9, Up=10, Right=11)
```

**Conversion Formula**:
```ts
let targetLane = sourceLane % 4;
if (sourceLane < 4) {
  // Lanes 0..3
  targetLane = mustHitSection ? targetLane + 4 : targetLane;
} else if (sourceLane < 8) {
  // Lanes 4..7
  targetLane = mustHitSection ? targetLane : targetLane + 4;
} else {
  // Lanes 8+ (GF or extra strumline)
  targetLane = 8 + (sourceLane % 4);
}
```

---

## 5. Song Metadata Schema: `<song_id>-metadata.json`

File: `data/songs/<song_id>/<song_id>-metadata.json`

### Target JSON Example
```json
{
  "version": "2.2.4",
  "songName": "Bopeebo",
  "artist": "Kawai Sprite",
  "charter": "ninja_muffin99",
  "divisions": 16,
  "looped": false,
  "playData": {
    "album": "volume1",
    "characters": {
      "player": "bf",
      "girlfriend": "gf",
      "opponent": "dad"
    },
    "stage": "stage",
    "noteStyle": "funkin",
    "ratings": {},
    "difficulties": ["easy", "normal", "hard"]
  },
  "timeChanges": [
    {
      "t": 0.0,
      "b": 0.0,
      "bpm": 100.0,
      "n": 4,
      "d": 4,
      "bt": [4, 4, 4, 4]
    }
  ],
  "timeFormat": "ms"
}
```

### Field Derivation & BPM Recovery Rules
1. **`songName`**: Recovered via `deriveSongIdentifier`:
   - `root.song.song` ➔ `root.song.songName` ➔ parent folder name ➔ filename stripped of difficulty suffixes.
2. **`timeChanges` / Base BPM**:
   - Step 1: Chart root `song.bpm`.
   - Step 2: First section BPM `notes[0].bpm`.
   - Step 3: Sections with `changeBPM == true`.
   - Step 4: Step 0 `Change BPM` events.
   - If recovery is impossible, set to 100 with diagnostic status `'fallback-unverified'` and flag conversion as `"Requires manual repair"`.
3. **`playData.characters`**:
   - `player` ➔ `song.player1` (default `"bf"`)
   - `opponent` ➔ `song.player2` (default `"dad"`)
   - `girlfriend` ➔ `song.gfVersion` || `song.player3` (default `"gf"`)
4. **`playData.stage`**:
   - `song.stage` (default `"stage"`)

---

## 6. Event Registry & Translation

Psych Engine uses array-based events `[timeMs, [[eventName, value1, value2]]]`. V-Slice uses structured objects `{ "t": float, "e": string, "v": object }`.

| Psych Engine Event | V-Slice Target Event | Parameter Mapping (`v`) |
|---|---|---|
| `Camera Follow Pos` | `FocusCamera` | `char`: 0=opponent, 1=player, 2=gf. Or `x`, `y` coordinates. |
| `Add Camera Zoom` | `ZoomCamera` | `zoom`: float(val1), `rate`: float(val2) |
| `Play Animation` | `PlayAnimation` | `anim`: val1, `target`: val2 (or player/opponent) |
| `Hey!` | `Hey` | `target`: val1, `duration`: float(val2) |
| `Alt Idle Animation` | `AltIdle` | `target`: val1, `alt`: val2 |
| `Screen Shake` | `ScreenShake` | `intensity`: float(val1), `duration`: float(val2) |
| `Change BPM` | `ChangeBPM` | `bpm`: float(val1) |
| `Camera Flash` | `CameraFlash` | `color`: val1, `duration`: float(val2) |

---

## 7. Character Schema: `data/characters/<character_id>.json`

### 7.1 Psych Source Schema
File: `characters/<character_id>.json`
```json
{
  "image": "characters/BOYFRIEND",
  "animations": [
    {
      "anim": "idle",
      "name": "BF idle dance",
      "fps": 24,
      "loop": false,
      "indices": [],
      "offsets": [-5, 0]
    }
  ],
  "scale": 1.0,
  "sing_duration": 4.0,
  "healthicon": "bf",
  "flip_x": true,
  "healthbar_colors": [49, 176, 209],
  "camera_position": [0, 0],
  "position": [0, 350]
}
```

### 7.2 V-Slice Target Schema
File: `data/characters/<character_id>.json`
```json
{
  "version": "1.0.0",
  "name": "Boyfriend",
  "assetPath": "characters/BOYFRIEND",
  "renderType": "sparrow",
  "scale": 1.0,
  "singDuration": 4.0,
  "flipX": true,
  "healthIcon": {
    "id": "bf",
    "scale": 1.0,
    "flipX": false
  },
  "healthBarColor": "#31B0D1",
  "positionOffsets": [0, 350],
  "cameraOffsets": [0, 0],
  "animations": [
    {
      "name": "idle",
      "prefix": "BF idle dance",
      "fps": 24,
      "looped": false,
      "frameIndices": [],
      "offsets": [-5, 0]
    }
  ]
}
```

---

## 8. Stage Schema: `data/stages/<stage_id>.json`

### 8.1 Psych Source Schema
File: `stages/<stage_id>.json` (or defined in `stages/<stage_id>.lua`)
```json
{
  "directory": "",
  "defaultZoom": 0.9,
  "isPixelStage": false,
  "boyfriend": [770, 100],
  "girlfriend": [400, 130],
  "opponent": [100, 100],
  "hide_girlfriend": false,
  "camera_speed": 1.0
}
```

### 8.2 V-Slice Target Schema
File: `data/stages/<stage_id>.json`
```json
{
  "version": "1.0.0",
  "name": "Stage",
  "defaultZoom": 0.9,
  "isPixel": false,
  "cameraSpeed": 1.0,
  "characters": {
    "boyfriend": {
      "position": [770, 100],
      "cameraOffsets": [0, 0]
    },
    "girlfriend": {
      "position": [400, 130],
      "cameraOffsets": [0, 0],
      "hidden": false
    },
    "opponent": {
      "position": [100, 100],
      "cameraOffsets": [0, 0]
    }
  },
  "props": []
}
```

---

## 9. Level / Week Schema: `data/levels/<level_id>.json`

File: `data/levels/<level_id>.json`

```json
{
  "version": "1.0.0",
  "name": "Week 1",
  "songs": ["bopeebo", "fresh", "dad-battle"],
  "difficulties": ["easy", "normal", "hard"],
  "characters": {
    "opponent": "dad",
    "player": "bf",
    "girlfriend": "gf"
  },
  "unlocked": true,
  "hideStoryMode": false,
  "hideFreeplay": false
}
```

*Note on Songpacks*: Standalone songpacks and fancharts do not contain week JSONs. The converter transparently notes:
`"Songpack Format Detected: Mod contains standalone song charts. Uses default engine stage and Freeplay mode."`

---

## 10. Script Compatibility & Translation

Psych Engine uses **Lua** via Sol2 / LincLua. Official FNF V-Slice uses **HScript** via Polymod.

### Callback Mapping
| Psych Engine Lua Callback | V-Slice HScript (Polymod) | Status |
|---|---|---|
| `onCreate()` | `function onCreate()` | Supported |
| `onUpdate(elapsed)` | `function onUpdate(elapsed:Float)` | Supported |
| `onStepHit()` | `function onStepHit()` | Supported |
| `onBeatHit()` | `function onBeatHit()` | Supported |
| `goodNoteHit(id, dir, type, sus)` | `function onNoteHit(event)` | Partial (different event object) |
| `opponentNoteHit(id, dir, type, sus)` | `function onNoteHit(event)` | Partial |
| `onTweenCompleted(tag)` | `FlxTween` onComplete callback | Automatic wrapper |

### Unsupported Features Requiring Manual HScript
- Custom GLSL Shaders (`initLuaShader`, `setSpriteShader`).
- Operating system level FFI / C++ reflection.
- Psych-specific Lua metatables.
The converter produces a ready-to-edit `.hscript` skeleton in `scripts/` and logs exact unconvertible functions in `CONVERSION_REPORT.md`.
