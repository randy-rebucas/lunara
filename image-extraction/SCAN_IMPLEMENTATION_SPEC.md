# Scan (Laundry Tag Lookup) — Implementation Specification

## Source
- File: `image-extraction/source/scan.png`
- Image dimensions: 853 × 1844px
- Platform: iOS (native status bar + home indicator visible)
- Estimated viewport: iPhone Pro Max class device, portrait
- App: Lunara Partner / Shop Ops mobile app — Scan tab, default/idle state

## Visual decomposition

### 01 — Brand logo icon
- Bounds (source px): [30, 135, 150, 215]
- Category: Vector asset (brand mark)
- Production representation: SVG (`BrandLogo`) — same asset as Orders screen, reference crop at `crops/01_logo_icon.png`
- Notes: Identical mark to the Orders empty-state screen; confirms this is a shared header component (`AppHeader`), not screen-specific.

### 02 — Hero laundry-tag illustration
- Bounds (source px): [598, 190, 853, 410]
- Category: Vector/illustration asset
- Production representation: SVG preferred, or optimized static PNG/WebP (`crops/02_hero_tag_illustration.png` is reference only)
- Notes: Folded towels/linens with a QR-coded laundry tag, sparkle accents, monochrome blue-violet tint bleeding into the header background. Purely decorative — should be a reusable `ScanHeroArt` slot, not baked pixel-for-pixel; likely gets cropped/clipped differently per device width so treat as a background-anchored illustration, not a fixed-size image.

### 03 — Scanner frame icon
- Bounds (source px): [220, 420, 630, 670]
- Category: Vector asset (icon, not photography)
- Production representation: SVG (`ScanFrameIcon`), reference crop at `crops/03_scanner_frame_icon.png`
- Notes: Corner-bracket viewfinder + QR glyph with a horizontal "scan line" glow. Should be rebuilt as a single-color SVG (uses `brand.primary`) so it can be recolored per white-label theme and optionally animated (see Motion below). Do not ship as a raster image.

### 04 — Primary scan card (container)
- Bounds (source px): [60, 690, 793, 960]
- Category: CSS/layout — white rounded card with shadow
- Production representation: `Card` primitive, `radius.lg`, `elevation.medium`

### 05 — "Scan laundry tag" heading + description
- Category: Live typography
- Production representation: `Text` (heading, bold) + `Text` (secondary, 2-line body), centered

### 06 — "Open scanner" primary button
- Bounds (source px): [60, 855, 793, 935]
- Category: Live UI component
- Production representation: `Button` variant="primary", full-width, pill/large-radius, leading icon (scan-frame glyph) + label + trailing arrow icon. Trailing arrow implies navigation to a full-screen camera view.

### 07 — "Manual lookup" secondary action card
- Bounds (source px): [40, 1010, 415, 1115]
- Category: Live UI component
- Production representation: `ActionCard` (lavender tint) — icon badge (search), title, subtitle, trailing chevron. Half-width, part of a 2-up row.

### 08 — "Enter code" secondary action card
- Bounds (source px): [438, 1010, 813, 1115]
- Category: Live UI component
- Production representation: `ActionCard` (mint tint) — icon badge (barcode), title, subtitle, trailing chevron. Same component as 07 with a `tone` prop (`lavender` | `mint`) driving the tint + icon-badge color.

### 09 — "Recent scans" section (heading + list)
- Bounds (source px): [40, 1160, 813, 1560]
- Category: Live typography (heading/link) + live list component
- Production representation: Section header (`Text` + "View all" `TextLink`) above a `RecentScanList` of `RecentScanRow` items: QR-tile icon, order # (monospace-ish bold), customer name, relative timestamp, trailing `StatusPill` ("Found" success / "Not found" warning) + chevron. Divider lines between rows, not separate cards.

### 10 — Bottom tab bar
- Bounds (source px): [0, 1660, 853, 1844]
- Category: Live navigation component
- Production representation: `BottomTabBar` with 3 `TabBarItem`s (Orders / Scan / Profile); active item ("Scan") rendered as a filled pill with icon + label — same component as the Orders screen, `activeTab="scan"`.

## Design tokens
Reuses the shared system in [DESIGN_TOKENS.md](DESIGN_TOKENS.md) (same brand indigo/violet, spacing scale, radii, elevation). Additions specific to this screen:

| Token | Approx value | Usage |
|---|---|---|
| `surface.actionCard.lavender` | `#EDEBFB` | "Manual lookup" card background |
| `surface.actionCard.mint` | `#E3F7EC` | "Enter code" card background |
| `status.success.bg` / `status.success.fg` | `#DCFCE7` / `#16A34A` | "Found" pill |
| `status.warning.bg` / `status.warning.fg` | `#FEF3E2` / `#D97706` | "Not found" pill |
| `icon.badge.lavender` | `#6D5EF0` on `#E4E0FB` | Manual lookup search icon badge |
| `icon.badge.mint` | `#16A34A` on `#D9F5E4` | Enter code barcode icon badge |

## Component architecture
Reuses `AppHeader`, `Card`, `Button`, `BottomTabBar` from the Orders screen system (see [COMPONENT_MAP.md](COMPONENT_MAP.md)). New components introduced by this screen:
- `ScanFrameIcon` (SVG)
- `ScanHeroArt` (SVG/illustration)
- `ActionCard` (tone-driven secondary action tile)
- `RecentScanList` / `RecentScanRow`
- `StatusPill` (success | warning | neutral variants)

## Responsive behavior
- Single-column mobile composition; hero illustration is edge-bleed (right-aligned, clipped by viewport) — treat as `position: absolute` decoration behind/beside the header text, not part of normal flow sizing.
- The two `ActionCard`s form a 2-up row with a fixed gap (~16px); on narrower devices they should remain 2-up (they're already compact) rather than stacking, but must shrink gracefully — long localized labels need `numberOfLines`/truncation.
- `RecentScanList` should be scrollable within the page if it grows beyond a few items; "View all" navigates to a full history screen rather than the list growing unbounded.
- Bottom tab bar stays fixed/pinned regardless of scroll position.

## Interaction states (not visible in static screenshot — must be designed)

### Open scanner button
- default / pressed / loading (requesting camera permission) / disabled (no camera available)

### Camera permission
- not-yet-requested / granted / denied (show fallback message + link to Settings) / restricted

### Scanner (post-tap, full-screen — not shown in this screenshot)
- scanning / tag-detected-decoding / found (auto-navigate to order) / not-found (inline error + retry) / torch-toggle / manual-entry-fallback

### ActionCard (Manual lookup / Enter code)
- default / pressed / disabled

### RecentScanRow
- default / pressed (navigates to matched order or a "not found" detail) / loading (if list is fetched async)

### RecentScanList
- loading (skeleton rows) / loaded / empty ("No recent scans yet") / error

### StatusPill
- success ("Found") / warning ("Not found") / consider adding a neutral "Pending" variant for async lookups

## Accessibility
- `Open scanner` button must request camera permission with a clear rationale prompt before the OS dialog if possible; denial must show a recoverable, non-blocking message.
- Scanner frame icon and hero illustration are decorative — hide from screen readers (`accessibilityElementsHidden` / `aria-hidden`).
- `ActionCard`s and `RecentScanRow`s need accessible labels combining title + status (e.g., "Manual lookup, search by order number", "#LN-20240912-001, Maria Santos, Found, today 4:58 PM").
- `StatusPill` color must not be the only signal — pair with the icon (check / warning) already present, and verify text contrast within the pill background.
- Minimum 44×44pt touch targets for both `ActionCard`s and each `RecentScanRow` (rows currently look tall enough, but confirm at smallest supported font scale).
- Support Dynamic Type / font scaling for the two-line description under the heading without breaking the card's fixed-looking layout — allow the card to grow vertically.

## Implementation mapping

| Screenshot region | Production implementation |
|---|---|
| Logo icon | `BrandLogo` (shared) |
| Header wordmark + role | `AppHeader` (shared, live text) |
| Notification bell + avatar | `AppHeader` (shared components) |
| Hero laundry-tag art | `ScanHeroArt` (SVG) |
| "Scan" title + subtitle | `Text` tokens |
| Scanner frame icon | `ScanFrameIcon` (SVG) |
| "Scan laundry tag" card | `Card` + `Text` + `Button` |
| Manual lookup | `ActionCard` tone="lavender" |
| Enter code | `ActionCard` tone="mint" |
| Recent scans header | `Text` + `TextLink` ("View all") |
| Recent scan rows | `RecentScanList` → `RecentScanRow` → `StatusPill` |
| Bottom tab bar | `BottomTabBar` (shared) |

## Open questions / uncertainty
- Exact behavior of `Open scanner` (native camera view vs. in-app custom camera UI) is not visible in this screenshot — confirm with product/engineering.
- Whether "Enter code" and "Manual lookup" lead to the same search flow with different input modes, or genuinely separate flows, should be confirmed before componentizing their target screens.
- Order-number format (`#LN-YYYYMMDD-###`) and timestamp format ("Today, 4:58 PM") should be confirmed as shared formatting utilities already used elsewhere (Orders screen), not redefined here.
- Font family remains an estimate (geometric sans, consistent with the Orders screen) — verify against actual app typography config.
