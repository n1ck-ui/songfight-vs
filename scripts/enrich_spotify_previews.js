const fs = require('fs');
const path = require('path');

const playlistIds = [
  '5ABHKGoOzxkaa28ttQV9sE', // Top 100 streamed
  '4hOKQuZbraPDIfaGbM3lKI', // Top 100 tracks
  '6UeSakyzhiEt4NB3UAd6NQ', // Billboard Hot 100
  '37i9dQZF1DX4o1oenSJRJd', // 2000s
  '37i9dQZF1DX5Ejj0EkURtP', // 2010s
  '37i9dQZF1DXbTxeAdrVG2l', // 90s
  '37i9dQZF1DX4UtSsGT1Sbe', // 80s
  '37i9dQZF1DWTJ7xPn4vNaz', // 70s
  '37i9dQZF1DXa2PvUpywmrr', // 2020s
  '37i9dQZF1DWXRqgorJj26U', // Rock classics
  '37i9dQZF1DX0XUsuxWHRQd', // RapCaviar
  '37i9dQZF1DXcBWIGoYBM5M', // Today's Top Hits
  '37i9dQZF1DX7iB3RCnBnN4', // Billions club
  '37i9dQZF1DX1lVhptIYRda', // Hot Hits
  '37i9dQZF1DX0KBJZpiYUKg', // Mega Hit Mix
  '37i9dQZF1DX3rxVfibe1L0', // Mood Booster
  '37i9dQZF1DXdPec7aLTmlC', // Happy Hits
  '37i9dQZF1DWWMOmoXKqHTD', // Sing in shower
  '37i9dQZF1DX4WYpdgoIcn6', // Chill hits
  '37i9dQZF1DX843Qf4lrFtZ', // 2010s mix
  '37i9dQZF1DX3oM43CtKnRV', // 00s rock anthems
  '37i9dQZF1DX2L0iB23Enbq', // Viral hits
  '37i9dQZF1DX4dyzvuaRJ0n', // Electronic circus
  '37i9dQZF1DX8WusIm1lZpm', // Dance party
  '37i9dQZF1DX1MUPbip1Yr4', // Pop remastered
  '37i9dQZF1DXbYM3nMM0oPk', // Soft pop hits
  '37i9dQZF1DX0Yxoavh5qJV', // 90s rock anthems
  '37i9dQZF1DX1rVvRgjX59F', // 90s dance party
  '37i9dQZF1DX9XIFNgkfAnY', // 70s rock anthems
  '37i9dQZF1DX8Uebhn9wzrS', // Greatest rock songs
  '37i9dQZF1DX76Wlfdnj7AP', // Beast mode
  '37i9dQZF1DXcfZ6moR6J06', // Feeling good
  '37i9dQZF1DX9553j1rPXHF', // 2000s pop
  '37i9dQZF1DX4U2t0wENX6y', // Hits of decades
  '37i9dQZF1DX56bqlsMxaaa', // Retro pop
  '37i9dQZF1DX504r91u74vW', // Throwback thursday
  '37i9dQZF1DX8s9vQv2f92Q', // Acoustic hits
  '37i9dQZF1DX2Ac74W1vP59', // Hip hop drive
  '37i9dQZF1DWYBO1MoTDohM', // Global X
  '37i9dQZF1DXatqB36S1m3N', // Pop all stars
  '37i9dQZF1DX70RN3TfWWJh', // Workout
  '37i9dQZF1DX92mlUPqVfLL', // Pop hits 2000-2024
  '37i9dQZF1DWVuV87wUBNZh', // Hit after hit
  '37i9dQZF1DX2sUQwD7qbmL', // Feel good indie rock
  '37i9dQZF1DWZtZ8vLCBsPP', // Pop drive
  '37i9dQZF1DXbcP8BbYEQMe', // Summer party
  '37i9dQZF1DX6GwdWRQMoHG', // Hits unlimited
  '37i9dQZF1DX02PsFgHRbtp', // Top Hits 2018
  '37i9dQZF1DX4X2tF54U9um', // Top Hits 2017
  '37i9dQZF1DX7bFLQj51jB1', // Top Hits 2016
  '37i9dQZF1DX57i2iF5eBjh', // Top Hits 2015
  '37i9dQZF1DX77209uN578T', // Top Hits 2014
  '37i9dQZF1DX24SZv4wI7w2', // Top Hits 2013
  '37i9dQZF1DX3qFfG5bJ1b8', // Top Hits 2012
  '37i9dQZF1DX0hB5Bq3V8p3', // Top Hits 2011
  '37i9dQZF1DWTE7dVYLL0Fn', // Top Hits 2010
  '37i9dQZF1DWW2hH4io8hhf', // Top Hits 2009
  '37i9dQZF1DX9T5ukL87Kh0', // Top Hits 2008
  '37i9dQZF1DWWTI49Yqf6ym', // Top Hits 2007
  '37i9dQZF1DWSoKog4f3dMo', // Top Hits 2006
  '37i9dQZF1DX5vxe9q794gU', // Top Hits 2005
  '37i9dQZF1DX6fD4O510z2n', // Top Hits 2004
  '37i9dQZF1DWYm11EcfWn4J', // Top Hits 2003
  '37i9dQZF1DWVEvbdYgZg8f', // Top Hits 2002
  '37i9dQZF1DWVl07Zlff2U4', // Top Hits 2001
  '37i9dQZF1DXce6Y6T2P1w8'  // Top Hits 2000
];

function cleanKeys(str, artist = '') {
  if (!str) return [];
  const sNorm = str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const aNorm = (artist || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const k1 = sNorm.replace(/[^a-z0-9]/g, '');
  const k2 = sNorm.replace(/\s*\(.*?\)\s*/g, '').replace(/[^a-z0-9]/g, '');
  const k3 = sNorm.replace(/\s+[-–—]\s+.*$/, '').replace(/\s*\(.*?\)\s*/g, '').replace(/[^a-z0-9]/g, '');

  const results = [k1, k2, k3].filter(Boolean);
  if (aNorm) {
    const aClean = aNorm.replace(/[^a-z0-9]/g, '');
    results.push(k1 + aClean, k2 + aClean, k3 + aClean);
  }
  return [...new Set(results)];
}

async function main() {
  const songsPath = path.join(__dirname, '../data/top1000.json');
  const songs = JSON.parse(fs.readFileSync(songsPath, 'utf-8'));
  console.log(`Starting Spotify preview enrichment for ${songs.length} songs...`);

  const previewDb = new Map();

  function addTrack(t, sourceArtwork = null) {
    if (!t || !t.audioPreview?.url) return;
    const keys = cleanKeys(t.title, t.subtitle);
    const entry = {
      previewUrl: t.audioPreview.url,
      artwork: sourceArtwork || t.visualIdentity?.image?.[0]?.url || t.album?.images?.[0]?.url || null,
      spotifyUri: t.uri,
      title: t.title,
      artist: t.subtitle
    };
    for (const k of keys) {
      if (!previewDb.has(k)) previewDb.set(k, entry);
    }
  }

  // 1. Fetch Spotify Playlists
  console.log(`Fetching ${playlistIds.length} Spotify playlists...`);
  const batchSize = 6;
  for (let i = 0; i < playlistIds.length; i += batchSize) {
    const chunk = playlistIds.slice(i, i + batchSize);
    await Promise.all(chunk.map(async (pid) => {
      try {
        const res = await fetch(`https://open.spotify.com/embed/playlist/${pid}`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
        });
        if (!res.ok) return;
        const html = await res.text();
        const m = html.match(/id=\"__NEXT_DATA__\"[^>]*>([\s\S]*?)<\/script>/);
        if (!m) return;
        const data = JSON.parse(m[1]);
        const entity = data.props?.pageProps?.state?.data?.entity;
        if (!entity || !entity.trackList) return;
        const art = entity.visualIdentity?.image?.[0]?.url;
        for (const t of entity.trackList) {
          addTrack(t, art);
        }
      } catch (e) {}
    }));
  }

  console.log(`Collected ${previewDb.size} Spotify preview keys from playlists.`);

  // 2. Artist top tracks
  const allArtists = [...new Set(songs.map(s => {
    return s.artist.split(/\s*(?:&|ft\.|feat\.|with|,)\s*/i)[0].trim();
  }))];

  console.log(`Resolving Spotify artist embeds for ${allArtists.length} artists...`);

  for (const artistName of allArtists) {
    try {
      const mbRes = await fetch(`https://musicbrainz.org/ws/2/artist/?query=artist:"${encodeURIComponent(artistName)}"&fmt=json`, {
        headers: { 'User-Agent': 'SongFight/1.0.0 ( contact@songfight.local )' }
      });
      if (!mbRes.ok) continue;
      const mbData = await mbRes.json();
      const artist = mbData.artists?.[0];
      if (!artist) continue;

      const uRes = await fetch(`https://musicbrainz.org/ws/2/artist/${artist.id}?inc=url-rels&fmt=json`, {
        headers: { 'User-Agent': 'SongFight/1.0.0 ( contact@songfight.local )' }
      });
      if (!uRes.ok) continue;
      const uData = await uRes.json();
      const sRel = uData.relations?.find(r => r.url?.resource?.includes('spotify.com/artist/'));
      if (sRel) {
        const aMatch = sRel.url.resource.match(/artist\/([a-zA-Z0-9]+)/);
        if (aMatch) {
          const artistId = aMatch[1];
          const spRes = await fetch(`https://open.spotify.com/embed/artist/${artistId}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
          });
          if (spRes.ok) {
            const html = await spRes.text();
            const m = html.match(/id=\"__NEXT_DATA__\"[^>]*>([\s\S]*?)<\/script>/);
            if (m) {
              const d = JSON.parse(m[1]);
              const ent = d.props?.pageProps?.state?.data?.entity;
              for (const t of ent?.trackList || []) {
                addTrack(t);
              }
            }
          }
        }
      }
      await new Promise(r => setTimeout(r, 600));
    } catch (e) {}
  }

  // 3. Update top1000.json with exact Spotify previews
  let finalMatched = 0;
  const enriched = songs.map(s => {
    const keys = cleanKeys(s.title, s.artist);
    let hit = null;
    for (const k of keys) {
      if (previewDb.has(k)) {
        hit = previewDb.get(k);
        break;
      }
    }
    if (hit) {
      finalMatched++;
      return {
        ...s,
        previewUrl: hit.previewUrl,
        spotifyPreviewUrl: hit.previewUrl,
        artwork: hit.artwork || s.artwork || null,
        spotifyUri: hit.spotifyUri || null
      };
    }
    return s;
  });

  fs.writeFileSync(songsPath, JSON.stringify(enriched, null, 2), 'utf-8');
  console.log(`Enrichment complete! Saved ${enriched.length} songs. Exact Spotify Previews matched: ${finalMatched}/${songs.length}`);
}

main().catch(console.error);
