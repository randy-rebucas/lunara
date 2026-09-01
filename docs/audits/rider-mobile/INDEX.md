# Rider-mobile audit index

| Module | Doc | Last audited | Findings (open / fixed) |
|---|---|---|---|
| Home dashboard | [home.md](home.md) | 2026-09-02 | 0 open / 5 fixed |
| Tasks (+ pickup/delivery detail, scan) | [tasks.md](tasks.md) | 2026-09-02 | 1 open / 4 fixed |
| Profile (+ Edit profile, Documents/KYC) | [profile.md](profile.md) | 2026-09-02 | 2 open / 2 fixed |
| Earnings (history + breakdown) | [earnings.md](earnings.md) | 2026-09-02 | 0 open / 2 fixed |
| Wallet (balance, payout, remittance, withdrawals) | [wallet.md](wallet.md) | 2026-09-02 | 1 open / 3 fixed |
| History (task history + cancelled list) | [history.md](history.md) | 2026-09-02 | 1 open / 2 fixed |
| Performance (completion/acceptance/on-time/rating stats) | [performance.md](performance.md) | 2026-09-02 | 2 open / 1 fixed |
| Notifications | [notifications.md](notifications.md) | 2026-09-02 | 0 open / 3 fixed |
| Support (+ Report issue, My reports) | [support.md](support.md) | 2026-09-02 | 3 open / 3 fixed |
| Auth (Login + Forgot Password + session bootstrap) | [auth.md](auth.md) | 2026-09-02 | 3 open / 2 fixed |

**Totals: 13 open / 27 fixed** across 10 modules.

Superseded docs (kept for history, no longer authoritative): [documents.md](documents.md) → folded into `profile.md`; [scan.md](scan.md) → folded into `tasks.md`; [report-issue.md](report-issue.md) → folded into `support.md`.

All screens under `apps/rider-mobile/app` have been audited as of 2026-09-02. Notable fixes this pass: a missing `x-lunara-client` header that could hard-fail rider OTP/login wherever reCAPTCHA is enabled ([auth.md](auth.md)), a missing refresh-token flow causing unnecessary forced logouts ([auth.md](auth.md)), an admin-only field (`reviewedBy`) leaking to every rider on `/riders/me` ([profile.md](profile.md)), full customer name/address broadcast to every online rider browsing unclaimed offers rather than just the one who accepts ([home.md](home.md)), a wrong-detail-screen routing bug for delivery-leg history/cancelled tasks ([tasks.md](tasks.md), [history.md](history.md)), a missing withdrawal confirmation dialog ([wallet.md](wallet.md)), and the employee-vs-independent-contractor earnings display gap ([earnings.md](earnings.md)).

Remaining open items are all documented product/UX decisions or shared cross-app patterns explicitly out of scope for a single-module fix (see each doc's Findings section for the one-line reason).
