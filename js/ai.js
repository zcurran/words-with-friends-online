// AI Bot Engine for Solo / Offline Play & Filling Up to 5 Player Seats
class BotPlayer {
  constructor(rules, dictionary) {
    this.rules = rules;
    this.dictionary = dictionary;
  }

  // Find legal moves for current rack on board
  findBestMove(board, rack, difficulty = 'medium', mode = 'WWF') {
    const validMoves = [];
    const rackLetters = rack.map(t => t.letter);

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

    if (isBoardEmpty) {
      this.generateFirstWords(rack, board, validMoves, mode);
    } else {
      const anchors = this.findAnchors(board);
      for (const anchor of anchors) {
        this.generateMovesAtAnchor(board, anchor, rack, validMoves, mode);
        if (validMoves.length > 30) break;
      }
    }

    if (validMoves.length === 0) {
      return null;
    }

    validMoves.sort((a, b) => b.totalScore - a.totalScore);

    if (difficulty === 'hard') {
      return validMoves[0];
    } else if (difficulty === 'medium') {
      const topCount = Math.min(validMoves.length, 4);
      return validMoves[Math.floor(Math.random() * topCount)];
    } else {
      const idx = Math.min(validMoves.length - 1, Math.floor(validMoves.length * 0.6) + Math.floor(Math.random() * 2));
      return validMoves[idx];
    }
  }

  findAnchors(board) {
    const anchors = [];
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        if (!board[r][c]) {
          const adj = [
            [r - 1, c], [r + 1, c],
            [r, c - 1], [r, c + 1]
          ];
          for (const [nr, nc] of adj) {
            if (nr >= 0 && nr < 15 && nc >= 0 && nc < 15 && board[nr][nc]) {
              anchors.push({ r, c });
              break;
            }
          }
        }
      }
    }
    return anchors;
  }

  generateFirstWords(rack, board, outMoves, mode) {
    const available = rack.map(t => t.letter === '_' ? 'E' : t.letter);
    const len = available.length;
    const testedWords = new Set();

    const permute = (currentWord, usedIndices) => {
      if (currentWord.length >= 2 && this.dictionary.isValid(currentWord)) {
        if (!testedWords.has(currentWord)) {
          testedWords.add(currentWord);
          const startCol = 7 - Math.floor(currentWord.length / 2);
          if (startCol >= 0 && startCol + currentWord.length <= 15) {
            const move = [];
            for (let i = 0; i < currentWord.length; i++) {
              move.push({
                r: 7,
                c: startCol + i,
                letter: currentWord[i],
                isBlank: false,
                points: GAME_CONFIG.WWF_TILES[currentWord[i]] ? GAME_CONFIG.WWF_TILES[currentWord[i]].points : 1
              });
            }
            const res = this.rules.validateMove(board, move, mode);
            if (res.valid) {
              outMoves.push({ move, ...res });
            }
          }
        }
      }
      if (currentWord.length >= 5) return;

      for (let i = 0; i < len; i++) {
        if (!usedIndices.has(i)) {
          const next = currentWord + available[i];
          if (this.dictionary.hasPrefix(next)) {
            usedIndices.add(i);
            permute(next, usedIndices);
            usedIndices.delete(i);
          }
        }
      }
    };

    permute('', new Set());
  }

  generateMovesAtAnchor(board, anchor, rack, outMoves, mode) {
    const r = anchor.r;
    const c = anchor.c;
    const available = rack.map(t => t.letter === '_' ? 'S' : t.letter);
    const orientations = [true, false];

    for (const isHoriz of orientations) {
      for (let offset = 0; offset <= 2; offset++) {
        const startR = isHoriz ? r : Math.max(0, r - offset);
        const startC = isHoriz ? Math.max(0, c - offset) : c;

        for (let wordLen = 2; wordLen <= 4; wordLen++) {
          const move = [];
          let currentStr = '';
          let validPattern = true;
          let usedRackIndices = new Set();

          for (let step = 0; step < wordLen; step++) {
            const currR = isHoriz ? startR : startR + step;
            const currC = isHoriz ? startC + step : startC;

            if (currR >= 15 || currC >= 15) {
              validPattern = false;
              break;
            }

            if (board[currR][currC]) {
              currentStr += board[currR][currC].letter;
            } else {
              let picked = false;
              for (let i = 0; i < available.length; i++) {
                if (!usedRackIndices.has(i)) {
                  usedRackIndices.add(i);
                  move.push({
                    r: currR,
                    c: currC,
                    letter: available[i],
                    isBlank: false,
                    points: GAME_CONFIG.WWF_TILES[available[i]] ? GAME_CONFIG.WWF_TILES[available[i]].points : 1
                  });
                  currentStr += available[i];
                  picked = true;
                  break;
                }
              }
              if (!picked) {
                validPattern = false;
                break;
              }
            }
          }

          if (validPattern && move.length > 0 && this.dictionary.isValid(currentStr)) {
            const res = this.rules.validateMove(board, move, mode);
            if (res.valid) {
              outMoves.push({ move, ...res });
            }
          }
        }
      }
    }
  }
}

const BOT = new BotPlayer(new RulesEngine(GAME_CONFIG, DICTIONARY), DICTIONARY);
