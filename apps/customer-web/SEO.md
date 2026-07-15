# SEO Guide — customer-web

Status and to-do checklist for search optimization of the Lunara customer marketing site.
Implementation lives in `src/lib/seo.tsx` (metadata builder + JSON-LD helpers) and the Next.js
file conventions under `src/app/` (`sitemap.ts`, `robots.ts`, `manifest.ts`, `opengraph-image.tsx`).

---

## ✅ Done (implemented 2026-07-15)

- [x] **SSR crawlability** — homepage renders full marketing content on the server; no more
      loading-spinner-only HTML for crawlers (`home-page.tsx`).
- [x] **Central SEO helpers** — `src/lib/seo.tsx`: `buildPageMetadata()`, `absoluteUrl()`,
      JSON-LD builders, shared OG image descriptor.
- [x] **Root metadata** — `metadataBase`, title template `%s — Lunara`, keywords, robots +
      googleBot directives, OG/Twitter defaults, `themeColor`, PWA manifest link.
- [x] **Unique title / description / canonical on every public page** — home, `/faq`,
      `/partners`, `/riders`, `/locations`, `/privacy`, `/signup`, both `/apply` pages,
      `/service-areas/[id]` (dynamic, from live branch data).
- [x] **noindex on utility pages** — `/login`, `/register`.
- [x] **Structured data (JSON-LD)** — Organization, WebSite, Service (+ cities served),
      MobileApplication (home); FAQPage (`/faq`); DryCleaningOrLaundry (service-area pages).
- [x] **`sitemap.xml`** — static routes + live service-area branches, hourly revalidation.
- [x] **`robots.txt`** — authenticated app surface disallowed, sitemap declared.
- [x] **Dynamic OG share image** — `opengraph-image.tsx` (1200×630, brand blue), wired into
      `og:image` / `twitter:image` on all pages.
- [x] **Performance** — zero external stock images on the homepage (CSS-only phone mockups),
      no layout-shifting hero media.
- [x] **White-label safety** — partner domains get their own minimal metadata and never
      canonicalize to `lunara.app`.

---

## 🚀 Before the next deploy

- [ ] **Fix the broken `/terms` link** — the footer links to `/terms` but the route 404s.
      Either create `src/app/(marketing)/terms/page.tsx` (mirror `privacy/page.tsx`) or remove
      the links. Broken internal links waste crawl budget and hurt trust signals.
- [ ] **Confirm the production origin** — canonical URLs default to `https://lunara.app`
      (`marketingConfig.websiteUrl`). If production serves from a different domain (e.g. a
      Render subdomain), set `NEXT_PUBLIC_SITE_URL=https://<real-domain>` in the production
      environment, otherwise every canonical/sitemap URL points at the wrong host.
- [ ] **Restart / redeploy** so the file-convention metadata (`opengraph-image`, `manifest`,
      `sitemap`, `robots`) is registered in the production build (dev server needed it too).
- [ ] **Verify after deploy** (2 minutes):
  - `https://<domain>/robots.txt` and `https://<domain>/sitemap.xml` return 200
  - `view-source:` the homepage → real content in HTML, `<title>`, canonical, JSON-LD present
  - Paste the homepage URL into https://search.google.com/test/rich-results — expect
    Organization + Service + MobileApplication; `/faq` should show FAQ rich results

## 📋 First week after deploy

- [ ] **Google Search Console** — verify the domain (DNS TXT record), submit
      `sitemap.xml`, request indexing for `/`, `/locations`, `/partners`.
- [ ] **Bing Webmaster Tools** — import from Search Console (one click).
- [ ] **Google Business Profile** — create one per physical branch (Makati, QC, BGC);
      link each to its `/service-areas/[id]` page. This is the highest-impact local-SEO
      action for a service business.
- [ ] **Play Store listing cross-link** — add the website URL to the Play Store listing so
      the `MobileApplication` markup and store listing corroborate each other.
- [ ] **Social profiles** — the Organization JSON-LD `sameAs` array currently only lists the
      Play Store. Add real Facebook/Instagram/TikTok URLs to `organizationJsonLd()` in
      `src/lib/seo.tsx` once the accounts exist (the reference mockup showed social icons —
      they were omitted because no URLs exist yet).
- [ ] **Analytics** — nothing is installed. Add a lightweight, consent-friendly option
      (Plausible/Umami, or GA4) so you can measure organic traffic at all. Without it the
      rest of this list can't be evaluated.

## 📈 Ongoing / growth

- [ ] **Per-city landing pages** — `/service-areas/[id]` pages exist, but consider dedicated
      keyword pages ("laundry delivery Makati", "wash and fold BGC") with unique copy as
      branches grow. The dynamic sitemap already picks up new branches automatically.
- [ ] **Real review markup** — once genuine ratings accumulate in the platform, consider
      `AggregateRating` on service-area pages. Deliberately NOT included today: marking up
      the marketing-copy testimonials would violate Google's review-snippet policy.
- [ ] **Content** — FAQ answers are the current long-tail surface. A simple guides section
      ("how much does laundry service cost in Manila", "wash & fold vs dry cleaning") targets
      the queries customers actually search before booking.
- [ ] **Core Web Vitals** — check https://pagespeed.web.dev after deploy. The marketing page
      is already image-free; watch the auth-provider JS bundle (it ships to the homepage) if
      LCP/INP regress.
- [ ] **Monitor Search Console monthly** — coverage errors, unexpected noindex, mobile
      usability, and which queries convert; feed winners back into page titles.

---

## Conventions for new marketing pages

1. Export metadata via the shared helper — never hand-roll tags:
   ```ts
   export const metadata: Metadata = buildPageMetadata({
     title: 'Page title',            // goes through the `%s — Lunara` template
     description: '150–160 chars.',
     path: '/route',                 // canonical + og:url
     // absoluteTitle: true          // skip the template (brand already in title)
     // noindex: true                // utility pages only
   });
   ```
2. Client (`'use client'`) pages can't export metadata — add a `layout.tsx` beside them
   (see `login/layout.tsx` for the pattern).
3. Add the route to `src/app/sitemap.ts` unless it's noindex.
4. Structured data: use/extend the builders in `src/lib/seo.tsx` and render with `<JsonLd />`
   in the **server** component; keep each schema type on one canonical page.
5. Only one `<h1>` per page; sequential heading levels; SVG icons `aria-hidden` with text labels.
