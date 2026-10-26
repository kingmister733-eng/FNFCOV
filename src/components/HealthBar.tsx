import React from 'react';
import { CharacterId } from '../types/fnf';
import { CHARACTERS } from '../data/characters';

interface HealthBarProps {
  health: number; // 0 to 100 (50 is neutral)
  playerCharId: CharacterId;
  opponentCharId: CharacterId;
  score: number;
  misses: number;
  accuracy: number;
  isBeatEven: boolean;
}

export const HealthBar: React.FC<HealthBarProps> = ({
  health,
  playerCharId,
  opponentCharId,
  score,
  misses,
  accuracy,
  isBeatEven,
}) => {
  const player = CHARACTERS[playerCharId];
  const opponent = CHARACTERS[opponentCharId];

  // In FNF, bar goes from left (Opponent) to right (Player)
  // 100% health = Player has pushed opponent all the way left
  // 0% health = Opponent has pushed player all the way right
  // Health is clamped 0 to 100
  const clampedHealth = Math.max(0, Math.min(100, health));
  const playerHealthPct = clampedHealth;
  const oppHealthPct = 100 - clampedHealth;

  const isPlayerLosing = clampedHealth < 20;
  const isOpponentLosing = clampedHealth > 80;

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center select-none">
      {/* Stats Line */}
      <div className="flex items-center justify-between w-full text-xs font-mono tracking-widest text-slate-300 font-pixel mb-2 px-2">
        <span className="text-pink-400">SCORE: {score.toLocaleString()}</span>
        <span className="text-amber-300">MISSES: {misses}</span>
        <span className="text-cyan-300">ACC: {accuracy.toFixed(1)}%</span>
      </div>

      {/* Main Health Bar Track */}
      <div className="relative w-full h-5 md:h-6 bg-black rounded-sm border-2 border-slate-900 shadow-xl overflow-visible flex items-center">
        {/* Opponent Health Slice (Left) */}
        <div
          className="h-full transition-all duration-75 ease-out"
          style={{
            width: `${oppHealthPct}%`,
            backgroundColor: opponent.healthColor,
          }}
        />

        {/* Player Health Slice (Right) */}
        <div
          className="h-full transition-all duration-75 ease-out"
          style={{
            width: `${playerHealthPct}%`,
            backgroundColor: player.healthColor,
          }}
        />

        {/* Tug-of-war Center Icons Head Anchor */}
        <div
          className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center transition-all duration-75 ease-out pointer-events-none"
          style={{
            left: `${oppHealthPct}%`,
            transform: `translate(-50%, -50%) scale(${isBeatEven ? 1.15 : 1})`,
          }}
        >
          {/* Opponent Icon */}
          <div
            className={`w-9 h-9 md:w-11 md:h-11 rounded-full border-2 border-black flex items-center justify-center text-xl md:text-2xl shadow-lg -mr-2 z-10 transition-transform ${
              isOpponentLosing ? 'rotate-12 grayscale-[0.6]' : ''
            }`}
            style={{
              backgroundColor: opponent.healthColor,
            }}
          >
            {isOpponentLosing ? '😵' : opponent.avatarEmoji}
          </div>

          {/* Player Icon */}
          <div
            className={`w-9 h-9 md:w-11 md:h-11 rounded-full border-2 border-black flex items-center justify-center text-xl md:text-2xl shadow-lg -ml-2 z-20 transition-transform ${
              isPlayerLosing ? '-rotate-12 grayscale-[0.6]' : ''
            }`}
            style={{
              backgroundColor: player.healthColor,
            }}
          >
            {isPlayerLosing ? '💥' : player.avatarEmoji}
          </div>
        </div>
      </div>
    </div>
  );
};
