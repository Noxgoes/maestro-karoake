import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { extractAudioMetadata } from '../utils/metadataUtils';

export default function AudioUploader() {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  const tab = useAppStore(state => state.audioSourceTab);
  const setTab = useAppStore(state => state.setAudioSourceTab);
  const file = useAppStore(state => state.audioFile);
  const setFile = useAppStore(state => state.setAudioFile);
  const ytUrl = useAppStore(state => state.youtubeUrl);
  const setYtUrl = useAppStore(state => state.setYoutubeUrl);
  const isFetchingYt = useAppStore(state => state.isFetchingYt);

  const isAnalyzing = useAppStore(state => state.isAnalyzing);
  const setSong = useAppStore(state => state.setSong);
  const setArtist = useAppStore(state => state.setArtist);
  const lyrics = useAppStore(state => state.lyrics);
  const setError = useAppStore(state => state.setError);

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

  useEffect(() => {
    if (ytUrl && (ytUrl.includes('youtube.com') || ytUrl.includes('youtu.be'))) {
      const fetchYtInfo = async () => {
        try {
          const res = await fetch(`${apiUrl}/api/audio/info?url=${encodeURIComponent(ytUrl)}`);
          if (res.ok) {
            const data = await res.json();
            const meta = await extractAudioMetadata({ name: data.title });
            setSong(meta.song);
            setArtist(meta.artist);
          }
        } catch (e) { console.warn('Failed to fetch YT metadata:', e); }
      };
      const timer = setTimeout(fetchYtInfo, 800);
      return () => clearTimeout(timer);
    }
  }, [ytUrl, setSong, setArtist, apiUrl]);

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
          onChange={async (e) => {
            const val = e.target.value;
            setYtUrl(val);
            if (val.includes('youtube.com/') || val.includes('youtu.be/')) {
              try {
                const res = await fetch(`${apiUrl}/api/audio/info?url=${encodeURIComponent(val)}`);
                if (res.ok) {
                  const data = await res.json();
                  if (data.track) setSong(data.track);
                  if (data.artist) setArtist(data.artist);
                }
              } catch (err) {
                console.warn('[AutoFill] Failed:', err);
              }
            }
          }}
        />
      </div>

      {isFetchingYt && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', fontSize: 13 }}>
          <span style={{
            width: 16, height: 16, border: '2px solid var(--border)', borderTopColor: 'var(--text-primary)',
            borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite',
          }} />
          Downloading audio…
        </div>
      )}
    </div>
  );

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <div style={{ width: '100%', marginTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
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
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
