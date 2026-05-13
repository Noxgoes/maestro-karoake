import { create } from 'zustand';

export const useAppStore = create((set, get) => ({
  song: '',
  artist: '',
  originalLyrics: [],
  romanizedLyrics: [],
  languageMode: 'original', // 'original' or 'romanized'
  lyrics: [], // Currently active lyrics array based on mode
  alignedLyrics: [], // Currently active aligned array
  alignedOriginal: [],
  alignedRomanized: [],
  isAnalyzing: false,
  showPlayer: false,
  analysisStep: '',
  syncedLyrics: null,
  albumArt: null,
  error: null,
  
  // Queue / Playlist
  queue: [], // Array of { song, artist }
  
  // Playback state
  audioBuffer: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  playbackRate: 1,
  syncOffsetMs: 0, // user-adjustable lyric sync nudge (±ms)
  lastSeekTime: 0, // triggered whenever user seek/rewind happens

  // Mic state
  isMicActive: false,
  micPitch: 0,
  micMidi: 0,
  pitchHistory: [], // array of { time, midi }
  accuracyScore: null,
  
  addToQueue: (song, artist) => set(state => ({ queue: [...state.queue, { song, artist }] })),
  removeFromQueue: (index) => set(state => ({ queue: state.queue.filter((_, i) => i !== index) })),
  
  setSongInfo: (song, artist) => set({ song, artist }),
  setSong: (song) => set({ song }),
  setArtist: (artist) => set({ artist }),
  useRomanized: true,
  toggleRomanized: () => {
    const { useRomanized, alignedOriginal, alignedRomanized } = get();
    const next = !useRomanized;
    set({ 
      useRomanized: next, 
      alignedLyrics: (next && alignedRomanized.length > 0) ? alignedRomanized : alignedOriginal
    });
  },

  setLyrics: (data) => {
    if (!data) return;
    
    // Reset syncedLyrics to null by default
    set({ syncedLyrics: null });
    
    const lyricsObj = data.lyrics || data;
    const synced = data.syncedLyrics || null;

    if (Array.isArray(lyricsObj)) {
      set({ 
        lyrics: lyricsObj, 
        originalLyrics: lyricsObj, 
        romanizedLyrics: [], 
        syncedLyrics: synced,
        useRomanized: false 
      });
    } else {
      const original = lyricsObj.original || [];
      const romanized = lyricsObj.romanized || [];
      const hasRomanized = romanized.length > 0;
      
      // If we have romanized, default to it
      const activeArray = hasRomanized ? romanized : original;

      set({ 
        originalLyrics: original,
        romanizedLyrics: romanized,
        lyrics: activeArray,
        alignedLyrics: [],
        alignedOriginal: [],
        alignedRomanized: [],
        syncedLyrics: synced,
        useRomanized: hasRomanized,
        artist: data.officialArtist || get().artist,
        song: data.officialTitle || get().song
      });
    }
  },
  setLanguageMode: (mode) => set((state) => ({
    languageMode: mode,
    lyrics: mode === 'romanized' && state.romanizedLyrics.length > 0 ? state.romanizedLyrics : state.originalLyrics,
    alignedLyrics: [] // Require re-alignment when lyrics change
  })),
  setAlignedLyrics: (alignedLyrics) => set({ alignedLyrics }),
  setIsAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
  setShowPlayer: (showPlayer) => set({ showPlayer }),
  setAnalysisStep: (analysisStep) => set({ analysisStep }),
  setError: (error) => set({ error }),
  setAlbumArt: (albumArt) => set({ albumArt }),
  
  setAudioBuffer: (audioBuffer) => set({ audioBuffer }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
  setPlaybackRate: (playbackRate) => set({ playbackRate }),
  setSyncOffsetMs: (syncOffsetMs) => set({ syncOffsetMs }),
  setLastSeekTime: (lastSeekTime) => set({ lastSeekTime }),
  
  setIsMicActive: (isMicActive) => set({ isMicActive }),
  setMicPitchData: (pitch, midi, time) => set((state) => ({
    micPitch: pitch,
    micMidi: midi,
    pitchHistory: [...state.pitchHistory, { time, midi }].slice(-200) // Keep last 200 frames
  })),
  clearPitchHistory: () => set({ pitchHistory: [] }),
  setAccuracyScore: (accuracyScore) => set({ accuracyScore })
}));
