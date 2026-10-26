import React from 'react';
import { CharacterId, NoteDirection } from '../types/fnf';
import { CHARACTERS } from '../data/characters';

interface StageCanvasProps {
  playerCharId: CharacterId;
  opponentCharId: CharacterId;
  playerPose: NoteDirection | 'idle' | 'miss';
  opponentPose: NoteDirection | 'idle';
  currentBeat: number;
  combo: number;
}

export const StageCanvas: React.FC<StageCanvasProps> = ({
  playerCharId,
  opponentCharId,
  playerPose,
  opponentPose,
  currentBeat,
  combo,
}) => {
  const player = CHARACTERS[playerCharId];
  const opponent = CHARACTERS[opponentCharId];

  // Helper for pose transform & offset
  const getPoseStyle = (pose: NoteDirection | 'idle' | 'miss', isPlayer: boolean) => {
    if (pose === 'idle') {
      return 'translate-y-0 scale-100';
    }
    if (pose === 'miss') {
      return 'translate-y-2 scale-95 brightness-75 rotate-3';
    }
    switch (pose) {
      case 0: // Left
        return isPlayer ? '-translate-x-5 -rotate-6' : '-translate-x-6 rotate-6';
      case 1: // Down
        return 'translate-y-5 scale-y-90 scale-x-105';
      case 2: // Up
        return '-translate-y-6 scale-y-110';
      case 3: // Right
        return isPlayer ? 'translate-x-6 rotate-6' : 'translate-x-5 -rotate-6';
      default:
        return '';
    }
  };

  const isBeatEven = currentBeat % 2 === 0;

  return (
    <div className="relative w-full h-72 md:h-84 bg-gradient-to-b from-indigo-950 via-slate-900 to-black rounded-2xl overflow-hidden border-2 border-slate-800 shadow-2xl flex items-end justify-between px-4 md:px-12 pb-3">
      {/* Background Stage Lights & Brick Wall */}
      <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(#ec4899_1px,transparent_1px)] [background-size:16px_16px]" />
      
      {/* Stage Spotlights */}
      <div
        className="absolute top-0 left-1/4 w-32 md:w-48 h-full bg-gradient-to-b from-purple-500/25 via-transparent to-transparent -rotate-12 blur-lg pointer-events-none"
        style={{ opacity: isBeatEven ? 0.9 : 0.4, transition: 'opacity 0.2s' }}
      />
      <div
        className="absolute top-0 right-1/4 w-32 md:w-48 h-full bg-gradient-to-b from-cyan-400/25 via-transparent to-transparent rotate-12 blur-lg pointer-events-none"
        style={{ opacity: isBeatEven ? 0.9 : 0.4, transition: 'opacity 0.2s' }}
      />

      {/* Stage Floor */}
      <div className="absolute bottom-0 inset-x-0 h-10 bg-gradient-to-t from-slate-950 to-slate-800/80 border-t border-slate-700/60" />

      {/* Left Character: OPPONENT */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Character Title Tag */}
        <div
          className="mb-2 px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wider uppercase border shadow-md backdrop-blur-md"
          style={{
            backgroundColor: `${opponent.color}22`,
            borderColor: `${opponent.color}66`,
            color: opponent.color,
          }}
        >
          {opponent.name}
        </div>

        {/* Animated Avatar Box */}
        <div
          className={`relative transition-all duration-100 ease-out flex flex-col items-center ${getPoseStyle(
            opponentPose,
            false
          )}`}
          style={{
            transformOrigin: 'bottom center',
          }}
        >
          {/* Sing Flash Aura */}
          {opponentPose !== 'idle' && (
            <div
              className="absolute -inset-4 rounded-full blur-xl pointer-events-none animate-pulse"
              style={{ backgroundColor: `${opponent.color}55` }}
            />
          )}

          {/* Character Body Mock Graphic */}
          <div
            className="w-24 h-28 md:w-32 md:h-36 rounded-2xl flex flex-col items-center justify-center p-2 relative shadow-2xl border-2"
            style={{
              backgroundColor: '#181b2a',
              borderColor: opponentPose !== 'idle' ? opponent.color : '#334155',
              boxShadow: opponentPose !== 'idle' ? `0 0 25px ${opponent.color}88` : '0 10px 25px rgba(0,0,0,0.6)',
            }}
          >
            {/* Animated Face / Emoji */}
            <div className="text-4xl md:text-5xl select-none filter drop-shadow">
              {opponent.avatarEmoji}
            </div>

            {/* Mic / Weapon in hand */}
            <div className="absolute bottom-2 right-2 text-xl">
              🎤
            </div>

            {/* Note Direction Indicator Pill */}
            {opponentPose !== 'idle' && (
              <div
                className="absolute -top-3 px-2 py-0.5 text-[10px] font-black rounded-md text-slate-950 uppercase"
                style={{ backgroundColor: opponent.color }}
              >
                {opponentPose === 0 ? 'LEFT' : opponentPose === 1 ? 'DOWN' : opponentPose === 2 ? 'UP' : 'RIGHT'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CENTER: GF ON THE GIANT BOOMBOX SPEAKERS */}
      <div className="relative z-0 flex flex-col items-center justify-end mb-2">
        {/* Girlfriend (GF) */}
        <div
          className="relative transition-transform duration-150 flex flex-col items-center -mb-2"
          style={{
            transform: `scale(${isBeatEven ? 1.05 : 0.98}) translateY(${isBeatEven ? '-3px' : '0px'}) rotate(${
              isBeatEven ? '-3deg' : '3deg'
            })`,
          }}
        >
          <div className="text-3xl filter drop-shadow-md select-none">💃</div>
          <span className="text-[10px] font-bold text-pink-400 tracking-wider">GF</span>
        </div>

        {/* Boombox Speaker Stack */}
        <div
          className={`w-32 md:w-44 h-24 md:h-28 bg-gradient-to-b from-stone-900 to-stone-950 rounded-xl border-2 border-stone-700 shadow-2xl flex items-center justify-around px-3 py-2 transition-transform duration-150 ${
            isBeatEven ? 'scale-105' : 'scale-100'
          }`}
          style={{
            boxShadow: isBeatEven ? '0 0 30px rgba(236,72,153,0.35)' : 'none',
          }}
        >
          {/* Left Speaker Cone */}
          <div className="w-10 h-10 md:w-14 md:h-14 rounded-full bg-stone-950 border-4 border-stone-800 flex items-center justify-center">
            <div
              className={`w-5 h-5 md:w-7 md:h-7 rounded-full bg-pink-600 transition-transform duration-150 ${
                isBeatEven ? 'scale-125' : 'scale-90'
              }`}
            />
          </div>

          {/* Center Graphic */}
          <div className="flex flex-col items-center">
            <div className="w-4 h-1 bg-red-500 rounded-full mb-1" />
            <div className="text-[9px] font-black tracking-widest text-pink-400 font-pixel">FNF</div>
            <div className="w-4 h-1 bg-red-500 rounded-full mt-1" />
          </div>

          {/* Right Speaker Cone */}
          <div className="w-10 h-10 md:w-14 md:h-14 rounded-full bg-stone-950 border-4 border-stone-800 flex items-center justify-center">
            <div
              className={`w-5 h-5 md:w-7 md:h-7 rounded-full bg-pink-600 transition-transform duration-150 ${
                isBeatEven ? 'scale-125' : 'scale-90'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Right Character: PLAYER */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Character Title Tag */}
        <div
          className="mb-2 px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wider uppercase border shadow-md backdrop-blur-md"
          style={{
            backgroundColor: `${player.color}22`,
            borderColor: `${player.color}66`,
            color: player.color,
          }}
        >
          {player.name}
        </div>

        {/* Animated Avatar Box */}
        <div
          className={`relative transition-all duration-100 ease-out flex flex-col items-center ${getPoseStyle(
            playerPose,
            true
          )}`}
          style={{
            transformOrigin: 'bottom center',
          }}
        >
          {/* Sing Flash Aura */}
          {playerPose !== 'idle' && playerPose !== 'miss' && (
            <div
              className="absolute -inset-4 rounded-full blur-xl pointer-events-none animate-pulse"
              style={{ backgroundColor: `${player.color}55` }}
            />
          )}

          {/* Miss red flash */}
          {playerPose === 'miss' && (
            <div className="absolute -inset-4 rounded-full blur-xl pointer-events-none bg-red-600/40" />
          )}

          {/* Character Body Mock Graphic */}
          <div
            className="w-24 h-28 md:w-32 md:h-36 rounded-2xl flex flex-col items-center justify-center p-2 relative shadow-2xl border-2"
            style={{
              backgroundColor: playerPose === 'miss' ? '#2d1519' : '#181b2a',
              borderColor:
                playerPose === 'miss'
                  ? '#ef4444'
                  : playerPose !== 'idle'
                  ? player.color
                  : '#334155',
              boxShadow:
                playerPose === 'miss'
                  ? '0 0 25px rgba(239,68,68,0.7)'
                  : playerPose !== 'idle'
                  ? `0 0 25px ${player.color}88`
                  : '0 10px 25px rgba(0,0,0,0.6)',
            }}
          >
            {/* Animated Face / Emoji */}
            <div className="text-4xl md:text-5xl select-none filter drop-shadow">
              {playerPose === 'miss' ? '⚡' : player.avatarEmoji}
            </div>

            {/* Mic in hand */}
            <div className="absolute bottom-2 left-2 text-xl">
              🎤
            </div>

            {/* Combo indicator above head */}
            {combo > 5 && (
              <div className="absolute -top-6 px-2 py-0.5 rounded-full bg-pink-500 text-white text-[10px] font-black tracking-wider shadow-lg animate-bounce">
                {combo} COMBO!
              </div>
            )}

            {/* Note Direction Indicator Pill */}
            {playerPose !== 'idle' && playerPose !== 'miss' && (
              <div
                className="absolute -top-3 px-2 py-0.5 text-[10px] font-black rounded-md text-slate-950 uppercase"
                style={{ backgroundColor: player.color }}
              >
                {playerPose === 0 ? 'LEFT' : playerPose === 1 ? 'DOWN' : playerPose === 2 ? 'UP' : 'RIGHT'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
