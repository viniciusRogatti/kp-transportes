import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';

const DEFAULT_THRESHOLD = 0.5;
const KEYBOARD_STEP = 0.1;
const CONFIRM_ANIMATION_MS = 220;
const DEFAULT_THUMB_SIZE = 32;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const wait = (ms: number) => new Promise<void>((resolve) => {
  setTimeout(resolve, ms);
});

type UseSlideToConfirmParams = {
  threshold?: number;
  disabled?: boolean;
  onConfirm: () => Promise<void> | void;
  onError?: (error: unknown) => void;
  thumbSize?: number;
  persistConfirmed?: boolean;
};

type UseSlideToConfirmResult = {
  trackRef: RefObject<HTMLDivElement>;
  progress: number;
  progressPercent: number;
  thumbOffsetPx: number;
  shouldAnimate: boolean;
  isDragging: boolean;
  isLoading: boolean;
  isConfirmed: boolean;
  isReadyToConfirm: boolean;
  isInteractionDisabled: boolean;
  handlePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  handlePointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  handlePointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  handlePointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
  handleKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
};

export default function useSlideToConfirm({
  threshold = DEFAULT_THRESHOLD,
  disabled = false,
  onConfirm,
  onError,
  thumbSize = DEFAULT_THUMB_SIZE,
  persistConfirmed = true,
}: UseSlideToConfirmParams): UseSlideToConfirmResult {
  const safeThreshold = useMemo(() => clamp(Number(threshold) || DEFAULT_THRESHOLD, 0, 1), [threshold]);

  const trackRef = useRef<HTMLDivElement>(null);
  const pointerIdRef = useRef<number | null>(null);
  const dragStartXRef = useRef(0);
  const dragStartProgressRef = useRef(0);
  const progressRef = useRef(0);
  const travelRangeRef = useRef(1);
  const isMountedRef = useRef(true);
  const confirmingRef = useRef(false);

  const [travelRange, setTravelRange] = useState(1);
  const [progress, setProgressState] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [shouldAnimate, setShouldAnimate] = useState(true);

  const setProgress = useCallback((nextProgress: number) => {
    const clampedProgress = clamp(nextProgress, 0, 1);
    progressRef.current = clampedProgress;
    setProgressState(clampedProgress);
  }, []);

  const measureTrack = useCallback(() => {
    const node = trackRef.current;
    if (!node) return;
    const nextRange = Math.max(1, node.getBoundingClientRect().width - thumbSize);
    travelRangeRef.current = nextRange;
    setTravelRange(nextRange);
  }, [thumbSize]);

  const isInteractionDisabled = disabled || isLoading || isConfirmed;
  const isReadyToConfirm = !isConfirmed && progress >= safeThreshold;
  const progressPercent = progress * 100;
  const thumbOffsetPx = progress * travelRange;

  const resetToStart = useCallback(() => {
    setShouldAnimate(true);
    setProgress(0);
  }, [setProgress]);

  const confirmSlide = useCallback(async () => {
    if (isInteractionDisabled || confirmingRef.current) return;
    confirmingRef.current = true;

    setShouldAnimate(true);
    setProgress(1);
    setIsLoading(true);

    // Let the thumb finish the glide animation before calling the async action.
    await wait(CONFIRM_ANIMATION_MS);

    if (!isMountedRef.current) {
      confirmingRef.current = false;
      return;
    }

    try {
      await Promise.resolve(onConfirm());
      if (isMountedRef.current) {
        if (persistConfirmed) {
          setIsConfirmed(true);
        } else {
          resetToStart();
        }
      }
    } catch (error) {
      if (isMountedRef.current) {
        resetToStart();
      }
      onError?.(error);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
      confirmingRef.current = false;
    }
  }, [isInteractionDisabled, onConfirm, onError, persistConfirmed, resetToStart, setProgress]);

  const finishDrag = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    setShouldAnimate(true);

    if (progressRef.current >= safeThreshold) {
      void confirmSlide();
      return;
    }

    resetToStart();
  }, [confirmSlide, isDragging, resetToStart, safeThreshold]);

  const releasePointer = useCallback((target: HTMLDivElement, pointerId: number) => {
    try {
      target.releasePointerCapture(pointerId);
    } catch {
      // no-op: pointer might already be released by browser.
    }
    pointerIdRef.current = null;
  }, []);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (isInteractionDisabled) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    pointerIdRef.current = event.pointerId;
    dragStartXRef.current = event.clientX;
    dragStartProgressRef.current = progressRef.current;
    setIsDragging(true);
    setShouldAnimate(false);

    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }, [isInteractionDisabled]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (isInteractionDisabled || !isDragging || pointerIdRef.current !== event.pointerId) return;

    // Pointer delta is converted into a clamped progress so the thumb never leaves the track.
    const deltaX = event.clientX - dragStartXRef.current;
    const startOffset = dragStartProgressRef.current * travelRangeRef.current;
    const nextOffset = clamp(startOffset + deltaX, 0, travelRangeRef.current);
    setProgress(nextOffset / travelRangeRef.current);

    if (event.cancelable) {
      event.preventDefault();
    }
  }, [isDragging, isInteractionDisabled, setProgress]);

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) return;
    releasePointer(event.currentTarget, event.pointerId);
    finishDrag();
  }, [finishDrag, releasePointer]);

  const handlePointerCancel = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) return;
    releasePointer(event.currentTarget, event.pointerId);
    setIsDragging(false);
    resetToStart();
  }, [releasePointer, resetToStart]);

  const handleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (isInteractionDisabled) return;

    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault();
      setShouldAnimate(true);
      setProgress(progressRef.current + KEYBOARD_STEP);
      return;
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault();
      setShouldAnimate(true);
      setProgress(progressRef.current - KEYBOARD_STEP);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      setShouldAnimate(true);
      setProgress(0);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      setShouldAnimate(true);
      setProgress(1);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      resetToStart();
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (progressRef.current >= safeThreshold) {
        void confirmSlide();
      }
    }
  }, [confirmSlide, isInteractionDisabled, resetToStart, safeThreshold, setProgress]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    measureTrack();
    const node = trackRef.current;
    if (!node) return undefined;

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => measureTrack());
      observer.observe(node);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', measureTrack);
    return () => window.removeEventListener('resize', measureTrack);
  }, [measureTrack]);

  useEffect(() => {
    if (!isInteractionDisabled || !isDragging) return;
    setIsDragging(false);
  }, [isDragging, isInteractionDisabled]);

  return {
    trackRef,
    progress,
    progressPercent,
    thumbOffsetPx,
    shouldAnimate,
    isDragging,
    isLoading,
    isConfirmed,
    isReadyToConfirm,
    isInteractionDisabled,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handleKeyDown,
  };
}
