import React, { useState } from 'react';
import { SongData, Note, NoteDirection, CharacterId } from '../types/fnf';
import { CHARACTERS } from '../data/characters';
import { DIRECTION_CONFIG, ArrowIcon } from './ArrowIcons';
import { soundEngine } from '../audio/soundEngine';
import { X, Play, Plus, Trash2, Volume2, Save, FileText } from 'lucide-react';

interface ChartEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  song: SongData;
  playerCharId: CharacterId;
  opponentCharId: CharacterId;
  onSaveChart: (updatedNotes: Note[]) => void;
}

export const ChartEditorModal: React.FC<ChartEditorModalProps> = ({
  isOpen,
  onClose,
  song,
  playerCharId,
  opponentCharId,
  onSaveChart,
}) => {
  const [notes, setNotes] = useState<Note[]>(song.notes);
  const [selectedBar, setSelectedBar] = useState<number>(0);
  const [selectedTrack, setSelectedTrack] = useState<'player' | 'opponent'>('player');

  if (!isOpen) return null;

  const beatMs = (60 / song.bpm) * 1000;
  const barMs = beatMs * 4;
  const totalBars = Math.ceil(song.durationMs / barMs);

  const currentBarStart = selectedBar * barMs;
  const currentBarEnd = currentBarStart + barMs;

  // Notes in current bar
  const barNotes = notes.filter((n) => n.time >= currentBarStart && n.time < currentBarEnd);

  // 16 steps in a 4/4 bar (16th notes)
  const steps = Array.from({ length: 16 }, (_, i) => i);
  const stepMs = beatMs / 4;

  const handleToggleNote = (stepIndex: number, direction: NoteDirection, isPlayer: boolean) => {
    const time = Math.round(currentBarStart + stepIndex * stepMs);
    const existingIndex = notes.findIndex(
      (n) => n.isPlayer === isPlayer && n.direction === direction && Math.abs(n.time - time) < stepMs / 2
    );

    if (existingIndex >= 0) {
      // Remove note
      setNotes(notes.filter((_, idx) => idx !== existingIndex));
    } else {
      // Add note and play sound
      const newNote: Note = {
        id: `custom-note-${Date.now()}-${Math.random()}`,
        time,
        direction,
        isPlayer,
        length: 0,
      };
      setNotes([...notes, newNote].sort((a, b) => a.time - b.time));

      // Audition note sound
      const charId = isPlayer ? playerCharId : opponentCharId;
      soundEngine.playCharacterVoice(charId, direction, 0, 160);
    }
  };

  const handleSave = () => {
    onSaveChart(notes);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border-2 border-slate-700 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black font-bungee tracking-wide text-white">
                CHART EDITOR & STEP SEQUENCER
              </h2>
              <p className="text-xs text-slate-400">
                Track: <span className="text-pink-400 font-bold">{song.name}</span> ({song.bpm} BPM) • Total Notes:{' '}
                {notes.length}
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

        {/* Bar Selector & Track Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3 border-b border-slate-800 bg-slate-950/40">
          {/* Bar navigation */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase">Measure / Bar:</span>
            <select
              value={selectedBar}
              onChange={(e) => setSelectedBar(parseInt(e.target.value, 10))}
              className="bg-slate-800 text-white font-mono text-sm px-3 py-1.5 rounded-lg border border-slate-700 focus:outline-none"
            >
              {Array.from({ length: totalBars }, (_, i) => (
                <option key={i} value={i}>
                  Bar {i + 1} / {totalBars} ({(i * 4).toFixed(0)} Beats)
                </option>
              ))}
            </select>
          </div>

          {/* Track Filter */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedTrack('opponent')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                selectedTrack === 'opponent'
                  ? 'bg-purple-600 text-white shadow'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Opponent ({CHARACTERS[opponentCharId].name})
            </button>
            <button
              onClick={() => setSelectedTrack('player')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                selectedTrack === 'player'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Player ({CHARACTERS[playerCharId].name})
            </button>
          </div>
        </div>

        {/* Step Sequencer Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="text-xs text-slate-400 mb-3 flex items-center justify-between">
            <span>Click any step cell to toggle an arrow note. Click an existing note to delete it.</span>
            <span className="font-mono text-pink-400 font-bold">16th Note Grid (4 Beats)</span>
          </div>

          <div className="bg-slate-950 rounded-2xl border border-slate-800 p-4">
            {/* Column Headers */}
            <div className="grid grid-cols-5 gap-2 mb-2 pb-2 border-b border-slate-800 text-xs font-bold text-slate-400 text-center">
              <div>Step / Beat</div>
              <div className="text-pink-400">Left (⬅️)</div>
              <div className="text-cyan-400">Down (⬇️)</div>
              <div className="text-emerald-400">Up (⬆️)</div>
              <div className="text-rose-400">Right (➡️)</div>
            </div>

            {/* Steps rows */}
            <div className="space-y-1">
              {steps.map((step) => {
                const isDownbeat = step % 4 === 0;
                const isPlayer = selectedTrack === 'player';

                return (
                  <div
                    key={`step-row-${step}`}
                    className={`grid grid-cols-5 gap-2 items-center p-1 rounded-lg ${
                      isDownbeat ? 'bg-slate-900/90 border border-slate-800' : 'bg-slate-900/30'
                    }`}
                  >
                    <div className="text-xs font-mono text-center text-slate-500">
                      Beat {Math.floor(step / 4) + 1}.{(step % 4) + 1}
                    </div>

                    {[0, 1, 2, 3].map((dir) => {
                      const hasNote = barNotes.some(
                        (n) =>
                          n.isPlayer === isPlayer &&
                          n.direction === dir &&
                          Math.abs(n.time - (currentBarStart + step * stepMs)) < stepMs / 2
                      );

                      return (
                        <button
                          key={`step-${step}-dir-${dir}`}
                          onClick={() => handleToggleNote(step, dir as NoteDirection, isPlayer)}
                          className={`h-9 rounded-lg flex items-center justify-center transition-all ${
                            hasNote
                              ? 'scale-95 shadow-md brightness-110'
                              : 'hover:bg-slate-800/80 border border-slate-800/60'
                          }`}
                          style={{
                            backgroundColor: hasNote ? DIRECTION_CONFIG[dir].color : 'transparent',
                          }}
                        >
                          {hasNote ? (
                            <ArrowIcon direction={dir as NoteDirection} isNote={true} size={28} />
                          ) : (
                            <span className="text-[10px] text-slate-700 opacity-40">·</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/80">
          <div className="text-xs text-slate-400">
            Current Bar Notes: <span className="text-white font-bold">{barNotes.length}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl hover:bg-slate-800 text-slate-300 text-sm font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-sm shadow-lg transition-colors"
            >
              <Save className="w-4 h-4" />
              Save Chart Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
