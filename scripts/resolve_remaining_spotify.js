const fs = require('fs');
const path = require('path');

const trackIdMap = {
  // Batch 1
  57: '0V3wPSX9ygBnCm8psDIegu', // Anti-Hero
  59: '07KXEDtdWjWNRk0jNVCr0W', // Shake It Off
  64: '6xGruZohLs39ZbVccQTuP2', // Glimpse of Us
  74: '0WfzkwIAYhIBY9s2r3z0Pj', // Grenade
  76: '48IAF0ySXRvCKjh7hnYAlJ', // What Do You Mean?
  86: '1bDbXMyjaUIooNwFE9wn0N', // Rich Flex

  // Batch 2
  80: '4NwwBuvExlBochBuUsFJ5S', // FE!N
  88: '2G7V7zsVDxg1yRsu7Ew9RJ', // In My Feelings
  109: '3TahdwXBimb0GJiqL4peIV', // Moves Like Jagger
  113: '7fa9MBXhVfQ8P8Df9OEbD8', // Girls Like You
  119: '6O20JhBJhvShKAm021T7xV', // Diamonds

  // Batch 3
  123: '1HzL8HBwrkgRwtUSzUEAH8', // Work
  132: '5uQr4k2G228z2yX6j7Sj1q', // Born This Way
  135: '45iRzR2Xb6m3n85P0t4q76', // Hey Brother
  137: '5UusFdtcdVwU9q5gq6vMvP', // Levels
  138: '2P4OICLsveDRrRAlL6F1m8', // Waiting For Love

  // Batch 4 & 5
  143: '3bH4H25va8LPUz13hnbdE4', // Cheap Thrills
  144: '4ofwffwvvRpYeSV62gyx4t', // Chandelier
  146: '1v0m0t9eWp2F2WfBf7j5Yj', // Elastic Heart
  153: '4Yf5bqU3NK4kNOypcrLYwU', // Faint
  169: '1Zoyhvwzu5hbqM3EN3oN3v', // Champagne Supernova
  176: '4cOdK2wGLETKBW3PvgPWqT', // Never Gonna Give You Up
  181: '2fc7ZkI28a1UuS2K7xXf2D', // Bad
  185: '3GIZdmxX1wUjXo8W6Z98wK', // Waterloo

  // Batch 6
  186: '7hQJA50XrCWABAu5v6QZ4i', // Don't Stop Me Now
  189: '4pbG9SUmWIvsROVLF0zFH9', // We Will Rock You
  190: '73bKnpoUtNfcICA4hAXIQf', // We Are the Champions
  193: '5nCEK7Jk6Y6m7bV9hE1u7S', // Careless Whisper
  194: '0nDThzZCE4gK4uXvC6H2W6', // Faith

  // Batch 7
  196: '3fYgAWkavsbGZT0aP81YhN', // Roxanne
  199: '3owxH7bM1p1N39U4h8zXzP', // Go Your Own Way
  201: '4IZ2xT6NfyQ9zH3f79sP3d', // I'm Still Standing
  203: '2CpCYgMajvRsXgDya5W7bJ', // September
  205: '3ZFTkvIE7kyPt6Nu0LPk7m', // Hips Don't Lie

  // Batch 8
  206: '2CdzngAIUBVPCavWlfriGz', // Waka Waka
  207: '1k1evX0BXHBqzjjY97UzwZ', // Whenever, Wherever
  211: '2Foc5Q5nqNiosCNqttzH9C', // Get Lucky
  212: '0baSTvuIZtwaDvdE3tkkxa', // One More Time
  213: '5W3cjX2J3tjhG8zb6u0qHn', // Harder, Better, Faster, Stronger

  // Batch 9
  216: '2fXiZar44k73w571z8p4N6', // Clint Eastwood
  220: '5nxnzpXn5MCE5L6A52zF12', // Stay With Me
  225: '60nZcImufyMA1MKQY3dcCH', // We Don't Talk Anymore
  226: '4XnngzUuV5SLnnXnQOHePR', // Lose You to Love Me
  229: '2AyQa6vauX9x3B8P4dG80P', // Mi Gente

  // Batch 10
  230: '4MzXwWMhyBbmu6qOcLVD3e', // Dakiti
  231: '6USfx6gyCsj50MWPKQEFVQ', // Me Porto Bonito
  234: '5WhrUGbV38p34u0kYVwZ9v', // Bailando
  235: '62PaGYgPTW8JJMP8RBdCiR', // Radioactive
  240: '6Z8R6UsFuGXGtiIxiN8ISb', // Safe and Sound

  // Batch 11
  241: '1eyzqe2QqGZUmfcPZtrIyt', // Midnight City
  242: '3Fljcg70SJsePKwMCuzJuk', // Take a Slice
  243: '1gk3FdHOHwkyLjzHWJkUpa', // Gooey
  244: '2cuNGveZzyJLIMzaf6xSjS', // Little Talks
  245: '1qUUw7INIib0dcX7qY5GBs', // Ho Hey

  // Batch 12
  246: '35pxRDrtcJm0cnHqaZdgEn', // Ophelia
  247: '4vpvWaYsNxKhuHE5GHwrfO', // Budapest
  248: '4efhKxEShnkJKkJZ0ZdbRd', // Shotgun
  250: '3ZAbzT3EIBAM4pDB6pD8V6', // Hold Back the River
  251: '1pQtiUNaBpjcspLcqetigX', // Let It Go

  // Batch 13
  258: '3IDoYVBSntcx8uF3T32gD8', // HOT TO GO!
  259: '1EAxNqdkV5kPps7GhoRIQB', // Pink Venom
  261: '2bgKWfId3UaDGVPFPxvsbC', // Butter
  83: '3GCdLUSnKSMJhs4Tj6CV3s',  // All The Stars
  63: '0ZEPcnNBmE0KQDnTf0D4N1'   // Until I Found You
};

async function fetchSpotifyEmbed(trackId) {
  try {
    const res = await fetch(`https://open.spotify.com/embed/track/${trackId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
    });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/id=\"__NEXT_DATA__\"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) return null;
    const data = JSON.parse(m[1]);
    const entity = data.props?.pageProps?.state?.data?.entity;
    return {
      previewUrl: entity?.audioPreview?.url || null,
      artwork: entity?.visualIdentity?.image?.[0]?.url || null,
      spotifyUri: entity?.uri || `spotify:track:${trackId}`
    };
  } catch (e) {
    return null;
  }
}

async function main() {
  const songsPath = path.join(__dirname, '../data/top1000.json');
  const songs = JSON.parse(fs.readFileSync(songsPath, 'utf-8'));

  console.log(`Resolving ${Object.keys(trackIdMap).length} targeted Spotify track IDs...`);

  let added = 0;
  for (const song of songs) {
    if (!song.previewUrl && trackIdMap[song.id]) {
      const tid = trackIdMap[song.id];
      const result = await fetchSpotifyEmbed(tid);
      if (result && result.previewUrl) {
        song.previewUrl = result.previewUrl;
        song.spotifyPreviewUrl = result.previewUrl;
        if (result.artwork) song.artwork = result.artwork;
        song.spotifyUri = result.spotifyUri;
        added++;
        console.log(`[#${song.id}] Resolved "${song.title}" => ${result.previewUrl}`);
      } else {
        console.warn(`[#${song.id}] Preview null for "${song.title}" (track ${tid})`);
      }
      await new Promise(r => setTimeout(r, 150));
    }
  }

  // Count total resolved
  const totalWithPreview = songs.filter(s => s.previewUrl).length;
  fs.writeFileSync(songsPath, JSON.stringify(songs, null, 2), 'utf-8');
  console.log(`Successfully updated top1000.json! Added ${added} tracks. Total verified Spotify previews: ${totalWithPreview}/${songs.length} (${Math.round(totalWithPreview / songs.length * 100)}%)`);
}

main().catch(console.error);
