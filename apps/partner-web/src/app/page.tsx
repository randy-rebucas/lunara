'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import brandIcon from '@lunara/brand/icon';
import { getMyBranding, getPartnerToken } from '../lib/partner-api';
import { getLastPartnerSlug, withPartnerSlug } from '../lib/partner-path';
import { AuthLoading } from '../components/auth-loading';
import { Icon, ICONS } from '../components/ui/icon';
import { BubbleField, DARK_PANEL_BUBBLES } from '../components/bubble-field';
import { PhonePreviewMockup } from '../components/phone-preview-mockup';

const PHONE_RING_ICON =
  'M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z';

const CHAOS_SLIPS = [
  { text: 'Tita Baby — 3 loads, rush??', rotate: '-6deg', top: '2%', left: '4%' },
  { text: 'del ivery 4pm — CANCEL', rotate: '4deg', top: '15%', left: '32%' },
  { text: '₱450 owed — ask ulit', rotate: '-3deg', top: '32%', left: '8%' },
  { text: 'missed call (3) — Grace', rotate: '7deg', top: '46%', left: '38%' },
  { text: 'wash+fold?? or dc??', rotate: '-8deg', top: '62%', left: '4%' },
  { text: 'restock detergent??', rotate: '5deg', top: '76%', left: '34%' },
  { text: 'who closed out Tuesday?', rotate: '-4deg', top: '90%', left: '10%' },
];

// Tally goes to a bad total, then gets crossed out — the "before" side has no
// system to trust its own numbers, let alone reconcile them.
const CHAOS_TALLY = { top: '6%', left: '58%', rotate: '3deg' };

const QUEUE_ROWS = [
  { name: 'Marisol R.', item: 'Wash & Fold · 2 loads', status: 'In progress', tone: 'badge-primary' },
  { name: 'Kevin D.', item: 'Dry Clean · 1 barong', status: 'Ready', tone: 'badge-trend-up' },
  { name: 'Ana L.', item: 'Wash, Dry, Fold · 3 loads', status: 'Received', tone: 'badge-secondary' },
];

const CAPABILITIES = [
  {
    title: 'One order queue',
    description: 'Every booking — walk-in, phone, or app — lands in the same queue, status tracked start to finish.',
  },
  {
    title: 'Staff & inventory in sync',
    description: 'Assign work, log detergent and supply use, and see stock levels without a second spreadsheet.',
  },
  {
    title: 'Revenue that reconciles itself',
    description: 'Every completed order becomes a ledger entry — earnings, Lunara fees, and invoices in one place.',
  },
];

/**
 * Every real page lives under /{partnerSlug} (see app/[partnerSlug]/), so a bare "/" visit has
 * nowhere to render. Redirect to the signed-in user's own portal if we can resolve it, otherwise
 * to whichever portal was last visited on this device, otherwise show a way in.
 */
export default function RootRedirectPage() {
  const router = useRouter();
  const [unresolved, setUnresolved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      if (getPartnerToken()) {
        try {
          const { slug } = await getMyBranding();
          if (!cancelled && slug) {
            router.replace(withPartnerSlug(slug, '/'));
            return;
          }
        } catch {
          // fall through to last-visited slug
        }
      }

      const lastSlug = getLastPartnerSlug();
      if (!cancelled && lastSlug) {
        router.replace(withPartnerSlug(lastSlug, '/login'));
        return;
      }

      if (!cancelled) setUnresolved(true);
    }

    resolve();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!unresolved) return <AuthLoading message="Loading your portal…" />;

  return (
    <main>
      {/* Hero: the day told twice — chaos, then one queue. */}
      <section
        className="relative overflow-hidden bg-[#04142e] bg-cover bg-center px-6 pb-20 pt-14 text-white sm:px-10 sm:pb-28 sm:pt-16"
        style={{ backgroundImage: 'url(/images/background.png)' }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[#04142e]/70" />
        <BubbleField bubbles={DARK_PANEL_BUBBLES} className="login-bubble" />

        <div className="relative mx-auto flex max-w-6xl flex-col items-center">
          <div className="flex items-center gap-2.5">
            <Image
              src={brandIcon}
              alt=""
              width={36}
              height={36}
              className="shrink-0 rounded-xl shadow-lg"
              aria-hidden
              priority
            />
            <div>
              <p className="text-sm font-bold tracking-wide">LUNARA</p>
              <p className="text-xs text-slate-400">Lunara Business Account</p>
            </div>
          </div>

          <h1 className="mt-10 max-w-3xl text-balance text-center text-3xl font-bold leading-tight sm:text-5xl">
            Every order. On paper, in your head —<br className="hidden sm:block" />{' '}
            <span className="text-sky-300">or in one queue.</span>
          </h1>
          <p className="mt-4 max-w-xl text-center text-base text-slate-300">
            Lunara replaces the notebook, the group chat, and the missed calls with one system for
            orders, staff, inventory, and revenue — plus a booking app with your shop&apos;s own name on it.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup" className="btn-primary px-6 py-3 text-base">
              Become a Lunara partner
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-lg px-6 py-3 text-base font-medium text-white ring-1 ring-white/25 transition-colors hover:bg-white/10"
            >
              Sign in
            </Link>
          </div>

          {/* The split: same shop, same morning, told twice. */}
          <div className="relative mt-16 grid w-full gap-8 sm:mt-20 lg:grid-cols-2 lg:gap-6">
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 z-10 hidden h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#04142e] text-slate-500 ring-1 ring-white/15 lg:flex"
            >
              <Icon d={ICONS.arrow} className="h-5 w-5" />
            </div>

            {/* Before: scattered slips, desaturated. */}
            <div className="relative flex h-full flex-col rounded-2xl bg-white/[0.03] p-6 ring-1 ring-white/10">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Without Lunara</p>
              <div className="relative mt-4 min-h-[360px] flex-1">
                {CHAOS_SLIPS.map((slip) => (
                  <div
                    key={slip.text}
                    className="absolute w-40 rounded-sm bg-slate-100/90 px-2.5 py-2 text-[11px] font-medium text-slate-600 shadow-md sm:w-44"
                    style={{ top: slip.top, left: slip.left, transform: `rotate(${slip.rotate})` }}
                  >
                    {slip.text}
                  </div>
                ))}
                <div
                  className="absolute w-36 rounded-sm bg-slate-100/90 px-2.5 py-2 shadow-md sm:w-40"
                  style={{ top: CHAOS_TALLY.top, left: CHAOS_TALLY.left, transform: `rotate(${CHAOS_TALLY.rotate})` }}
                >
                  <p className="text-[11px] font-medium text-slate-600">Today&apos;s total?</p>
                  <p className="text-[11px] font-semibold text-slate-400 line-through decoration-2">
                    120 + 85 + 60 = 240
                  </p>
                  <p className="text-[11px] font-semibold text-slate-600">…240? 265?</p>
                </div>
              </div>
              <span className="mt-4 inline-flex w-fit items-center gap-1.5 self-end rounded-full bg-red-500/15 px-2.5 py-1 text-[11px] font-semibold text-red-300 ring-1 ring-red-400/30">
                <Icon d={PHONE_RING_ICON} className="h-3 w-3" />
                missed calls (3)
              </span>
            </div>

            {/* After: one calm surface — queue and booking app share the same white ground. */}
            <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-white/10">
              <p className="px-6 pt-6 text-xs font-semibold uppercase tracking-wide text-primary">With Lunara</p>
              <ul className="mt-4 divide-y divide-border/60 px-6">
                {QUEUE_ROWS.map((row) => (
                  <li key={row.name} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{row.name}</p>
                      <p className="truncate text-xs text-muted">{row.item}</p>
                    </div>
                    <span className={row.tone}>{row.status}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 border-t border-border/60 px-6 pt-5 text-xs text-muted">
                And customers book straight into that same queue, from your own app:
              </p>
              <div className="px-6 pb-6 pt-3">
                <PhonePreviewMockup businessName="Your Shop" variant="default" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities: what the "after" is actually built from — three plain lines, not a tile grid. */}
      <section className="portal-bg px-6 py-16 sm:px-10 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Everything the queue on the right is running on.
          </h2>
          <div className="mt-10 divide-y divide-border/60 border-y border-border/60">
            {CAPABILITIES.map(({ title, description }) => (
              <div key={title} className="flex flex-col gap-1 py-6 sm:flex-row sm:items-baseline sm:gap-8">
                <p className="shrink-0 text-sm font-semibold text-primary sm:w-64">{title}</p>
                <p className="text-sm text-muted sm:max-w-md">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Close: the two doors this whole page exists to point at. */}
      <section
        className="relative overflow-hidden bg-[#04142e] px-6 py-16 text-center text-white sm:px-10 sm:py-20"
        style={{
          backgroundImage:
            'radial-gradient(50% 60% at 50% 100%, rgba(37,99,235,0.3), transparent)',
        }}
      >
        <div className="relative mx-auto max-w-xl">
          <h2 className="text-2xl font-bold sm:text-3xl">Ready to run your shop on one queue?</h2>
          <p className="mt-3 text-sm text-slate-300">
            Applying reserves your city on Lunara and walks you through pricing and terms directly —
            nothing to guess here.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup" className="btn-primary px-6 py-3 text-base">
              Become a Lunara partner
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-lg px-6 py-3 text-base font-medium text-white ring-1 ring-white/25 transition-colors hover:bg-white/10"
            >
              Sign in to your shop
            </Link>
          </div>
          <p className="mt-8 text-xs text-slate-500">© {new Date().getFullYear()} Lunara. All rights reserved.</p>
        </div>
      </section>
    </main>
  );
}
