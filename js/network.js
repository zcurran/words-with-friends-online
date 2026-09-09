// Multiplayer Network Transport Manager (WebSocket, BroadcastChannel, and Friend Code Rooms)
class NetworkManager {
  constructor(game) {
    this.game = game;
    this.ws = null;
    this.broadcast = null;
    this.roomCode = null;
    this.isHost = false;
    this.connected = false;

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
    this.heartbeatInterval = null;

    // Listen to BroadcastChannel for instant multi-tab sync in same browser
    if (typeof BroadcastChannel !== 'undefined') {
      this.broadcast = new BroadcastChannel('scrabble_wwf_channel');
      this.broadcast.onmessage = (e) => this.handleMessage(e.data);
    }

    // Immediately notify peers when tab closes or navigates away
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

  // Connect to game WebSocket server
  connectWebSocket(serverUrl) {
    return new Promise((resolve) => {
      try {
        const protocol = location.protocol === 'https:' ? 'wss://' : 'ws://';
        const host = location.host || 'localhost:8080';
        const url = serverUrl || (protocol + host);
        
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          this.connected = true;
          console.log('[Network] Connected to game server:', url);
          if (this.roomCode) {
            this.sendAction('ROOM_JOIN', {
              roomCode: this.roomCode,
              playerId: this.playerId,
              playerName: this.playerName,
              isHost: this.isHost
            });
            this.sendAction('REQUEST_SYNC', {
              roomCode: this.roomCode,
              playerId: this.playerId
            });
          }

          // Start 15-second heartbeat
          if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
          this.heartbeatInterval = setInterval(() => {
            if (this.roomCode && this.connected) {
              this.sendAction('HEARTBEAT', {
                roomCode: this.roomCode,
                playerId: this.playerId,
                playerName: this.playerName
              });
            }
          }, 15000);

          resolve(true);
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (e) {
            console.error('[Network] Bad WS message JSON:', e);
          }
        };

        this.ws.onerror = (err) => {
          console.warn('[Network] WebSocket connection failed:', err);
          resolve(false);
        };

        this.ws.onclose = () => {
          this.connected = false;
          console.log('[Network] WebSocket disconnected.');
        };
      } catch (e) {
        resolve(false);
      }
    });
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
    const joinPayload = {
      roomCode: this.roomCode,
      playerId: this.playerId,
      playerName: this.playerName,
      isHost: this.isHost
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendAction('ROOM_JOIN', joinPayload);
      this.sendAction('REQUEST_SYNC', { roomCode: this.roomCode, playerId: this.playerId });
    }
    // Also notify broadcast peers
    if (this.broadcast) {
      this.broadcast.postMessage({
        roomCode: this.roomCode,
        senderId: this.playerId,
        type: 'ROOM_JOIN',
        payload: joinPayload
      });
      this.broadcast.postMessage({
        roomCode: this.roomCode,
        senderId: this.playerId,
        type: 'REQUEST_SYNC',
        payload: { roomCode: this.roomCode, playerId: this.playerId }
      });
    }
  }

  sendAction(actionType, payload = {}) {
    const msg = {
      roomCode: this.roomCode,
      senderId: this.playerId,
      type: actionType,
      payload: payload,
      timestamp: Date.now()
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }

    if (this.broadcast) {
      this.broadcast.postMessage(msg);
    }
  }

  handleMessage(msg) {
    if (!msg || msg.senderId === this.playerId) return; // ignore self
    const myRoom = (this.roomCode || '').toUpperCase().trim();
    const msgRoom = (msg.roomCode || '').toUpperCase().trim();
    if (myRoom && msgRoom && myRoom !== msgRoom) return; // ignore other rooms

    console.log('[Network] Received action:', msg.type, msg.payload);

    if (this.game.onNetworkEvent) {
      this.game.onNetworkEvent(msg.type, msg.payload);
    }
  }
}
