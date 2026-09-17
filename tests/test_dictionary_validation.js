const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- Testing Dictionary & Word Validation ---');

// 1. Test data/enable1.txt file integrity
const enable1Path = path.join(__dirname, '../data/enable1.txt');
assert(fs.existsSync(enable1Path), 'data/enable1.txt must exist');
const enable1Words = fs.readFileSync(enable1Path, 'utf8')
  .split(/\r?\n/)
  .map(w => w.trim().toUpperCase())
  .filter(Boolean);

console.log(`Loaded ${enable1Words.length} words from enable1.txt`);
assert(enable1Words.length >= 172000, 'Dictionary should contain at least 172,000 words');
const dictSet = new Set(enable1Words);

// 2. Test authentic words are present
const validWords = ['CAT', 'DOG', 'QUIZ', 'ZYZZYVA', 'SCRABBLE', 'FRIEND', 'PLAY', 'BOARD', 'QI', 'ZA', 'OK', 'EW'];
for (const word of validWords) {
  assert(dictSet.has(word), `Expected valid word "${word}" to be in dictionary`);
}
console.log('✓ Valid test words are properly recognized');

// 3. Test bogus / non-words are rejected
const invalidWords = [
  'ABC', 'XYZ', 'SOLARIS', 'SENA', 'BB', 'BX', 'BZ', 'AAA', 'ADJ', 'ABBR', 'ABCISSA', 'THX', 'ASDF'
];
for (const word of invalidWords) {
  assert(!dictSet.has(word), `Expected non-word "${word}" to be REJECTED by dictionary`);
}
console.log('✓ Non-words / bogus words are strictly rejected');

// 4. Test 2-letter words are exactly the 107 authentic Scrabble/WWF words
const twoLetterWords = enable1Words.filter(w => w.length === 2);
assert.strictEqual(twoLetterWords.length, 107, `Expected exactly 107 authentic two-letter words, found ${twoLetterWords.length}`);
console.log(`✓ Exactly 107 authentic two-letter words present`);

// 5. Test GameDictionary in js/dictionary.js
const { GameDictionary } = require('../js/dictionary.js');
const dict = new GameDictionary();
// Insert loaded words
for (const w of enable1Words) {
  dict.insert(w);
}

for (const w of validWords) {
  assert(dict.isValid(w), `GameDictionary should validate "${w}"`);
}
for (const w of invalidWords) {
  assert(!dict.isValid(w), `GameDictionary should reject "${w}"`);
}
console.log('✓ GameDictionary class correctly validates authentic words and rejects non-words');

// 6. Test RulesEngine move validation with valid and invalid words
const GAME_CONFIG = require('../js/config.js');
const RulesEngine = require('../js/rules.js');
const rules = new RulesEngine(GAME_CONFIG, dict);

// Empty board
const board = Array(15).fill(null).map(() => Array(15).fill(null));

// Test A: Move with invalid word "ABC" at center (7, 7)
const invalidMove = [
  { r: 7, c: 6, letter: 'A', points: 1 },
  { r: 7, c: 7, letter: 'B', points: 4 },
  { r: 7, c: 8, letter: 'C', points: 4 }
];
const resInvalid = rules.validateMove(board, invalidMove, 'WWF');
assert.strictEqual(resInvalid.valid, false, 'Move with non-word ABC should be invalid');
assert(resInvalid.error.includes('not in dictionary'), 'Error should mention word not in dictionary');
console.log('✓ RulesEngine correctly rejected invalid word move "ABC"');

// Test B: Move with valid word "CAT" at center (7, 7)
const validMove = [
  { r: 7, c: 6, letter: 'C', points: 4 },
  { r: 7, c: 7, letter: 'A', points: 1 },
  { r: 7, c: 8, letter: 'T', points: 1 }
];
const resValid = rules.validateMove(board, validMove, 'WWF');
assert.strictEqual(resValid.valid, true, 'Move with authentic word CAT should be valid');
assert(resValid.totalScore > 0, 'Valid move should calculate positive score');
console.log('✓ RulesEngine correctly accepted valid word move "CAT"');

console.log('ALL DICTIONARY VALIDATION TESTS PASSED! 🎉');
