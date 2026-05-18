import { useAppStore } from '../store/appStore';
import { getAudioContext } from '../hooks/useAudioPlayer';

let _abortController = null;

export async function runAnalysisPipeline({ navigate, extractPitch }) {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const store = useAppStore.getState();
  const {
    song,
    artist,
    audioSourceTab,
    audioFile,
    youtubeUrl,
    setAnalysisStep,
    setAudioBuffer,
    setIsAnalyzing,
    setError,
    setAlbumArt,
    setIsPlaying,
    setLyrics
  } = store;

  if (!song) {
    setError('Please enter a song title.');
    return;
  }

  const performLyricsFetch = async (currentSong, currentArtist, duration, signal) => {
    setAnalysisStep('fetching-lyrics');
    let url = `${apiUrl}/api/lyrics?q=${encodeURIComponent(currentSong)}&artist=${encodeURIComponent(currentArtist || '')}`;
    if (duration) url += `&duration=${Math.round(duration)}`;
    const response = await fetch(url, { signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to fetch lyrics');
    setLyrics(data);
    return data;
  };

  _abortController = new AbortController();
  window.__karaAbortAnalysis = () => _abortController?.abort();
  const signal = _abortController.signal;

  store.setIsFetchingYt(false);
  setError(null);
  store.setSyncOffsetMs(0);
  setIsAnalyzing(true);
  navigate('/player');
  setAlbumArt(null);

  try {
    let audioData;

    if (audioFile && audioSourceTab === 'upload') {
      setAnalysisStep('reading-file');
      audioData = await audioFile.arrayBuffer();
    } else if (audioSourceTab === 'preset') {
      setAnalysisStep('reading-file');
      const presetPath = store.presetPath;
      let response;
      try {
        console.log(`[PIPELINE] Attempting to load local preset from: ${presetPath}`);
        response = await fetch(presetPath);
        const contentType = response.headers.get('Content-Type') || '';
        if (!response.ok || contentType.includes('text/html')) {
          throw new Error('Local file not found or is HTML redirect');
        }
      } catch (err) {
        // Try local .m4a preset fallback before iTunes Search
        try {
          const m4aPath = presetPath.replace('.mp3', '.m4a');
          console.log(`[PIPELINE] MP3 not found. Trying local M4A preset: ${m4aPath}`);
          response = await fetch(m4aPath);
          const contentType = response.headers.get('Content-Type') || '';
          if (!response.ok || contentType.includes('text/html')) {
            throw new Error('Local M4A not found or is HTML redirect');
          }
        } catch (m4aErr) {
          console.log(`[PIPELINE] Local preset not found. Fetching dynamic preview from iTunes API for: ${song}...`);
          const itunesRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(song + ' ' + (artist || ''))}&limit=1&entity=song`);
          const itunesData = await itunesRes.json();
          if (itunesData.results && itunesData.results[0] && itunesData.results[0].previewUrl) {
            const previewUrl = itunesData.results[0].previewUrl;
            console.log(`[PIPELINE] iTunes success! Loading audio from preview: ${previewUrl}`);
            response = await fetch(previewUrl);
            const previewContentType = response.headers.get('Content-Type') || '';
            if (!response.ok || previewContentType.includes('text/html')) {
              throw new Error('iTunes preview not found or is HTML redirect');
            }
          } else {
            throw new Error('Local preset file not found. Place it in client/public/presets/ directory.');
          }
        }
      }
      audioData = await response.arrayBuffer();
    } else if (youtubeUrl && audioSourceTab === 'youtube') {
      store.setIsFetchingYt(true);
      const response = await fetch(`${apiUrl}/api/audio/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: youtubeUrl }),
        signal,
      });
      if (!response.ok) {
        let errMsg = 'Failed to fetch audio from YouTube';
        try {
          const errData = await response.json();
          if (errData.error) errMsg = errData.error;
        } catch (_) {}
        throw new Error(errMsg);
      }
      audioData = await response.arrayBuffer();
      store.setIsFetchingYt(false);
    } else {
      // Automatic YouTube search fallback when no file or URL is provided!
      store.setIsFetchingYt(true);
      const searchQuery = `${song} ${artist || ''}`.trim();
      const response = await fetch(`${apiUrl}/api/audio/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery }),
        signal,
      });
      if (!response.ok) {
        let errMsg = `Failed to find audio stream for "${searchQuery}"`;
        try {
          const errData = await response.json();
          if (errData.error) errMsg = errData.error;
        } catch (_) {}
        throw new Error(errMsg);
      }
      audioData = await response.arrayBuffer();
      store.setIsFetchingYt(false);
    }

    // 1. Decode audio
    setAnalysisStep('extracting-pitch');
    const audioContext = getAudioContext();
    if (audioContext.state === 'suspended') await audioContext.resume();
    const audioBuffer = await audioContext.decodeAudioData(audioData);
    setAudioBuffer(audioBuffer);

    // 2. Fetch lyrics and metadata concurrently
    setAnalysisStep('fetching-lyrics');
    const query = `${song} ${artist || ''}`.trim();
    const metadataPromise = fetch(`${apiUrl}/api/metadata?q=${encodeURIComponent(query)}`, { signal })
      .then(res => res.json())
      .then(data => {
        if (data.results && data.results[0]) {
          setAlbumArt(data.results[0].artworkUrl100.replace('100x100bb', '600x600bb'));
        }
      })
      .catch(() => {});

    const lyricsPromise = performLyricsFetch(song, artist, audioBuffer.duration, signal).then(data => {
      console.log(`%c[LYRIC SOURCE] Lyrics retrieved successfully`, 'color: #7c3aed; font-weight: bold; background: #f3f0ff; padding: 2px 6px; border-radius: 4px;');
      return data;
    });
    
    await Promise.all([metadataPromise, lyricsPromise]);

    // 3. Extract pitch & align
    setAnalysisStep('extracting-pitch');
    await extractPitch(audioBuffer);

    setAnalysisStep('complete');
    setIsPlaying(true);
  } catch (err) {
    if (err.name === 'AbortError') return;
    console.error('Analysis pipeline failed:', err);
    setError(err.message);
    setAnalysisStep('');
    navigate('/studio');
  } finally {
    _abortController = null;
    window.__karaAbortAnalysis = null;
    setIsAnalyzing(false);
    store.setIsFetchingYt(false);
  }
}
