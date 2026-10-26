import React, { useState } from 'react';
import { CharacterId, SongData, CoverPreset } from '../types/fnf';
import { CHARACTERS, CHARACTER_LIST } from '../data/characters';
import { SONGS } from '../data/songs';
import { COVER_PRESETS } from '../data/coverPresets';
import { soundEngine } from '../audio/soundEngine';
import { X, Play, RefreshCw, Music, Volume2, Sliders, Sparkles, Download, Upload } from 'lucide-react';

interface CoverStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSong: SongData;
  onSelectSong: (song: SongData) => void;
  playerCharId: CharacterId;
  onChangePlayer: (charId: CharacterId) => void;
  opponentCharId: CharacterId;
  onChangeOpponent: (charId: CharacterId) => void;
  playerPitchShift: number;
  onChangePlayerPitch: (semitones: number) => void;
  opponentPitchShift: number;
  onChangeOpponentPitch: (semitones: number) => void;
  scrollSpeed: number;
  onChangeScrollSpeed: (speed: number) => void;
  onApplyPreset: (preset: CoverPreset) => void;
  onStartBattle: () => void;
}

export const CoverStudioModal: React.FC<CoverStudioModalProps> = ({
  isOpen,
  onClose,
  currentSong,
  onSelectSong,
  playerCharId,
  onChangePlayer,
  opponentCharId,
  onChangeOpponent,
  playerPitchShift,
  onChangePlayerPitch,
  opponentPitchShift,
  onChangeOpponentPitch,
  scrollSpeed,
  onChangeScrollSpeed,
  onApplyPreset,
  onStartBattle,
}) => {
  const [activeTab, setActiveTab] = useState<'singers' | 'chromatics' | 'presets'>('singers');
  const [auditionChar, setAuditionChar] = useState<CharacterId>(playerCharId);

  if (!isOpen) return null;

  const playerChar = CHARACTERS[playerCharId];
  const opponentChar = CHARACTERS[opponentCharId];

  // Swap characters
  const handleSwapRoles = () => {
    const prevP = playerCharId;
    const prevO = opponentCharId;
    const prevPPitch = playerPitchShift;
    const prevOPitch = opponentPitchShift;
    onChangePlayer(prevO);
    onChangeOpponent(prevP);
    onChangePlayerPitch(prevOPitch);
    onChangeOpponentPitch(prevPPitch);
  };

  // Chromatic audition scale notes (13 semitones: C to High C)
  const scaleNotes = [
    { name: 'C', semi: 0 },
    { name: 'C#', semi: 1 },
    { name: 'D', semi: 2 },
    { name: 'D#', semi: 3 },
    { name: 'E', semi: 4 },
    { name: 'F', semi: 5 },
    { name: 'F#', semi: 6 },
    { name: 'G', semi: 7 },
    { name: 'G#', semi: 8 },
    { name: 'A', semi: 9 },
    { name: 'A#', semi: 10 },
    { name: 'B', semi: 11 },
    { name: 'C+', semi: 12 },
  ];

  const handleExportCover = () => {
    const coverData = {
      title: `${currentSong.name} Cover (${playerChar.name} vs ${opponentChar.name})`,
      songId: currentSong.id,
      player: playerCharId,
      opponent: opponentCharId,
      playerPitchShift,
      opponentPitchShift,
      scrollSpeed,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(coverData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FNFCOV_${currentSong.id}_${playerCharId}_vs_${opponentCharId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-slate-900 border-2 border-slate-700 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/40">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black font-bungee tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-300 to-cyan-400">
                FNF COVER STUDIO
              </h2>
              <p className="text-xs text-slate-400">
                Craft, tune, and remix vocal covers with authentic chromatic soundfonts
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

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-800 bg-slate-950/40">
          <button
            onClick={() => setActiveTab('singers')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-bold transition-all ${
              activeTab === 'singers'
                ? 'bg-slate-800 text-pink-400 border-t-2 border-pink-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            Singers & Pitch Tuning
          </button>
          <button
            onClick={() => setActiveTab('chromatics')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-bold transition-all ${
              activeTab === 'chromatics'
                ? 'bg-slate-800 text-cyan-400 border-t-2 border-cyan-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Volume2 className="w-4 h-4" />
            Chromatic Vocal Audition
          </button>
          <button
            onClick={() => setActiveTab('presets')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-bold transition-all ${
              activeTab === 'presets'
                ? 'bg-slate-800 text-amber-400 border-t-2 border-amber-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Cover Presets
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'singers' && (
            <div className="space-y-6">
              {/* Song Selector */}
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2 mb-2">
                  <Music className="w-4 h-4 text-pink-400" />
                  Select Base Track
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {SONGS.map((song) => (
                    <button
                      key={song.id}
                      onClick={() => onSelectSong(song)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        currentSong.id === song.id
                          ? 'bg-pink-500/20 border-pink-500 text-white shadow-lg'
                          : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-bold text-sm truncate">{song.name}</div>
                      <div className="text-xs text-slate-400 flex items-center justify-between mt-1">
                        <span>{song.bpm} BPM</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-pink-300 font-mono">
                          {song.difficulty}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Singer Matchup & Role Swapping */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
                {/* Swap Roles Button in center */}
                <button
                  onClick={handleSwapRoles}
                  title="Swap Singers"
                  className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-pink-600 hover:bg-pink-500 text-white items-center justify-center shadow-xl border-2 border-slate-900 transition-transform hover:scale-110 active:rotate-180"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>

                {/* Opponent Selection (Left) */}
                <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{opponentChar.avatarEmoji}</span>
                        <div>
                          <div className="text-xs uppercase font-bold text-purple-400 tracking-wider">
                            Opponent Singer (Left Track)
                          </div>
                          <div className="font-bold text-base text-white">{opponentChar.name}</div>
                        </div>
                      </div>
                      <span className="text-xs font-mono text-slate-400">
                        {opponentPitchShift > 0 ? `+${opponentPitchShift}` : opponentPitchShift} ST
                      </span>
                    </div>

                    {/* Character Selector Grid */}
                    <div className="grid grid-cols-4 gap-2 mb-4">
                      {CHARACTER_LIST.map((char) => (
                        <button
                          key={`opp-pick-${char.id}`}
                          onClick={() => onChangeOpponent(char.id)}
                          className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                            opponentCharId === char.id
                              ? 'bg-purple-500/20 border-purple-500 scale-105 shadow-md'
                              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 opacity-70 hover:opacity-100'
                          }`}
                        >
                          <span className="text-2xl">{char.avatarEmoji}</span>
                          <span className="text-[10px] font-bold truncate max-w-full">{char.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Vocal Pitch Tuning */}
                  <div className="pt-3 border-t border-slate-800">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Vocal Pitch Transpose</span>
                      <span className="font-mono text-purple-300">
                        {opponentPitchShift === 0 ? 'Normal (0)' : `${opponentPitchShift > 0 ? '+' : ''}${opponentPitchShift} Semitones`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-12"
                      max="12"
                      step="1"
                      value={opponentPitchShift}
                      onChange={(e) => onChangeOpponentPitch(parseInt(e.target.value, 10))}
                      className="w-full accent-purple-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                      <span>-1 Octave</span>
                      <span>Default</span>
                      <span>+1 Octave</span>
                    </div>
                  </div>
                </div>

                {/* Player Selection (Right) */}
                <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{playerChar.avatarEmoji}</span>
                        <div>
                          <div className="text-xs uppercase font-bold text-cyan-400 tracking-wider">
                            Player Singer (Right Track)
                          </div>
                          <div className="font-bold text-base text-white">{playerChar.name}</div>
                        </div>
                      </div>
                      <span className="text-xs font-mono text-slate-400">
                        {playerPitchShift > 0 ? `+${playerPitchShift}` : playerPitchShift} ST
                      </span>
                    </div>

                    {/* Character Selector Grid */}
                    <div className="grid grid-cols-4 gap-2 mb-4">
                      {CHARACTER_LIST.map((char) => (
                        <button
                          key={`ply-pick-${char.id}`}
                          onClick={() => onChangePlayer(char.id)}
                          className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                            playerCharId === char.id
                              ? 'bg-cyan-500/20 border-cyan-500 scale-105 shadow-md'
                              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 opacity-70 hover:opacity-100'
                          }`}
                        >
                          <span className="text-2xl">{char.avatarEmoji}</span>
                          <span className="text-[10px] font-bold truncate max-w-full">{char.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Vocal Pitch Tuning */}
                  <div className="pt-3 border-t border-slate-800">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Vocal Pitch Transpose</span>
                      <span className="font-mono text-cyan-300">
                        {playerPitchShift === 0 ? 'Normal (0)' : `${playerPitchShift > 0 ? '+' : ''}${playerPitchShift} Semitones`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-12"
                      max="12"
                      step="1"
                      value={playerPitchShift}
                      onChange={(e) => onChangePlayerPitch(parseInt(e.target.value, 10))}
                      className="w-full accent-cyan-400 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                      <span>-1 Octave</span>
                      <span>Default</span>
                      <span>+1 Octave</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Scroll Speed Multiplier */}
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400 font-bold uppercase tracking-wider">
                    Arrow Scroll Speed Multiplier
                  </span>
                  <span className="font-mono text-pink-400 font-bold">{scrollSpeed.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="3.5"
                  step="0.1"
                  value={scrollSpeed}
                  onChange={(e) => onChangeScrollSpeed(parseFloat(e.target.value))}
                  className="w-full accent-pink-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>1.0x (Relaxed)</span>
                  <span>2.0x (Standard)</span>
                  <span>3.5x (Insane Fast)</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'chromatics' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-white">Character Chromatic Voice Audition</h3>
                  <p className="text-xs text-slate-400">
                    Tap the piano keys to trigger real-time synthesized formant chromatics for any character!
                  </p>
                </div>
                {/* Character Picker */}
                <select
                  value={auditionChar}
                  onChange={(e) => setAuditionChar(e.target.value as CharacterId)}
                  className="bg-slate-800 text-white font-bold text-sm px-3 py-2 rounded-xl border border-slate-700 focus:outline-none focus:border-pink-500"
                >
                  {CHARACTER_LIST.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.voiceStyle.split(' ')[0]})
                    </option>
                  ))}
                </select>
              </div>

              {/* Current Character Voice Info Card */}
              <div
                className="p-4 rounded-2xl border flex items-center gap-4"
                style={{
                  backgroundColor: `${CHARACTERS[auditionChar].color}15`,
                  borderColor: `${CHARACTERS[auditionChar].color}55`,
                }}
              >
                <div className="text-4xl">{CHARACTERS[auditionChar].avatarEmoji}</div>
                <div>
                  <div className="font-bold text-white text-base">{CHARACTERS[auditionChar].name}</div>
                  <div className="text-xs text-slate-300 font-mono mb-1">
                    {CHARACTERS[auditionChar].voiceStyle}
                  </div>
                  <div className="text-xs text-slate-400">
                    {CHARACTERS[auditionChar].description}
                  </div>
                </div>
              </div>

              {/* Interactive Chromatic Piano Roll */}
              <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800">
                <div className="text-xs font-mono text-slate-400 mb-3 uppercase tracking-wider text-center">
                  Chromatic Scale Keyboard (Tap to sing)
                </div>
                <div className="flex items-center justify-center gap-1.5 overflow-x-auto pb-2">
                  {scaleNotes.map((note) => {
                    const isSharp = note.name.includes('#');
                    return (
                      <button
                        key={note.name}
                        onClick={() => soundEngine.auditionNote(auditionChar, note.semi)}
                        className={`transition-all rounded-lg flex flex-col items-center justify-end pb-3 active:scale-95 active:brightness-125 ${
                          isSharp
                            ? 'w-10 h-28 bg-slate-800 hover:bg-slate-700 text-pink-400 border border-slate-700 font-mono text-xs z-10 -mx-2 shadow-lg'
                            : 'w-12 h-36 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold text-sm'
                        }`}
                        style={{
                          boxShadow: '0 4px 6px rgba(0,0,0,0.5)',
                        }}
                      >
                        <span className="font-mono text-[10px] opacity-60">+{note.semi}</span>
                        <span>{note.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'presets' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {COVER_PRESETS.map((preset) => {
                const song = SONGS.find((s) => s.id === preset.songId) || SONGS[0];
                const ply = CHARACTERS[preset.player];
                const opp = CHARACTERS[preset.opponent];

                return (
                  <div
                    key={preset.id}
                    className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 hover:border-pink-500/50 transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30">
                          {preset.tag}
                        </span>
                        <span className="text-xs text-slate-400">{song.bpm} BPM</span>
                      </div>
                      <h4 className="font-black text-base text-white group-hover:text-pink-400 transition-colors">
                        {preset.title}
                      </h4>
                      <div className="flex items-center gap-3 mt-3 text-sm text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <span className="text-lg">{opp.avatarEmoji}</span>
                          <span className="font-bold">{opp.name}</span>
                        </div>
                        <span className="text-slate-500 font-black">VS</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-lg">{ply.avatarEmoji}</span>
                          <span className="font-bold">{ply.name}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        onApplyPreset(preset);
                        onClose();
                      }}
                      className="mt-4 w-full py-2.5 rounded-xl bg-pink-600/30 hover:bg-pink-600 border border-pink-500/50 text-white font-bold text-xs tracking-wider uppercase transition-colors flex items-center justify-center gap-2"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Load This Cover Preset
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/90">
          <button
            onClick={handleExportCover}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Cover (.json)
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl hover:bg-slate-800 text-slate-300 font-bold text-sm transition-colors"
            >
              Close Studio
            </button>
            <button
              onClick={() => {
                onClose();
                onStartBattle();
              }}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-cyan-500 hover:from-pink-400 hover:to-cyan-400 text-slate-950 font-black text-sm tracking-wider uppercase shadow-xl hover:shadow-pink-500/25 transition-all transform hover:scale-105"
            >
              <Play className="w-4 h-4 fill-current" />
              Play This Cover
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
