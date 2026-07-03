# Admin-Controlled Automation

Lunara normally requires an admin to manually dispatch orders to shops, assign
pickup/delivery riders, and generate partner settlements. This system lets an
admin turn each of those actions on individually, so the platform can run with
less (eventually no) manual intervention — while keeping every automation
independently reversible.

## Principles

- **Off by default.** Every automation starts disabled. Nothing changes in
  production behavior until an admin opts in.
- **One switch per process.** There is no global "automate everything"
  toggle — each automation is gated by its own flag, so an admin can trust
  dispatch automation while keeping refunds manual, for example.
- **Instant fallback.** Flipping a toggle off takes effect on the next
  action/sweep, no redeploy required. When a flag is off, the code path is
  identical to the pre-automation manual flow.
- **SOS incidents are never automated.** Safety-critical incident resolution
  always requires a human; there is intentionally no toggle for it.

## Where it lives

| Layer | Location |
|---|---|
| Settings schema | `apps/api/src/modules/settings/schemas/platform-settings.schema.ts` |
| Settings service/controller | `apps/api/src/modules/settings/settings.service.ts`, `settings.controller.ts` |
| Scheduled automations | `apps/api/src/modules/automation/automation-scheduler.service.ts` |
| Admin UI | `apps/admin-web/src/app/automation-settings/page.tsx` (sidebar: **System → Automation settings**) |

Settings are stored on the singleton `platform_settings` document (the same
document that holds delivery fee config) — one row, read/written via
`SettingsService`.

## API

```
GET  /api/v1/admin/settings/automation
PATCH /api/v1/admin/settings/automation
```

Admin-only (`JwtAuthGuard` + `RolesGuard`, `UserRole.ADMIN`). `PATCH` accepts
a partial body — only send the fields you're changing; omitted fields are
left untouched.

```json
{
  "autoDispatchOrders": false,
  "autoAssignPickupRider": false,
  "autoAssignDeliveryRider": false,
  "autoGenerateSettlements": false,
  "autoApproveRefunds": false,
  "autoApproveRefundsThreshold": 500,
  "autoApproveWithdrawals": false,
  "autoApproveWithdrawalsThreshold": 1000
}
```

## What's implemented today

| Flag | Automation | Trigger | Falls back to (when off) |
|---|---|---|---|
| `autoDispatchOrders` | Assigns a paid order to the top-ranked, capacity-available partner branch | Order transitions to `PENDING_DISPATCH` (`payments.service.ts` → `branchesService.autoDispatchOrder`) | Order sits in the admin dispatch queue for manual `POST /admin/dispatch/orders/:id/assign` |
| `autoAssignPickupRider` | Confirms the system-suggested pickup rider | 1-minute sweep (`AutomationSchedulerService.sweepRiderAssignments`) over shop-assigned orders with no pickup rider | Order sits in the admin ops queue for manual `POST /admin/operations/orders/:id/confirm-pickup-rider` |
| `autoAssignDeliveryRider` | Confirms the system-suggested delivery rider | Same 1-minute sweep, for orders `READY_FOR_DELIVERY` with no delivery rider | Manual `POST /admin/operations/orders/:id/confirm-delivery-rider` |
| `autoGenerateSettlements` | Runs a settlement for every partner branch with unsettled completed orders | Weekly sweep (`AutomationSchedulerService.generateScheduledSettlements`) | Manual `POST /admin/partners/:id/settlements` |

The rider-assignment and settlement sweeps run via `@nestjs/schedule`
(`ScheduleModule.forRoot()` in `app.module.ts`); each sweep re-reads its flag
from `SettingsService` on every run, so toggling off stops it on the next
tick — no restart needed.

## Reserved but not yet wired

These toggles exist in the schema and the admin UI (with threshold inputs
for the two financial ones) but have no automation logic behind them yet —
today they're recorded but have no effect. Wiring them follows the same
pattern as above (check the flag, then run the existing manual-approval code
path automatically):

- `autoApproveRefunds` / `autoApproveRefundsThreshold` — intended to
  auto-approve refund requests under the threshold when evidence is present,
  and escalate everything else.
- `autoApproveWithdrawals` / `autoApproveWithdrawalsThreshold` — intended to
  auto-approve rider cash-out requests under the threshold.
- Not yet represented as toggles at all: wallet hold/credit automation, rider
  and partner KYC pre-screening, support ticket triage. See the original
  automation plan for the full phased scope.

## Adding a new automation

1. Add a `@Prop({ default: false })` boolean (and threshold, if needed) to
   `PlatformSettings`.
2. Add it to `SettingsService.automationFields()` and the
   `isAutomationEnabled` key union.
3. Add the checkbox (and threshold input, if any) to
   `automation-settings/page.tsx`.
4. Gate the automated code path behind
   `settingsService.isAutomationEnabled('yourFlag')`, falling through to the
   existing manual endpoint/service call when it's off.
