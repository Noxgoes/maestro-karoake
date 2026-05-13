import { useEffect, useRef } from 'react';
import { PitchDetector } from 'pitchy';
import { useAppStore } from '../store/appStore';
import { hzToMidi } from '../utils/pitchUtils';

export function useMicPitch() {
  const isMicActive = useAppStore(state => state.isMicActive);
  const setMicPitchData = useAppStore(state => state.setMicPitchData);
  const isPlaying = useAppStore(state => state.isPlaying);
  const currentTime = useAppStore(state => state.currentTime);

  const audioContextRef = useRef(null);
  const analyserNodeRef = useRef(null);
  const streamRef = useRef(null);
  const animationFrameRef = useRef(null);
  const detectorRef = useRef(null);
  const inputBufferRef = useRef(new Float32Array(2048));

  useEffect(() => {
    const initMic = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        audioContextRef.current = audioContext;
        
        const sourceNode = audioContext.createMediaStreamSource(stream);
        const analyserNode = audioContext.createAnalyser();
        analyserNode.fftSize = 2048;
        sourceNode.connect(analyserNode);
        analyserNodeRef.current = analyserNode;
        
        detectorRef.current = PitchDetector.forFloat32Array(analyserNode.fftSize);
        
        const updatePitch = () => {
          if (!analyserNodeRef.current || !detectorRef.current || !isPlaying) {
            animationFrameRef.current = requestAnimationFrame(updatePitch);
            return;
          }
          
          analyserNodeRef.current.getFloatTimeDomainData(inputBufferRef.current);
          const [pitch, clarity] = detectorRef.current.findPitch(
            inputBufferRef.current,
            audioContext.sampleRate
          );
          
          if (clarity > 0.8 && pitch > 50 && pitch < 2000) {
            const midi = hzToMidi(pitch);
            const state = useAppStore.getState();
            setMicPitchData(pitch, midi, state.currentTime);
            
            // Calculate accuracy against active word
            if (state.alignedLyrics && state.alignedLyrics.length > 0) {
              const currentMs = state.currentTime * 1000;
              const activeWord = state.alignedLyrics.find(w => currentMs >= w.startMs && currentMs < w.endMs);
              if (activeWord) {
                const diff = Math.abs(activeWord.midiNote - midi);
                // 0 diff = 100%, 1 diff = 80%, 2 diff = 60%
                const currentScore = Math.max(0, 100 - (diff * 20));
                
                // Keep a running average in accuracyScore, or just update it
                const oldScore = state.accuracyScore || currentScore;
                state.setAccuracyScore(Math.round((oldScore * 0.9) + (currentScore * 0.1)));
              }
            }
          }
          
          animationFrameRef.current = requestAnimationFrame(updatePitch);
        };
        
        updatePitch();
      } catch (err) {
        console.error('Failed to access microphone:', err);
      }
    };

    if (isMicActive) {
      initMic();
    } else {
      // Cleanup
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
      if (audioContextRef.current) audioContextRef.current.close();
    }

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [isMicActive, isPlaying]); // Only re-init if mic active state changes

  return null;
}
