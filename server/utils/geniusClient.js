import axios from 'axios';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const GENIUS_ACCESS_TOKEN = process.env.GENIUS_ACCESS_TOKEN;
const GENIUS_BASE_URL = process.env.GENIUS_BASE_URL || 'https://api.genius.com';

export async function searchGenius(query) {
  if (!GENIUS_ACCESS_TOKEN) {
    console.warn('GENIUS_ACCESS_TOKEN is not set, skipping API call');
    return null;
  }
  
  try {
    const response = await axios.get(`${GENIUS_BASE_URL}/search`, {
      params: { q: query },
      headers: {
        Authorization: `Bearer ${GENIUS_ACCESS_TOKEN}`
      },
      timeout: 5000 // 5 second timeout to prevent hanging
    });

    const hits = response.data?.response?.hits;
    if (hits && hits.length > 0) {
      // Return the best match
      return hits[0].result;
    }
  } catch (error) {
    console.error(`Genius search failed for query "${query}":`, error.message);
  }
  return null;
}

async function scrapeLyricsPage(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      },
      timeout: 5000 // 5 second timeout to prevent hanging
    });
    const $ = cheerio.load(response.data);

    let lyricsText = '';

    // Primary selector
    const containers = $('[data-lyrics-container="true"]');

    containers.each((i, el) => {
      // Remove UI fluff (like language selectors and inline annotations)
      $(el).find('[data-exclude-from-selection="true"]').remove();
      // Replace <br> with newlines to preserve formatting
      $(el).find('br').replaceWith('\n');
      // Some genius layouts use divs for line breaks
      $(el).find('div').each((_, div) => $(div).prepend('\n'));
      // Now safely get all text, including text nested inside <a> and <span> tags
      lyricsText += $(el).text() + '\n';
    });

    if (!lyricsText.trim()) {
      $('[class*="Lyrics__Container"]').each((i, el) => {
        $(el).find('[data-exclude-from-selection="true"]').remove();
        $(el).find('br').replaceWith('\n');
        $(el).find('div').each((_, div) => $(div).prepend('\n'));
        lyricsText += $(el).text() + '\n';
      });
    }

    let result = lyricsText.trim();
    
    // Final sanity check: strip common Genius "junk" lines from the raw text
    const junkStarters = ['Contributors', 'Translations', 'Lyrics originally titled', 'You might also like', 'Read more', 'Embed'];
    result = result.split('\n')
      .filter(line => !junkStarters.some(s => line.trim().startsWith(s)))
      .join('\n');

    console.log(`[scrape] ${url.split('/').pop()} → ${result.split('\n').length} lines`);

    return result;
  } catch (error) {
    console.error(`[Scraper] Blocked or failed for ${url}:`, error.message);
    return null; // Return null so the fallback system can take over
  }
}



function parseToWordArray(rawLyrics) {
  if (!rawLyrics) return [];

  // Remove section headers like [Verse 1], [Chorus], (Verse 1), etc.
  const cleaned = rawLyrics
    .replace(/\[.*?\]/g, '')       // [Chorus], etc.
    .replace(/\(.*?\)/g, '')       // (Hook), etc.
    .replace(/[""'']/g, '"\'')    // normalize fancy quotes
    .replace(/\r/g, '');           // Windows line endings

  const lines = cleaned.split('\n').filter(line => {
    const l = line.trim().toLowerCase();
    if (l.length === 0) return false;
    
    // Filter out common Genius metadata lines
    const junkPatterns = [
      /^contributors/i,
      /^translations/i,
      /^\d+$/, 
      /^you might also like/i,
      /^[a-z]+\slyrics$/i,
      /^lyrics originally titled/i
    ];
    return !junkPatterns.some(pattern => pattern.test(l));
  });

  const words = [];
  let wordIndex = 0;

  lines.forEach((line, lineIndex) => {
    const rawWords = line.trim().split(/\s+/);
    const lineWords = [];
    
    for (let i = 0; i < rawWords.length; i++) {
      let w = rawWords[i].trim();
      if (!w) continue;

      const junkTokens = ['CONTRIBUTORS', 'TRANSLATIONS', 'LYRICS', 'TITLED', 'ORIGINALLY'];
      if (junkTokens.includes(w.toUpperCase())) continue;
      if (!/[a-zA-Z\u00C0-\u024F\u0900-\u097F\u3040-\u30FF\u4E00-\u9FFF]/.test(w)) continue;

      // ── SMART MERGE ──
      // If this "word" is just a single consonant (like 'k', 'b', 't') 
      // and there's another word following it in the same line, merge them.
      if (w.length === 1 && /^[bcdfghjklmnpqrstvwxyz]$/i.test(w) && i < rawWords.length - 1) {
        rawWords[i + 1] = w + rawWords[i + 1];
        continue;
      }
      
      lineWords.push({ word: w, lineIndex, wordIndex: wordIndex++ });
    }
    words.push(...lineWords);
  });

  return words;
}


export async function fetchLyrics(song, artist) {
  let originalResult = await searchGenius(`${song} ${artist}`);
  const originalRaw = originalResult ? await scrapeLyricsPage(originalResult.url) : null;
  if (!originalRaw) throw new Error('Genius scraping blocked or failed');
  
  const officialArtist = originalResult?.primary_artist?.name || artist;
  const officialTitle = originalResult?.title || song;

  if (!originalRaw) {
    return { original: [], officialArtist, officialTitle };
  }

  return {
    original: parseToWordArray(originalRaw),
    officialArtist,
    officialTitle
  };
}
