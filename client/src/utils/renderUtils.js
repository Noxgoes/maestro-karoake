/**
 * Maps each word's midiNote to a yPercent value (0 = top/high, 100 = bottom/low)
 * across the FULL song so the pitch relationship between lines is preserved.
 */
export function calculateYPercents(alignedLyrics) {
  if (!alignedLyrics || alignedLyrics.length === 0) return [];
  
  const midis = alignedLyrics.map(w => w.midiNote).filter(m => typeof m === 'number' && !isNaN(m));
  if (midis.length === 0) return alignedLyrics.map(w => ({ ...w, yPercent: 50 }));

  const minMidi = Math.min(...midis);
  const maxMidi = Math.max(...midis);
  const range = maxMidi - minMidi;

  console.log(`[renderUtils] calculateYPercents: MIDI ${minMidi}–${maxMidi}, range=${range}, words=${alignedLyrics.length}`);

  return alignedLyrics.map(w => {
    let yPercent;
    if (range === 0) {
      // All words have the same pitch — spread them 20–80% based on word order
      // so there's at least some visual variation
      const totalWords = alignedLyrics.length;
      const idx = alignedLyrics.indexOf(w);
      yPercent = 20 + (idx / Math.max(1, totalWords - 1)) * 60;
    } else {
      // High note → top (low yPercent), Low note → bottom (high yPercent)
      yPercent = 100 - (((w.midiNote - minMidi) / range) * 100);
    }
    return { ...w, yPercent };
  });
}

/**
 * Generates a smooth Bezier SVG path string through an array of {x, y} points.
 */
export function generateBezierPath(points) {
  if (!points || points.length < 2) return '';
  
  let path = `M ${points[0].x},${points[0].y}`;
  
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    
    // Cubic bezier: control points create a smooth S-curve
    const cp1x = prev.x + (curr.x - prev.x) * 0.5;
    const cp1y = prev.y;
    const cp2x = prev.x + (curr.x - prev.x) * 0.5;
    const cp2y = curr.y;
    
    path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${curr.x},${curr.y}`;
  }
  
  return path;
}
