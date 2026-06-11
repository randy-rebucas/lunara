'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { appConfig, getShareWebsiteUrl } from '@lunara/config';
import type { Deal } from '@lunara/types';
import {
  buildDealSharePayload,
  formatDealDiscount,
  formatDealExpiry,
  formatDealMinimum,
} from '@lunara/utils';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { ButtonLink } from '../ui/button-link';
import { Card, CardBody } from '../ui/card';
import { SocialSharePanel } from '../share/social-share-panel';
import { useCustomerQuery } from '../../lib/use-customer-query';

const DEAL_GRADIENTS = [
  'from-indigo-600 to-indigo-500',
  'from-cyan-600 to-teal-500',
  'from-violet-600 to-purple-500',
] as const;

function shareBaseUrl() {
  if (typeof window !== 'undefined') return window.location.origin;
  return getShareWebsiteUrl();
}

function DealCarouselCard({ deal, index }: { deal: Deal; index: number }) {
  const payload = buildDealSharePayload(deal, shareBaseUrl(), appConfig.name);
  const minimum = formatDealMinimum(deal);
  const expiry = formatDealExpiry(deal.expiresAt ?? deal.endsAt);
  const gradient = DEAL_GRADIENTS[index % DEAL_GRADIENTS.length];

  return (
    <Card
      className={`h-full overflow-hidden border-0 bg-gradient-to-br ${gradient} text-white shadow-[var(--shadow-elevated)]`}
    >
      <CardBody className="flex h-full flex-col gap-4 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {deal.isPersonal ? (
              <span className="mb-2 inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white">
                Just for you
              </span>
            ) : (
              <span className="mb-2 inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-white/90">
                Deal
              </span>
            )}
            <p className="text-3xl font-extrabold tracking-tight">{formatDealDiscount(deal)}</p>
            <p className="mt-1 text-lg font-semibold">{deal.title}</p>
            {deal.description ? (
              <p className="mt-1 text-sm text-white/85">{deal.description}</p>
            ) : null}
          </div>
          <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold tracking-wide text-slate-900">
            {deal.code}
          </span>
        </div>

        <div className="mt-auto space-y-1 text-sm text-white/90">
          {minimum ? <p>{minimum}</p> : null}
          {expiry ? <p className="font-medium text-white">{expiry}</p> : null}
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <ButtonLink
            href={`/book?code=${encodeURIComponent(deal.code)}`}
            size="sm"
            className="border-0 bg-white text-slate-900 hover:bg-white/90"
          >
            Book with code
          </ButtonLink>
          <div className="[&_button]:ring-1 [&_button]:ring-white/40">
            <SocialSharePanel payload={payload} compact />
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

export function DealsCarousel() {
  const { api, isAuthenticated } = useAuthContext();
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const load = useCallback(async () => {
    if (!isAuthenticated) return [] as Deal[];
    const res = await api.get<Deal[]>('/deals');
    return res.data;
  }, [api, isAuthenticated]);

  const { data: deals, loading, error } = useCustomerQuery(load, [api, isAuthenticated]);

  const slideCount = deals?.length ?? 0;

  const updateActiveIndex = useCallback(() => {
    const track = trackRef.current;
    if (!track || slideCount === 0) return;
    const slide = track.querySelector<HTMLElement>('[data-deal-slide]');
    if (!slide) return;
    const slideWidth = slide.offsetWidth + 16;
    const index = Math.round(track.scrollLeft / slideWidth);
    setActiveIndex(Math.max(0, Math.min(index, slideCount - 1)));
  }, [slideCount]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    track.addEventListener('scroll', updateActiveIndex, { passive: true });
    return () => track.removeEventListener('scroll', updateActiveIndex);
  }, [updateActiveIndex, slideCount]);

  function scrollToIndex(index: number) {
    const track = trackRef.current;
    if (!track) return;
    const slide = track.querySelector<HTMLElement>('[data-deal-slide]');
    if (!slide) return;
    const slideWidth = slide.offsetWidth + 16;
    track.scrollTo({ left: slideWidth * index, behavior: 'smooth' });
    setActiveIndex(index);
  }

  if (loading) {
    return (
      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">Deals for you</h2>
        <div className="mt-4 flex h-52 items-center justify-center rounded-2xl border border-border/60 bg-slate-50 text-sm text-muted">
          Loading deals…
        </div>
      </section>
    );
  }

  if (error || !deals?.length) return null;

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Deals for you</h2>
          <p className="mt-1 text-sm text-muted">Swipe or use arrows — your welcome codes and limited-time offers</p>
        </div>
        {slideCount > 1 ? (
          <div className="hidden items-center gap-2 sm:flex">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-white text-slate-700 transition hover:border-primary/40 hover:text-primary disabled:opacity-40"
              onClick={() => scrollToIndex(Math.max(0, activeIndex - 1))}
              disabled={activeIndex === 0}
              aria-label="Previous deal"
            >
              ←
            </button>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-white text-slate-700 transition hover:border-primary/40 hover:text-primary disabled:opacity-40"
              onClick={() => scrollToIndex(Math.min(slideCount - 1, activeIndex + 1))}
              disabled={activeIndex >= slideCount - 1}
              aria-label="Next deal"
            >
              →
            </button>
          </div>
        ) : null}
      </div>

      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {deals.map((deal, index) => (
          <div
            key={deal._id}
            data-deal-slide
            className="w-[min(100%,340px)] shrink-0 snap-start sm:w-[380px]"
          >
            <DealCarouselCard deal={deal} index={index} />
          </div>
        ))}
      </div>

      {slideCount > 1 ? (
        <div className="mt-4 flex justify-center gap-2" role="tablist" aria-label="Deal slides">
          {deals.map((deal, index) => (
            <button
              key={deal._id}
              type="button"
              role="tab"
              aria-selected={index === activeIndex}
              aria-label={`Go to deal ${index + 1}: ${deal.title}`}
              onClick={() => scrollToIndex(index)}
              className={`h-2 rounded-full transition-all ${
                index === activeIndex ? 'w-6 bg-primary' : 'w-2 bg-slate-300 hover:bg-slate-400'
              }`}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
