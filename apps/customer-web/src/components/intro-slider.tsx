'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, cn } from '@lunara/ui';
import { appConfig } from '@lunara/config';
import { INTRO_SLIDES } from '../lib/intro-slides';
import { markIntroSeen } from '../lib/intro-slider-storage';

interface IntroSliderProps {
  onDone: () => void;
}

const BUBBLE_COUNT = 12;

function makeBubbles() {
  return Array.from({ length: BUBBLE_COUNT }, (_, i) => {
    const seed = (i * 37) % 100;
    const seed2 = (i * 53) % 100;
    return {
      left: `${(seed * 0.9 + (i % 3) * 6) % 92}%`,
      top: `${(seed2 * 0.85 + (i % 4) * 5) % 88}%`,
      size: 26 + (seed % 5) * 9,
      duration: 4.2 + (seed % 6) * 0.65,
      delay: (seed % 8) * 0.24,
      opacity: 0.35 + (seed % 4) * 0.08,
      sway: (seed % 2 === 0 ? 1 : -1) * (8 + (seed % 14)),
      drift: 18 + (seed2 % 20),
    };
  });
}

function IntroBubbles() {
  const bubbles = makeBubbles();
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <style jsx>{`
        @keyframes intro-bubble-float {
          0% {
            transform: translateY(0) translateX(0) scale(0.9);
            opacity: calc(var(--bubble-opacity) * 0.4);
          }
          20% {
            opacity: var(--bubble-opacity);
          }
          50% {
            transform: translateY(var(--drift)) translateX(var(--sway)) scale(1.08);
          }
          80% {
            opacity: var(--bubble-opacity);
          }
          100% {
            transform: translateY(0) translateX(0) scale(0.9);
            opacity: calc(var(--bubble-opacity) * 0.4);
          }
        }
        .bubble {
          animation-name: intro-bubble-float;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
          background: radial-gradient(
            circle at 32% 28%,
            rgba(255, 255, 255, 0.9) 0%,
            rgba(255, 255, 255, 0.35) 18%,
            var(--tw-bubble-fill, rgba(99, 102, 241, 0.16)) 55%,
            rgba(99, 102, 241, 0.08) 100%
          );
          border: 1.5px solid rgba(99, 102, 241, 0.35);
          box-shadow: inset -3px -3px 6px rgba(99, 102, 241, 0.12);
        }
      `}</style>
      {bubbles.map((b, i) => (
        <span
          key={i}
          className="bubble absolute rounded-full"
          style={{
            left: b.left,
            top: b.top,
            width: b.size,
            height: b.size,
            animationDuration: `${b.duration}s`,
            animationDelay: `${b.delay}s`,
            // @ts-expect-error CSS custom properties
            '--bubble-opacity': b.opacity,
            '--drift': `${-b.drift}px`,
            '--sway': `${b.sway}px`,
          }}
        />
      ))}
    </div>
  );
}

export function IntroSlider({ onDone }: IntroSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const isLastSlide = activeIndex === INTRO_SLIDES.length - 1;

  function finish() {
    markIntroSeen();
    onDone();
  }

  function goNext() {
    if (isLastSlide) {
      finish();
      return;
    }
    const track = trackRef.current;
    if (!track) return;
    const slide = track.children[0] as HTMLElement | undefined;
    const step = slide ? slide.offsetWidth : track.clientWidth;
    track.scrollTo({ left: step * (activeIndex + 1), behavior: 'smooth' });
  }

  function onScroll() {
    const track = trackRef.current;
    if (!track) return;
    const slide = track.children[0] as HTMLElement | undefined;
    if (!slide) return;
    const step = slide.offsetWidth;
    setActiveIndex(Math.round(track.scrollLeft / step));
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') finish();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="App introduction"
      className="fixed inset-0 z-50 flex flex-col bg-white"
    >
      <button
        type="button"
        onClick={finish}
        className="absolute right-6 top-6 z-10 text-sm font-semibold text-slate-500 hover:text-slate-700"
      >
        Skip
      </button>

      <div
        ref={trackRef}
        onScroll={onScroll}
        className="flex flex-1 snap-x snap-mandatory overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {INTRO_SLIDES.map((slide) => {
          const Icon = slide.icon;
          return (
            <div
              key={slide.key}
              className="relative flex w-full shrink-0 snap-start flex-col items-center justify-center overflow-hidden px-10 text-center"
            >
              <IntroBubbles />
              <div className="relative mb-8 flex h-28 w-28 items-center justify-center rounded-full bg-primary/10">
                <Icon className="h-14 w-14 text-primary" aria-hidden />
              </div>
              <h2 className="mb-3 text-2xl font-bold text-slate-900">
                {slide.key === 'welcome' ? `Welcome to ${appConfig.name}` : slide.title}
              </h2>
              <p className="text-base text-slate-500">{slide.description}</p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-6 px-6 pb-10">
        <div className="flex items-center gap-1.5" role="tablist" aria-label="Slide position">
          {INTRO_SLIDES.map((slide, i) => (
            <span
              key={slide.key}
              aria-hidden
              className={cn(
                'h-2 rounded-full transition-all',
                i === activeIndex ? 'w-6 bg-primary' : 'w-2 bg-border',
              )}
            />
          ))}
        </div>

        <Button size="lg" className="w-full max-w-sm" onClick={goNext}>
          {isLastSlide ? 'Get started' : 'Next'}
        </Button>
      </div>
    </div>
  );
}
