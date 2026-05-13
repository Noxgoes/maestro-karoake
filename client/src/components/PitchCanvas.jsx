import React, { useMemo, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { calculateYPercents, generateBezierPath } from '../utils/renderUtils';
import { getAudioContext } from '../hooks/useAudioPlayer';

export default function PitchCanvas() {
  const alignedLyrics = useAppStore(state => state.alignedLyrics);
  const syncOffsetMs  = useAppStore(state => state.syncOffsetMs);
  const pitchHistory  = useAppStore(state => state.pitchHistory);
  const isMicActive   = useAppStore(state => state.isMicActive);
  const isAnalyzing   = useAppStore(state => state.isAnalyzing);
  const isPlaying     = useAppStore(state => state.isPlaying);
  const audioBuffer   = useAppStore(state => state.audioBuffer);
  const lastSeekTime  = useAppStore(state => state.lastSeekTime);
  const playbackRate  = useAppStore(state => state.playbackRate);
  const scrollRef     = useRef(null);

  // ── Mirror play/pause into local refs for RAF loop ──
  const isPlayingRef     = useRef(isPlaying);
  const playbackRateRef  = useRef(playbackRate);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { playbackRateRef.current = playbackRate; }, [playbackRate]);

  // ── Read time directly from AudioContext via RAF ──
  const [currentMs, setCurrentMs] = useState(0);
  const rafRef        = useRef(null);
  const startCtxTime  = useRef(0);   // ctx.currentTime when play() was called
  const pauseOffset   = useRef(0);   // song-seconds accumulated before this play segment

  // Listen for seek events from the player
  useEffect(() => {
    pauseOffset.current = lastSeekTime;
    if (isPlayingRef.current) {
      const ctx = getAudioContext();
      startCtxTime.current = ctx.currentTime;
    }
    setCurrentMs(lastSeekTime * 1000 + syncOffsetMs);
  }, [lastSeekTime, syncOffsetMs]);

  // When the player starts, capture the AudioContext start time
  useEffect(() => {
    if (isPlaying) {
      const ctx = getAudioContext();
      startCtxTime.current = ctx.currentTime;
      // pauseOffset stays from wherever we paused
    } else {
      // On pause, record accumulated position
      if (startCtxTime.current > 0) {
        const ctx = getAudioContext();
        pauseOffset.current += (ctx.currentTime - startCtxTime.current) * playbackRateRef.current;
        startCtxTime.current = 0;
      }
    }
  }, [isPlaying]);

  // Reset when a new audio buffer is loaded
  useEffect(() => {
    pauseOffset.current   = 0;
    startCtxTime.current  = 0;
    setCurrentMs(0);
  }, [audioBuffer]);

  // The RAF loop — runs every frame, computes fresh time, sets state
  useEffect(() => {
    const tick = () => {
      const ctx = getAudioContext();
      const elapsed = (isPlayingRef.current && startCtxTime.current > 0)
        ? (ctx.currentTime - startCtxTime.current) * playbackRateRef.current
        : 0;
      
      const songSec = pauseOffset.current + elapsed;
      setCurrentMs(Math.max(0, songSec * 1000) + syncOffsetMs);
      
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [syncOffsetMs]); // Re-run ensures instant snap on sync change

  const MIN_WORD_SPACING = 160;
  const rowHeight = 320; 
  const padding   = 60;
  const hPad      = 180; // Increased for ironclad clipping protection

  // ── Build per-line layout data ─────────────────────────────────────────────
  const { linesData, minMidi, maxMidi, svgWidth } = useMemo(() => {
    if (!alignedLyrics || alignedLyrics.length === 0)
      return { linesData: [], minMidi: 0, maxMidi: 100, svgWidth: 1200 };

    const normalizedLyrics = calculateYPercents(alignedLyrics);
    const midis   = alignedLyrics.map(w => w.midiNote);
    const _minMidi = Math.min(...midis);
    const _maxMidi = Math.max(...midis);

    const lineMap = {};
    normalizedLyrics.forEach(w => {
      if (!lineMap[w.lineIndex]) lineMap[w.lineIndex] = [];
      lineMap[w.lineIndex].push(w);
    });

    const _svgWidth = 1200; // Standard base width for scaling
    const maxWordsInLine = Math.max(...Object.values(lineMap).map(ws => ws.length));

    const sortedLineKeys = Object.keys(lineMap).sort((a, b) => Number(a) - Number(b));

    const _linesData = sortedLineKeys.map((lineIndex, idx) => {
      const words   = lineMap[lineIndex];
      const positionedWords = words.map((w, i) => {
        // Distribute X evenly between hPad and svgWidth - hPad
        const x = words.length > 1 
          ? hPad + (i / (words.length - 1)) * (_svgWidth - hPad * 2)
          : _svgWidth / 2; // Center if only one word
        const usableHeight = rowHeight - padding * 2;
        // Increased from 1.15 to 1.8 for more dramatic ups/downs
        const sensitiveYPercent = 50 + (w.yPercent - 50) * 1.8;
        const y = padding + (Math.min(Math.max(sensitiveYPercent, 0), 100) / 100) * usableHeight;
        return { ...w, x, y };
      });

      const pathData     = generateBezierPath(positionedWords);
      const lineStartMs  = positionedWords[0].startMs;
      const lineEndMs    = positionedWords[positionedWords.length - 1].endMs;

      return { lineIndex, yOffset: idx * rowHeight, words: positionedWords, pathData, startMs: lineStartMs, endMs: lineEndMs };
    });

    return { linesData: _linesData, minMidi: _minMidi, maxMidi: _maxMidi, svgWidth: _svgWidth };
  }, [alignedLyrics]);

  if (isAnalyzing) {
    return <LyricsSkeleton />;
  }

  if (!alignedLyrics || alignedLyrics.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        <p style={{ fontSize: '1.2rem', fontWeight: 500 }}>No lyrics found for this song.</p>
      </div>
    );
  }

  // ── FIX 4: Correct gap fallback ───────────────────────────────────────────
  // During a gap between lines, highlight the LAST completed line (not the next one).
  // Old code: linesData.find(l => currentMs < l.endMs)  ← wrong: picks NEXT line early
  // New code: linesData.findLast(l => currentMs >= l.endMs) ← picks last seen line
  const activeLine =
    linesData.find(l => currentMs >= l.startMs && currentMs < l.endMs) ??
    (currentMs > 0 ? [...linesData].reverse().find(l => currentMs >= l.endMs) : null);

  const totalHeight = Math.max(600, linesData.length * rowHeight + padding);

  // ── Auto-scroll: keep active line centred ─────────────────────────────────
  useEffect(() => {
    if (!scrollRef.current || !activeLine) return;
    const container = scrollRef.current;
    const viewportH = container.clientHeight;
    const viewportW = container.clientWidth;
    
    // Scale factor: how much the SVG is stretched/shrunk relative to our 1200 base
    const scale = viewportW / 1200;
    
    // Calculate target in screen pixels
    const lineCenterSvg = Number(activeLine.yOffset) + rowHeight / 2;
    const scrollTarget  = (lineCenterSvg * scale) - (viewportH / 2);
    
    container.scrollTo({ top: Math.max(0, scrollTarget), behavior: 'smooth' });
  }, [activeLine?.lineIndex]);

  // ── Mic overlay helpers ───────────────────────────────────────────────────
  const getCoordinates = (timeMs, midi) => {
    const line = linesData.find(l => timeMs >= l.startMs - 2000 && timeMs <= l.endMs + 2000);
    if (!line) return null;
    const lineDuration = line.endMs - line.startMs;
    const progress     = Math.max(0, Math.min(1, (timeMs - line.startMs) / Math.max(1, lineDuration)));
    const x = hPad + progress * (svgWidth - hPad * 2);
    const pitchRange       = Math.max(1, maxMidi - minMidi);
    const yPercent         = (maxMidi - midi) / pitchRange;
    const sensitiveYPercent = 0.5 + (yPercent - 0.5) * 1.15;
    const usableHeight     = rowHeight - padding * 2;
    const y = padding + Math.min(Math.max(sensitiveYPercent, 0), 1) * usableHeight;
    return { x, y: y + line.yOffset, rawY: y, lineOffset: line.yOffset };
  };

  let micPathByLine = {};
  if (isMicActive && pitchHistory.length > 0) {
    pitchHistory.forEach(ph => {
      const coords = getCoordinates(ph.time * 1000, ph.midi);
      if (coords) {
        if (!micPathByLine[coords.lineOffset]) micPathByLine[coords.lineOffset] = [];
        micPathByLine[coords.lineOffset].push(coords);
      }
    });
  }

  // ── Export SVG ────────────────────────────────────────────────────────────
  const handleExportSVG = () => {
    const svgElement = document.getElementById('pitch-canvas-svg');
    if (!svgElement) return;
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'pitch-map.svg';
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  return (
    <div
      ref={scrollRef}
      style={{
        width: '100%',
        overflowY: 'auto',
        background: 'var(--bg)',
        borderRadius: 'var(--radius-lg)',
        border: '0.5px solid var(--border-light)',
        marginTop: 8,
        position: 'relative',
        maxHeight: 'calc(100vh - 220px)',
      }}
      className="group"
    >
      {/* ── Status strip ── */}
      <div style={{
        position: 'sticky', top: 0, left: 0, right: 0, zIndex: 20,
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '8px 20px',
        background: 'var(--surface)',
        borderBottom: '0.5px solid var(--border-light)',
        fontSize: 11, fontFamily: 'monospace',
      }}>
        <span style={{ color: 'var(--text-muted)' }}>t={(currentMs / 1000).toFixed(2)}s</span>
        {activeLine ? (
          <>
            <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
              {activeLine.words.map(w => w.word).join(' ')}
            </span>
            <span style={{ color: 'var(--text-muted)' }}>
              {(activeLine.startMs / 1000).toFixed(2)}s – {(activeLine.endMs / 1000).toFixed(2)}s
            </span>
          </>
        ) : (
          <span style={{ color: 'var(--border)' }}>—</span>
        )}
        <span style={{ marginLeft: 'auto', color: 'var(--border)' }}>
          {alignedLyrics.length} words · {linesData.length} lines
        </span>
      </div>

      <button
        onClick={handleExportSVG}
        style={{
          position: 'absolute', top: 48, right: 16,
          background: 'var(--surface)', border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-pill)', padding: '6px 14px',
          fontSize: 12, fontFamily: 'Inter, sans-serif', color: 'var(--text-muted)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          zIndex: 10, opacity: 0, transition: 'opacity 0.2s',
        }}
        className="group-hover:opacity-100"
        onMouseEnter={e => e.currentTarget.style.opacity = '1'}
        onMouseLeave={e => e.currentTarget.style.opacity = '0'}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        Export Pitch Map
      </button>

      <svg 
        id="pitch-canvas-svg" 
        width="100%" 
        height="auto"
        viewBox={`0 0 ${svgWidth} ${totalHeight}`} 
        style={{ display: 'block', background: 'var(--bg)' }} 
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <marker id="arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
          </marker>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="activeGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {linesData.map(line => {
          const isLineActive = activeLine && Number(activeLine.lineIndex) === Number(line.lineIndex);
          const isLinePast   = activeLine
            ? Number(line.lineIndex) < Number(activeLine.lineIndex)
            : currentMs > line.endMs;

          return (
            <g key={`line-${line.lineIndex}`} transform={`translate(0, ${line.yOffset})`}>

              {/* ── Active-line highlight band ── */}
              {isLineActive && (
                <rect
                  x={0} y={0} width={svgWidth} height={rowHeight}
                  fill="var(--accent, #7C5CBF)"
                  opacity="0.08"
                  rx="0"
                />
              )}

              {/* ── Arrows between words ── */}

              {/* ── Mic overlay ── */}
              {isMicActive && micPathByLine[line.yOffset] && micPathByLine[line.yOffset].length > 1 && (
                <path
                  d={`M ${micPathByLine[line.yOffset].map(p => `${p.x},${p.rawY}`).join(' L ')}`}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.6"
                  filter="url(#glow)"
                />
              )}

              {/* ── Arrows between words ── */}
              {line.words.map((w, i) => {
                if (i === line.words.length - 1) return null;
                const next = line.words[i + 1];
                const dx   = next.x - w.x;
                const dy   = next.y - w.y;
                const angle = Math.atan2(dy, dx);
                const dist  = Math.sqrt(dx * dx + dy * dy);
                const offset = 32;
                if (dist < offset * 1.5) return null;
                const x1 = w.x    + Math.cos(angle) * offset;
                const y1 = w.y    + Math.sin(angle) * offset;
                const x2 = next.x - Math.cos(angle) * offset;
                const y2 = next.y - Math.sin(angle) * offset;
                const pitchDir   = next.midiNote > w.midiNote ? 'up' : next.midiNote < w.midiNote ? 'down' : 'flat';
                const arrowColor = isLineActive
                  ? '#121212'
                  : pitchDir === 'up'   ? 'var(--pitch-up)'
                  : pitchDir === 'down' ? 'var(--pitch-down)'
                  : 'var(--pitch-flat)';
                return (
                  <line
                    key={`arrow-${w.wordIndex}`}
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={arrowColor}
                    strokeWidth={isLineActive ? '2' : '1.5'}
                    opacity={isLineActive ? '0.7' : isLinePast ? '0.25' : '0.35'}
                    markerEnd="url(#arrowhead)"
                    style={{ transition: 'none' }}
                  />
                );
              })}

              {/* ── Words ── */}
              {line.words.map((w, i) => {
                // Colour / size based on LINE state (unified line highlight)
                const textColor  = isLineActive ? '#121212'
                  : isLinePast   ? 'rgba(157, 143, 127, 0.25)' 
                  : 'rgba(74, 69, 64, 0.4)';
                const fontSize   = isLineActive ? '24' : '20';
                const fontWeight = isLineActive ? '700' : '500';

                let rotation = 0;
                if (i < line.words.length - 1) {
                  const next = line.words[i + 1];
                  rotation = Math.atan2(next.y - w.y, next.x - w.x) * (180 / Math.PI) * 0.3;
                } else if (i > 0) {
                  const prev = line.words[i - 1];
                  rotation = Math.atan2(w.y - prev.y, w.x - prev.x) * (180 / Math.PI) * 0.3;
                }

                return (
                  <g
                    key={`word-${w.wordIndex}`}
                    transform={`translate(${w.x}, ${w.y}) rotate(${rotation})`}
                    style={{ transition: 'all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
                  >
                    <g
                      style={{
                        animation: `fadeInUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards`,
                        animationDelay: `${Math.min(2, w.wordIndex * 0.05)}s`,
                        opacity: 0,
                      }}
                    >
                      <text
                        x="0" y="0"
                        textAnchor={i === 0 ? 'start' : i === line.words.length - 1 ? 'end' : 'middle'}
                        dominantBaseline="middle"
                        fill={textColor}
                        fontSize={fontSize}
                        fontWeight={fontWeight}
                        fontFamily="'Playfair Display', Georgia, serif"
                        style={{
                          transition: 'all 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
                          filter: isLineActive ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' : 'none',
                          userSelect: 'none',
                          letterSpacing: '-0.02em',
                        }}
                      >
                        {w.word}
                      </text>

                      {/* MIDI label only on active line */}
                      {isLineActive && (
                        <text
                          x="0" y="26"
                          textAnchor="middle"
                          fill="var(--text-muted)"
                          fontSize="10"
                          fontFamily="monospace"
                          opacity="1"
                        >
                          {w.midiNote}
                        </text>
                      )}
                    </g>
                  </g>
                );
              })}

            </g>
          );
        })}
      </svg>
    </div>
  );
}

function LyricsSkeleton() {
  const lines = [5, 4, 6, 3, 5];
  return (
    <div style={{
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 32,
      padding: '60px 20px',
      minHeight: '50vh',
    }}>
      {lines.map((count, li) => (
        <div key={li} style={{ display: 'flex', gap: 16 }}>
          {Array.from({ length: count }).map((_, wi) => (
            <div
              key={wi}
              style={{
                width: 40 + Math.random() * 60,
                height: 24,
                borderRadius: 'var(--radius-pill)',
                background: 'var(--surface)',
                border: '0.5px solid var(--border-light)',
                animation: `pulse 1.5s ease-in-out infinite`,
                animationDelay: `${li * 0.1 + wi * 0.05}s`,
              }}
            />
          ))}
        </div>
      ))}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; transform: scale(0.98); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
