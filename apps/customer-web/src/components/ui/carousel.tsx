'use client';

import { useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@lunara/ui';

interface CarouselProps<T> {
  items: readonly T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  className?: string;
  itemClassName?: string;
}

export function Carousel<T>({ items, getKey, renderItem, className, itemClassName }: CarouselProps<T>) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  function scrollByCard(direction: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    const card = track.children[0] as HTMLElement | undefined;
    const step = card ? card.offsetWidth + 24 : track.clientWidth;
    track.scrollBy({ left: direction * step, behavior: 'smooth' });
  }

  function onScroll() {
    const track = trackRef.current;
    if (!track) return;
    const card = track.children[0] as HTMLElement | undefined;
    if (!card) return;
    const step = card.offsetWidth + 24;
    setActiveIndex(Math.round(track.scrollLeft / step));
  }

  return (
    <div className={cn('relative', className)}>
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => (
          <div
            key={getKey(item)}
            className={cn(
              'w-[85%] shrink-0 snap-start sm:w-[45%] lg:w-[calc(33.333%_-_1rem)]',
              itemClassName,
            )}
          >
            {renderItem(item)}
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => scrollByCard(-1)}
          aria-label="Previous"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-slate-700 shadow-sm ring-1 ring-border/60 transition hover:text-primary"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>

        <div className="flex items-center gap-1.5" role="tablist" aria-label="Carousel position">
          {items.map((item, i) => (
            <span
              key={getKey(item)}
              aria-hidden
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === activeIndex ? 'w-5 bg-primary' : 'w-1.5 bg-border',
              )}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => scrollByCard(1)}
          aria-label="Next"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-slate-700 shadow-sm ring-1 ring-border/60 transition hover:text-primary"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
