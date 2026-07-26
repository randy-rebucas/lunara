import { BranchesService } from '../../branches/branches.service';
import { BranchManagementService } from '../../branches/branch-management.service';
import { ToolSpec } from './types';

export function buildBranchTools(
  branches: BranchesService,
  branchManagement: BranchManagementService,
): ToolSpec[] {
  return [
    {
      name: 'list_branches',
      description: 'List all branches (shops).',
      input_schema: { type: 'object', properties: {} },
      personas: ['olivia'],
      handler: async () => branches.listBranches(),
    },
    {
      name: 'get_branch_network',
      description: 'Get the branch hierarchy tree (HQ, parent/child branch structure).',
      input_schema: { type: 'object', properties: {} },
      personas: ['olivia'],
      handler: async () => branchManagement.getNetworkTree(),
    },
    {
      name: 'get_branch_profile',
      description: 'Get a single branch\'s profile: manager, staff, parent/children, active order load, and metrics.',
      input_schema: {
        type: 'object',
        properties: {
          branchId: { type: 'string', description: 'The branch id to look up.' },
        },
        required: ['branchId'],
      },
      personas: ['olivia', 'daniel'],
      handler: async (input: { branchId: string }) => branchManagement.getBranchProfile(input.branchId),
    },
    {
      name: 'get_dispatch_queue',
      description: 'Get the shop-dispatch queue: orders pending assignment to a partner shop.',
      input_schema: { type: 'object', properties: {} },
      personas: ['daniel'],
      handler: async () => branches.getDispatchQueue(),
    },
    {
      name: 'get_dispatch_suggestions',
      description: 'Get shop-assignment suggestions for a pending-dispatch order (candidate branches and why).',
      input_schema: {
        type: 'object',
        properties: {
          orderId: { type: 'string', description: 'The order id to get shop suggestions for.' },
        },
        required: ['orderId'],
      },
      personas: ['daniel'],
      handler: async (input: { orderId: string }) => branches.getDispatchSuggestions(input.orderId),
    },
  ];
}
