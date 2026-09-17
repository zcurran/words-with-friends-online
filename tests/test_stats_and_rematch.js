// Test Stats Tracking and Rematch Functionality
const assert = require('assert');

// Mock browser globals for testing game.js in Node
global.GAME_CONFIG = {
  WWF_TILES: {
    'A': { count: 9, points: 1 }, 'B': { count: 2, points: 4 }, 'C': { count: 2, points: 4 },
    'D': { count: 5, points: 2 }, 'E': { count: 13, points: 1 }, 'T': { count: 7, points: 1 },
    'Q': { count: 1, points: 10 }, 'U': { count: 4, points: 2 }, 'Z': { count: 1, points: 10 }
  },
  SCRABBLE_TILES: {},
  RACK_SIZE: 7
};

global.AUDIO = {
  playScoreFanfare: () => {},
  playShuffle: () => {},
  playBuzz: () => {}
};

global.DICTIONARY = {
  isValid: () => true,
  hasPrefix: () => true
};

global.RulesEngine = class {
  validateMove(board, newTiles, mode, boardSize) {
    return {
      valid: true,
      totalScore: 42,
      isBingo: newTiles.length === 7,
      wordsFormed: [{ word: 'QUIZ', points: 42 }]
    };
  }
};

global.NetworkManager = class {
  constructor(game) {
    this.game = game;
    this.socket = null;
    this.playerId = 'p1';
  }
  sendAction() {}
  requestRematch() {}
};

// Load ScrabbleGame
const fs = require('fs');
const path = require('path');
const gameCode = fs.readFileSync(path.join(__dirname, '../js/game.js'), 'utf8');
global.ScrabbleGame = (0, eval)(gameCode + '; ScrabbleGame');

console.log('Testing ScrabbleGame Stats & Rematch...');

const game = new ScrabbleGame();
game.startNewGame({
  playerConfigs: [
    { name: 'Alice', isBot: false },
    { name: 'Bob', isBot: false }
  ],
  mode: 'WWF',
  boardSize: 15
});

assert.strictEqual(game.players.length, 2, 'Should have 2 players');
assert.strictEqual(game.currentTurnIndex, 0, 'Alice starts first game');
assert.ok(game.stats, 'Stats should be initialized');
assert.strictEqual(game.stats.totalWords, 0, 'Total words starts at 0');

// Record a simulated move for Alice
const p1 = game.players[0];
game.recordMoveStats(p1, [{ word: 'QUIZ', points: 42 }], 42, false, 4);

assert.strictEqual(game.stats.totalWords, 1, 'Total words should be 1');
assert.strictEqual(game.stats.bestWord.word, 'QUIZ', 'Best word should be QUIZ');
assert.strictEqual(game.stats.bestWord.points, 42, 'Best word points should be 42');
assert.strictEqual(game.stats.bestWord.playerName, 'Alice', 'Best word player should be Alice');
assert.strictEqual(game.stats.longestWord.word, 'QUIZ', 'Longest word should be QUIZ');

// Record a move for Bob with a longer word
const p2 = game.players[1];
game.recordMoveStats(p2, [{ word: 'WEATHER', points: 28 }], 28, true, 7);

assert.strictEqual(game.stats.totalWords, 2, 'Total words should be 2');
assert.strictEqual(game.stats.bestWord.word, 'QUIZ', 'Best word still QUIZ (42 > 28)');
assert.strictEqual(game.stats.longestWord.word, 'WEATHER', 'Longest word should now be WEATHER (7 > 4)');
assert.strictEqual(game.stats.totalBingos, 1, 'Total bingos should be 1');

// Test Serialization
const serialized = game.serializeState();
assert.ok(serialized.stats, 'Serialized state should include stats');
assert.strictEqual(serialized.stats.bestWord.word, 'QUIZ');

// Test Local Rematch
console.log('Testing local rematch()...');
game.rematch();

assert.strictEqual(game.players.length, 2, 'Rematch keeps 2 players');
assert.strictEqual(game.players[0].name, 'Alice');
assert.strictEqual(game.players[1].name, 'Bob');
assert.strictEqual(game.players[0].score, 0, 'Scores reset to 0');
assert.strictEqual(game.players[1].score, 0, 'Scores reset to 0');
assert.strictEqual(game.currentTurnIndex, 1, 'Turn rotated: Bob starts rematch game');
assert.strictEqual(game.stats.totalWords, 0, 'Stats reset for fresh rematch');
assert.strictEqual(game.stats.bestWord, null, 'Best word reset for fresh rematch');

console.log('All stats and rematch tests passed successfully! ✅');
