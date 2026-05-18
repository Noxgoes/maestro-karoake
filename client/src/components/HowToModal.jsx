import React from 'react';
import { useAppStore } from '../store/appStore';

export default function HowToModal() {
  const isHowToOpen = useAppStore(state => state.isHowToOpen);
  const setIsHowToOpen = useAppStore(state => state.setIsHowToOpen);

  if (!isHowToOpen) return null;

  return (
    <div
      className="how-to-backdrop"
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        animation: 'fadeIn 0.2s ease-out forwards',
      }}
      onClick={() => setIsHowToOpen(false)}
    >
      <div
        className="how-to-card"
        style={{
          background: 'var(--bg)',
          borderRadius: '28px',
          border: '1px solid var(--border-light)',
          padding: '36px 40px',
          maxWidth: 580,
          width: '100%',
          boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
          position: 'relative',
          animation: 'fadeInUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          className="how-to-close-btn"
          onClick={() => setIsHowToOpen(false)}
          style={{
            position: 'absolute',
            top: 24, right: 24,
            background: 'var(--surface)',
            border: '0.5px solid var(--border)',
            borderRadius: '50%',
            width: 36, height: 36,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = '#E0D8CC'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'var(--surface)'; }}
          aria-label="Close"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
 
        {/* Header */}
        <div className="how-to-header" style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{ color: 'var(--star)', fontSize: 18 }}>✦</span>
            <span style={{ fontSize: 13, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
              Karaoke Pitch Guide
            </span>
          </div>
          <h2 style={{ fontSize: 32, fontFamily: "'Playfair Display', serif", fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>
            How to use Kara
          </h2>
          <p style={{ fontSize: 15, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
            Master your favorite melodies with visual pitch mapping.
          </p>
        </div>
 
        {/* Step-by-Step Guide */}
        <div className="how-to-steps" style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 32 }}>
          {/* Step 1 */}
          <div className="how-to-step-item" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div className="how-to-step-badge" style={{
              width: 36, height: 36, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifycontent: 'center', fontWeight: 700, flexShrink: 0,
              color: 'var(--text-primary)', fontFamily: 'monospace', display: 'flex', justifyContent: 'center'
            }}>
              1
            </div>
            <div className="how-to-step-content">
              <h4 className="how-to-step-title" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                Check Artist & Song Name or Upload
              </h4>
              <p className="how-to-step-text" style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Use the search bar and verify both the <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>exact artist name and song title</strong> for precise lyric matching, or upload your own audio file (MP3/WAV/M4A) directly into the studio.
              </p>
            </div>
          </div>
 
          {/* Step 2 */}
          <div className="how-to-step-item" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div className="how-to-step-badge" style={{
              width: 36, height: 36, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifycontent: 'center', fontWeight: 700, flexShrink: 0,
              color: 'var(--text-primary)', fontFamily: 'monospace', display: 'flex', justifyContent: 'center'
            }}>
              2
            </div>
            <div className="how-to-step-content">
              <h4 className="how-to-step-title" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                AI Pitch & Lyrics Alignment
              </h4>
              <p className="how-to-step-text" style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Our in-browser Basic Pitch AI maps the vocal melody while automatically syncing the lyrics word-by-word.
              </p>
            </div>
          </div>
 
          {/* Step 3 */}
          <div className="how-to-step-item" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div className="how-to-step-badge" style={{
              width: 36, height: 36, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifycontent: 'center', fontWeight: 700, flexShrink: 0,
              color: 'var(--text-primary)', fontFamily: 'monospace', display: 'flex', justifyContent: 'center'
            }}>
              3
            </div>
            <div className="how-to-step-content">
              <h4 className="how-to-step-title" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                Follow the Pitch Contour
              </h4>
              <p className="how-to-step-text" style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Words float higher for high notes and dip for low notes. Follow the directional arrows and active word highlights to hit the perfect pitch!
              </p>
            </div>
          </div>
        </div>
 
        {/* CTA Button */}
        <button
          className="how-to-cta-btn"
          onClick={() => setIsHowToOpen(false)}
          style={{
            width: '100%',
            background: 'var(--cta-bg)',
            color: 'var(--cta-text)',
            border: 'none',
            borderRadius: 'var(--radius-pill)',
            padding: '14px',
            fontSize: 16,
            fontWeight: 600,
            fontFamily: 'Inter, sans-serif',
            cursor: 'pointer',
            transition: 'background 0.2s, transform 0.2s',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#2C2C2A'; e.currentTarget.style.transform = 'scale(1.01)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--cta-bg)'; e.currentTarget.style.transform = 'scale(1)'; }}
        >
          Got it, let's sing! ✦
        </button>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
