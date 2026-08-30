# DESIGN.md — customer-web

## Home page: "Jeepney destination signage" (seed `4fbe65fa`)

Redesigned 2026-08-30. Full visual-world replacement of the marketing home page
(`src/components/marketing/home-page.tsx`), built via the Impeccable new-work process.
Every other page/component in customer-web is unaffected and still runs the prior
royal-blue token system.

### Thesis

The jeepney destination board — hand-painted signage that gets a whole city to its
stops — replaces the generic "delivery app" hero. A laundry order is dramatized as a
route with real stops (Pickup → Wash Partner → Delivery), not an abstract status bar.
This makes Lunara's real differentiator legible: a network of partner shops and
independent riders running a route, not one storefront.

### Palette

A saturated jeepney-enamel palette layered **on top of**, not replacing, the existing
`--color-primary` white-label mechanism (`apps/customer-web/src/app/globals.css`):

| Token | Value | Use |
|---|---|---|
| `--color-route-red` | `#d7263d` | Pickup stop, 1st cycle color |
| `--color-route-yellow` | `#f5b700` | Wash Partner stop, 2nd cycle color |
| `--color-route-blue` | `#1447e6` | Delivery stop, 3rd cycle color |
| `--color-route-ink` | `#14110f` | Outline/stroke, board background |
| `--color-route-cream` | `#fbf3e3` | Enamel-white ground for route sections |

These generate standard Tailwind v4 utilities (`bg-route-red`, `text-route-blue`,
`border-route-ink`, etc.) the same way `--color-primary` already does. `--color-primary`
itself is untouched — tenant branding via `--lunara-primary` still overrides it
everywhere, including inside route-world sections that use `text-primary` for
functional copy (prices, links).

### Type

- Display/headline face: **Anton** (`next/font/google`, self-hosted, `--font-anton` →
  `--font-display`), applied only via the `.signage-heading` class (uppercase, tight
  leading, negative tracking) — hero H1, route-board headings, placard titles.
  Registered and loaded once in `src/app/layout.tsx`.
- Body copy, nav, buttons, prices, FAQs: unchanged **Inter** (`--font-inter` /
  `--font-sans`). No component outside `.signage-heading` uses the display face.

### Component classes (`globals.css`, `@layer components`)

- `.route-ground` — enamel-cream section background (hero, how-it-works, service areas).
- `.route-board` — the dark-ink "board" plank: hero headline panel and the tracking
  section's real-time card.
- `.placard` / `.placard-red|yellow|blue` — destination placard: thick black outline,
  one flat enamel fill, soft offset shadow. Used for the hero's 3 route stops and the
  4 how-it-works steps (colors cycle red → yellow → blue via `routeColorAt(index)`).
- `.icon-placard` / `.icon-placard-red|yellow|blue` — square icon chrome (thick outline,
  flat color) replacing the soft `rounded-xl bg-primary/10` tint chip everywhere in the
  route world: features grid, stats, service-area cards, pricing cards.
- `.ticket-btn` — primary hero CTA styled as a jeepney fare ticket stub: hard offset
  shadow, punch-hole notches on both edges. This is the one place a hard neobrutalist
  shadow is used, and it's earned by the signage/ticket material, not a default.
- `.route-stop-number` — circular numbered badge sitting on a placard or route line.
- `.route-status-plate` — "NOW AT: Wash Partner"-style plate replacing a live-map pin
  in the tracking section (explicitly avoids the live-dispatch-map category default).
- `.signage-heading` — Anton, uppercase, tight tracking/leading.

### Motion: the signature moment

`RoutePath` (in `home-page.tsx`) draws an SVG route line segment-by-segment as it
scrolls into view: `getTotalLength()` sets `--route-len`, and a CSS transition on
`stroke-dashoffset` (`.route-path` / `.route-path-drawn` in `globals.css`) animates the
line from hidden to fully painted once an `IntersectionObserver` fires. Used between
the hero's 3 placards and across the how-it-works row. Fully inert under
`prefers-reduced-motion: reduce` (path renders already-drawn, per the existing
`.reveal`/`.bubble` pattern in the same file). This is the one motion set-piece — no
other new animation was added; existing `Reveal` fade/rise and hero parallax are
unchanged and reused as-is.

### Section-by-section commitment

Per the direction contract, hero / how-it-works / live-tracking are fully committed to
the new world. Sections lower in scroll priority (founding partners strip, app
showcase, reviews, pricing, download banner, FAQ) keep the existing `.card` /
`.card-elevated` language and `--color-primary`-based accents, picking up only the
route-colored icon chrome and a few reworded headings ("The fare board", "What
passengers say", "Board the {app} route") — no new product claims, all copy sourced
from `home-page-data.ts` is unchanged.

### Deliberate deviations from the literal contract

- The prior hero's soap-`.bubble` decoration was removed from the hero and
  how-it-works sections (fights the enamel-signage world) but left in place, unchanged,
  on the download-app banner — that section stays in the old visual language by design,
  per the contract's allowance for below-the-fold sections.
- Named finishing subagents `impeccable-finish-reviewer` / `impeccable-documenter` were
  not available as spawnable agent types in this environment; this document and the
  craft-floor pass were done directly instead of via those agents.
- No live browser/screenshot tool was available in this environment (no `chromium-cli`
  binary, dev server already bound to :3000 from a prior session); verification was
  done via `tsc --noEmit`, the Impeccable detector script, and reading the served HTML
  output for the new markup/classes, rather than a visual screenshot inspection round.

### Status

- `tsc --noEmit` (customer-web): clean.
- `impeccable/scripts/detect.mjs` on `home-page.tsx` + `globals.css` + `layout.tsx`:
  one pre-existing warning (`.faq-answer-wrap`'s `max-height` transition, unrelated to
  this redesign, left as-is) — no findings on new code.
