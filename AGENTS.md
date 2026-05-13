# AGENTS.md — Karaoke Pitch Visualizer App

## Project Overview

A karaoke-style web app where lyrics are displayed at vertical positions that mirror
the singer's pitch — high notes push words up, low notes pull them down — so the user
can intuitively match the original vocal melody. Inspired by hand-drawn pitch contour
diagrams like the reference sketch.

---

## Tech Stack

| Layer        | Choice                          | Reason                                              |
|--------------|---------------------------------|-----------------------------------------------------|
| Frontend     | React + Vite                    | Fast HMR, easy component model                      |
| Styling      | Tailwind CSS                    | Utility-first, quick iteration                      |
| Audio Engine | Web Audio API + Pitchy (JS)     | Browser-native, no server round-trip for mic input  |
| Pitch Source | Basic Pitch (Spotify, WASM)     | Offline melody extraction from uploaded audio       |
| Lyrics       | Genius API (RapidAPI proxy)     | Romanized-first search strategy                     |
| Alignment    | Custom word-timestamper         | Maps lyric words → pitch Hz values                  |
| Backend      | Node.js + Express (thin server) | Proxies Genius API to hide token                    |
| State        | Zustand                         | Lightweight global store                            |

---

## Pipeline (End-to-End)

```
User Input (song name + artist)
        │
        ▼
[1] LYRICS FETCH (Genius API)
        │  Search query: "<song> <artist> romanized"
        │  If no romanized result → retry without "romanized"
        │  If still nothing → fallback to raw Genius top hit
        │  Parse: strip section headers [Verse], [Chorus] etc.
        │  Output: ordered word array with rough line/section metadata
        │
        ▼
[2] AUDIO SOURCE
        │  Option A (Upload): user uploads MP3/WAV/M4A
        │  Option B (YouTube): user pastes YT URL → server extracts audio via yt-dlp
        │  Output: PCM audio buffer (Float32Array, 22050 Hz mono)
        │
        ▼
[3] PITCH EXTRACTION  (runs in-browser via WASM)
        │  Library: @spotify/basic-pitch
        │  Input: audio buffer
        │  Output: array of { timeSeconds, pitchHz, confidence } frames at ~10ms resolution
        │  Post-process:
        │    - Drop frames with confidence < 0.5
        │    - Median-smooth over 5-frame windows
        │    - Quantize to nearest semitone (MIDI note number)
        │
        ▼
[4] WORD–PITCH ALIGNMENT
        │  Strategy:
        │    a. Detect voiced segments (pitch present) → vocal phrase boundaries
        │    b. Count syllables per word (syllable-count npm package)
        │    c. Distribute lyric words across voiced segments proportionally
        │    d. Assign each word the median pitch of its time slice
        │  Output: alignedLyrics[] = [{ word, startMs, endMs, pitchHz, midiNote }]
        │
        ▼
[5] PITCH NORMALISATION (for display)
        │  - Find min/max MIDI note in song
        │  - Map to Y-axis: 0% (top, highest note) → 100% (bottom, lowest note)
        │  - Output: each word gets a `yPercent` (0–100) value
        │
        ▼
[6] RENDER — PitchCanvas component
        │  - SVG/Canvas layer: draw bezier curve through word anchor points
        │  - Words float at their yPercent position
        │  - Arrows between words point in direction of pitch movement
        │  - During playback: active word highlighted, past words faded
        │
        ▼
[7] KARAOKE PLAYBACK
           - Web Audio API plays the source audio
           - requestAnimationFrame loop checks currentTime
           - Active word determined by currentTime within [startMs, endMs]
           - Optional: mic input → real-time pitch via Pitchy → overlay user's pitch curve
```

---

## Directory Structure

```
/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── SearchBar.jsx          # Song + artist input
│   │   │   ├── AudioUploader.jsx      # Drag-drop or URL paste
│   │   │   ├── PitchCanvas.jsx        # Core SVG visualizer
│   │   │   ├── WordBubble.jsx         # Individual lyric word node
│   │   │   ├── PlaybackControls.jsx   # Play/pause/seek/BPM
│   │   │   └── MicOverlay.jsx         # Optional live pitch overlay
│   │   ├── hooks/
│   │   │   ├── usePitchExtraction.js  # Basic Pitch WASM wrapper
│   │   │   ├── useAudioPlayer.js      # Web Audio API playback
│   │   │   ├── useAlignment.js        # Word–pitch alignment logic
│   │   │   └── useMicPitch.js         # Real-time mic pitch via Pitchy
│   │   ├── store/
│   │   │   └── appStore.js            # Zustand: song, lyrics, alignment, playback
│   │   ├── utils/
│   │   │   ├── geniusClient.js        # Lyrics fetch + romanized fallback
│   │   │   ├── pitchUtils.js          # Hz→MIDI, smoothing, quantise
│   │   │   ├── alignUtils.js          # Voiced segment detection, syllable split
│   │   │   └── renderUtils.js         # yPercent calc, bezier path helpers
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   └── vite.config.js
│
├── server/
│   ├── routes/
│   │   ├── lyrics.js                  # GET /api/lyrics?q=&artist=
│   │   └── audio.js                   # POST /api/audio/extract (yt-dlp)
│   ├── middleware/
│   │   └── rateLimit.js
│   └── index.js
│
├── .env.example
├── package.json
└── AGENTS.md
```

---

## Genius API — Lyrics Fetch Strategy

```js
// geniusClient.js

async function fetchLyrics(song, artist) {
  // Step 1: Try romanized
  let result = await searchGenius(`${song} ${artist} romanized`);

  // Step 2: Fallback — no "romanized" qualifier
  if (!result) result = await searchGenius(`${song} ${artist}`);

  // Step 3: Last resort — song name only
  if (!result) result = await searchGenius(song);

  if (!result) throw new Error('Lyrics not found');

  const rawLyrics = await scrapeLyricsPage(result.url); // server-side scrape
  return parseToWordArray(rawLyrics);
}

function parseToWordArray(raw) {
  // Remove [Verse 1], [Chorus], etc.
  // Split into lines → words
  // Return: [{ word: string, lineIndex: number, wordIndex: number }]
}
```

---

## Pitch Extraction — Basic Pitch

```js
// usePitchExtraction.js

import { BasicPitch, noteFramesToTime, addPitchBendsToNoteEvents, outputToNotesPoly } from '@spotify/basic-pitch';

async function extractPitch(audioBuffer) {
  const basicPitch = new BasicPitch('/basic-pitch-model/model.json');

  let frames = [], onsets = [], contours = [];
  await basicPitch.evaluateModel(audioBuffer, (f, o, c) => {
    frames.push(...f); onsets.push(...o); contours.push(...c);
  });

  const notes = outputToNotesPoly(frames, onsets, 0.5, 0.3, true);
  // Returns: [{ startTimeSeconds, durationSeconds, pitchMidi, amplitude }]
  return notes;
}
```

---

## Word–Pitch Alignment Logic

```
voiced_segments = group consecutive pitch frames with confidence > 0.5
                  with gaps < 300ms merged

for each lyric line:
  find best matching voiced_segment by position in song
  syllable_count = sum syllables of all words in line
  time_per_syllable = segment.duration / syllable_count

  for each word in line:
    word.startMs = segment.start + elapsed_syllable_time
    word.endMs   = word.startMs + (syllables_in_word * time_per_syllable)
    word.pitchHz = median pitch in [word.startMs, word.endMs]
    word.midiNote = hzToMidi(word.pitchHz)
    elapsed_syllable_time += syllables_in_word * time_per_syllable
```

---

## PitchCanvas Render Logic

```
Canvas coordinate system:
  X axis → time (left = song start, right = song end), wraps per line/row
  Y axis → pitch (top = highest note in song, bottom = lowest)

For each word node:
  cx = timeToX(word.startMs)
  cy = midiToY(word.midiNote)   ← normalised between song min/max MIDI

SVG elements per word:
  <text> positioned at (cx, cy)
  <path> bezier curve through all (cx, cy) anchor points per phrase
  Arrow head at each word pointing toward next word's direction

Playback highlight:
  currentWord = alignedLyrics.find(w => currentMs >= w.startMs && currentMs < w.endMs)
  Apply CSS class: active (bright), past (muted), future (dim)
```

---

## UI Screens

### 1. Search Screen
- Large centered search input: "Song name — Artist"
- Recent searches carousel
- CTA: "Find Pitch Map"

### 2. Audio Source Screen
- Two tabs: **Upload Audio** | **YouTube URL**
- Drag-and-drop zone or URL text field
- "Analyse Pitch" button with animated waveform loader

### 3. Pitch Visualizer (Main Screen)
- Full-width scrollable SVG canvas
- Words flow left-to-right, positioned vertically by pitch
- Bezier curves and directional arrows connecting words
- Floating pitch legend: low ↕ high on Y axis
- Bottom bar: playback controls (play/pause, scrubber, tempo ×0.5/×0.75/×1)
- Optional toggle: **Show my pitch** — enables mic overlay

### 4. Mic Overlay Mode
- User's real-time pitch plotted as a second colored curve on top
- Accuracy meter: how close to original pitch per word (green/yellow/red)

---

## Environment Variables

```
# .env.example

GENIUS_ACCESS_TOKEN=your_genius_api_token_here
GENIUS_BASE_URL=https://api.genius.com
PORT=3001
```

---

## Key npm Dependencies

```json
{
  "client": {
    "@spotify/basic-pitch": "^0.0.4",
    "pitchy": "^4.0.1",
    "syllable": "^5.0.0",
    "zustand": "^4.5.0",
    "tailwindcss": "^3.4.0",
    "react": "^18.3.0"
  },
  "server": {
    "express": "^4.18.0",
    "axios": "^1.6.0",
    "cheerio": "^1.0.0",
    "yt-dlp-wrap": "^2.3.3",
    "express-rate-limit": "^7.0.0"
  }
}
```

---

## Phase Plan

### Phase 1 — Core (Week 1–2)
- [ ] Genius API proxy on server, romanized fallback search
- [ ] Lyrics parser (strip headers, word array)
- [ ] Basic Pitch WASM integration, pitch frame output
- [ ] Naive alignment (even word distribution across voiced segments)
- [ ] Static PitchCanvas render (no playback yet)

### Phase 2 — Playback (Week 3)
- [ ] Web Audio API player hook
- [ ] requestAnimationFrame word highlight loop
- [ ] Scrubber + playback speed controls
- [ ] Audio upload + YouTube URL extraction via yt-dlp

### Phase 3 — Polish (Week 4)
- [ ] Bezier curve path + arrow heads between words
- [ ] Animated word entrance on first load
- [ ] Mic overlay (Pitchy real-time pitch)
- [ ] Accuracy scoring per phrase
- [ ] Mobile responsive layout

### Phase 4 — Stretch
- [ ] Export pitch map as PNG/SVG
- [ ] Multi-language toggle (romanized ↔ original script side-by-side)
- [ ] Community-contributed manual pitch corrections
- [ ] Playlist / queue mode

---

## Known Hard Parts & Mitigations

| Challenge                           | Mitigation                                                  |
|-------------------------------------|-------------------------------------------------------------|
| Genius blocks server-side scraping  | Use RapidAPI Genius endpoint which returns lyrics directly  |
| Basic Pitch slow on long audio      | Process in 30s chunks; show progress bar                    |
| Word–pitch alignment inaccuracy     | Allow manual drag-to-adjust per word in edit mode           |
| No romanized lyrics exist           | Surface a warning; let user paste custom romanized text     |
| CORS on audio URLs                  | Always route audio through own server, never direct CDN     |
| Mobile Web Audio autoplay policy    | Require explicit user tap before AudioContext resumes       |

---

## Notes for Codex (AI Coding Assistant)

- Always keep `geniusClient.js` on the **server** side — never expose the API token to the browser.
- `BasicPitch` runs only in browser (WASM). Do not attempt to run it in Node.
- `pitchy` is for **real-time mic pitch only** — Basic Pitch handles recorded audio.
- Word `yPercent` must be recalculated every time the song changes (dynamic min/max per song).
- The SVG canvas should wrap words into rows (like a text layout) but Y within each row reflects pitch, not a flat baseline.
- Preserve line breaks from Genius lyrics — each original line should stay on its own horizontal track.
