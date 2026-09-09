// Core Scrabble / Words with Friends Game State & Turn Engine (2-5 Players)
class ScrabbleGame {
  constructor() {
    this.config = GAME_CONFIG;
    this.dictionary = DICTIONARY;
    this.rules = new RulesEngine(this.config, this.dictionary);
    this.network = new NetworkManager(this);

    this.mode = 'WWF'; // 'WWF' or 'SCRABBLE'
    this.board = Array(15).fill(null).map(() => Array(15).fill(null));
    this.tileBag = [];
    this.players = [];
    this.currentTurnIndex = 0;
    this.consecutivePasses = 0;
    this.gameOver = false;
    this.moveHistory = [];
    this.turnTimerSec = 0;
    this.timerInterval = null;
    this.timeRemaining = 0;

    this.onStateChange = null;
    this.onLobbyUpdate = null;

    // Handle network broadcast actions
    this.onNetworkEvent = (type, payload) => {
      if (type === 'STATE_SYNC') {
        this.applyFullState(payload);
      } else if (type === 'MOVE_PLAYED') {
        this.applyRemoteMove(payload);
      } else if (type === 'TURN_PASSED') {
        this.applyRemotePass(payload);
      } else if (type === 'TILES_SWAPPED') {
        this.applyRemoteSwap(payload);
      } else if (type === 'ROOM_JOIN') {
        if (this.onLobbyUpdate) this.onLobbyUpdate(payload);
      } else if (type === 'PLAYER_RENAME') {
        const player = this.players.find(p => p.id === payload.playerId);
        if (player && payload.newName) {
          player.name = payload.newName;
          this.notifyUpdate();
        }
      }
    };
  }

  setPlayerName(playerId, newName) {
    if (!newName) return;
    const cleanName = newName.trim();
    const player = this.players.find(p => p.id === playerId);
    if (player) {
      player.name = cleanName;
      this.notifyUpdate();
      this.network.sendAction('PLAYER_RENAME', { playerId: playerId, newName: cleanName });
    }
  }

  // Initialize a new game with 2 to 5 players
  startNewGame({
    playerConfigs = [
      { name: 'Player 1', isBot: false },
      { name: 'Player 2', isBot: true, botLevel: 'medium' }
    ],
    mode = 'WWF',
    timerMinutes = 0
  } = {}) {
    this.mode = mode;
    this.board = Array(15).fill(null).map(() => Array(15).fill(null));
    this.consecutivePasses = 0;
    this.gameOver = false;
    this.moveHistory = [];
    this.currentTurnIndex = 0;
    this.turnTimerSec = timerMinutes * 60;

    this.buildTileBag();

    const playerColors = ['#ff9800', '#2196f3', '#4caf50', '#e91e63', '#9c27b0'];
    this.players = playerConfigs.slice(0, 5).map((cfg, idx) => {
      const rack = this.drawTiles(this.config.RACK_SIZE);
      return {
        id: 'p_' + (idx + 1),
        name: cfg.name || ('Player ' + (idx + 1)),
        color: playerColors[idx % playerColors.length],
        score: 0,
        rack: rack,
        isBot: !!cfg.isBot,
        botLevel: cfg.botLevel || 'medium',
        passedLastTurn: false
      };
    });

    console.log('[Game] Started in ' + this.mode + ' mode with ' + this.players.length + ' players. Bag: ' + this.tileBag.length);

    this.startTurnTimer();
    this.notifyUpdate();

    // Broadcast initial state to room
    this.network.sendAction('STATE_SYNC', this.serializeState());

    this.checkBotTurn();
  }

  buildTileBag() {
    this.tileBag = [];
    const tileDef = this.mode === 'WWF' ? this.config.WWF_TILES : this.config.SCRABBLE_TILES;
    for (const letter in tileDef) {
      const info = tileDef[letter];
      for (let i = 0; i < info.count; i++) {
        this.tileBag.push({
          letter: letter,
          points: info.points,
          isBlank: letter === '_'
        });
      }
    }
    // Shuffle
    for (let i = this.tileBag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = this.tileBag[i];
      this.tileBag[i] = this.tileBag[j];
      this.tileBag[j] = tmp;
    }
  }

  drawTiles(count) {
    const drawn = [];
    for (let i = 0; i < count && this.tileBag.length > 0; i++) {
      drawn.push(this.tileBag.pop());
    }
    return drawn;
  }

  getCurrentPlayer() {
    return this.players[this.currentTurnIndex];
  }

  // Play a word move
  playMove(newTiles) {
    if (this.gameOver) return { valid: false, error: 'The game has ended.' };

    const player = this.getCurrentPlayer();
    const res = this.rules.validateMove(this.board, newTiles, this.mode);

    if (!res.valid) {
      AUDIO.playBuzz();
      return res;
    }

    // Apply tiles to board
    for (const tile of newTiles) {
      this.board[tile.r][tile.c] = {
        letter: tile.letter,
        points: tile.points,
        isBlank: !!tile.isBlank,
        playedBy: player.id
      };
    }

    // Deduct placed tiles from player's rack
    for (const tile of newTiles) {
      let idx = player.rack.findIndex(t => tile.isBlank ? t.isBlank : t.letter === tile.letter);
      if (idx === -1) {
        idx = player.rack.findIndex(t => t.letter === tile.letter);
      }
      if (idx !== -1) {
        player.rack.splice(idx, 1);
      }
    }

    const needed = this.config.RACK_SIZE - player.rack.length;
    const drawn = this.drawTiles(needed);
    player.rack.push(...drawn);

    player.score += res.totalScore;
    this.consecutivePasses = 0;

    AUDIO.playScoreFanfare(res.isBingo);

    const wordsListStr = res.wordsFormed.map(w => w.word + ' (' + w.points + ' pts)').join(', ');
    this.moveHistory.unshift({
      playerName: player.name,
      playerColor: player.color,
      action: 'PLAY',
      description: 'played ' + wordsListStr + (res.isBingo ? ' [35pt BINGO!]' : ''),
      score: res.totalScore,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    // Broadcast move to room
    this.network.sendAction('MOVE_PLAYED', {
      newTiles: newTiles,
      totalScore: res.totalScore,
      isBingo: res.isBingo,
      playerId: player.id
    });

    if (this.tileBag.length === 0 && player.rack.length === 0) {
      this.finishGame(player.id);
      return res;
    }

    this.advanceTurn();
    return res;
  }

  passTurn() {
    if (this.gameOver) return;
    const player = this.getCurrentPlayer();
    this.consecutivePasses++;

    this.moveHistory.unshift({
      playerName: player.name,
      playerColor: player.color,
      action: 'PASS',
      description: 'passed their turn.',
      score: 0,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    this.network.sendAction('TURN_PASSED', { playerId: player.id });

    if (this.consecutivePasses >= this.players.length * 2) {
      this.finishGame(null);
      return;
    }

    this.advanceTurn();
  }

  swapTiles(selectedIndices) {
    if (this.gameOver) return;
    if (this.tileBag.length < this.config.RACK_SIZE) {
      return { success: false, error: 'Cannot swap when fewer than 7 tiles remain in the bag.' };
    }

    const player = this.getCurrentPlayer();
    const swapped = [];
    const sorted = [...selectedIndices].sort((a, b) => b - a);
    for (const idx of sorted) {
      if (idx >= 0 && idx < player.rack.length) {
        swapped.push(player.rack.splice(idx, 1)[0]);
      }
    }

    const drawn = this.drawTiles(swapped.length);
    player.rack.push(...drawn);

    this.tileBag.push(...swapped);
    for (let i = this.tileBag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = this.tileBag[i];
      this.tileBag[i] = this.tileBag[j];
      this.tileBag[j] = tmp;
    }

    AUDIO.playShuffle();
    this.consecutivePasses = 0;

    this.moveHistory.unshift({
      playerName: player.name,
      playerColor: player.color,
      action: 'SWAP',
      description: 'swapped ' + swapped.length + ' tile' + (swapped.length > 1 ? 's' : '') + '.',
      score: 0,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    this.network.sendAction('TILES_SWAPPED', { playerId: player.id, count: swapped.length });

    this.advanceTurn();
    return { success: true };
  }

  shuffleRack() {
    const player = this.getCurrentPlayer();
    if (!player || !player.rack) return;
    for (let i = player.rack.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = player.rack[i];
      player.rack[i] = player.rack[j];
      player.rack[j] = tmp;
    }
    AUDIO.playShuffle();
    this.notifyUpdate();
  }

  advanceTurn() {
    this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;
    AUDIO.playTurnBell();
    this.startTurnTimer();
    this.notifyUpdate();
    this.checkBotTurn();
  }

  checkBotTurn() {
    if (this.gameOver) return;
    const player = this.getCurrentPlayer();
    if (player && player.isBot) {
      setTimeout(() => {
        if (this.gameOver || this.getCurrentPlayer() !== player) return;
        const best = BOT.findBestMove(this.board, player.rack, player.botLevel, this.mode);
        if (best && best.move) {
          this.playMove(best.move);
        } else if (this.tileBag.length >= 7) {
          this.swapTiles([0, 1]);
        } else {
          this.passTurn();
        }
      }, 1200);
    }
  }

  startTurnTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (!this.turnTimerSec || this.turnTimerSec <= 0) {
      this.timeRemaining = 0;
      return;
    }
    this.timeRemaining = this.turnTimerSec;
    this.timerInterval = setInterval(() => {
      this.timeRemaining--;
      if (this.timeRemaining <= 0) {
        clearInterval(this.timerInterval);
        this.passTurn();
      }
      this.notifyUpdate();
    }, 1000);
  }

  finishGame(clearingPlayerId) {
    this.gameOver = true;
    if (this.timerInterval) clearInterval(this.timerInterval);

    let totalDeductions = 0;
    for (const p of this.players) {
      const unplayedSum = p.rack.reduce((sum, t) => sum + (t.isBlank ? 0 : t.points), 0);
      if (p.id !== clearingPlayerId) {
        p.score = Math.max(0, p.score - unplayedSum);
        totalDeductions += unplayedSum;
      }
    }

    if (clearingPlayerId) {
      const finisher = this.players.find(p => p.id === clearingPlayerId);
      if (finisher) finisher.score += totalDeductions;
    }

    const sorted = [...this.players].sort((a, b) => b.score - a.score);
    const winner = sorted[0];

    this.moveHistory.unshift({
      playerName: 'GAME OVER',
      playerColor: '#ffd700',
      action: 'END',
      description: 'Winner: ' + winner.name + ' with ' + winner.score + ' points!',
      score: winner.score,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    this.notifyUpdate();
  }

  getLetterCounts() {
    const counts = {};
    for (let c = 65; c <= 90; c++) counts[String.fromCharCode(c)] = 0;
    counts['_'] = 0;
    for (const t of this.tileBag) {
      counts[t.letter] = (counts[t.letter] || 0) + 1;
    }
    return counts;
  }

  serializeState() {
    return {
      board: this.board,
      players: this.players,
      currentTurnIndex: this.currentTurnIndex,
      mode: this.mode,
      tileBagCount: this.tileBag.length,
      moveHistory: this.moveHistory,
      gameOver: this.gameOver
    };
  }

  applyFullState(state) {
    if (!state) return;
    this.board = state.board || this.board;
    this.players = state.players || this.players;
    this.currentTurnIndex = state.currentTurnIndex || 0;
    this.mode = state.mode || this.mode;
    this.moveHistory = state.moveHistory || this.moveHistory;
    this.gameOver = !!state.gameOver;
    this.notifyUpdate();
  }

  applyRemoteMove(payload) {
    if (!payload || !payload.newTiles) return;
    for (const t of payload.newTiles) {
      this.board[t.r][t.c] = {
        letter: t.letter,
        points: t.points,
        isBlank: !!t.isBlank,
        playedBy: payload.playerId
      };
    }
    const player = this.players.find(p => p.id === payload.playerId);
    if (player) {
      player.score += payload.totalScore;
    }
    AUDIO.playScoreFanfare(payload.isBingo);
    this.advanceTurn();
  }

  applyRemotePass(payload) {
    this.passTurn();
  }

  applyRemoteSwap(payload) {
    AUDIO.playShuffle();
    this.advanceTurn();
  }

  notifyUpdate() {
    if (this.onStateChange) {
      this.onStateChange(this);
    }
  }
}
