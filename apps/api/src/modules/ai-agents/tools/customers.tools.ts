import { CustomersService } from '../../customers/customers.service';
import { ToolSpec } from './types';

export function buildCustomerTools(customers: CustomersService): ToolSpec[] {
  return [
    {
      name: 'get_my_profile',
      description: "Get the caller's own customer profile. Always scoped server-side to the authenticated user.",
      input_schema: { type: 'object', properties: {} },
      personas: ['emma'],
      handler: async (_input: unknown, ctx) => customers.getProfile(ctx.userId),
    },
    {
      name: 'get_my_onboarding_status',
      description: "Get the caller's own onboarding completion status (profile/address setup).",
      input_schema: { type: 'object', properties: {} },
      personas: ['emma'],
      handler: async (_input: unknown, ctx) => customers.getOnboardingStatus(ctx.userId),
    },
  ];
}
