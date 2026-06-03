export interface AvailabilityErrorAddress {
  label?: string;
  line1?: string;
  city?: string;
}

export function formatAvailabilityLoadError(
  err: unknown,
  address?: AvailabilityErrorAddress | null,
): string {
  const apiMessage = err instanceof Error ? err.message.trim() : '';
  const addressName = address?.label?.trim() || address?.line1?.trim() || 'this address';
  const addressHint = address?.city ? ` in ${address.city}` : '';

  if (!apiMessage) {
    return `We could not load pickup times, services, or partner coverage for ${addressName}${addressHint}. Check your internet connection and try again. If it keeps failing, update the address in Profile or contact support.`;
  }

  if (apiMessage === 'Address not found') {
    return 'That saved address could not be found. Choose another pickup address or add a new one in Profile.';
  }

  if (apiMessage.includes('Session expired')) {
    return apiMessage;
  }

  if (
    apiMessage.includes('Street address') ||
    apiMessage.includes('City is required') ||
    apiMessage.includes('Province is required') ||
    apiMessage.includes('postal code')
  ) {
    return `${apiMessage} Open Profile → Addresses, edit ${addressName}, then try booking again.`;
  }

  if (
    apiMessage.includes('not available in your area') ||
    apiMessage.includes('Metro Manila')
  ) {
    return `${apiMessage} You can still request pickup in your area from the schedule step.`;
  }

  if (apiMessage.includes('Select a pickup address')) {
    return 'Select a pickup address to see pickup times, services, and partner coverage for your area.';
  }

  if (apiMessage.includes('Request failed') || apiMessage.startsWith('API error')) {
    return `We could not reach Lunara to check availability for ${addressName}${addressHint}. Check your connection and try again.`;
  }

  return `Could not check availability for ${addressName}${addressHint}: ${apiMessage}`;
}
