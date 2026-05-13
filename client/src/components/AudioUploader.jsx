import React, { useState, useRef, useEffect } from 'react';
import { usePitchExtraction } from '../hooks/usePitchExtraction';
import { useAppStore } from '../store/appStore';
import { extractAudioMetadata } from '../utils/metadataUtils';
import { getAudioContext } from '../hooks/useAudioPlayer';

// Module-level abort controller — exposed on window so App.jsx exitPlayer() can cancel it
let _abortController = null;

export default function AudioUploader() {
  const [tab, setTab] = useState('upload');
  const [file, setFile] = useState(null);
  const [ytUrl, setYtUrl] = useState('');
  const [isFetchingYt, setIsFetchingYt] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const { extractPitch, progress } = usePitchExtraction();
  const isAnalyzing  = useAppStore(state => state.isAnalyzing);
  const analysisStep = useAppStore(state => state.analysisStep);
  const song         = useAppStore(state => state.song);
  const artist       = useAppStore(state => state.artist);
  const setSong      = useAppStore(state => state.setSong);
  const setArtist    = useAppStore(state => state.setArtist);
  const lyrics       = useAppStore(state => state.lyrics);
  const setLyrics    = useAppStore(state => state.setLyrics);
  const setAnalysisStep = useAppStore(state => state.setAnalysisStep);
  const setError     = useAppStore(state => state.setError);
  const setAudioBuffer  = useAppStore(state => state.setAudioBuffer);
  const setShowPlayer   = useAppStore(state => state.setShowPlayer);  // FIX 2
  const setIsAnalyzing  = useAppStore(state => state.setIsAnalyzing);

  useEffect(() => {
    if (file && tab === 'upload') {
      const detectMetadata = async () => {
        const metadata = await extractAudioMetadata(file);
        setSong(metadata.song);
        setArtist(metadata.artist);
      };
      detectMetadata();
    }
  }, [file, tab, setSong, setArtist]);

  // ── YouTube Metadata Auto-fetch ──
  useEffect(() => {
    if (ytUrl && ytUrl.includes('youtube.com') || ytUrl.includes('youtu.be')) {
      const fetchYtInfo = async () => {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        try {
          const res = await fetch(`${apiUrl}/api/audio/info?url=${encodeURIComponent(ytUrl)}`);
          if (res.ok) {
            const data = await res.json();
            // Use our smart filename-splitter on the YT title
            const meta = await extractAudioMetadata({ name: data.title });
            setSong(meta.song);
            setArtist(meta.artist);
          }
        } catch (e) { console.warn('Failed to fetch YT metadata:', e); }
      };
      // Debounce slightly to avoid firing on every keystroke
      const timer = setTimeout(fetchYtInfo, 800);
      return () => clearTimeout(timer);
    }
  }, [ytUrl, setSong, setArtist]);

  const performLyricsFetch = async (currentSong, currentArtist, duration, signal) => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    setAnalysisStep('fetching-lyrics');
    let url = `${apiUrl}/api/lyrics?q=${encodeURIComponent(currentSong)}&artist=${encodeURIComponent(currentArtist || '')}`;
    if (duration) url += `&duration=${Math.round(duration)}`;
    const response = await fetch(url, { signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to fetch lyrics');
    setLyrics(data.lyrics);
    return data.lyrics;
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected && selected.type.startsWith('audio/')) {
      setFile(selected);
      setError(null);
    } else {
      alert('Please select a valid audio file');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.type.startsWith('audio/')) {
      setFile(dropped);
      setError(null);
    }
  };

  const analyzeSong = async (audioData) => {
    // FIX 1: set up AbortController and expose it globally for exitPlayer
    _abortController = new AbortController();
    window.__karaAbortAnalysis = () => _abortController?.abort();
    const signal = _abortController.signal;

    try {
      setError(null);
      const currentSong   = song;
      const currentArtist = artist;

      if (!currentSong) throw new Error('Could not identify song. Please enter title manually.');

      // Reset sync offset for fresh song
      useAppStore.getState().setSyncOffsetMs(0);

      // FIX 2: navigate to player page IMMEDIATELY — before any fetch
      setIsAnalyzing(true); // Show loading screen instantly
      setShowPlayer(true);
      
      // Clear previous album art, then fetch new one asynchronously via server proxy
      useAppStore.getState().setAlbumArt(null);

      // 1. Decode audio FIRST so we have the exact duration for smarter LRCLIB search
      setAnalysisStep('extracting-pitch'); // reusing label for user feedback
      const audioContext = getAudioContext();
      if (audioContext.state === 'suspended') await audioContext.resume();
      const audioBuffer = await audioContext.decodeAudioData(audioData);
      setAudioBuffer(audioBuffer);

      // 2. Fetch lyrics (with duration!) and metadata concurrently for speed
      setAnalysisStep('fetching-lyrics');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const query = `${currentSong} ${currentArtist || ''}`.trim();
      const metadataPromise = fetch(`${apiUrl}/api/metadata?q=${encodeURIComponent(query)}`, { signal })
        .then(res => res.json())
        .then(data => {
          if (data.results && data.results[0]) {
            useAppStore.getState().setAlbumArt(data.results[0].artworkUrl100.replace('100x100bb', '600x600bb'));
          }
        })
        .catch(() => {});

      const lyricsPromise = performLyricsFetch(currentSong, currentArtist, audioBuffer.duration, signal);
      
      await Promise.all([metadataPromise, lyricsPromise]);

      // 3. Extract pitch & align
      setAnalysisStep('extracting-pitch');
      await extractPitch(audioBuffer);

      setAnalysisStep('complete');
      useAppStore.getState().setIsPlaying(true);
    } catch (err) {
      // Swallow AbortError — user navigated away intentionally
      if (err.name === 'AbortError') return;
      console.error('Analysis pipeline failed:', err);
      setError(err.message);
      setAnalysisStep('');
    } finally {
      _abortController = null;
      window.__karaAbortAnalysis = null;
    }
  };

  const handleAnalyzeUpload = async () => {
    if (!file) return;
    const arrayBuffer = await file.arrayBuffer();
    await analyzeSong(arrayBuffer);
  };

  const handleAnalyzeYoutube = async () => {
    if (!ytUrl) return;
    setIsFetchingYt(true);

    // FIX 1: set up AbortController
    _abortController = new AbortController();
    window.__karaAbortAnalysis = () => _abortController?.abort();
    const signal = _abortController.signal;

    try {
      // FIX 2: navigate to player immediately
      setIsAnalyzing(true);
      setShowPlayer(true);
      setAnalysisStep('extracting-pitch');

      const response = await fetch('http://localhost:3001/api/audio/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: ytUrl }),
        signal,
      });
      if (!response.ok) throw new Error('Failed to fetch audio from YouTube');
      const arrayBuffer = await response.arrayBuffer();
      await analyzeSong(arrayBuffer);
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error(err);
      setError(err.message);
    } finally {
      setIsFetchingYt(false);
      _abortController = null;
      window.__karaAbortAnalysis = null;
    }
  };

  /* ── Upload tab ─────────────────────────────────────────────── */
  const renderUploadTab = () => (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="audio/*"
        style={{ display: 'none' }}
      />

      {!file ? (
        <div
          className="kara-dropzone"
          style={{ borderColor: isDragging ? 'var(--text-primary)' : undefined, background: isDragging ? '#E8E3D8' : undefined }}
          onClick={() => fileInputRef.current.click()}
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          {/* Upload icon */}
          <div
            style={{
              width: 52, height: 52, borderRadius: '50%',
              background: 'var(--bg)', border: '0.5px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)',
            }}
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </div>
          <p style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: 14 }}>
            Drop your audio file here
          </p>
          <p>MP3, WAV, M4A supported — or click to browse</p>
          <button
            type="button"
            className="btn-cta"
            style={{ marginTop: 4, fontSize: 13, padding: '10px 24px' }}
            onClick={e => { e.stopPropagation(); fileInputRef.current.click(); }}
          >
            Select file
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%' }}>
          {/* File chip */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: '#ECFDF5', border: '0.5px solid #6EE7B7',
            borderRadius: 'var(--radius-pill)', padding: '10px 18px', width: '100%', maxWidth: 360,
          }}>
            <svg width="18" height="18" fill="none" stroke="#059669" strokeWidth="2" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <p style={{ fontSize: 11, color: '#059669', fontFamily: 'Inter, sans-serif', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Ready for analysis</p>
              <p style={{ fontSize: 13, color: '#065F46', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</p>
            </div>
            <button
              onClick={() => setFile(null)}
              style={{ background: 'none', border: 'none', color: '#059669', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 4px' }}
              title="Remove file"
            >×</button>
          </div>

          {/* Metadata edit */}
          {!isAnalyzing && (
            <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 360 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', paddingLeft: 4 }}>Song</label>
                <input
                  type="text"
                  value={song}
                  onChange={e => setSong(e.target.value)}
                  className="kara-input"
                  style={{ height: 38, fontSize: 13 }}
                  placeholder="Song title"
                />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', paddingLeft: 4 }}>Artist</label>
                <input
                  type="text"
                  value={artist}
                  onChange={e => setArtist(e.target.value)}
                  className="kara-input"
                  style={{ height: 38, fontSize: 13 }}
                  placeholder="Artist"
                />
              </div>
            </div>
          )}

          {!isAnalyzing ? (
            <button
              id="analyze-btn"
              onClick={handleAnalyzeUpload}
              className="btn-cta"
              style={{ fontSize: 15, padding: '13px 36px' }}
            >
              Analyze pitch →
            </button>
          ) : (
            <AnalyzeProgress progress={progress} step={analysisStep} />
          )}
        </div>
      )}
    </>
  );

  /* ── YouTube tab ─────────────────────────────────────────────── */
  const renderYoutubeTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%' }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: 360 }}>
        <svg
          width="16" height="16" fill="none" stroke="var(--text-muted)" strokeWidth="2"
          viewBox="0 0 24 24"
          style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
        >
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
        <input
          type="text"
          placeholder="Paste YouTube URL…"
          className="kara-input"
          style={{ paddingLeft: 38 }}
          value={ytUrl}
          onChange={e => setYtUrl(e.target.value)}
        />
      </div>

      {/* Metadata edit */}
      {!isAnalyzing && !isFetchingYt && (
        <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 360 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', paddingLeft: 4 }}>Song</label>
            <input
              type="text"
              value={song}
              onChange={e => setSong(e.target.value)}
              className="kara-input"
              style={{ height: 38, fontSize: 13 }}
              placeholder="Song title"
            />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', paddingLeft: 4 }}>Artist</label>
            <input
              type="text"
              value={artist}
              onChange={e => setArtist(e.target.value)}
              className="kara-input"
              style={{ height: 38, fontSize: 13 }}
              placeholder="Artist"
            />
          </div>
        </div>
      )}

      {!isAnalyzing && !isFetchingYt ? (
        <button
          onClick={handleAnalyzeYoutube}
          disabled={!song || !ytUrl}
          className="btn-cta"
          style={{
            fontSize: 14,
            padding: '12px 30px',
            opacity: (!song || !ytUrl) ? 0.5 : 1,
            cursor: (!song || !ytUrl) ? 'not-allowed' : 'pointer',
          }}
        >
          Extract &amp; analyze →
        </button>
      ) : isFetchingYt ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', fontSize: 13 }}>
          <span style={{
            width: 16, height: 16, border: '2px solid var(--border)', borderTopColor: 'var(--text-primary)',
            borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite',
          }} />
          Downloading audio…
        </div>
      ) : (
        <AnalyzeProgress progress={progress} step={analysisStep} />
      )}
    </div>
  );

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <div style={{ width: '100%', marginTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Tabs */}
      <div className="kara-tabs" style={{ maxWidth: 280, margin: '0 auto' }}>
        <button
          id="tab-upload"
          className={`kara-tab${tab === 'upload' ? ' active' : ''}`}
          onClick={() => setTab('upload')}
        >
          Upload audio
        </button>
        <button
          id="tab-youtube"
          className={`kara-tab${tab === 'youtube' ? ' active' : ''}`}
          onClick={() => setTab('youtube')}
        >
          YouTube URL
        </button>
      </div>

      {/* Tab content */}
      <div style={{
        background: 'var(--surface)',
        border: '0.5px solid var(--border-light)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        {tab === 'upload' ? renderUploadTab() : renderYoutubeTab()}

        {lyrics.length === 0 && !isAnalyzing && !isFetchingYt && (
          <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', textAlign: 'center' }}>
            Lyrics and pitch map will be generated automatically upon analysis.
          </p>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function AnalyzeProgress({ progress, step }) {
  const stepMessages = {
    'fetching-lyrics': 'Fetching lyrics…',
    'extracting-pitch': 'Analyzing vocal pitch…',
    'aligning': 'Aligning words to melody…',
    'complete': 'Analysis complete!',
  };

  return (
    <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>
          <span style={{
            width: 14, height: 14, border: '2px solid var(--border)', borderTopColor: 'var(--text-primary)',
            borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite', flexShrink: 0,
          }} />
          {stepMessages[step] || 'Processing…'}
        </div>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif' }}>
          {Math.round(progress)}%
        </span>
      </div>
      <div className="analyze-progress-track">
        <div className="analyze-progress-fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
