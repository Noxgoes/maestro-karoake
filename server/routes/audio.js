import express from 'express';
import axios from 'axios';
import YTDlpWrap from 'yt-dlp-wrap';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

let ytDlpWrap = null;
const initYtDlp = async () => {
  try {
    const isWin = process.platform === 'win32';
    const binaryName = isWin ? 'yt-dlp.exe' : 'yt-dlp';
    
    // Save in workspace server root to ensure full execution and read-write permissions
    const baseDir = path.join(__dirname, '..');
    const binaryPath = path.join(baseDir, binaryName);
    
    console.log(`[YT-DLP] Target path: ${binaryPath}`);
    
    // Handle both ESM and CJS import styles
    const Downloader = YTDlpWrap.default || YTDlpWrap;
    
    if (!fs.existsSync(binaryPath)) {
      console.log(`[YT-DLP] Downloading ${binaryName} binary...`);
      await Downloader.downloadFromGithub(binaryPath);
      if (!isWin) {
        fs.chmodSync(binaryPath, '755');
      }
      console.log(`[YT-DLP] Download complete.`);
    } else {
      console.log(`[YT-DLP] Binary already exists.`);
    }
    
    ytDlpWrap = new Downloader(binaryPath);
    console.log(`[YT-DLP] Initialization successful.`);
  } catch (err) {
    console.error(`[YT-DLP ERROR] Failed to initialize:`, err);
    // Don't crash the whole server
  }
};

initYtDlp();

router.get('/info', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'URL is required' });
    
    console.log(`[YT-INFO] Fetching metadata for: ${url}`);
    
    // ── FALLBACK 1: Try OEmbed API first (fastest, rarely blocked) ──
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      const { data: oembed } = await axios.get(oembedUrl, { timeout: 5000 });
      if (oembed && oembed.title) {
        console.log(`[YT-INFO] ✓ OEmbed success: ${oembed.title}`);
        return res.json({
          title: oembed.title,
          uploader: oembed.author_name,
          artist: oembed.author_name,
          track: oembed.title,
          source: 'oembed'
        });
      }
    } catch (oerr) {
      console.warn(`[YT-INFO] OEmbed failed, trying yt-dlp: ${oerr.message}`);
    }

    // ── FALLBACK 2: Try yt-dlp (full metadata) ──
    if (!ytDlpWrap) return res.status(503).json({ error: 'yt-dlp not initialized' });
    const metadata = await ytDlpWrap.getVideoInfo(url);
    res.json({
      title: metadata.title,
      uploader: metadata.uploader,
      artist: metadata.artist || metadata.uploader,
      track: metadata.track || metadata.title,
      source: 'ytdlp'
    });
  } catch (error) {
    const msg = error.message || '';
    console.error('[YT-INFO ERROR]', msg);
    
    if (msg.includes('429')) {
      return res.status(429).json({ error: 'YouTube is rate-limiting your IP. Please try again later or use a VPN.' });
    }
    if (msg.includes('Sign in')) {
      return res.status(403).json({ error: 'YouTube bot detection triggered. Try a different video.' });
    }
    
    res.status(500).json({ error: 'Failed to fetch video info' });
  }
});

// POST /api/audio/extract
router.post('/extract', async (req, res) => {
  try {
    const { url, query } = req.body;
    if (!url && !query) {
      return res.status(400).json({ error: 'URL or query is required' });
    }
    
    if (!ytDlpWrap) {
      return res.status(503).json({ error: 'yt-dlp is not initialized yet' });
    }

    const target = url ? url : `ytsearch1:${query}`;
    console.log(`[YT-DLP] Starting extraction for target: ${target}`);
    
    // Create a temporary file path with a generic extension first
    const fileId = Date.now();
    const tempPattern = path.join(__dirname, '..', `temp-${fileId}.%(ext)s`);
    
    // Download ONLY the audio stream with anti-bot bypass headers (tiny payload, super fast download!)
    await ytDlpWrap.execPromise([
      target,
      '-f', 'ba', // Only request the audio stream
      '-x', 
      '--audio-quality', '5', // Standard audio conversion
      '--no-playlist',
      '--no-check-certificates',
      '--add-header', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      '--add-header', 'Accept-Language: en-US,en;q=0.9',
      '-o', tempPattern
    ]);
    
    // Find what file was actually created (could be .m4a, .webm, .opus etc)
    const files = fs.readdirSync(path.join(__dirname, '..'));
    const finalFile = files.find(f => f.startsWith(`temp-${fileId}`));
    
    if (!finalFile) {
      throw new Error('yt-dlp completed but no file was found');
    }

    const finalPath = path.join(__dirname, '..', finalFile);
    console.log(`[YT-DLP] Success! Created: ${finalFile}`);
    
    // Send file and clean up
    res.download(finalPath, 'audio.media', (err) => {
      if (err) console.error('[DOWNLOAD ERROR]', err);
      try {
        if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
      } catch (e) {
        console.warn('[CLEANUP WARN] Could not delete temp file immediately:', e.message);
      }
    });
    
  } catch (error) {
    const msg = error.message || '';
    console.error('[YT-EXTRACT ERROR]', msg);
    
    if (msg.includes('429')) {
      return res.status(429).json({ error: 'YouTube is rate-limiting your IP. Please try again later or use a VPN.' });
    }
    if (msg.includes('Sign in')) {
      return res.status(403).json({ error: 'YouTube bot detection triggered. Try a different video or use a VPN.' });
    }
    
    res.status(500).json({ error: 'Failed to extract audio from YouTube. The link might be restricted or your IP might be blocked.' });
  }
});

export default router;
