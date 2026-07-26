import { BannersService } from '../../banners/banners.service';
import { ToolSpec } from './types';

export function buildBannerTools(banners: BannersService): ToolSpec[] {
  return [
    {
      name: 'list_banners',
      description: 'List in-app promotional banners (admin view: includes inactive banners).',
      input_schema: { type: 'object', properties: {} },
      personas: ['sophia'],
      handler: async () => banners.adminList(),
    },
  ];
}
