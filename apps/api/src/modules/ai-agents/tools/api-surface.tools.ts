import { ApiSurfaceService } from './api-surface.service';
import { ToolSpec } from './types';

export function buildApiSurfaceTools(apiSurface: ApiSurfaceService): ToolSpec[] {
  return [
    {
      name: 'list_api_modules',
      description:
        'List the live set of registered NestJS modules/controllers and how many routes each exposes — introspected from the running app, not a static doc.',
      input_schema: { type: 'object', properties: {} },
      personas: ['noah'],
      handler: async () => apiSurface.listModules(),
    },
    {
      name: 'list_api_routes',
      description:
        'List the live set of registered API routes (method + path), optionally filtered by module name — introspected from the running app.',
      input_schema: {
        type: 'object',
        properties: {
          moduleFilter: {
            type: 'string',
            description: 'Optional substring to filter module names by (e.g. "orders", "riders").',
          },
        },
      },
      personas: ['noah'],
      handler: async (input: { moduleFilter?: string }) => apiSurface.listRoutes(input?.moduleFilter),
    },
  ];
}
