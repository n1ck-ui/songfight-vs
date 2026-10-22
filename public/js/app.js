// SongFight Main Frontend Application
// Real-time multiplayer, playlist selection, autocomplete, live scoreboard, and victory podium

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide icons
  lucide.createIcons();

  const socket = io({
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionAttempts: 15,
    reconnectionDelay: 1000,
    timeout: 10000
  });

  socket.on('connect', () => {
    console.log('[SongFight] Connected to server, socket ID:', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.warn('[SongFight] Disconnected from server:', reason);
  });

  socket.on('connect_error', (err) => {
    console.warn('[SongFight] Socket connection error:', err.message);
  });

  // App State
  const state = {
    currentScreen: 'screen-start',
    isHost: false,
    roomCode: null,
    playerName: null,
    myPlayerId: null,
    playlistType: 'default',
    playlistName: 'Top Hits',
    playbackMode: 'popular',
    currentRound: 0,
    totalRounds: 5,
    roundDuration: 30,
    roundTimeLeft: 30,
    timerInterval: null,
    potentialPoints: 1000,
    hasGuessedCorrectly: false,
    visualizerAnimationId: null
  };

  // DOM Elements
  const screens = {
    start: document.getElementById('screen-start'),
    join: document.getElementById('screen-join'),
    create: document.getElementById('screen-create'),
    lobbyHost: document.getElementById('screen-lobby-host'),
    lobbyPlayer: document.getElementById('screen-lobby-player'),
    game: document.getElementById('screen-game'),
    gameOver: document.getElementById('screen-gameover')
  };

  const header = {
    roomPill: document.getElementById('header-room-pill'),
    roomCodeBadge: document.getElementById('room-code-badge'),
    activeRoomCode: document.getElementById('active-room-code'),
    logoBtn: document.getElementById('logo-btn')
  };

  const joinScreen = {
    code: document.getElementById('join-code'),
    name: document.getElementById('join-name'),
    form: document.getElementById('form-join-room'),
    btnBack: document.getElementById('btn-back-from-join')
  };

  const createScreen = {
    btnBack: document.getElementById('btn-back-from-create'),
    hostName: document.getElementById('create-host-name'),
    roundsDisplay: document.getElementById('create-rounds-count'),
    btnRoundsMinus: document.getElementById('btn-rounds-minus'),
    btnRoundsPlus: document.getElementById('btn-rounds-plus'),
    presetBtns: document.querySelectorAll('.preset-btn'),
    btnSubmit: document.getElementById('btn-submit-create'),
    cardPlaylistDefault: document.getElementById('card-playlist-default'),
    cardPlaylistCustom: document.getElementById('card-playlist-custom'),
    customPlaylistContainer: document.getElementById('custom-playlist-input-container'),
    inputCustomUrl: document.getElementById('input-custom-playlist-url'),
    btnCheckPlaylist: document.getElementById('btn-check-playlist'),
    playlistStatus: document.getElementById('custom-playlist-status'),
    btnPlaylistInfo: document.getElementById('btn-playlist-info'),
    playlistInfoPopover: document.getElementById('playlist-info-popover'),
    cardPlaybackBeginning: document.getElementById('card-playback-beginning'),
    cardPlaybackPopular: document.getElementById('card-playback-popular')
  };

  const hostLobby = {
    qrImg: document.getElementById('host-qr-img'),
    codeTiles: document.getElementById('host-code-tiles'),
    btnCopyLink: document.getElementById('btn-copy-join-link'),
    playerCount: document.getElementById('host-player-count'),
    maxPlayers: document.getElementById('host-max-players'),
    playerProgress: document.getElementById('host-player-progress'),
    playersList: document.getElementById('host-players-list'),
    roundsDisplay: document.getElementById('lobby-rounds-display'),
    btnRoundsMinus: document.getElementById('btn-lobby-rounds-minus'),
    btnRoundsPlus: document.getElementById('btn-lobby-rounds-plus'),
    btnModeBeginning: document.getElementById('btn-lobby-mode-beginning'),
    btnModePopular: document.getElementById('btn-lobby-mode-popular'),
    btnStartGame: document.getElementById('btn-host-start-game')
  };

  const playerLobby = {
    roomTag: document.getElementById('player-room-tag'),
    counter: document.getElementById('player-lobby-counter'),
    playersList: document.getElementById('player-lobby-list'),
    playlistText: document.getElementById('player-lobby-playlist-text'),
    modeBadge: document.getElementById('player-lobby-mode-badge'),
    modeText: document.getElementById('player-lobby-mode-text'),
    modeIcon: document.getElementById('player-lobby-mode-icon')
  };

  const gameScreen = {
    roundIndicator: document.getElementById('game-round-indicator'),
    timerText: document.getElementById('game-timer-text'),
    timerBar: document.getElementById('game-timer-bar'),
    potentialPoints: document.getElementById('game-potential-points'),
    stageStatusText: document.getElementById('stage-status-text'),
    visualizerCanvas: document.getElementById('visualizer-canvas'),
    formGuess: document.getElementById('form-guess'),
    inputGuess: document.getElementById('input-guess'),
    btnSubmitGuess: document.getElementById('btn-submit-guess'),
    autocompleteList: document.getElementById('autocomplete-list'),
    feedbackCard: document.getElementById('guess-feedback-card'),
    feedbackIconBox: document.getElementById('feedback-icon-box'),
    feedbackIcon: document.getElementById('feedback-icon'),
    feedbackTitle: document.getElementById('feedback-title'),
    feedbackDesc: document.getElementById('feedback-desc'),
    scoreboardList: document.getElementById('game-scoreboard-list')
  };

  const revealOverlay = {
    container: document.getElementById('overlay-round-reveal'),
    albumImg: document.getElementById('reveal-album-img'),
    songTitle: document.getElementById('reveal-song-title'),
    songArtist: document.getElementById('reveal-song-artist'),
    songYear: document.getElementById('reveal-song-year'),
    fastestBox: document.getElementById('reveal-fastest-box'),
    fastestName: document.getElementById('reveal-fastest-name'),
    countdownNumber: document.getElementById('reveal-countdown-number')
  };

  const podiumScreen = {
    col1: document.getElementById('podium-col-1'),
    col2: document.getElementById('podium-col-2'),
    col3: document.getElementById('podium-col-3'),
    name1: document.getElementById('podium-name-1'),
    name2: document.getElementById('podium-name-2'),
    name3: document.getElementById('podium-name-3'),
    score1: document.getElementById('podium-score-1'),
    score2: document.getElementById('podium-score-2'),
    score3: document.getElementById('podium-score-3'),
    avatar1: document.getElementById('podium-avatar-1'),
    avatar2: document.getElementById('podium-avatar-2'),
    avatar3: document.getElementById('podium-avatar-3'),
    otherBox: document.getElementById('other-players-box'),
    otherList: document.getElementById('other-players-list'),
    btnReplay: document.getElementById('btn-gameover-replay'),
    btnQuit: document.getElementById('btn-gameover-quit')
  };

  // Helper: Toast Notifications
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  // Navigation: Show specific screen
  function showScreen(screenId) {
    state.currentScreen = screenId;
    Object.keys(screens).forEach(key => {
      if (screens[key].id === screenId) {
        screens[key].classList.add('active');
      } else {
        screens[key].classList.remove('active');
      }
    });

    // Update Header Room Pill
    if (state.roomCode && (screenId === 'screen-lobby-host' || screenId === 'screen-lobby-player' || screenId === 'screen-game')) {
      header.roomPill.style.display = 'block';
      header.activeRoomCode.textContent = state.roomCode;
    } else {
      header.roomPill.style.display = 'none';
    }

    lucide.createIcons();
  }

  // --- Check URL Parameters (Direct Join via QR Code or Link) ---
  const urlParams = new URLSearchParams(window.location.search);
  const joinParam = urlParams.get('join') || urlParams.get('code');
  if (joinParam) {
    showScreen('screen-join');
    joinScreen.code.value = joinParam.toUpperCase().slice(0, 4);
    joinScreen.name.focus();
    showToast(`Room code ${joinScreen.code.value} detected! Enter your name.`, 'success');
  }

  // Start Screen Card Handlers
  document.getElementById('card-action-join').addEventListener('click', () => {
    showScreen('screen-join');
    joinScreen.code.focus();
  });

  document.getElementById('card-action-create').addEventListener('click', () => {
    showScreen('screen-create');
  });

  joinScreen.btnBack.addEventListener('click', () => showScreen('screen-start'));
  createScreen.btnBack.addEventListener('click', () => showScreen('screen-start'));

  header.logoBtn.addEventListener('click', () => {
    if (confirm('Do you want to return to the start screen?')) {
      window.location.href = '/';
    }
  });

  // Room Code Copy Pill
  header.roomCodeBadge.addEventListener('click', () => {
    if (state.roomCode) {
      navigator.clipboard.writeText(state.roomCode);
      showToast(`Room code "${state.roomCode}" copied!`, 'success');
    }
  });

  // =========================================================
  // PLAYLIST SELECTION & CUSTOM LINK
  // =========================================================
  let selectedPlaylistType = 'default';
  let checkedPlaylistUrl = '';
  let selectedPlaybackMode = 'popular';

  createScreen.cardPlaylistDefault.addEventListener('click', () => {
    selectedPlaylistType = 'default';
    createScreen.cardPlaylistDefault.classList.add('active');
    createScreen.cardPlaylistCustom.classList.remove('active');
    createScreen.customPlaylistContainer.style.display = 'none';
  });

  createScreen.cardPlaylistCustom.addEventListener('click', () => {
    selectedPlaylistType = 'custom';
    createScreen.cardPlaylistCustom.classList.add('active');
    createScreen.cardPlaylistDefault.classList.remove('active');
    createScreen.customPlaylistContainer.style.display = 'flex';
    createScreen.inputCustomUrl.focus();
  });

  // Playback Mode Selection in Create Screen
  createScreen.cardPlaybackBeginning.addEventListener('click', () => {
    setPlaybackMode('beginning');
  });

  createScreen.cardPlaybackPopular.addEventListener('click', () => {
    setPlaybackMode('popular');
  });

  // Host Lobby Playback Mode Buttons
  if (hostLobby.btnModeBeginning) {
    hostLobby.btnModeBeginning.addEventListener('click', () => {
      setPlaybackMode('beginning');
      if (state.isHost && state.roomCode) {
        socket.emit('update_playback_mode', { playbackMode: 'beginning' });
      }
    });
  }

  if (hostLobby.btnModePopular) {
    hostLobby.btnModePopular.addEventListener('click', () => {
      setPlaybackMode('popular');
      if (state.isHost && state.roomCode) {
        socket.emit('update_playback_mode', { playbackMode: 'popular' });
      }
    });
  }

  function setPlaybackMode(mode) {
    selectedPlaybackMode = mode;
    state.playbackMode = mode;
    syncPlaybackModeUI(mode);
  }

  function syncPlaybackModeUI(mode) {
    const isBeginning = mode === 'beginning';
    if (createScreen.cardPlaybackBeginning) createScreen.cardPlaybackBeginning.classList.toggle('active', isBeginning);
    if (createScreen.cardPlaybackPopular) createScreen.cardPlaybackPopular.classList.toggle('active', !isBeginning);

    if (hostLobby.btnModeBeginning) hostLobby.btnModeBeginning.classList.toggle('active', isBeginning);
    if (hostLobby.btnModePopular) hostLobby.btnModePopular.classList.toggle('active', !isBeginning);

    if (playerLobby.modeText) {
      playerLobby.modeText.textContent = isBeginning ? 'From Beginning (0:00 Intro)' : 'Default';
    }
    if (playerLobby.modeIcon) {
      playerLobby.modeIcon.setAttribute('data-lucide', isBeginning ? 'disc' : 'flame');
      lucide.createIcons();
    }
  }

  // Initialize playback mode UI to 'popular' (Chorus) by default
  syncPlaybackModeUI(selectedPlaybackMode);

  // Info Button (i) Popover Toggle: How to find playlist link in Spotify
  createScreen.btnPlaylistInfo.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = createScreen.playlistInfoPopover.style.display === 'none';
    createScreen.playlistInfoPopover.style.display = isHidden ? 'block' : 'none';
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.info-tooltip-container')) {
      createScreen.playlistInfoPopover.style.display = 'none';
    }
  });

  // Check playlist URL
  async function checkPlaylist() {
    const url = createScreen.inputCustomUrl.value.trim();
    if (!url) {
      createScreen.playlistStatus.style.display = 'none';
      return;
    }
    createScreen.playlistStatus.className = 'playlist-status-msg';
    createScreen.playlistStatus.textContent = 'Checking playlist...';
    createScreen.playlistStatus.style.display = 'block';

    try {
      const res = await fetch(`/api/playlist/preview?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (data.success) {
        checkedPlaylistUrl = url;
        createScreen.playlistStatus.className = 'playlist-status-msg success';
        createScreen.playlistStatus.innerHTML = `✓ <strong>${escapeHtml(data.playlistName)}</strong> (${data.trackCount} songs found)`;
        showToast(`Playlist "${data.playlistName}" with ${data.trackCount} songs found! 🎉`, 'success');
      } else {
        createScreen.playlistStatus.className = 'playlist-status-msg error';
        createScreen.playlistStatus.textContent = `⚠️ ${data.error || 'Playlist not found. Check the link.'}`;
      }
    } catch (err) {
      createScreen.playlistStatus.className = 'playlist-status-msg error';
      createScreen.playlistStatus.textContent = 'Error loading playlist.';
    }
  }

  createScreen.btnCheckPlaylist.addEventListener('click', checkPlaylist);
  createScreen.inputCustomUrl.addEventListener('blur', () => {
    if (createScreen.inputCustomUrl.value.trim() && !checkedPlaylistUrl) {
      checkPlaylist();
    }
  });
  createScreen.inputCustomUrl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      checkPlaylist();
    }
  });

  // Rounds configuration stepper
  let chosenRounds = 5;

  function updateRounds(val) {
    chosenRounds = Math.max(1, Math.min(20, val));
    createScreen.roundsDisplay.textContent = chosenRounds;
    hostLobby.roundsDisplay.textContent = chosenRounds;

    createScreen.presetBtns.forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.rounds) === chosenRounds);
    });

    if (state.isHost && state.roomCode) {
      socket.emit('update_rounds', { rounds: chosenRounds });
    }
  }

  createScreen.btnRoundsMinus.addEventListener('click', () => updateRounds(chosenRounds - 1));
  createScreen.btnRoundsPlus.addEventListener('click', () => updateRounds(chosenRounds + 1));
  hostLobby.btnRoundsMinus.addEventListener('click', () => updateRounds(chosenRounds - 1));
  hostLobby.btnRoundsPlus.addEventListener('click', () => updateRounds(chosenRounds + 1));

  createScreen.presetBtns.forEach(btn => {
    btn.addEventListener('click', () => updateRounds(parseInt(btn.dataset.rounds)));
  });

  // =========================================================
  // CREATE ROOM SUBMISSION
  // =========================================================
  createScreen.btnSubmit.addEventListener('click', (e) => {
    e.preventDefault();
    const hostName = createScreen.hostName.value.trim();

    if (!hostName) {
      createScreen.hostName.focus();
      showToast('Please enter your host name.', 'error');
      return;
    }

    if (!socket.connected) {
      showToast('Connecting to game server... Please try again in a few seconds.', 'error');
      socket.connect();
      return;
    }

    const playlistUrl = selectedPlaylistType === 'custom' ? createScreen.inputCustomUrl.value.trim() : '';

    window.audioManager.unlockAudio(false);
    createScreen.btnSubmit.disabled = true;
    createScreen.btnSubmit.innerHTML = '<span>Creating room...</span>';

    let responded = false;
    const timeoutId = setTimeout(() => {
      if (!responded) {
        responded = true;
        createScreen.btnSubmit.disabled = false;
        createScreen.btnSubmit.innerHTML = '<span>Generate Room & Show Code</span><i data-lucide="arrow-right"></i>';
        lucide.createIcons();
        showToast('Server response timed out. Please try again.', 'error');
      }
    }, 8000);

    socket.emit('create_room', {
      hostName,
      rounds: chosenRounds,
      playlistType: selectedPlaylistType,
      playlistUrl,
      playbackMode: selectedPlaybackMode
    }, (res) => {
      if (responded) return;
      responded = true;
      clearTimeout(timeoutId);

      createScreen.btnSubmit.disabled = false;
      createScreen.btnSubmit.innerHTML = '<span>Generate Room & Show Code</span><i data-lucide="arrow-right"></i>';
      lucide.createIcons();

      if (!res || res.error) {
        showToast(res?.error || 'Error creating room.', 'error');
        return;
      }

      state.isHost = true;
      state.roomCode = res.roomCode;
      state.playerName = hostName;
      state.myPlayerId = socket.id;
      state.playlistName = res.playlistName || 'Top Hits';
      state.playbackMode = res.room?.playbackMode || selectedPlaybackMode;

      syncPlaybackModeUI(state.playbackMode);

      // Populate Host Lobby with QR Code & 4-letter Code
      hostLobby.qrImg.src = res.qrDataUrl;

      // Render 4-letter code tiles
      renderCodeTiles(res.roomCode);

      // Copy join link button
      hostLobby.btnCopyLink.onclick = () => {
        navigator.clipboard.writeText(res.joinUrl);
        showToast('Join link copied to clipboard! 📋', 'success');
      };

      updateLobbyPlayers(res.room);
      showScreen('screen-lobby-host');
      showToast(`Room ${res.roomCode} created with playlist "${res.playlistName}"! 🎉`, 'success');
    });
  });

  function renderCodeTiles(code) {
    hostLobby.codeTiles.innerHTML = '';
    for (let i = 0; i < 4; i++) {
      const tile = document.createElement('div');
      tile.className = 'code-tile';
      tile.textContent = code[i] || '-';
      hostLobby.codeTiles.appendChild(tile);
    }
  }

  // =========================================================
  // JOIN ROOM SUBMISSION
  // =========================================================
  joinScreen.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = joinScreen.code.value.trim().toUpperCase();
    const playerName = joinScreen.name.value.trim();

    if (!code || code.length !== 4) {
      showToast('Please enter a 4-letter room code.', 'error');
      joinScreen.code.focus();
      return;
    }

    if (!playerName) {
      showToast('Please enter your name.', 'error');
      joinScreen.name.focus();
      return;
    }

    if (!socket.connected) {
      showToast('Connecting to game server... Please try again in a few seconds.', 'error');
      socket.connect();
      return;
    }

    window.audioManager.unlockAudio(false);

    const submitBtn = joinScreen.form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Joining...</span>';
    }

    let responded = false;
    const timeoutId = setTimeout(() => {
      if (!responded) {
        responded = true;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>Enter Room</span><i data-lucide="arrow-right"></i>';
          lucide.createIcons();
        }
        showToast('Joining room timed out. Please check the code and try again.', 'error');
      }
    }, 8000);

    socket.emit('join_room', { code, playerName }, (res) => {
      if (responded) return;
      responded = true;
      clearTimeout(timeoutId);

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Enter Room</span><i data-lucide="arrow-right"></i>';
        lucide.createIcons();
      }

      if (!res || res.error) {
        showToast(res?.error || 'Failed to join room.', 'error');
        return;
      }

      state.isHost = false;
      state.roomCode = res.roomCode;
      state.playerName = playerName;
      state.myPlayerId = socket.id;

      playerLobby.roomTag.textContent = `ROOM: ${res.roomCode}`;
      updateLobbyPlayers(res.room);
      showScreen('screen-lobby-player');
      showToast(`Welcome to room ${res.roomCode}, ${playerName}! 🎉`, 'success');
    });
  });

  // Room Update Event (New players joined, player count updated)
  socket.on('room_update', (room) => {
    updateLobbyPlayers(room);
  });

  function updateLobbyPlayers(room) {
    if (!room) return;

    // Update player counts (Max 10 players)
    const count = room.players.length;
    const max = room.maxPlayers || 10;
    const pct = Math.round((count / max) * 100);

    // Host Lobby Elements
    if (hostLobby.playerCount) hostLobby.playerCount.textContent = count;
    if (hostLobby.playerProgress) hostLobby.playerProgress.style.width = `${pct}%`;

    // Render Host Player Chips
    if (hostLobby.playersList) {
      hostLobby.playersList.innerHTML = room.players.map(p => `
        <div class="player-chip">
          <div class="player-avatar-circle">${p.avatar}</div>
          <span class="player-name-text">${escapeHtml(p.name)}</span>
          ${p.isHost ? '<span class="host-badge-chip">👑 Host</span>' : ''}
        </div>
      `).join('');
    }

    // Player Lobby Elements
    if (playerLobby.counter) playerLobby.counter.textContent = `${count} / ${max}`;
    if (playerLobby.playlistText && room.playlistName) {
      playerLobby.playlistText.textContent = room.playlistName;
    }
    if (room.playbackMode) {
      state.playbackMode = room.playbackMode;
      selectedPlaybackMode = room.playbackMode;
      syncPlaybackModeUI(room.playbackMode);
    }
    if (playerLobby.playersList) {
      playerLobby.playersList.innerHTML = room.players.map(p => `
        <div class="player-chip">
          <div class="player-avatar-circle">${p.avatar}</div>
          <span class="player-name-text">${escapeHtml(p.name)}</span>
          ${p.isHost ? '<span class="host-badge-chip">👑 Host</span>' : ''}
        </div>
      `).join('');
    }
  }

  // Host Starts Game
  hostLobby.btnStartGame.addEventListener('click', () => {
    window.audioManager.unlockAudio(false);
    socket.emit('start_game', (res) => {
      if (res && res.error) {
        showToast(res.error, 'error');
      }
    });
  });

  // Mobile Player Sound Check Button in Lobby
  const btnPlayerSoundTest = document.getElementById('btn-player-sound-test');
  const textPlayerSoundTest = document.getElementById('text-player-sound-test');
  const iconPlayerSoundTest = document.getElementById('icon-player-sound-test');

  if (btnPlayerSoundTest) {
    btnPlayerSoundTest.addEventListener('click', () => {
      window.audioManager.unlockAudio(true);
      if (textPlayerSoundTest) textPlayerSoundTest.textContent = 'Sound aktiviert!';
      if (iconPlayerSoundTest) iconPlayerSoundTest.setAttribute('data-lucide', 'check-circle-2');
      btnPlayerSoundTest.classList.add('sound-tested-success');
      if (window.lucide) lucide.createIcons();
      showToast('Sound aktiviert & getestet! 🔊', 'success');
    });
  }

  // Mobile Unmute Fallback Button on Game Stage
  const btnUnmuteMobile = document.getElementById('btn-unmute-mobile');
  if (btnUnmuteMobile) {
    btnUnmuteMobile.addEventListener('click', (e) => {
      e.stopPropagation();
      window.audioManager.resumePendingAudio();
    });
  }

  // Tapping/focusing the guess input also unblocks audio if held by mobile browser
  if (gameScreen.inputGuess) {
    gameScreen.inputGuess.addEventListener('focus', () => {
      window.audioManager.resumePendingAudio();
    });
    gameScreen.inputGuess.addEventListener('touchstart', () => {
      window.audioManager.resumePendingAudio();
    }, { passive: true });
  }

  // =========================================================
  // ACTIVE GAMEPLAY & ROUND LOOP
  // =========================================================
  socket.on('round_start', (data) => {
    revealOverlay.container.style.display = 'none';
    showScreen('screen-game');

    state.currentRound = data.round;
    state.totalRounds = data.totalRounds;
    state.roundDuration = data.duration || 30;
    state.roundTimeLeft = state.roundDuration;
    state.hasGuessedCorrectly = false;
    state.potentialPoints = 1000;
    state.playbackMode = data.playbackMode || 'popular';

    // Reset UI
    gameScreen.roundIndicator.textContent = `${data.round} / ${data.totalRounds}`;
    gameScreen.inputGuess.value = '';
    gameScreen.inputGuess.disabled = false;
    gameScreen.btnSubmitGuess.disabled = false;
    gameScreen.feedbackCard.style.display = 'none';

    // Status text indicates playback mode
    if (state.playbackMode === 'beginning') {
      gameScreen.stageStatusText.textContent = '🎵 Guess the song! (From Beginning: 0:00 Intro)';
    } else {
      gameScreen.stageStatusText.textContent = '🔥 Guess the song!';
    }

    closeAutocomplete();
    gameScreen.inputGuess.focus();

    // Render Initial Scoreboard on right side
    renderScoreboard(data.scoreboard);

    // Play Audio (plays the authentic uncensored chorus)
    window.audioManager.playTrack(data.previewUrl, data.fallbackNotes, data.startOffset || 0);

    // Start Live Audio Visualizer
    startVisualizer();

    // Start 30s Countdown Timer
    startRoundTimer();
  });

  function startRoundTimer() {
    clearInterval(state.timerInterval);
    const startTime = Date.now();
    const durationMs = state.roundDuration * 1000;

    state.timerInterval = setInterval(() => {
      const elapsedMs = Date.now() - startTime;
      const elapsedSec = elapsedMs / 1000;
      const remainingSec = Math.max(0, state.roundDuration - elapsedSec);

      state.roundTimeLeft = remainingSec;

      // Update timer text & progress bar
      gameScreen.timerText.textContent = `${Math.ceil(remainingSec)}s`;
      const progressPct = Math.max(0, (remainingSec / state.roundDuration) * 100);
      gameScreen.timerBar.style.width = `${progressPct}%`;

      // Scoring formula:
      // If guessed within first second (elapsedSec <= 1.0s): exactly 1000 points.
      // After 1s: decays smoothly down to 0 points at second 30.
      if (!state.hasGuessedCorrectly) {
        if (elapsedSec <= 1.0) {
          state.potentialPoints = 1000;
        } else if (remainingSec > 0) {
          const remainingFraction = 1 - ((elapsedSec - 1.0) / (state.roundDuration - 1.0));
          state.potentialPoints = Math.max(50, Math.round(1000 * remainingFraction));
        } else {
          state.potentialPoints = 0;
        }
        if (gameScreen.potentialPoints) {
          gameScreen.potentialPoints.textContent = state.potentialPoints;
        }
      }

      // Audio tick during last 5 seconds
      if (remainingSec <= 5 && remainingSec > 0.5 && Math.floor(remainingSec) !== Math.floor(remainingSec + 0.1)) {
        window.audioManager.playCountdownTick();
      }

      if (remainingSec <= 0) {
        clearInterval(state.timerInterval);
      }
    }, 100);
  }

  // Live Audio Visualizer Canvas
  function startVisualizer() {
    if (state.visualizerAnimationId) {
      cancelAnimationFrame(state.visualizerAnimationId);
    }

    const canvas = gameScreen.visualizerCanvas;
    const ctx = canvas.getContext('2d');
    const stageGlow = document.getElementById('stage-glow');

    function draw() {
      state.visualizerAnimationId = requestAnimationFrame(draw);

      const freqData = window.audioManager.getFrequencyData();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barCount = 36;
      const barWidth = (canvas.width / barCount) - 4;
      let totalEnergy = 0;

      for (let i = 0; i < barCount; i++) {
        const val = freqData[i % freqData.length] || 10;
        totalEnergy += val;
        const barHeight = (val / 255) * canvas.height;

        // Gradient from Spotify green to Cyan
        const grad = ctx.createLinearGradient(0, canvas.height, 0, 0);
        grad.addColorStop(0, '#1DB954');
        grad.addColorStop(1, '#00FFA3');

        ctx.fillStyle = grad;
        const x = i * (barWidth + 4);
        const y = canvas.height - barHeight;

        // Rounded bar tops
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]);
        ctx.fill();
      }

      // Pulse background glow with audio energy
      const avgEnergy = totalEnergy / barCount;
      if (stageGlow) {
        const scale = 0.9 + (avgEnergy / 255) * 0.4;
        stageGlow.style.transform = `translate(-50%, -50%) scale(${scale})`;
      }
    }

    draw();
  }

  // =========================================================
  // GUESS AUTOCOMPLETE & INPUT SUBMISSION (Keyboard & Mouse)
  // =========================================================
  let debounceTimer = null;
  let selectedIndex = -1;
  let currentSuggestions = [];
  let userTypedQuery = '';

  function closeAutocomplete() {
    gameScreen.autocompleteList.style.display = 'none';
    gameScreen.inputGuess.setAttribute('aria-expanded', 'false');
    gameScreen.inputGuess.removeAttribute('aria-activedescendant');
    selectedIndex = -1;
    currentSuggestions = [];
  }

  function setSelectedIndex(index, updateInput = true) {
    const items = gameScreen.autocompleteList.querySelectorAll('.autocomplete-item');
    if (!items.length) {
      selectedIndex = -1;
      return;
    }

    // Unselect all items
    items.forEach(it => {
      it.classList.remove('selected');
      it.setAttribute('aria-selected', 'false');
    });

    if (index >= 0 && index < items.length) {
      selectedIndex = index;
      const activeItem = items[index];
      activeItem.classList.add('selected');
      activeItem.setAttribute('aria-selected', 'true');
      activeItem.scrollIntoView({ block: 'nearest' });
      gameScreen.inputGuess.setAttribute('aria-activedescendant', activeItem.id);

      if (updateInput && currentSuggestions[index]) {
        gameScreen.inputGuess.value = currentSuggestions[index].title;
      }
    } else {
      selectedIndex = -1;
      gameScreen.inputGuess.removeAttribute('aria-activedescendant');
      if (updateInput) {
        gameScreen.inputGuess.value = userTypedQuery;
      }
    }
  }

  gameScreen.inputGuess.addEventListener('input', () => {
    userTypedQuery = gameScreen.inputGuess.value;
    const query = userTypedQuery.trim();
    clearTimeout(debounceTimer);

    if (query.length < 1) {
      closeAutocomplete();
      return;
    }

    debounceTimer = setTimeout(async () => {
      try {
        const roomParam = state.roomCode ? `&room=${encodeURIComponent(state.roomCode)}` : '';
        const res = await fetch(`/api/songs/search?q=${encodeURIComponent(query)}${roomParam}`);
        const suggestions = await res.json();
        renderAutocomplete(suggestions);
      } catch (e) {
        console.warn('Autocomplete fetch error:', e);
      }
    }, 150);
  });

  // Keyboard navigation on input: ArrowDown, ArrowUp, Enter, Escape, Tab
  gameScreen.inputGuess.addEventListener('keydown', (e) => {
    const isListOpen = gameScreen.autocompleteList.style.display === 'flex' && currentSuggestions.length > 0;

    if (!isListOpen) {
      // If user presses ArrowDown when input is not empty but list is closed, re-trigger search
      if (e.key === 'ArrowDown' && gameScreen.inputGuess.value.trim().length >= 1) {
        const query = gameScreen.inputGuess.value.trim();
        const roomParam = state.roomCode ? `&room=${encodeURIComponent(state.roomCode)}` : '';
        fetch(`/api/songs/search?q=${encodeURIComponent(query)}${roomParam}`)
          .then(r => r.json())
          .then(renderAutocomplete)
          .catch(() => { });
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (selectedIndex < currentSuggestions.length - 1) {
        setSelectedIndex(selectedIndex + 1, true);
      } else {
        // Loop back to top
        setSelectedIndex(0, true);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (selectedIndex > 0) {
        setSelectedIndex(selectedIndex - 1, true);
      } else if (selectedIndex === 0) {
        // Return to user's typed query
        setSelectedIndex(-1, true);
      } else {
        // Loop to bottom
        setSelectedIndex(currentSuggestions.length - 1, true);
      }
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < currentSuggestions.length) {
        e.preventDefault();
        const title = currentSuggestions[selectedIndex].title;
        gameScreen.inputGuess.value = title;
        closeAutocomplete();
        submitCurrentGuess(title);
      }
      // If selectedIndex === -1, default form submit handles it
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (userTypedQuery) {
        gameScreen.inputGuess.value = userTypedQuery;
      }
      closeAutocomplete();
    } else if (e.key === 'Tab') {
      if (selectedIndex >= 0 && selectedIndex < currentSuggestions.length) {
        const title = currentSuggestions[selectedIndex].title;
        gameScreen.inputGuess.value = title;
        closeAutocomplete();
      }
    }
  });

  function renderAutocomplete(suggestions) {
    if (!suggestions || suggestions.length === 0) {
      closeAutocomplete();
      return;
    }

    currentSuggestions = suggestions;
    selectedIndex = -1;

    gameScreen.autocompleteList.innerHTML = suggestions.map((s, idx) => `
      <div
        class="autocomplete-item"
        id="autocomplete-item-${idx}"
        role="option"
        aria-selected="false"
        data-index="${idx}"
        data-title="${escapeHtml(s.title)}"
      >
        <span class="autocomplete-item-title">${escapeHtml(s.title)}</span>
        <span class="autocomplete-item-artist">${escapeHtml(s.artist)}</span>
      </div>
    `).join('');

    gameScreen.autocompleteList.style.display = 'flex';
    gameScreen.inputGuess.setAttribute('aria-expanded', 'true');

    // Click & mouse hover handlers for autocomplete suggestions
    gameScreen.autocompleteList.querySelectorAll('.autocomplete-item').forEach((item, idx) => {
      item.addEventListener('mouseenter', () => {
        setSelectedIndex(idx, false);
      });

      item.addEventListener('click', () => {
        const title = item.dataset.title;
        gameScreen.inputGuess.value = title;
        closeAutocomplete();
        submitCurrentGuess(title);
      });
    });
  }

  // Close autocomplete on click outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.autocomplete-wrapper')) {
      closeAutocomplete();
    }
  });

  gameScreen.formGuess.addEventListener('submit', (e) => {
    e.preventDefault();
    closeAutocomplete();
    const guess = gameScreen.inputGuess.value.trim();
    if (guess) {
      submitCurrentGuess(guess);
    }
  });

  function submitCurrentGuess(guess) {
    if (state.hasGuessedCorrectly) return;

    socket.emit('submit_guess', { guess }, (res) => {
      if (!res) return;

      if (res.correct) {
        state.hasGuessedCorrectly = true;
        gameScreen.inputGuess.disabled = true;
        gameScreen.btnSubmitGuess.disabled = true;

        // Sound effect & Confetti
        window.audioManager.playCorrectSound();
        triggerMiniConfetti();

        // Show feedback card
        gameScreen.feedbackCard.className = 'guess-feedback-card';
        gameScreen.feedbackTitle.textContent = '🎉 Correct!';
        gameScreen.feedbackDesc.textContent = `+${res.points} points scored! Total: ${res.newScore} pts`;
        gameScreen.feedbackCard.style.display = 'flex';

        gameScreen.stageStatusText.textContent = `You guessed "${res.title}"! Waiting for others...`;
      } else {
        window.audioManager.playIncorrectSound();

        // Shake feedback
        gameScreen.feedbackCard.className = 'guess-feedback-card incorrect';
        gameScreen.feedbackTitle.textContent = 'Not quite!';
        gameScreen.feedbackDesc.textContent = 'Try another title or artist.';
        gameScreen.feedbackCard.style.display = 'flex';

        setTimeout(() => {
          if (!state.hasGuessedCorrectly) {
            gameScreen.feedbackCard.style.display = 'none';
          }
        }, 2500);
      }
    });
  }

  // Player guessed correctly broadcast (Updates Right-Side Scoreboard)
  socket.on('player_guessed_correctly', (data) => {
    renderScoreboard(data.scoreboard);

    // If another player guessed, show notice
    if (data.playerId !== socket.id) {
      showToast(`⚡ ${data.playerName} guessed the song! (+${data.points} pts)`);
    }
  });

  // Render Right-Side Persistent Scoreboard
  function renderScoreboard(scoreboard) {
    if (!scoreboard || !gameScreen.scoreboardList) return;

    gameScreen.scoreboardList.innerHTML = scoreboard.map((p, idx) => {
      const isMe = p.id === socket.id;
      const rankClass = `rank-${idx + 1}`;
      const guessedClass = p.guessedThisRound ? 'guessed' : '';

      return `
        <div class="scoreboard-row ${rankClass} ${guessedClass}">
          <div class="rank-badge-cell">#${idx + 1}</div>
          <div class="scoreboard-avatar">${p.avatar}</div>
          <div class="scoreboard-info">
            <span class="scoreboard-player-name">
              ${escapeHtml(p.name)} ${isMe ? '<small style="color:var(--accent-cyan)">(You)</small>' : ''}
            </span>
            <span class="scoreboard-player-score">${p.score.toLocaleString()} pts</span>
          </div>
          <div class="scoreboard-status-tag ${p.guessedThisRound ? 'correct' : 'waiting'}">
            ${p.guessedThisRound ? `✅ +${p.pointsEarnedThisRound}` : '🤔 Guessing...'}
          </div>
        </div>
      `;
    }).join('');
  }

  // =========================================================
  // ROUND REVEAL OVERLAY (End of single round)
  // =========================================================
  socket.on('round_reveal', (data) => {
    clearInterval(state.timerInterval);
    window.audioManager.stopTrack();

    revealOverlay.container.style.display = 'flex';
    revealOverlay.songTitle.textContent = data.title;
    revealOverlay.songArtist.textContent = data.artist;
    revealOverlay.songYear.textContent = data.year ? `Released in ${data.year}` : '';

    if (data.artwork) {
      revealOverlay.albumImg.src = data.artwork;
      revealOverlay.albumImg.style.display = 'block';
    } else {
      revealOverlay.albumImg.style.display = 'none';
    }

    if (data.fastestPlayer) {
      revealOverlay.fastestBox.style.display = 'flex';
      revealOverlay.fastestName.textContent = `${data.fastestPlayer.name} (+${data.fastestPlayer.points} pts in ${data.fastestPlayer.time}s)`;
    } else {
      revealOverlay.fastestBox.style.display = 'none';
    }

    // Update scoreboard
    renderScoreboard(data.scoreboard);

    // 5-second countdown
    let secondsLeft = data.nextRoundIn || 5;
    revealOverlay.countdownNumber.textContent = secondsLeft;

    const intermission = setInterval(() => {
      secondsLeft--;
      if (secondsLeft > 0) {
        revealOverlay.countdownNumber.textContent = secondsLeft;
      } else {
        clearInterval(intermission);
      }
    }, 1000);
  });

  // =========================================================
  // END SCREEN / DRAMATIC PODIUM REVEAL SEQUENCE (Game Over)
  // =========================================================
  socket.on('game_over', (data) => {
    clearInterval(state.timerInterval);
    revealOverlay.container.style.display = 'none';
    window.audioManager.stopTrack();

    showScreen('screen-gameover');

    const podium = data.podium || [];
    const p1 = podium[0] || { name: '-', score: 0, avatar: '🥇' };
    const p2 = podium[1] || { name: '-', score: 0, avatar: '🥈' };
    const p3 = podium[2] || { name: '-', score: 0, avatar: '🥉' };

    // Set Data
    podiumScreen.name1.textContent = p1.name;
    podiumScreen.score1.textContent = `${p1.score.toLocaleString()} pts`;
    podiumScreen.avatar1.textContent = p1.avatar;

    podiumScreen.name2.textContent = p2.name;
    podiumScreen.score2.textContent = `${p2.score.toLocaleString()} pts`;
    podiumScreen.avatar2.textContent = p2.avatar;

    podiumScreen.name3.textContent = p3.name;
    podiumScreen.score3.textContent = `${p3.score.toLocaleString()} pts`;
    podiumScreen.avatar3.textContent = p3.avatar;

    // Reset column animation classes
    podiumScreen.col1.classList.remove('revealed');
    podiumScreen.col2.classList.remove('revealed');
    podiumScreen.col3.classList.remove('revealed');

    // Render other players (4-10)
    const otherPlayers = (data.allPlayers || []).slice(3);
    if (otherPlayers.length > 0) {
      podiumScreen.otherBox.style.display = 'block';
      podiumScreen.otherList.innerHTML = otherPlayers.map((p, i) => `
        <div class="player-chip">
          <div class="rank-badge-cell">#${i + 4}</div>
          <div class="player-avatar-circle">${p.avatar}</div>
          <span class="player-name-text">${escapeHtml(p.name)}</span>
          <span class="scoreboard-player-score">${p.score.toLocaleString()} pts</span>
        </div>
      `).join('');
    } else {
      podiumScreen.otherBox.style.display = 'none';
    }

    // Host / Player Replay button state
    if (!state.isHost) {
      podiumScreen.btnReplay.style.display = 'none';
    } else {
      podiumScreen.btnReplay.style.display = 'inline-flex';
    }

    // Sequential Podium Reveal: 3rd -> 2nd -> 1st
    setTimeout(() => {
      // Reveal Place 3
      podiumScreen.col3.classList.add('revealed');
      window.audioManager.playFanfare3();
      showToast(`🥉 3rd Place: ${p3.name}!`);

      setTimeout(() => {
        // Reveal Place 2
        podiumScreen.col2.classList.add('revealed');
        window.audioManager.playFanfare2();
        showToast(`🥈 2nd Place: ${p2.name}!`);

        setTimeout(() => {
          // Reveal Place 1 (Gold Winner!)
          podiumScreen.col1.classList.add('revealed');
          window.audioManager.playFanfare1();
          showToast(`🏆 1st Place & Champion: ${p1.name}! 🎉`, 'success');

          // Massive Confetti Shower!
          triggerVictoryConfetti();
        }, 1400);
      }, 1200);
    }, 600);
  });

  // Podium Action: Replay Game
  podiumScreen.btnReplay.addEventListener('click', () => {
    socket.emit('replay_game');
  });

  socket.on('game_reset_to_lobby', (room) => {
    updateLobbyPlayers(room);
    if (state.isHost) {
      showScreen('screen-lobby-host');
    } else {
      showScreen('screen-lobby-player');
    }
    showToast('Game has been reset! A new round can start.');
  });

  // Podium Action: Quit
  podiumScreen.btnQuit.addEventListener('click', () => {
    window.location.href = '/';
  });

  // =========================================================
  // CELEBRATION EFFECTS (Confetti)
  // =========================================================
  function triggerMiniConfetti() {
    if (typeof confetti === 'function') {
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#1DB954', '#00FFA3', '#FFFFFF']
      });
    }
  }

  function triggerVictoryConfetti() {
    if (typeof confetti !== 'function') return;

    const count = 200;
    const defaults = {
      origin: { y: 0.7 }
    };

    function fire(particleRatio, opts) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio)
      });
    }

    fire(0.25, {
      spread: 26,
      startVelocity: 55,
      colors: ['#FFD700', '#FFA500', '#FFFFFF']
    });
    fire(0.2, {
      spread: 60,
      colors: ['#1DB954', '#00FFA3', '#FF2E93']
    });
    fire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 0.8
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      colors: ['#FFD700', '#1DB954']
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 45
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
});
