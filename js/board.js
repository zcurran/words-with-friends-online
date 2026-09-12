// Board & Rack UI Controller (Drag-and-Drop, Touch/Tap Placement, Live Score Preview)
class BoardController {
  constructor(game, elements) {
    this.game = game;
    this.elements = elements;

    // Currently staged tiles placed on board during active turn: Map<r,c -> { letter, points, isBlank, rackIndex }>
    this.stagedTiles = new Map();
    this.selectedRackIndex = null;
    this.draggedTileData = null;

    this.initEvents();
  }

  // Render NxN board dynamically based on game.boardSize
  renderBoard() {
    const boardEl = this.elements.boardEl;
    if (!boardEl) return;
    boardEl.innerHTML = '';

    const N = this.game.boardSize || 15;
    const center = Math.floor(N / 2);

    // Get appropriate board layout
    let boardLayout;
    if (N === 15) {
      boardLayout = this.game.mode === 'WWF' ? this.game.config.WWF_BOARD : this.game.config.SCRABBLE_BOARD;
    } else {
      boardLayout = this.game.config.generateBoardLayout(N);
    }

    // Apply CSS grid sizing
    this.applyBoardSize(N);

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const cell = document.createElement('div');
        cell.className = 'board-cell';
        cell.dataset.r = r;
        cell.dataset.c = c;

        const existing = this.game.board[r] && this.game.board[r][c];
        const staged = this.stagedTiles.get(r + ',' + c);

        // Check if an opponent is actively spelling / staging a tile here
        let remoteStaged = null;
        if (!existing && !staged && this.game.remoteStagedPositions) {
          for (const pid in this.game.remoteStagedPositions) {
            const entry = this.game.remoteStagedPositions[pid];
            if (entry && entry.tiles) {
              const match = entry.tiles.find(t => t.r === r && t.c === c);
              if (match) {
                remoteStaged = {
                  letter: match.letter,
                  points: match.points,
                  isBlank: !!match.isBlank,
                  playerName: entry.playerName,
                  playerColor: entry.playerColor
                };
                break;
              }
            }
          }
        }

        if (existing || staged || remoteStaged) {
          cell.classList.add('has-tile');
          const tile = existing || staged || remoteStaged;
          const isStaged = !existing && !!staged;
          const isRemote = !existing && !staged && !!remoteStaged;
          const tileEl = this.createTileElement(tile.letter, tile.points, isStaged, tile.isBlank, isRemote, remoteStaged);
          if (isStaged) {
            tileEl.dataset.r = r;
            tileEl.dataset.c = c;
          }
          cell.appendChild(tileEl);
        } else {
          // Only show multiplier labels or star when cell is empty
          const mult = boardLayout[r] ? boardLayout[r][c] : '.';
          if (mult === 'TW') {
            cell.classList.add('cell-tw');
            cell.innerHTML = '<span class="mult-label">TW</span><span class="mult-sub">TRIPLE WORD</span>';
          } else if (mult === 'DW') {
            cell.classList.add('cell-dw');
            cell.innerHTML = '<span class="mult-label">DW</span><span class="mult-sub">DOUBLE WORD</span>';
          } else if (mult === 'TL') {
            cell.classList.add('cell-tl');
            cell.innerHTML = '<span class="mult-label">TL</span><span class="mult-sub">TRIPLE LETTER</span>';
          } else if (mult === 'DL') {
            cell.classList.add('cell-dl');
            cell.innerHTML = '<span class="mult-label">DL</span><span class="mult-sub">DOUBLE LETTER</span>';
          } else if (mult === 'STAR') {
            cell.classList.add('cell-star');
            cell.innerHTML = '<span class="star-icon">★</span>';
          }
        }

        boardEl.appendChild(cell);
      }
    }
  }

  // Apply board size CSS custom properties for dynamic grid sizing
  applyBoardSize(N) {
    const boardEl = this.elements.boardEl;
    if (!boardEl) return;

    // ─── Calculate available space ────────────────────────────────────────
    // Available width: viewport minus sidebar (280px) minus padding/gap (56px)
    // Available height: viewport minus header (~62px) minus rack (~100px) minus padding (32px)
    const sidebarW  = window.innerWidth >= 1024 ? 300 : 0;
    const availW    = window.innerWidth  - sidebarW - 56;
    const availH    = window.innerHeight - 62 - 100 - 32;

    // Target the largest square that fits in the available space
    const boardAreaPx = Math.min(availW, availH);

    // Gap between cells (scales down for big boards)
    const gap = N > 25 ? 1 : 2;

    // Cell size = (boardArea - 2*padding - (N-1)*gap) / N
    const padding = N > 25 ? 4 : 10;
    let cellPx = Math.floor((boardAreaPx - 2 * padding - (N - 1) * gap) / N);

    // Enforce sensible min/max per board size
    const maxCell = N <= 11 ? 56 : N <= 15 ? 46 : N <= 20 ? 36 : N <= 25 ? 28 : N <= 35 ? 22 : 16;
    const minCell = N <= 15 ? 22 : N <= 25 ? 14 : 8;
    cellPx = Math.min(cellPx, maxCell);
    cellPx = Math.max(cellPx, minCell);

    // ─── Write CSS custom properties ─────────────────────────────────────
    // --cell-size  → drives all em-based font sizes in board.css
    // --cell-gap   → gap between cells
    // --board-pad  → inner padding of the board frame
    document.documentElement.style.setProperty('--cell-size', cellPx + 'px');
    document.documentElement.style.setProperty('--cell-gap', gap + 'px');
    document.documentElement.style.setProperty('--board-pad', padding + 'px');

    // ─── Apply grid layout ────────────────────────────────────────────────
    boardEl.style.gap = gap + 'px';
    boardEl.style.padding = padding + 'px';
    boardEl.style.gridTemplateColumns = 'repeat(' + N + ', ' + cellPx + 'px)';
    boardEl.style.gridTemplateRows    = 'repeat(' + N + ', ' + cellPx + 'px)';

    // ─── Board size category for CSS targeting ────────────────────────────
    // Drives which labels/text are shown
    boardEl.dataset.boardSize =
      N <= 11 ? 'xl' :
      N <= 15 ? 'lg' :
      N <= 20 ? 'md' :
      N <= 30 ? 'sm' : 'xs';

    // ─── Register resize handler (once) ──────────────────────────────────
    if (!this._resizeRegistered) {
      this._resizeRegistered = true;
      let resizeTimer;
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          if (this.game && this.game.boardSize) {
            this.applyBoardSize(this.game.boardSize);
            this.renderBoard();
          }
        }, 150);
      });
    }
  }

  // Create wood tile DOM element
  createTileElement(letter, points, isStaged = false, isBlank = false, isRemote = false, remoteInfo = null) {
    const tile = document.createElement('div');
    tile.className = 'wood-tile' + (isStaged ? ' staged-tile' : '') + (isBlank ? ' blank-tile' : '') + (isRemote ? ' remote-staged-tile' : '');
    tile.draggable = isStaged && !isRemote;

    tile.innerHTML = '<span class="tile-letter">' + (letter ? letter.toUpperCase() : '') + '</span>' +
                     '<span class="tile-points">' + (isBlank ? 0 : points) + '</span>';

    if (isRemote && remoteInfo) {
      tile.style.boxShadow = `0 0 0 2px ${remoteInfo.playerColor || '#2196f3'}, 0 2px 6px rgba(0,0,0,0.4)`;
      tile.style.opacity = '0.9';
      tile.title = `Staged by ${remoteInfo.playerName || 'Opponent'}`;
    }

    return tile;
  }

  // Render current player's 7-tile rack
  renderRack() {
    const rackEl = this.elements.rackEl;
    if (!rackEl) return;
    rackEl.innerHTML = '';

    const currentPlayer = this.game.getLocalPlayer ? this.game.getLocalPlayer() : this.game.getCurrentPlayer();
    if (!currentPlayer || !currentPlayer.rack) return;

    const stagedIndices = new Set();
    for (const staged of this.stagedTiles.values()) {
      stagedIndices.add(staged.rackIndex);
    }

    currentPlayer.rack.forEach((tile, index) => {
      const slot = document.createElement('div');
      slot.className = 'rack-slot';
      slot.dataset.index = index;

      if (!stagedIndices.has(index)) {
        const displayLetter = tile.letter === '_' ? ' ' : tile.letter;
        const tileEl = this.createTileElement(displayLetter, tile.points, false, tile.isBlank);
        tileEl.draggable = true;
        tileEl.dataset.index = index;

        if (this.selectedRackIndex === index) {
          tileEl.classList.add('selected');
        }

        slot.appendChild(tileEl);
      } else {
        slot.classList.add('empty-slot');
      }

      rackEl.appendChild(slot);
    });

    this.updateLiveScorePreview();
  }

  // Drag and Drop & Click Events
  initEvents() {
    const boardEl = this.elements.boardEl;
    const rackEl = this.elements.rackEl;
    if (!boardEl || !rackEl) return;

    // Guard: track whether the last interaction was a drag so we can suppress the 'click' that fires after dragend
    let isDragging = false;

    // Drag start on rack
    rackEl.addEventListener('dragstart', (e) => {
      const tileEl = e.target.closest('.wood-tile');
      if (!tileEl) return;
      isDragging = true;
      const index = parseInt(tileEl.dataset.index);
      const player = this.game.getLocalPlayer ? this.game.getLocalPlayer() : this.game.getCurrentPlayer();
      if (!player || !player.rack[index]) return;
      const tileData = player.rack[index];
      this.draggedTileData = { ...tileData, rackIndex: index, from: 'rack' };
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', JSON.stringify(this.draggedTileData));
      AUDIO.playTileClick();
    });

    // Drag start on staged tile on board
    boardEl.addEventListener('dragstart', (e) => {
      const tileEl = e.target.closest('.staged-tile');
      if (!tileEl) return;
      isDragging = true;
      const r = parseInt(tileEl.dataset.r);
      const c = parseInt(tileEl.dataset.c);
      const staged = this.stagedTiles.get(r + ',' + c);
      if (!staged) return;

      this.draggedTileData = { ...staged, from: 'board', r, c };
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', JSON.stringify(this.draggedTileData));
      AUDIO.playTileClick();
    });

    // Drag over board
    boardEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      const cell = e.target.closest('.board-cell');
      if (cell) cell.classList.add('drag-over');
    });

    boardEl.addEventListener('dragleave', (e) => {
      const cell = e.target.closest('.board-cell');
      if (cell) cell.classList.remove('drag-over');
    });

    // Drop on board
    boardEl.addEventListener('drop', (e) => {
      e.preventDefault();
      const cell = e.target.closest('.board-cell');
      if (!cell) return;
      cell.classList.remove('drag-over');

      const r = parseInt(cell.dataset.r);
      const c = parseInt(cell.dataset.c);

      let data = this.draggedTileData;
      if (!data && e.dataTransfer) {
        try { data = JSON.parse(e.dataTransfer.getData('text/plain')); } catch (err) {}
      }
      if (!data) return;

      // If dropped onto the exact same cell, do nothing
      if (data.from === 'board' && data.r === r && data.c === c) {
        this.draggedTileData = null;
        return;
      }

      // Cannot place on already filled square
      if (this.game.board[r][c] || this.stagedTiles.has(r + ',' + c)) {
        AUDIO.playBuzz();
        return;
      }

      if (data.from === 'board') {
        this.stagedTiles.delete(data.r + ',' + data.c);
      }

      if (data.isBlank) {
        this.promptBlankTileChoice((chosenLetter) => {
          this.stageTile(r, c, {
            letter: chosenLetter.toUpperCase(),
            points: 0,
            isBlank: true,
            rackIndex: data.rackIndex
          });
        });
      } else {
        this.stageTile(r, c, data);
      }

      this.draggedTileData = null;
    });

    // Drop on Tray / Rack to return tiles or reorder rack
    const rackShelfEl = document.querySelector('.rack-shelf-container') || rackEl;

    const handleRackDragOver = (e) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      const slot = e.target.closest('.rack-slot');
      if (slot) {
        slot.classList.add('drag-over');
      } else {
        rackShelfEl.classList.add('drag-over');
      }
    };

    const handleRackDragLeave = (e) => {
      const slot = e.target.closest('.rack-slot');
      if (slot) slot.classList.remove('drag-over');
      if (!rackShelfEl.contains(e.relatedTarget)) {
        rackShelfEl.classList.remove('drag-over');
      }
    };

    const handleRackDrop = (e) => {
      e.preventDefault();
      document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));

      let data = this.draggedTileData;
      if (!data && e.dataTransfer) {
        try { data = JSON.parse(e.dataTransfer.getData('text/plain')); } catch (err) {}
      }
      if (!data) return;

      if (data.from === 'board') {
        // Return staged tile from board back to the rack / tray!
        this.stagedTiles.delete(data.r + ',' + data.c);

        // If dropped on a specific rack slot, place it there
        const targetSlot = e.target.closest('.rack-slot');
        if (targetSlot) {
          const targetIndex = parseInt(targetSlot.dataset.index);
          const sourceIndex = data.rackIndex;
          if (!isNaN(targetIndex) && !isNaN(sourceIndex) && targetIndex !== sourceIndex) {
            const player = this.game.getLocalPlayer ? this.game.getLocalPlayer() : this.game.getCurrentPlayer();
            if (player && player.rack) {
              const tile = player.rack.splice(sourceIndex, 1)[0];
              player.rack.splice(targetIndex, 0, tile);
            }
          }
        }

        AUDIO.playTileClick();
        this.renderBoard();
        this.renderRack();
      } else if (data.from === 'rack') {
        // Reordering tiles within rack tray
        const targetSlot = e.target.closest('.rack-slot');
        if (targetSlot) {
          const targetIndex = parseInt(targetSlot.dataset.index);
          const sourceIndex = data.rackIndex;
          if (!isNaN(targetIndex) && !isNaN(sourceIndex) && targetIndex !== sourceIndex) {
            const player = this.game.getLocalPlayer ? this.game.getLocalPlayer() : this.game.getCurrentPlayer();
            if (player && player.rack) {
              const tile = player.rack.splice(sourceIndex, 1)[0];
              player.rack.splice(targetIndex, 0, tile);
              AUDIO.playTileClick();
              this.renderRack();
            }
          }
        }
      }

      this.draggedTileData = null;
    };

    rackEl.addEventListener('dragover', handleRackDragOver);
    rackEl.addEventListener('dragleave', handleRackDragLeave);
    rackEl.addEventListener('drop', handleRackDrop);

    rackShelfEl.addEventListener('dragover', handleRackDragOver);
    rackShelfEl.addEventListener('dragleave', handleRackDragLeave);
    rackShelfEl.addEventListener('drop', handleRackDrop);

    // Global dragend to clean up any leftover hover highlights
    // Reset isDragging after a short delay so the click that fires immediately after dragend is suppressed
    document.addEventListener('dragend', () => {
      document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      this.draggedTileData = null;
      // Use a short timeout so the click event (which fires right after dragend) is skipped
      setTimeout(() => { isDragging = false; }, 50);
    });

    // Click on Rack Tile (Tap-to-place selection) — suppressed if a drag just occurred
    rackEl.addEventListener('click', (e) => {
      if (isDragging) return; // drag just ended, ignore this click
      const tileEl = e.target.closest('.wood-tile');
      if (!tileEl) return;
      const index = parseInt(tileEl.dataset.index);

      if (this.selectedRackIndex === index) {
        this.selectedRackIndex = null;
      } else {
        this.selectedRackIndex = index;
        AUDIO.playTileClick();
      }
      this.renderRack();
    });

    // Click on Board Cell — suppressed if a drag just occurred
    boardEl.addEventListener('click', (e) => {
      if (isDragging) return; // drag just ended, ignore this click
      const cell = e.target.closest('.board-cell');
      if (!cell) return;
      const r = parseInt(cell.dataset.r);
      const c = parseInt(cell.dataset.c);

      // If clicked on staged tile, return it to rack
      if (this.stagedTiles.has(r + ',' + c)) {
        this.stagedTiles.delete(r + ',' + c);
        AUDIO.playTileClick();
        this.renderBoard();
        this.renderRack();
        this.notifyStagedChanged();
        return;
      }

      // If a rack tile is selected, place it here
      if (this.selectedRackIndex !== null) {
        if (this.game.board[r][c]) {
          AUDIO.playBuzz();
          return;
        }

        const player = this.game.getLocalPlayer ? this.game.getLocalPlayer() : this.game.getCurrentPlayer();
        const tileData = player.rack[this.selectedRackIndex];

        if (tileData.isBlank) {
          const rackIdx = this.selectedRackIndex;
          this.promptBlankTileChoice((chosenLetter) => {
            this.stageTile(r, c, {
              letter: chosenLetter.toUpperCase(),
              points: 0,
              isBlank: true,
              rackIndex: rackIdx
            });
            this.selectedRackIndex = null;
          });
        } else {
          this.stageTile(r, c, {
            ...tileData,
            rackIndex: this.selectedRackIndex
          });
          this.selectedRackIndex = null;
        }
      }
    });
  }

  notifyStagedChanged() {
    if (this.onStagedChanged) {
      const list = Array.from(this.stagedTiles.values()).map(t => ({
        r: t.r,
        c: t.c,
        letter: t.letter,
        points: t.points,
        isBlank: !!t.isBlank
      }));
      this.onStagedChanged(list);
    }
  }

  // Put a tile into staging
  stageTile(r, c, tileData) {
    this.stagedTiles.set(r + ',' + c, {
      r,
      c,
      letter: tileData.letter,
      points: tileData.points,
      isBlank: !!tileData.isBlank,
      rackIndex: tileData.rackIndex
    });

    AUDIO.playTileClick();
    this.renderBoard();
    this.renderRack();
    this.notifyStagedChanged();
  }

  // Recall all staged tiles back to rack
  recallAll() {
    if (this.stagedTiles.size === 0) return;
    this.stagedTiles.clear();
    AUDIO.playShuffle();
    this.renderBoard();
    this.renderRack();
    this.notifyStagedChanged();
  }

  // Modal dialog for selecting a letter for blank wildcard tile
  promptBlankTileChoice(callback) {
    const modal = document.getElementById('blank-modal');
    const lettersGrid = document.getElementById('blank-letters-grid');
    if (!modal || !lettersGrid) return;
    lettersGrid.innerHTML = '';

    for (let c = 65; c <= 90; c++) {
      const char = String.fromCharCode(c);
      const btn = document.createElement('button');
      btn.className = 'blank-btn';
      btn.innerText = char;
      btn.onclick = () => {
        modal.classList.add('hidden');
        callback(char);
      };
      lettersGrid.appendChild(btn);
    }

    modal.classList.remove('hidden');
  }

  // Update live score preview & validation badge
  updateLiveScorePreview() {
    const previewEl = this.elements.previewEl;
    const playBtn = this.elements.playBtn;
    if (!previewEl) return;

    const activePlayer = this.game.getCurrentPlayer();
    const localPlayer = this.game.getLocalPlayer ? this.game.getLocalPlayer() : activePlayer;
    const isMyTurn = (!activePlayer || !localPlayer) ? true : (activePlayer.id === localPlayer.id);

    if (this.stagedTiles.size === 0) {
      previewEl.className = 'score-preview preview-idle';
      if (this.game.players.length > 1 && !isMyTurn && activePlayer) {
        previewEl.innerHTML = '<span>⏳ Waiting for <strong>' + activePlayer.name + "'s</strong> turn...</span>";
      } else {
        previewEl.innerHTML = '<span>Place tiles on board to preview score</span>';
      }
      if (playBtn) playBtn.disabled = true;
      return;
    }

    const stagedArray = Array.from(this.stagedTiles.values());
    const res = this.game.rules.validateMove(this.game.board, stagedArray, this.game.mode, this.game.boardSize || 15);

    if (res.valid) {
      previewEl.className = 'score-preview preview-valid';
      const wordsStr = res.wordsFormed.map(w => '<strong>' + w.word + '</strong> (+' + w.points + ')').join(' + ');
      const bingoTag = res.isBingo ? ' <span class="bingo-badge">+35 BINGO!</span>' : '';
      previewEl.innerHTML = '✓ Valid Play: ' + wordsStr + bingoTag + ' = <strong>' + res.totalScore + ' pts</strong>';
      if (playBtn) playBtn.disabled = (this.game.players.length > 1 && !isMyTurn);
    } else {
      previewEl.className = 'score-preview preview-invalid';
      previewEl.innerHTML = '✗ ' + res.error;
      if (playBtn) playBtn.disabled = true;
    }
  }

  // Submit currently staged move
  submitStagedMove() {
    if (this.stagedTiles.size === 0) return;

    const activePlayer = this.game.getCurrentPlayer();
    const localPlayer = this.game.getLocalPlayer ? this.game.getLocalPlayer() : activePlayer;
    if (this.game.players.length > 1 && activePlayer && localPlayer && activePlayer.id !== localPlayer.id) {
      alert('Please wait for ' + activePlayer.name + "'s turn!");
      return;
    }

    const stagedArray = Array.from(this.stagedTiles.values());
    const res = this.game.playMove(stagedArray);

    if (res.valid) {
      this.stagedTiles.clear();
      this.selectedRackIndex = null;
      this.renderBoard();
      this.renderRack();
      this.notifyStagedChanged();
    }
  }
}
