# Audit: Admin-web — Automation settings

Date: 2026-07-23

## Entry point
- Page: `apps/admin-web/src/app/automation-settings/page.tsx`
- Component(s): inline in the page file (`AutomationToggle`), no separate board

This is a full-page, single-purpose view of the same automation settings
already covered by the "Orders & operations" and "Payments" tabs on
`docs/audits/admin-web/settings.md` — same GET/PATCH endpoint, same
`AutomationSettings` shape, same backend service and DTO. It's linked from
Settings' "Shortcuts" rail (`settings/page.tsx:927`, "full-page automation
view") as a focused alternative to the tabbed settings page, not a
different feature. This doc is intentionally short — see `settings.md` for
the full backend trace, which is identical here.

## Sub-pages
None — no outbound navigation into a dynamic detail route.

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| Load automation settings | GET | `/admin/settings/automation` | `AutomationSettings` | `SettingsController.getAutomationSettings` -> `SettingsService.getAutomationSettings` |
| Save automation settings | PATCH | `/admin/settings/automation` | — | `SettingsController.updateAutomationSettings` -> `SettingsService.updateAutomationSettings` |

## Backend trace
Identical to the automation portion of `docs/audits/admin-web/settings.md`'s
Backend trace — see that doc. `updateAutomationSettings` only assigns keys
actually present in the request body (guards against `class-validator`
instantiating omitted DTO fields as explicit `undefined` and unsetting them
on save), but this page always sends the full 8-field `form` object regardless
of what changed, so that guard is a no-op here specifically (harmless —
`PATCH` with the complete current state is idempotent).

## Cards / panels
| Card | Fields consumed | Notes |
|---|---|---|
| Order flow panel | `autoDispatchOrders`, `autoAssignPickupRider`, `autoAssignDeliveryRider` | plain checkboxes, no threshold |
| Financial panel | `autoGenerateSettlements`; `autoApproveRefunds` + `autoApproveRefundsThreshold`; `autoApproveWithdrawals` + `autoApproveWithdrawalsThreshold` | threshold inputs disabled while their toggle is off (`disabled={!checked}`, matches the pattern in `settings/page.tsx`'s `ToggleRow`) |

## Mutations
| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Save changes (full automation object PATCH) | no | n/a | yes (`disabled={saving || !form}`) | yes (`saveError`) |

Unlike `settings/page.tsx`'s batched Save (which tracks a `dirty` flag per
settings slice and disables Save when nothing changed), this page's Save
button is enabled any time `form` is loaded, whether or not anything was
edited — clicking it with no changes just re-PATCHes the current values.
Harmless (idempotent), just a minor UX inconsistency between the two
automation-editing surfaces, not a data-safety issue.

## Authorization
Same as `settings.md`: `/admin/settings/automation` sits under `SettingsController`, class-level `@Roles(UserRole.ADMIN)` (`settings.controller.ts:12-14`) — matches the frontend, admin-only, no role-scope-widening concern (single global settings document).

## Findings
No issues found. This page is a thin, correctly-wired alternate view of
settings already validated in `settings.md` — same DTO validation
(`@Min(0)` on both threshold fields, matching the client's `min={0}` inputs),
same auth guard, no dead or over-exposed fields (both threshold and boolean
fields the backend returns are rendered).

## Unused/dead fields
None — every field `AutomationSettings` returns is rendered.

## Loading/error/realtime behavior
Uses the shared `useAdminQuery` hook: spinner while `loading && !form`, error
text on failure without clearing previously-loaded `form`, no polling. Local
edits are held in `form` (synced from `data` via a `useEffect`) until Save,
same pattern as `settings/page.tsx`.
