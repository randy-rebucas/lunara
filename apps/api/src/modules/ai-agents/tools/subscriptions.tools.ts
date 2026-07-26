import { SubscriptionsService } from '../../subscriptions/subscriptions.service';
import { ToolSpec } from './types';

export function buildSubscriptionTools(subscriptions: SubscriptionsService): ToolSpec[] {
  return [
    {
      name: 'get_my_subscriptions',
      description:
        "List the caller's own recurring pickup subscriptions (weekly/monthly). Always scoped server-side to the authenticated user.",
      input_schema: { type: 'object', properties: {} },
      personas: ['emma'],
      handler: async (_input: unknown, ctx) => subscriptions.findAll(ctx.userId),
    },
  ];
}
