import { SongData, Note, NoteDirection } from '../types/fnf';

// Helper to generate rhythmic call-and-response note charts for FNF songs
function generateSongNotes(
  bpm: number,
  barsCount: number = 16,
  complexity: 'simple' | 'medium' | 'hard' = 'medium'
): Note[] {
  const notes: Note[] = [];
  const beatMs = (60 / bpm) * 1000;
  const stepMs = beatMs / 4; // 16th note

  let idCounter = 1;

  for (let bar = 0; bar < barsCount; bar++) {
    const barStartMs = bar * (beatMs * 4);

    // Call and response logic:
    // Bar 0, 1: Opponent
    // Bar 2, 3: Player
    // Bar 4, 5: Opponent
    // Bar 6, 7: Player
    // Bar 8-11: Alternating 2-beat trade-offs
    // Bar 12-15: Duet / Climax
    let isOpponentSinging = true;
    let isPlayerSinging = false;

    if (bar % 4 === 2 || bar % 4 === 3) {
      isOpponentSinging = false;
      isPlayerSinging = true;
    } else if (bar >= 12) {
      // Climax duet!
      isOpponentSinging = true;
      isPlayerSinging = true;
    }

    // Melodic patterns for steps (0 to 15)
    // Left: 0, Down: 1, Up: 2, Right: 3
    const patterns = [
      // Standard funkin bounce
      [
        { step: 0, dir: 0 },
        { step: 2, dir: 1 },
        { step: 4, dir: 2 },
        { step: 6, dir: 3 },
        { step: 8, dir: 1 },
        { step: 10, dir: 2 },
        { step: 12, dir: 0 },
        { step: 14, dir: 3 },
      ],
      // Rapid stair climb
      [
        { step: 0, dir: 0 },
        { step: 3, dir: 1 },
        { step: 4, dir: 2 },
        { step: 7, dir: 3 },
        { step: 8, dir: 2 },
        { step: 10, dir: 1 },
        { step: 12, dir: 0 },
      ],
      // Syncopated funkin roll
      [
        { step: 0, dir: 2 },
        { step: 2, dir: 0 },
        { step: 4, dir: 1 },
        { step: 7, dir: 3 },
        { step: 8, dir: 3 },
        { step: 11, dir: 2 },
        { step: 12, dir: 1 },
        { step: 14, dir: 0 },
      ],
      // Triplet & anchor
      [
        { step: 0, dir: 1 },
        { step: 2, dir: 2 },
        { step: 4, dir: 3 },
        { step: 6, dir: 1 },
        { step: 8, dir: 0 },
        { step: 9, dir: 1 },
        { step: 10, dir: 2 },
        { step: 12, dir: 3 },
      ],
    ];

    const pattern = patterns[bar % patterns.length];

    pattern.forEach((p) => {
      if (complexity === 'simple' && p.step % 4 !== 0 && p.step % 4 !== 2) return;

      const noteTime = Math.round(barStartMs + p.step * stepMs);

      if (isOpponentSinging) {
        notes.push({
          id: `note-opp-${idCounter++}`,
          time: noteTime,
          direction: p.dir as NoteDirection,
          isPlayer: false,
          length: p.step % 8 === 0 ? Math.round(stepMs * 1.5) : 0,
        });
      }

      if (isPlayerSinging) {
        // Player responds either with matching or complimentary notes
        const playerDir = (p.dir + (bar >= 12 ? 2 : 0)) % 4;
        notes.push({
          id: `note-ply-${idCounter++}`,
          time: isOpponentSinging && bar < 12 ? noteTime + Math.round(stepMs * 2) : noteTime,
          direction: playerDir as NoteDirection,
          isPlayer: true,
          length: p.step % 8 === 4 ? Math.round(stepMs * 1.5) : 0,
        });
      }
    });
  }

  // Sort chronologically
  return notes.sort((a, b) => a.time - b.time);
}

export const SONGS: SongData[] = [
  {
    id: 'bopeebo',
    name: 'Bopeebo',
    composer: 'Kawai Sprite',
    bpm: 100,
    defaultSpeed: 1.6,
    defaultPlayer: 'bf',
    defaultOpponent: 'dad',
    difficulty: 'Easy',
    genre: 'Funkin Tutorial',
    durationMs: 38400, // 16 bars @ 100 BPM
    notes: generateSongNotes(100, 16, 'simple'),
  },
  {
    id: 'dadbattle',
    name: 'Dadbattle',
    composer: 'Kawai Sprite',
    bpm: 180,
    defaultSpeed: 2.2,
    defaultPlayer: 'bf',
    defaultOpponent: 'dad',
    difficulty: 'Hard',
    genre: 'Classic Showdown',
    durationMs: 42600, // 32 bars @ 180 BPM
    notes: generateSongNotes(180, 24, 'medium'),
  },
  {
    id: 'blammed',
    name: 'Blammed',
    composer: 'Kawai Sprite',
    bpm: 165,
    defaultSpeed: 2.4,
    defaultPlayer: 'bf',
    defaultOpponent: 'pico',
    difficulty: 'Hard',
    genre: 'Subway Rap',
    durationMs: 46500,
    notes: generateSongNotes(165, 24, 'hard'),
  },
  {
    id: 'spookeez',
    name: 'Spookeez',
    composer: 'Kawai Sprite',
    bpm: 150,
    defaultSpeed: 2.0,
    defaultPlayer: 'bf',
    defaultOpponent: 'spooky',
    difficulty: 'Normal',
    genre: 'Haunted Chiptune',
    durationMs: 44800,
    notes: generateSongNotes(150, 20, 'medium'),
  },
  {
    id: 'ballistic',
    name: 'Ballistic (Remix)',
    composer: 'Sock.clip',
    bpm: 200,
    defaultSpeed: 2.8,
    defaultPlayer: 'bf',
    defaultOpponent: 'whitty',
    difficulty: 'Erect',
    genre: 'Intense Speed Metal',
    durationMs: 48000,
    notes: generateSongNotes(200, 28, 'hard'),
  },
  {
    id: 'megalovania',
    name: 'Megalovania Cover',
    composer: 'Toby Fox / FNF Community',
    bpm: 125,
    defaultSpeed: 2.1,
    defaultPlayer: 'bf',
    defaultOpponent: 'sans',
    difficulty: 'Hard',
    genre: 'Bad Time Funk',
    durationMs: 46000,
    notes: generateSongNotes(125, 20, 'hard'),
  },
];
