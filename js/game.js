// Core Scrabble / Words with Friends Game State & Turn Engine (1-10 Players)
class ScrabbleGame {
  constructor() {
    this.config = GAME_CONFIG;
    this.dictionary = DICTIONARY;
    this.rules = new RulesEngine(this.config, this.dictionary);
    this.network = new NetworkManager(this);

    this.mode = 'WWF'; // 'WWF' or 'SCRABBLE'
    this.boardSize = 15; // Dynamic board dimension (NxN)
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
        this.handleRemotePlayerJoin(payload);
      } else if (type === 'PLAYER_LEAVE') {
        this.handlePlayerLeave(payload);
      } else if (type === 'HEARTBEAT') {
        this.handleHeartbeat(payload);
      } else if (type === 'REQUEST_SYNC') {
        if (this.network && (this.network.isHost || (this.players[0] && this.players[0].id === this.network.playerId))) {
          this.network.sendAction('STATE_SYNC', this.serializeState());
        }
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

  // Add a new player dynamically when they join the room
  addPlayer(cfg) {
    if (!cfg) return null;
    if (this.players.length >= 10) return null;

    let cleanName = (cfg.name || '').trim();
    if (!cleanName) cleanName = 'Player ' + (this.players.length + 1);

    // If a player with the exact same ID is already in the game, update and return
    if (cfg.id) {
      const existingById = this.players.find(p => p.id === cfg.id);
      if (existingById) {
        existingById.name = cleanName;
        existingById.isOffline = false;
        existingById.lastSeen = Date.now();
        this.notifyUpdate();
        return existingById;
      }
    }

    // If another player already has this exact name, disambiguate it so they don't collide
    const nameExists = this.players.some(p => p.name.toLowerCase() === cleanName.toLowerCase());
    if (nameExists) {
      let counter = 2;
      while (this.players.some(p => p.name.toLowerCase() === (cleanName + ' ' + counter).toLowerCase())) {
        counter++;
      }
      cleanName = cleanName + ' ' + counter;
    }

    const playerColors = [
      '#ff9800', '#2196f3', '#4caf50', '#e91e63', '#9c27b0',
      '#00bcd4', '#ff5722', '#8bc34a', '#3f51b5', '#e040fb'
    ];
    const idx = this.players.length;
    const rack = (cfg.rack && cfg.rack.length > 0) ? cfg.rack : this.drawTiles(this.config.RACK_SIZE);
    const newPlayer = {
      id: cfg.id || ('p_' + (idx + 1)),
      name: cleanName,
      color: playerColors[idx % playerColors.length],
      score: cfg.score || 0,
      rack: rack,
      isBot: !!cfg.isBot,
      botLevel: cfg.botLevel || 'medium',
      passedLastTurn: false,
      isOffline: false,
      lastSeen: Date.now()
    };

    this.players.push(newPlayer);

    this.moveHistory.unshift({
      playerName: newPlayer.name,
      playerColor: newPlayer.color,
      action: 'JOIN',
      description: 'joined the room!',
      score: 0,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    try { AUDIO.playTurnBell(); } catch (e) {}
    this.notifyUpdate();
    return newPlayer;
  }

  // Handle when another player joins via network
  handleRemotePlayerJoin(payload) {
    if (!payload || !payload.playerName) return;

    this.addPlayer({
      id: payload.playerId,
      name: payload.playerName,
      isBot: false
    });

    if (this.onLobbyUpdate) {
      this.onLobbyUpdate(payload);
    }

    // Only host/primary broadcasts current game state back so new player gets the full roster and board
    if (this.network && (this.network.isHost || (this.players[0] && this.players[0].id === this.network.playerId))) {
      this.network.sendAction('STATE_SYNC', this.serializeState());
    }
  }

  // Handle player leaving or disconnecting
  handlePlayerLeave(payload) {
    if (!payload || !payload.playerId) return;
    const pIndex = this.players.findIndex(p => p.id === payload.playerId);
    if (pIndex === -1) return;

    const leavingPlayer = this.players[pIndex];
    const leavingName = leavingPlayer.name.replace(' (Offline)', '').trim();

    // If game hasn't started making real moves yet, completely remove player from roster
    const isGameInProgress = this.moveHistory.some(m => m.action === 'PLAY');

    if (!isGameInProgress) {
      this.players.splice(pIndex, 1);
      if (this.currentTurnIndex >= this.players.length) {
        this.currentTurnIndex = 0;
      }
    } else {
      // Mark player offline and auto-advance if it's their turn
      leavingPlayer.isOffline = true;
      if (!leavingPlayer.name.includes('(Offline)')) {
        leavingPlayer.name = leavingPlayer.name + ' (Offline)';
      }
      if (this.currentTurnIndex === pIndex) {
        this.advanceTurn();
      }
    }

    this.moveHistory.unshift({
      playerName: leavingName,
      playerColor: leavingPlayer.color || '#94a3b8',
      action: 'LEAVE',
      description: 'left the room.',
      score: 0,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    if (this.onLobbyUpdate) {
      this.onLobbyUpdate({ type: 'LEAVE', playerId: payload.playerId });
    }

    this.notifyUpdate();

    if (this.network && (this.network.isHost || (this.players[0] && this.players[0].id === this.network.playerId))) {
      this.network.sendAction('STATE_SYNC', this.serializeState());
    }
  }

  handleHeartbeat(payload) {
    if (!payload || !payload.playerId) return;
    const player = this.players.find(p => p.id === payload.playerId);
    if (player) {
      player.lastSeen = Date.now();
      if (player.isOffline) {
        player.isOffline = false;
        player.name = player.name.replace(' (Offline)', '').trim();
        this.notifyUpdate();
      }
    } else if (this.network && (this.network.isHost || (this.players[0] && this.players[0].id === this.network.playerId))) {
      if (payload.playerName && this.players.length < 10) {
        this.addPlayer({ id: payload.playerId, name: payload.playerName, isBot: false });
        this.network.sendAction('STATE_SYNC', this.serializeState());
      }
    }
  }

  // Get the local player entity for the current browser client
  getLocalPlayer() {
    if (this.network && this.network.playerId) {
      const p = this.players.find(pl => pl.id === this.network.playerId);
      if (p) return p;
    }
    if (this.network && this.network.playerName) {
      const p = this.players.find(pl => pl.name.toLowerCase() === this.network.playerName.toLowerCase());
      if (p) return p;
    }
    return this.players[0] || null;
  }

  // Initialize a new game (Defaults to 1 human player - no automatic bot!)
  startNewGame({
    playerConfigs = [
      { name: 'Player 1', isBot: false }
    ],
    mode = 'WWF',
    timerMinutes = 0,
    boardSize = 15
  } = {}) {
    this.mode = mode;
    this.boardSize = Math.max(5, Math.min(100, parseInt(boardSize) || 15));
    const N = this.boardSize;
    this.board = Array(N).fill(null).map(() => Array(N).fill(null));
    this.consecutivePasses = 0;
    this.gameOver = false;
    this.moveHistory = [];
    this.currentTurnIndex = 0;
    this.turnTimerSec = timerMinutes * 60;

    const playerColors = [
      '#ff9800', '#2196f3', '#4caf50', '#e91e63', '#9c27b0',
      '#00bcd4', '#ff5722', '#8bc34a', '#3f51b5', '#e040fb'
    ];
    const numPlayers = Math.min(10, playerConfigs.length);

    // Build shared tile bag sized for the full player group BEFORE dealing racks
    this.buildTileBag(numPlayers);

    this.players = playerConfigs.slice(0, 10).map((cfg, idx) => {
      // Try restoring persisted rack for rejoining players
      let rack = this.restorePlayerSnapshot(cfg.id);
      if (!rack || rack.length === 0) {
        rack = this.drawTiles(this.config.RACK_SIZE);
      }
      const cleanName = (cfg.name || ('Player ' + (idx + 1))).replace(' (Host)', '').replace(' (You)', '').trim();
      return {
        id: cfg.id || (idx === 0 && this.network ? this.network.playerId : ('p_' + (idx + 1))),
        name: cleanName || ('Player ' + (idx + 1)),
        color: playerColors[idx % playerColors.length],
        score: cfg.score || 0,
        rack: rack,
        isBot: !!cfg.isBot,
        botLevel: cfg.botLevel || 'medium',
        passedLastTurn: false,
        isOffline: false,
        lastSeen: Date.now()
      };
    });

    console.log('[Game] Started in ' + this.mode + ' ' + N + 'x' + N + ' mode with ' + this.players.length + ' players. Bag: ' + this.tileBag.length);

    this.startTurnTimer();
    this.notifyUpdate();

    // Broadcast initial state to room
    if (this.network) {
      this.network.sendAction('STATE_SYNC', this.serializeState());
    }

    this.checkBotTurn();
  }

  buildTileBag(numPlayers = 2) {
    this.tileBag = [];
    const tileDef = this.mode === 'WWF' ? this.config.WWF_TILES : this.config.SCRABBLE_TILES;
    
    // Shared pool: 100 tiles for 2 players, +50 tiles per extra player beyond 2.
    // Scale factor relative to a standard single set (100 tiles for 2 players):
    //   2 players  -> scaleFactor = 1.0  (~100 tiles)
    //   3 players  -> scaleFactor = 1.5  (~150 tiles)
    //   4 players  -> scaleFactor = 2.0  (~200 tiles)  etc.
    const n = Math.max(2, numPlayers);
    const scaleFactor = 1 + (n - 2) * 0.5;

    for (const letter in tileDef) {
      const info = tileDef[letter];
      const targetCount = Math.max(1, Math.round(info.count * scaleFactor));
      for (let i = 0; i < targetCount; i++) {
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
    const res = this.rules.validateMove(this.board, newTiles, this.mode, this.boardSize);

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

    // In multiplayer: server owns the tile bag and will send updated rack via sync_state.
    // In local/offline mode: draw from local tileBag.
    const isMultiplayer = this.network && this.network.socket && this.network.socket.connected && this.network.roomCode;
    if (!isMultiplayer) {
      const needed = this.config.RACK_SIZE - player.rack.length;
      const drawn = this.drawTiles(needed);
      player.rack.push(...drawn);
    }

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

    // Broadcast move to room (server will handle tile draw + sync in multiplayer)
    this.network.sendAction('MOVE_PLAYED', {
      newTiles: newTiles,
      totalScore: res.totalScore,
      isBingo: res.isBingo,
      playerId: player.id,
      wordsFormed: res.wordsFormed
    });

    if (!isMultiplayer) {
      // Local mode: check end condition based on local bag
      if (this.tileBag.length === 0 && player.rack.length === 0) {
        this.finishGame(player.id);
        return res;
      }
      this.advanceTurn();
    }
    // In multiplayer: server sends sync_state which calls applyFullState → advanceTurn is handled server-side

    this.notifyUpdate();
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

    // In multiplayer: server handles tile draw from shared bag.
    // In local/offline mode: draw from local tileBag.
    const isMultiplayer = this.network && this.network.socket && this.network.socket.connected && this.network.roomCode;
    if (!isMultiplayer) {
      const drawn = this.drawTiles(swapped.length);
      player.rack.push(...drawn);
      this.tileBag.push(...swapped);
      for (let i = this.tileBag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = this.tileBag[i];
        this.tileBag[i] = this.tileBag[j];
        this.tileBag[j] = tmp;
      }
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

    this.network.sendAction('TILES_SWAPPED', { playerId: player.id, count: swapped.length, tileIndices: selectedIndices });

    if (!isMultiplayer) {
      this.advanceTurn();
    }
    this.notifyUpdate();
    return { success: true };
  }

  shuffleRack() {
    const player = this.getLocalPlayer ? this.getLocalPlayer() : this.getCurrentPlayer();
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
    if (this.players.length === 0) return;

    // Persist every player's state so rejoining players restore their rack/score
    for (const p of this.players) {
      this.savePlayerSnapshot(p);
    }

    this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;

    const hasOnline = this.players.some(p => !p.isOffline);
    let attempts = 0;
    while (hasOnline && this.getCurrentPlayer() && this.getCurrentPlayer().isOffline && attempts < this.players.length) {
      this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;
      attempts++;
    }

    this.checkLocalTurnNotification();

    this.startTurnTimer();
    this.notifyUpdate();
    this.checkBotTurn();
  }

  // Plays the bell and flashes the screen if it just became the local player's turn
  checkLocalTurnNotification() {
    const localPlayer = this.getLocalPlayer();
    if (localPlayer && this.getCurrentPlayer() && this.getCurrentPlayer().id === localPlayer.id) {
      try { AUDIO.playTurnBell(); } catch (e) {}
      
      // Visual Fallback 1: Browser Tab Title Flash
      let flashCount = 0;
      const originalTitle = document.title;
      // Clear any existing flash interval to prevent overlapping
      if (window._turnFlashInterval) clearInterval(window._turnFlashInterval);
      window._turnFlashInterval = setInterval(() => {
        document.title = flashCount % 2 === 0 ? "⚠️ YOUR TURN! ⚠️" : "Words with Friends Online (1 to 10 Players)";
        flashCount++;
        if (flashCount > 10) { 
          clearInterval(window._turnFlashInterval); 
          document.title = "Words with Friends Online (1 to 10 Players)"; 
        }
      }, 500);

      // Visual Fallback 2: Big On-Screen Toast
      const toast = document.createElement('div');
      toast.innerText = "⭐ IT IS YOUR TURN! ⭐";
      toast.style.cssText = "position:fixed; top:80px; left:50%; transform:translate(-50%, -20px); background:linear-gradient(135deg, #ff9800, #f57c00); color:#000; padding:15px 35px; font-size:22px; font-weight:900; border-radius:12px; box-shadow:0 15px 35px rgba(0,0,0,0.6); z-index:9999; opacity:0; transition:all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); pointer-events:none; border:2px solid #fff;";
      document.body.appendChild(toast);
      
      // Trigger entrance
      requestAnimationFrame(() => {
        toast.style.transform = "translate(-50%, 0)";
        toast.style.opacity = "1";
      });
      
      // Trigger exit after 4s
      setTimeout(() => {
        toast.style.transform = "translate(-50%, -20px)";
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 300);
      }, 4000);
    }
  }

  checkBotTurn() {
    if (this.gameOver) return;
    if (this.network && !this.network.isHost && this.players.length > 1) {
      return; // Only host executes bot moves in multiplayer
    }
    const player = this.getCurrentPlayer();
    if (player && player.isBot) {
      setTimeout(() => {
        if (this.gameOver || this.getCurrentPlayer() !== player) return;
        const best = BOT.findBestMove(this.board, player.rack, player.botLevel, this.mode, this.boardSize || 15);
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

  // ── Player Snapshot Persistence ─────────────────────────────────────────
  // Save each player's rack to localStorage so they can rejoin mid-game
  savePlayerSnapshot(player) {
    if (!player || !player.id) return;
    try {
      const data = { rack: player.rack, score: player.score, name: player.name, savedAt: Date.now() };
      localStorage.setItem('wwf_player_snap_' + player.id, JSON.stringify(data));
    } catch (e) {}
  }

  restorePlayerSnapshot(playerId) {
    if (!playerId) return null;
    try {
      const raw = localStorage.getItem('wwf_player_snap_' + playerId);
      if (!raw) return null;
      const data = JSON.parse(raw);
      // Only restore recent snapshots (within last 24h)
      if (Date.now() - data.savedAt > 86400000) return null;
      return data.rack || null;
    } catch (e) { return null; }
  }

  clearPlayerSnapshot(playerId) {
    try { localStorage.removeItem('wwf_player_snap_' + playerId); } catch (e) {}
  }
  // ─────────────────────────────────────────────────────────────────────────

  serializeState() {
    return {
      board: this.board,
      boardSize: this.boardSize,
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
    if (state.boardSize) this.boardSize = state.boardSize;

    // Sync tile bag count from server (server is authoritative for tile bag in multiplayer)
    if (state.tileBagCount !== undefined) {
      this.tileBagCount = state.tileBagCount; // track for display purposes
    }

    if (state.players && state.players.length > 0) {
      this.players = state.players;
      // If we find our player in the incoming state by ID, update local player name if host disambiguated us
      if (this.network && this.network.playerId) {
        const me = this.players.find(p => p.id === this.network.playerId);
        if (me && me.name && me.name !== this.network.playerName) {
          this.network.playerName = me.name;
          if (this.onPlayerRenamed) {
            this.onPlayerRenamed(me.name);
          }
        }
      }
    }

    const prevTurn = this.currentTurnIndex;
    this.currentTurnIndex = state.currentTurnIndex !== undefined ? state.currentTurnIndex : this.currentTurnIndex;
    
    // If the turn changed to us due to a remote network update, trigger the notification
    if (prevTurn !== this.currentTurnIndex) {
      this.checkLocalTurnNotification();
    }
    this.mode = state.mode || this.mode;
    this.moveHistory = state.moveHistory || this.moveHistory;
    this.gameOver = !!state.gameOver;
    this.notifyUpdate();
  }

  applyRemoteMove(payload) {
    if (!payload || !payload.newTiles) return;
    for (const t of payload.newTiles) {
      if (!this.board[t.r]) this.board[t.r] = [];
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

  onRemotePlayerPositions(data) {
    if (!data) return;
    if (!this.remoteStagedPositions) {
      this.remoteStagedPositions = {};
    }
    const playerId = data.playerId;
    if (data.stagedTiles && data.stagedTiles.length > 0) {
      const player = this.players.find(p => p.id === playerId);
      this.remoteStagedPositions[playerId] = {
        playerName: player ? player.name : 'Opponent',
        playerColor: player ? player.color : '#2196f3',
        tiles: data.stagedTiles
      };
    } else {
      delete this.remoteStagedPositions[playerId];
    }
    if (this.onRemoteStagedChange) {
      this.onRemoteStagedChange(this.remoteStagedPositions);
    }
  }

  notifyUpdate() {
    if (this.onStateChange) {
      this.onStateChange(this);
    }
  }
}
