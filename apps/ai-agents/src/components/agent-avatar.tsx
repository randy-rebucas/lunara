'use client';

import { useState } from 'react';

const COLORS = [
  'bg-indigo-500/15 text-indigo-300',
  'bg-emerald-500/15 text-emerald-300',
  'bg-amber-500/15 text-amber-300',
  'bg-rose-500/15 text-rose-300',
  'bg-sky-500/15 text-sky-300',
  'bg-violet-500/15 text-violet-300',
  'bg-teal-500/15 text-teal-300',
  'bg-orange-500/15 text-orange-300',
];

// Illustrated persona avatars generated for the Lunara AI Team — see public/images/avatars.
const PERSONA_AVATARS: Record<string, string> = {
  aurora: '/images/avatars/aurora.png',
  olivia: '/images/avatars/olivia.png',
  emma: '/images/avatars/emma.png',
  daniel: '/images/avatars/daniel.png',
  mia: '/images/avatars/mia.png',
  benjamin: '/images/avatars/benjamin.png',
  noah: '/images/avatars/noah.png',
  sophia: '/images/avatars/sophia.png',
};

function colorFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return COLORS[hash % COLORS.length];
}

function initialsFor(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function AgentAvatar({ id, name, size = 'md' }: { id: string; name: string; size?: 'sm' | 'md' | 'lg' }) {
  const [imageFailed, setImageFailed] = useState(false);
  const sizeClass = size === 'lg' ? 'h-14 w-14 text-lg' : size === 'sm' ? 'h-8 w-8 text-xs' : 'h-11 w-11 text-sm';
  const src = PERSONA_AVATARS[id];

  if (!src || imageFailed) {
    return (
      <span
        className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${sizeClass} ${colorFor(id)}`}
        aria-hidden
      >
        {initialsFor(name)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- pre-sized static asset rendered at many arbitrary sizes
    <img
      src={src}
      alt=""
      aria-hidden
      className={`shrink-0 rounded-full bg-white/10 object-cover ${sizeClass}`}
      onError={() => setImageFailed(true)}
    />
  );
}
