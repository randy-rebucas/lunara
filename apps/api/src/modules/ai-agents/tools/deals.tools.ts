import { PromotionsService } from '../../promotions/promotions.service';
import { ToolSpec } from './types';

export function buildDealTools(promotions: PromotionsService): ToolSpec[] {
  return [
    {
      name: 'get_my_deals',
      description:
        "List promotions/deals the caller is currently eligible for. Always scoped server-side to the authenticated user.",
      input_schema: { type: 'object', properties: {} },
      personas: ['emma'],
      handler: async (_input: unknown, ctx) => promotions.listDealsForCustomer(ctx.userId),
    },
  ];
}
