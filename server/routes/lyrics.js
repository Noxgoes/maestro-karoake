import express from 'express';
import axios from 'axios';
import { fetchLyrics } from '../utils/geniusClient.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { q, artist, duration } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Song name (q) is required' });
    }

    let lyrics = { original: [], romanized: [] };
    let officialArtist = artist || '';
    let officialTitle = q;
    let source = 'Genius';

    try {
      console.log(`[LYRICS] Searching Genius for: ${q}...`);
      const data = await fetchLyrics(q, artist || '');
      lyrics = { original: data.original, romanized: data.romanized };
      officialArtist = data.officialArtist;
      officialTitle = data.officialTitle;
      console.log(`[LYRICS] ✓ Genius success: ${officialTitle}`);
    } catch (err) {
      console.warn(`[LYRICS] Genius failed: ${err.message}. Trying LRCLIB fallback...`);
      source = 'LRCLIB';
    }
    
    let syncedLyrics = null;
    let plainLyricsFallback = null;
    try {
      console.log(`[LRCLIB DEBUG] Search -> artist: ${officialArtist}, title: ${officialTitle}, targetDuration: ${duration}`);
      
      // Use a broad search query to be more forgiving with spelling/formatting
      const searchParams = { q: `${officialTitle} ${officialArtist}`.trim() };

      let { data: searchResults } = await axios.get('https://lrclib.net/api/search', {
        params: searchParams,
        timeout: 20000,
        headers: {
          'User-Agent': 'MaestroKaraoke/1.0 (https://github.com/Noxgoes/maestro-karoake)'
        }
      });

      // ── SECONDARY FALLBACK: If title+artist fails, try Title Only ──
      if ((!searchResults || searchResults.length === 0) && officialArtist) {
        console.log(`[LRCLIB] Title+Artist failed. Trying Title-only: ${officialTitle}`);
        const secondary = await axios.get('https://lrclib.net/api/search', {
          params: { q: officialTitle },
          timeout: 20000,
          headers: { 'User-Agent': 'MaestroKaraoke/1.0 (https://github.com/Noxgoes/maestro-karoake)' }
        });
        searchResults = secondary.data;
      }

      if (Array.isArray(searchResults) && searchResults.length > 0) {
        // Sort by duration proximity if duration is provided
        const bestMatch = searchResults
          .filter(r => r.syncedLyrics)
          .sort((a, b) => {
            if (duration) {
              const diffA = Math.abs(a.duration - parseFloat(duration));
              const diffB = Math.abs(b.duration - parseFloat(duration));
              return diffA - diffB;
            }
            // Fallback: prioritize exact track name match
            const aExact = a.trackName.toLowerCase() === q.toLowerCase() ? 0 : 1;
            const bExact = b.trackName.toLowerCase() === q.toLowerCase() ? 0 : 1;
            return aExact - bExact;
          })[0];

        if (bestMatch) {
          console.log(`[LRCLIB] ✓ Match Found: ${bestMatch.trackName} (${(bestMatch.duration / 60).toFixed(2)}m)`);
          syncedLyrics = bestMatch.syncedLyrics;
          plainLyricsFallback = bestMatch.plainLyrics;
          // If we didn't get title/artist from Genius, use LRCLIB's
          if (!officialTitle || officialTitle === q) officialTitle = bestMatch.trackName;
          if (!officialArtist) officialArtist = bestMatch.artistName;
        } else {
          console.log(`[LRCLIB] ✗ Results found, but none had synced/plain lyrics.`);
        }
      } else {
        console.log(`[LRCLIB] ✗ No results found on LRCLIB.`);
      }
    } catch (err) {
      console.error('[LRCLIB] API error:', err.message);
      if (err.response) {
        console.error('[LRCLIB] API Response data:', err.response.data);
      }
    }

    // ── FALLBACK: If Genius failed but LRCLIB has lyrics, mock the Genius output ──
    if (lyrics.original.length === 0 && (plainLyricsFallback || syncedLyrics)) {
      // If plainLyrics is missing, extract it from syncedLyrics by stripping [00:00.00] tags
      const rawSource = plainLyricsFallback || syncedLyrics.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '');
      
      // Split by lines and remove \r (Windows line endings)
      const lines = rawSource.split('\n').map(l => l.replace('\r', '').trim());
      
      let wordIdx = 0;
      lyrics.original = lines.flatMap((line, lIdx) => {
        // Skip metadata lines like [by: designer] or [length: 03:45]
        if (line.startsWith('[') && line.includes(':')) return [];
        
        return line.split(/\s+/).filter(w => w).map(w => ({
          word: w,
          lineIndex: lIdx,
          wordIndex: wordIdx++
        }));
      });
      
      console.log(`[FALLBACK] Successfully parsed ${lyrics.original.length} words from LRCLIB source.`);
    }

    if (lyrics.original.length === 0) {
      return res.status(404).json({ error: 'No lyrics found on Genius or LRCLIB' });
    }

    res.json({
      lyrics,
      officialArtist,
      officialTitle,
      syncedLyrics,
      source
    });
  } catch (error) {
    console.error('API Error:', error.message);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

export default router;
