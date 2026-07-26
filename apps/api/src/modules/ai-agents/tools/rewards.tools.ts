import { RewardsService } from '../../rewards/rewards.service';
import { ToolSpec } from './types';

export function buildRewardTools(rewards: RewardsService): ToolSpec[] {
  return [
    {
      name: 'get_my_rewards',
      description:
        "Get the caller's own loyalty points balance, tier progress, and points transaction history. Always scoped server-side to the authenticated user.",
      input_schema: { type: 'object', properties: {} },
      personas: ['emma'],
      handler: async (_input: unknown, ctx) => rewards.getBalanceAndHistory(ctx.userId),
    },
    {
      name: 'get_my_referral_code',
      description: "Get (or generate) the caller's own referral code.",
      input_schema: { type: 'object', properties: {} },
      personas: ['emma'],
      handler: async (_input: unknown, ctx) => rewards.getOrCreateReferralCode(ctx.userId),
    },
    {
      name: 'get_rewards_catalog',
      description: 'Get the redeemable rewards catalog (what customers can redeem points for). Not customer-specific.',
      input_schema: { type: 'object', properties: {} },
      personas: ['sophia'],
      handler: async () => rewards.getCatalog(),
    },
  ];
}
