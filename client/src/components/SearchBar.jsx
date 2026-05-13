import React, { useState } from 'react';
import { useAppStore } from '../store/appStore';

export default function SearchBar() {
  const [loading, setLoading] = useState(false);
  const song = useAppStore(state => state.song);
  const artist = useAppStore(state => state.artist);
  const setSong = useAppStore(state => state.setSong);
  const setArtist = useAppStore(state => state.setArtist);
  const setLyrics = useAppStore(state => state.setLyrics);
  const setError = useAppStore(state => state.setError);
  const queue = useAppStore(state => state.queue);
  const addToQueue = useAppStore(state => state.addToQueue);
  const removeFromQueue = useAppStore(state => state.removeFromQueue);

  const performSearch = async (songName, artistName) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `http://localhost:3001/api/lyrics?q=${encodeURIComponent(songName)}&artist=${encodeURIComponent(artistName)}`
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch lyrics');
      setLyrics(data); 
      return data.lyrics;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (!song) return;
    performSearch(song, artist);
  };

  const handleQueueAdd = (e) => {
    e.preventDefault();
    if (!song) return;
    addToQueue(song, artist);
    setSong('');
    setArtist('');
  };

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Inputs row */}
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <svg
              width="16" height="16" fill="none" stroke="var(--text-muted)" strokeWidth="2"
              viewBox="0 0 24 24"
              style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            >
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              id="search-song"
              type="text"
              placeholder="Singer / Artist (e.g. Arijit Singh)"
              className="kara-input"
              style={{ paddingLeft: 38 }}
              value={song}
              onChange={e => setSong(e.target.value)}
              required
              autoComplete="off"
            />
          </div>
          <input
            id="search-artist"
            type="text"
            placeholder="Song Title (e.g. Kesariya)"
            className="kara-input"
            style={{ flex: 1 }}
            value={artist}
            onChange={e => setArtist(e.target.value)}
            autoComplete="off"
          />
        </div>

        {/* Button row */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            id="search-submit"
            type="submit"
            disabled={loading || !song}
            className="btn-cta"
            style={{
              flex: 1,
              justifyContent: 'center',
              opacity: (!song || loading) ? 0.5 : 1,
              cursor: (!song || loading) ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? (
              <>
                <span
                  style={{
                    width: 16, height: 16, border: '2px solid #F5F0E840', borderTopColor: '#F5F0E8',
                    borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite',
                  }}
                />
                Fetching…
              </>
            ) : (
              <>Find lyrics →</>
            )}
          </button>
        </div>
      </form>

      {/* Queue list */}
      {queue.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>
            Up next
          </p>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {queue.map((item, idx) => (
              <li key={idx} className="queue-card">
                <span style={{ fontSize: 13, fontFamily: 'Inter, sans-serif', color: 'var(--text-primary)' }}>
                  {item.song}
                  {item.artist && (
                    <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>— {item.artist}</span>
                  )}
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => { performSearch(item.song, item.artist); removeFromQueue(idx); }}
                    style={{
                      background: 'var(--surface)',
                      border: '0.5px solid var(--border)',
                      borderRadius: 'var(--radius-pill)',
                      padding: '4px 12px',
                      fontSize: 12,
                      fontFamily: 'Inter, sans-serif',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    Play
                  </button>
                  <button
                    onClick={() => removeFromQueue(idx)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: 16,
                      lineHeight: 1,
                      padding: '4px 6px',
                    }}
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
