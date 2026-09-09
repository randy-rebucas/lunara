const TIPS: string[] = [
  'Keep your inventory thresholds up to date so low-stock alerts actually warn you in time.',
  'Accept incoming orders promptly — partners who respond fast get more repeat bookings.',
  'Add all your active staff to branches so orders route to the right team automatically.',
  'Check your revenue page weekly to spot slow days and plan promos around them.',
  'Add branch details like service radius and max active orders to avoid overbooking a shop.',
  'A complete shop profile (name, phone) helps customers and support reach you faster.',
  'Review low-stock items before they run out — some services auto-deduct stock per order.',
  'Assign a default pickup/delivery rider per branch to speed up dispatch.',
  'Use the settlements page to reconcile payouts against completed orders each cycle.',
  'Update order statuses as work moves through each step so customers see live progress.',
];

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function getDailyTip(date: Date = new Date()): string {
  const index = dayOfYear(date) % TIPS.length;
  return TIPS[index];
}
