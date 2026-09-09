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
  MAX_PLAYERS: 5,
  MIN_PLAYERS: 1
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GAME_CONFIG;
}
