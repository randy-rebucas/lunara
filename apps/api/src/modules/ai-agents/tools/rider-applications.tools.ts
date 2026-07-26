import { RiderApplicationsService } from '../../rider-applications/rider-applications.service';
import { ToolSpec } from './types';

// Contains KYC document metadata for prospective riders — internal review use only.
export function buildRiderApplicationTools(applications: RiderApplicationsService): ToolSpec[] {
  return [
    {
      name: 'list_rider_applications',
      description: 'List rider applications, optionally filtered by status.',
      input_schema: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Optional exact application status to filter by.' },
        },
      },
      personas: ['mia'],
      handler: async (input: { status?: string }) => applications.list(input?.status),
    },
    {
      name: 'get_rider_application',
      description: 'Get full detail for a single rider application by id.',
      input_schema: {
        type: 'object',
        properties: {
          applicationId: { type: 'string', description: 'The application id.' },
        },
        required: ['applicationId'],
      },
      personas: ['mia'],
      handler: async (input: { applicationId: string }) => applications.findOne(input.applicationId),
    },
  ];
}
