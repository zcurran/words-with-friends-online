// Main Web App Controller: UI Bindings, Modals, Lobby with Friend Code, and Event Handling
document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Game Engine immediately
  const game = new ScrabbleGame();

  const elements = {
    boardEl: document.getElementById('scrabble-board'),
    rackEl: document.getElementById('rack-tiles'),
    previewEl: document.getElementById('score-preview'),
    playBtn: document.getElementById('btn-play'),
    shuffleBtn: document.getElementById('btn-shuffle'),
    recallBtn: document.getElementById('btn-recall'),
    swapBtn: document.getElementById('btn-swap'),
    passBtn: document.getElementById('btn-pass'),
    peekerBtn: document.getElementById('btn-peeker'),
    soundBtn: document.getElementById('btn-sound'),
    newGameBtn: document.getElementById('btn-new-game'),
    openLobbyBtn: document.getElementById('btn-open-lobby'),
    copyInviteBtn: document.getElementById('btn-copy-invite'),
    headerRoomCode: document.getElementById('header-room-code'),
    playersListEl: document.getElementById('players-scoreboard'),
    historyListEl: document.getElementById('move-history-list'),
    bagCountEl: document.getElementById('bag-count'),
    timerBadgeEl: document.getElementById('turn-timer-badge'),
    modeDisplayEl: document.getElementById('mode-display')
  };

  const boardCtrl = new BoardController(game, elements);

  // 2. Room & Player Name State (Persistent across refreshes)
  let localPlayerName = localStorage.getItem('wwf_player_name');

  // Check URL params for ?room=CODE first
  const urlParams = new URLSearchParams(window.location.search);
  const roomParam = urlParams.get('room');

  // Check stored room code from localStorage, but keep isHost in sessionStorage per tab!
  const storedRoom = localStorage.getItem('wwf_room_code');
  const storedIsHost = sessionStorage.getItem('wwf_is_host');

  let currentRoomCode = '';
  let isHost = true;

  if (roomParam) {
    // User arrived via room invite link or persistent URL
    currentRoomCode = roomParam.toUpperCase().trim();
    isHost = (storedRoom === currentRoomCode && storedIsHost === 'true');
  } else if (storedRoom) {
    // User refreshed page without query param - reuse existing room code!
    currentRoomCode = storedRoom.toUpperCase().trim();
    isHost = (storedIsHost !== 'false');
  } else {
    // Fresh new session - generate initial friend code
    currentRoomCode = 'WWF-' + Math.floor(1000 + Math.random() * 9000);
    isHost = true;
    sessionStorage.setItem('wwf_is_host', 'true');
  }

  if (!localPlayerName) {
    localPlayerName = isHost ? 'Player 1' : 'Player 2';
  } else if (!isHost && localPlayerName === 'Player 1') {
    localPlayerName = 'Player 2';
  }

  let lobbyPlayers = [
    { id: game.network.playerId, name: localPlayerName, isBot: false, isHost: isHost }
  ];

  function updateHeaderName(name) {
    const headerNameEl = document.getElementById('header-player-name');
    if (headerNameEl) headerNameEl.innerText = name;
    const joinNameInp = document.getElementById('join-name-input');
    if (joinNameInp) joinNameInp.value = name;
  }
  updateHeaderName(localPlayerName);

  // Update header and lobby UI with room code and synchronize with URL and localStorage
  function updateRoomUI(code, asHost = isHost, hasPassword = false) {
    currentRoomCode = code;
    isHost = asHost;
    localStorage.setItem('wwf_room_code', code);
    sessionStorage.setItem('wwf_is_host', isHost ? 'true' : 'false');

    if (elements.headerRoomCode) elements.headerRoomCode.innerText = code;
    const lobbyCodeEl = document.getElementById('lobby-friend-code');
    if (lobbyCodeEl) lobbyCodeEl.innerText = code;

    const lockBadge = document.getElementById('header-lock-badge');
    if (lockBadge) lockBadge.style.display = hasPassword ? 'inline' : 'none';

    // Keep URL parameter ?room=CODE updated in address bar so browser refresh retains room
    try {
      const currentUrl = new URL(window.location.href);
      if (currentUrl.searchParams.get('room') !== code) {
        currentUrl.searchParams.set('room', code);
        window.history.replaceState({}, '', currentUrl.pathname + currentUrl.search);
      }
    } catch (err) {}

    // Save this room in the My Games registry
    saveRoomToRegistry(code, hasPassword);
    renderMyGamesList();
  }
  updateRoomUI(currentRoomCode, isHost);

  // Connect network
  game.network.playerName = localPlayerName;
  game.network.setRoomCode(currentRoomCode, isHost);
  game.network.connectWebSocket();

  // ── My Games Room Switcher ────────────────────────────────────────────────
  // Registry: array of { code, label, lastActive, hasPassword }
  function loadRoomRegistry() {
    try { return JSON.parse(localStorage.getItem('wwf_my_rooms') || '[]'); } catch { return []; }
  }
  function saveRoomRegistry(rooms) {
    localStorage.setItem('wwf_my_rooms', JSON.stringify(rooms));
  }
  function saveRoomToRegistry(code, hasPassword = false) {
    if (!code || code === 'LOCAL') return;
    const rooms = loadRoomRegistry();
    const existing = rooms.find(r => r.code === code);
    if (existing) {
      existing.lastActive = Date.now();
      existing.hasPassword = hasPassword;
    } else {
      rooms.push({ code, label: code, lastActive: Date.now(), hasPassword: !!hasPassword });
    }
    // Keep most recent 20 rooms max
    rooms.sort((a, b) => b.lastActive - a.lastActive);
    saveRoomRegistry(rooms.slice(0, 20));
    updateMyGamesBadge();
  }
  function removeRoomFromRegistry(code) {
    const rooms = loadRoomRegistry().filter(r => r.code !== code);
    saveRoomRegistry(rooms);
    updateMyGamesBadge();
    renderMyGamesList();
  }
  function updateMyGamesBadge() {
    const badge = document.getElementById('my-games-badge');
    const rooms = loadRoomRegistry();
    if (!badge) return;
    if (rooms.length > 0) {
      badge.style.display = 'inline';
      badge.innerText = rooms.length;
    } else {
      badge.style.display = 'none';
    }
  }

  function switchToRoom(code) {
    const panel = document.getElementById('my-games-panel');
    if (panel) panel.style.display = 'none';
    const name = localPlayerName;
    updateRoomUI(code, false);
    game.network.playerName = name;
    game.network.joinRoomWithCode(code, null, name);
    // Reset board to clean slate for the switched room
    boardCtrl.recallAll();
  }

  function renderMyGamesList() {
    const container = document.getElementById('my-games-list');
    if (!container) return;
    const rooms = loadRoomRegistry();
    updateMyGamesBadge();
    container.innerHTML = '';

    if (rooms.length === 0) {
      container.innerHTML = '<p style="color:#64748b; font-size:13px; text-align:center; padding:20px 0;">No saved rooms yet.<br>Create or join a room to see it here.</p>';
      return;
    }

    rooms.forEach(room => {
      const isActive = room.code === currentRoomCode;
      const card = document.createElement('div');
      card.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:12px 14px; border-radius:10px; border:1px solid ' + (isActive ? 'rgba(255,152,0,0.6)' : 'rgba(255,255,255,0.08)') + '; background:' + (isActive ? 'rgba(255,152,0,0.1)' : 'rgba(255,255,255,0.03)') + '; transition:all 0.2s;';

      const left = document.createElement('div');
      left.style.cssText = 'display:flex; flex-direction:column; gap:3px;';
      left.innerHTML =
        '<span style="font-weight:800; font-size:14px; color:' + (isActive ? '#ffd54f' : '#e2e8f0') + ';">' +
          (room.hasPassword ? '🔒 ' : '') + room.code +
        '</span>' +
        '<span style="font-size:11px; color:#64748b;">' +
          (isActive ? '● Active now' : 'Last: ' + new Date(room.lastActive).toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })) +
        '</span>';

      const right = document.createElement('div');
      right.style.cssText = 'display:flex; gap:8px; align-items:center;';

      if (!isActive) {
        const switchBtn = document.createElement('button');
        switchBtn.innerText = '▶ Switch';
        switchBtn.style.cssText = 'padding:6px 14px; border-radius:6px; background:linear-gradient(135deg,#0284c7,#0369a1); border:none; color:#fff; font-weight:700; font-size:12px; cursor:pointer;';
        switchBtn.onclick = () => switchToRoom(room.code);
        right.appendChild(switchBtn);
      } else {
        const activePill = document.createElement('span');
        activePill.innerText = '✓ Here';
        activePill.style.cssText = 'padding:4px 10px; border-radius:6px; background:rgba(34,197,94,0.2); color:#4ade80; font-size:11px; font-weight:700;';
        right.appendChild(activePill);
      }

      const copyBtn = document.createElement('button');
      copyBtn.title = 'Copy invite link';
      copyBtn.innerText = '🔗';
      copyBtn.style.cssText = 'padding:6px 8px; border-radius:6px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.1); color:#94a3b8; font-size:12px; cursor:pointer;';
      copyBtn.onclick = () => {
        const url = window.location.origin + window.location.pathname + '?room=' + room.code;
        navigator.clipboard.writeText(url).then(() => alert('Invite link copied!\n' + url)).catch(() => prompt('Copy:', url));
      };
      right.appendChild(copyBtn);

      const removeBtn = document.createElement('button');
      removeBtn.title = 'Remove from list';
      removeBtn.innerText = '✕';
      removeBtn.style.cssText = 'padding:6px 8px; border-radius:6px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.25); color:#ef4444; font-size:12px; cursor:pointer;';
      removeBtn.onclick = () => removeRoomFromRegistry(room.code);
      right.appendChild(removeBtn);

      card.appendChild(left);
      card.appendChild(right);
      container.appendChild(card);
    });
  }

  // Wire up My Games panel toggle
  const btnMyGames = document.getElementById('btn-my-games');
  const myGamesPanel = document.getElementById('my-games-panel');
  const btnCloseMyGames = document.getElementById('btn-close-my-games');
  const btnMyGamesNewRoom = document.getElementById('btn-my-games-new-room');

  if (btnMyGames) {
    btnMyGames.onclick = () => {
      renderMyGamesList();
      if (myGamesPanel) myGamesPanel.style.display = myGamesPanel.style.display === 'none' ? 'block' : 'none';
    };
  }
  if (btnCloseMyGames) btnCloseMyGames.onclick = () => { if (myGamesPanel) myGamesPanel.style.display = 'none'; };
  if (btnMyGamesNewRoom) {
    btnMyGamesNewRoom.onclick = () => {
      if (myGamesPanel) myGamesPanel.style.display = 'none';
      openLobbyModal();
      setTab('create');
      const newCode = 'WWF-' + Math.floor(1000 + Math.random() * 9000);
      updateRoomUI(newCode, true);
    };
  }

  // Close panel when clicking outside of it
  document.addEventListener('click', (e) => {
    if (myGamesPanel && myGamesPanel.style.display !== 'none') {
      if (!myGamesPanel.contains(e.target) && e.target !== btnMyGames && !btnMyGames.contains(e.target)) {
        myGamesPanel.style.display = 'none';
      }
    }
  });

  // Initialize badge on load
  updateMyGamesBadge();
  // ─────────────────────────────────────────────────────────────────────────



  // 3. Render functions
  const playerPalette = [
    '#ff9800', '#2196f3', '#4caf50', '#e91e63', '#9c27b0',
    '#00bcd4', '#ff5722', '#8bc34a', '#3f51b5', '#e040fb'
  ];

  function renderScoreboard(gameState) {
    const playersListEl = elements.playersListEl;
    if (!playersListEl) return;
    playersListEl.innerHTML = '';

    const activeCount = gameState.players.filter(p => !p.isOffline).length;
    const countIndicator = document.getElementById('player-count-indicator');
    if (countIndicator) {
      countIndicator.innerText = activeCount === 1 ? '1 Player' : (activeCount + ' Players');
    }

    const localPlayer = game.getLocalPlayer ? game.getLocalPlayer() : null;

    gameState.players.forEach((p, idx) => {
      const isCurrent = idx === gameState.currentTurnIndex;
      const isLocal = localPlayer ? (p.id === localPlayer.id) : ((idx === 0 && !p.isBot) || (game.network && game.network.playerName && p.name.toLowerCase() === game.network.playerName.toLowerCase()));
      const card = document.createElement('div');
      card.className = 'player-card' + (isCurrent ? ' active-turn' : '') + (p.isOffline ? ' player-offline' : '');
      card.style.borderColor = p.color;
      if (p.isOffline) card.style.opacity = '0.55';

      card.innerHTML = 
        '<div class="player-avatar" style="background-color: ' + p.color + '">' +
          p.name.charAt(0).toUpperCase() +
        '</div>' +
        '<div class="player-info">' +
          '<div class="player-name-row">' +
            '<span class="player-name">' + p.name + '</span>' +
            (isLocal ? '<button class="edit-name-inline-btn" title="Edit your name" data-player-id="' + p.id + '">✏️</button>' : '') +
            (p.isBot ? '<span class="bot-badge">BOT</span>' : '') +
            (p.isOffline ? '<span class="offline-badge">OFFLINE</span>' : '') +
            (isCurrent && !p.isOffline ? '<span class="turn-badge">TURN</span>' : '') +
          '</div>' +
          '<div class="player-stats">' +
            '<span class="player-score"><strong>' + p.score + '</strong> pts</span>' +
            '<span class="player-rack-count">🀄 ' + p.rack.length + '</span>' +
          '</div>' +
        '</div>';
      
      const editBtn = card.querySelector('.edit-name-inline-btn');
      if (editBtn) {
        editBtn.onclick = (e) => {
          e.stopPropagation();
          openNameModal();
        };
      }

      playersListEl.appendChild(card);
    });

    // Synchronize lobby players with active game roster
    lobbyPlayers = gameState.players.map((p, i) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      isBot: p.isBot,
      isHost: i === 0,
      isOffline: !!p.isOffline
    }));
    renderLobbyRoster();
  }

  function renderMoveHistory(gameState) {
    const historyListEl = elements.historyListEl;
    if (!historyListEl) return;
    historyListEl.innerHTML = '';

    gameState.moveHistory.slice(0, 15).forEach((item) => {
      const li = document.createElement('li');
      li.className = 'history-item';
      li.innerHTML = 
        '<span class="history-time">' + item.timestamp + '</span>' +
        '<strong style="color: ' + item.playerColor + '">' + item.playerName + '</strong>: ' +
        '<span>' + item.description + '</span>';
      historyListEl.appendChild(li);
    });
  }

  function renderLobbyRoster() {
    const container = document.getElementById('lobby-connected-players');
    const countEl = document.getElementById('lobby-player-count');
    const botStatusLabel = document.getElementById('bot-status-label');
    const btnRemoveBot = document.getElementById('btn-lobby-remove-bot');
    if (!container) return;
    container.innerHTML = '';
    const activeLobbyCount = lobbyPlayers.filter(p => !p.isOffline).length;
    if (countEl) countEl.innerText = activeLobbyCount;

    const botCount = lobbyPlayers.filter(p => p.isBot).length;
    if (botStatusLabel) {
      botStatusLabel.innerText = botCount === 0 ? 'None (0 added)' : (botCount + ' bot' + (botCount > 1 ? 's' : '') + ' added');
    }
    if (btnRemoveBot) {
      btnRemoveBot.disabled = (botCount === 0);
      btnRemoveBot.style.background = botCount > 0 ? '#ef4444' : '#475569';
      btnRemoveBot.style.color = botCount > 0 ? '#fff' : '#94a3b8';
      btnRemoveBot.style.cursor = botCount > 0 ? 'pointer' : 'default';
    }

    lobbyPlayers.forEach((p, i) => {
      const item = document.createElement('div');
      item.className = 'lobby-player-item';
      if (p.isOffline) item.style.opacity = '0.55';

      const leftCol = document.createElement('div');
      leftCol.style.display = 'flex';
      leftCol.style.alignItems = 'center';
      leftCol.style.gap = '8px';

      const avatarColor = p.color || playerPalette[i % playerPalette.length] || (p.isBot ? '#7c3aed' : (p.isHost ? '#ff9800' : '#2196f3'));
      const avatar = document.createElement('span');
      avatar.style.width = '24px';
      avatar.style.height = '24px';
      avatar.style.borderRadius = '50%';
      avatar.style.background = avatarColor;
      avatar.style.color = '#fff';
      avatar.style.fontSize = '12px';
      avatar.style.fontWeight = '800';
      avatar.style.display = 'inline-flex';
      avatar.style.alignItems = 'center';
      avatar.style.justifyContent = 'center';
      avatar.innerText = p.isBot ? '🤖' : (p.name || 'P').charAt(0).toUpperCase();
      leftCol.appendChild(avatar);

      const nameSpan = document.createElement('span');
      nameSpan.innerHTML = '<strong>' + p.name + '</strong>' + 
        (p.isHost ? ' <span style="color:#ff9800; font-size:11px; font-weight:700;">(Host)</span>' : '') +
        (p.isBot ? ' <span class="bot-badge">BOT</span>' : '') +
        (p.isOffline ? ' <span class="offline-badge">OFFLINE</span>' : '');
      leftCol.appendChild(nameSpan);

      item.appendChild(leftCol);

      const rightCol = document.createElement('div');
      rightCol.style.display = 'flex';
      rightCol.style.alignItems = 'center';
      rightCol.style.gap = '8px';

      if (p.isBot) {
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'action-btn';
        removeBtn.style.background = 'rgba(239, 68, 68, 0.2)';
        removeBtn.style.color = '#ef4444';
        removeBtn.style.border = '1px solid rgba(239, 68, 68, 0.4)';
        removeBtn.style.fontSize = '11px';
        removeBtn.style.padding = '2px 8px';
        removeBtn.style.borderRadius = '4px';
        removeBtn.innerText = '✕ Remove';
        removeBtn.onclick = (e) => {
          e.stopPropagation();
          lobbyPlayers.splice(i, 1);
          renderLobbyRoster();
        };
        rightCol.appendChild(removeBtn);
      } else if (p.isOffline) {
        const offlineBadge = document.createElement('span');
        offlineBadge.style.color = '#94a3b8';
        offlineBadge.style.fontSize = '11px';
        offlineBadge.innerText = 'Offline';
        rightCol.appendChild(offlineBadge);
      } else {
        const readyBadge = document.createElement('span');
        readyBadge.className = 'lobby-player-ready';
        readyBadge.innerText = '✓ Ready';
        rightCol.appendChild(readyBadge);
      }

      item.appendChild(rightCol);
      container.appendChild(item);
    });
  }

  // 4. Game State Updates -> UI Refresh
  game.onStateChange = (gameState) => {
    boardCtrl.renderBoard();
    boardCtrl.renderRack();
    renderScoreboard(gameState);
    renderMoveHistory(gameState);

    if (elements.bagCountEl) {
      elements.bagCountEl.innerText = gameState.tileBag.length;
    }

    if (elements.modeDisplayEl) {
      const N = gameState.boardSize || 15;
      elements.modeDisplayEl.innerText = gameState.mode + ' ' + N + '×' + N;
    }

    if (elements.timerBadgeEl) {
      if (gameState.timeRemaining > 0) {
        const m = Math.floor(gameState.timeRemaining / 60);
        const s = gameState.timeRemaining % 60;
        elements.timerBadgeEl.innerText = '⏱ ' + m + ':' + (s < 10 ? '0' : '') + s;
        elements.timerBadgeEl.style.display = 'inline-block';
      } else {
        elements.timerBadgeEl.style.display = 'none';
      }
    }

    if (gameState.gameOver) {
      showGameOverModal(gameState);
    }
  };

  // Handle remote player joining or leaving lobby
  game.onLobbyUpdate = (payload) => {
    if (!payload) return;
    if (payload.type === 'LEAVE' && payload.playerId) {
      lobbyPlayers = lobbyPlayers.filter(p => p.id !== payload.playerId);
      renderLobbyRoster();
      return;
    }
    if (payload.playerName) {
      const exists = lobbyPlayers.some(p => (payload.playerId && p.id === payload.playerId) || p.name.toLowerCase() === payload.playerName.toLowerCase());
      if (!exists && lobbyPlayers.length < 10) {
        lobbyPlayers.push({
          id: payload.playerId,
          name: payload.playerName,
          isBot: false,
          isHost: !!payload.isHost,
          isOffline: false
        });
        renderLobbyRoster();
      }
    }
  };

  // 5. Action Button Listeners
  elements.playBtn.onclick = () => boardCtrl.submitStagedMove();
  elements.shuffleBtn.onclick = () => game.shuffleRack();
  elements.recallBtn.onclick = () => boardCtrl.recallAll();

  elements.passBtn.onclick = () => {
    if (confirm('Are you sure you want to pass your turn?')) {
      boardCtrl.recallAll();
      game.passTurn();
    }
  };

  elements.swapBtn.onclick = () => {
    boardCtrl.recallAll();
    openSwapModal(game);
  };

  elements.peekerBtn.onclick = () => openTilePeekerModal(game);

  elements.soundBtn.onclick = () => {
    const on = AUDIO.toggleMute();
    elements.soundBtn.innerText = on ? '🔊 Sound: ON' : '🔇 Sound: OFF';
  };

  const volumeSlider = document.getElementById('volume-slider');
  if (volumeSlider) {
    // Initialize slider value from persistent audio state
    volumeSlider.value = AUDIO.getVolume();
    volumeSlider.addEventListener('input', (e) => {
      AUDIO.setVolume(parseFloat(e.target.value));
    });
  }

  // Open Lobby
  elements.newGameBtn.onclick = () => openLobbyModal();
  elements.openLobbyBtn.onclick = () => openLobbyModal();

  // Copy invite link
  function copyInviteLink() {
    const url = window.location.origin + window.location.pathname + '?room=' + currentRoomCode;
    navigator.clipboard.writeText(url).then(() => {
      alert('Invite link copied to clipboard!\n\n' + url);
    }).catch(() => {
      prompt('Copy this invite link:', url);
    });
  }

  elements.copyInviteBtn.onclick = copyInviteLink;
  const btnCopyLobby = document.getElementById('btn-copy-lobby-link');
  if (btnCopyLobby) btnCopyLobby.onclick = copyInviteLink;

  const btnCopyCode = document.getElementById('btn-copy-code');
  if (btnCopyCode) {
    btnCopyCode.onclick = () => {
      navigator.clipboard.writeText(currentRoomCode).then(() => {
        alert('Friend Code copied: ' + currentRoomCode);
      }).catch(() => {
        prompt('Copy Friend Code:', currentRoomCode);
      });
    };
  }

  const btnNewRoomCode = document.getElementById('btn-new-room-code');
  if (btnNewRoomCode) {
    btnNewRoomCode.onclick = () => {
      const newCode = 'WWF-' + Math.floor(1000 + Math.random() * 9000);
      updateRoomUI(newCode, true);
      game.network.setRoomCode(newCode, true);
      alert('New Friend Code generated: ' + newCode + '\nThis room code will be saved and retained across refreshes.');
    };
  }

  // 6. Lobby Modal Management
  function openLobbyModal() {
    renderLobbyRoster();
    const modal = document.getElementById('lobby-modal');
    if (modal) modal.classList.remove('hidden');
  }

  // Lobby Tabs Switching
  const tabBtnCreate = document.getElementById('tab-btn-create');
  const tabBtnJoin = document.getElementById('tab-btn-join');
  const tabBtnLocal = document.getElementById('tab-btn-local');

  const tabContentCreate = document.getElementById('tab-content-create');
  const tabContentJoin = document.getElementById('tab-content-join');
  const tabContentLocal = document.getElementById('tab-content-local');

  function setTab(activeTab) {
    [tabBtnCreate, tabBtnJoin, tabBtnLocal].forEach(b => b && b.classList.remove('active'));
    [tabContentCreate, tabContentJoin, tabContentLocal].forEach(c => c && c.classList.add('hidden'));

    if (activeTab === 'create') {
      if (tabBtnCreate) tabBtnCreate.classList.add('active');
      if (tabContentCreate) tabContentCreate.classList.remove('hidden');
    } else if (activeTab === 'join') {
      if (tabBtnJoin) tabBtnJoin.classList.add('active');
      if (tabContentJoin) tabContentJoin.classList.remove('hidden');
    } else if (activeTab === 'local') {
      if (tabBtnLocal) tabBtnLocal.classList.add('active');
      if (tabContentLocal) tabContentLocal.classList.remove('hidden');
      renderLocalPlayerRows();
    }
  }

  if (tabBtnCreate) tabBtnCreate.onclick = () => setTab('create');
  if (tabBtnJoin) tabBtnJoin.onclick = () => setTab('join');
  if (tabBtnLocal) tabBtnLocal.onclick = () => setTab('local');

  // If URL had room param, prefill Join tab input
  if (roomParam) {
    setTab('join');
    const joinInput = document.getElementById('join-code-input');
    if (joinInput) joinInput.value = roomParam;
  }

  // Add bot button in lobby (Strictly opt-in)
  const btnAddBot = document.getElementById('btn-lobby-add-bot');
  if (btnAddBot) {
    btnAddBot.onclick = () => {
      if (lobbyPlayers.length >= 10) {
        alert('Maximum of 10 players allowed.');
        return;
      }
      const botNum = lobbyPlayers.filter(p => p.isBot).length + 1;
      lobbyPlayers.push({
        name: 'WordBot ' + botNum,
        isBot: true,
        botLevel: 'medium'
      });
      renderLobbyRoster();
    };
  }

  // Remove bot button in lobby
  const btnRemoveBot = document.getElementById('btn-lobby-remove-bot');
  if (btnRemoveBot) {
    btnRemoveBot.onclick = () => {
      const lastBotIndex = lobbyPlayers.map(p => p.isBot).lastIndexOf(true);
      if (lastBotIndex !== -1) {
        lobbyPlayers.splice(lastBotIndex, 1);
        renderLobbyRoster();
      }
    };
  }

  // Client-side function that allows a player to enter an invite code to connect to the specific server instance
  window.joinRoomWithCode = function(inviteCode, password = null, playerName = null) {
    if (!inviteCode) {
      alert('Please provide a valid room code.');
      return;
    }
    const cleanCode = inviteCode.toUpperCase().trim();
    const name = (playerName || localPlayerName || 'Guest Player').trim();
    localPlayerName = name;
    localStorage.setItem('wwf_player_name', name);
    updateHeaderName(name);
    updateRoomUI(cleanCode, false);
    game.network.playerName = name;
    game.network.joinRoomWithCode(cleanCode, password, name);
    const modal = document.getElementById('lobby-modal');
    if (modal) modal.classList.add('hidden');
  };

  // Start Room Match (Host) - creates world on server with invite code and optional password
  const btnStartLobby = document.getElementById('btn-lobby-start-game');
  if (btnStartLobby) {
    btnStartLobby.onclick = () => {
      const modeRadio = document.querySelector('input[name="lobby-game-mode"]:checked');
      const mode = modeRadio ? modeRadio.value : 'WWF';
      const timerSelect = document.getElementById('lobby-timer-select');
      const timerVal = timerSelect ? parseInt(timerSelect.value) : 0;
      const passInp = document.getElementById('lobby-password-input');
      const password = passInp ? passInp.value.trim() : null;
      const boardSizeSelect = document.getElementById('lobby-board-size-select');
      const boardSize = boardSizeSelect ? parseInt(boardSizeSelect.value) : 15;

      updateRoomUI(currentRoomCode, true, !!password);
      document.getElementById('lobby-modal').classList.add('hidden');
      game.network.createRoomWithCode(currentRoomCode, password, { mode, timerMinutes: timerVal });
      game.startNewGame({
        playerConfigs: lobbyPlayers,
        mode: mode,
        timerMinutes: timerVal,
        boardSize: boardSize
      });
    };
  }

  // Join Room with Code
  const btnSubmitJoin = document.getElementById('btn-submit-join');
  if (btnSubmitJoin) {
    btnSubmitJoin.onclick = () => {
      const codeInput = document.getElementById('join-code-input');
      const nameInput = document.getElementById('join-name-input');
      const passInput = document.getElementById('join-password-input');
      const code = (codeInput ? codeInput.value : '').toUpperCase().trim();
      const name = (nameInput ? nameInput.value : '').trim() || 'Guest Player';
      const password = passInput ? passInput.value.trim() : null;

      if (!code) {
        alert('Please enter a valid Friend Code.');
        return;
      }

      window.joinRoomWithCode(code, password, name);
    };
  }

  // Network event callbacks
  game.network.onRoomCreated = (data) => {
    updateRoomUI(data.inviteCode, true, data.hasPassword);
  };

  game.network.onRoomJoined = (data) => {
    updateRoomUI(data.inviteCode, false, data.session && data.session.hasPassword);
  };

  game.network.onJoinError = (data) => {
    if (data.code === 'INVALID_PASSWORD') {
      const promptPass = prompt((data.message || 'Password required') + '\\n\\nPlease enter room password:');
      if (promptPass !== null) {
        window.joinRoomWithCode(currentRoomCode, promptPass, localPlayerName);
      } else {
        openLobbyModal();
      }
    } else {
      alert(data.message || 'Unable to join room.');
      openLobbyModal();
    }
  };

  // Real-time synchronization of placed uncommitted tile positions
  boardCtrl.onStagedChanged = (stagedList) => {
    game.network.syncPlayerPositions(stagedList);
  };

  // Re-render board immediately when remote opponent stages or modifies tiles
  game.onRemoteStagedChange = () => {
    boardCtrl.renderBoard();
  };

  // Local Pass & Play Roster Generation
  function renderLocalPlayerRows() {
    const select = document.getElementById('local-player-count-select');
    const container = document.getElementById('local-player-rows');
    if (!select || !container) return;
    const count = parseInt(select.value);
    container.innerHTML = '';

    for (let i = 1; i <= count; i++) {
      const row = document.createElement('div');
      row.className = 'player-config-row';
      const defaultName = (i === 1) ? localPlayerName : ('Player ' + i);
      row.innerHTML = 
        '<input type="text" class="form-input" id="local-name-' + i + '" value="' + defaultName + '" placeholder="Player ' + i + '">' +
        (count > 1 ? (
          '<label style="font-size: 12px; display: flex; align-items: center; gap: 4px; color: #94a3b8; cursor: pointer; white-space: nowrap;">' +
            '<input type="checkbox" id="local-bot-' + i + '"> AI Bot' +
          '</label>'
        ) : '');
      container.appendChild(row);
    }
  }

  const localSelect = document.getElementById('local-player-count-select');
  if (localSelect) localSelect.onchange = renderLocalPlayerRows;

  const btnStartLocal = document.getElementById('btn-start-local-game');
  if (btnStartLocal) {
    btnStartLocal.onclick = () => {
      const select = document.getElementById('local-player-count-select');
      const count = select ? parseInt(select.value) : 2;
      const boardSizeSelect = document.getElementById('local-board-size-select');
      const boardSize = boardSizeSelect ? parseInt(boardSizeSelect.value) : 15;
      const configs = [];

      for (let i = 1; i <= count; i++) {
        const nameInp = document.getElementById('local-name-' + i);
        const botCheck = document.getElementById('local-bot-' + i);
        configs.push({
          name: nameInp ? nameInp.value.trim() || ('Player ' + i) : ('Player ' + i),
          isBot: botCheck ? botCheck.checked : false,
          botLevel: 'medium'
        });
      }

      document.getElementById('lobby-modal').classList.add('hidden');
      game.startNewGame({
        playerConfigs: configs,
        mode: 'WWF',
        timerMinutes: 0,
        boardSize: boardSize
      });
    };
  }

  // 7. Modals: Tile Peeker
  function openTilePeekerModal(game) {
    const modal = document.getElementById('peeker-modal');
    const container = document.getElementById('peeker-grid');
    if (!modal || !container) return;
    container.innerHTML = '';

    const counts = game.getLetterCounts();
    for (const letter in counts) {
      const count = counts[letter];
      const card = document.createElement('div');
      card.className = 'peeker-tile-card';
      card.innerHTML = 
        '<span class="peeker-letter">' + (letter === '_' ? 'BLANK' : letter) + '</span>' +
        '<span class="peeker-count">x' + count + '</span>';
      container.appendChild(card);
    }
    modal.classList.remove('hidden');
  }

  // 8. Modals: Swap Tiles
  function openSwapModal(game) {
    const modal = document.getElementById('swap-modal');
    const container = document.getElementById('swap-rack-container');
    if (!modal || !container) return;
    container.innerHTML = '';

    const player = game.getCurrentPlayer();
    if (!player || !player.rack) return;
    const selectedIndices = new Set();

    player.rack.forEach((t, i) => {
      const tileEl = document.createElement('div');
      tileEl.className = 'wood-tile';
      tileEl.innerHTML = '<span class="tile-letter">' + (t.letter === '_' ? ' ' : t.letter) + '</span>';
      tileEl.onclick = () => {
        if (selectedIndices.has(i)) {
          selectedIndices.delete(i);
          tileEl.classList.remove('selected');
        } else {
          selectedIndices.add(i);
          tileEl.classList.add('selected');
        }
      };
      container.appendChild(tileEl);
    });

    const confirmBtn = document.getElementById('btn-confirm-swap');
    if (confirmBtn) {
      confirmBtn.onclick = () => {
        if (selectedIndices.size === 0) {
          alert('Please select at least one tile to swap.');
          return;
        }
        game.swapTiles(Array.from(selectedIndices));
        modal.classList.add('hidden');
      };
    }

    modal.classList.remove('hidden');
  }

  // 9. Modals: Game Over
  function showGameOverModal(game) {
    const modal = document.getElementById('game-over-modal');
    const rankingsEl = document.getElementById('game-over-rankings');
    if (!modal || !rankingsEl) return;
    rankingsEl.innerHTML = '';

    const sorted = [...game.players].sort((a, b) => b.score - a.score);
    sorted.forEach((p, idx) => {
      const row = document.createElement('div');
      row.className = 'rank-row';
      const medal = idx === 0 ? '🥇 1st' : idx === 1 ? '🥈 2nd' : idx === 2 ? '🥉 3rd' : (idx + 1) + 'th';
      row.innerHTML = 
        '<span class="rank-badge">' + medal + '</span>' +
        '<span class="rank-name" style="color: ' + p.color + '">' + p.name + '</span>' +
        '<span class="rank-score">' + p.score + ' pts</span>';
      rankingsEl.appendChild(row);
    });

    AUDIO.playScoreFanfare(true);
    modal.classList.remove('hidden');
  }

  // 10. Modals: Change Player Name
  function openNameModal() {
    const modal = document.getElementById('name-modal');
    const input = document.getElementById('player-name-input');
    if (!modal || !input) return;
    input.value = localPlayerName;
    modal.classList.remove('hidden');
    setTimeout(() => {
      input.focus();
      input.select();
    }, 60);
  }

  function savePlayerName() {
    const input = document.getElementById('player-name-input');
    if (!input) return;
    const newName = input.value.trim();
    if (!newName) {
      alert('Please enter a valid display name.');
      return;
    }
    localPlayerName = newName;
    localStorage.setItem('wwf_player_name', newName);
    updateHeaderName(newName);

    // Update lobby roster
    if (lobbyPlayers && lobbyPlayers[0]) {
      lobbyPlayers[0].name = newName + ' (You)';
      renderLobbyRoster();
    }

    // Update active game
    if (game.players && game.players[0]) {
      game.setPlayerName(game.players[0].id, newName);
    }
    if (game.network) {
      game.network.playerName = newName;
    }

    const modal = document.getElementById('name-modal');
    if (modal) modal.classList.add('hidden');
  }

  const changeNameBtn = document.getElementById('btn-change-name');
  if (changeNameBtn) changeNameBtn.onclick = openNameModal;

  const saveNameBtn = document.getElementById('btn-save-name');
  if (saveNameBtn) saveNameBtn.onclick = savePlayerName;

  const cancelNameBtn = document.getElementById('btn-cancel-name');
  if (cancelNameBtn) {
    cancelNameBtn.onclick = () => {
      document.getElementById('name-modal').classList.add('hidden');
    };
  }

  const playerNameInput = document.getElementById('player-name-input');
  if (playerNameInput) {
    playerNameInput.onkeydown = (e) => {
      if (e.key === 'Enter') savePlayerName();
      if (e.key === 'Escape') document.getElementById('name-modal').classList.add('hidden');
    };
  }

  // Close modals on [x]
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.onclick = (e) => {
      const overlay = e.target.closest('.modal-overlay');
      if (overlay) overlay.classList.add('hidden');
    };
  });

  // Listen for player name updates from network
  game.onPlayerRenamed = (newName) => {
    localPlayerName = newName;
    localStorage.setItem('wwf_player_name', newName);
    updateHeaderName(newName);
  };

  // 11. Start Initial Default Game (Single local human player - NO automatic bot!)
  game.startNewGame({
    playerConfigs: [
      { id: game.network.playerId, name: localPlayerName, isBot: false }
    ],
    mode: 'WWF',
    timerMinutes: 0,
    boardSize: 15
  });

  // 11b. Hamburger menu toggle for mobile
  const hamburgerBtn = document.getElementById('btn-hamburger');
  const headerControls = document.getElementById('header-controls');
  if (hamburgerBtn && headerControls) {
    hamburgerBtn.onclick = () => {
      const expanded = hamburgerBtn.getAttribute('aria-expanded') === 'true';
      hamburgerBtn.setAttribute('aria-expanded', !expanded);
      headerControls.classList.toggle('header-controls-open', !expanded);
    };
    // Close controls when clicking outside on mobile
    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 640 &&
          !headerControls.contains(e.target) &&
          e.target !== hamburgerBtn &&
          !hamburgerBtn.contains(e.target)) {
        hamburgerBtn.setAttribute('aria-expanded', 'false');
        headerControls.classList.remove('header-controls-open');
      }
    });
  }

  // 12. Async load full ENABLE1 dictionary in background
  DICTIONARY.init('data/enable1.txt');

  // 13. Chat UI wiring
  game.onChatMessage = (data) => {
    const list = document.getElementById('chat-messages-list');
    if (!list) return;
    const li = document.createElement('li');
    li.style.marginBottom = '6px';
    li.innerHTML = '<span style="color:#94a3b8; font-size:11px;">[' + data.timestamp + ']</span> ' +
                   '<strong style="color:' + data.playerColor + ';">' + data.playerName + ':</strong> ' +
                   '<span>' + data.message + '</span>';
    list.appendChild(li);
    list.scrollTop = list.scrollHeight;
  };

  const btnSendChat = document.getElementById('btn-send-chat');
  const inputChat = document.getElementById('chat-input');
  
  function sendChat() {
    if (!inputChat) return;
    const msg = inputChat.value.trim();
    if (msg) {
      game.network.sendChatMessage(msg);
      inputChat.value = '';
    }
  }

  if (btnSendChat) btnSendChat.onclick = sendChat;
  if (inputChat) {
    inputChat.onkeydown = (e) => {
      if (e.key === 'Enter') sendChat();
    };
  }

  // 14. Load directly into Game Lobby & Start Menu first
  openLobbyModal();
  if (roomParam && !isHost) {
    setTab('join');
    const joinCodeInput = document.getElementById('join-code-input');
    if (joinCodeInput) joinCodeInput.value = currentRoomCode;
  } else {
    setTab('create');
    // Ensure room is registered on server so invite code is immediately valid for joining friends
    if (isHost && currentRoomCode) {
      game.network.createRoomWithCode(currentRoomCode, null, { mode: 'WWF', timerMinutes: 0 });
    }
  }
});
