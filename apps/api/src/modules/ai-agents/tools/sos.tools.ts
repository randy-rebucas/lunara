import { RiderSosService } from '../../sos/rider-sos.service';
import { ToolSpec } from './types';

// Rider safety incidents contain live location/PII of a specific rider — internal ops only,
// never appropriate for the customer-facing persona (emma).
export function buildSosTools(sos: RiderSosService): ToolSpec[] {
  return [
    {
      name: 'list_active_sos_incidents',
      description: 'List currently active rider SOS incidents, including live location if being shared.',
      input_schema: { type: 'object', properties: {} },
      personas: ['olivia', 'daniel'],
      handler: async () => sos.listActiveIncidents(),
    },
  ];
}
