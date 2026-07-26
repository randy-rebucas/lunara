import { PartnersService } from '../../partners/partners.service';
import { ToolSpec } from './types';

// Note: this is white-label branding/domain config (app name, logo, custom domain), a
// separate concept from the shop/order-facing "partner" data in admin.tools.ts
// (get_shops/get_shop_detail, backed by AdminService) — don't conflate the two when answering.
export function buildPartnerTools(partners: PartnersService): ToolSpec[] {
  return [
    {
      name: 'list_partner_brand_configs',
      description:
        'List all white-label brand configurations (app name, logo, custom domain) for partners with a branded app. Not shop/order data — see get_shops for that.',
      input_schema: { type: 'object', properties: {} },
      personas: ['mia'],
      handler: async () => partners.listAll(),
    },
    {
      name: 'get_partner_brand_config',
      description:
        'Get a single white-label brand configuration by id (app name, logo, custom domain). Not shop/order data — see get_shop_detail for that.',
      input_schema: {
        type: 'object',
        properties: {
          partnerId: { type: 'string', description: 'The brand config id.' },
        },
        required: ['partnerId'],
      },
      personas: ['mia'],
      handler: async (input: { partnerId: string }) => partners.findById(input.partnerId),
    },
  ];
}
