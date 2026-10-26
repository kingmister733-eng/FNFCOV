import { NormalizedScript, ConversionDiagnostic } from './ir';

export class ScriptAnalyzer {
  private static readonly PSYCH_CALLBACKS = [
    'onCreate',
    'onCreatePost',
    'onDestroy',
    'onUpdate',
    'onUpdatePost',
    'onStepHit',
    'onBeatHit',
    'onSongStart',
    'onEndSong',
    'onPause',
    'onResume',
    'onCountdownTick',
    'goodNoteHit',
    'opponentNoteHit',
    'noteMiss',
    'onTweenCompleted',
    'onTimerCompleted',
    'onCustomSubstateCreate',
    'onEvent',
  ];

  private static readonly PSYCH_BUILTIN_FUNCS = [
    'makeLuaSprite',
    'makeAnimatedLuaSprite',
    'addLuaSprite',
    'removeLuaSprite',
    'setScrollFactor',
    'scaleObject',
    'updateHitbox',
    'setLuaSpriteCamera',
    'screenCenter',
    'doTweenX',
    'doTweenY',
    'doTweenAlpha',
    'doTweenZoom',
    'doTweenAngle',
    'doTweenColor',
    'runTimer',
    'cancelTimer',
    'triggerEvent',
    'characterPlayAnim',
    'playAnim',
    'setProperty',
    'getProperty',
    'setPropertyFromClass',
    'getPropertyFromClass',
    'callMethod',
    'initLuaShader',
    'setSpriteShader',
    'addHaxeLibrary',
    'runHaxeCode',
  ];

  /**
   * Analyzes a Psych Engine Lua script and returns a compatibility evaluation and HScript conversion draft
   */
  public static analyzeLuaScript(
    scriptPath: string,
    luaContent: string
  ): { script: NormalizedScript; diagnostics: ConversionDiagnostic[] } {
    const diagnostics: ConversionDiagnostic[] = [];
    const fileName = scriptPath.split('/').pop() || scriptPath;

    const detectedCallbacks: string[] = [];
    const detectedFunctions: string[] = [];
    const issues: string[] = [];

    // Detect Psych callbacks
    for (const cb of this.PSYCH_CALLBACKS) {
      const regex = new RegExp(`function\\s+${cb}\\s*\\(`, 'g');
      if (regex.test(luaContent)) {
        detectedCallbacks.push(cb);
      }
    }

    // Detect Psych functions
    for (const fn of this.PSYCH_BUILTIN_FUNCS) {
      const regex = new RegExp(`\\b${fn}\\s*\\(`, 'g');
      if (regex.test(luaContent)) {
        detectedFunctions.push(fn);
      }
    }

    // Detect advanced/complex features
    const hasShaders = /initLuaShader|setSpriteShader|getShader/.test(luaContent);
    const hasRawHaxe = /runHaxeCode|addHaxeLibrary/.test(luaContent);
    const hasReflection = /setPropertyFromClass|getPropertyFromClass|callMethod/.test(luaContent);
    const hasCustomSubstates = /openCustomSubstate|closeCustomSubstate/.test(luaContent);
    const hasNoteLogic = /goodNoteHit|opponentNoteHit|noteMiss/.test(luaContent);

    let compatibility: 'automatic' | 'partial' | 'manual' = 'automatic';
    let recommendedAction = 'Ready for static HScript execution.';

    if (hasShaders) {
      issues.push('Custom GLSL shaders: Requires Haxe FlxRuntimeShader in V-Slice.');
      compatibility = 'manual';
    }
    if (hasRawHaxe) {
      issues.push('Embedded Haxe code (`runHaxeCode`): Needs direct HScript integration.');
      if (compatibility !== 'manual') compatibility = 'partial';
    }
    if (hasReflection) {
      issues.push('Reflection calls (`setPropertyFromClass`): May target Psych-specific internal classes.');
      if (compatibility !== 'manual') compatibility = 'partial';
    }
    if (hasNoteLogic) {
      issues.push('Custom note mechanics (`goodNoteHit`/`noteMiss`): Must be adapted to V-Slice Note events.');
      if (compatibility !== 'manual') compatibility = 'partial';
    }

    if (detectedCallbacks.length === 0 && detectedFunctions.length === 0) {
      // Very simple or empty script
      compatibility = 'automatic';
      recommendedAction = 'Simple script or data table.';
    } else if (compatibility === 'manual') {
      recommendedAction = 'Requires manual HScript/Haxe rewrite due to shaders or internal engine hooks.';
    } else if (compatibility === 'partial') {
      recommendedAction = 'Partially convertible to V-Slice HScript. Generated template with TODOs provided.';
    } else {
      recommendedAction = 'Can be translated to V-Slice HScript sprite and tween calls.';
    }

    // Generate HScript draft
    const generatedHScriptDraft = this.generateHScriptDraft(
      fileName,
      luaContent,
      detectedCallbacks,
      detectedFunctions,
      issues
    );

    diagnostics.push({
      level: compatibility === 'manual' ? 'warning' : 'info',
      category: 'script',
      file: scriptPath,
      message: `Script "${fileName}" analyzed: ${compatibility.toUpperCase()} compatibility.`,
      details: issues.length > 0 ? issues.join(' | ') : 'All basic sprite/event calls identified.',
      actionNeeded: recommendedAction,
    });

    const script: NormalizedScript = {
      path: scriptPath,
      name: fileName,
      sourceLanguage: 'lua',
      compatibility,
      detectedCallbacks,
      detectedFunctions,
      issues,
      recommendedAction,
      generatedHScriptDraft,
    };

    return { script, diagnostics };
  }

  /**
   * Generates a clean, valid V-Slice HScript (.hx / .hscript) skeleton from the Psych script
   */
  private static generateHScriptDraft(
    fileName: string,
    luaContent: string,
    callbacks: string[],
    functions: string[],
    issues: string[]
  ): string {
    const lines: string[] = [
      `// =========================================================================`,
      `// V-Slice HScript Draft converted from Psych Lua script: ${fileName}`,
      `// Generated by FNFCOV Mod Converter`,
      `// =========================================================================`,
      ``,
      `import flixel.FlxG;`,
      `import flixel.FlxSprite;`,
      `import flixel.tweens.FlxTween;`,
      `import flixel.tweens.FlxEase;`,
      `import flixel.util.FlxTimer;`,
      `import funkin.play.PlayState;`,
      ``,
    ];

    if (issues.length > 0) {
      lines.push(`/*`);
      lines.push(` * ATTENTION - MANUAL ADAPTATION NOTES:`);
      issues.forEach((issue) => lines.push(` * - ${issue}`));
      lines.push(` */`);
      lines.push(``);
    }

    // Generate callback stubs in V-Slice HScript syntax
    lines.push(`function create() {`);
    lines.push(`    // Replaces Psych onCreate()`);
    lines.push(`}`);
    lines.push(``);

    if (callbacks.includes('onCreatePost')) {
      lines.push(`function createPost() {`);
      lines.push(`    // Replaces Psych onCreatePost()`);
      lines.push(`}`);
      lines.push(``);
    }

    if (callbacks.includes('onUpdate') || callbacks.includes('onUpdatePost')) {
      lines.push(`function update(elapsed:Float) {`);
      lines.push(`    // Replaces Psych onUpdate(elapsed)`);
      lines.push(`}`);
      lines.push(``);
    }

    if (callbacks.includes('onStepHit')) {
      lines.push(`function stepHit(curStep:Int) {`);
      lines.push(`    // Replaces Psych onStepHit()`);
      lines.push(`}`);
      lines.push(``);
    }

    if (callbacks.includes('onBeatHit')) {
      lines.push(`function beatHit(curBeat:Int) {`);
      lines.push(`    // Replaces Psych onBeatHit()`);
      lines.push(`}`);
      lines.push(``);
    }

    if (callbacks.includes('goodNoteHit')) {
      lines.push(`function onNoteHit(event:Dynamic) {`);
      lines.push(`    // Replaces Psych goodNoteHit(members, noteType, isSustainNote)`);
      lines.push(`}`);
      lines.push(``);
    }

    if (callbacks.includes('noteMiss')) {
      lines.push(`function onNoteMiss(event:Dynamic) {`);
      lines.push(`    // Replaces Psych noteMiss(members, noteType, isSustainNote)`);
      lines.push(`}`);
      lines.push(``);
    }

    lines.push(`// Original Psych Lua source preserved for reference:`);
    lines.push(`/*`);
    lines.push(luaContent.slice(0, 800) + (luaContent.length > 800 ? '\n... [truncated]' : ''));
    lines.push(`*/`);

    return lines.join('\n');
  }
}
