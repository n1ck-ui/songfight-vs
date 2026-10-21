const fs = require('fs');
const path = require('path');

const songsPath = path.join(__dirname, '../data/top1000.json');
const songs = JSON.parse(fs.readFileSync(songsPath, 'utf-8'));

console.log(`Starting artwork resolution for ${songs.length} songs...`);

async function fetchArtwork(title, artist, spotifyUri) {
  // 1. Try iTunes Search API (fast, high quality 600x600)
  try {
    const cleanTitle = title.replace(/\s*[-–—]\s*.*$/, '').replace(/\s*\(.*?\)\s*/g, '').trim();
    const cleanArtist = artist.split(/\s*(?:&|ft\.|feat\.|with|,)\s*/i)[0].trim();
    const query = encodeURIComponent(`${cleanTitle} ${cleanArtist}`);
    const res = await fetch(`https://itunes.apple.com/search?term=${query}&media=music&limit=3`, {
      signal: AbortSignal.timeout(4000)
    });
    if (res.ok) {
      const data = await res.json();
      const match = data.results?.find(r => r.artworkUrl100) || data.results?.[0];
      if (match?.artworkUrl100) {
        return match.artworkUrl100.replace('100x100bb', '600x600bb');
      }
    }
  } catch (e) {}

  // 2. Try Deezer Search API
  try {
    const cleanTitle = title.replace(/\s*[-–—]\s*.*$/, '').replace(/\s*\(.*?\)\s*/g, '').trim();
    const query = encodeURIComponent(`${cleanTitle} ${artist}`);
    const res = await fetch(`https://api.deezer.com/search?q=${query}&limit=3`, {
      signal: AbortSignal.timeout(4000)
    });
    if (res.ok) {
      const data = await res.json();
      const match = data.data?.[0]?.album;
      if (match?.cover_xl || match?.cover_big) {
        return match.cover_xl || match.cover_big;
      }
    }
  } catch (e) {}

  // 3. Try Spotify Track Embed if spotifyUri is available
  if (spotifyUri) {
    const m = spotifyUri.match(/track[:\/]([a-zA-Z0-9]+)/);
    if (m) {
      try {
        const res = await fetch(`https://open.spotify.com/embed/track/${m[1]}`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
          signal: AbortSignal.timeout(4000)
        });
        if (res.ok) {
          const html = await res.text();
          const jsonMatch = html.match(/id=\"__NEXT_DATA__\"[^>]*>([\s\S]*?)<\/script>/);
          if (jsonMatch) {
            const d = JSON.parse(jsonMatch[1]);
            const art = d.props?.pageProps?.state?.data?.entity?.visualIdentity?.image?.[0]?.url;
            if (art && !art.includes('ab67706c00006c11bcab826d041d62c6af22c2ec')) {
              return art;
            }
          }
        }
      } catch (e) {}
    }
  }

  return null;
}

async function run() {
  let updatedCount = 0;
  const concurrency = 6;
  
  for (let i = 0; i < songs.length; i += concurrency) {
    const batch = songs.slice(i, i + concurrency);
    await Promise.all(batch.map(async (song, idx) => {
      const overallIdx = i + idx;
      const art = await fetchArtwork(song.title, song.artist, song.spotifyUri);
      if (art) {
        song.artwork = art;
        updatedCount++;
      }
      console.log(`[${overallIdx + 1}/${songs.length}] ${song.title} by ${song.artist} -> ${art ? '✓' : '✗'}`);
    }));
  }

  fs.writeFileSync(songsPath, JSON.stringify(songs, null, 2), 'utf-8');
  console.log(`\nDone! Successfully updated artwork for ${updatedCount}/${songs.length} songs.`);
}

run().catch(console.error);
