import express from 'express';
import axios from 'axios';
import { fetchLyrics, searchGenius } from '../utils/geniusClient.js';

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
      console.log(`[METADATA] Fetching official info from Genius: ${q}...`);
      // We only use Genius for metadata (posters, official names)
      // We skip fetchLyrics() because it tries to scrape, which is blocked.
      const searchResult = await searchGenius(q + (artist ? ` ${artist}` : ''));
      
      if (searchResult) {
        officialArtist = searchResult.primary_artist.name;
        officialTitle = searchResult.title;
        // Use the Genius header image as the poster fallback
        lyrics.poster = searchResult.header_image_url; 
        console.log(`[METADATA] ✓ Genius info found: ${officialTitle}`);
      }
    } catch (err) {
      console.warn(`[METADATA] Genius metadata search failed: ${err.message}`);
    }
    
    // We ALWAYS use LRCLIB as the primary source for lyrics now
    source = 'LRCLIB';
    
    let syncedLyrics = null;
    let plainLyricsFallback = null;
    try {
      // ── METADATA CLEANING ──
      // Genius often returns "Song Title (Romanized)" or "Artist - Song Title"
      // We clean this up to help LRCLIB find it.
      const cleanTitle = officialTitle
        .replace(/\(Romanized\)/gi, '')
        .replace(/\(Hindi\)/gi, '')
        .replace(/\[.*\]/g, '')
        .split(' - ').pop() // Handle "Artist - Title" formats
        .trim();
        
      const cleanArtist = (officialArtist === 'Genius Romanizations') ? (artist || '') : officialArtist;

      const searchSteps = [
        { q: `${cleanTitle} ${cleanArtist}`.trim(), label: 'Cleaned Metadata' },
        { q: cleanTitle, label: 'Title Only' },
        { q: q, label: 'Original Query Fallback' }
      ];

      console.log(`[LRCLIB] Starting search pipeline for: "${q}"`);

      for (const step of searchSteps) {
        if (!step.q || step.q.length < 2) continue;
        console.log(`[LRCLIB] Step: ${step.label} -> Query: "${step.q}"...`);
        
        const { data: results } = await axios.get('https://lrclib.net/api/search', {
          params: { q: step.q },
          timeout: 20000,
          headers: { 'User-Agent': 'MaestroKaraoke/1.0' }
        });

        if (Array.isArray(results) && results.length > 0) {
          // Detect Hindi script
          const hindiResults = results.filter(r => /[\u0900-\u097F]/.test(r.plainLyrics || r.syncedLyrics || ''));
          const pool = hindiResults.length > 0 ? hindiResults : results;

          const bestMatch = pool
            .filter(r => r.syncedLyrics)
            .sort((a, b) => {
              if (duration) {
                const diffA = Math.abs(a.duration - parseFloat(duration));
                const diffB = Math.abs(b.duration - parseFloat(duration));
                return diffA - diffB;
              }
              return 0;
            })[0] || pool[0];

          if (bestMatch && (bestMatch.syncedLyrics || bestMatch.plainLyrics)) {
            syncedLyrics = bestMatch.syncedLyrics;
            plainLyricsFallback = bestMatch.plainLyrics;
            
            // Sync official metadata back if it was messy
            if (officialArtist === 'Genius Romanizations' || !officialArtist) officialArtist = bestMatch.artistName;
            if (officialTitle.includes('-') || officialTitle.includes('(')) officialTitle = bestMatch.trackName;
            
            console.log(`[LRCLIB] ✓ Success with ${step.label}: "${bestMatch.trackName}"`);
            break; 
          }
        }
      }

      if (!syncedLyrics && !plainLyricsFallback) {
        console.log(`[LRCLIB] ✗ No lyrics found in any search step.`);
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
