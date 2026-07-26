import { PartnersService } from '../../partners/partners.service';
import { ToolSpec } from './types';

export function buildPartnerTools(partners: PartnersService): ToolSpec[] {
  return [
    {
      name: 'list_partners',
      description: 'List all partner (laundry shop) accounts.',
      input_schema: { type: 'object', properties: {} },
      personas: ['mia'],
      handler: async () => partners.listAll(),
    },
    {
      name: 'get_partner',
      description: 'Get a single partner account by id.',
      input_schema: {
        type: 'object',
        properties: {
          partnerId: { type: 'string', description: 'The partner id.' },
        },
        required: ['partnerId'],
      },
      personas: ['mia'],
      handler: async (input: { partnerId: string }) => partners.findById(input.partnerId),
    },
  ];
}
