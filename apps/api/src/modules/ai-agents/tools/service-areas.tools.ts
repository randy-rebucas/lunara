import { ServiceAreasService } from '../../service-areas/service-areas.service';
import { ToolSpec } from './types';

export function buildServiceAreaTools(serviceAreas: ServiceAreasService): ToolSpec[] {
  return [
    {
      name: 'list_service_areas',
      description: 'List configured service (coverage) areas.',
      input_schema: {
        type: 'object',
        properties: {
          activeOnly: { type: 'boolean', description: 'If true, only list currently active areas (default false).' },
        },
      },
      personas: ['daniel'],
      handler: async (input: { activeOnly?: boolean }) =>
        input?.activeOnly ? serviceAreas.listActive() : serviceAreas.listAll(),
    },
  ];
}
