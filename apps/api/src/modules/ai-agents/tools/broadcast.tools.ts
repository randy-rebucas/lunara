import { PushNotificationService } from '../../push/push-notification.service';
import { ToolSpec } from './types';

// Broadcast audience sizes and history are internal marketing-ops data — not customer-facing.
export function buildBroadcastTools(push: PushNotificationService): ToolSpec[] {
  return [
    {
      name: 'get_broadcast_audience_counts',
      description: 'Get device/audience counts available for a platform broadcast, by segment.',
      input_schema: { type: 'object', properties: {} },
      personas: ['sophia'],
      handler: async () => push.getAudienceDeviceCounts(),
    },
    {
      name: 'get_broadcast_history',
      description: 'List recently sent platform broadcasts.',
      input_schema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max number of broadcasts to return (default 50).' },
        },
      },
      personas: ['sophia'],
      handler: async (input: { limit?: number }) => push.listBroadcasts(input?.limit),
    },
  ];
}
