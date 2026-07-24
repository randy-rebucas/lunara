---
name: audit-module
description: Audit a single page/feature/module's data flow end-to-end (frontend fetch -> API route -> service -> schema, back to render), write findings to docs/audits/<app>/<module>.md, and fix what's fixable before moving on. Use when asked to "audit" a page, module, or feature, or to document what data a screen fetches and whether it's used correctly.
---

# Audit a feature/module's data flow

Produces one markdown doc per module under `docs/audits/<app>/<module>.md` that maps
the full request path and flags real problems — then fixes what it found, so a
module is actually done (not just documented) before moving to the next one. This
is a repo-wide pattern — usable against any app in this monorepo (admin-web,
partner-web, customer-web, customer-mobile), paired with `apps/api`.

## Scope

One module = one page or one cohesive feature (e.g. admin-web's overview dashboard,
partner-web's receiving flow), **plus any sub-pages it links to** — a dynamic detail
route the page navigates into (e.g. a "View"/row-click link from `orders/page.tsx`
into `orders/[id]/page.tsx`, or `riders/page.tsx` into `riders/[userId]/page.tsx`).
A detail route reached only from this module's list/board is part of the same
audit, not a separate one — it shares the module's context (what the list already
told the user, what the detail page re-fetches redundantly, whether ids/params
passed through the link actually match what the detail page expects). Don't audit
a whole app in one pass — do it module by module (list + its detail sub-pages)
so each doc stays reviewable.

If a sub-page is a genuinely separate, deep feature in its own right (many widgets,
its own significant fetch graph) rather than a thin detail view, it's fine to give
it its own doc — but still cross-reference it from the parent module's doc (e.g.
under Sub-pages, "see `docs/audits/<app>/<submodule>.md`") instead of silently
duplicating or skipping it.

## Steps

1. **Find the entry point** — and its sub-pages. Locate the page file (e.g.
   `apps/<app>/src/app/<route>/page.tsx`) and the component(s) it renders. Note if
   it's a client or server component. Then grep the component(s) for outbound
   navigation (`<Link href=`, `router.push`, `<a href=`) into dynamic routes under
   the same feature area (e.g. `/orders/[id]`, `/riders/[userId]`,
   `/applications/partner/[id]`) — these are the module's sub-pages. List each one
   found, with the file path of its `page.tsx`, even if you end up only briefly
   tracing it in step 9 below.

2. **Trace the fetch.** Find every network call the module makes (fetch wrapper, React
   Query hook, socket subscription). Record: HTTP method, path, and the TypeScript
   interface/type describing the expected response shape as declared on the frontend.

3. **Trace the backend.** Follow the path to its controller method, then into the
   service method(s) it calls, down to the DB queries/aggregations and any schema
   involved. Note fields the backend computes/returns.

4. **Map every card/panel/widget on the page**, in render order, to the exact
   fields it reads from the fetched payload. Don't stop at "the component uses
   `DashboardData`" — go widget by widget (each stat card, chart, table, list,
   banner) and list which specific fields each one consumes. This is what surfaces
   dead fields and inconsistent formatting/derivation logic that a whole-component
   pass misses. Note anything each widget derives client-side (percentages,
   thresholds, color/status mappings) versus what the backend sends pre-computed,
   and flag hardcoded/unconfigurable values (magic thresholds, static link lists,
   client-side color maps that must stay manually in sync with backend keys).

5. **Diff frontend vs backend.** For every field the backend returns, check whether
   the frontend actually reads and renders it (grep the component for the field name).
   Flag:
   - Fields fetched but never rendered (dead payload — wasted query cost, or a sign
     the UI is missing something).
   - Fields rendered but not present in the frontend type (silent `any`/optional
     footguns).
   - Type mismatches between the frontend interface and what the service actually
     returns (e.g. optional vs required, string vs Date).
   - **Sensitive-data exposure** — a separate lens from "is it rendered": for each
     returned field, ask whether it's *more sensitive than the requesting role
     needs*, independent of whether the frontend happens to use it. PII (name,
     phone, email, address), auth material (tokens, hashes), and internal-only
     ids/notes sent to a role that doesn't strictly need them are findings even if
     the frontend never reads them — an unused sensitive field is worse than an
     unused harmless one, not the same thing.

6. **Authorization/role-scope check.** For any endpoint guarded by roles
   (`@Roles(...)`, `RolesGuard`, or manual role branches in the service, e.g. the
   `STAFF`/`PARTNER`/`ADMIN` branching seen in `LaundryTagsService.listTags`):
   - Confirm the controller's role guard actually matches what the frontend
     assumes — no route reachable by a role the UI never shows it to, and no UI
     action calling a route the current user's role can't legally hit.
   - For role-scoped data, trace the filter construction and confirm a request
     param can't widen it past what the role owns (e.g. can a partner pass someone
     else's `branchId` and get data back anyway?). Tag findings here `[authz]` in
     the summary so they're easy to scan for across many audits.

7. **Mutation safety checklist.** Run once per create/update/delete/toggle action
   found on the page — list every one, even the ones that pass cleanly. For each:
   - **Destructive?** (delete, retire, deactivate-with-side-effects) → does it
     require confirmation (`window.confirm`, a modal, a typed-confirmation field)?
     If not, state the concrete downstream effect of an accidental click (e.g.
     deleting a service area breaks live address matching immediately).
   - **Double-submit guard** — is the trigger disabled/busy while the request is
     in flight, or can a fast double-click fire it twice?
   - **Failure visibility** — does a failed mutation surface an error to the user
     (not a silently swallowed rejection), and does the UI return to a usable
     state rather than getting stuck "saving…" forever?

8. **Check loading/error/empty states.** For each fetch, confirm the component
   handles: initial loading, error (and what happens to `data` on error — does a
   failed refresh wipe previously-shown data?), and empty results. Note the shared
   hook/helper involved (e.g. a `useAsyncQuery`-style hook).

9. **Check realtime/refresh triggers**, if any (sockets, polling intervals). Confirm
   what triggers a refetch and whether that refetch is scoped correctly (doesn't
   thrash, doesn't double-fetch).

10. **Note obvious inefficiencies** in the backend query path only if concrete and
    visible in the code you already read (e.g. N+1 lookups, unindexed field in a
    `$in` query, full collection scans) — don't go hunting beyond what the trace
    surfaced.

11. **Trace each sub-page found in step 1.** For each detail route the module links
    into, repeat steps 2-9 at whatever depth its size warrants (a thin detail panel
    might just need its data flow row + a one-line note; a full page with its own
    widgets needs the full card-by-card treatment). Specifically check:
    - **Param handoff**: does the id/param the list passes (e.g. `order._id` in the
      `href`) match what the sub-page's fetch actually expects and sends to the
      backend? A mismatched field name or format (string vs ObjectId, `_id` vs a
      different key) here is a real bug class, not a style nit.
    - **Redundant re-fetching**: does the sub-page re-fetch fields the list already
      had in hand (wasted round-trip), or does it correctly fetch only the
      additional detail the list didn't load?
    - **Independent loading/error/realtime behavior**: sub-pages often have their
      own `useAsyncQuery` call and socket subscriptions separate from the parent —
      verify them the same way as step 8/9, don't assume they inherit the parent's.
    If a sub-page turns out to be a deep, separate feature per the Scope section
    above, write it as its own doc and just link to it here instead.

12. **Cross-module consistency check.** Whenever any finding above (from steps
    5-9) turns out to be a bug in *shared* code — a hook like `useAsyncQuery`, a
    shared component like `ListControls`, a shared util like `admin-api.ts` —
    don't treat it as page-specific. Grep sibling boards/pages for the same
    call or pattern and note in the finding how many other modules share the
    exposed behavior (e.g. "this affects N other boards using the same hook").
    This is the general form of the loading/error systemic-bug note from step 8 —
    apply it to any shared-code finding, not only loading/error ones.

13. **Write the doc** to `docs/audits/<app>/<module>.md` using the template below.
    Create `docs/audits/<app>/` if it doesn't exist. If a doc already exists for this
    module, update it in place rather than duplicating.

14. **Fix every finding you can safely fix in scope**, matching the existing
    codebase's conventions (same pattern as a comparable page elsewhere in the app
    — check for one before inventing a new approach, the way `orders-board.tsx`'s
    server-side `status`/`limit`/`statusCounts` pattern was the model for fixing
    `laundry-tags-board.tsx`). Don't stop at documenting a gap and calling the
    module done — a finding with a concrete, in-scope fix gets fixed now, not
    deferred. After fixing:
    - Typecheck whatever you touched (frontend and backend, if both changed).
    - **Regression-check shared code**: if the fix touched a hook/component/util
      also used elsewhere (surfaced in step 12), grep its other consumers and
      confirm the fix doesn't change their behavior in a way that breaks them —
      note in the Fix line whether other modules were also fixed by the same
      change, or verified unaffected.
    - Update each fixed finding in the doc with a short **Fix:** line (what changed,
      file:line) so the doc reflects the module's actual current state, not a
      snapshot of problems that no longer exist.
    - A finding is legitimately left unfixed only when it needs a product decision
      (breaking API/contract change, ambiguous UX call, data migration) or is
      genuinely out of the module's scope — say so explicitly with a one-line
      reason next to it, don't just omit it silently.
    - Don't use the fix pass as license to refactor beyond the findings — fix what
      was flagged, not adjacent code that merely looks improvable.

15. **Update the audit index.** Create or update `docs/audits/<app>/INDEX.md` — one
    row per audited module: module name, link to its doc, last-audited date, and a
    findings count as `open / fixed` (count Findings entries with a **Fix:** line
    describing a change as fixed; entries explicitly left unresolved as open). Add
    the header row if the file doesn't exist yet; otherwise update this module's
    row in place (or append a new row) rather than duplicating.

## Output template

```markdown
# Audit: <App> — <Module/Page name>

Date: <YYYY-MM-DD>

## Entry point
- Page: `path/to/page.tsx`
- Component(s): `path/to/component.tsx`

## Sub-pages
List each dynamic detail route linked from this module, or "None — no outbound
navigation into a detail route" if the trace found none.

| Sub-page | Linked from | Param passed | Matches sub-page's fetch? |
|---|---|---|---|
| `orders/[id]/page.tsx` | row "View" link, `orders-board.tsx:120` | `order._id` -> `id` route param | yes |

For each sub-page, a short paragraph covering: what it fetches beyond what the
parent list already had, its own loading/error/realtime behavior if it differs
from the parent, and any findings specific to it (folded into the numbered
Findings section below, not a separate one, unless the sub-page got its own doc).

## Data flow
| Call | Method | Path | Frontend type | Backend handler |
|---|---|---|---|---|
| ... | GET | /admin/dashboard | `DashboardData` | `AdminController.getDashboard` -> `AdminService.getDashboard` |

## Backend trace
Short prose: what the service queries, any aggregation/derived fields, notable
performance characteristics.

## Cards / panels
One row per widget, in render order — every stat card, chart, table, list, and
banner on the page, not just a summary of the whole component.

| Card | Fields consumed | Notes |
|---|---|---|
| ... | ... | client-derived values, hardcoded thresholds/links, color/key maps that must stay in sync with the backend, etc. |

## Mutations
One row per create/update/delete/toggle action found on the page, even the ones
with no issues.

| Action | Destructive? | Confirmed? | Double-submit guard? | Failure visible? |
|---|---|---|---|---|
| Delete area | yes | no | n/a | yes |

## Authorization
Short prose (or "No role-scoped access on this page" if the endpoints are open to
any authenticated role): which roles can reach each endpoint, whether that matches
what the frontend shows, and whether role-scoped filters can be widened by a
request param. Findings here are also numbered into Findings below, tagged
`[authz]`.

## Findings
Numbered, most important first. Each finding: what's wrong, where (file:line),
concrete impact, then a **Fix:** line — either what changed and where (once fixed
in the Fix step), or one line on why it's deliberately left unfixed (needs a
product decision / breaking change / out of scope). Prefix authorization findings
with `[authz]` in the summary. When a finding is a shared-code bug, note how many
other modules it affects (cross-module consistency check). Skip this section
(write "No issues found") if the trace turned up nothing.

## Unused/dead fields
List fields returned by the API but never read by the frontend, if any. Fields
that are unused **and** sensitive (PII, tokens, internal-only data) belong in
Findings too, not just here — being unused makes an over-broad field worse, not
merely dead weight.

## Loading/error/realtime behavior
Short prose on how loading, error, empty, and refresh states are handled, and
whether that behavior is shared with other pages via a common hook.
```

Keep findings factual and specific — cite file:line, not vague concerns. If nothing
is wrong in a section, say so briefly rather than omitting the section.
