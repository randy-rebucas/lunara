import { UserRole } from '@lunara/types';
import { BranchesService } from '../../branches/branches.service';
import { PartnerOperationsService } from '../../partner/partner-operations.service';
import { ToolSpec } from './types';

export function buildPartnerAssistantTools(
  operations: PartnerOperationsService,
  branches: BranchesService,
): ToolSpec[] {
  return [
    {
      name: 'get_my_revenue',
      description:
        "Get the caller's own shop revenue breakdown — today/week/month/all-time gross revenue and payout, daily trend, and recent completed orders. Always scoped server-side to the authenticated partner.",
      input_schema: { type: 'object', properties: {} },
      personas: ['lina'],
      handler: async (_input: unknown, ctx) => operations.getRevenue(ctx.userId, ctx.role as UserRole),
    },
    {
      name: 'get_my_branches',
      description: "Get the caller's own list of shop branches (name, code, city, branch type).",
      input_schema: { type: 'object', properties: {} },
      personas: ['lina'],
      handler: async (_input: unknown, ctx) => branches.listBranchesForPartner(ctx.userId),
    },
    {
      name: 'get_my_invoices',
      description:
        "Get the caller's own billing history — weekly invoices from Lunara covering commission, fronted rider costs, subscription fees, amount due, and paid/pending status.",
      input_schema: { type: 'object', properties: {} },
      personas: ['lina'],
      handler: async (_input: unknown, ctx) => operations.getInvoices(ctx.userId, ctx.role as UserRole),
    },
  ];
}
