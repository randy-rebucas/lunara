import { BranchesService } from '../../branches/branches.service';
import { ToolSpec } from './types';

/**
 * Tools safe to expose to unauthenticated guests — backed only by the same marketing-safe,
 * no-auth data already served at /public/branches (no account/order/payment access).
 */
export function buildGuestTools(branches: BranchesService): ToolSpec[] {
  return [
    {
      name: 'list_service_areas',
      description:
        'List Lunara branches/locations that are live for the public (city, province, service radius) — use this to answer "what areas do you serve" or "is there a branch near me".',
      input_schema: { type: 'object', properties: {} },
      personas: ['emma'],
      guestSafe: true,
      handler: async () => branches.listPublicBranches(),
    },
    {
      name: 'get_branch_detail',
      description: 'Get public detail for a single branch by id (from list_service_areas results).',
      input_schema: {
        type: 'object',
        properties: {
          branchId: { type: 'string', description: 'The branch id from list_service_areas.' },
        },
        required: ['branchId'],
      },
      personas: ['emma'],
      guestSafe: true,
      handler: async (input: { branchId: string }) => branches.getPublicBranchById(input.branchId),
    },
  ];
}
