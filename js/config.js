// Game Configuration: Board Layouts, Tile Bags, Point Multipliers
const GAME_CONFIG = {
  // Words with Friends authentic 15x15 board layout
  WWF_BOARD: [
    ['.',  '.',  '.',  'TW', '.',  '.',  'TL', '.',  'TL', '.',  '.',  'TW', '.',  '.',  '.'],
    ['.',  '.',  'DL', '.',  '.',  'DW', '.',  '.',  '.',  'DW', '.',  '.',  'DL', '.',  '.'],
    ['.',  'DL', '.',  '.',  'DL', '.',  '.',  '.',  '.',  '.',  'DL', '.',  '.',  'DL', '.'],
    ['TW', '.',  '.',  'TL', '.',  '.',  '.',  'DW', '.',  '.',  '.',  'TL', '.',  '.',  'TW'],
    ['.',  '.',  'DL', '.',  '.',  '.',  'DL', '.',  'DL', '.',  '.',  '.',  'DL', '.',  '.'],
    ['.',  'DW', '.',  '.',  '.',  'TL', '.',  '.',  '.',  'TL', '.',  '.',  '.',  'DW', '.'],
    ['TL', '.',  '.',  '.',  'DL', '.',  '.',  '.',  '.',  '.',  'DL', '.',  '.',  '.',  'TL'],
    ['.',  '.',  '.',  'DW', '.',  '.',  '.',  'STAR', '.', '.', '.',  'DW', '.',  '.',  '.'],
    ['TL', '.',  '.',  '.',  'DL', '.',  '.',  '.',  '.',  '.',  'DL', '.',  '.',  '.',  'TL'],
    ['.',  'DW', '.',  '.',  '.',  'TL', '.',  '.',  '.',  'TL', '.',  '.',  '.',  'DW', '.'],
    ['.',  '.',  'DL', '.',  '.',  '.',  'DL', '.',  'DL', '.',  '.',  '.',  'DL', '.',  '.'],
    ['TW', '.',  '.',  'TL', '.',  '.',  '.',  'DW', '.',  '.',  '.',  'TL', '.',  '.',  'TW'],
    ['.',  'DL', '.',  '.',  'DL', '.',  '.',  '.',  '.',  '.',  'DL', '.',  '.',  'DL', '.'],
    ['.',  '.',  'DL', '.',  '.',  'DW', '.',  '.',  '.',  'DW', '.',  '.',  'DL', '.',  '.'],
    ['.',  '.',  '.',  'TW', '.',  '.',  'TL', '.',  'TL', '.',  '.',  'TW', '.',  '.',  '.']
  ],

  // Classic Scrabble 15x15 board layout
  SCRABBLE_BOARD: [
    ['TW', '.',  '.',  'DL', '.',  '.',  '.',  'TW', '.',  '.',  '.',  'DL', '.',  '.',  'TW'],
    ['.',  'DW', '.',  '.',  '.',  'TL', '.',  '.',  '.',  'TL', '.',  '.',  '.',  'DW', '.'],
    ['.',  '.',  'DW', '.',  '.',  '.',  'DL', '.',  'DL', '.',  '.',  '.',  'DW', '.',  '.'],
    ['DL', '.',  '.',  'DW', '.',  '.',  '.',  'DL', '.',  '.',  '.',  'DW', '.',  '.',  'DL'],
    ['.',  '.',  '.',  '.',  'DW', '.',  '.',  '.',  '.',  '.',  'DW', '.',  '.',  '.',  '.'],
    ['.',  'TL', '.',  '.',  '.',  'TL', '.',  '.',  '.',  'TL', '.',  '.',  '.',  'TL', '.'],
    ['.',  '.',  'DL', '.',  '.',  '.',  'DL', '.',  'DL', '.',  '.',  '.',  'DL', '.',  '.'],
    ['TW', '.',  '.',  'DL', '.',  '.',  '.',  'STAR', '.', '.', '.',  'DL', '.',  '.',  'TW'],
    ['.',  '.',  'DL', '.',  '.',  '.',  'DL', '.',  'DL', '.',  '.',  '.',  'DL', '.',  '.'],
    ['.',  'TL', '.',  '.',  '.',  'TL', '.',  '.',  '.',  'TL', '.',  '.',  '.',  'TL', '.'],
    ['.',  '.',  '.',  '.',  'DW', '.',  '.',  '.',  '.',  '.',  'DW', '.',  '.',  '.',  '.'],
    ['DL', '.',  '.',  'DW', '.',  '.',  '.',  'DL', '.',  '.',  '.',  'DW', '.',  '.',  'DL'],
    ['.',  '.',  'DW', '.',  '.',  '.',  'DL', '.',  'DL', '.',  '.',  '.',  'DW', '.',  '.'],
    ['.',  'DW', '.',  '.',  '.',  'TL', '.',  '.',  '.',  'TL', '.',  '.',  '.',  'DW', '.'],
    ['TW', '.',  '.',  'DL', '.',  '.',  '.',  'TW', '.',  '.',  '.',  'DL', '.',  '.',  'TW']
  ],

  // Available board size presets
  BOARD_SIZES: [
    { label: '11×11 (Mini)',    value: 11 },
    { label: '13×13',          value: 13 },
    { label: '15×15 (Standard)', value: 15 },
    { label: '17×17',          value: 17 },
    { label: '20×20',          value: 20 },
    { label: '25×25 (Large)',  value: 25 },
    { label: '50×50 (Mega)',   value: 50 }
  ],

  // Words with Friends tile specifications (104 total)
  WWF_TILES: {
    'A': { count: 9,  points: 1 },
    'B': { count: 2,  points: 4 },
    'C': { count: 2,  points: 4 },
    'D': { count: 5,  points: 2 },
    'E': { count: 13, points: 1 },
    'F': { count: 2,  points: 4 },
    'G': { count: 3,  points: 3 },
    'H': { count: 4,  points: 3 },
    'I': { count: 8,  points: 1 },
    'J': { count: 1,  points: 10 },
    'K': { count: 1,  points: 5 },
    'L': { count: 4,  points: 2 },
    'M': { count: 2,  points: 4 },
    'N': { count: 5,  points: 2 },
    'O': { count: 8,  points: 1 },
    'P': { count: 2,  points: 4 },
    'Q': { count: 1,  points: 10 },
    'R': { count: 6,  points: 1 },
    'S': { count: 5,  points: 1 },
    'T': { count: 7,  points: 1 },
    'U': { count: 4,  points: 2 },
    'V': { count: 2,  points: 5 },
    'W': { count: 2,  points: 4 },
    'X': { count: 1,  points: 8 },
    'Y': { count: 2,  points: 3 },
    'Z': { count: 1,  points: 10 },
    '_': { count: 2,  points: 0 }  // Blank wildcards
  },

  // Classic Scrabble tile specifications (100 total)
  SCRABBLE_TILES: {
    'A': { count: 9,  points: 1 },
    'B': { count: 2,  points: 3 },
    'C': { count: 2,  points: 3 },
    'D': { count: 4,  points: 2 },
    'E': { count: 12, points: 1 },
    'F': { count: 2,  points: 4 },
    'G': { count: 3,  points: 2 },
    'H': { count: 2,  points: 4 },
    'I': { count: 9,  points: 1 },
    'J': { count: 1,  points: 8 },
    'K': { count: 1,  points: 5 },
    'L': { count: 4,  points: 1 },
    'M': { count: 2,  points: 3 },
    'N': { count: 6,  points: 1 },
    'O': { count: 8,  points: 1 },
    'P': { count: 2,  points: 3 },
    'Q': { count: 1,  points: 10 },
    'R': { count: 6,  points: 1 },
    'S': { count: 4,  points: 1 },
    'T': { count: 6,  points: 1 },
    'U': { count: 4,  points: 1 },
    'V': { count: 2,  points: 4 },
    'W': { count: 2,  points: 4 },
    'X': { count: 1,  points: 8 },
    'Y': { count: 2,  points: 4 },
    'Z': { count: 1,  points: 10 },
    '_': { count: 2,  points: 0 }
  },

  BINGO_BONUS_WWF: 35,       // WWF awards +35 for using all 7 tiles
  BINGO_BONUS_SCRABBLE: 50,  // Scrabble awards +50
  RACK_SIZE: 7,
  MAX_PLAYERS: 10,
  MIN_PLAYERS: 1
};

/**
 * Generate a premium-square board layout for any board size N×N.
 * Scales the standard 15×15 WWF-style pattern proportionally.
 * Always odd sizes get a center star; even sizes get it at (N/2, N/2).
 */
GAME_CONFIG.generateBoardLayout = function(N) {
  const layout = Array(N).fill(null).map(() => Array(N).fill('.'));
  const center = Math.floor(N / 2);

  // Place center star
  layout[center][center] = 'STAR';

  if (N < 5) return layout; // Too small for premium squares

  // Scale factor relative to canonical 15×15 half-board (7 units from center)
  // We use fractional positions and round to get evenly spread premiums
  const half = N / 2;

  // Helper: place a premium symmetrically (4-fold) from center offsets
  function place(dr, dc, type) {
    const positions = [
      [center + dr, center + dc],
      [center - dr, center + dc],
      [center + dr, center - dc],
      [center - dr, center - dc]
    ];
    for (const [r, c] of positions) {
      if (r >= 0 && r < N && c >= 0 && c < N && !(r === center && c === center)) {
        layout[r][c] = type;
      }
    }
  }

  // --- Triple Word (TW) — corners and mid-edges ---
  // Corners
  layout[0][0] = 'TW';
  layout[0][N-1] = 'TW';
  layout[N-1][0] = 'TW';
  layout[N-1][N-1] = 'TW';
  // Mid-edge TW (halfway between corner and center on each edge)
  const twMid = Math.round(half / 2);
  place(Math.round(-half + twMid), 0, 'TW');
  place(0, Math.round(-half + twMid), 'TW');

  // --- Double Word (DW) — diagonal from center ---
  const dwDist = Math.max(1, Math.round(half * 0.27));
  for (let d = 1; d <= Math.round(half * 0.6); d += dwDist) {
    place(-d, -d, 'DW');
  }

  // --- Triple Letter (TL) ---
  const tlR = Math.round(half * 0.40);
  const tlC = Math.round(half * 0.73);
  place(-tlR, -tlC, 'TL');
  place(-tlC, -tlR, 'TL');

  // --- Double Letter (DL) ---
  const dlR1 = Math.round(half * 0.20);
  const dlC1 = Math.round(half * 0.53);
  place(-dlR1, -dlC1, 'DL');
  place(-dlC1, -dlR1, 'DL');

  // Also DL on diagonal near TL
  const dlR2 = Math.round(half * 0.47);
  const dlC2 = Math.round(half * 0.27);
  if (dlR2 !== dlC2) {
    place(-dlR2, -dlC2, 'DL');
  }

  // Edge DL (near midpoints of edges)
  const dlEdge = Math.round(half * 0.20);
  place(0, -Math.round(half * 0.87), 'DL');
  place(-Math.round(half * 0.87), 0, 'DL');

  return layout;
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GAME_CONFIG;
}
