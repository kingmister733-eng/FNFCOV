import React from 'react';
import { GameSettings } from '../types/fnf';
import { X, Settings as SettingsIcon, Volume2, Gamepad2, Sliders, Check } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: GameSettings;
  onUpdateSettings: (newSettings: GameSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  if (!isOpen) return null;

  const keyPresets = [
    { name: 'DFJK (Standard)', keys: { left: 'd', down: 'f', up: 'j', right: 'k' }, labels: ['D', 'F', 'J', 'K'] },
    { name: 'WASD', keys: { left: 'a', down: 's', up: 'w', right: 'd' }, labels: ['A', 'S', 'W', 'D'] },
    { name: 'Arrow Keys', keys: { left: 'ArrowLeft', down: 'ArrowDown', up: 'ArrowUp', right: 'ArrowRight' }, labels: ['←', '↓', '↑', '→'] },
    { name: 'ASKL', keys: { left: 'a', down: 's', up: 'k', right: 'l' }, labels: ['A', 'S', 'K', 'L'] },
  ];

  const handleSelectPreset = (keys: typeof settings.keybinds) => {
    onUpdateSettings({
      ...settings,
      keybinds: keys,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-xl bg-slate-900 border-2 border-slate-700 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/40">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black font-bungee tracking-wide text-white">GAME SETTINGS</h2>
              <p className="text-xs text-slate-400">Customize controls, audio balance, and scroll options</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Settings Body */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
          {/* Gameplay Options */}
          <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Gamepad2 className="w-4 h-4 text-pink-400" />
              Gameplay Toggles
            </h3>

            {/* Downscroll Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-sm text-white">Downscroll</div>
                <div className="text-xs text-slate-400">Notes fall downwards to bottom receptors</div>
              </div>
              <button
                onClick={() => onUpdateSettings({ ...settings, downscroll: !settings.downscroll })}
                className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 ${
                  settings.downscroll ? 'bg-pink-600' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    settings.downscroll ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Botplay Toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
              <div>
                <div className="font-bold text-sm text-white">Botplay (Auto Play)</div>
                <div className="text-xs text-slate-400">CPU auto-hits all player notes to watch/listen to covers</div>
              </div>
              <button
                onClick={() => onUpdateSettings({ ...settings, botplay: !settings.botplay })}
                className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 ${
                  settings.botplay ? 'bg-cyan-500' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    settings.botplay ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Keybinds */}
          <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              Keybind Preset
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {keyPresets.map((preset) => {
                const isSelected =
                  settings.keybinds.left === preset.keys.left && settings.keybinds.down === preset.keys.down;

                return (
                  <button
                    key={preset.name}
                    onClick={() => handleSelectPreset(preset.keys)}
                    className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                      isSelected
                        ? 'bg-cyan-500/20 border-cyan-500 text-white'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-xs">{preset.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {preset.labels.join(' · ')}
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-cyan-400" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Audio Volume Sliders */}
          <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-amber-400" />
              Audio Volumes
            </h3>

            {/* Master Volume */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">Master Volume</span>
                <span className="font-mono text-amber-400">{Math.round(settings.masterVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.masterVolume}
                onChange={(e) => onUpdateSettings({ ...settings, masterVolume: parseFloat(e.target.value) })}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            {/* Instrumental */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">Instrumental Backing Track</span>
                <span className="font-mono text-pink-400">{Math.round(settings.instVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.instVolume}
                onChange={(e) => onUpdateSettings({ ...settings, instVolume: parseFloat(e.target.value) })}
                className="w-full accent-pink-500 cursor-pointer"
              />
            </div>

            {/* Character Vocals */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">Character Chromatic Voices</span>
                <span className="font-mono text-cyan-400">{Math.round(settings.voicesVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.voicesVolume}
                onChange={(e) => onUpdateSettings({ ...settings, voicesVolume: parseFloat(e.target.value) })}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-slate-800 bg-slate-950/80">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-sm transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
