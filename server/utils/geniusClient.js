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

async function searchGenius(query) {
  if (!GENIUS_ACCESS_TOKEN) {
    console.warn('GENIUS_ACCESS_TOKEN is not set, skipping API call');
    return null;
  }
  
  try {
    const response = await axios.get(`${GENIUS_BASE_URL}/search`, {
      params: { q: query },
      headers: {
        Authorization: `Bearer ${GENIUS_ACCESS_TOKEN}`
      }
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
      }
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
    console.error(`Failed to scrape lyrics from ${url}:`, error.message);
    throw new Error('Failed to scrape lyrics page');
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


function isAlreadyRomanScript(text) {
  if (!text) return true;
  // Regex to match characters typically NOT found in English/European languages
  // Specifically targets Devanagari (Hindi), Japanese, Chinese, Cyrillic, etc.
  const nonRomanMatch = text.match(/[^\x00-\x7F\u00C0-\u00FF\u0100-\u017F\u0180-\u024F\s\p{P}]/gu);
  if (!nonRomanMatch) return true; 
  
  // If fewer than 5% of the characters are non-Roman, consider it already Romanized
  // (This accounts for small amounts of non-ASCII symbols or metadata)
  return (nonRomanMatch.length / text.length) < 0.05;
}

export async function fetchLyrics(song, artist) {
  // Always fetch original first to check script
  let originalResult = await searchGenius(`${song} ${artist}`);
  const originalRaw = originalResult ? await scrapeLyricsPage(originalResult.url) : '';
  
  const officialArtist = originalResult?.primary_artist?.name || artist;
  const officialTitle = originalResult?.title || song;

  // ── SCRIPT GATE ──
  // If original is already English/Roman, we skip the romanized search entirely
  const alreadyRomanized = isAlreadyRomanScript(originalRaw);
  
  let romanizedRaw = '';
  if (!alreadyRomanized) {
    console.log(`[Genius] Non-Roman script detected. Fetching romanized fallback...`);
    let romanizedResult = await searchGenius(`${song} ${artist} romanized`);
    if (romanizedResult && romanizedResult.url !== originalResult?.url) {
      romanizedRaw = await scrapeLyricsPage(romanizedResult.url);
    }
  } else {
    console.log(`[Genius] Lyrics are already in Roman script. Skipping romanization.`);
  }

  if (!originalRaw && !romanizedRaw) {
    return { original: [], romanized: [], officialArtist, officialTitle };
  }

  return {
    original: parseToWordArray(originalRaw),
    romanized: parseToWordArray(romanizedRaw),
    officialArtist,
    officialTitle
  };
}
