// Multiplayer Network Transport Manager (Node.js + Socket.io, WebSocket fallback & BroadcastChannel)
class NetworkManager {
  constructor(game) {
    this.game = game;
    this.socket = null;
    this.ws = null;
    this.broadcast = null;
    this.roomCode = null;
    this.roomPassword = null;
    this.isHost = false;
    this.connected = false;

    this.onRoomCreated = null;
    this.onRoomJoined = null;
    this.onJoinError = null;

    // Use sessionStorage to preserve playerId across tab refresh, while giving new tabs unique IDs
    try {
      this.playerId = sessionStorage.getItem('wwf_session_player_id');
      if (!this.playerId) {
        this.playerId = 'player_' + Math.random().toString(36).substring(2, 8);
        sessionStorage.setItem('wwf_session_player_id', this.playerId);
      }
    } catch (e) {
      this.playerId = 'player_' + Math.random().toString(36).substring(2, 8);
    }

    this.playerName = 'Player ' + Math.floor(1000 + Math.random() * 9000);

    // Initialize Socket.io client if available
    this.initSocketIO();

    // Listen to BroadcastChannel for instant multi-tab sync in same browser
    if (typeof BroadcastChannel !== 'undefined') {
      this.broadcast = new BroadcastChannel('scrabble_wwf_channel');
      this.broadcast.onmessage = (e) => this.handleMessage(e.data);
    }

    // Notify peers when tab closes or navigates away
    const handleUnload = () => {
      if (this.roomCode && this.playerId) {
        this.sendAction('PLAYER_LEAVE', {
          roomCode: this.roomCode,
          playerId: this.playerId,
          playerName: this.playerName
        });
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);
  }

  initSocketIO() {
    if (typeof io === 'undefined') {
      console.warn('[Network] Socket.io client library not loaded, falling back to raw WS/Broadcast.');
      return;
    }

    try {
      this.socket = io({
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000
      });

      this.socket.on('connect', () => {
        this.connected = true;
        console.log('[Network] Socket.io connected to backend. Socket ID:', this.socket.id);
        if (this.roomCode) {
          if (this.isHost) {
            this.createRoomWithCode(this.roomCode, this.roomPassword);
          } else {
            this.joinRoomWithCode(this.roomCode, this.roomPassword, this.playerName);
          }
        }
      });

      this.socket.on('disconnect', (reason) => {
        this.connected = false;
        console.log('[Network] Socket.io disconnected:', reason);
      });

      this.socket.on('room_created', (data) => {
        console.log('[Network] Room created successfully:', data);
        if (this.onRoomCreated) this.onRoomCreated(data);
        if (data.session && this.game && this.game.applyFullState) {
          this.game.applyFullState(data.session);
        }
      });

      this.socket.on('room_joined', (data) => {
        console.log('[Network] Room joined successfully:', data);
        if (this.onRoomJoined) this.onRoomJoined(data);
        if (data.session && this.game && this.game.applyFullState) {
          this.game.applyFullState(data.session);
        }
      });

      this.socket.on('join_error', (data) => {
        console.warn('[Network] Join error:', data);
        if (this.onJoinError) {
          this.onJoinError(data);
        } else {
          alert('Join Error: ' + (data.message || 'Unable to join room'));
        }
      });

      this.socket.on('player_joined', (data) => {
        console.log('[Network] Another player joined:', data.player);
        if (data.session && this.game && this.game.applyFullState) {
          this.game.applyFullState(data.session);
        }
      });

      this.socket.on('player_left', (data) => {
        console.log('[Network] Player left:', data.playerName);
        if (data.session && this.game && this.game.applyFullState) {
          this.game.applyFullState(data.session);
        }
      });

      this.socket.on('sync_state', (state) => {
        if (state && this.game && this.game.applyFullState) {
          this.game.applyFullState(state);
        }
      });

      this.socket.on('move_played', (data) => {
        console.log('[Network] move_played received:', data);
        if (this.game) {
          if (this.game.remoteStagedPositions && data.playerId) {
            delete this.game.remoteStagedPositions[data.playerId];
            if (this.game.onRemoteStagedChange) {
              this.game.onRemoteStagedChange(this.game.remoteStagedPositions);
            }
          }
          if (data.session && this.game.applyFullState) {
            this.game.applyFullState(data.session);
          }
          if (data.isBingo) {
            AUDIO.playScoreFanfare(true);
          }
        }
      });

      this.socket.on('turn_passed', (data) => {
        if (data.session && this.game && this.game.applyFullState) {
          this.game.applyFullState(data.session);
        }
      });

      this.socket.on('tiles_swapped', (data) => {
        if (data.session && this.game && this.game.applyFullState) {
          this.game.applyFullState(data.session);
        }
      });

      this.socket.on('remote_player_positions', (data) => {
        if (this.game && this.game.onRemotePlayerPositions) {
          this.game.onRemotePlayerPositions(data);
        }
      });
    } catch (e) {
      console.warn('[Network] Socket.io init error:', e);
    }
  }

  // Host starts a world/room with invite code and optional password
  createRoomWithCode(inviteCode, password = null, options = {}) {
    this.roomCode = (inviteCode || '').toUpperCase().trim();
    this.roomPassword = password ? String(password).trim() : null;
    this.isHost = true;

    if (this.socket && this.socket.connected) {
      this.socket.emit('create_room', {
        inviteCode: this.roomCode,
        password: this.roomPassword,
        hostName: this.playerName,
        hostPlayerId: this.playerId,
        mode: options.mode || (this.game ? this.game.mode : 'WWF'),
        timerMinutes: options.timerMinutes || 0
      });
    }

    this.notifyLocalPeers('ROOM_JOIN', {
      roomCode: this.roomCode,
      playerId: this.playerId,
      playerName: this.playerName,
      isHost: true
    });
  }

  // Client connects to specific server instance using invite code and optional password
  joinRoomWithCode(inviteCode, password = null, playerName = this.playerName) {
    this.roomCode = (inviteCode || '').toUpperCase().trim();
    this.roomPassword = password ? String(password).trim() : null;
    if (playerName) this.playerName = playerName.trim();
    this.isHost = false;

    console.log('[Network] Attempting to join room:', this.roomCode, 'with password:', this.roomPassword ? '***' : 'none');

    if (this.socket && this.socket.connected) {
      this.socket.emit('join_room', {
        inviteCode: this.roomCode,
        password: this.roomPassword,
        playerName: this.playerName,
        playerId: this.playerId
      });
    } else {
      console.warn('[Network] Socket not connected yet, connecting...');
      this.initSocketIO();
    }

    this.notifyLocalPeers('ROOM_JOIN', {
      roomCode: this.roomCode,
      playerId: this.playerId,
      playerName: this.playerName,
      isHost: false
    });
    this.notifyLocalPeers('REQUEST_SYNC', {
      roomCode: this.roomCode,
      playerId: this.playerId
    });
  }

  // Synchronize player positions (staged tiles and cursor preview)
  syncPlayerPositions(stagedTiles = []) {
    if (this.socket && this.socket.connected && this.roomCode) {
      this.socket.emit('sync_player_positions', {
        inviteCode: this.roomCode,
        playerId: this.playerId,
        stagedTiles: stagedTiles
      });
    }
  }

  setRoomCode(code, isHost = false) {
    const newCode = (code || '').toUpperCase().trim();
    if (this.roomCode && this.roomCode !== newCode) {
      this.sendAction('PLAYER_LEAVE', {
        roomCode: this.roomCode,
        playerId: this.playerId,
        playerName: this.playerName
      });
    }
    this.roomCode = newCode;
    this.isHost = isHost;

    if (isHost) {
      this.createRoomWithCode(this.roomCode, this.roomPassword);
    } else {
      this.joinRoomWithCode(this.roomCode, this.roomPassword, this.playerName);
    }
  }

  sendAction(actionType, payload = {}) {
    if (this.socket && this.socket.connected && this.roomCode) {
      if (actionType === 'MOVE_PLAYED') {
        this.socket.emit('play_move', {
          inviteCode: this.roomCode,
          playerId: this.playerId,
          newTiles: payload.newTiles,
          totalScore: payload.totalScore,
          isBingo: payload.isBingo,
          wordsFormed: payload.wordsFormed
        });
      } else if (actionType === 'TURN_PASSED') {
        this.socket.emit('pass_turn', {
          inviteCode: this.roomCode,
          playerId: this.playerId
        });
      } else if (actionType === 'TILES_SWAPPED') {
        this.socket.emit('swap_tiles', {
          inviteCode: this.roomCode,
          playerId: this.playerId,
          tileIndices: payload.tileIndices || []
        });
      } else if (actionType === 'PLAYER_RENAME') {
        this.socket.emit('player_rename', {
          inviteCode: this.roomCode,
          playerId: this.playerId,
          newName: payload.newName
        });
      }
    }

    // BroadcastChannel local dispatch
    this.notifyLocalPeers(actionType, payload);
  }

  notifyLocalPeers(actionType, payload = {}) {
    if (!this.broadcast) return;
    this.broadcast.postMessage({
      roomCode: this.roomCode,
      senderId: this.playerId,
      type: actionType,
      payload: payload,
      timestamp: Date.now()
    });
  }

  handleMessage(msg) {
    if (!msg || msg.senderId === this.playerId) return; // ignore self
    const myRoom = (this.roomCode || '').toUpperCase().trim();
    const msgRoom = (msg.roomCode || '').toUpperCase().trim();
    if (myRoom && msgRoom && myRoom !== msgRoom) return;

    console.log('[BroadcastChannel] Action:', msg.type, msg.payload);
    if (this.game && this.game.onNetworkEvent) {
      this.game.onNetworkEvent(msg.type, msg.payload);
    }
  }

  // Connect WebSocket fallback
  connectWebSocket(serverUrl) {
    return Promise.resolve(true);
  }
}
