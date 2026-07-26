import { SupportService } from '../../support/support.service';
import { ToolSpec } from './types';

export function buildSupportTools(support: SupportService): ToolSpec[] {
  return [
    {
      name: 'get_my_support_tickets',
      description: "List the caller's own support tickets. Always scoped server-side to the authenticated user.",
      input_schema: { type: 'object', properties: {} },
      personas: ['emma'],
      handler: async (_input: unknown, ctx) => support.listCustomerTickets(ctx.userId),
    },
    {
      name: 'get_my_support_ticket_detail',
      description: "Get detail for one of the caller's own support tickets by id.",
      input_schema: {
        type: 'object',
        properties: {
          ticketId: { type: 'string', description: 'The support ticket id.' },
        },
        required: ['ticketId'],
      },
      personas: ['emma'],
      handler: async (input: { ticketId: string }, ctx) => support.getCustomerTicket(ctx.userId, input.ticketId),
    },
    {
      name: 'list_support_tickets',
      description: 'List support tickets platform-wide, optionally filtered by status/type, with status counts.',
      input_schema: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Optional exact ticket status to filter by.' },
          type: { type: 'string', description: 'Optional exact ticket type to filter by.' },
        },
      },
      personas: ['olivia', 'aurora'],
      handler: async (input: { status?: string; type?: string }) => support.getTickets(input?.status, input?.type),
    },
    {
      name: 'get_support_ticket',
      description: 'Get full detail for any support ticket by id (admin/ops view).',
      input_schema: {
        type: 'object',
        properties: {
          ticketId: { type: 'string', description: 'The support ticket id.' },
        },
        required: ['ticketId'],
      },
      personas: ['olivia'],
      handler: async (input: { ticketId: string }) => support.getTicket(input.ticketId),
    },
    {
      name: 'get_ticket_investigation',
      description: 'Get the lost-item investigation bundle for a ticket (only valid for lost-item tickets).',
      input_schema: {
        type: 'object',
        properties: {
          ticketId: { type: 'string', description: 'The support ticket id.' },
        },
        required: ['ticketId'],
      },
      personas: ['olivia'],
      handler: async (input: { ticketId: string }) => support.getInvestigation(input.ticketId),
    },
  ];
}
