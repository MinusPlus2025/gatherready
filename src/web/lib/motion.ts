/* ==========================================================================
   Motion helpers.

   The rule from the IA pass: motion exists to explain a change, never to
   decorate. These hooks keep that cheap and honest, and they all collapse to
   "instant" when the person asks for reduced motion.
   ========================================================================== */

import { useEffect, useRef, useState } from 'react';

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(REDUCED_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia(REDUCED_QUERY);
    const onChange = () => setReduced(query.matches);
    query.addEventListener?.('change', onChange);
    return () => query.removeEventListener?.('change', onChange);
  }, []);

  return reduced;
}

/**
 * Returns true for `ms` after `value` changes — used to pulse an avatar or a
 * row exactly once when the server reports a new state for it.
 */
export function useChangedFlag(value: unknown, ms = 650): boolean {
  const [changed, setChanged] = useState(false);
  const previous = useRef(value);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (Object.is(previous.current, value)) return;
    previous.current = value;
    if (reduced) return;
    setChanged(true);
    const timer = window.setTimeout(() => setChanged(false), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms, reduced]);

  return changed;
}

/** Tweens an integer toward its new value (counts only; nothing that moves money). */
export function useAnimatedNumber(value: number, duration = 480): number {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const frameRef = useRef<number | null>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    const from = fromRef.current;
    if (from === value) return;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
      }
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      fromRef.current = value;
    };
  }, [value, duration, reduced]);

  return display;
}

/** Split "3 / 4" style values so the numeric part can be tweened. */
export function splitCount(value: string): { current: number; total: string } | null {
  const match = /^(\d+)\s*(\/\s*\d+.*)$/.exec(value);
  if (!match) return null;
  return { current: Number(match[1]), total: match[2] ?? '' };
}


/**
 * Counts up from 0 the first time the value is rendered (marketing numbers).
 * Reduced motion jumps straight to the value.
 */
export function useCountUp(value: number, duration = 900): number {
  const [display, setDisplay] = useState(0);
  const reduced = usePrefersReducedMotion();
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(value * eased));
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [value, duration, reduced]);

  return display;
}

/**
 * Adds `is-visible` to `[data-reveal]` elements as they scroll into view.
 * Elements are only hidden after the observer has armed them, so a component
 * that re-renders after mount is visible rather than permanently blank.
 * Pass values that cause a re-render (state, workshop) as `deps`.
 */
export function useRevealOnScroll(deps: unknown[] = []): void {
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (elements.length === 0) return;
    if (reduced) {
      for (const element of elements) element.classList.add('is-visible');
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.12 },
    );
    for (const element of elements) {
      element.classList.add('reveal-armed');
      observer.observe(element);
    }
    return () => observer.disconnect();
  }, [reduced, ...deps]);
}
