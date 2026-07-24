# Audit: Customer-web — Settings

Date: 2026-07-23

## Entry point
- Page: `apps/customer-web/src/app/(authenticated)/settings/page.tsx` (`'use client'`)
- Component(s): `PageShell`, `PageHeader`, `Card`/`CardBody`, local `SettingToggle`; state lives entirely in `lib/customer-settings.ts` (localStorage-backed, no backend)

## Sub-pages
None.

## Data flow
None — purely client-side, `localStorage`-backed via `loadCustomerSettings`/`saveCustomerSettings` (`lib/customer-settings.ts`). No network calls on this page at all.

## Backend trace
Not applicable — no backend involved. Settings are stored under `localStorage` key `lunara_customer_settings` and broadcast to other mounted components in the same tab via a `window.dispatchEvent(new CustomEvent('lunara-customer-settings'))` on every save, which other pages/components listen for to stay in sync without a page reload.

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| "Highlight order updates" toggle | `settings.emphasizeOrderUpdates` | **wired correctly** — consumed by `orders/page.tsx` (`emphasizeUpdates && isActiveOrderStatus(...)` rings active-order cards), which listens for the same `lunara-customer-settings` event to stay in sync live |
| "Partner distance hints" toggle | `settings.showBranchDistanceHints` | **[FIXED]** — see Finding #1; had zero consumers anywhere in the codebase before this pass |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Toggle a setting | no | n/a | n/a — synchronous `localStorage` write, no request to race | n/a — cannot fail (aside from a `localStorage` quota/availability edge case already handled defensively by `loadCustomerSettings`'s try/catch fallback to defaults) |

## Authorization
No role-scoped access — settings are purely local to the browser/device, not synced to any account-scoped backend record. Not applicable.

## Findings

1. **[FIXED] The "Partner distance hints" toggle (`showBranchDistanceHints`) was completely dead — saved, loaded, and rendered as a working toggle with a "Saved" confirmation, but read by nothing else in the entire codebase.** Confirmed via a full-codebase grep for `showBranchDistanceHints` that its only two references were this settings page and its definition in `lib/customer-settings.ts` — the booking wizard's shop-selection step (`docs/audits/customer-web/book.md`) always rendered `shop.distanceLabel` unconditionally, regardless of this setting. A customer disabling this toggle would see "Saved" and reasonably believe distance hints were now hidden, with no actual change in behavior anywhere in the app — a silently non-functional setting is worse than not having the setting at all, since it actively misleads the user about what they've configured.
   **Fix:** wired the setting into `components/booking/booking-wizard.tsx` — reads `loadCustomerSettings().showBranchDistanceHints` on mount and stays in sync via the same `lunara-customer-settings` window event `orders/page.tsx` already uses for `emphasizeOrderUpdates`, then conditionally omits the `· {shop.distanceLabel}` suffix from each shop card when the setting is off. Full fix detail and the affected render location are documented in `docs/audits/customer-web/book.md`, Finding #2 (kept there since that's the file the change was made in; cross-referenced here since this is where the setting itself surfaced as broken).

## Unused/dead fields
Not applicable in the API-payload sense (no API here), but see Finding #1 for the equivalent client-side "define a control and never read it" bug.

## Loading/error/realtime behavior
Not applicable — synchronous localStorage read/write, no loading or error states possible in the normal case. The page shows a brief "Loading…" state only in the (effectively instantaneous) window before the mount effect runs.
