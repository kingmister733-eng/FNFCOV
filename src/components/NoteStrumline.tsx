import React from 'react';
import { Note, NoteDirection, HitRating } from '../types/fnf';
import { ArrowIcon, DIRECTION_CONFIG } from './ArrowIcons';

interface NoteStrumlineProps {
  notes: Note[];
  songTime: number; // current playback time in ms
  scrollSpeed: number;
  downscroll: boolean;
  activePlayerInputs: boolean[]; // [Left, Down, Up, Right]
  activeOpponentInputs: boolean[]; // [Left, Down, Up, Right]
  lastRating: {
    rating: HitRating;
    combo: number;
    key: number;
  } | null;
  splashNotes: {
    direction: NoteDirection;
    id: number;
  }[];
  keybindLabels: string[];
}

export const NoteStrumline: React.FC<NoteStrumlineProps> = ({
  notes,
  songTime,
  scrollSpeed,
  downscroll,
  activePlayerInputs,
  activeOpponentInputs,
  lastRating,
  splashNotes,
  keybindLabels,
}) => {
  // Screen note track height in pixels
  const TRACK_HEIGHT = 440;
  // Receptor position from edge (top if upscroll, bottom if downscroll)
  const RECEPTOR_OFFSET = 55;

  // Time window in ms visible on screen based on scroll speed
  // Default speed 2.0 corresponds to ~1200ms preview
  const timeWindowMs = Math.round(1800 / scrollSpeed);

  // Filter notes that are within the visible window
  const visibleNotes = notes.filter((n) => {
    if (n.hit && !n.length) return false;
    const diff = n.time - songTime;
    return diff > -200 && diff < timeWindowMs;
  });

  // Calculate note vertical pixel position
  const getNoteY = (noteTime: number) => {
    const diff = noteTime - songTime;
    const pxOffset = (diff / timeWindowMs) * (TRACK_HEIGHT - RECEPTOR_OFFSET);

    if (downscroll) {
      // Notes come from top and move DOWN to bottom receptor
      return TRACK_HEIGHT - RECEPTOR_OFFSET - pxOffset;
    } else {
      // Notes come from bottom and move UP to top receptor
      return RECEPTOR_OFFSET + pxOffset;
    }
  };

  const getRatingColor = (rating: HitRating) => {
    switch (rating) {
      case 'sick':
        return 'text-cyan-400 drop-shadow-[0_0_12px_rgba(34,211,238,0.8)]';
      case 'good':
        return 'text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.8)]';
      case 'bad':
        return 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]';
      case 'shit':
        return 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]';
      case 'miss':
        return 'text-rose-600 drop-shadow-[0_0_8px_rgba(225,29,72,0.8)]';
    }
  };

  return (
    <div
      className="relative w-full max-w-4xl mx-auto overflow-hidden select-none"
      style={{ height: TRACK_HEIGHT }}
    >
      {/* Visual lane dividers & faint backdrop */}
      <div className="absolute inset-0 bg-slate-950/40 rounded-2xl border border-slate-800/60 backdrop-blur-xs flex justify-between px-3 md:px-8 pointer-events-none" />

      {/* Opponent & Player Track Split */}
      <div className="relative w-full h-full flex justify-between px-3 md:px-8">
        {/* ================= OPPONENT STRUM LINE (LEFT) ================= */}
        <div className="relative w-52 md:w-68 h-full flex justify-between opacity-80">
          {[0, 1, 2, 3].map((dir) => {
            const isPressed = activeOpponentInputs[dir];
            return (
              <div
                key={`opp-col-${dir}`}
                className="relative flex flex-col items-center w-12 md:w-14"
              >
                {/* Receptor Target */}
                <div
                  className="absolute z-20"
                  style={{
                    [downscroll ? 'bottom' : 'top']: `${RECEPTOR_OFFSET}px`,
                  }}
                >
                  <ArrowIcon
                    direction={dir as NoteDirection}
                    isPressed={isPressed}
                    size={48}
                  />
                </div>
              </div>
            );
          })}

          {/* Opponent Falling Notes */}
          {visibleNotes
            .filter((n) => !n.isPlayer)
            .map((note) => {
              const y = getNoteY(note.time);
              const colWidth = 56; // approximate column spacing
              return (
                <div
                  key={note.id}
                  className="absolute z-30 transition-transform pointer-events-none"
                  style={{
                    top: `${y}px`,
                    left: `${note.direction * (colWidth + 4)}px`,
                  }}
                >
                  <ArrowIcon
                    direction={note.direction}
                    isNote={true}
                    size={46}
                  />
                </div>
              );
            })}
        </div>

        {/* Center Rating & Combo Splash */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50 flex flex-col items-center">
          {lastRating && (
            <div
              key={lastRating.key}
              className="flex flex-col items-center animate-rating"
            >
              <div
                className={`text-3xl md:text-5xl font-black italic tracking-wider font-bungee ${getRatingColor(
                  lastRating.rating
                )}`}
              >
                {lastRating.rating.toUpperCase()}!
              </div>

              {lastRating.combo > 1 && (
                <div className="text-xl md:text-2xl font-black text-white tracking-widest font-pixel drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                  {lastRating.combo}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ================= PLAYER STRUM LINE (RIGHT) ================= */}
        <div className="relative w-52 md:w-68 h-full flex justify-between">
          {[0, 1, 2, 3].map((dir) => {
            const isPressed = activePlayerInputs[dir];
            return (
              <div
                key={`ply-col-${dir}`}
                className="relative flex flex-col items-center w-12 md:w-14"
              >
                {/* Receptor Target */}
                <div
                  className="absolute z-20 flex flex-col items-center"
                  style={{
                    [downscroll ? 'bottom' : 'top']: `${RECEPTOR_OFFSET}px`,
                  }}
                >
                  <ArrowIcon
                    direction={dir as NoteDirection}
                    isPressed={isPressed}
                    size={52}
                  />

                  {/* Keybind Hint Pill */}
                  <div
                    className={`mt-1 text-[10px] font-bold px-1.5 py-0.2 rounded font-mono border transition-colors ${
                      isPressed
                        ? 'bg-white text-slate-950 border-white'
                        : 'bg-slate-900/80 text-slate-400 border-slate-700'
                    }`}
                  >
                    {keybindLabels[dir]}
                  </div>
                </div>

                {/* Splash Burst particles on Sick hit */}
                {splashNotes
                  .filter((s) => s.direction === dir)
                  .map((s) => (
                    <div
                      key={s.id}
                      className="absolute z-40 pointer-events-none animate-splash"
                      style={{
                        [downscroll ? 'bottom' : 'top']: `${RECEPTOR_OFFSET - 8}px`,
                      }}
                    >
                      <div
                        className="w-16 h-16 rounded-full blur-xs border-2"
                        style={{
                          borderColor: DIRECTION_CONFIG[dir].color,
                          backgroundColor: `${DIRECTION_CONFIG[dir].color}33`,
                        }}
                      />
                    </div>
                  ))}
              </div>
            );
          })}

          {/* Player Falling Notes */}
          {visibleNotes
            .filter((n) => n.isPlayer && !n.hit)
            .map((note) => {
              const y = getNoteY(note.time);
              const colWidth = 56;
              return (
                <div
                  key={note.id}
                  className="absolute z-30 transition-transform pointer-events-none"
                  style={{
                    top: `${y}px`,
                    left: `${note.direction * (colWidth + 4)}px`,
                  }}
                >
                  <ArrowIcon
                    direction={note.direction}
                    isNote={true}
                    size={50}
                  />
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};
