import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../store/appStore';

// Singleton AudioContext shared across the app so AudioBuffers are compatible
let sharedAudioContext = null;
export function getAudioContext() {
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return sharedAudioContext;
}

export function useAudioPlayer() {
  const audioBuffer = useAppStore(state => state.audioBuffer);
  const isPlaying = useAppStore(state => state.isPlaying);
  const playbackRate = useAppStore(state => state.playbackRate);
  const setIsPlaying = useAppStore(state => state.setIsPlaying);
  const setCurrentTime = useAppStore(state => state.setCurrentTime);
  const setDuration = useAppStore(state => state.setDuration);
  const setLastSeekTime = useAppStore(state => state.setLastSeekTime);

  const sourceNodeRef = useRef(null);
  const startTimeRef = useRef(0);
  const pauseTimeRef = useRef(0);
  const animationFrameRef = useRef(null);
  // Track which buffer we last played so we reset position on new buffer
  const lastBufferRef = useRef(null);

  // Update duration when buffer changes
  useEffect(() => {
    if (audioBuffer) {
      setDuration(audioBuffer.duration);
      // Only reset position if it's a new buffer
      if (audioBuffer !== lastBufferRef.current) {
        pauseTimeRef.current = 0;
        setCurrentTime(0);
        lastBufferRef.current = audioBuffer;
      }
    }
  }, [audioBuffer, setDuration, setCurrentTime]);

  const updateProgress = useCallback(() => {
    const ctx = getAudioContext();
    if (!ctx || !isPlaying) return;
    
    const elapsed = (ctx.currentTime - startTimeRef.current) * playbackRate;
    let current = pauseTimeRef.current + elapsed;
    
    if (audioBuffer && current >= audioBuffer.duration) {
      current = audioBuffer.duration;
      setCurrentTime(current);
      // Auto-stop at end
      if (sourceNodeRef.current) {
        try { sourceNodeRef.current.stop(); } catch (e) {}
        sourceNodeRef.current.disconnect();
        sourceNodeRef.current = null;
      }
      pauseTimeRef.current = 0;
      setIsPlaying(false);
      setCurrentTime(0);
    } else {
      setCurrentTime(current);
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    }
  }, [isPlaying, playbackRate, audioBuffer, setCurrentTime, setIsPlaying]);

  // Handle playback loop
  useEffect(() => {
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, updateProgress]);

  const play = useCallback(() => {
    if (!audioBuffer) return;
    const ctx = getAudioContext();

    // Browser requires user-gesture to resume AudioContext
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    
    // Stop any existing source
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch (e) {}
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.playbackRate.value = playbackRate;
    source.connect(ctx.destination);
    
    const offset = Math.max(0, Math.min(pauseTimeRef.current, audioBuffer.duration - 0.01));
    source.start(0, offset);
    sourceNodeRef.current = source;
    startTimeRef.current = ctx.currentTime;
    setIsPlaying(true);
  }, [audioBuffer, playbackRate, setIsPlaying]);

  const pause = useCallback(() => {
    if (!sourceNodeRef.current) return;
    const ctx = getAudioContext();
    
    const elapsed = (ctx.currentTime - startTimeRef.current) * playbackRate;
    pauseTimeRef.current += elapsed;
    
    try { sourceNodeRef.current.stop(); } catch (e) {}
    sourceNodeRef.current.disconnect();
    sourceNodeRef.current = null;
    setIsPlaying(false);
  }, [playbackRate, setIsPlaying]);

  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const seek = useCallback((time) => {
    const wasPlaying = isPlaying;
    if (wasPlaying) pause();
    const newTime = Math.max(0, Math.min(time, audioBuffer?.duration || 0));
    pauseTimeRef.current = newTime;
    setCurrentTime(newTime);
    setLastSeekTime(newTime); // Signal visualizer to jump
    if (wasPlaying) play();
  }, [isPlaying, pause, play, audioBuffer, setCurrentTime, setLastSeekTime]);

  const stop = useCallback(() => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch (e) {}
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    pauseTimeRef.current = 0;
    setCurrentTime(0);
    setLastSeekTime(0); // Signal visualizer to jump back
    setIsPlaying(false);
  }, [setCurrentTime, setIsPlaying, setLastSeekTime]);

  // Handle rate change mid-playback
  useEffect(() => {
    if (sourceNodeRef.current && isPlaying) {
      const ctx = getAudioContext();
      const elapsed = (ctx.currentTime - startTimeRef.current) * sourceNodeRef.current.playbackRate.value;
      pauseTimeRef.current += elapsed;
      startTimeRef.current = ctx.currentTime;
      sourceNodeRef.current.playbackRate.value = playbackRate;
    }
  }, [playbackRate, isPlaying]);

  // Auto-play when isPlaying is set to true externally (e.g. after analysis completes)
  useEffect(() => {
    if (isPlaying && !sourceNodeRef.current && audioBuffer) {
      play();
    }
  }, [isPlaying, audioBuffer, play]);

  return { play, pause, togglePlayback, seek, stop };
}
