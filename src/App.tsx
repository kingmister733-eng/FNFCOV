import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SongData, Note, NoteDirection, CharacterId, HitRating, GameSettings, CoverPreset } from './types/fnf';
import { SONGS } from './data/songs';
import { CHARACTERS } from './data/characters';
import { COVER_PRESETS } from './data/coverPresets';
import { soundEngine } from './audio/soundEngine';
import { StageCanvas } from './components/StageCanvas';
import { NoteStrumline } from './components/NoteStrumline';
import { HealthBar } from './components/HealthBar';
import { CoverStudioModal } from './components/CoverStudioModal';
import { ChartEditorModal } from './components/ChartEditorModal';
import { SettingsModal } from './components/SettingsModal';
import { PsychVSliceConverterModal } from './components/PsychVSliceConverterModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import {
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Sliders,
  Settings as SettingsIcon,
  FileText,
  Volume2,
  VolumeX,
  Trophy,
  Flame,
  Award,
  RefreshCw,
  FolderArchive,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export function App() {
  // Current Song & Matchup
  const [currentSong, setCurrentSong] = useState<SongData>(SONGS[0]);
  const [playerCharId, setPlayerCharId] = useState<CharacterId>(SONGS[0].defaultPlayer);
  const [opponentCharId, setOpponentCharId] = useState<CharacterId>(SONGS[0].defaultOpponent);
  const [playerPitchShift, setPlayerPitchShift] = useState<number>(0);
  const [opponentPitchShift, setOpponentPitchShift] = useState<number>(0);
  const [scrollSpeed, setScrollSpeed] = useState<number>(SONGS[0].defaultSpeed);

  // Notes state
  const [songNotes, setSongNotes] = useState<Note[]>(SONGS[0].notes);

  // Settings
  const [settings, setSettings] = useState<GameSettings>({
    downscroll: false,
    botplay: false,
    keybinds: { left: 'd', down: 'f', up: 'j', right: 'k' },
    scrollSpeed: SONGS[0].defaultSpeed,
    audioOffsetMs: 0,
    masterVolume: 0.85,
    instVolume: 0.75,
    voicesVolume: 0.9,
    showHitStats: true,
  });

  // Modals
  const [isStudioOpen, setIsStudioOpen] = useState<boolean>(false);
  const [isChartEditorOpen, setIsChartEditorOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isConverterOpen, setIsConverterOpen] = useState<boolean>(false);

  // Game Engine & Playback State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [songTime, setSongTime] = useState<number>(0);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [isVictory, setIsVictory] = useState<boolean>(false);

  // Game Stats
  const [score, setScore] = useState<number>(0);
  const [combo, setCombo] = useState<number>(0);
  const [maxCombo, setMaxCombo] = useState<number>(0);
  const [health, setHealth] = useState<number>(50); // 0 to 100
  const [misses, setMisses] = useState<number>(0);
  const [ratingCounts, setRatingCounts] = useState({ sick: 0, good: 0, bad: 0, shit: 0, miss: 0 });
  const [accuracy, setAccuracy] = useState<number>(100);

  // Live Animation State
  const [playerPose, setPlayerPose] = useState<NoteDirection | 'idle' | 'miss'>('idle');
  const [opponentPose, setOpponentPose] = useState<NoteDirection | 'idle'>('idle');
  const [currentBeat, setCurrentBeat] = useState<number>(0);

  // Input states [Left, Down, Up, Right]
  const [activePlayerInputs, setActivePlayerInputs] = useState<boolean[]>([false, false, false, false]);
  const [activeOpponentInputs, setActiveOpponentInputs] = useState<boolean[]>([false, false, false, false]);

  // Visual effects
  const [lastRating, setLastRating] = useState<{ rating: HitRating; combo: number; key: number } | null>(null);
  const [splashNotes, setSplashNotes] = useState<{ direction: NoteDirection; id: number }[]>([]);

  // Timers and Refs
  const requestRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const songTimeRef = useRef<number>(0);
  const playerPoseTimeout = useRef<number | null>(null);
  const opponentPoseTimeout = useRef<number | null>(null);

  // Keep ref synced
  useEffect(() => {
    songTimeRef.current = songTime;
  }, [songTime]);

  // Initialize Audio
  useEffect(() => {
    soundEngine.setOnBeat((beat) => {
      setCurrentBeat(beat);
    });
  }, []);

  // Sync volumes when settings change
  useEffect(() => {
    soundEngine.setVolumes(settings.masterVolume, settings.instVolume, settings.voicesVolume);
  }, [settings.masterVolume, settings.instVolume, settings.voicesVolume]);

  // Load a new song or preset
  const handleSelectSong = (song: SongData) => {
    setCurrentSong(song);
    setSongNotes(song.notes);
    setScrollSpeed(song.defaultSpeed);
    setPlayerCharId(song.defaultPlayer);
    setOpponentCharId(song.defaultOpponent);
    handleResetGame();
  };

  const handleApplyPreset = (preset: CoverPreset) => {
    const song = SONGS.find((s) => s.id === preset.songId) || SONGS[0];
    setCurrentSong(song);
    setSongNotes(song.notes);
    setPlayerCharId(preset.player);
    setOpponentCharId(preset.opponent);
    setPlayerPitchShift(preset.playerPitchShift);
    setOpponentPitchShift(preset.opponentPitchShift);
    setScrollSpeed(song.defaultSpeed * preset.speedMultiplier);
    handleResetGame();
  };

  const handleLoadChartToGame = (
    chartNotes: Note[],
    songName: string,
    bpm: number,
    speed: number
  ) => {
    const maxNoteTime =
      chartNotes.length > 0 ? Math.max(...chartNotes.map((n) => n.time + (n.length || 0))) : 60000;
    const customSong: SongData = {
      id: songName.toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
      name: songName,
      composer: 'Psych Engine Mod',
      bpm: bpm && bpm > 0 ? bpm : 100,
      defaultSpeed: speed && speed > 0 ? speed : 2.2,
      defaultPlayer: playerCharId || 'bf',
      defaultOpponent: opponentCharId || 'dad',
      difficulty: 'Normal',
      genre: 'Converted Mod',
      durationMs: maxNoteTime + 3000,
      notes: chartNotes,
    };
    handleSelectSong(customSong);
    setIsConverterOpen(false);
  };

  const handleResetGame = useCallback(() => {
    setIsPlaying(false);
    soundEngine.stopBackingTrack();
    setSongTime(0);
    songTimeRef.current = 0;
    lastTimeRef.current = null;
    setIsGameOver(false);
    setIsVictory(false);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setHealth(50);
    setMisses(0);
    setRatingCounts({ sick: 0, good: 0, bad: 0, shit: 0, miss: 0 });
    setAccuracy(100);
    setPlayerPose('idle');
    setOpponentPose('idle');
    setLastRating(null);
    setSplashNotes([]);
    // Reset hit flags on notes
    setSongNotes((prev) => prev.map((n) => ({ ...n, hit: false, missed: false })));
  }, []);

  // Toggle Play / Pause
  const handleTogglePlay = () => {
    soundEngine.resume();
    if (isPlaying) {
      setIsPlaying(false);
      soundEngine.stopBackingTrack();
    } else {
      if (isGameOver || isVictory) {
        handleResetGame();
      }
      setIsPlaying(true);
      lastTimeRef.current = performance.now();
      soundEngine.startBackingTrack(currentSong.bpm, currentSong.id);
    }
  };

  // Trigger Player Sing Pose
  const triggerPlayerPose = (pose: NoteDirection | 'miss') => {
    setPlayerPose(pose);
    if (playerPoseTimeout.current) clearTimeout(playerPoseTimeout.current);
    playerPoseTimeout.current = window.setTimeout(() => {
      setPlayerPose('idle');
    }, 280);
  };

  // Trigger Opponent Sing Pose
  const triggerOpponentPose = (pose: NoteDirection) => {
    setOpponentPose(pose);
    if (opponentPoseTimeout.current) clearTimeout(opponentPoseTimeout.current);
    opponentPoseTimeout.current = window.setTimeout(() => {
      setOpponentPose('idle');
    }, 280);
  };

  // Register Note Hit
  const registerHit = (direction: NoteDirection, diff: number) => {
    const absDiff = Math.abs(diff);
    let rating: HitRating = 'sick';
    let addedScore = 350;
    let healthDelta = 2.4;

    if (absDiff <= 45) {
      rating = 'sick';
      addedScore = 350;
      healthDelta = 2.4;
      // Note splash
      const splashId = Date.now();
      setSplashNotes((prev) => [...prev, { direction, id: splashId }]);
      setTimeout(() => {
        setSplashNotes((prev) => prev.filter((s) => s.id !== splashId));
      }, 400);
    } else if (absDiff <= 90) {
      rating = 'good';
      addedScore = 200;
      healthDelta = 1.2;
    } else if (absDiff <= 135) {
      rating = 'bad';
      addedScore = 100;
      healthDelta = -0.6;
    } else {
      rating = 'shit';
      addedScore = 50;
      healthDelta = -1.8;
    }

    soundEngine.playHitSound(rating);
    soundEngine.playCharacterVoice(playerCharId, direction, playerPitchShift, 220);
    triggerPlayerPose(direction);

    setCombo((c) => {
      const nextCombo = c + 1;
      setMaxCombo((m) => Math.max(m, nextCombo));
      setLastRating({ rating, combo: nextCombo, key: Date.now() });
      return nextCombo;
    });

    setScore((s) => s + addedScore);
    setHealth((h) => Math.min(100, h + healthDelta));
    setRatingCounts((prev) => {
      const updated = { ...prev, [rating]: prev[rating] + 1 };
      const totalHits = updated.sick + updated.good + updated.bad + updated.shit;
      const weightedScore = updated.sick * 1 + updated.good * 0.75 + updated.bad * 0.4 + updated.shit * 0.1;
      const acc = totalHits > 0 ? (weightedScore / (totalHits + updated.miss)) * 100 : 100;
      setAccuracy(acc);
      return updated;
    });
  };

  // Register Miss
  const registerMiss = (direction?: NoteDirection) => {
    soundEngine.playMissSound();
    triggerPlayerPose('miss');
    setCombo(0);
    setMisses((m) => m + 1);
    setScore((s) => Math.max(0, s - 10));
    setLastRating({ rating: 'miss', combo: 0, key: Date.now() });

    setHealth((h) => {
      const nextHealth = h - 4.5;
      if (nextHealth <= 0) {
        setIsGameOver(true);
        setIsPlaying(false);
        soundEngine.stopBackingTrack();
      }
      return Math.max(0, nextHealth);
    });

    setRatingCounts((prev) => {
      const updated = { ...prev, miss: prev.miss + 1 };
      const totalHits = updated.sick + updated.good + updated.bad + updated.shit;
      const weightedScore = updated.sick * 1 + updated.good * 0.75 + updated.bad * 0.4 + updated.shit * 0.1;
      const acc = totalHits + updated.miss > 0 ? (weightedScore / (totalHits + updated.miss)) * 100 : 100;
      setAccuracy(acc);
      return updated;
    });
  };

  // Keyboard handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const key = e.key.toLowerCase();

      // Check keybind match
      let dir: NoteDirection | null = null;
      if (key === settings.keybinds.left.toLowerCase()) dir = 0;
      else if (key === settings.keybinds.down.toLowerCase()) dir = 1;
      else if (key === settings.keybinds.up.toLowerCase()) dir = 2;
      else if (key === settings.keybinds.right.toLowerCase()) dir = 3;

      if (dir !== null) {
        setActivePlayerInputs((prev) => {
          const next = [...prev];
          next[dir!] = true;
          return next;
        });

        if (!isPlaying) return;

        // Find closest player note in window
        const curTime = songTimeRef.current;
        const HIT_WINDOW = 160;

        const candidate = songNotes.find(
          (n) => n.isPlayer && !n.hit && !n.missed && n.direction === dir && Math.abs(n.time - curTime) <= HIT_WINDOW
        );

        if (candidate) {
          candidate.hit = true;
          registerHit(dir, candidate.time - curTime);
        } else {
          // Ghost tapping penalty (optional in FNF, here gentle miss sound)
          registerMiss(dir);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      let dir: NoteDirection | null = null;
      if (key === settings.keybinds.left.toLowerCase()) dir = 0;
      else if (key === settings.keybinds.down.toLowerCase()) dir = 1;
      else if (key === settings.keybinds.up.toLowerCase()) dir = 2;
      else if (key === settings.keybinds.right.toLowerCase()) dir = 3;

      if (dir !== null) {
        setActivePlayerInputs((prev) => {
          const next = [...prev];
          next[dir!] = false;
          return next;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isPlaying, settings.keybinds, songNotes, playerCharId, playerPitchShift]);

  // Main Game Loop
  useEffect(() => {
    if (!isPlaying) return;

    const gameLoop = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const delta = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      const nextTime = songTimeRef.current + delta;
      songTimeRef.current = nextTime;
      setSongTime(nextTime);

      // Check song end
      if (nextTime >= currentSong.durationMs) {
        setIsPlaying(false);
        setIsVictory(true);
        soundEngine.stopBackingTrack();
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 },
        });
        return;
      }

      // 1. Process Opponent Notes (Auto Sing)
      songNotes.forEach((note) => {
        if (!note.isPlayer && !note.hit && nextTime >= note.time) {
          note.hit = true;
          // Play opponent voice chromatic
          soundEngine.playCharacterVoice(opponentCharId, note.direction, opponentPitchShift, 200);
          triggerOpponentPose(note.direction);

          // Flash opponent receptor
          setActiveOpponentInputs((prev) => {
            const next = [...prev];
            next[note.direction] = true;
            return next;
          });
          setTimeout(() => {
            setActiveOpponentInputs((prev) => {
              const next = [...prev];
              next[note.direction] = false;
              return next;
            });
          }, 120);
        }

        // 2. Process Botplay for Player
        if (settings.botplay && note.isPlayer && !note.hit && nextTime >= note.time) {
          note.hit = true;
          registerHit(note.direction, 0);
          setActivePlayerInputs((prev) => {
            const next = [...prev];
            next[note.direction] = true;
            return next;
          });
          setTimeout(() => {
            setActivePlayerInputs((prev) => {
              const next = [...prev];
              next[note.direction] = false;
              return next;
            });
          }, 120);
        }

        // 3. Process Missed Notes (passed window)
        if (!settings.botplay && note.isPlayer && !note.hit && !note.missed && nextTime - note.time > 170) {
          note.missed = true;
          registerMiss(note.direction);
        }
      });

      requestRef.current = requestAnimationFrame(gameLoop);
    };

    requestRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [
    isPlaying,
    currentSong.durationMs,
    songNotes,
    opponentCharId,
    opponentPitchShift,
    settings.botplay,
    playerCharId,
    playerPitchShift,
  ]);

  // Touch / On-screen button helper
  const handleTouchArrow = (dir: NoteDirection) => {
    soundEngine.resume();
    setActivePlayerInputs((prev) => {
      const next = [...prev];
      next[dir] = true;
      return next;
    });

    if (isPlaying) {
      const curTime = songTimeRef.current;
      const candidate = songNotes.find(
        (n) => n.isPlayer && !n.hit && !n.missed && n.direction === dir && Math.abs(n.time - curTime) <= 160
      );

      if (candidate) {
        candidate.hit = true;
        registerHit(dir, candidate.time - curTime);
      } else {
        registerMiss(dir);
      }
    } else {
      soundEngine.playCharacterVoice(playerCharId, dir, playerPitchShift, 180);
      triggerPlayerPose(dir);
    }

    setTimeout(() => {
      setActivePlayerInputs((prev) => {
        const next = [...prev];
        next[dir] = false;
        return next;
      });
    }, 150);
  };

  const keyLabels = [
    settings.keybinds.left.toUpperCase(),
    settings.keybinds.down.toUpperCase(),
    settings.keybinds.up.toUpperCase(),
    settings.keybinds.right.toUpperCase(),
  ];

  const getRankLetter = (acc: number) => {
    if (acc >= 98) return 'S+';
    if (acc >= 93) return 'S';
    if (acc >= 85) return 'A';
    if (acc >= 75) return 'B';
    if (acc >= 60) return 'C';
    return 'D';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-pink-500 selection:text-white">
      {/* Top Header & Cover Bar */}
      <header className="w-full bg-slate-950/90 border-b border-slate-800/80 backdrop-blur-xl px-4 py-3 sticky top-0 z-40 shadow-lg shadow-indigo-950/20">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          {/* Logo & Tag */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-500 to-blue-500 p-0.5 shadow-lg shadow-indigo-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center text-lg">
                🎤
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg md:text-xl font-black font-bungee tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-violet-300 via-indigo-200 to-blue-300">
                  FNFCOV
                </h1>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold tracking-widest bg-violet-500/10 text-violet-200 border border-violet-400/25">
                  COVER ENGINE
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Friday Night Funkin' Vocal Cover Studio & Player
              </p>
            </div>
          </div>

          {/* Current Song & Singer Matchup Badge */}
          <div className="hidden md:flex items-center gap-3 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-2xl shadow-inner">
            <span className="text-xs font-bold text-white">{currentSong.name}</span>
            <span className="text-slate-600 font-bold">•</span>
            <div className="flex items-center gap-1 text-xs">
              <span className="text-base">{CHARACTERS[opponentCharId].avatarEmoji}</span>
              <span className="font-bold text-purple-400">{CHARACTERS[opponentCharId].name}</span>
              <span className="text-slate-500 font-black text-[10px]">VS</span>
              <span className="font-bold text-cyan-400">{CHARACTERS[playerCharId].name}</span>
              <span className="text-base">{CHARACTERS[playerCharId].avatarEmoji}</span>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2">
            {/* PWA Android Install Button */}
            <PWAInstallButton />

            {/* Psych <-> V-Slice Converter Main Button */}
            <button
              onClick={() => setIsConverterOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs tracking-wider uppercase shadow-lg shadow-indigo-950/40 transition-all transform hover:scale-105 active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Конвертер</span>
            </button>

            {/* Cover Studio Button */}
            <button
              onClick={() => setIsStudioOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-violet-700 to-indigo-700 hover:from-violet-600 hover:to-indigo-600 text-white font-bold text-xs tracking-wider uppercase shadow-md shadow-indigo-950/40 transition-all transform hover:scale-105 active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Studio</span>
            </button>

            {/* Chart Editor Button */}
            <button
              onClick={() => setIsChartEditorOpen(true)}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 font-bold text-xs transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Chart</span>
            </button>

            {/* Settings Button */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              title="Настройки"
            >
              <SettingsIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Play Area */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-3 md:px-6 py-3 flex flex-col justify-between gap-3">
        {/* Quick Android Converter Banner */}
        <div className="w-full bg-gradient-to-r from-indigo-950/80 via-slate-900 to-violet-950/70 border border-indigo-400/20 p-3 sm:p-4 rounded-2xl flex items-center justify-between gap-3 shadow-lg shadow-indigo-950/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-indigo-500/15 text-indigo-200 border border-indigo-400/25">
              <FolderArchive className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-xs text-white flex items-center gap-2">
                <span>Psych Engine ⮀ V-Slice Конвертер для Android</span>
                <span className="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Без багов • Все типы файлов
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Конвертируйте полные ZIP-моды, чарты, события, персонажей и сцены для игры на телефоне
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsConverterOpen(true)}
            className="whitespace-nowrap px-3.5 py-1.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs uppercase tracking-wider shadow-md shadow-indigo-950/40 transition-transform hover:scale-[1.02] active:scale-95"
          >
            Открыть Конвертер
          </button>
        </div>
        {/* Animated FNF Battle Stage */}
        <StageCanvas
          playerCharId={playerCharId}
          opponentCharId={opponentCharId}
          playerPose={playerPose}
          opponentPose={opponentPose}
          currentBeat={currentBeat}
          combo={combo}
        />

        {/* Note Strumline & Highway */}
        <NoteStrumline
          notes={songNotes}
          songTime={songTime}
          scrollSpeed={scrollSpeed}
          downscroll={settings.downscroll}
          activePlayerInputs={activePlayerInputs}
          activeOpponentInputs={activeOpponentInputs}
          lastRating={lastRating}
          splashNotes={splashNotes}
          keybindLabels={keyLabels}
        />

        {/* Health Bar & Tug-of-War */}
        <HealthBar
          health={health}
          playerCharId={playerCharId}
          opponentCharId={opponentCharId}
          score={score}
          misses={misses}
          accuracy={accuracy}
          isBeatEven={currentBeat % 2 === 0}
        />

        {/* Bottom Playback & Control Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 p-3 sm:p-4 rounded-2xl shadow-xl shadow-black/20">
          {/* Play/Pause & Reset */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleTogglePlay}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm tracking-wider uppercase transition-all shadow-lg ${
                isPlaying
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                  : 'bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white shadow-indigo-500/20'
              }`}
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
              <span>{isPlaying ? 'Pause' : 'Start Battle'}</span>
            </button>

            <button
              onClick={handleResetGame}
              title="Reset Song"
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Song Progress Bar */}
          <div className="flex-1 w-full max-w-xs flex flex-col gap-1">
            <div className="flex justify-between text-[11px] font-mono text-slate-400">
              <span>{(songTime / 1000).toFixed(1)}s</span>
              <span>{(currentSong.durationMs / 1000).toFixed(1)}s</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-violet-400 transition-all duration-100"
                style={{ width: `${Math.min(100, (songTime / currentSong.durationMs) * 100)}%` }}
              />
            </div>
          </div>

          {/* On-screen Touch Controls (Mobile Friendly / Mouse buttons) */}
          <div className="flex items-center gap-1.5">
            <button
              onMouseDown={() => handleTouchArrow(0)}
              className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-400/30 hover:bg-violet-500/30 text-violet-200 font-black text-xs active:scale-95 transition-all flex items-center justify-center shadow"
            >
              ⬅️
            </button>
            <button
              onMouseDown={() => handleTouchArrow(1)}
              className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-400/30 hover:bg-indigo-500/30 text-indigo-200 font-black text-xs active:scale-95 transition-all flex items-center justify-center shadow"
            >
              ⬇️
            </button>
            <button
              onMouseDown={() => handleTouchArrow(2)}
              className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/50 hover:bg-emerald-500/40 text-emerald-400 font-black text-xs active:scale-95 transition-all flex items-center justify-center shadow"
            >
              ⬆️
            </button>
            <button
              onMouseDown={() => handleTouchArrow(3)}
              className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/50 hover:bg-rose-500/40 text-rose-400 font-black text-xs active:scale-95 transition-all flex items-center justify-center shadow"
            >
              ➡️
            </button>
          </div>
        </div>
      </main>

      {/* GAME OVER MODAL (Blue balled!) */}
      {isGameOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border-2 border-red-600 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl flex flex-col items-center">
            <div className="text-6xl mb-3 animate-bounce">⚡💀⚡</div>
            <h2 className="text-3xl font-black font-bungee text-red-500 tracking-wider mb-2">
              GAME OVER
            </h2>
            <p className="text-sm text-slate-400 mb-6">
              You got blue-balled! Don't let {CHARACTERS[opponentCharId].name} win the rap battle.
            </p>
            <div className="w-full bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs font-mono text-slate-300 space-y-1 mb-6">
              <div className="flex justify-between">
                <span>Final Score:</span>
                <span className="text-pink-400 font-bold">{score.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Accuracy:</span>
                <span className="text-cyan-400 font-bold">{accuracy.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Max Combo:</span>
                <span className="text-amber-400 font-bold">{maxCombo}</span>
              </div>
            </div>
            <div className="flex gap-3 w-full">
              <button
                onClick={handleResetGame}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-sm tracking-wider uppercase transition-colors shadow-lg shadow-red-600/30"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VICTORY MODAL */}
      {isVictory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border-2 border-pink-500 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl flex flex-col items-center">
            <div className="text-5xl mb-2">🏆🎉</div>
            <h2 className="text-2xl font-black font-bungee text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-amber-300 to-cyan-400 tracking-wider mb-1">
              COVER COMPLETED!
            </h2>
            <div className="text-6xl font-black font-bungee text-amber-400 my-3">
              {getRankLetter(accuracy)}
            </div>
            <div className="w-full bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs font-mono text-slate-300 space-y-2 mb-6">
              <div className="flex justify-between">
                <span>Song:</span>
                <span className="text-white font-bold">{currentSong.name}</span>
              </div>
              <div className="flex justify-between">
                <span>Cover:</span>
                <span className="text-pink-400 font-bold">
                  {CHARACTERS[playerCharId].name} vs {CHARACTERS[opponentCharId].name}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Score:</span>
                <span className="text-cyan-400 font-bold">{score.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Accuracy:</span>
                <span className="text-emerald-400 font-bold">{accuracy.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Max Combo:</span>
                <span className="text-amber-400 font-bold">{maxCombo}</span>
              </div>
            </div>
            <div className="flex gap-3 w-full">
              <button
                onClick={handleResetGame}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-cyan-500 hover:from-pink-400 hover:to-cyan-400 text-slate-950 font-black text-sm tracking-wider uppercase transition-all shadow-lg"
              >
                Play Again
              </button>
              <button
                onClick={() => {
                  handleResetGame();
                  setIsStudioOpen(true);
                }}
                className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm transition-colors"
              >
                Remix Cover
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cover Studio Modal */}
      <CoverStudioModal
        isOpen={isStudioOpen}
        onClose={() => setIsStudioOpen(false)}
        currentSong={currentSong}
        onSelectSong={handleSelectSong}
        playerCharId={playerCharId}
        onChangePlayer={setPlayerCharId}
        opponentCharId={opponentCharId}
        onChangeOpponent={setOpponentCharId}
        playerPitchShift={playerPitchShift}
        onChangePlayerPitch={setPlayerPitchShift}
        opponentPitchShift={opponentPitchShift}
        onChangeOpponentPitch={setOpponentPitchShift}
        scrollSpeed={scrollSpeed}
        onChangeScrollSpeed={setScrollSpeed}
        onApplyPreset={handleApplyPreset}
        onStartBattle={handleTogglePlay}
      />

      {/* Chart Editor Modal */}
      <ChartEditorModal
        isOpen={isChartEditorOpen}
        onClose={() => setIsChartEditorOpen(false)}
        song={currentSong}
        playerCharId={playerCharId}
        opponentCharId={opponentCharId}
        onSaveChart={(newNotes) => setSongNotes(newNotes)}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={setSettings}
      />

      {/* Psych Engine <-> V-Slice Converter Modal */}
      <PsychVSliceConverterModal
        isOpen={isConverterOpen}
        onClose={() => setIsConverterOpen(false)}
        onLoadChartToGame={handleLoadChartToGame}
      />
    </div>
  );
}

export default App;
