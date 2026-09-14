// Loyalty is a partner-level feature: each partner configures their own points-per-order rate
// and redeemable catalog (see PartnerRewardsProgram) instead of a single platform-wide catalog.
// This file now only holds constants for the parts of rewards that remain platform/customer-level
// and aren't a partner's to configure: tier thresholds (informational display only, computed from
// a customer's per-partner balance) and the referral program (a customer-to-customer mechanic that
// was never partner- or admin-specific).

export const TIERS = [
  { name: 'Moon', min: 0 },
  { name: 'Star', min: 500 },
  { name: 'Comet', min: 1500 },
  { name: 'Galaxy', min: 3000 },
] as const;

/** Default pointsPerCompletedOrder for a newly created PartnerRewardsProgram — partners can
 * change this for their own shop at any time. */
export const DEFAULT_POINTS_PER_COMPLETED_ORDER = 50;

export const REFERRAL_BONUS_POINTS = 100;
export const REWARD_VOUCHER_VALIDITY_DAYS = 30;
