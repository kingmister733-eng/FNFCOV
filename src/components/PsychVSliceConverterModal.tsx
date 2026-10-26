import React, { useState } from 'react';
import { ModConverter, ModConversionResult, ModConversionProgress } from '../converter/modConverter';
import { SchemaParser } from '../converter/schemaParser';
import { ScriptAnalyzer } from '../converter/scriptAnalyzer';
import { OutputSerializer } from '../converter/outputSerializer';
import { NormalizedMod, NormalizedSong, NormalizedNote } from '../converter/ir';
import {
  X,
  Play,
  FileArchive,
  FileCode,
  Download,
  Copy,
  Check,
  CheckCircle2,
  Upload,
  Layers,
  Sparkles,
  HelpCircle,
  FileText,
  AlertTriangle,
  Code2,
  Smartphone,
  ShieldCheck,
  ExternalLink,
  BookOpen,
} from 'lucide-react';

interface PsychVSliceConverterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadChartToGame?: (notesJson: any, songName: string, bpm: number, speed: number) => void;
}

export const PsychVSliceConverterModal: React.FC<PsychVSliceConverterModalProps> = ({
  isOpen,
  onClose,
  onLoadChartToGame,
}) => {
  const [activeTab, setActiveTab] = useState<'zip' | 'single' | 'character' | 'stage' | 'scripts' | 'spec'>('zip');
  const [targetVersion, setTargetVersion] = useState<'0.8.x' | '0.4.x'>('0.8.x');
  const [difficulty, setDifficulty] = useState<string>('normal');

  // ZIP Mode State
  const [zipProgress, setZipProgress] = useState<ModConversionProgress | null>(null);
  const [conversionResult, setConversionResult] = useState<ModConversionResult | null>(null);
  const [isProcessingZip, setIsProcessingZip] = useState(false);

  // Single JSON Mode State
  const [inputJson, setInputJson] = useState<string>('');
  const [singleChartOutput, setSingleChartOutput] = useState<string>('');
  const [singleMetaOutput, setSingleMetaOutput] = useState<string>('');
  const [singleDiags, setSingleDiags] = useState<any[]>([]);
  const [lastParsedSong, setLastParsedSong] = useState<NormalizedSong | null>(null);
  const [copiedChart, setCopiedChart] = useState(false);
  const [copiedMeta, setCopiedMeta] = useState(false);

  const convertNormalizedNotesToGameNotes = (normalizedNotes: NormalizedNote[]) => {
    return normalizedNotes.map((n, idx) => {
      const isPlayer = n.lane >= 4 && n.lane <= 7;
      const direction = ((n.lane % 4) as 0 | 1 | 2 | 3);
      return {
        id: `conv_${n.timeMs}_${n.lane}_${idx}`,
        time: n.timeMs,
        direction: (direction >= 0 && direction <= 3 ? direction : 0),
        isPlayer,
        length: n.sustainMs > 0 ? n.sustainMs : 0,
        hit: false,
        missed: false,
      };
    });
  };

  // Character & Stage tabs
  const [charInput, setCharInput] = useState('');
  const [charOutput, setCharOutput] = useState('');
  const [stageInput, setStageInput] = useState('');
  const [stageOutput, setStageOutput] = useState('');

  // Script tab state
  const [luaScriptInput, setLuaScriptInput] = useState('');
  const [hscriptOutput, setHscriptOutput] = useState('');
  const [scriptAnalysis, setScriptAnalysis] = useState<{
    compatibility: 'automatic' | 'partial' | 'manual';
    callbacks: string[];
    functions: string[];
    issues: string[];
  } | null>(null);
  const [copiedHscript, setCopiedHscript] = useState(false);

  if (!isOpen) return null;

  // Handle Full ZIP Upload
  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingZip(true);
    setConversionResult(null);
    setZipProgress({ step: 'Загрузка и проверка архива...', percent: 5 });

    try {
      const result = await ModConverter.convertPsychModZip(file, file.name, targetVersion, (progress) => {
        setZipProgress(progress);
      });
      setConversionResult(result);
    } catch (err: any) {
      setConversionResult({
        success: false,
        outputFileName: 'error.zip',
        modTitle: 'Conversion Error',
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
        markdownReport: `# Conversion Failed\n\n${err.message}`,
        jsonReport: { error: err.message },
        diagnostics: [{ level: 'error', category: 'metadata', message: err.message }],
        validationErrors: [err.message],
        validationWarnings: [],
        status: 'Failed validation',
        fileManifest: [],
      });
    } finally {
      setIsProcessingZip(false);
    }
  };

  // Download Output ZIP
  const handleDownloadZip = () => {
    if (!conversionResult?.zipBlob) return;
    const url = URL.createObjectURL(conversionResult.zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = conversionResult.outputFileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Download Markdown Report
  const handleDownloadReport = () => {
    if (!conversionResult?.markdownReport) return;
    const blob = new Blob([conversionResult.markdownReport], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${conversionResult.modTitle.replace(/\s+/g, '_')}_CONVERSION_REPORT.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Handle Single Chart Conversion
  const handleConvertSingle = (text: string) => {
    setInputJson(text);
    if (!text.trim()) {
      setSingleChartOutput('');
      setSingleMetaOutput('');
      setSingleDiags([]);
      setLastParsedSong(null);
      return;
    }

    const { song, diagnostics } = SchemaParser.parsePsychChart(text, difficulty);
    setSingleDiags(diagnostics);

    if (song) {
      setLastParsedSong(song);
      const tempMod: NormalizedMod = {
        id: song.id,
        title: song.name,
        description: 'Single chart conversion',
        author: song.charter,
        sourceEngine: 'psych',
        targetVersion,
        songs: new Map([[song.id, song]]),
        characters: new Map(),
        stages: new Map(),
        weeks: new Map(),
        scripts: new Map(),
        assetFiles: new Map(),
        diagnostics,
        fileManifest: [],
        status: diagnostics.some((d) => d.level === 'error')
          ? 'Failed validation'
          : diagnostics.some((d) => d.level === 'warning')
          ? 'Converted with warnings'
          : 'Converted and validated',
      };

      const files = OutputSerializer.serializeToVSlice(tempMod);
      const chartFile = files.find((f) => f.path.endsWith('-chart.json'));
      const metaFile = files.find((f) => f.path.endsWith('-metadata.json'));

      setSingleChartOutput(chartFile ? (chartFile.content as string) : '');
      setSingleMetaOutput(metaFile ? (metaFile.content as string) : '');
    } else {
      setLastParsedSong(null);
      setSingleChartOutput('');
      setSingleMetaOutput('');
    }
  };

  // Load Sample Psych Chart
  const handleLoadSample = () => {
    const sample = {
      song: {
        song: 'Dadbattle',
        bpm: 180,
        speed: 2.2,
        player1: 'bf',
        player2: 'dad',
        gfVersion: 'gf',
        stage: 'stage',
        notes: [
          {
            sectionNotes: [
              [0, 0, 0],
              [333, 1, 0],
              [666, 2, 0],
              [1000, 3, 0],
              [1333, 4, 150],
            ],
            lengthInSteps: 16,
            mustHitSection: false,
            bpm: 180,
          },
          {
            sectionNotes: [
              [1666, 0, 0],
              [2000, 1, 0],
              [2333, 2, 0],
              [2666, 3, 0],
            ],
            lengthInSteps: 16,
            mustHitSection: true,
            bpm: 180,
          },
        ],
        events: [[1333, [['Camera Follow Pos', '1', '']]]],
      },
    };
    handleConvertSingle(JSON.stringify(sample, null, 2));
  };

  // Convert Single Character
  const handleConvertCharacter = (val: string) => {
    setCharInput(val);
    const { character, diagnostics } = SchemaParser.parsePsychCharacter(val, 'custom_char');
    if (character) {
      const vChar = {
        version: '1.0.0',
        name: character.name,
        assetPath: `characters/${character.assetPath}`,
        renderType: character.renderType,
        scale: character.scale,
        singDuration: character.singDuration,
        flipX: character.flipX,
        healthIcon: {
          id: character.healthIcon,
          scale: 1.0,
          flipX: false,
        },
        healthBarColor: character.healthBarColor,
        positionOffsets: character.positionOffsets,
        cameraOffsets: character.cameraOffsets,
        animations: character.animations.map((a) => ({
          name: a.name,
          prefix: a.prefix,
          fps: a.fps,
          looped: a.loop,
          frameIndices: a.frameIndices,
          offsets: a.offsets,
        })),
      };
      setCharOutput(JSON.stringify(vChar, null, 2));
    } else {
      setCharOutput(`Ошибка конвертации: ${diagnostics.map((d) => d.message).join('; ')}`);
    }
  };

  // Convert Single Stage
  const handleConvertStage = (val: string) => {
    setStageInput(val);
    const { stage, diagnostics } = SchemaParser.parsePsychStage(val, 'custom_stage');
    if (stage) {
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
      setStageOutput(JSON.stringify(vStage, null, 2));
    } else {
      setStageOutput(`Ошибка конвертации: ${diagnostics.map((d) => d.message).join('; ')}`);
    }
  };

  const handleAnalyzeScript = (val: string) => {
    setLuaScriptInput(val);
    if (!val.trim()) {
      setHscriptOutput('');
      setScriptAnalysis(null);
      return;
    }
    const { script } = ScriptAnalyzer.analyzeLuaScript('script.lua', val);
    setHscriptOutput(script.generatedHScriptDraft || '');
    setScriptAnalysis({
      compatibility: script.compatibility,
      callbacks: script.detectedCallbacks,
      functions: script.detectedFunctions,
      issues: script.issues,
    });
  };

  const handleCopy = (text: string, isMeta: boolean = false) => {
    navigator.clipboard.writeText(text);
    if (isMeta) {
      setCopiedMeta(true);
      setTimeout(() => setCopiedMeta(false), 2000);
    } else {
      setCopiedChart(true);
      setTimeout(() => setCopiedChart(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-5xl max-h-[94vh] bg-slate-900 border-2 border-slate-700 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-800 bg-slate-950/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-600 via-purple-600 to-cyan-500 p-0.5 shadow-lg shadow-pink-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center text-lg">
                🔄
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black font-bungee tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-300 to-cyan-400">
                  PSYCH ENGINE ➔ V-SLICE CONVERTER
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  V-SLICE {targetVersion}
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Официальный конвертер модов, чартов, событий, персонажей и сцен для Android и ПК
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Target Engine Version & Difficulty Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-2.5 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-400 uppercase">Целевая версия V-Slice:</span>
            <div className="flex gap-1.5">
              <button
                onClick={() => setTargetVersion('0.8.x')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  targetVersion === '0.8.x'
                    ? 'bg-cyan-600 text-white shadow-md'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                V-Slice 0.8.x (Weekend 1 / Modern)
              </button>
              <button
                onClick={() => setTargetVersion('0.4.x')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  targetVersion === '0.4.x'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                V-Slice 0.4.x (Polymod)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-bold uppercase text-[11px]">Сложность:</span>
            <select
              value={difficulty}
              onChange={(e) => {
                setDifficulty(e.target.value);
                if (inputJson) handleConvertSingle(inputJson);
              }}
              className="bg-slate-800 text-white font-bold text-xs px-2.5 py-1 rounded-lg border border-slate-700 focus:outline-none"
            >
              <option value="easy">Easy</option>
              <option value="normal">Normal</option>
              <option value="hard">Hard</option>
              <option value="erect">Erect</option>
            </select>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-4 sm:px-6 pt-2 border-b border-slate-800 bg-slate-950/30 overflow-x-auto">
          <button
            onClick={() => setActiveTab('zip')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-t-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
              activeTab === 'zip'
                ? 'bg-slate-800 text-pink-400 border-t-2 border-pink-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileArchive className="w-4 h-4" />
            Полный ZIP-Мод
          </button>
          <button
            onClick={() => setActiveTab('single')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-t-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
              activeTab === 'single'
                ? 'bg-slate-800 text-cyan-400 border-t-2 border-cyan-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-4 h-4" />
            Чарты (JSON)
          </button>
          <button
            onClick={() => setActiveTab('character')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-t-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
              activeTab === 'character'
                ? 'bg-slate-800 text-amber-400 border-t-2 border-amber-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            Персонажи
          </button>
          <button
            onClick={() => setActiveTab('stage')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-t-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
              activeTab === 'stage'
                ? 'bg-slate-800 text-emerald-400 border-t-2 border-emerald-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Сцены (Stages)
          </button>
          <button
            onClick={() => setActiveTab('scripts')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-t-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
              activeTab === 'scripts'
                ? 'bg-slate-800 text-purple-400 border-t-2 border-purple-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-4 h-4" />
            Скрипты (Lua)
          </button>
          <button
            onClick={() => setActiveTab('spec')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-t-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
              activeTab === 'spec'
                ? 'bg-slate-800 text-blue-400 border-t-2 border-blue-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Спецификация (Mapping)
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* TAB 1: FULL ZIP MOD ARCHIVE */}
          {activeTab === 'zip' && (
            <div className="space-y-4">
              <div className="bg-slate-950/70 p-6 rounded-2xl border border-slate-800 text-center">
                <FileArchive className="w-12 h-12 text-pink-500 mx-auto mb-2 animate-pulse" />
                <h3 className="text-base font-black text-white font-bungee mb-1">
                  КОНВЕРТЕР ПОЛНОГО МОДА PSYCH ENGINE В V-SLICE
                </h3>
                <p className="text-xs text-slate-400 max-w-xl mx-auto mb-4">
                  Загрузите архив мода (.zip) с вашего Android-телефона или ПК. Конвертер автоматически создаст
                  валидную файловую структуру V-Slice (_polymod_meta.json, data/songs, data/characters, data/stages,
                  data/levels, scripts) и сохранит все звуки (Inst, Voices) и текстуры.
                </p>

                <label className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-pink-600 via-purple-600 to-cyan-500 hover:from-pink-500 hover:to-cyan-400 text-white font-black text-xs sm:text-sm tracking-wider uppercase shadow-xl hover:shadow-pink-500/25 cursor-pointer transition-all transform hover:scale-105 active:scale-95">
                  <Upload className="w-5 h-5" />
                  <span>Выбрать ZIP Мод с Телефона / Компьютера</span>
                  <input
                    type="file"
                    accept=".zip"
                    onChange={handleZipUpload}
                    disabled={isProcessingZip}
                    className="hidden"
                  />
                </label>
              </div>

              {/* In Progress */}
              {isProcessingZip && zipProgress && (
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3 animate-fadeIn">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-pink-400">{zipProgress.step}</span>
                    <span className="font-mono text-cyan-400 font-bold">{zipProgress.percent}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-pink-500 to-cyan-400 transition-all duration-150"
                      style={{ width: `${zipProgress.percent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Conversion Result Report */}
              {conversionResult && (
                <div
                  className={`bg-slate-950 p-5 rounded-2xl border space-y-4 animate-fadeIn ${
                    conversionResult.success ? 'border-emerald-500/40' : 'border-red-500/40'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      {conversionResult.success ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="w-6 h-6 text-red-500" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-sm text-white">{conversionResult.modTitle}</h4>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${
                              conversionResult.status === 'Converted and validated'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : conversionResult.status === 'Converted with warnings'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : 'bg-red-500/20 text-red-300 border-red-500/40'
                            }`}
                          >
                            {conversionResult.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">{conversionResult.outputFileName}</p>
                      </div>
                    </div>

                    {conversionResult.success && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleDownloadReport}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Аудит-Отчёт (.md)</span>
                        </button>
                        <button
                          onClick={handleDownloadZip}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg transition-transform hover:scale-105 active:scale-95"
                        >
                          <Download className="w-4 h-4 fill-current" />
                          <span>Скачать V-Slice ZIP</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Statistics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Файлов в архиве:</span>
                      <span className="font-bold text-white text-sm">{conversionResult.stats.filesDiscoveredCount}</span>
                    </div>
                    <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Песен распознано:</span>
                      <span className="font-bold text-pink-400 text-sm">{conversionResult.stats.songsCount}</span>
                    </div>
                    <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Всего нот:</span>
                      <span className="font-bold text-cyan-400 text-sm">
                        {conversionResult.stats.notesCount.toLocaleString()}
                      </span>
                    </div>
                    <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Персонажей / Ассетов:</span>
                      <span className="font-bold text-emerald-400 text-sm">
                        {conversionResult.stats.charactersCount} / {conversionResult.stats.assetsPreservedCount}
                      </span>
                    </div>
                  </div>

                  {/* Converted Songs Breakdown */}
                  {conversionResult.jsonReport?.songs && conversionResult.jsonReport.songs.length > 0 && (
                    <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-2">
                      <div className="text-xs font-bold text-white flex items-center justify-between">
                        <span>Сконвертированные песни и темп (BPM):</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          Сложности объединены в общие треки
                        </span>
                      </div>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {conversionResult.jsonReport.songs.map((s: any) => (
                          <div
                            key={s.id}
                            className="p-2 bg-slate-950 rounded-lg border border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs"
                          >
                            <div>
                              <span className="font-bold text-pink-400">{s.name}</span>
                              <span className="text-slate-500 font-mono text-[10px] ml-1.5">({s.id})</span>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                Сложности: <strong className="text-slate-300">{s.difficulties.join(', ')}</strong> •
                                Нот: <strong className="text-slate-300">{s.notesCount}</strong> • Событий:{' '}
                                <strong className="text-slate-300">{s.eventsCount}</strong>
                              </div>
                            </div>
                            <div className="flex items-center gap-2.5">
                              <div className="text-right">
                                <span className="font-mono font-bold text-cyan-400 text-xs">{s.bpm} BPM</span>
                                <div className="text-[10px] text-slate-400">
                                  {s.bpmSource === 'chart'
                                    ? '✓ Из чарта'
                                    : s.bpmSource === 'section'
                                    ? '✓ Из секции'
                                    : s.bpmSource === 'event'
                                    ? '✓ Из BPM события'
                                    : s.bpmSource === 'sibling'
                                    ? '✓ Из сложности'
                                    : '⚠️ Не подтверждён'}
                                </div>
                              </div>
                              {onLoadChartToGame && conversionResult.normalizedMod && (
                                <button
                                  onClick={() => {
                                    const normSong = conversionResult.normalizedMod?.songs.get(s.id);
                                    if (normSong) {
                                      const diffKey = s.difficulties[0] || 'normal';
                                      const diffNotes = normSong.notes[diffKey] || Object.values(normSong.notes)[0] || [];
                                      const gameNotes = convertNormalizedNotesToGameNotes(diffNotes);
                                      const speed = normSong.scrollSpeed[diffKey] || 2.2;
                                      onLoadChartToGame(gameNotes, normSong.name, normSong.bpm, speed);
                                    }
                                  }}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-pink-600/30 hover:bg-pink-600 border border-pink-500/50 text-pink-200 hover:text-white text-[11px] font-black uppercase tracking-wider shadow transition-transform hover:scale-105 active:scale-95"
                                  title="Запустить песню в плеере"
                                >
                                  <Play className="w-3 h-3 fill-current" />
                                  <span>Играть</span>
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Zero Stages/Weeks Explanation (Songpack transparency) */}
                  {(conversionResult.stats.stagesCount === 0 || conversionResult.stats.weeksCount === 0) && (
                    <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-0.5">
                      {conversionResult.stats.stagesCount === 0 && (
                        <div>• <strong>Сцены (0)</strong>: В архиве мода не найдено кастомных сцен stages/ — используется стандартная сцена игры.</div>
                      )}
                      {conversionResult.stats.weeksCount === 0 && (
                        <div>• <strong>Недели (0)</strong>: В архиве нет файлов weeks/ — типично для сборников треков (songpack), песни доступны во Freeplay.</div>
                      )}
                    </div>
                  )}

                  {/* Discovered Files Manifest (Collapsible / Scrollable) */}
                  {conversionResult.fileManifest.length > 0 && (
                    <details className="bg-slate-900/60 rounded-xl border border-slate-800 p-2.5 text-xs">
                      <summary className="font-bold text-slate-300 cursor-pointer hover:text-white select-none">
                        Манифест всех файлов архива ({conversionResult.fileManifest.length})
                      </summary>
                      <div className="mt-2 max-h-44 overflow-y-auto space-y-1 pr-1">
                        {conversionResult.fileManifest.map((m, idx) => (
                          <div
                            key={idx}
                            className="p-1.5 bg-slate-950 rounded border border-slate-800/60 flex items-center justify-between text-[11px] font-mono"
                          >
                            <span className="text-slate-300 truncate max-w-[60%]">{m.sourcePath}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500 uppercase text-[9px]">{m.classifiedType}</span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                  m.conversionResult === 'converted'
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : m.conversionResult === 'copied'
                                    ? 'bg-cyan-500/20 text-cyan-400'
                                    : m.conversionResult === 'merged'
                                    ? 'bg-purple-500/20 text-purple-400'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                {m.conversionResult}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}

                  {/* Android Install Tip */}
                  <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 text-xs text-slate-300">
                    <span className="font-bold text-cyan-400 flex items-center gap-1.5 mb-1">
                      <Smartphone className="w-4 h-4" />
                      Как установить готовый мод на Android:
                    </span>
                    <p className="text-[11px] text-slate-400 mb-1">
                      Скопируйте распакованный архив мода в системную папку модов на телефоне:
                    </p>
                    <code className="block font-mono text-[11px] text-pink-300 bg-slate-950 p-2 rounded border border-slate-800 select-all">
                      /storage/emulated/0/Android/data/com.shadowmario.psychengine/files/mods/
                    </code>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SINGLE CHART / JSON CONVERTER */}
          {activeTab === 'single' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleLoadSample}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-pink-400 border border-slate-700 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Загрузить Тестовый Psych Чарт</span>
                  </button>

                  {singleChartOutput && lastParsedSong && onLoadChartToGame && (
                    <button
                      onClick={() => {
                        const diffNotes = lastParsedSong.notes[difficulty] || Object.values(lastParsedSong.notes)[0] || [];
                        const gameNotes = convertNormalizedNotesToGameNotes(diffNotes);
                        const speed = lastParsedSong.scrollSpeed[difficulty] || 2.2;
                        onLoadChartToGame(gameNotes, lastParsedSong.name, lastParsedSong.bpm, speed);
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-pink-600 to-cyan-600 hover:from-pink-500 hover:to-cyan-500 text-white text-xs font-black uppercase tracking-wider shadow-lg transition-transform hover:scale-105 active:scale-95"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Сыграть этот чарт в игре</span>
                    </button>
                  )}
                </div>

                {singleChartOutput && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Сконвертировано без ошибок в V-Slice {targetVersion}!</span>
                  </div>
                )}
              </div>

              {/* Side-by-side Editors */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col bg-slate-950 p-3 rounded-2xl border border-slate-800">
                  <div className="flex justify-between items-center mb-2 pb-1 border-b border-slate-800 text-xs font-bold text-purple-400">
                    <span>Psych Engine Chart JSON</span>
                    <button
                      onClick={() => handleConvertSingle('')}
                      className="text-slate-500 hover:text-slate-300 text-[10px]"
                    >
                      Очистить
                    </button>
                  </div>
                  <textarea
                    value={inputJson}
                    onChange={(e) => handleConvertSingle(e.target.value)}
                    placeholder="Вставьте сюда JSON чарта Psych Engine..."
                    className="w-full h-72 bg-slate-900 text-slate-200 font-mono text-xs p-3 rounded-xl border border-slate-800 focus:outline-none focus:border-pink-500 resize-none"
                  />
                </div>

                <div className="flex flex-col bg-slate-950 p-3 rounded-2xl border border-slate-800">
                  <div className="flex justify-between items-center mb-2 pb-1 border-b border-slate-800 text-xs font-bold text-cyan-400">
                    <span>V-Slice {targetVersion} Chart JSON</span>
                    {singleChartOutput && (
                      <button
                        onClick={() => handleCopy(singleChartOutput, false)}
                        className="flex items-center gap-1 text-[10px] text-slate-300 hover:text-white bg-slate-800 px-2 py-0.5 rounded"
                      >
                        {copiedChart ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>Копировать</span>
                      </button>
                    )}
                  </div>
                  <textarea
                    readOnly
                    value={singleChartOutput || 'Здесь появится готовый V-Slice chart.json...'}
                    className="w-full h-72 bg-slate-900 text-slate-200 font-mono text-xs p-3 rounded-xl border border-slate-800 resize-none select-all"
                  />
                </div>
              </div>

              {/* Companion Metadata.json */}
              {singleMetaOutput && (
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex justify-between items-center text-xs">
                  <div>
                    <span className="font-bold text-white block">Сопутствующий файл metadata.json:</span>
                    <span className="text-[11px] text-slate-400">Содержит timeChanges, playData и авторов</span>
                  </div>
                  <button
                    onClick={() => handleCopy(singleMetaOutput, true)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-600/30 border border-cyan-500/50 hover:bg-cyan-600 text-cyan-200 text-xs font-bold"
                  >
                    {copiedMeta ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Копировать Metadata</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CHARACTERS */}
          {activeTab === 'character' && (
            <div className="space-y-4">
              <div className="text-xs text-slate-400">
                Конвертируйте JSON персонажей Psych Engine (<code>characters/&lt;name&gt;.json</code>) в V-Slice{' '}
                <code>data/characters/&lt;name&gt;.json</code> с правильными смещениями и кадрами.
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <textarea
                  value={charInput}
                  onChange={(e) => handleConvertCharacter(e.target.value)}
                  placeholder="Вставьте JSON персонажа Psych Engine (например boyfriend.json)..."
                  className="w-full h-72 bg-slate-950 text-slate-200 font-mono text-xs p-3 rounded-xl border border-slate-800 focus:outline-none focus:border-amber-500 resize-none"
                />
                <textarea
                  readOnly
                  value={charOutput || 'Здесь появится готовый V-Slice character JSON...'}
                  className="w-full h-72 bg-slate-900 text-slate-200 font-mono text-xs p-3 rounded-xl border border-slate-800 resize-none select-all"
                />
              </div>
            </div>
          )}

          {/* TAB 4: STAGES */}
          {activeTab === 'stage' && (
            <div className="space-y-4">
              <div className="text-xs text-slate-400">
                Конвертируйте сцены Psych Engine (<code>stages/&lt;name&gt;.json</code>) в V-Slice{' '}
                <code>data/stages/&lt;name&gt;.json</code>.
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <textarea
                  value={stageInput}
                  onChange={(e) => handleConvertStage(e.target.value)}
                  placeholder="Вставьте JSON сцены Psych Engine (например stage.json)..."
                  className="w-full h-72 bg-slate-950 text-slate-200 font-mono text-xs p-3 rounded-xl border border-slate-800 focus:outline-none focus:border-emerald-500 resize-none"
                />
                <textarea
                  readOnly
                  value={stageOutput || 'Здесь появится готовый V-Slice stage JSON...'}
                  className="w-full h-72 bg-slate-950 text-slate-200 font-mono text-xs p-3 rounded-xl border border-slate-800 resize-none select-all"
                />
              </div>
            </div>
          )}

          {/* TAB 5: SCRIPTS (LUA ➔ HSCRIPT) */}
          {activeTab === 'scripts' && (
            <div className="space-y-4">
              <div className="text-xs text-slate-400">
                Анализ совместимости Lua-скриптов Psych Engine и генерация каркаса HScript для Polymod V-Slice.
                Шейдеры GLSL и системные вызовы FFI помечаются для ручной адаптации.
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-300">Psych Engine Lua Script:</span>
                  </div>
                  <textarea
                    value={luaScriptInput}
                    onChange={(e) => handleAnalyzeScript(e.target.value)}
                    placeholder="Вставьте код Psych Lua скрипта (например custom_events.lua)..."
                    className="w-full h-80 bg-slate-950 text-slate-200 font-mono text-xs p-3 rounded-xl border border-slate-800 focus:outline-none focus:border-purple-500 resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-300">V-Slice HScript (Polymod):</span>
                    {hscriptOutput && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(hscriptOutput);
                          setCopiedHscript(true);
                          setTimeout(() => setCopiedHscript(false), 2000);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-purple-600/30 border border-purple-500/50 hover:bg-purple-600 text-purple-200 text-xs font-bold"
                      >
                        {copiedHscript ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>Копировать HScript</span>
                      </button>
                    )}
                  </div>
                  <textarea
                    readOnly
                    value={hscriptOutput || 'Здесь появится сгенерированный каркас HScript...'}
                    className="w-full h-80 bg-slate-900 text-slate-200 font-mono text-xs p-3 rounded-xl border border-slate-800 resize-none select-all"
                  />
                </div>
              </div>

              {scriptAnalysis && (
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">Анализ совместимости:</span>
                    <span
                      className={`text-[11px] px-2.5 py-0.5 rounded font-black border ${
                        scriptAnalysis.compatibility === 'automatic'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : scriptAnalysis.compatibility === 'partial'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      }`}
                    >
                      {scriptAnalysis.compatibility === 'automatic'
                        ? 'АВТОМАТИЧЕСКИ СОВМЕСТИМ'
                        : scriptAnalysis.compatibility === 'partial'
                        ? 'ЧАСТИЧНАЯ СОВМЕСТИМОСТЬ'
                        : 'ТРЕБУЕТСЯ РУЧНАЯ АДАПТАЦИЯ'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                      <span className="font-bold text-slate-400 block mb-1">
                        Обнаруженные колбэки ({scriptAnalysis.callbacks.length}):
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {scriptAnalysis.callbacks.length > 0 ? (
                          scriptAnalysis.callbacks.map((cb) => (
                            <span key={cb} className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono text-[10px]">
                              {cb}()
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-500 text-[11px]">Колбэков не обнаружено</span>
                        )}
                      </div>
                    </div>

                    <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                      <span className="font-bold text-slate-400 block mb-1">
                        Функции Psych Engine ({scriptAnalysis.functions.length}):
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {scriptAnalysis.functions.length > 0 ? (
                          scriptAnalysis.functions.map((fn) => (
                            <span key={fn} className="px-1.5 py-0.5 rounded bg-slate-800 text-purple-300 font-mono text-[10px]">
                              {fn}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-500 text-[11px]">Функций Psych не обнаружено</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {scriptAnalysis.issues.length > 0 && (
                    <div className="bg-amber-950/30 p-3 rounded-xl border border-amber-800/40 space-y-1">
                      <span className="text-[11px] font-bold text-amber-300 block">Предупреждения совместимости:</span>
                      <ul className="list-disc list-inside text-[11px] text-amber-200/80 space-y-0.5">
                        {scriptAnalysis.issues.map((issue, idx) => (
                          <li key={idx}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: SPECIFICATION & FORMAT MAPPING */}
          {activeTab === 'spec' && (
            <div className="space-y-4">
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-blue-400" />
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">
                      Официальная спецификация сопоставления форматов
                    </h3>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded font-mono bg-blue-500/20 text-blue-300 border border-blue-500/40">
                    docs/FORMAT_MAPPING.md
                  </span>
                </div>

                {/* Reference Links Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  <a
                    href="https://funkincrew.github.io/funkin-modding-docs/"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-200 transition-colors"
                  >
                    <span>Официальная документация FNF</span>
                    <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                  </a>
                  <a
                    href="https://github.com/FunkinCrew/funkin-modding-docs"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-200 transition-colors"
                  >
                    <span>FunkinCrew Modding GitHub</span>
                    <ExternalLink className="w-3.5 h-3.5 text-pink-400" />
                  </a>
                  <a
                    href="https://github.com/ShadowMario/FNF-PsychEngine"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-200 transition-colors"
                  >
                    <span>Psych Engine Source Repository</span>
                    <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                  </a>
                  <a
                    href="https://github.com/ShadowMario/FNF-PsychEngine/wiki"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-200 transition-colors"
                  >
                    <span>Psych Engine Wiki</span>
                    <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                  </a>
                  <a
                    href="https://shadowmario.github.io/psychengine.lua/"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-200 transition-colors"
                  >
                    <span>Psych Engine Lua API Docs</span>
                    <ExternalLink className="w-3.5 h-3.5 text-purple-400" />
                  </a>
                  <a
                    href="https://brenninho123.github.io/V-Stuff/"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-200 transition-colors"
                  >
                    <span>Справочный конвертер V-Stuff</span>
                    <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
                  </a>
                </div>

                {/* Directory Trees Comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                    <div className="flex items-center gap-2 mb-2 font-bold text-xs text-pink-400">
                      <span>📁 Psych Engine — источник</span>
                    </div>
                    <pre className="text-[11px] font-mono text-slate-300 leading-relaxed overflow-x-auto">
{`mod/
├── data/
│   └── song-name/
│       ├── song-name.json
│       └── events.json
├── songs/
│   └── song-name/
│       ├── Inst.ogg
│       └── Voices.ogg
├── characters/
│   └── character.json
├── stages/
│   └── stage.json
├── weeks/
└── scripts/`}
                    </pre>
                  </div>

                  <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                    <div className="flex items-center gap-2 mb-2 font-bold text-xs text-cyan-400">
                      <span>📁 V-Slice — результат</span>
                    </div>
                    <pre className="text-[11px] font-mono text-slate-300 leading-relaxed overflow-x-auto">
{`MyMod/
├── _polymod_meta.json
├── data/
│   ├── songs/
│   │   └── song-name/
│   │       ├── song-name-chart.json
│   │       └── song-name-metadata.json
│   ├── characters/
│   ├── stages/
│   └── levels/
├── images/
├── songs/
└── scripts/`}
                    </pre>
                  </div>
                </div>

                {/* Lane Mapping Specification Table */}
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-2">
                  <span className="font-bold text-xs text-white block">
                    Маппинг дорожек (Lanes): Psych Engine ➔ V-Slice
                  </span>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px] text-slate-300 border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 font-mono">
                          <th className="p-1.5">mustHitSection</th>
                          <th className="p-1.5">Psych Lane</th>
                          <th className="p-1.5">Персонаж (Psych)</th>
                          <th className="p-1.5">V-Slice Lane</th>
                          <th className="p-1.5">Струмлайн (V-Slice)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        <tr>
                          <td className="p-1.5 text-emerald-400">true</td>
                          <td className="p-1.5">0..3</td>
                          <td className="p-1.5">Boyfriend (Player)</td>
                          <td className="p-1.5 text-cyan-300 font-bold">4..7</td>
                          <td className="p-1.5">Player</td>
                        </tr>
                        <tr>
                          <td className="p-1.5 text-emerald-400">true</td>
                          <td className="p-1.5">4..7</td>
                          <td className="p-1.5">Dad / Opponent</td>
                          <td className="p-1.5 text-pink-300 font-bold">0..3</td>
                          <td className="p-1.5">Opponent</td>
                        </tr>
                        <tr>
                          <td className="p-1.5 text-amber-400">false</td>
                          <td className="p-1.5">0..3</td>
                          <td className="p-1.5">Dad / Opponent</td>
                          <td className="p-1.5 text-pink-300 font-bold">0..3</td>
                          <td className="p-1.5">Opponent</td>
                        </tr>
                        <tr>
                          <td className="p-1.5 text-amber-400">false</td>
                          <td className="p-1.5">4..7</td>
                          <td className="p-1.5">Boyfriend (Player)</td>
                          <td className="p-1.5 text-cyan-300 font-bold">4..7</td>
                          <td className="p-1.5">Player</td>
                        </tr>
                        <tr>
                          <td className="p-1.5 text-slate-400">-</td>
                          <td className="p-1.5">8..11</td>
                          <td className="p-1.5">Girlfriend / Extra</td>
                          <td className="p-1.5 text-purple-300 font-bold">8..11</td>
                          <td className="p-1.5">Girlfriend</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-t border-slate-800 bg-slate-950/90">
          <div className="text-[11px] text-slate-400 hidden sm:flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Автоматическое исправление BPM, логики mustHitSection, смещений и защита от Zip-Slip</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
