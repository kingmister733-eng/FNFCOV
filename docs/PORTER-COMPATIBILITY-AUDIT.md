# FNF Porter comparison audit

Date: 2026-10-26

## Scope

This is a source-level comparison of FNFCOV with the public FNF-Porter-Mobile repository and its upstream FNF-Porter Python project. It is not a claim that either converter has passed real-mod runtime tests.

Repositories:
- FNFCOV: https://github.com/kingmister733-eng/FNFCOV
- FNF-Porter-Mobile: https://github.com/SametGkTe/FNF-Porter-Mobile
- Upstream Porter.py: https://github.com/FNF-Porter/Porter.py

## Findings verified so far

### FNF-Porter-Mobile

- The README advertises Psych Engine <-> V-Slice/Base Game conversion for charts, characters, weeks, stages, audio and images, plus best-effort Lua/HScript conversion.
- The README states the target `_polymod_meta.json` API version is 0.8.5.
- The Android app uses a WebView UI loaded from `app/src/main/assets/www/index.html` and a JavaScript bridge (`Android`) for native operations.
- `MainActivity.java` uses Android's document-tree picker and persists user-selected paths/preferences. This is useful reference material for a native Android wrapper.
- The README explicitly warns that script conversion is best-effort and generated scripts must be reviewed.
- The project credits the upstream Porter authors and says it is a non-commercial derivative.

### Upstream FNF-Porter

- The upstream README identifies the project as Python-based and licensed CC BY-NC 4.0.
- The main conversion pipeline in `psychtobase/main.py` delegates work to modules including `ChartTools.ChartObject`, `CharacterTools.CharacterObject`, `StageLuaParse`, `StageTool`, `WeekTools` and `ModConvertTools`.
- The public issue list includes reports about songs not appearing, chart conversion errors, character/event crashes, week conversion, and incomplete Lua stages. These reports are risk areas to test, not proof every current version has those defects.

### FNFCOV

- FNFCOV is a TypeScript/Vite converter with a staged pipeline in `src/converter/modConverter.ts`, a normalized intermediate representation, serializer, validator, ZIP handling and diagnostics.
- Existing code deliberately labels some Lua/script and stage behavior as partial or manual rather than claiming full conversion.
- This architecture can support explicit conversion coverage and automated regression tests without adopting another project's implementation.

## Recommended test matrix

1. Charts: multiple difficulties/variations, sustain notes, note types, events, empty charts and malformed JSON.
2. Characters: animation names/indices, offsets, frame rate, health icon and atlas paths.
3. Stages: character positions/camera offsets, static Lua-created sprites, scale, scroll factor, z-index, animated props and missing assets.
4. Scripts: simple literal assignments versus dynamic Lua, callbacks, unsupported APIs and generated HScript review warnings.
5. Packaging: metadata/API version, paths/case sensitivity, audio/images, nested ZIP paths and validation before export.
6. Android: folder permissions, large ZIP handling, cancellation, readable error logs and repeat conversions.

## Implementation priorities

1. Build small fixtures and expected-output tests for each conversion feature.
2. Prioritize chart correctness and valid target schemas before expanding script translation.
3. Parse only a documented, safe subset of static stage Lua calls; mark dynamic behavior unsupported with file/line diagnostics.
4. Keep original scripts and a conversion report in the output when appropriate.
5. Verify output against official V-Slice schemas and, when possible, launch it in the target game.
6. Treat the mobile app's UI and Android file-picker design as a reference, not proof of converter correctness.

## Licensing note

The upstream Porter project declares CC BY-NC 4.0. Before copying or adapting its source code into FNFCOV, review the full license and compatibility implications. Prefer independently implementing behavior from public format documentation and tests unless the intended use and distribution are clearly compatible with the license.

## Status

This document records findings from repository documentation and selected source files. It does not assert that a full conversion has been tested, that CI is green, or that an APK has been built successfully.
