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

    const data = await fetchLyrics(q, artist || '');
    const { lyrics, officialArtist, officialTitle } = {
      lyrics: { original: data.original, romanized: data.romanized },
      officialArtist: data.officialArtist,
      officialTitle: data.officialTitle
    };
    
    let syncedLyrics = null;
    try {
      console.log(`[LRCLIB DEBUG] Search -> artist: ${officialArtist}, title: ${officialTitle}, targetDuration: ${duration}`);
      
      // If artist is missing or very short, try a broader search using just the title
      const searchParams = (officialArtist && officialArtist.length > 1) 
        ? { artist_name: officialArtist, track_name: officialTitle }
        : { q: officialTitle }; // Broad search if no artist

      const { data: searchResults } = await axios.get('https://lrclib.net/api/search', {
        params: searchParams,
        timeout: 10000 
      });

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
        } else {
          console.log(`[LRCLIB] ✗ Results found, but none had synced lyrics.`);
        }
      } else {
        console.log(`[LRCLIB] ✗ No results found on LRCLIB.`);
      }
    } catch (e) {
      console.log(`[LRCLIB] Error/Timeout: ${e.message}`);
    }

    res.json({ lyrics, syncedLyrics, officialArtist, officialTitle });
  } catch (error) {
    console.error('Error fetching lyrics:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch lyrics' });
  }
});

export default router;
