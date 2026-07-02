'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';

interface ParallaxBannerProps {
  src: string;
  alt: string;
  className?: string;
  children?: React.ReactNode;
}

export function ParallaxBanner({ src, alt, className, children }: ParallaxBannerProps) {
  const imageRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    let ticking = false;

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const section = sectionRef.current;
        const image = imageRef.current;
        if (section && image) {
          const rect = section.getBoundingClientRect();
          const viewportCenter = window.innerHeight / 2;
          const sectionCenter = rect.top + rect.height / 2;
          const offset = (viewportCenter - sectionCenter) * 0.15;
          image.style.transform = `translate3d(0, ${offset}px, 0)`;
        }
        ticking = false;
      });
    }

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div ref={sectionRef} className={`relative overflow-hidden ${className ?? ''}`}>
      {/* scale-125 gives translate3d headroom so the parallax shift never reveals blank edges */}
      <div ref={imageRef} className="absolute inset-0 scale-125 will-change-transform">
        <Image src={src} alt={alt} fill sizes="100vw" className="object-cover" priority />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/40 to-slate-950/60" aria-hidden />
      <div className="relative">{children}</div>
    </div>
  );
}
