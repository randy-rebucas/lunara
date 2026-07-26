import { AdminOperationsService } from '../../admin/admin-operations.service';
import { ToolSpec } from './types';

export function buildAdminOperationsTools(ops: AdminOperationsService): ToolSpec[] {
  return [
    {
      name: 'get_control_tower',
      description: 'Get the SLA/conflict watchlist: at-risk orders, pending dispatch, and escalation-worthy items.',
      input_schema: { type: 'object', properties: {} },
      personas: ['olivia'],
      handler: async () => ops.getControlTower(),
    },
    {
      name: 'get_order_operations_detail',
      description: 'Get the operational detail view for a single order (rider assignment state, conflicts, SLA timers).',
      input_schema: {
        type: 'object',
        properties: {
          orderId: { type: 'string', description: 'The order id to look up.' },
        },
        required: ['orderId'],
      },
      personas: ['olivia', 'daniel'],
      handler: async (input: { orderId: string }) => ops.getOrderOperations(input.orderId),
    },
    {
      name: 'suggest_pickup_rider',
      description: 'Get candidate rider suggestions for a pickup assignment on a given order.',
      input_schema: {
        type: 'object',
        properties: {
          orderId: { type: 'string', description: 'The order id needing a pickup rider.' },
        },
        required: ['orderId'],
      },
      personas: ['daniel'],
      handler: async (input: { orderId: string }) => ops.suggestPickupRider(input.orderId),
    },
    {
      name: 'suggest_delivery_rider',
      description: 'Get candidate rider suggestions for a delivery assignment on a given order.',
      input_schema: {
        type: 'object',
        properties: {
          orderId: { type: 'string', description: 'The order id needing a delivery rider.' },
        },
        required: ['orderId'],
      },
      personas: ['daniel'],
      handler: async (input: { orderId: string }) => ops.suggestDeliveryRider(input.orderId),
    },
  ];
}
