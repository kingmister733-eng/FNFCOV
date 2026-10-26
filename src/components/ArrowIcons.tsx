import React from 'react';
import { NoteDirection } from '../types/fnf';

export const DIRECTION_CONFIG = [
  {
    name: 'Left',
    color: '#c24b99',
    glowColor: 'rgba(194, 75, 153, 0.6)',
    bgGradient: 'from-pink-500 to-purple-600',
    rotation: -90,
    label: 'D',
  },
  {
    name: 'Down',
    color: '#00ffff',
    glowColor: 'rgba(0, 255, 255, 0.6)',
    bgGradient: 'from-cyan-400 to-blue-600',
    rotation: 180,
    label: 'F',
  },
  {
    name: 'Up',
    color: '#12ff00',
    glowColor: 'rgba(18, 255, 0, 0.6)',
    bgGradient: 'from-lime-400 to-emerald-600',
    rotation: 0,
    label: 'J',
  },
  {
    name: 'Right',
    color: '#f9393f',
    glowColor: 'rgba(249, 57, 63, 0.6)',
    bgGradient: 'from-red-500 to-rose-600',
    rotation: 90,
    label: 'K',
  },
];

interface ArrowIconProps {
  direction: NoteDirection;
  isPressed?: boolean;
  isNote?: boolean;
  size?: number;
}

export const ArrowIcon: React.FC<ArrowIconProps> = ({
  direction,
  isPressed = false,
  isNote = false,
  size = 56,
}) => {
  const config = DIRECTION_CONFIG[direction];

  return (
    <div
      style={{
        width: size,
        height: size,
        transform: `rotate(${config.rotation}deg) scale(${isPressed ? 0.9 : 1})`,
        transition: 'transform 0.05s ease-out, filter 0.05s ease-out',
        filter: isPressed
          ? `drop-shadow(0 0 14px ${config.color}) drop-shadow(0 0 24px ${config.color}) brightness(1.3)`
          : isNote
          ? `drop-shadow(0 2px 6px rgba(0,0,0,0.6)) drop-shadow(0 0 8px ${config.color}55)`
          : 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
      }}
      className="flex items-center justify-center select-none"
    >
      <svg
        viewBox="0 0 100 100"
        width="100%"
        height="100%"
        className="overflow-visible"
      >
        <defs>
          <linearGradient id={`arrow-grad-${direction}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={isNote ? "0.9" : "0.3"} />
            <stop offset="40%" stopColor={config.color} />
            <stop offset="100%" stopColor={isNote ? "#111827" : "#0f172a"} stopOpacity={isNote ? "0.85" : "0.6"} />
          </linearGradient>
        </defs>

        {/* FNF Style Pointed Arrow Contour */}
        <polygon
          points="50,10 90,52 68,52 68,88 32,88 32,52 10,52"
          fill={isNote ? `url(#arrow-grad-${direction})` : isPressed ? config.color : 'rgba(30, 41, 59, 0.75)'}
          stroke={isNote ? '#ffffff' : isPressed ? '#ffffff' : config.color}
          strokeWidth={isNote ? 5 : isPressed ? 6 : 4}
          strokeLinejoin="round"
        />

        {/* Inner arrow highlight accent */}
        {isNote && (
          <polygon
            points="50,22 74,48 58,48 58,80 42,80 42,48 26,48"
            fill="#ffffff"
            fillOpacity="0.35"
          />
        )}
      </svg>
    </div>
  );
};
