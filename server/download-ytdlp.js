import YTDlpWrap from 'yt-dlp-wrap';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function download() {
  try {
    const isWin = process.platform === 'win32';
    const binaryName = isWin ? 'yt-dlp.exe' : 'yt-dlp';
    const binaryPath = path.join(__dirname, binaryName);
    
    console.log(`[POSTINSTALL] Target path: ${binaryPath}`);
    
    const Downloader = YTDlpWrap.default || YTDlpWrap;
    
    if (!fs.existsSync(binaryPath)) {
      console.log(`[POSTINSTALL] Downloading ${binaryName} binary from GitHub...`);
      await Downloader.downloadFromGithub(binaryPath);
      if (!isWin) {
        fs.chmodSync(binaryPath, '755');
      }
      console.log(`[POSTINSTALL] Download complete.`);
    } else {
      console.log(`[POSTINSTALL] Binary already exists.`);
    }
  } catch (err) {
    console.error(`[POSTINSTALL ERROR] Failed to download yt-dlp:`, err.message);
    process.exit(1); // Fail build if binary cannot be downloaded
  }
}

download();
