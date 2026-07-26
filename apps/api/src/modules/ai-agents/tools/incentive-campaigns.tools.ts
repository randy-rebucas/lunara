import { IncentiveCampaignsService } from '../../incentive-campaigns/incentive-campaigns.service';
import { ToolSpec } from './types';

export function buildIncentiveCampaignTools(campaigns: IncentiveCampaignsService): ToolSpec[] {
  return [
    {
      name: 'list_incentive_campaigns',
      description: 'List rider incentive campaigns (bonus programs), admin-side.',
      input_schema: { type: 'object', properties: {} },
      personas: ['sophia'],
      handler: async () => campaigns.adminList(),
    },
  ];
}
