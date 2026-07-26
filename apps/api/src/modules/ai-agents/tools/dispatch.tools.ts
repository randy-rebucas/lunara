import { AdminDispatchService } from '../../admin/admin-dispatch.service';
import { ToolSpec } from './types';

// Internal admin dispatch view — never exposed to the customer-facing persona (emma).
export function buildDispatchTools(dispatch: AdminDispatchService): ToolSpec[] {
  return [
    {
      name: 'get_dispatch_dashboard',
      description:
        'Get the live dispatch dashboard: incoming orders needing a rider, shop capacity board, and rider availability board.',
      input_schema: { type: 'object', properties: {} },
      personas: ['olivia', 'daniel'],
      handler: async () => dispatch.getDispatchDashboard(),
    },
  ];
}
