'use client';

import { useEffect, useRef } from 'react';

type ParallaxLayer = { ref: React.RefObject<HTMLElement | null>; speed: number };

/**
 * Imperatively translates layer refs in proportion to scroll position — no React re-renders
 * in the hot path. Disabled entirely under prefers-reduced-motion.
 */
export function useHeroParallax(layers: ParallaxLayer[]) {
  const layersRef = useRef(layers);

  // Keep the ref in sync after each commit rather than mutating it during render.
  useEffect(() => {
    layersRef.current = layers;
  });

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let frame: number | null = null;
    const update = () => {
      const y = window.scrollY;
      for (const layer of layersRef.current) {
        const node = layer.ref.current;
        if (node) node.style.transform = `translate3d(0, ${Math.round(y * layer.speed)}px, 0)`;
      }
      frame = null;
    };
    const onScroll = () => {
      if (frame == null) frame = requestAnimationFrame(update);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame != null) cancelAnimationFrame(frame);
    };
  }, []);
}
