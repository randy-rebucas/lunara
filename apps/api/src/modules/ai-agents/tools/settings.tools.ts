import { SettingsService } from '../../settings/settings.service';
import { ToolSpec } from './types';

export function buildSettingsTools(settings: SettingsService): ToolSpec[] {
  return [
    {
      name: 'get_fee_settings',
      description: 'Get current delivery fee and rider pickup/delivery fee configuration.',
      input_schema: { type: 'object', properties: {} },
      personas: ['benjamin'],
      handler: async () => {
        const [deliveryFee, riderFees] = await Promise.all([
          settings.getDeliveryFeeSettings(),
          settings.getRiderFeeSettings(),
        ]);
        return { deliveryFee: deliveryFee.data, riderFees: riderFees.data };
      },
    },
    {
      name: 'get_automation_settings',
      description: 'Get current operational automation flags (auto-dispatch, auto-assign, auto-approve, etc).',
      input_schema: { type: 'object', properties: {} },
      personas: ['olivia'],
      handler: async () => settings.getAutomationSettings(),
    },
  ];
}
