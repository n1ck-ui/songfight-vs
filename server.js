const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');
const QRCode = require('qrcode');
const cors = require('cors');
const fs = require('fs');
const { exec } = require('child_process');

const app = express();
app.set('trust proxy', 1);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  transports: ['polling', 'websocket'],
  pingTimeout: 60000,
  pingInterval: 25000,
  allowEIO3: true
});

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Detect LAN IP for QR Code scanning on mobile
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const localIp = getLocalIp();

// Load top songs
let topSongs = [];
try {
  const data = fs.readFileSync(path.join(__dirname, 'data/top1000.json'), 'utf-8');
  topSongs = JSON.parse(data);
  console.log(`Loaded ${topSongs.length} songs from top1000.json`);
} catch (err) {
  console.error('Failed to load songs:', err);
}

// In-memory song cache for audio previews & artwork
const songCache = new Map();

// Helper: Normalize string for track matching
function cleanMatchStr(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

async function resolveSong(song) {
  // If song already has official preview AND genuine artwork, return directly
  if (song.previewUrl && !song.previewUrl.includes('itunes.apple.com') && song.artwork && !song.artwork.includes('ab67706c00006c11bcab826d041d62c6af22c2ec')) {
    return song;
  }
  if (songCache.has(song.id)) {
    return songCache.get(song.id);
  }

  // 0. If song has a Spotify track URI, fetch official Spotify embed preview & artwork
  const trackIdMatch = (song.spotifyUri || song.id || '').toString().match(/track[:\/]([a-zA-Z0-9]+)/);
  if (trackIdMatch) {
    try {
      const spRes = await fetch(`https://open.spotify.com/embed/track/${trackIdMatch[1]}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
        signal: AbortSignal.timeout(3500)
      });
      if (spRes.ok) {
        const html = await spRes.text();
        const m = html.match(/id=\"__NEXT_DATA__\"[^>]*>([\s\S]*?)<\/script>/);
        if (m) {
          const d = JSON.parse(m[1]);
          const ent = d.props?.pageProps?.state?.data?.entity;
          if (ent?.audioPreview?.url) {
            const rawArt = ent.visualIdentity?.image?.[0]?.url;
            const validArt = (rawArt && !rawArt.includes('ab67706c00006c11bcab826d041d62c6af22c2ec')) ? rawArt : song.artwork;
            const resolved = {
              ...song,
              previewUrl: ent.audioPreview.url,
              spotifyPreviewUrl: ent.audioPreview.url,
              artwork: validArt,
              duration: 30
            };
            songCache.set(song.id, resolved);
            return resolved;
          }
        }
      }
    } catch (e) {}
  }

  // 1. Primary: Search Deezer for Uncensored, Official Studio Track with High Popularity Rank
  try {
    const query = `${song.title} ${song.artist}`;
    const res = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=15`, {
      signal: AbortSignal.timeout(4500)
    });
    const data = await res.json();
    const tracks = (data && data.data) ? data.data : [];

    if (tracks.length > 0) {
      const sTitleNorm = cleanMatchStr(song.title);
      const sArtistNorm = cleanMatchStr(song.artist);

      // Score candidates to guarantee the authentic, uncensored original studio track
      const scored = tracks
        .filter(t => t.preview)
        .map(t => {
          let score = 0;
          const tTitleNorm = cleanMatchStr(t.title);
          const tArtistNorm = cleanMatchStr(t.artist?.name);

          // Title matching
          if (tTitleNorm === sTitleNorm) score += 60;
          else if (tTitleNorm.includes(sTitleNorm) || sTitleNorm.includes(tTitleNorm)) score += 30;

          // Artist matching
          if (tArtistNorm.includes(sArtistNorm) || sArtistNorm.includes(tArtistNorm)) score += 40;

          // CRITICAL: Prioritize UNZENSIERT (explicit) versions over clean radio edits!
          if (t.explicit_lyrics) score += 25;

          // Heavily penalize unwanted versions (live, karaoke, tribute, instrumental, acoustic, remix)
          const lower = (t.title || '').toLowerCase();
          if (lower.includes('live')) score -= 40;
          if (lower.includes('karaoke') || lower.includes('tribute') || lower.includes('instrumental')) score -= 70;
          if (lower.includes('remix') && !song.title.toLowerCase().includes('remix')) score -= 30;
          if (lower.includes('acoustic') && !song.title.toLowerCase().includes('acoustic')) score -= 25;

          // Deezer popularity rank (higher = more popular official hit)
          score += (t.rank || 0) / 40000;

          return { track: t, score };
        })
        .sort((a, b) => b.score - a.score);

      const best = scored[0]?.track;
      if (best && best.preview) {
        const resolved = {
          ...song,
          previewUrl: best.preview,
          artwork: best.album?.cover_xl || best.album?.cover_big || best.album?.cover_medium,
          isExplicit: !!best.explicit_lyrics,
          duration: 30
        };
        songCache.set(song.id, resolved);
        return resolved;
      }
    }
  } catch (err) {
    console.warn(`Deezer resolve failed for "${song.title}":`, err.message);
  }

  // 2. Fallback: iTunes (explicit if available)
  try {
    const query = encodeURIComponent(`${song.title} ${song.artist}`);
    const res = await fetch(`https://itunes.apple.com/search?term=${query}&media=music&limit=5`, {
      signal: AbortSignal.timeout(4000)
    });
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      const items = data.results.filter(r => r.previewUrl);
      const best = items.find(r => r.trackExplicitness === 'explicit') || items[0];
      if (best) {
        const resolved = {
          ...song,
          previewUrl: best.previewUrl,
          artwork: best.artworkUrl100 ? best.artworkUrl100.replace('100x100bb', '600x600bb') : null,
          isExplicit: best.trackExplicitness === 'explicit',
          duration: 30
        };
        songCache.set(song.id, resolved);
        return resolved;
      }
    }
  } catch (err) {
    console.warn(`iTunes fallback resolve failed for "${song.title}":`, err.message);
  }

  // 3. Fallback synthesizer
  const fallback = {
    ...song,
    previewUrl: null,
    artwork: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
    duration: 30
  };
  songCache.set(song.id, fallback);
  return fallback;
}

// =========================================================
// REAL 0:00 INTRO ENGINE (Plays song from second 0:00)
// =========================================================
const INTRO_CACHE_DIR = path.join(__dirname, 'public/cache');
if (!fs.existsSync(INTRO_CACHE_DIR)) {
  fs.mkdirSync(INTRO_CACHE_DIR, { recursive: true });
}

async function resolveIntroAudio(song) {
  if (!song || !song.title) return null;
  const safeName = (song.title + '_' + (song.artist || '')).toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 80);
  const targetFile = path.join(INTRO_CACHE_DIR, `intro_${safeName}.mp3`);
  const publicUrl = `/cache/intro_${safeName}.mp3`;

  // 1. Check local disk cache (instant 0ms response)
  if (fs.existsSync(targetFile) && fs.statSync(targetFile).size > 10000) {
    return publicUrl;
  }

  // 2. Download true 0:00-0:30 intro via yt-dlp
  try {
    const query = `${song.title} ${song.artist || ''} official audio`;
    const ytdlpBin = process.env.YTDLP_PATH || (fs.existsSync('/opt/homebrew/bin/yt-dlp') ? '/opt/homebrew/bin/yt-dlp' : 'yt-dlp');
    const cmd = `${ytdlpBin} --extractor-args "youtube:player_client=ios,android,web" --download-sections "*0-30" -f "bestaudio/best" -x --audio-format mp3 -o "${targetFile}" "ytsearch1:${query}" --no-warnings --force-overwrites`;
    await new Promise((resolve, reject) => {
      exec(cmd, { timeout: 8000 }, (err) => {
        if (!err && fs.existsSync(targetFile) && fs.statSync(targetFile).size > 10000) {
          resolve();
        } else {
          reject(err || new Error('Download failed'));
        }
      });
    });
    return publicUrl;
  } catch (err) {
    console.warn(`Intro download fallback for "${song.title}":`, err.message);
    return song.previewUrl; // Fallback to Deezer preview if download fails
  }
}

// Fetch & parse tracks from public Spotify playlist embed
async function fetchSpotifyPlaylistTracks(playlistUrl) {
  try {
    if (!playlistUrl || typeof playlistUrl !== 'string') {
      throw new Error('No playlist link provided');
    }
    const match = playlistUrl.match(/playlist[\/:]([a-zA-Z0-9]+)/);
    if (!match) throw new Error('Invalid Spotify playlist link');
    const id = match[1];

    const res = await fetch(`https://open.spotify.com/embed/playlist/${id}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
      },
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) throw new Error(`Could not load playlist (${res.status})`);

    const html = await res.text();
    const jsonMatch = html.match(/id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!jsonMatch) throw new Error('Could not parse playlist content');

    const data = JSON.parse(jsonMatch[1]);
    const entity = data.props?.pageProps?.state?.data?.entity;
    if (!entity || !entity.trackList || entity.trackList.length === 0) {
      throw new Error('No tracks found in this playlist');
    }

    const playlistName = entity.name || 'Custom Playlist';
    const tracks = entity.trackList.map((t, idx) => ({
      id: t.uri || `custom_${idx}_${Date.now()}`,
      title: t.title,
      artist: t.subtitle || 'Unknown',
      previewUrl: t.audioPreview?.url || null,
      artwork: entity.visualIdentity?.image?.[1]?.url || entity.visualIdentity?.image?.[0]?.url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
      year: '',
      matchTokens: [
        normalizeGuess(t.title),
        normalizeGuess(t.subtitle)
      ]
    }));

    return { success: true, playlistName, trackCount: tracks.length, tracks };
  } catch (err) {
    console.warn('Error fetching custom playlist:', err.message);
    return { success: false, error: err.message };
  }
}

// Top songs are already pre-enriched with Spotify CDN preview URLs and artwork in top1000.json
console.log(`Ready with ${topSongs.length} songs for gameplay.`);

// Active rooms map: roomCode -> room object
const rooms = new Map();

// Helper: Generate unique 4-letter uppercase code
function generateRoomCode() {
  const letters = 'BCDFGHJKLMNPQRSTVWXYZ'; // No ambiguous chars or vowels
  let code = '';
  let attempts = 0;
  do {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    attempts++;
  } while (rooms.has(code) && attempts < 1000);
  return code;
}

// Fun avatars for players
const AVATARS = [
  '🎧', '🎸', '🎹', '🎷', '🎤', '🎺', '🎛️', '🥁', '📻', '⚡', '🔥', '🚀', '🌟', '🦄', '🦁'
];

function getRandomAvatar(existingAvatars = []) {
  const available = AVATARS.filter(a => !existingAvatars.includes(a));
  if (available.length > 0) {
    return available[Math.floor(Math.random() * available.length)];
  }
  return AVATARS[Math.floor(Math.random() * AVATARS.length)];
}

// Clean string for fuzzy guess matching
function normalizeGuess(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/\s*\(.*?\)\s*/g, '') // remove parenthetical (feat, remix, etc.)
    .replace(/[^a-z0-9]/g, '') // remove punctuation/spaces
    .trim();
}

function checkGuessMatch(guess, song) {
  const normGuess = normalizeGuess(guess);
  if (!normGuess || normGuess.length < 2) return false;

  const titleNorm = normalizeGuess(song.title);
  if (normGuess === titleNorm) return true;

  // Substring match if long enough
  if (titleNorm.length >= 4 && (normGuess.includes(titleNorm) || titleNorm.includes(normGuess))) {
    // Prevent false positives on tiny words
    if (normGuess.length >= titleNorm.length * 0.7) {
      return true;
    }
  }

  // Check match tokens
  if (song.matchTokens && Array.isArray(song.matchTokens)) {
    for (const token of song.matchTokens) {
      if (normGuess === token) return true;
    }
  }

  // Simple Levenshtein tolerance for minor typos (1-2 chars difference)
  if (Math.abs(normGuess.length - titleNorm.length) <= 2) {
    const dist = levenshteinDistance(normGuess, titleNorm);
    if (dist <= 2 && dist < titleNorm.length * 0.3) {
      return true;
    }
  }

  return false;
}

function levenshteinDistance(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

// REST APIs
app.get('/api/info', (req, res) => {
  res.json({
    localIp,
    port: PORT,
    totalSongs: topSongs.length
  });
});

// Autocomplete suggestions
app.get('/api/songs/search', (req, res) => {
  const q = req.query.q ? req.query.q.toLowerCase().trim() : '';
  const roomCode = req.query.room ? req.query.room.toUpperCase().trim() : null;
  if (!q || q.length < 1) {
    return res.json([]);
  }

  let pool = topSongs;
  if (roomCode && rooms.has(roomCode)) {
    const r = rooms.get(roomCode);
    if (r.songs && r.songs.length > 0) {
      pool = r.songs;
    }
  }

  const results = [];
  const seen = new Set();

  for (const s of pool) {
    const titleMatch = s.title && s.title.toLowerCase().includes(q);
    const artistMatch = s.artist && s.artist.toLowerCase().includes(q);
    if (titleMatch || artistMatch) {
      const key = `${s.title} - ${s.artist}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push({
          id: s.id,
          title: s.title,
          artist: s.artist,
          year: s.year
        });
        if (results.length >= 8) break; // Limit dropdown suggestions
      }
    }
  }

  res.json(results);
});

// Playlist Preview API
app.get('/api/playlist/preview', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ success: false, error: 'URL required' });
  const result = await fetchSpotifyPlaylistTracks(url);
  res.json({
    success: result.success,
    playlistName: result.playlistName,
    trackCount: result.trackCount,
    error: result.error
  });
});

// QR Code generation endpoint
app.get('/api/qr', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send('Code required');

  const host = req.headers.host || `${localIp}:${PORT}`;
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const url = `${protocol}://${host}/?join=${code}`;

  try {
    const qrDataUrl = await QRCode.toDataURL(url, {
      width: 320,
      margin: 2,
      color: {
        dark: '#0A0B10',
        light: '#00FFA3'
      }
    });
    res.json({ url, qrDataUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Socket.io Game Engine
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Create room
  socket.on('create_room', async ({ hostName, rounds = 5, playlistType = 'default', playlistUrl, playbackMode = 'popular' }, callback) => {
    try {
      if (!hostName || !hostName.trim()) {
        return callback({ error: 'Please enter your name.' });
      }

      let roomSongs = topSongs;
      let playlistName = 'Top Hits (Default)';

      if (playlistType === 'custom' && playlistUrl && playlistUrl.trim()) {
        console.log(`[Spotify Playlist] Loading custom playlist from URL: ${playlistUrl}`);
        const customRes = await fetchSpotifyPlaylistTracks(playlistUrl.trim());
        if (customRes.success && customRes.tracks && customRes.tracks.length > 0) {
          roomSongs = customRes.tracks;
          playlistName = customRes.playlistName;
          console.log(`[Spotify Playlist] Successfully loaded "${playlistName}" (${roomSongs.length} tracks)`);
        } else {
          console.warn(`[Spotify Playlist] Custom playlist failed (${customRes.error}), falling back to default Top Hits`);
        }
      }

      const roomCode = generateRoomCode();
      const hostAvatar = getRandomAvatar();
      const validPlaybackMode = (playbackMode === 'beginning') ? 'beginning' : 'popular';

      const hostPlayer = {
        id: socket.id,
        name: hostName.trim(),
        avatar: hostAvatar,
        isHost: true,
        score: 0,
        guessedThisRound: false,
        guessTime: null,
        pointsEarnedThisRound: 0
      };

      const room = {
        code: roomCode,
        hostId: socket.id,
        hostName: hostPlayer.name,
        playlistType,
        playlistName,
        playbackMode: validPlaybackMode,
        songs: roomSongs,
        totalRounds: Math.min(roomSongs.length, Math.max(1, parseInt(rounds) || 5)),
        currentRound: 0,
        maxPlayers: 10,
        players: [hostPlayer],
        state: 'LOBBY', // LOBBY, PLAYING, REVEAL, GAMEOVER
        currentSong: null,
        playedSongIds: new Set(),
        roundStartTime: 0,
        roundDuration: 30, // seconds
        roundTimer: null,
        revealTimer: null
      };

      rooms.set(roomCode, room);
      socket.join(roomCode);
      socket.roomCode = roomCode;

      // Generate QR Code URL (supports HTTPS & reverse proxies/tunnels)
      const proto = socket.handshake.headers['x-forwarded-proto'] || (socket.handshake.secure ? 'https' : 'http');
      const hostHeader = socket.handshake.headers['x-forwarded-host'] || socket.handshake.headers.host || `${localIp}:${PORT}`;
      const joinUrl = `${proto}://${hostHeader}/?join=${roomCode}`;
      const qrDataUrl = await QRCode.toDataURL(joinUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: '#0d0f17',
          light: '#1DB954'
        }
      });

      console.log(`Room created: ${roomCode} by ${hostPlayer.name} with ${room.totalRounds} rounds [${playlistName}]`);

      callback({
        success: true,
        roomCode,
        joinUrl,
        qrDataUrl,
        playlistName,
        trackCount: roomSongs.length,
        room: serializeRoom(room)
      });
    } catch (err) {
      console.error('Error creating room:', err);
      callback({ error: 'Error creating room.' });
    }
  });

  // Join room
  socket.on('join_room', ({ code, playerName }, callback) => {
    try {
      if (!code || !playerName || !playerName.trim()) {
        return callback({ error: 'Room code and player name are required.' });
      }

      const roomCode = code.toUpperCase().trim();
      const room = rooms.get(roomCode);

      if (!room) {
        return callback({ error: `Room "${roomCode}" does not exist.` });
      }

      if (room.players.length >= room.maxPlayers) {
        return callback({ error: 'This room is full (max 10 players).' });
      }

      if (room.state !== 'LOBBY') {
        return callback({ error: 'The game has already started.' });
      }

      // Check duplicate name
      const cleanName = playerName.trim();
      const existingAvatars = room.players.map(p => p.avatar);
      const avatar = getRandomAvatar(existingAvatars);

      const newPlayer = {
        id: socket.id,
        name: cleanName,
        avatar,
        isHost: false,
        score: 0,
        guessedThisRound: false,
        guessTime: null,
        pointsEarnedThisRound: 0
      };

      room.players.push(newPlayer);
      socket.join(roomCode);
      socket.roomCode = roomCode;

      console.log(`Player "${cleanName}" joined room ${roomCode} (${room.players.length}/${room.maxPlayers})`);

      // Notify all players in room
      io.to(roomCode).emit('room_update', serializeRoom(room));

      callback({
        success: true,
        roomCode,
        player: newPlayer,
        room: serializeRoom(room)
      });
    } catch (err) {
      console.error('Error joining room:', err);
      callback({ error: 'Error joining room.' });
    }
  });

  // Host updates round count
  socket.on('update_rounds', ({ rounds }) => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.hostId !== socket.id || room.state !== 'LOBBY') return;

    room.totalRounds = Math.min(20, Math.max(1, parseInt(rounds) || 5));
    io.to(room.code).emit('room_update', serializeRoom(room));
  });

  // Host updates playback mode ('beginning' vs 'popular')
  socket.on('update_playback_mode', ({ playbackMode }) => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.hostId !== socket.id || room.state !== 'LOBBY') return;

    room.playbackMode = (playbackMode === 'beginning') ? 'beginning' : 'popular';
    console.log(`[${room.code}] Host changed playback mode to: ${room.playbackMode}`);
    io.to(room.code).emit('room_update', serializeRoom(room));
  });

  // Host starts game
  socket.on('start_game', async (dataOrCb, maybeCb) => {
    const callback = typeof dataOrCb === 'function' ? dataOrCb : (typeof maybeCb === 'function' ? maybeCb : null);
    const room = rooms.get(socket.roomCode);
    if (!room) {
      if (typeof callback === 'function') callback({ error: 'Room not found' });
      return;
    }
    if (room.hostId !== socket.id) {
      if (typeof callback === 'function') callback({ error: 'Only the host can start the game' });
      return;
    }
    if (room.state !== 'LOBBY' && room.state !== 'GAMEOVER') {
      if (typeof callback === 'function') callback({ error: 'Game is already running' });
      return;
    }

    console.log(`Starting game in room ${room.code} with ${room.players.length} players`);
    room.currentRound = 0;
    room.playedSongIds.clear();

    // Reset player scores
    room.players.forEach(p => {
      p.score = 0;
      p.guessedThisRound = false;
      p.guessTime = null;
      p.pointsEarnedThisRound = 0;
    });

    if (typeof callback === 'function') callback({ success: true });

    startNextRound(room);
  });

  // Submit guess
  socket.on('submit_guess', ({ guess }, callback) => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.state !== 'PLAYING' || !room.currentSong) {
      return callback && callback({ correct: false, message: 'No active round' });
    }

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return callback && callback({ correct: false });

    if (player.guessedThisRound) {
      return callback && callback({ correct: true, alreadyGuessed: true });
    }

    const isMatch = checkGuessMatch(guess, room.currentSong);

    if (isMatch) {
      const now = Date.now();
      const elapsedSec = (now - room.roundStartTime) / 1000;

      // Scoring formula:
      // If guessed within first second (<= 1.0s): 1000 points.
      // From second 1 to 30: decreases smoothly from 1000 down to 0 points.
      let points = 0;
      if (elapsedSec <= 1.0) {
        points = 1000;
      } else if (elapsedSec < room.roundDuration) {
        const remainingFraction = 1 - ((elapsedSec - 1.0) / (room.roundDuration - 1.0));
        points = Math.max(50, Math.round(1000 * remainingFraction));
      } else {
        points = 0;
      }

      player.guessedThisRound = true;
      player.guessTime = elapsedSec;
      player.pointsEarnedThisRound = points;
      player.score += points;

      console.log(`[${room.code}] Player ${player.name} guessed correctly in ${elapsedSec.toFixed(2)}s! +${points} pts`);

      // Acknowledge to the player
      if (callback) {
        callback({
          correct: true,
          points,
          newScore: player.score,
          title: room.currentSong.title
        });
      }

      // Notify room about updated scoreboard
      io.to(room.code).emit('player_guessed_correctly', {
        playerId: player.id,
        playerName: player.name,
        points,
        scoreboard: getScoreboard(room)
      });

      // Check if all players have guessed
      const allGuessed = room.players.every(p => p.guessedThisRound);
      if (allGuessed) {
        console.log(`[${room.code}] All players guessed! Ending round early.`);
        endCurrentRound(room);
      }
    } else {
      if (callback) {
        callback({ correct: false });
      }
      socket.emit('guess_incorrect');
    }
  });

  // Replay game
  socket.on('replay_game', () => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.hostId !== socket.id) return;

    room.state = 'LOBBY';
    room.currentRound = 0;
    room.playedSongIds.clear();
    room.players.forEach(p => {
      p.score = 0;
      p.guessedThisRound = false;
      p.guessTime = null;
      p.pointsEarnedThisRound = 0;
    });

    io.to(room.code).emit('game_reset_to_lobby', serializeRoom(room));
  });

  // Disconnect / Leave
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    const roomCode = socket.roomCode;
    if (!roomCode) return;

    const room = rooms.get(roomCode);
    if (!room) return;

    const playerIndex = room.players.findIndex(p => p.id === socket.id);
    if (playerIndex !== -1) {
      const removed = room.players.splice(playerIndex, 1)[0];
      console.log(`Player ${removed.name} left room ${roomCode}`);

      // If room is empty, delete room
      if (room.players.length === 0) {
        clearTimeout(room.roundTimer);
        clearTimeout(room.revealTimer);
        rooms.delete(roomCode);
        console.log(`Room ${roomCode} deleted (empty)`);
        return;
      }

      // If host left, assign new host
      if (removed.isHost && room.players.length > 0) {
        room.players[0].isHost = true;
        room.hostId = room.players[0].id;
        room.hostName = room.players[0].name;
        console.log(`New host for ${roomCode}: ${room.hostName}`);
      }

      // Check if remaining players all guessed
      if (room.state === 'PLAYING') {
        const allGuessed = room.players.every(p => p.guessedThisRound);
        if (allGuessed) {
          endCurrentRound(room);
        }
      }

      io.to(roomCode).emit('room_update', serializeRoom(room));
    }
  });
});

// Start next round
async function startNextRound(room) {
  clearTimeout(room.roundTimer);
  clearTimeout(room.revealTimer);

  room.currentRound++;

  // Reset per-round player state
  room.players.forEach(p => {
    p.guessedThisRound = false;
    p.guessTime = null;
    p.pointsEarnedThisRound = 0;
  });

  // Select an unplayed song from room songs or topSongs
  const songPool = (room.songs && room.songs.length > 0) ? room.songs : topSongs;
  let availableSongs = songPool.filter(s => !room.playedSongIds.has(s.id));
  if (availableSongs.length === 0) {
    room.playedSongIds.clear();
    availableSongs = songPool;
  }

  const selectedRaw = availableSongs[Math.floor(Math.random() * availableSongs.length)];
  room.playedSongIds.add(selectedRaw.id);

  // Resolve audio preview
  const resolvedSong = await resolveSong(selectedRaw);
  room.currentSong = resolvedSong;
  room.state = 'PLAYING';
  room.roundStartTime = Date.now();
  room.roundDuration = 30; // 30 seconds

  // Determine active audio URL:
  // If 'beginning' (From Beginning): plays the REAL 0:00 intro of the song!
  // If 'popular' (Default): plays the official uncensored Deezer chorus preview!
  let activeAudioUrl = resolvedSong.previewUrl;
  if (room.playbackMode === 'beginning') {
    activeAudioUrl = await resolveIntroAudio(resolvedSong);
  }

  console.log(`[${room.code}] Round ${room.currentRound}/${room.totalRounds}: "${resolvedSong.title}" by ${resolvedSong.artist} (Mode: ${room.playbackMode})`);

  // Broadcast round start to clients (KEEP TITLE & ARTIST SECRET!)
  io.to(room.code).emit('round_start', {
    round: room.currentRound,
    totalRounds: room.totalRounds,
    duration: room.roundDuration,
    playbackMode: room.playbackMode || 'popular',
    startOffset: 0,
    previewUrl: activeAudioUrl,
    hasPreview: !!activeAudioUrl,
    fallbackNotes: activeAudioUrl ? null : generateSongNotes(resolvedSong.title),
    scoreboard: getScoreboard(room)
  });

  // Timer for round expiration (30 seconds)
  room.roundTimer = setTimeout(() => {
    if (room.state === 'PLAYING') {
      console.log(`[${room.code}] Round ${room.currentRound} time expired!`);
      endCurrentRound(room);
    }
  }, room.roundDuration * 1000);
}

// Generate fallback melodic tones if network preview is unavailable
function generateSongNotes(title) {
  const baseFreqs = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25];
  const notes = [];
  for (let i = 0; i < title.length; i++) {
    const code = title.charCodeAt(i);
    notes.push(baseFreqs[code % baseFreqs.length]);
  }
  return notes.slice(0, 16);
}

// End current round and reveal song details
function endCurrentRound(room) {
  clearTimeout(room.roundTimer);
  room.state = 'REVEAL';

  const song = room.currentSong;
  const scoreboard = getScoreboard(room);

  // Find who was fastest
  let fastestPlayer = null;
  let minTime = Infinity;
  room.players.forEach(p => {
    if (p.guessedThisRound && p.guessTime !== null && p.guessTime < minTime) {
      minTime = p.guessTime;
      fastestPlayer = { name: p.name, time: p.guessTime.toFixed(2), points: p.pointsEarnedThisRound };
    }
  });

  console.log(`[${room.code}] Round ${room.currentRound} revealed: "${song.title}"`);

  io.to(room.code).emit('round_reveal', {
    round: room.currentRound,
    totalRounds: room.totalRounds,
    title: song.title,
    artist: song.artist,
    year: song.year,
    artwork: song.artwork,
    fastestPlayer,
    scoreboard,
    isFinalRound: room.currentRound >= room.totalRounds,
    nextRoundIn: 5 // 5 seconds intermission
  });

  // Intermission before next round or game over
  room.revealTimer = setTimeout(() => {
    if (room.currentRound < room.totalRounds) {
      startNextRound(room);
    } else {
      endGame(room);
    }
  }, 5000);
}

// End game & prepare Top 3 podium
function endGame(room) {
  clearTimeout(room.roundTimer);
  clearTimeout(room.revealTimer);
  room.state = 'GAMEOVER';

  const sorted = [...room.players].sort((a, b) => b.score - a.score);

  // Top 3 for podium
  const podium = [
    sorted[0] || null, // 1st Place (Gold)
    sorted[1] || null, // 2nd Place (Silver)
    sorted[2] || null  // 3rd Place (Bronze)
  ];

  console.log(`[${room.code}] Game Over! Winner: ${sorted[0]?.name} (${sorted[0]?.score} pts)`);

  io.to(room.code).emit('game_over', {
    podium,
    allPlayers: sorted,
    totalRounds: room.totalRounds
  });
}

function getScoreboard(room) {
  return [...room.players]
    .sort((a, b) => b.score - a.score)
    .map((p, index) => ({
      id: p.id,
      rank: index + 1,
      name: p.name,
      avatar: p.avatar,
      score: p.score,
      isHost: p.isHost,
      guessedThisRound: p.guessedThisRound,
      pointsEarnedThisRound: p.pointsEarnedThisRound,
      guessTime: p.guessTime ? p.guessTime.toFixed(1) : null
    }));
}

function serializeRoom(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    hostName: room.hostName,
    playlistType: room.playlistType || 'default',
    playlistName: room.playlistName || 'Top Hits (Default)',
    playbackMode: room.playbackMode || 'popular',
    totalRounds: room.totalRounds,
    currentRound: room.currentRound,
    maxPlayers: room.maxPlayers,
    state: room.state,
    playerCount: room.players.length,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      isHost: p.isHost,
      score: p.score
    }))
  };
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(`🎵 SongFight Server is RUNNING!`);
  console.log(`📡 Local URL:   http://localhost:${PORT}`);
  console.log(`📱 Network URL: http://${localIp}:${PORT}`);
  console.log(`===============================================`);
});
