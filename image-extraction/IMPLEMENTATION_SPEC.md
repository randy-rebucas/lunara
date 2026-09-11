# Orders — Empty State — Implementation Specification

## Source
- File: `image-extraction/source/order-empty.png`
- Image dimensions: 853 × 1844px
- Platform: iOS (native status bar + home indicator visible)
- Estimated viewport: iPhone Pro Max class device, portrait
- App: Lunara Partner / Shop Ops mobile app — Orders tab, zero-state

## Visual decomposition

### 01 — Brand logo icon
- Bounds (source px): [30, 135, 150, 215]
- Category: Vector asset (brand mark)
- Production representation: SVG (`BrandLogo`), reference crop at `crops/01_logo_icon.png`
- Notes: Rounded-square container with white background; moon + sparkle glyph in blue→violet gradient. Rebuild as SVG for crisp scaling and to allow partner white-labeling if this app is ever reused across brands.

### 02 — Empty-state illustration
- Bounds (source px): [205, 715, 645, 1040]
- Category: Vector/illustration asset
- Production representation: SVG preferred, or optimized static PNG/WebP (`crops/02_empty_state_illustration.png` is reference only)
- Notes: Open box + paper airplane + sparkle, monochrome violet gradient, sits on a soft radial-gradient ellipse. Should be a reusable, swappable illustration slot across all empty states in the app, not baked into this screen.

### 03 — Header text/wordmark
- Category: Live typography — do not rasterize
- Production representation: `Text` components ("LUNARA" bold brand-colored, "PARTNER · SHOP OPS" small caps grey)

### 04 — Notification bell + badge
- Category: Icon (vector) + live state
- Production representation: Icon-font/SVG bell icon inside `IconButton`, with a `NotificationBadge` dot bound to unread-notification state

### 05 — User avatar / menu trigger
- Category: Live component
- Production representation: `Avatar` (initials "SL") + `Text` stack ("Staff" / "Shop Staff") + chevron icon, tappable to open account menu

### 06 — "Orders" title + subtitle
- Category: Live typography
- Production representation: `Text` (display) + `Text` (secondary)

### 07 — Search field + filter button
- Category: Live UI component
- Production representation: `SearchField` (rounded, icon-left, placeholder) + adjacent `IconButton` (sliders icon) opening a filter sheet

### 08 — Filter pill bar
- Category: Live UI component (segmented control)
- Production representation: Horizontally scrollable `SegmentedFilterBar` of `FilterPill` items, each with a `CountBadge`; active pill uses `brand.primary` fill + white text, inactive pills use white surface + border

### 09 — Empty-state card
- Category: Composite live component + illustration
- Production representation: `EmptyState` (white rounded card, shadow) containing illustration, heading, description, and `TipCallout`

### 10 — Tip callout
- Category: Live component
- Production representation: `TipCallout` — pale violet rounded box, lightbulb icon, bold "Tip:" inline with regular body text

### 11 — Bottom tab bar
- Category: Live navigation component
- Production representation: `BottomTabBar` with 3 `TabBarItem`s; active item ("Orders") rendered as a filled pill with icon + label, inactive items as icon + label in muted color

## Design tokens
See [DESIGN_TOKENS.md](DESIGN_TOKENS.md).

## Component architecture
See [COMPONENT_MAP.md](COMPONENT_MAP.md).

## Responsive behavior
- This is a mobile-only composition (single column, full-width sections with consistent side padding ~16–24px).
- On larger phones/tablets, cap content width and center, or increase side padding rather than stretching the search bar/pills full-bleed.
- Filter pill bar must scroll horizontally (not wrap) to accommodate more statuses than fit on screen — confirmed by the screenshot's truncated "Processing" pill at the right edge.
- Bottom tab bar stays fixed/pinned regardless of scroll position of the orders list above it.

## Interaction states (not visible in static screenshot — must be designed)

### SearchField
- empty / focused / typing / cleared (x button) / no-results

### FilterPill
- default (inactive) / active / pressed / disabled (e.g., count still loading)

### EmptyState
- true-empty (this screenshot) vs. filtered-empty ("no results for this filter") — copy should differ ("No orders here" vs. "No orders match this filter")

### Orders list (once populated)
- loading (skeleton cards), loaded, error (fetch failed — retry action), offline

### Pull-to-refresh
- idle / refreshing

### BottomTabBar
- active / inactive / badge (e.g., unread count on a tab)

## Accessibility
- Bell icon and avatar must have accessible labels ("Notifications, 1 unread", "Account menu, Staff").
- Filter pills must expose selected state to screen readers (e.g., `accessibilityState={{selected}}` in RN) and have min 44×44pt touch targets even though visually smaller.
- Search field needs a label/placeholder announced correctly, and a visible focus indicator.
- Color contrast: verify `text.secondary` (#6B7280-ish) against `background.app`/white meets 4.5:1 at body text sizes.
- Illustration is decorative — mark with `accessibilityElementsHidden`/`aria-hidden`, not read aloud; the empty-state heading + description carry the meaning.
- Bottom tab bar items need accessible roles/labels (tab, selected state).

## Implementation mapping
See table in [COMPONENT_MAP.md](COMPONENT_MAP.md).

## Open questions / uncertainty
- Exact font family is unconfirmed from the screenshot (assumed a geometric sans like Inter/SF Pro) — verify against the app's actual typography config.
- Exact hex values for brand indigo/violet and the illustration gradient are estimates — pull true values from the design system or brand tokens if they exist, rather than the ones listed here.
- Whether `EmptyStateIllustration` already exists as a shared SVG asset in the codebase should be checked before recreating it from the screenshot crop.
- Full list of filter statuses beyond "All / Accept / Receive & Verify / Processing" is cut off in the screenshot — confirm the complete pipeline stage list from product/backend.
