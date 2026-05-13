export function hzToMidi(hz) {
  if (hz <= 0) return 0;
  // A4 = 440Hz = MIDI 69
  return Math.round(69 + 12 * Math.log2(hz / 440));
}

export function smoothPitchFrames(frames, windowSize = 5) {
  const smoothed = [];
  for (let i = 0; i < frames.length; i++) {
    const window = frames.slice(
      Math.max(0, i - Math.floor(windowSize / 2)),
      Math.min(frames.length, i + Math.floor(windowSize / 2) + 1)
    );
    // Sort to find median
    window.sort((a, b) => a.pitchHz - b.pitchHz);
    const median = window[Math.floor(window.length / 2)];
    
    smoothed.push({
      ...frames[i],
      pitchHz: median.pitchHz
    });
  }
  return smoothed;
}
