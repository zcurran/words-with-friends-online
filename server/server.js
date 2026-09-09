// =========================================================
// Words with Friends / Scrabble Online Multiplayer Server
// Backend: Node.js & Socket.io (1 to 10 Players)
// Architecture: Client-Server with Invite Codes, Session Store,
// Optional Password Protection & Real-time State Synchronization
// =========================================================

const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const PORT = process.env.PORT || 8080;
const rootDir = path.resolve(__dirname, '..');

// 1. Static Web Hosting for Frontend
app.use(cors());
app.use(express.static(rootDir));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', activeSessions: sessions.size, timestamp: Date.now() });
});

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(rootDir, 'index.html'));
});

// 2. Tile Definitions (WWF & Scrabble)
const TILE_DEFINITIONS = {
  WWF: {
    'A': { count: 9, points: 1 }, 'B': { count: 2, points: 4 }, 'C': { count: 2, points: 4 },
    'D': { count: 5, points: 2 }, 'E': { count: 13, points: 1 }, 'F': { count: 2, points: 4 },
    'G': { count: 3, points: 3 }, 'H': { count: 4, points: 3 }, 'I': { count: 8, points: 1 },
    'J': { count: 1, points: 10 }, 'K': { count: 1, points: 5 }, 'L': { count: 4, points: 2 },
    'M': { count: 2, points: 4 }, 'N': { count: 5, points: 2 }, 'O': { count: 8, points: 1 },
    'P': { count: 2, points: 4 }, 'Q': { count: 1, points: 10 }, 'R': { count: 6, points: 1 },
    'S': { count: 5, points: 1 }, 'T': { count: 7, points: 1 }, 'U': { count: 4, points: 2 },
    'V': { count: 2, points: 5 }, 'W': { count: 2, points: 4 }, 'X': { count: 1, points: 8 },
    'Y': { count: 2, points: 3 }, 'Z': { count: 1, points: 10 }, '_': { count: 2, points: 0 }
  },
  SCRABBLE: {
    'A': { count: 9, points: 1 }, 'B': { count: 2, points: 3 }, 'C': { count: 2, points: 3 },
    'D': { count: 4, points: 2 }, 'E': { count: 12, points: 1 }, 'F': { count: 2, points: 4 },
    'G': { count: 3, points: 2 }, 'H': { count: 2, points: 4 }, 'I': { count: 9, points: 1 },
    'J': { count: 1, points: 8 }, 'K': { count: 1, points: 5 }, 'L': { count: 4, points: 1 },
    'M': { count: 2, points: 3 }, 'N': { count: 6, points: 1 }, 'O': { count: 8, points: 1 },
    'P': { count: 2, points: 3 }, 'Q': { count: 1, points: 10 }, 'R': { count: 6, points: 1 },
    'S': { count: 4, points: 1 }, 'T': { count: 6, points: 1 }, 'U': { count: 4, points: 1 },
    'V': { count: 2, points: 4 }, 'W': { count: 2, points: 4 }, 'X': { count: 1, points: 8 },
    'Y': { count: 2, points: 4 }, 'Z': { count: 1, points: 10 }, '_': { count: 2, points: 0 }
  }
};

const PLAYER_PALETTE = [
  '#ff9800', '#2196f3', '#4caf50', '#e91e63', '#9c27b0',
  '#00bcd4', '#ff5722', '#8bc34a', '#3f51b5', '#e040fb'
];

function buildTileBag(mode) {
  const def = (mode === 'SCRABBLE') ? TILE_DEFINITIONS.SCRABBLE : TILE_DEFINITIONS.WWF;
  const bag = [];
  for (const letter in def) {
    const item = def[letter];
    for (let i = 0; i < item.count; i++) {
      bag.push({ letter: letter, points: item.points, isBlank: letter === '_' });
    }
  }
  // Fisher-Yates shuffle
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = bag[i];
    bag[i] = bag[j];
    bag[j] = temp;
  }
  return bag;
}

function drawTiles(bag, count) {
  const drawn = [];
  for (let i = 0; i < count && bag.length > 0; i++) {
    drawn.push(bag.pop());
  }
  return drawn;
}

// 3. Centralized In-Memory Session Store
// inviteCode -> Session object
const sessions = new Map();

function serializeSession(session) {
  return {
    inviteCode: session.inviteCode,
    hasPassword: !!session.password,
    mode: session.mode,
    timerMinutes: session.timerMinutes,
    board: session.board,
    players: session.players.map(p => ({
      id: p.id,
      name: p.name,
      color: p.color,
      score: p.score,
      rackCount: p.rack ? p.rack.length : 0,
      rack: p.rack, // Each player receives rack; client hides opponent racks
      isBot: p.isBot,
      isHost: p.isHost,
      seatIndex: p.seatIndex,
      isOffline: p.isOffline
    })),
    currentTurnIndex: session.currentTurnIndex,
    tileBagCount: session.tileBag.length,
    moveHistory: session.moveHistory,
    gameOver: session.gameOver,
    stagedPositions: session.stagedPositions || {}
  };
}

function advanceTurn(session) {
  if (session.players.length === 0) return;
  session.currentTurnIndex = (session.currentTurnIndex + 1) % session.players.length;

  // Skip offline players if at least one online player exists
  const hasOnline = session.players.some(p => !p.isOffline);
  let attempts = 0;
  while (hasOnline && session.players[session.currentTurnIndex] && session.players[session.currentTurnIndex].isOffline && attempts < session.players.length) {
    session.currentTurnIndex = (session.currentTurnIndex + 1) % session.players.length;
    attempts++;
  }
}

// 4. Socket.io Connection & Event Handling
io.on('connection', (socket) => {
  console.log('[Socket.io] Client connected:', socket.id);

  // Host starts a world / room with unique invite code & optional password
  socket.on('create_room', (data = {}) => {
    try {
      const inviteCode = (data.inviteCode || ('WWF-' + Math.floor(1000 + Math.random() * 9000))).toUpperCase().trim();
      const password = data.password ? String(data.password).trim() : null;
      const hostName = (data.hostName || 'Player 1').trim();
      const hostPlayerId = data.hostPlayerId || ('p_' + Math.random().toString(36).substring(2, 8));
      const mode = data.mode || 'WWF';
      const timerMinutes = parseInt(data.timerMinutes) || 0;

      const tileBag = buildTileBag(mode);
      const hostRack = drawTiles(tileBag, 7);

      const session = {
        inviteCode: inviteCode,
        password: password,
        hasPassword: !!password,
        hostSocketId: socket.id,
        hostPlayerId: hostPlayerId,
        mode: mode,
        timerMinutes: timerMinutes,
        board: Array(15).fill(null).map(() => Array(15).fill(null)),
        tileBag: tileBag,
        players: [
          {
            id: hostPlayerId,
            name: hostName,
            color: PLAYER_PALETTE[0],
            score: 0,
            rack: hostRack,
            isBot: false,
            isHost: true,
            seatIndex: 0, // Position 0
            isOffline: false,
            socketId: socket.id,
            lastSeen: Date.now()
          }
        ],
        currentTurnIndex: 0,
        moveHistory: [
          {
            playerName: hostName,
            playerColor: PLAYER_PALETTE[0],
            action: 'CREATE',
            description: 'created room ' + inviteCode + (password ? ' (Password Protected)' : ''),
            score: 0,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ],
        stagedPositions: {},
        gameOver: false,
        createdAt: Date.now()
      };

      sessions.set(inviteCode, session);
      socket.join(inviteCode);
      socket.data = {
        inviteCode: inviteCode,
        playerId: hostPlayerId,
        playerName: hostName,
        isHost: true
      };

      console.log('[Room Created]', inviteCode, 'by', hostName, password ? '(Password Protected)' : '(Public)');

      socket.emit('room_created', {
        success: true,
        inviteCode: inviteCode,
        hasPassword: !!password,
        session: serializeSession(session),
        yourPlayerId: hostPlayerId
      });
    } catch (err) {
      console.error('[Error create_room]', err);
      socket.emit('error_feedback', { message: 'Failed to create room: ' + err.message });
    }
  });

  // Client joins a world with invite code & optional password
  socket.on('join_room', (data = {}) => {
    try {
      const inviteCode = (data.inviteCode || '').toUpperCase().trim();
      const password = data.password ? String(data.password).trim() : null;
      let playerName = (data.playerName || 'Guest Player').trim();
      const playerId = data.playerId || ('p_' + Math.random().toString(36).substring(2, 8));

      const session = sessions.get(inviteCode);
      if (!session) {
        socket.emit('join_error', {
          code: 'ROOM_NOT_FOUND',
          message: 'Room "' + inviteCode + '" does not exist. Please check your Invite Code.'
        });
        return;
      }

      // Verify password if protected
      if (session.hasPassword) {
        if (!password || password !== session.password) {
          socket.emit('join_error', {
            code: 'INVALID_PASSWORD',
            requiresPassword: true,
            message: !password ? 'This room is password-protected. Please enter password.' : 'Incorrect password.'
          });
          return;
        }
      }

      // Check if this player is reconnecting
      let player = session.players.find(p => p.id === playerId);
      if (player) {
        player.socketId = socket.id;
        player.isOffline = false;
        player.lastSeen = Date.now();
        if (playerName && !player.isHost) player.name = playerName;
      } else {
        // Room capacity check (1 to 10 players)
        if (session.players.length >= 10) {
          socket.emit('join_error', {
            code: 'ROOM_FULL',
            message: 'Room is full (Maximum 10 players).'
          });
          return;
        }

        // Disambiguate duplicate name
        const nameExists = session.players.some(p => p.name.toLowerCase() === playerName.toLowerCase());
        if (nameExists) {
          let c = 2;
          while (session.players.some(p => p.name.toLowerCase() === (playerName + ' ' + c).toLowerCase())) c++;
          playerName = playerName + ' ' + c;
        }

        const seatIndex = session.players.length; // Player position 0..9
        const rack = drawTiles(session.tileBag, 7);
        player = {
          id: playerId,
          name: playerName,
          color: PLAYER_PALETTE[seatIndex % PLAYER_PALETTE.length],
          score: 0,
          rack: rack,
          isBot: false,
          isHost: false,
          seatIndex: seatIndex,
          isOffline: false,
          socketId: socket.id,
          lastSeen: Date.now()
        };

        session.players.push(player);
        session.moveHistory.unshift({
          playerName: player.name,
          playerColor: player.color,
          action: 'JOIN',
          description: 'joined the room (Seat ' + (seatIndex + 1) + ')!',
          score: 0,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
      }

      socket.join(inviteCode);
      socket.data = {
        inviteCode: inviteCode,
        playerId: player.id,
        playerName: player.name,
        isHost: player.isHost
      };

      console.log('[Player Joined]', inviteCode, '->', player.name, '(Seat', player.seatIndex + 1 + ')');

      // Send confirmation and full state to joining player
      socket.emit('room_joined', {
        success: true,
        inviteCode: inviteCode,
        session: serializeSession(session),
        yourPlayerId: player.id
      });

      // Broadcast updated roster to other players in room
      socket.to(inviteCode).emit('player_joined', {
        player: {
          id: player.id,
          name: player.name,
          color: player.color,
          score: player.score,
          rackCount: player.rack.length,
          seatIndex: player.seatIndex,
          isBot: player.isBot,
          isHost: player.isHost,
          isOffline: false
        },
        session: serializeSession(session)
      });
      socket.to(inviteCode).emit('sync_state', serializeSession(session));
    } catch (err) {
      console.error('[Error join_room]', err);
      socket.emit('join_error', { code: 'SERVER_ERROR', message: err.message });
    }
  });

  // State synchronization for live player positions / staged board tiles
  socket.on('sync_player_positions', (data = {}) => {
    const inviteCode = data.inviteCode || (socket.data && socket.data.inviteCode);
    if (!inviteCode) return;
    const session = sessions.get(inviteCode);
    if (!session) return;

    const playerId = data.playerId || (socket.data && socket.data.playerId);
    if (data.stagedTiles) {
      session.stagedPositions[playerId] = data.stagedTiles;
    } else {
      delete session.stagedPositions[playerId];
    }

    // Broadcast live placement position to opponents in room
    socket.to(inviteCode).emit('remote_player_positions', {
      playerId: playerId,
      stagedTiles: data.stagedTiles || []
    });
  });

  // Player plays a word move
  socket.on('play_move', (data = {}) => {
    const inviteCode = data.inviteCode || (socket.data && socket.data.inviteCode);
    if (!inviteCode) return;
    const session = sessions.get(inviteCode);
    if (!session || session.gameOver) return;

    const playerId = data.playerId || (socket.data && socket.data.playerId);
    const player = session.players.find(p => p.id === playerId);
    if (!player) return;

    const newTiles = data.newTiles || [];
    // Apply tiles to session board
    for (const t of newTiles) {
      session.board[t.r][t.c] = {
        letter: t.letter,
        points: t.points,
        isBlank: !!t.isBlank,
        playedBy: player.id
      };
    }

    // Deduct tiles from rack
    for (const t of newTiles) {
      let idx = player.rack.findIndex(r => t.isBlank ? r.isBlank : r.letter === t.letter);
      if (idx === -1) idx = player.rack.findIndex(r => r.letter === t.letter);
      if (idx !== -1) player.rack.splice(idx, 1);
    }

    // Refill rack from bag
    const needed = 7 - player.rack.length;
    const drawn = drawTiles(session.tileBag, needed);
    player.rack.push(...drawn);

    const score = parseInt(data.totalScore) || 0;
    player.score += score;

    delete session.stagedPositions[playerId];

    const wordsStr = (data.wordsFormed || []).map(w => w.word + ' (' + w.points + ' pts)').join(', ');
    session.moveHistory.unshift({
      playerName: player.name,
      playerColor: player.color,
      action: 'PLAY',
      description: 'played ' + (wordsStr || (score + ' pts')) + (data.isBingo ? ' [BINGO!]' : ''),
      score: score,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    if (session.tileBag.length === 0 && player.rack.length === 0) {
      session.gameOver = true;
    } else {
      advanceTurn(session);
    }

    io.to(inviteCode).emit('move_played', {
      playerId: player.id,
      newTiles: newTiles,
      totalScore: score,
      isBingo: !!data.isBingo,
      session: serializeSession(session)
    });
    io.to(inviteCode).emit('sync_state', serializeSession(session));
  });

  // Pass turn
  socket.on('pass_turn', (data = {}) => {
    const inviteCode = data.inviteCode || (socket.data && socket.data.inviteCode);
    if (!inviteCode) return;
    const session = sessions.get(inviteCode);
    if (!session || session.gameOver) return;

    const playerId = data.playerId || (socket.data && socket.data.playerId);
    const player = session.players.find(p => p.id === playerId);
    if (player) {
      session.moveHistory.unshift({
        playerName: player.name,
        playerColor: player.color,
        action: 'PASS',
        description: 'passed their turn.',
        score: 0,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    }

    delete session.stagedPositions[playerId];
    advanceTurn(session);
    io.to(inviteCode).emit('turn_passed', { playerId: playerId, session: serializeSession(session) });
    io.to(inviteCode).emit('sync_state', serializeSession(session));
  });

  // Swap tiles
  socket.on('swap_tiles', (data = {}) => {
    const inviteCode = data.inviteCode || (socket.data && socket.data.inviteCode);
    if (!inviteCode) return;
    const session = sessions.get(inviteCode);
    if (!session || session.gameOver) return;

    const playerId = data.playerId || (socket.data && socket.data.playerId);
    const player = session.players.find(p => p.id === playerId);
    const indices = data.tileIndices || [];

    if (player && indices.length > 0 && session.tileBag.length >= 7) {
      const swapped = [];
      const sorted = [...indices].sort((a, b) => b - a);
      for (const idx of sorted) {
        if (idx >= 0 && idx < player.rack.length) {
          swapped.push(player.rack.splice(idx, 1)[0]);
        }
      }
      const drawn = drawTiles(session.tileBag, swapped.length);
      player.rack.push(...drawn);
      session.tileBag.push(...swapped);

      session.moveHistory.unshift({
        playerName: player.name,
        playerColor: player.color,
        action: 'SWAP',
        description: 'swapped ' + swapped.length + ' tiles.',
        score: 0,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });

      advanceTurn(session);
      io.to(inviteCode).emit('tiles_swapped', { playerId: player.id, count: swapped.length, session: serializeSession(session) });
      io.to(inviteCode).emit('sync_state', serializeSession(session));
    }
  });

  // Disconnect handler
  socket.on('disconnect', () => {
    console.log('[Socket.io] Client disconnected:', socket.id);
    if (!socket.data || !socket.data.inviteCode) return;

    const { inviteCode, playerId } = socket.data;
    const session = sessions.get(inviteCode);
    if (!session) return;

    const playerIndex = session.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return;

    const player = session.players[playerIndex];
    const isGameStarted = session.moveHistory.some(m => m.action === 'PLAY');

    if (!isGameStarted) {
      // In lobby: remove player from roster
      session.players.splice(playerIndex, 1);
      // Re-index seats
      session.players.forEach((p, idx) => { p.seatIndex = idx; });
      if (session.currentTurnIndex >= session.players.length) session.currentTurnIndex = 0;
    } else {
      // Active match: mark offline and advance turn if active
      player.isOffline = true;
      if (session.currentTurnIndex === playerIndex) {
        advanceTurn(session);
      }
    }

    session.moveHistory.unshift({
      playerName: player.name,
      playerColor: player.color,
      action: 'LEAVE',
      description: 'left the room.',
      score: 0,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    socket.to(inviteCode).emit('player_left', {
      playerId: playerId,
      playerName: player.name,
      session: serializeSession(session)
    });
    socket.to(inviteCode).emit('sync_state', serializeSession(session));
  });
});

// Start Server
server.listen(PORT, () => {
  console.log('=================================================');
  console.log('   Words with Friends / Scrabble Node.js Server');
  console.log('   Powered by Express & Socket.io (1-10 Players)');
  console.log('=================================================');
  console.log('Web Root:  ' + rootDir);
  console.log('Local URL: http://localhost:' + PORT + '/');
  console.log('Socket.io: Enabled on port ' + PORT);
  console.log('Press Ctrl+C to stop the server.\n');
});
