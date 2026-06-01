// Horizontal pointer drag → frequency. Drag distance maps linearly to MHz;
// release lets the dial momentum-decay over ~400ms before snapping to a
// 0.1-MHz step. While dragging, hiss volume reflects velocity.

import { useCallback, useEffect, useRef, useState } from 'react';
import { initAudio, setHiss, playSweep } from '../utils/audio';
import { FREQ_MAX, FREQ_MIN, clampFreq, snapFreq } from '../types';

const PIXELS_PER_MHZ_TV = 80;       // ~4.5 MHz per typical screen width on the TV
const PIXELS_PER_MHZ_DIAL = 36;     // must match Dial's TAPE_PX_PER_MHZ for 1:1 finger ↔ tape tracking
const MOMENTUM_DECAY = 0.92;
const MOMENTUM_STOP = 0.005;        // MHz/frame below which we settle

export type TunerState = {
  freq: number;                     // raw float, e.g. 91.732
  snapped: number;                  // freq snapped to 0.1
  isDragging: boolean;
  isSettling: boolean;              // momentum after release
};

export type TunerCallbacks = {
  onSettle?: (freq: number) => void;     // fires once after release + momentum done
  onFirstTouch?: () => void;             // fires on the first pointerdown ever
};

export function useTuner(initial: number, cb: TunerCallbacks): {
  state: TunerState;
  handlers: {
    onPointerDown: (e: React.PointerEvent) => void;       // TV screen drag
    onPointerDownDial: (e: React.PointerEvent) => void;   // bottom dial drag
  };
  jumpTo: (freq: number) => void;       // imperative (used by wall tap)
} {
  const [state, setState] = useState<TunerState>({
    freq: initial,
    snapped: snapFreq(initial),
    isDragging: false,
    isSettling: false,
  });
  const stateRef = useRef(state);
  stateRef.current = state;

  const cbRef = useRef(cb);
  cbRef.current = cb;

  const firstTouchedRef = useRef(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startFreq: number;
    lastX: number;
    lastT: number;
    velocity: number;                // MHz/ms
    pxPerMHz: number;                // sensitivity of the drag source (TV vs Dial)
  } | null>(null);

  const settleRafRef = useRef<number | null>(null);
  const lastSweepKeyRef = useRef<string>('');

  const stopSettle = useCallback(() => {
    if (settleRafRef.current != null) {
      cancelAnimationFrame(settleRafRef.current);
      settleRafRef.current = null;
    }
  }, []);

  const setFreq = useCallback((nextRaw: number, isDragging: boolean, isSettling: boolean) => {
    const next = clampFreq(nextRaw);
    const snapped = snapFreq(next);
    setState({ freq: next, snapped, isDragging, isSettling });
    // Tick sweep tone whenever snapped value advances.
    const key = snapped.toFixed(1);
    if (key !== lastSweepKeyRef.current) {
      lastSweepKeyRef.current = key;
      playSweep(snapped);
    }
  }, []);

  const startMomentum = useCallback(() => {
    stopSettle();
    let v = dragRef.current?.velocity ?? 0;        // MHz/ms
    let cur = stateRef.current.freq;
    const tick = () => {
      v *= MOMENTUM_DECAY;
      cur += v * 16.7;                             // 1 frame ≈ 16.7ms
      const clamped = clampFreq(cur);
      if (clamped !== cur) {
        cur = clamped;
        v = 0;
      }
      if (Math.abs(v) < MOMENTUM_STOP) {
        const finalFreq = snapFreq(cur);
        setFreq(finalFreq, false, false);
        setHiss(0);
        settleRafRef.current = null;
        cbRef.current.onSettle?.(finalFreq);
        return;
      }
      // Hiss decays with velocity during settle.
      setHiss(Math.min(0.7, Math.abs(v) * 60));
      setFreq(cur, false, true);
      settleRafRef.current = requestAnimationFrame(tick);
    };
    settleRafRef.current = requestAnimationFrame(tick);
  }, [setFreq, stopSettle]);

  const beginDrag = useCallback((e: React.PointerEvent, pxPerMHz: number) => {
    if (e.button === 2) return;
    if (!firstTouchedRef.current) {
      firstTouchedRef.current = true;
      initAudio();
      cbRef.current.onFirstTouch?.();
    } else {
      initAudio();
    }
    stopSettle();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startFreq: stateRef.current.freq,
      lastX: e.clientX,
      lastT: performance.now(),
      velocity: 0,
      pxPerMHz,
    };
    setHiss(0.3);
    setState(s => ({ ...s, isDragging: true, isSettling: false }));
  }, [stopSettle]);

  const onPointerDown     = useCallback((e: React.PointerEvent) => beginDrag(e, PIXELS_PER_MHZ_TV),   [beginDrag]);
  const onPointerDownDial = useCallback((e: React.PointerEvent) => beginDrag(e, PIXELS_PER_MHZ_DIAL), [beginDrag]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const now = performance.now();
      const dx = e.clientX - d.lastX;
      const dt = Math.max(1, now - d.lastT);
      // Drag right → frequency DOWN (like dragging the dial card to the right
      // exposes lower frequencies on the left edge). Inverted to match the
      // tape-deck mental model.
      const dMHz = -dx / d.pxPerMHz;
      const next = stateRef.current.freq + dMHz;
      d.velocity = (d.velocity * 0.7) + ((dMHz / dt) * 0.3);   // smooth
      d.lastX = e.clientX;
      d.lastT = now;
      setHiss(Math.min(0.9, Math.abs(d.velocity) * 80 + 0.2));
      setFreq(next, true, false);
    };
    const onUp = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      dragRef.current = null;
      // If virtually no movement, treat as a tap: still snap, fire onSettle.
      if (Math.abs(d.velocity) < 0.0008) {
        const finalFreq = snapFreq(stateRef.current.freq);
        setFreq(finalFreq, false, false);
        setHiss(0);
        cbRef.current.onSettle?.(finalFreq);
        return;
      }
      startMomentum();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [setFreq, startMomentum]);

  const jumpTo = useCallback((freq: number) => {
    stopSettle();
    const snapped = snapFreq(freq);
    setFreq(snapped, false, false);
    cbRef.current.onSettle?.(snapped);
  }, [setFreq, stopSettle]);

  // Belt-and-suspenders: enforce min/max clamps when initial changes
  useEffect(() => () => stopSettle(), [stopSettle]);

  // Static-channel-specific tuning constants (export for UI)
  void FREQ_MIN; void FREQ_MAX;

  return {
    state,
    handlers: { onPointerDown, onPointerDownDial },
    jumpTo,
  };
}
