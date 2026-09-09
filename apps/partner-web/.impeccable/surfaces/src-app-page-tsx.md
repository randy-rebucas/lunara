---
version: 1
slug: "src-app-page-tsx"
primary_target: "src/app/page.tsx"
related_targets: []
---

## Scope
Marketing landing page at partner-web root (`/`) for a signed-out or unresolved visitor. Mode: Persuade. Auto-redirect for a resolvable session (existing token → own portal, or last-visited slug → /login) stays first; this content only renders when neither resolves.

## Audience / job / action / proof / constraints
- Audience: a laundry shop owner who has never used Lunara, deciding whether to apply; occasionally an existing partner mid-redirect.
- Job: understand what Lunara replaces (manual, scattered shop-running) and what it gives (one system: orders, staff, inventory, revenue, plus a ready customer app) in one viewport.
- Action: two clear paths — "Become a Lunara partner" → /signup, "Sign in" → /login. No third path.
- Proof: no stats/testimonials available — proof is demonstrated via the chaos-vs-system comparison itself and the real PhonePreviewMockup component (actual booking-app screens, not a drawing).
- Constraints: never restate pricing/terms/commitments (owned by /signup). Preserve RootRedirectPage's resolution logic untouched.

## Direction contract

THESIS: The page owns one idea — a laundry shop's day, told twice: once as scattered chaos, once inside Lunara's queue — refusing the generic feature-tile SaaS landing the category defaults to.

OWN-WORLD: Inherited from /login and /signup: dark hero panel `#04142e` fading via radial indigo/cyan glows, BubbleField rising-bubble motion (DARK_PANEL_BUBBLES over dark, LIGHT_PANEL_BUBBLES over light), sky-300 headline accent, Icon/ICONS outline glyphs, `.card`/`.btn-primary`/`.badge-*` utility classes, Inter type, indigo #4f46e5 primary / cyan #06b6d4 secondary.

STORY: Visitor arrives → sees their own shop's chaos on the left (scrawled tickets, ringing phone, a "?" tally) rendered as a torn/scattered paper collage → same moment mirrored on the right as one calm Lunara queue card, order status badges, a phone booking screen → reads three concrete capability lines → picks "Become a partner" or "Sign in".

FIRST VIEWPORT: Full-bleed dark hero (`#04142e` + existing radial glow + BubbleField), split into two columns at the midline on desktop (stacked chaos-then-system on mobile): left column is the "before" — a slightly rotated stack of torn-paper order slips, a crossed-out tally, a small red "missed call" badge, muted/desaturated; right column is the "after" — a clean `.card` showing a live-looking order queue (3 rows: status badge, customer, item) plus the `PhonePreviewMockup` (variant="default", businessName="Your Shop") docked at its lower edge. A vertical seam divides the two with a small centered arrow-icon badge. Headline sits above both, centered: "Every order. On paper, in your head — or in one queue." Two CTA buttons (`btn-primary` "Become a Lunara partner" → /signup, `btn-outline` on dark "Sign in" → /login) sit under the headline, above the split.

FORM: "Chaos vs. Lunara split" — structure 1 of 7 in the surface's own ranked list, dealt as index 3 of 3 via the roll (seed key e486953e), locked by the user over "Founding-partner ledger/receipt" and "Dashboard preview marquee".

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Unresolved decisions
None outstanding — proceeding code-led (no image-generation tool available in this environment).
