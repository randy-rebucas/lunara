import { AddressesService } from '../../addresses/addresses.service';
import { ToolSpec } from './types';

export function buildAddressTools(addresses: AddressesService): ToolSpec[] {
  return [
    {
      name: 'get_my_addresses',
      description: "List the caller's own saved addresses. Always scoped server-side to the authenticated user.",
      input_schema: { type: 'object', properties: {} },
      personas: ['emma'],
      handler: async (_input: unknown, ctx) => addresses.findAll(ctx.userId),
    },
  ];
}
