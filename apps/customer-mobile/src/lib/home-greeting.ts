export function getTimeOfDayGreeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function getDisplayName(input: {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}): string {
  const name = [input.firstName, input.lastName].filter(Boolean).join(' ').trim();
  if (name) return name.split(' ')[0] ?? name;
  if (input.email) return input.email.split('@')[0] ?? 'there';
  if (input.phone) return input.phone;
  return 'there';
}
