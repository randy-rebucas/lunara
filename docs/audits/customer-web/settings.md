# Audit: Customer-web — Settings

Date: 2026-07-23 (updated 2026-08-31 — new notification-preferences section added, no longer purely local-only)

**2026-08-31 update:** the page now also has a backend-synced section (`notifPrefs`,
`settings/page.tsx:57-58,80-86,88-106`) that didn't exist at the original audit — "Push
notifications" / "Email notifications" toggles, `PATCH /customers/me` with
`{ notificationPreferences: { push, email } }`. Traced this new flow end-to-end since it's a
"wire it up" check, not just a re-read:
- `CustomersService.updateProfile` (`customers.service.ts:62-67`) persists `notificationPreferences`
  onto the `Customer` document, defaulting each field to its previous/`true` value when omitted.
- `CustomerOrderNotificationService.getPreferences` (`push/customer-order-notification.service.ts:29-38`)
  reads it back on every order event/status notification (`notifyOrderEvent`/`notifyOrderStatus`),
  defaulting to `true` if the customer has no document/field yet — matches the frontend's own
  `{ push: true, email: true }` fallback on a failed `GET /customers/me`.
- `push: preferences.push` is passed through as `sendPush` into `NotificationDispatchService.dispatch`,
  which (`notification-dispatch.service.ts:40`) skips only the push-channel send when `sendPush ===
  false`, still recording the in-app notification either way — correct: disabling "push
  notifications" shouldn't also silence the in-app notification bell.
- `email: preferences.email` gates `sendOrderEmail` (`customer-order-notification.service.ts:80-82`),
  itself internally gated to `EMAIL_EVENTS` (`paymentConfirmed`/`dispatched`/`delivered`) — a customer
  who turns email off doesn't get any of the three order-lifecycle emails.

Both toggles are fully wired, no dead setting. The pre-existing `emphasizeOrderUpdates` (orders list
ring highlight) and `showBranchDistanceHints` (booking wizard distance labels) localStorage settings
were re-checked and remain correctly consumed at their documented call sites
(`orders/page.tsx:66,70`, `booking-wizard.tsx:90,94`) — no regression.

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
| Toggle a local setting (`emphasizeOrderUpdates`/`showBranchDistanceHints`) | no | n/a | n/a — synchronous `localStorage` write, no request to race | n/a — cannot fail (aside from a `localStorage` quota/availability edge case already handled defensively by `loadCustomerSettings`'s try/catch fallback to defaults) |
| Toggle push/email notification preference | no | n/a | yes — `disabled={notifSaving}` on both toggles (`settings/page.tsx:147,155`) | yes — reverts the optimistic update to the pre-call value on a failed `PATCH` (`settings/page.tsx:101-102`); no visible error message on failure though, just a silent revert (same low-priority pattern already noted, not fixed, for favorite-toggle in `booking-checkout-orders.md` Finding 2) |

## Authorization
No role-scoped access — settings are purely local to the browser/device, not synced to any account-scoped backend record. Not applicable.

## Findings

1. **[FIXED] The "Partner distance hints" toggle (`showBranchDistanceHints`) was completely dead — saved, loaded, and rendered as a working toggle with a "Saved" confirmation, but read by nothing else in the entire codebase.** Confirmed via a full-codebase grep for `showBranchDistanceHints` that its only two references were this settings page and its definition in `lib/customer-settings.ts` — the booking wizard's shop-selection step (`docs/audits/customer-web/book.md`) always rendered `shop.distanceLabel` unconditionally, regardless of this setting. A customer disabling this toggle would see "Saved" and reasonably believe distance hints were now hidden, with no actual change in behavior anywhere in the app — a silently non-functional setting is worse than not having the setting at all, since it actively misleads the user about what they've configured.
   **Fix:** wired the setting into `components/booking/booking-wizard.tsx` — reads `loadCustomerSettings().showBranchDistanceHints` on mount and stays in sync via the same `lunara-customer-settings` window event `orders/page.tsx` already uses for `emphasizeOrderUpdates`, then conditionally omits the `· {shop.distanceLabel}` suffix from each shop card when the setting is off. Full fix detail and the affected render location are documented in `docs/audits/customer-web/book.md`, Finding #2 (kept there since that's the file the change was made in; cross-referenced here since this is where the setting itself surfaced as broken).

2. **[FIXED] `tsc --noEmit` failed on this file.** `savedTimeoutRef` at line 52 was typed `useRef<ReturnType<typeof window.setTimeout> | null>(null)`, which resolved against Node's global `setTimeout`/`Timeout` override rather than the DOM lib, so assigning the result of `window.setTimeout(...)` at line 77 (a `number`) failed type-checking. Flagged independently by both the repo-wide health scan (`HEALTH-SCAN.md`) and the marketing-pages audit's typecheck pass.
   **Fix:** typed the ref explicitly as `useRef<number | null>(null)` (`settings/page.tsx:52`). `npx tsc --noEmit` in `apps/customer-web` now passes clean.

## Unused/dead fields
Not applicable in the API-payload sense (no API here), but see Finding #1 for the equivalent client-side "define a control and never read it" bug.

## Loading/error/realtime behavior
Not applicable — synchronous localStorage read/write, no loading or error states possible in the normal case. The page shows a brief "Loading…" state only in the (effectively instantaneous) window before the mount effect runs.
