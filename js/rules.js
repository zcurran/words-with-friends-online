// Words with Friends / Scrabble Rules & Scoring Engine
class RulesEngine {
  constructor(config = GAME_CONFIG, dictionary = DICTIONARY) {
    this.config = config;
    this.dictionary = dictionary;
  }

  // Helper to get tile at (r, c) on board (combines existing board and newly placed tiles)
  getTile(board, newTilesMap, r, c) {
    if (r < 0 || r >= 15 || c < 0 || c >= 15) return null;
    const key = r + ',' + c;
    if (newTilesMap.has(key)) return newTilesMap.get(key);
    return board[r][c] || null;
  }

  // Validate a move and calculate score
  validateMove(board, newTiles, mode = 'WWF') {
    if (!newTiles || newTiles.length === 0) {
      return { valid: false, error: 'No tiles placed on the board.' };
    }

    const boardLayout = mode === 'WWF' ? this.config.WWF_BOARD : this.config.SCRABBLE_BOARD;
    const bingoBonus = mode === 'WWF' ? this.config.BINGO_BONUS_WWF : this.config.BINGO_BONUS_SCRABBLE;

    // Check if board is currently empty (first move)
    let isBoardEmpty = true;
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        if (board[r][c]) {
          isBoardEmpty = false;
          break;
        }
      }
      if (!isBoardEmpty) break;
    }

    // Map new tiles by coordinate
    const newTilesMap = new Map();
    let coversCenter = false;

    for (const tile of newTiles) {
      const r = tile.r;
      const c = tile.c;
      if (r < 0 || r >= 15 || c < 0 || c >= 15) {
        return { valid: false, error: 'Tile placed outside board boundaries.' };
      }
      if (board[r][c]) {
        return { valid: false, error: 'Square (' + r + ', ' + c + ') is already occupied.' };
      }
      const key = r + ',' + c;
      if (newTilesMap.has(key)) {
        return { valid: false, error: 'Duplicate tile placement on same square.' };
      }
      newTilesMap.set(key, { ...tile, isNew: true });

      if (r === 7 && c === 7) {
        coversCenter = true;
      }
    }

    // First move must cover center (7, 7)
    if (isBoardEmpty) {
      if (!coversCenter) {
        return { valid: false, error: 'The first word must cover the center star (★) square.' };
      }
      if (newTiles.length < 2) {
        return { valid: false, error: 'First word must contain at least 2 letters.' };
      }
    }

    // Check linearity: all new tiles must be in the same row OR same col
    const firstTile = newTiles[0];
    const sameRow = newTiles.every(t => t.r === firstTile.r);
    const sameCol = newTiles.every(t => t.c === firstTile.c);

    if (!sameRow && !sameCol) {
      return { valid: false, error: 'All placed tiles must be in a single straight row or column.' };
    }

    // Determine primary orientation
    let isHorizontal = sameRow;
    if (newTiles.length === 1) {
      const r = firstTile.r, c = firstTile.c;
      const hasHorizontalAdj = (c > 0 && board[r][c-1]) || (c < 14 && board[r][c+1]);
      const hasVerticalAdj = (r > 0 && board[r-1][c]) || (r < 14 && board[r+1][c]);
      if (hasHorizontalAdj && !hasVerticalAdj) isHorizontal = true;
      else if (hasVerticalAdj && !hasHorizontalAdj) isHorizontal = false;
      else isHorizontal = true;
    }

    // Check contiguity: between min and max coordinate, all squares must be filled
    if (isHorizontal) {
      const r = firstTile.r;
      const cols = newTiles.map(t => t.c);
      const minCol = Math.min(...cols);
      const maxCol = Math.max(...cols);
      for (let c = minCol; c <= maxCol; c++) {
        if (!this.getTile(board, newTilesMap, r, c)) {
          return { valid: false, error: 'Tiles placed in a row cannot have empty gaps between them.' };
        }
      }
    } else {
      const c = firstTile.c;
      const rows = newTiles.map(t => t.r);
      const minRow = Math.min(...rows);
      const maxRow = Math.max(...rows);
      for (let r = minRow; r <= maxRow; r++) {
        if (!this.getTile(board, newTilesMap, r, c)) {
          return { valid: false, error: 'Tiles placed in a column cannot have empty gaps between them.' };
        }
      }
    }

    // Check connectivity for subsequent moves (must touch at least one existing tile)
    if (!isBoardEmpty) {
      let connectsToExisting = false;
      for (const tile of newTiles) {
        const r = tile.r;
        const c = tile.c;
        const neighbors = [
          [r - 1, c], [r + 1, c],
          [r, c - 1], [r, c + 1]
        ];
        for (const [nr, nc] of neighbors) {
          if (nr >= 0 && nr < 15 && nc >= 0 && nc < 15) {
            if (board[nr][nc] && !newTilesMap.has(nr + ',' + nc)) {
              connectsToExisting = true;
              break;
            }
          }
        }
        if (connectsToExisting) break;
      }

      if (!connectsToExisting) {
        return { valid: false, error: 'New tiles must connect directly to existing tiles on the board.' };
      }
    }

    // Extract all words formed: Main word + Cross words
    const wordsFormed = [];
    const processedWordKeys = new Set();

    // 1. Extract Main Word
    let mainWordTiles = [];
    if (isHorizontal) {
      const r = firstTile.r;
      let startCol = Math.min(...newTiles.map(t => t.c));
      while (startCol > 0 && this.getTile(board, newTilesMap, r, startCol - 1)) {
        startCol--;
      }
      let endCol = Math.max(...newTiles.map(t => t.c));
      while (endCol < 14 && this.getTile(board, newTilesMap, r, endCol + 1)) {
        endCol++;
      }
      for (let c = startCol; c <= endCol; c++) {
        const t = this.getTile(board, newTilesMap, r, c);
        mainWordTiles.push({ ...t, r, c });
      }
    } else {
      const c = firstTile.c;
      let startRow = Math.min(...newTiles.map(t => t.r));
      while (startRow > 0 && this.getTile(board, newTilesMap, startRow - 1, c)) {
        startRow--;
      }
      let endRow = Math.max(...newTiles.map(t => t.r));
      while (endRow < 14 && this.getTile(board, newTilesMap, endRow + 1, c)) {
        endRow++;
      }
      for (let r = startRow; r <= endRow; r++) {
        const t = this.getTile(board, newTilesMap, r, c);
        mainWordTiles.push({ ...t, r, c });
      }
    }

    if (mainWordTiles.length >= 2) {
      const wordStr = mainWordTiles.map(t => t.letter).join('').toUpperCase();
      const wordKey = mainWordTiles.map(t => t.r + ',' + t.c).join(';');
      processedWordKeys.add(wordKey);
      wordsFormed.push({
        word: wordStr,
        tiles: mainWordTiles,
        isHorizontal
      });
    }

    // 2. Extract Cross Words
    for (const tile of newTiles) {
      const r = tile.r;
      const c = tile.c;
      let crossTiles = [];
      if (isHorizontal) {
        let startR = r;
        while (startR > 0 && this.getTile(board, newTilesMap, startR - 1, c)) {
          startR--;
        }
        let endR = r;
        while (endR < 14 && this.getTile(board, newTilesMap, endR + 1, c)) {
          endR++;
        }
        if (startR !== endR) {
          for (let currR = startR; currR <= endR; currR++) {
            const t = this.getTile(board, newTilesMap, currR, c);
            crossTiles.push({ ...t, r: currR, c });
          }
        }
      } else {
        let startC = c;
        while (startC > 0 && this.getTile(board, newTilesMap, r, startC - 1)) {
          startC--;
        }
        let endC = c;
        while (endC < 14 && this.getTile(board, newTilesMap, r, endC + 1)) {
          endC++;
        }
        if (startC !== endC) {
          for (let currC = startC; currC <= endC; currC++) {
            const t = this.getTile(board, newTilesMap, r, currC);
            crossTiles.push({ ...t, r: currC, c: currC });
          }
        }
      }

      if (crossTiles.length >= 2) {
        const wordKey = crossTiles.map(t => t.r + ',' + t.c).join(';');
        if (!processedWordKeys.has(wordKey)) {
          processedWordKeys.add(wordKey);
          wordsFormed.push({
            word: crossTiles.map(t => t.letter).join('').toUpperCase(),
            tiles: crossTiles,
            isHorizontal: !isHorizontal
          });
        }
      }
    }

    if (wordsFormed.length === 0) {
      return { valid: false, error: 'No valid words of 2 or more letters formed.' };
    }

    // Validate each word against dictionary
    const invalidWords = [];
    for (const item of wordsFormed) {
      if (!this.dictionary.isValid(item.word)) {
        invalidWords.push(item.word);
      }
    }

    if (invalidWords.length > 0) {
      return {
        valid: false,
        error: 'Word not in dictionary: "' + invalidWords.join('", "') + '"',
        invalidWords,
        wordsFormed
      };
    }

    // Calculate score for each valid word
    let totalScore = 0;
    const tileConfig = mode === 'WWF' ? this.config.WWF_TILES : this.config.SCRABBLE_TILES;

    for (const item of wordsFormed) {
      let wordBaseScore = 0;
      let wordMultiplier = 1;

      for (const t of item.tiles) {
        const isNew = newTilesMap.has(t.r + ',' + t.c);
        const basePoints = t.isBlank ? 0 : (tileConfig[t.letter] ? tileConfig[t.letter].points : 0);

        if (isNew) {
          const squareType = boardLayout[t.r][t.c];
          let letterMultiplier = 1;

          if (squareType === 'DL') letterMultiplier = 2;
          else if (squareType === 'TL') letterMultiplier = 3;
          else if (squareType === 'DW') wordMultiplier *= 2;
          else if (squareType === 'TW') wordMultiplier *= 3;
          else if (squareType === 'STAR' && isBoardEmpty) {
            wordMultiplier *= 2;
          }

          wordBaseScore += (basePoints * letterMultiplier);
        } else {
          wordBaseScore += basePoints;
        }
      }

      item.points = wordBaseScore * wordMultiplier;
      totalScore += item.points;
    }

    const isBingo = newTiles.length === this.config.RACK_SIZE;
    if (isBingo) {
      totalScore += bingoBonus;
    }

    return {
      valid: true,
      totalScore,
      wordsFormed,
      isBingo,
      bingoBonus: isBingo ? bingoBonus : 0
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = RulesEngine;
}
