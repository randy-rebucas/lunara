import { RewardsService } from '../../rewards/rewards.service';
import { ToolSpec } from './types';

// Loyalty is a partner-level feature (each partner runs their own program for their own shop) —
// no admin/staff tool reaches into it. 'sophia' (admin-web's Marketing persona) previously had a
// get_rewards_catalog tool for the old single platform-wide catalog; there's no longer one global
// catalog to expose, and per-partner program data isn't admin's to see or manage.
export function buildRewardTools(rewards: RewardsService): ToolSpec[] {
  return [
    {
      name: 'get_my_rewards',
      description:
        "Get the caller's own loyalty point balances (per shop they've earned at, plus their platform-wide referral balance). Always scoped server-side to the authenticated user.",
      input_schema: { type: 'object', properties: {} },
      personas: ['emma'],
      handler: async (_input: unknown, ctx) => rewards.listMyBalances(ctx.userId),
    },
    {
      name: 'get_my_referral_code',
      description: "Get (or generate) the caller's own referral code.",
      input_schema: { type: 'object', properties: {} },
      personas: ['emma'],
      handler: async (_input: unknown, ctx) => rewards.getOrCreateReferralCode(ctx.userId),
    },
  ];
}
