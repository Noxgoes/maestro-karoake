import React, { createContext, useContext } from 'react';
import { useAudioPlayer } from '../hooks/useAudioPlayer';

const AudioPlayerContext = createContext(null);

export function AudioPlayerProvider({ children }) {
  const controls = useAudioPlayer();
  return (
    <AudioPlayerContext.Provider value={controls}>
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioControls() {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) throw new Error('useAudioControls must be used inside <AudioPlayerProvider>');
  return ctx;
}
