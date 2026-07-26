import { BookingService } from '../../booking/booking.service';
import { ToolSpec } from './types';

export function buildBookingTools(booking: BookingService): ToolSpec[] {
  return [
    {
      name: 'get_booking_config',
      description:
        'Get the static booking catalog: active services, add-ons, delivery fees, and service areas. Not customer-specific.',
      input_schema: { type: 'object', properties: {} },
      personas: ['emma'],
      handler: async () => booking.getConfig(),
    },
  ];
}
