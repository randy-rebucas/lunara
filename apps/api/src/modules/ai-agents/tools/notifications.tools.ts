import { ReviewsService } from '../../reviews/reviews.service';
import { ToolSpec } from './types';

export function buildNotificationTools(reviews: ReviewsService): ToolSpec[] {
  return [
    {
      name: 'get_my_notifications',
      description: "List the caller's own in-app notifications. Always scoped server-side to the authenticated user.",
      input_schema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max number of notifications to return (default 20).' },
        },
      },
      personas: ['emma'],
      handler: async (input: { limit?: number }, ctx) => reviews.listNotifications(ctx.userId, input?.limit),
    },
  ];
}
