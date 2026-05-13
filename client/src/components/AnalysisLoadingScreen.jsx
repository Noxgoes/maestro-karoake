import React, { useEffect, useState, useMemo } from 'react';
import { useAppStore } from '../store/appStore';

const STEPS = [
  { label: 'Downloading audio', subs: ['Fetching from source...', 'Receiving data...', 'Complete'], dur: 2000 },
  { label: 'Preparing stems', subs: ['Processing audio...', 'Normalizing...', 'Done'], dur: 2500 },
  { label: 'Syncing lyrics', subs: ['Aligning timestamps...', 'Mapping words...', 'Done'], dur: 3000 },
  { label: 'Extracting pitch', subs: ['Running model...', 'Calculating contours...', 'Done'], dur: 3500 },
];

export default function AnalysisLoadingScreen({ onCancel }) {
  const song = useAppStore(state => state.song);
  const artist = useAppStore(state => state.artist);
  const albumArt = useAppStore(state => state.albumArt);
  const analysisStep = useAppStore(state => state.analysisStep); // We could sync to this, or just fake it

  const [currentStep, setCurrentStep] = useState(0);
  const [pct, setPct] = useState(0);
  const [subTexts, setSubTexts] = useState(STEPS.map(s => 'Waiting...'));
  
  // Waveform bars
  const waveformBars = useMemo(() => {
    return Array.from({ length: 18 }).map((_, i) => ({
      height: 8 + Math.random() * 20,
      delay: (i * 0.07).toFixed(2),
      dur: (0.8 + Math.random() * 0.6).toFixed(2)
    }));
  }, []);

  useEffect(() => {
    let progressInterval;
    let stepTimers = [];

    const totalDur = STEPS.reduce((a, s) => a + s.dur, 0);
    const tickMs = 80;
    
    progressInterval = setInterval(() => {
      setPct(p => Math.min(p + (tickMs / totalDur) * 100, 95));
    }, tickMs);

    let cumulativeTime = 0;
    STEPS.forEach((step, idx) => {
      // Start step
      stepTimers.push(setTimeout(() => {
        setCurrentStep(idx);
        setSubTexts(prev => { const n = [...prev]; n[idx] = step.subs[0]; return n; });
        
        // Mid step sub text
        stepTimers.push(setTimeout(() => {
          setSubTexts(prev => { const n = [...prev]; n[idx] = step.subs[1]; return n; });
        }, step.dur * 0.45));
        
        // End step
        stepTimers.push(setTimeout(() => {
          setSubTexts(prev => { const n = [...prev]; n[idx] = step.subs[2]; return n; });
        }, step.dur - 50));
        
      }, cumulativeTime));
      
      cumulativeTime += step.dur;
    });

    return () => {
      clearInterval(progressInterval);
      stepTimers.forEach(clearTimeout);
    };
  }, []);

  return (
    <div className="kara-analysis-screen" style={{
      background: '#F5F0E8',
      display: 'flex', flexDirection: 'column',
      minHeight: '100vh',
      width: '100%'
    }}>
      <style>{`
        .kara-analysis-screen * { box-sizing: border-box; }
        .als-nav { display: flex; align-items: center; justify-content: space-between; padding: 18px 28px; background: #F5F0E8; }
        .als-logo { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 800; color: #1A1A1A; letter-spacing: -0.03em; cursor: pointer; display: flex; align-items: center; }
        .als-logo span { color: var(--star); font-size: 14px; vertical-align: super; margin-left: 1px; }
        .als-cancel { font-family: Inter, sans-serif; font-size: 13px; color: #6B6560; cursor: pointer; padding: 6px 14px; border-radius: 100px; border: 0.5px solid #C8B89A; background: transparent; transition: background 0.2s; }
        .als-cancel:hover { background: #EDE8DE; }
        
        .als-body { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem 2rem 3rem; }
        
        .als-album-wrap { position: relative; width: 140px; height: 140px; margin-bottom: 2rem; }
        .als-album { width: 140px; height: 140px; border-radius: 20px; background: #EDE8DE; overflow: hidden; position: relative; }
        .als-album-inner { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #D3CFC5; }
        .als-shimmer { position: absolute; inset: 0; background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%); background-size: 200% 100%; animation: als-shimmer 1.6s ease-in-out infinite; }
        @keyframes als-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        
        .als-pulse { position: absolute; inset: -10px; border-radius: 30px; border: 1.5px solid #C8B89A; animation: als-ringpulse 2s ease-out infinite; opacity: 0; }
        .als-pulse:nth-child(2) { animation-delay: .6s; }
        .als-pulse:nth-child(3) { animation-delay: 1.2s; }
        @keyframes als-ringpulse { 0% { opacity: .6; inset: -4px; } 100% { opacity: 0; inset: -22px; } }
        
        .als-title { font-size: 20px; font-weight: 700; color: #1A1A1A; text-align: center; letter-spacing: -0.02em; margin-bottom: 4px; font-family: 'Playfair Display', serif; }
        .als-artist { font-size: 13px; color: #6B6560; text-align: center; margin-bottom: 2.5rem; font-family: Inter, sans-serif; }
        
        .als-steps { display: flex; flex-direction: column; width: 100%; max-width: 320px; margin-bottom: 2.5rem; font-family: Inter, sans-serif; }
        .als-step { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 0.5px solid #E8E2D8; }
        .als-step:last-child { border-bottom: none; }
        
        .als-icon { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 13px; transition: all .4s; }
        .als-icon.done { background: #1D9E75; color: #fff; }
        .als-icon.active { background: #1A1A1A; color: #F5F0E8; animation: als-iconpulse 1.2s ease-in-out infinite; }
        .als-icon.waiting { background: #EDE8DE; color: #C8B89A; }
        @keyframes als-iconpulse { 0%, 100% { opacity: 1; } 50% { opacity: .6; } }
        
        .als-text { flex: 1; }
        .als-label { font-size: 13px; font-weight: 600; color: #1A1A1A; }
        .als-label.waiting { color: #6B6560; font-weight: 400; }
        .als-sub { font-size: 11px; color: #6B6560; margin-top: 1px; }
        .als-check { font-size: 14px; color: #1D9E75; opacity: 0; transition: opacity 0.3s; }
        .als-check.done { opacity: 1; }
        
        .als-prog-track { width: 100%; max-width: 320px; height: 3px; background: #EDE8DE; border-radius: 100px; overflow: hidden; }
        .als-prog-fill { height: 100%; background: #1A1A1A; border-radius: 100px; transition: width .8s cubic-bezier(.4,0,.2,1); }
        .als-prog-label { font-size: 12px; color: #6B6560; text-align: center; margin-top: .75rem; font-family: Inter, sans-serif; }
        
        .als-waveform { display: flex; align-items: center; justify-content: center; gap: 3px; height: 32px; margin-top: 2rem; }
        .als-wbar { width: 3px; border-radius: 100px; background: #C8B89A; animation: als-wave 1.2s ease-in-out infinite; }
        @keyframes als-wave { 0%, 100% { transform: scaleY(0.4); } 50% { transform: scaleY(1); } }
      `}</style>

      <nav className="als-nav">
        <button onClick={onCancel} style={{ background: 'none', border: 'none' }} className="als-logo">
          kara<span>✦</span>
        </button>
        <button className="als-cancel" onClick={onCancel}>Cancel</button>
      </nav>

      <div className="als-body">
        <div className="als-album-wrap">
          <div className="als-pulse"></div>
          <div className="als-pulse"></div>
          <div className="als-pulse"></div>
          <div className="als-album">
            <div className="als-album-inner">
              {albumArt ? (
                <img src={albumArt} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <circle cx="24" cy="24" r="20" stroke="#B4B2A9" strokeWidth="1"/>
                  <circle cx="24" cy="24" r="6" fill="#B4B2A9"/>
                  <circle cx="24" cy="24" r="2" fill="#EDE8DE"/>
                </svg>
              )}
            </div>
            <div className="als-shimmer"></div>
          </div>
        </div>

        <div className="als-title">{song || 'Loading...'}</div>
        <div className="als-artist">{artist || '...'}</div>

        <div className="als-steps">
          {STEPS.map((step, idx) => {
            const isWaiting = currentStep < idx;
            const isActive = currentStep === idx;
            const isDone = currentStep > idx;
            
            let iconClass = 'als-icon waiting';
            if (isActive) iconClass = 'als-icon active';
            if (isDone) iconClass = 'als-icon done';

            let labelClass = isWaiting ? 'als-label waiting' : 'als-label';

            return (
              <div className="als-step" key={idx}>
                <div className={iconClass}>
                  {isDone ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  ) : isActive ? (
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
                  ) : (
                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'currentColor' }} />
                  )}
                </div>
                <div className="als-text">
                  <div className={labelClass}>{step.label}</div>
                  <div className="als-sub">{isWaiting ? 'Waiting...' : subTexts[idx]}</div>
                </div>
                <span className={`als-check ${isDone ? 'done' : ''}`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </span>
              </div>
            );
          })}
        </div>

        <div className="als-prog-track">
          <div className="als-prog-fill" style={{ width: `${pct}%` }}></div>
        </div>
        <div className="als-prog-label">{Math.round(pct)}% complete</div>

        <div className="als-waveform">
          {waveformBars.map((bar, i) => (
            <div key={i} className="als-wbar" style={{
              height: bar.height,
              animationDelay: `${bar.delay}s`,
              animationDuration: `${bar.dur}s`
            }}></div>
          ))}
        </div>
      </div>
    </div>
  );
}
