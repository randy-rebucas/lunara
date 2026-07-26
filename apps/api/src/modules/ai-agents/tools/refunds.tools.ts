import { RefundsService } from '../../refunds/refunds.service';
import { ToolSpec } from './types';

export function buildRefundTools(refunds: RefundsService): ToolSpec[] {
  return [
    {
      name: 'get_my_refunds',
      description: "List the caller's own refund requests. Always scoped server-side to the authenticated user.",
      input_schema: { type: 'object', properties: {} },
      personas: ['emma'],
      handler: async (_input: unknown, ctx) => refunds.listCustomerRefunds(ctx.userId),
    },
    {
      name: 'get_my_refund_detail',
      description: "Get detail + timeline for one of the caller's own refund requests by id.",
      input_schema: {
        type: 'object',
        properties: {
          refundId: { type: 'string', description: 'The refund request id.' },
        },
        required: ['refundId'],
      },
      personas: ['emma'],
      handler: async (input: { refundId: string }, ctx) => refunds.getCustomerRefund(ctx.userId, input.refundId),
    },
    {
      name: 'list_admin_refunds',
      description: 'List refund requests across all customers, with status counts, for finance review.',
      input_schema: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Optional exact refund status to filter by.' },
        },
      },
      personas: ['benjamin'],
      handler: async (input: { status?: string }) => refunds.listAdminRefunds(input?.status),
    },
    {
      name: 'get_admin_refund',
      description: 'Get full detail (order, payment, verification checks) for a refund request by id.',
      input_schema: {
        type: 'object',
        properties: {
          refundId: { type: 'string', description: 'The refund request id.' },
        },
        required: ['refundId'],
      },
      personas: ['benjamin'],
      handler: async (input: { refundId: string }) => refunds.getAdminRefund(input.refundId),
    },
  ];
}
