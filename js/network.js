// Multiplayer Network Transport Manager (WebSocket, BroadcastChannel, and Friend Code Rooms)
class NetworkManager {
  constructor(game) {
    this.game = game;
    this.ws = null;
    this.broadcast = null;
    this.roomCode = null;
    this.playerId = 'player_' + Math.random().toString(36).substring(2, 8);
    this.playerName = 'Player ' + Math.floor(1000 + Math.random() * 9000);
    this.isHost = false;
    this.connected = false;

    // Listen to BroadcastChannel for multi-tab testing in same browser
    if (typeof BroadcastChannel !== 'undefined') {
      this.broadcast = new BroadcastChannel('scrabble_wwf_channel');
      this.broadcast.onmessage = (e) => this.handleMessage(e.data);
    }
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
              playerName: this.playerName
            });
          }
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
    this.roomCode = (code || '').toUpperCase().trim();
    this.isHost = isHost;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendAction('ROOM_JOIN', {
        roomCode: this.roomCode,
        playerId: this.playerId,
        playerName: this.playerName,
        isHost: this.isHost
      });
    }
    // Also notify broadcast peers
    if (this.broadcast) {
      this.broadcast.postMessage({
        roomCode: this.roomCode,
        senderId: this.playerId,
        type: 'ROOM_JOIN',
        payload: {
          roomCode: this.roomCode,
          playerId: this.playerId,
          playerName: this.playerName,
          isHost: this.isHost
        }
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
    if (this.roomCode && msg.roomCode && msg.roomCode !== this.roomCode) return; // ignore other rooms

    console.log('[Network] Received action:', msg.type, msg.payload);

    if (this.game.onNetworkEvent) {
      this.game.onNetworkEvent(msg.type, msg.payload);
    }
  }
}
