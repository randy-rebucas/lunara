import { RidersService } from '../../riders/riders.service';
import { ToolSpec } from './types';

export function buildRiderTools(riders: RidersService): ToolSpec[] {
  return [
    {
      name: 'get_rider_profile',
      description:
        "Get a rider's profile, vehicle, KYC documents, and compliance status, for dispatch or partner-success review.",
      input_schema: {
        type: 'object',
        properties: {
          riderUserId: { type: 'string', description: 'The rider user id to look up.' },
        },
        required: ['riderUserId'],
      },
      personas: ['daniel', 'mia'],
      handler: async (input: { riderUserId: string }) => riders.getRiderProfileForAdmin(input.riderUserId),
    },
    {
      name: 'get_rider_tasks',
      description: "Get a rider's currently active pickup/delivery tasks.",
      input_schema: {
        type: 'object',
        properties: {
          riderUserId: { type: 'string', description: 'The rider user id to look up.' },
        },
        required: ['riderUserId'],
      },
      personas: ['daniel'],
      handler: async (input: { riderUserId: string }) => riders.getTasks(input.riderUserId),
    },
    {
      name: 'get_rider_performance',
      description: "Get a rider's performance metrics (completion rate, ratings, timeliness).",
      input_schema: {
        type: 'object',
        properties: {
          riderUserId: { type: 'string', description: 'The rider user id to look up.' },
        },
        required: ['riderUserId'],
      },
      personas: ['olivia', 'daniel'],
      handler: async (input: { riderUserId: string }) => riders.getPerformance(input.riderUserId),
    },
    {
      name: 'list_pending_rider_document_reviews',
      description: 'List rider KYC documents currently awaiting admin review.',
      input_schema: { type: 'object', properties: {} },
      personas: ['mia'],
      handler: async () => riders.listPendingDocumentReviews(),
    },
  ];
}
