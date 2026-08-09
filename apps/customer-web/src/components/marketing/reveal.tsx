'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@lunara/ui';

type RevealProps<T extends React.ElementType> = {
  as?: T;
  /** Stagger delay in ms — pass `index * 60` for grid/list items. */
  delay?: number;
  className?: string;
  children: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<T>, 'as' | 'className' | 'children'>;

/** Fades + rises children into view the first time they cross into the viewport. No-op under prefers-reduced-motion (CSS-gated). */
export function Reveal<T extends React.ElementType = 'div'>({
  as,
  delay = 0,
  className,
  children,
  ...rest
}: RevealProps<T>) {
  const Component = (as ?? 'div') as React.ElementType;
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Component
      ref={ref}
      className={cn('reveal', visible && 'reveal-visible', className)}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      {...rest}
    >
      {children}
    </Component>
  );
}
