import { syllable } from 'syllable';

// ---------------------------------------------------------------------------
// getMidiAtTime — median MIDI note within a tight window around a word
// ---------------------------------------------------------------------------
function getMidiAtTime(sortedNotes, centerMs, windowSec = 0.12) {
  const centerSec = centerMs / 1000;
  const nearby = sortedNotes.filter(n => {
    const s = n.startTimeSeconds;
    const e = s + n.durationSeconds;
    return e >= centerSec - windowSec && s <= centerSec + windowSec;
  });

  if (nearby.length > 0) {
    const sorted = [...nearby].sort((a, b) => a.pitchMidi - b.pitchMidi);
    return Math.round(sorted[Math.floor(sorted.length / 2)].pitchMidi);
  }

  if (sortedNotes.length === 0) return 60;
  return sortedNotes.reduce((best, n) => {
    const nc = n.startTimeSeconds + n.durationSeconds / 2;
    const bc = best.startTimeSeconds + best.durationSeconds / 2;
    return Math.abs(nc - centerSec) < Math.abs(bc - centerSec) ? n : best;
  }).pitchMidi;
}

// ---------------------------------------------------------------------------
// detectVoicedSegments — for backward compat
// ---------------------------------------------------------------------------
export function detectVoicedSegments(pitchFrames, minConfidence = 0.5, maxGapMs = 300) {
  const segments = [];
  let currentSegment = null;

  for (const frame of pitchFrames) {
    if (frame.amplitude > minConfidence) {
      if (!currentSegment) {
        currentSegment = { startMs: frame.timeSeconds * 1000, frames: [] };
      }
      currentSegment.frames.push(frame);
      currentSegment.endMs = frame.timeSeconds * 1000;
    } else {
      if (currentSegment) {
        const gap = frame.timeSeconds * 1000 - currentSegment.endMs;
        if (gap > maxGapMs) {
          segments.push(currentSegment);
          currentSegment = null;
        }
      }
    }
  }
  if (currentSegment) segments.push(currentSegment);
  return segments;
}

// ---------------------------------------------------------------------------
// addPitchToLyrics
// ---------------------------------------------------------------------------
export function addPitchToLyrics(words, pitchNotes) {
  const sortedNotes = [...pitchNotes].sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
  return words.map(w => ({
    ...w,
    startMs: w.startMs,
    endMs:   w.endMs,
    midiNote: getMidiAtTime(sortedNotes, (w.startMs + w.endMs) / 2, 0.12),
  }));
}

// ---------------------------------------------------------------------------
// alignLyrics — Syllable-math estimation fallback
// ---------------------------------------------------------------------------
export function alignLyrics(lyrics, pitchNotes, audioDurationSecs) {
  const lineMap = {};
  lyrics.forEach(w => {
    if (!lineMap[w.lineIndex]) lineMap[w.lineIndex] = [];
    lineMap[w.lineIndex].push(w);
  });
  const lineKeys = Object.keys(lineMap).sort((a, b) => Number(a) - Number(b));

  if (!lineKeys.length) return lyrics;

  const audioDurationMs = (audioDurationSecs || 180) * 1000;
  const sortedNotes = [...pitchNotes].sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
  const confidentNotes = sortedNotes.filter(n => n.amplitude > 0.45);

  let songStartMs = sortedNotes.length > 0 ? sortedNotes[0].startTimeSeconds * 1000 : audioDurationMs * 0.05;
  let songEndMs = sortedNotes.length > 0 ? (sortedNotes[sortedNotes.length - 1].startTimeSeconds + sortedNotes[sortedNotes.length - 1].durationSeconds) * 1000 : audioDurationMs * 0.95;

  if (confidentNotes.length > 0) {
    const firstMs = confidentNotes[0].startTimeSeconds * 1000;
    const lastMs  = (confidentNotes[confidentNotes.length - 1].startTimeSeconds + confidentNotes[confidentNotes.length - 1].durationSeconds) * 1000;
    songStartMs = firstMs < 2000 ? Math.max(firstMs, 3000) : firstMs;
    songEndMs   = lastMs;
  }

  if (songEndMs - songStartMs < 5000) {
    songStartMs = audioDurationMs * 0.03;
    songEndMs   = audioDurationMs * 0.97;
  }

  const totalSyllables = lineKeys.reduce((s, lk) => s + lineMap[lk].reduce((ss, w) => ss + Math.max(1, syllable(w.word)), 0), 0);
  const spanMs = songEndMs - songStartMs;
  const msPerSyllable = Math.max(200, Math.min(800, spanMs / Math.max(1, totalSyllables)));

  const aligned = [];
  let cursorMs = songStartMs;

  lineKeys.forEach(lk => {
    const words    = lineMap[lk];
    const lineSyls = words.reduce((s, w) => s + Math.max(1, syllable(w.word)), 0);
    const lineDurMs = lineSyls * msPerSyllable;

    const nearbyNotes = sortedNotes.filter(n => {
      const ns = n.startTimeSeconds * 1000;
      return ns >= cursorMs && ns <= cursorMs + 5000;
    });
    const words = lineMap[lk];

    words.forEach(w => {
      const syls    = Math.max(1, syllable(w.word));
      const wordDur = syls * timePerSyl;
      aligned.push({
        ...w,
        startMs:  wordCursor,
        endMs:    wordCursor + wordDur,
        midiNote: getMidiAtTime(sortedNotes, wordCursor + wordDur / 2, 0.12),
      });
      wordCursor += wordDur;
    });
  });

  return aligned;
}

export function alignLyricsNaive(geniusLyrics, pitchNotes, songDurationMs) {
  const sortedNotes = [...pitchNotes].sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
  const aligned = [];

  const lineMap = {};
  geniusLyrics.forEach(w => {
    if (!lineMap[w.lineIndex]) lineMap[w.lineIndex] = [];
    lineMap[w.lineIndex].push(w);
  });

  const lineKeys = Object.keys(lineMap).sort((a, b) => Number(a) - Number(b));
  const totalSyllables = geniusLyrics.reduce((acc, w) => acc + Math.max(1, syllable(w.word)), 0);

  // ── SMARTER START: Detect first vocal to avoid intro drift ──
  const firstVoiced = sortedNotes.find(n => n.amplitude > 0.1);
  const startOffset = firstVoiced ? (firstVoiced.startTimeSeconds * 1000) : 0;
  const effectiveDuration = songDurationMs - startOffset;
  const msPerSyl = effectiveDuration / Math.max(1, totalSyllables);

  let wordCursor = startOffset;

  lineKeys.forEach(lk => {
    const words = lineMap[lk];
    words.forEach(w => {
      const syls = Math.max(1, syllable(w.word));
      const dur = syls * msPerSyl;
      aligned.push({
        ...w,
        startMs:  wordCursor,
        endMs:    wordCursor + dur,
        midiNote: getMidiAtTime(sortedNotes, wordCursor + dur / 2, 0.12),
      });
      wordCursor += dur;
    });
  });

  return aligned;
}

// ---------------------------------------------------------------------------
// alignLyricsToLrc — aligns Genius lyrics to LRC line timestamps
// ---------------------------------------------------------------------------
export function alignLyricsToLrc(geniusLyrics, lrcLines, pitchNotes) {
  const sortedNotes = [...pitchNotes].sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
  
  const lineMap = {};
  geniusLyrics.forEach(w => {
    if (!lineMap[w.lineIndex]) lineMap[w.lineIndex] = [];
    lineMap[w.lineIndex].push(w);
  });

  const lineKeys = Object.keys(lineMap)
    .sort((a, b) => Number(a) - Number(b))
    .filter(lk => {
      const lineText = lineMap[lk].map(w => w.word).join(' ').trim();
      return !(lineText.startsWith('[') && lineText.endsWith(']')) && 
             !(lineText.startsWith('(') && lineText.endsWith(')'));
    });

  const aligned = [];
  
  lineKeys.forEach((lk, idx) => {
    const words = lineMap[lk];
    const lrc = lrcLines[idx];
    
    if (lrc) {
      const lineDuration = lrc.endMs - lrc.startMs;
      const totalSyllables = words.reduce((s, w) => s + Math.max(1, syllable(w.word)), 0);
      const msPerSyl = lineDuration / Math.max(1, totalSyllables);
      
      let cursorMs = lrc.startMs;
      words.forEach(w => {
        const syls = Math.max(1, syllable(w.word));
        const dur = syls * msPerSyl;
        aligned.push({
          ...w,
          startMs: cursorMs,
          endMs: cursorMs + dur,
          midiNote: getMidiAtTime(sortedNotes, cursorMs + dur / 2, 0.12),
        });
        cursorMs += dur;
      });
    } else {
      const prevLine = aligned[aligned.length - 1];
      let cursorMs = prevLine ? prevLine.endMs + 500 : 5000;
      words.forEach(w => {
        const dur = 400;
        aligned.push({
          ...w,
          startMs: cursorMs,
          endMs: cursorMs + dur,
          midiNote: getMidiAtTime(sortedNotes, cursorMs + dur / 2, 0.12),
        });
        cursorMs += dur;
      });
    }
  });

  return aligned;
}

// ---------------------------------------------------------------------------
// parseLrc — converts raw LRC string into { startMs, endMs, text }[]
// ---------------------------------------------------------------------------
export function parseLrc(lrcString) {
  const lineRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.*)/;
  const lines = lrcString
    .split('\n')
    .map((raw, idx) => {
      const m = raw.match(lineRegex);
      if (!m || !m[4].trim()) return null;
      const startMs =
        parseInt(m[1]) * 60000 +
        parseInt(m[2]) * 1000 +
        parseInt(m[3].padEnd(3, '0'));
      return { startMs, text: m[4].trim(), lineIndex: idx };
    })
    .filter(Boolean);

  return lines.map((line, i) => ({
    ...line,
    endMs: lines[i + 1]?.startMs ?? line.startMs + 5000,
  }));
}
