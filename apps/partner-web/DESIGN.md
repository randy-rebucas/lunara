---
name: Lunara Partner Portal
description: Operator backend and marketing shell for laundry shop owners running orders, staff, inventory, and revenue on Lunara.
colors:
  primary: "#4f46e5"
  secondary: "#06b6d4"
  hero-navy: "#04142e"
  sky-accent: "#7dd3fc"
  surface: "#ffffff"
  surface-muted: "#f8fafc"
  border: "#e2e8f0"
  muted: "#64748b"
  muted-foreground: "#94a3b8"
  destructive: "#ef4444"
typography:
  headline:
    fontFamily: "var(--font-inter), Inter, system-ui, sans-serif"
    fontSize: "clamp(1.875rem, 4vw, 3rem)"
    fontWeight: 700
    lineHeight: 1.15
  title:
    fontFamily: "var(--font-inter), Inter, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: "var(--font-inter), Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "var(--font-inter), Inter, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "0.05em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
  button-outline-dark:
    backgroundColor: "transparent"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "20px 24px"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "#0f172a"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  badge-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
---

# Design System: Lunara Partner Portal

## Overview

**Creative North Star: "The Night Shift Console"**

The portal's public/auth surfaces run on a fixed two-register world: a dark navy console panel (`#04142e`) that carries brand voice, motion, and persuasion, paired with a plain white/slate operational register that carries forms and real data. The dark panel is never where a partner does work — it's where Lunara talks to them (hero copy, feature pitch, CTAs); the light register is where they act (sign in, fill a form, read a queue). This split repeats verbatim across `/login`, `/signup`, and the root landing page (`/`), which confirms it as system rather than a one-page choice.

Inside the dark panel, a rising soap-bubble field (`BubbleField`) is the one recurring signature motion element — an on-brand nod to laundry rather than generic ambient decoration — layered under radial indigo/cyan glows. Outline-stroke icons (never filled glyphs, never emoji) mark every feature line and form field. The `PhonePreviewMockup` component is the system's other signature: a fully-coded, real-data phone chrome (not a screenshot or drawing) used whenever the product needs to show the customer-facing app.

The landing page's chaos-vs-system split (torn paper slips vs. a calm `.card` queue) is a page-local storytelling device built from existing primitives (`.card`, `badge-*`, rotated utility divs) — it does not introduce new tokens or components, and its rotated-paper motif should not be read as a system-wide device.

**Key Characteristics:**
- Dark hero navy (`#04142e`) with radial indigo/cyan glow, reserved for brand-voice panels, never for operational surfaces.
- Rising bubble motion (`BubbleField`) as the one signature ambient animation.
- Outline-stroke SVG icons at 1.75 stroke width, sourced from a shared `ICONS` path map — no icon fonts, no filled glyphs.
- Flat card system: subtle ring + soft shadow, no hard offsets, no neobrutalist edges.
- Indigo primary / cyan secondary, used sparingly against a mostly white/slate operational canvas.

## Colors

The palette is a small operational set (indigo/cyan on white/slate) plus one reserved dark-navy register for brand-voice panels — not a full multi-page multi-hue system.

### Primary
- **Indigo** (`#4f46e5`, token `--color-primary`): primary buttons, active nav, links, focus rings, primary badges. The one color that means "act here."

### Secondary
- **Cyan** (`#06b6d4`, token `--color-secondary`): secondary buttons/badges and the second radial glow color in dark panels; used far less than primary.

### Neutral
- **Hero Navy** (`#04142e`): the fixed background of every dark brand-voice panel (login hero, signup hero, landing page hero/close sections). Never used as a body/content background.
- **Sky Accent** (`text-sky-300`, ~`#7dd3fc`): the one accent text color permitted on the dark navy panel, used for the emphasized second line of a headline ("Without the Guesswork", "or in one queue").
- **Surface** (`#ffffff`) / **Surface Muted** (`#f8fafc`): card and page backgrounds in the light operational register.
- **Border** (`#e2e8f0`), **Muted** (`#64748b`), **Muted Foreground** (`#94a3b8`): slate-scale text/divider hierarchy.
- **Destructive** (`#ef4444`): errors and the landing page's "missed calls" badge only.

### Named Rules
**The Two-Register Rule.** Dark navy (`#04142e`) panels carry brand voice and motion; white/slate panels carry forms and real data. A surface is one or the other, never a blend — confirmed identically across `/login`, `/signup`, and `/`.

**The One Accent Rule.** `text-sky-300` is the only light accent color allowed on the dark panel; it marks the single most important phrase in a headline, never body copy.

## Typography

**Body/Display Font:** Inter (`var(--font-inter)`, with `system-ui, sans-serif` fallback) — the only font family in use across all three pages; there is no separate display or mono face.

**Character:** A single practical sans throughout — headline weight (700) carries emphasis rather than a distinct display face; the system never swaps typefaces for tone.

### Hierarchy
- **Headline** (700, `clamp(1.875rem, 4vw, 3rem)` i.e. text-3xl→5xl responsive, 1.15 line-height): hero H1/H2 on dark and light brand-voice sections ("Run Your Shop Without the Guesswork", "Every order. On paper, in your head — or in one queue.").
- **Title** (700, 1.5rem–1.875rem / text-2xl–3xl): section headers within the operational register ("Welcome back", "Everything the queue on the right is running on.").
- **Body** (400, 0.875rem–1rem / text-sm–base): descriptive paragraph copy, form helper text, capability descriptions.
- **Label** (600, 0.75rem, uppercase, letter-spacing 0.05em): small kicker-style category labels used only on structural UI ("Without Lunara" / "With Lunara" panel labels, form field labels) — never as a decorative headline device.

### Named Rules
**The No-Display-Face Rule.** There is no separate display typeface; hierarchy comes entirely from size and weight of the same Inter family. Do not introduce a second font for "impact."

## Layout

Two-column split at desktop, single-column stack at mobile, is the recurring spatial grammar: `/login` and `/signup` split brand panel (fixed 50%) against form panel (flex-1); the landing page splits "before" against "after" as a `lg:grid-cols-2` grid that stacks on mobile. Content is centered in a `max-w-3xl`–`max-w-6xl` container depending on section density. Section padding runs `px-6 sm:px-10` horizontally and `py-14`–`py-28` vertically on hero/close sections, tighter (`py-16`–`py-20`) on content sections. Spacing rhythm inside cards and lists is built from an 8px-multiple scale (gap-3, gap-6, gap-8, mt-4, mt-8, mt-16).

## Elevation & Depth

The system is mostly flat with soft ambient shadows, never hard offsets. `--shadow-card` (`0 1px 3px 0 rgb(15 23 42 / 0.06), 0 1px 2px -1px rgb(15 23 42 / 0.06)`) is the default resting elevation for `.card`/`.stat-card`/`.section-panel`; `--shadow-elevated` is a slightly stronger variant for surfaces that need to read above their neighbors. Depth in the dark hero panels comes from layered radial gradients and the bubble field's inset highlight/shadow, not box-shadow.

### Shadow Vocabulary
- **card** (`box-shadow: 0 1px 3px 0 rgb(15 23 42 / 0.06), 0 1px 2px -1px rgb(15 23 42 / 0.06)`): default card/panel resting elevation.
- **elevated** (`box-shadow: 0 4px 6px -1px rgb(15 23 42 / 0.08), 0 2px 4px -2px rgb(15 23 42 / 0.06)`): raised surfaces (elevated cards, active nav-link).

### Named Rules
**The Ambient-Only Rule.** Shadows are diffuse and soft at every weight in use; there is no hard-offset/neobrutalist shadow anywhere in the shipped code. Depth reads as ambient lift, not drawn outline.

## Shapes

Corners are consistently rounded and moderate: `rounded-lg`/`8px` for buttons, inputs, and nav links; `rounded-xl`/`12-16px` for cards and phone chrome; `rounded-full` for badges, pills, and the bubble field itself. Borders are thin 1px rings at low opacity (`ring-1 ring-border/50` or `/60`), never a heavy stroke. The phone mockup chrome is the one place with a thick physical-device border (5-8px solid slate-900), intentionally distinct from the flat-ring language elsewhere because it represents a real device casing, not a UI panel.

## Components

### Buttons
- **Shape:** rounded corners (`rounded-lg`, 8px).
- **Primary:** `.btn-primary` — indigo background, white text, `px-4 py-2.5` (landing page CTAs scale this up to `px-6 py-3`).
- **Secondary/Outline:** `.btn-secondary` (cyan fill), `.btn-outline` (white fill + border ring) for light-register surfaces; on dark panels the outline variant drops the fill entirely and uses a `ring-1 ring-white/25` with `hover:bg-white/10` instead (the landing page's "Sign in" CTA on the navy hero).
- **Ghost:** `.btn-ghost` — no fill, hover to light slate background, used for tertiary in-page actions.
- **Hover/Focus:** background darkens ~10% (`/90` opacity shift) on hover; disabled state drops to 50% opacity.

### Cards / Containers
- **Corner Style:** `rounded-xl` (12px).
- **Background:** white (`--color-surface`) at rest; `bg-white/[0.03]` is used once, specifically for the landing page's desaturated "before" panel on the dark hero, signaling "not real UI yet."
- **Shadow Strategy:** `--shadow-card` at rest, `--shadow-elevated` for raised state; ring-1 border always present alongside the shadow.
- **Internal Padding:** `card-body` = `px-6 py-5` (mobile) / `px-8 py-6` (desktop).

### Inputs / Fields
- **Style:** white background, `rounded-lg`, `ring-1 ring-border/60`, left-padded to `pl-11` when an icon sits inside the field.
- **Focus:** ring shifts to `ring-2 ring-primary/25`, no border-color swap and no glow/shadow effect.
- **Error:** `.alert-error` — red-50 background, red-200 border, red-700 text; not a per-field inline state in current usage.

### Badges
- **Style:** `rounded-full`, `px-2.5 py-0.5`, `text-xs font-medium`, tinted background (`bg-{color}/10`) with matching solid text color — never a solid-fill badge outside of `nav-link-active`.
- **State variants:** `badge-primary`, `badge-secondary`, `badge-accent`, `badge-trend-up/down/flat`, `badge-warning`, `badge-danger`, `badge-neutral` — one visual pattern (tint bg + solid text), swapped hue per semantic meaning.

### Navigation
- **Style:** `nav-link` — pill-shaped (`rounded-full`), muted text, hover to light slate background; `nav-link-active` swaps to solid indigo fill, white text, and the card shadow token.

### Icon System (signature)
Every icon in the product — form-field icons, feature bullets, badges, phone-mockup UI — is a single `<Icon d={...} />` component: a 24×24 viewBox, `stroke="currentColor"`, `strokeWidth={1.75}` (2 inside the phone mockup), `fill="none"`, path data drawn from a shared `ICONS` map or a page-local outline constant. There are no filled icons, no icon-font glyphs, and no third-party icon package rendered directly — everything is inline SVG path data. This is a load-bearing system rule, not a page choice: it is identical in `icon.tsx`, the landing page's local `PHONE_RING_ICON`, and `phone-preview-mockup.tsx`'s local icon set.

### BubbleField (signature)
A shared rising-bubble motion component (`bubble-field.tsx`) renders a fixed choreography of 8-9 bubbles (`DARK_PANEL_BUBBLES` for navy panels, `LIGHT_PANEL_BUBBLES` for light ones) that drift upward and fade via a shared `login-bubble-rise` keyframe, respecting `prefers-reduced-motion`. It is reused byte-identical across all three pages via the shared component and CSS classes (`.login-bubble` / `.login-bubble-light`) rather than being reimplemented per page — confirming it as a system primitive, not a one-off hero flourish.

### PhonePreviewMockup (signature)
A fully-coded phone-chrome component (not a screenshot) rendering three real screens (Intro, Sign in, Book) driven by config data and a partner's extracted brand palette, with a `default`/`branded` variant switch and a click-to-zoom lightbox. It is the system's standard for "show the customer app" anywhere in the product; new surfaces needing to depict the customer app should reuse this component rather than mocking a new phone frame.

## Do's and Don'ts

### Do:
- **Do** keep the dark hero navy (`#04142e`) exclusive to brand-voice panels (hero, close/CTA sections); keep operational content on white/slate.
- **Do** reuse `BubbleField` with its existing bubble-position presets for any new dark or light brand panel rather than inventing new motion.
- **Do** reuse `PhonePreviewMockup` for any new surface that needs to depict the customer-facing app.
- **Do** draw all icons from the shared outline-SVG `Icon`/`ICONS` pattern (24×24 viewBox, `strokeWidth={1.75}`, `currentColor`).
- **Do** keep shadows soft and ambient (`--shadow-card` / `--shadow-elevated`); pair every shadow with a `ring-1 ring-border` at low opacity.

### Don't:
- **Don't** introduce a second typeface for emphasis — hierarchy comes from Inter's weight/size scale alone.
- **Don't** use hard-offset or neobrutalist shadows anywhere; the system's depth language is uniformly soft and diffuse.
- **Don't** use filled icons, icon fonts, or emoji as UI iconography — outline SVG only.
- **Don't** treat the landing page's rotated-paper "chaos" collage as a reusable system device; it is a one-surface storytelling metaphor built from existing card/utility primitives, not a new token or component.
