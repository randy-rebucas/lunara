import { PartnerApplicationsService } from '../../partner-applications/partner-applications.service';
import { ToolSpec } from './types';

export function buildPartnerApplicationTools(applications: PartnerApplicationsService): ToolSpec[] {
  return [
    {
      name: 'list_partner_applications',
      description: 'List partner (laundry shop) applications, optionally filtered by status.',
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
      name: 'get_partner_application',
      description: 'Get full detail for a single partner application by id.',
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
