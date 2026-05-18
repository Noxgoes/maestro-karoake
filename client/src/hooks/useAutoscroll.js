import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom React hook for Ultimate Guitar-style autoscrolling.
 * Uses requestAnimationFrame for smooth, continuous scrolling.
 * 
 * @param {React.RefObject} containerRef The scrollable container ref
 * @param {boolean} isPlaying Whether the song is currently playing
 */
export function useAutoscroll(containerRef, isPlaying) {
  const [isScrolling, setIsScrolling] = useState(false);
  const [speed, setSpeedState] = useState(40);

  const isScrollingRef = useRef(false);
  const speedRef = useRef(40);
  const lastTimeRef = useRef(null);
  const rafIdRef = useRef(null);
  const isPausedRef = useRef(false);
  const pauseTimeoutRef = useRef(null);

  // Track high-precision fractional scroll position to prevent browser truncation at slow speeds (0.1, 0.2)
  const scrollPosRef = useRef(0);

  const setSpeed = useCallback((newSpeed) => {
    const clamped = Math.max(10, Math.min(200, newSpeed));
    setSpeedState(clamped);
    speedRef.current = clamped;
  }, []);

  const stop = useCallback(() => {
    setIsScrolling(false);
    isScrollingRef.current = false;
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    lastTimeRef.current = null;
  }, []);

  const start = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    setIsScrolling(true);
    isScrollingRef.current = true;
    lastTimeRef.current = null; // Reset to avoid jump
    scrollPosRef.current = container.scrollTop; // Sync starting high-precision position

    const loop = (timestamp) => {
      if (!isScrollingRef.current) return;
      const currentContainer = containerRef.current;
      if (!currentContainer) return;

      if (lastTimeRef.current === null) {
        lastTimeRef.current = timestamp;
      }
      const deltaMs = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      if (!isPausedRef.current) {
        const deltaSec = deltaMs / 1000;
        const scrollAmount = speedRef.current * deltaSec;
        
        // Accumulate high-precision coordinate
        scrollPosRef.current += scrollAmount;
        
        // Assign the rounded coordinate to prevent browser truncation
        currentContainer.scrollTop = Math.floor(scrollPosRef.current);

        // Auto-stop at bottom
        if (Math.ceil(currentContainer.scrollTop + currentContainer.clientHeight) >= currentContainer.scrollHeight) {
          stop();
          return;
        }
      }

      rafIdRef.current = requestAnimationFrame(loop);
    };

    rafIdRef.current = requestAnimationFrame(loop);
  }, [containerRef, stop]);

  const toggle = useCallback(() => {
    if (isScrollingRef.current) {
      stop();
    } else {
      start();
    }
  }, [start, stop]);

  const reset = useCallback(() => {
    stop();
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
      scrollPosRef.current = 0;
    }
  }, [containerRef, stop]);

  // Automatically stop autoscrolling if the song is paused
  useEffect(() => {
    if (!isPlaying && isScrollingRef.current) {
      stop();
    }
  }, [isPlaying, stop]);

  // Handle manual interaction (wheel/scroll/touch) to pause for 2s
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleManualInteraction = () => {
      // Synchronize high-precision ref with user's scroll position immediately
      scrollPosRef.current = container.scrollTop;

      if (isScrollingRef.current) {
        isPausedRef.current = true;
        if (pauseTimeoutRef.current) {
          clearTimeout(pauseTimeoutRef.current);
        }
        pauseTimeoutRef.current = setTimeout(() => {
          isPausedRef.current = false;
          lastTimeRef.current = null; // Reset delta timer
        }, 2000);
      }
    };

    container.addEventListener('wheel', handleManualInteraction, { passive: true });
    container.addEventListener('touchstart', handleManualInteraction, { passive: true });

    return () => {
      container.removeEventListener('wheel', handleManualInteraction);
      container.removeEventListener('touchstart', handleManualInteraction);
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
      }
    };
  }, [containerRef]);

  // Cleanup loop on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  return { isScrolling, speed, setSpeed, toggle, reset };
}
