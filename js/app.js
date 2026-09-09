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
  let localPlayerName = localStorage.getItem('wwf_player_name') || 'Player 1';

  // Check URL params for ?room=CODE first
  const urlParams = new URLSearchParams(window.location.search);
  const roomParam = urlParams.get('room');

  // Check stored room code from localStorage
  const storedRoom = localStorage.getItem('wwf_room_code');
  const storedIsHost = localStorage.getItem('wwf_is_host');

  let currentRoomCode = '';
  let isHost = true;

  if (roomParam) {
    // User arrived via room invite link or persistent URL
    currentRoomCode = roomParam.toUpperCase().trim();
    isHost = (storedRoom === currentRoomCode) ? (storedIsHost !== 'false') : false;
  } else if (storedRoom) {
    // User refreshed page without query param - reuse existing room code!
    currentRoomCode = storedRoom.toUpperCase().trim();
    isHost = (storedIsHost !== 'false');
  } else {
    // Fresh new session - generate initial friend code
    currentRoomCode = 'WWF-' + Math.floor(1000 + Math.random() * 9000);
    isHost = true;
  }

  let lobbyPlayers = [
    { name: localPlayerName + ' (You)', isBot: false, isHost: isHost }
  ];

  function updateHeaderName(name) {
    const headerNameEl = document.getElementById('header-player-name');
    if (headerNameEl) headerNameEl.innerText = name;
    const joinNameInp = document.getElementById('join-name-input');
    if (joinNameInp) joinNameInp.value = name;
  }
  updateHeaderName(localPlayerName);

  // Update header and lobby UI with room code and synchronize with URL and localStorage
  function updateRoomUI(code, asHost = isHost) {
    currentRoomCode = code;
    isHost = asHost;
    localStorage.setItem('wwf_room_code', code);
    localStorage.setItem('wwf_is_host', isHost ? 'true' : 'false');

    if (elements.headerRoomCode) elements.headerRoomCode.innerText = code;
    const lobbyCodeEl = document.getElementById('lobby-friend-code');
    if (lobbyCodeEl) lobbyCodeEl.innerText = code;

    // Keep URL parameter ?room=CODE updated in address bar so browser refresh retains room
    try {
      const currentUrl = new URL(window.location.href);
      if (currentUrl.searchParams.get('room') !== code) {
        currentUrl.searchParams.set('room', code);
        window.history.replaceState({}, '', currentUrl.pathname + currentUrl.search);
      }
    } catch (err) {}
  }
  updateRoomUI(currentRoomCode, isHost);

  // Connect network
  game.network.playerName = localPlayerName;
  game.network.setRoomCode(currentRoomCode, isHost);
  game.network.connectWebSocket();

  // 3. Render functions
  function renderScoreboard(gameState) {
    const playersListEl = elements.playersListEl;
    if (!playersListEl) return;
    playersListEl.innerHTML = '';

    const countIndicator = document.getElementById('player-count-indicator');
    if (countIndicator) countIndicator.innerText = gameState.players.length + ' Players';

    gameState.players.forEach((p, idx) => {
      const isCurrent = idx === gameState.currentTurnIndex;
      const isLocal = idx === 0 && !p.isBot;
      const card = document.createElement('div');
      card.className = 'player-card' + (isCurrent ? ' active-turn' : '');
      card.style.borderColor = p.color;

      card.innerHTML = 
        '<div class="player-avatar" style="background-color: ' + p.color + '">' +
          p.name.charAt(0).toUpperCase() +
        '</div>' +
        '<div class="player-info">' +
          '<div class="player-name-row">' +
            '<span class="player-name">' + p.name + '</span>' +
            (isLocal ? '<button class="edit-name-inline-btn" title="Edit your name" data-player-id="' + p.id + '">✏️</button>' : '') +
            (p.isBot ? '<span class="bot-badge">BOT</span>' : '') +
            (isCurrent ? '<span class="turn-badge">TURN</span>' : '') +
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
    if (!container) return;
    container.innerHTML = '';
    if (countEl) countEl.innerText = lobbyPlayers.length;

    lobbyPlayers.forEach((p, i) => {
      const item = document.createElement('div');
      item.className = 'lobby-player-item';
      item.innerHTML = 
        '<span>' + (i + 1) + '. <strong>' + p.name + '</strong> ' + (p.isHost ? '(Host)' : '') + (p.isBot ? ' [BOT]' : '') + '</span>' +
        '<span class="lobby-player-ready">✓ Ready</span>';
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
      elements.modeDisplayEl.innerText = gameState.mode + ' 15x15';
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

  // Handle remote player joining lobby
  game.onLobbyUpdate = (payload) => {
    if (payload && payload.playerName) {
      if (!lobbyPlayers.some(p => p.name === payload.playerName)) {
        if (lobbyPlayers.length < 5) {
          lobbyPlayers.push({
            name: payload.playerName,
            isBot: false,
            isHost: !!payload.isHost
          });
          renderLobbyRoster();
        }
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

  // If URL had room param, open Join tab immediately
  if (roomParam) {
    setTab('join');
    const joinInput = document.getElementById('join-code-input');
    if (joinInput) joinInput.value = roomParam;
    openLobbyModal();
  }

  // Add bot button in lobby
  const btnAddBot = document.getElementById('btn-lobby-add-bot');
  if (btnAddBot) {
    btnAddBot.onclick = () => {
      if (lobbyPlayers.length >= 5) {
        alert('Maximum of 5 players allowed.');
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

  // Start Room Match (Host)
  const btnStartLobby = document.getElementById('btn-lobby-start-game');
  if (btnStartLobby) {
    btnStartLobby.onclick = () => {
      const modeRadio = document.querySelector('input[name="lobby-game-mode"]:checked');
      const mode = modeRadio ? modeRadio.value : 'WWF';
      const timerSelect = document.getElementById('lobby-timer-select');
      const timerVal = timerSelect ? parseInt(timerSelect.value) : 0;

      // Need at least 2 players
      if (lobbyPlayers.length < 2) {
        lobbyPlayers.push({ name: 'WordBot 1', isBot: true, botLevel: 'medium' });
      }

      document.getElementById('lobby-modal').classList.add('hidden');
      game.startNewGame({
        playerConfigs: lobbyPlayers,
        mode: mode,
        timerMinutes: timerVal
      });
    };
  }

  // Join Room with Code
  const btnSubmitJoin = document.getElementById('btn-submit-join');
  if (btnSubmitJoin) {
    btnSubmitJoin.onclick = () => {
      const codeInput = document.getElementById('join-code-input');
      const nameInput = document.getElementById('join-name-input');
      const code = (codeInput ? codeInput.value : '').toUpperCase().trim();
      const name = (nameInput ? nameInput.value : '').trim() || 'Guest Player';

      if (!code) {
        alert('Please enter a valid Friend Code.');
        return;
      }

      updateRoomUI(code, false);
      game.network.playerName = name;
      game.network.setRoomCode(code, false);

      document.getElementById('lobby-modal').classList.add('hidden');
      alert('Joined room ' + code + ' as ' + name + '!\nWaiting for host to start or sync match.');
    };
  }

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
      row.innerHTML = 
        '<input type="text" class="form-input" id="local-name-' + i + '" value="' + (i === 1 ? 'Player 1' : 'Player ' + i) + '">' +
        '<label style="font-size: 12px; display: flex; align-items: center; gap: 4px;">' +
          '<input type="checkbox" id="local-bot-' + i + '" ' + (i > 1 ? '' : '') + '> Bot' +
        '</label>';
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
        timerMinutes: 0
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

  // 11. Start Initial Default Game (Local Player + WordBot in WWF mode)
  game.startNewGame({
    playerConfigs: [
      { name: localPlayerName, isBot: false },
      { name: 'Word Bot', isBot: true, botLevel: 'medium' }
    ],
    mode: 'WWF',
    timerMinutes: 0
  });

  // 12. Async load full ENABLE1 dictionary in background
  DICTIONARY.init('data/enable1.txt');
});
