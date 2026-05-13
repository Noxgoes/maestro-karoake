import express from 'express';
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
    
    // On Render/Linux, we use /tmp to avoid permission issues
    const baseDir = isWin ? path.join(__dirname, '..') : '/tmp';
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
    if (!ytDlpWrap) return res.status(503).json({ error: 'yt-dlp not initialized' });

    const metadata = await ytDlpWrap.getVideoInfo(url);
    res.json({ 
      title: metadata.title,
      duration: metadata.duration 
    });
  } catch (error) {
    console.error('Error fetching YT info:', error);
    res.status(500).json({ error: 'Failed to fetch video info' });
  }
});

router.post('/extract', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    if (!ytDlpWrap) {
      return res.status(503).json({ error: 'yt-dlp is not initialized yet' });
    }

    console.log(`Extracting audio from ${url}`);
    
    // Create a temporary file path
    const tempFilePath = path.join(__dirname, '..', `temp-${Date.now()}.mp3`);
    
    // Download as mp3
    await ytDlpWrap.execPromise([
      url,
      '-x', 
      '--audio-format', 'mp3',
      '-o', tempFilePath
    ]);
    
    // Send file and clean up
    res.download(tempFilePath, 'audio.mp3', (err) => {
      if (err) {
        console.error('Error sending file:', err);
      }
      // Clean up temp file
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    });
    
  } catch (error) {
    console.error('Error extracting audio:', error);
    res.status(500).json({ error: 'Failed to extract audio' });
  }
});

export default router;
