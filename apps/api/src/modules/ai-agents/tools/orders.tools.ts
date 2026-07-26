import { UserRole } from '@lunara/types';
import { OrdersService } from '../../orders/orders.service';
import { ToolSpec } from './types';

export function buildOrderTools(orders: OrdersService): ToolSpec[] {
  return [
    {
      name: 'get_partner_queue',
      description:
        'Get the current partner processing queue: orders not yet completed/cancelled/refunded, grouped by status with counts. Useful for operations and dispatch questions about what is in flight right now.',
      input_schema: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Optional exact order status to filter by.' },
        },
      },
      personas: ['olivia', 'daniel'],
      handler: async (input: { status?: string }) => orders.getPartnerQueue(input?.status),
    },
    {
      name: 'get_order_detail',
      // Safe to share with emma: OrdersService.findOne() enforces per-role ownership itself
      // (a CUSTOMER ctx can only ever get back an order they own; ForbiddenException otherwise),
      // so this doesn't need per-persona scoping in the tool layer.
      description:
        'Get full detail for a single order by its id, including status history. Access is scoped to what the caller is allowed to see.',
      input_schema: {
        type: 'object',
        properties: {
          orderId: { type: 'string', description: 'The order id to look up.' },
        },
        required: ['orderId'],
      },
      personas: ['olivia', 'daniel', 'emma'],
      handler: async (input: { orderId: string }, ctx) =>
        orders.findOne(input.orderId, { sub: ctx.userId, role: ctx.role }),
    },
    {
      name: 'get_my_recent_orders',
      description:
        "Get the caller's own recent orders (never anyone else's). Always scoped server-side to the authenticated customer, regardless of what id is discussed in the conversation.",
      input_schema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max number of orders to return (default 10, max 25).' },
        },
      },
      personas: ['emma'],
      handler: async (input: { limit?: number }, ctx) => {
        const limit = Math.min(Math.max(input?.limit ?? 10, 1), 25);
        return orders.findAll({ sub: ctx.userId, role: UserRole.CUSTOMER }, 1, limit);
      },
    },
  ];
}
