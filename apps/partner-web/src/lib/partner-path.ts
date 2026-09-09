'use client';

import { useParams } from 'next/navigation';

/** Prefixes an app-internal absolute path with the current /{partnerSlug} segment. */
export function withPartnerSlug(slug: string, path: string) {
  if (!path.startsWith('/')) return `/${slug}/${path}`;
  return `/${slug}${path}`;
}

/** Returns a helper that prefixes app-internal absolute paths with the current partner slug,
 * e.g. `toPartnerPath('/orders')` -> `/acme/orders`. Use for every internal Link href/router
 * push/replace so navigation stays scoped to the active partner. */
export function usePartnerPath() {
  const params = useParams<{ partnerSlug: string }>();
  const slug = params.partnerSlug;
  return (path: string) => withPartnerSlug(slug, path);
}

/** Removes the leading /{partnerSlug} segment from a pathname, e.g. `/acme/orders` -> `/orders`.
 * Use when comparing the current route against an unprefixed nav href. */
export function stripPartnerSlug(pathname: string, slug: string) {
  const prefix = `/${slug}`;
  if (pathname === prefix) return '/';
  if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length);
  return pathname;
}

const LAST_SLUG_KEY = 'lunara_last_partner_slug';

/** Remembers the most recently visited /{partnerSlug}, so a bare "/" visit (no slug in the URL)
 * can be redirected back into the right portal instead of 404ing. */
export function rememberPartnerSlug(slug: string) {
  if (typeof window === 'undefined' || !slug) return;
  localStorage.setItem(LAST_SLUG_KEY, slug);
}

export function getLastPartnerSlug(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(LAST_SLUG_KEY);
}
