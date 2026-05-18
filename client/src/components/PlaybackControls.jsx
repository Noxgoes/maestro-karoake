import React from 'react';
import { useAppStore } from '../store/appStore';
import { useAudioControls } from '../context/AudioPlayerContext';

export default function PlaybackControls() {
  const audioBuffer = useAppStore(state => state.audioBuffer);
  const isPlaying = useAppStore(state => state.isPlaying);
  const currentTime = useAppStore(state => state.currentTime);
  const duration = useAppStore(state => state.duration);
  const playbackRate = useAppStore(state => state.playbackRate);
  const accuracyScore = useAppStore(state => state.accuracyScore);
  const syncOffsetMs = useAppStore(state => state.syncOffsetMs);
  const setPlaybackRate = useAppStore(state => state.setPlaybackRate);
  const setSyncOffsetMs = useAppStore(state => state.setSyncOffsetMs);

  const { togglePlayback, seek, stop } = useAudioControls();

  const isFullscreen = useAppStore(state => state.isFullscreen);
  const setIsFullscreen = useAppStore(state => state.setIsFullscreen);

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [setIsFullscreen]);

  const [showControls, setShowControls] = React.useState(true);

  React.useEffect(() => {
    if (!isFullscreen) {
      setShowControls(true);
      document.body.style.cursor = 'default';
      return;
    }

    let timeoutId;
    const handleMouseMove = () => {
      setShowControls(true);
      document.body.style.cursor = 'default';
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setShowControls(false);
        document.body.style.cursor = 'none';
      }, 3000);
    };

    document.addEventListener('mousemove', handleMouseMove);
    handleMouseMove();

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.body.style.cursor = 'default';
      clearTimeout(timeoutId);
    };
  }, [isFullscreen]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  if (!audioBuffer) return null;

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div 
      className={`kara-player-bar ${isFullscreen ? 'is-fullscreen' : ''}`}
      style={{
        transform: isFullscreen && !showControls ? 'translateY(120px)' : 'translateY(0)',
        opacity: isFullscreen && !showControls ? 0 : 1,
        transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease',
      }}
    >
      {/* Progress bar */}
      <div
        className="player-progress-track"
        id="player-progress-bar"
        onClick={e => {
          const rect = e.currentTarget.getBoundingClientRect();
          const pct = (e.clientX - rect.left) / rect.width;
          seek(pct * duration);
        }}
        title="Click to seek"
      >
        <div className="player-progress-fill" style={{ width: `${progress}%` }}>
          {/* Thumb dot */}
          <div style={{
            position: 'absolute', right: -5, top: '50%', transform: 'translateY(-50%)',
            width: 11, height: 11, borderRadius: '50%',
            background: 'var(--player-text)',
            boxShadow: '0 0 0 2px rgba(245,240,232,0.2)',
          }} />
        </div>
      </div>

      {/* Controls row */}
      {/* Controls row */}
      <div className="player-controls-row">
        <div className="player-controls-primary">
          {/* Time */}
          <span style={{
            fontSize: 12, fontFamily: 'monospace', color: '#6B6560',
            minWidth: 90, letterSpacing: '0.04em',
          }}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          {/* Transport buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Restart */}
            <button
              id="player-restart"
              onClick={() => seek(0)}
              title="Restart"
              style={{
                width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'transparent', border: 'none', color: '#6B6560', cursor: 'pointer',
                borderRadius: '50%', transition: 'color 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#F5F0E8'}
              onMouseLeave={e => e.currentTarget.style.color = '#6B6560'}
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/>
              </svg>
            </button>

            {/* Play / Pause */}
            <button
              id="player-play-pause"
              onClick={togglePlayback}
              style={{
                width: 44, height: 44, borderRadius: '50%',
                background: 'var(--player-text)', border: 'none',
                color: 'var(--player-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                transition: 'transform 0.15s, background 0.2s',
                boxShadow: '0 0 0 0 transparent',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              {isPlaying ? (
                <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
                </svg>
              ) : (
                <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24" style={{ marginLeft: 2 }}>
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
              )}
            </button>

            {/* Stop */}
            <button
              id="player-stop"
              onClick={stop}
              title="Stop"
              style={{
                width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'transparent', border: 'none', color: '#6B6560', cursor: 'pointer',
                borderRadius: '50%', transition: 'color 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#F5F0E8'}
              onMouseLeave={e => e.currentTarget.style.color = '#6B6560'}
            >
              <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
              </svg>
            </button>
          </div>

          {/* Fullscreen Toggle */}
          <button
            id="player-fullscreen"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            style={{
              width: 38,
              height: 38,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              lineHeight: 0,
              background: 'rgba(255,255,255,0.06)',
              border: '0.5px solid rgba(255,255,255,0.1)',
              color: '#F5F0E8',
              cursor: 'pointer',
              borderRadius: '50%',
              transition: 'all 0.2s',
              outline: 'none',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--player-text)';
              e.currentTarget.style.color = 'var(--player-bg)';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
              e.currentTarget.style.color = '#F5F0E8';
              e.currentTarget.style.transform = 'none';
            }}
          >
            {isFullscreen ? (
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        </div>

        <div className="player-controls-secondary">
          {/* Speed selector */}
          <div style={{
            display: 'flex',
            background: 'rgba(255,255,255,0.06)',
            border: '0.5px solid rgba(255,255,255,0.1)',
            borderRadius: 'var(--radius-pill)',
            padding: 3,
            gap: 2,
          }}>
            {[0.5, 0.75, 1].map(rate => (
              <button
                key={rate}
                id={`speed-${rate}`}
                onClick={() => setPlaybackRate(rate)}
                style={{
                  padding: '5px 14px',
                  borderRadius: 'var(--radius-pill)',
                  border: 'none',
                  background: playbackRate === rate ? 'var(--player-text)' : 'transparent',
                  color: playbackRate === rate ? 'var(--player-bg)' : '#6B6560',
                  fontSize: 12,
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {rate}×
              </button>
            ))}
          </div>

          {/* ── Sync offset nudge ── */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(255,255,255,0.06)',
            border: '0.5px solid rgba(255,255,255,0.1)',
            borderRadius: 'var(--radius-pill)',
            padding: '3px 12px 3px 10px',
          }}>
            <span style={{ fontSize: 10, color: '#6B6560', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap', letterSpacing: '0.06em', fontWeight: 600 }}>
              SYNC
            </span>
            <button
              id="sync-earlier"
              onClick={() => setSyncOffsetMs(Math.max(-3000, syncOffsetMs - 100))}
              style={{ background: 'none', border: 'none', color: '#6B6560', cursor: 'pointer', fontSize: 18 }}
            >−</button>
            
            <input
              type="range"
              min={-3000}
              max={3000}
              step={50}
              value={syncOffsetMs}
              onChange={e => setSyncOffsetMs(Number(e.target.value))}
              style={{ 
                width: 80, 
                accentColor: 'var(--player-text)',
                cursor: 'pointer',
                height: 4
              }}
            />

            <button
              id="sync-later"
              onClick={() => setSyncOffsetMs(Math.min(3000, syncOffsetMs + 100))}
              style={{ background: 'none', border: 'none', color: '#6B6560', cursor: 'pointer', fontSize: 18 }}
            >+</button>

            <span
              id="sync-offset-display"
              style={{
                fontSize: 11, fontFamily: 'monospace', color: syncOffsetMs === 0 ? '#6B6560' : '#F5F0E8',
                minWidth: 52, textAlign: 'center', cursor: 'pointer', fontWeight: 600
              }}
              title="Click to reset"
              onClick={() => setSyncOffsetMs(0)}
            >
              {syncOffsetMs >= 0 ? '+' : ''}{syncOffsetMs}ms
            </span>
          </div>

          {/* Accuracy chip */}
          {accuracyScore !== null && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.06)',
              border: '0.5px solid rgba(255,255,255,0.1)',
              borderRadius: 'var(--radius-pill)',
              padding: '6px 16px',
            }}>
              <span style={{ fontSize: 11, color: '#6B6560', fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Accuracy
              </span>
              <span style={{
                fontSize: 15, fontWeight: 700, fontFamily: 'Inter, sans-serif',
                color: accuracyScore >= 80 ? '#1D9E75' : accuracyScore >= 50 ? '#D4A017' : '#D85A30',
              }}>
                {accuracyScore}%
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
