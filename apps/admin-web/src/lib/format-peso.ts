export function formatPeso(amount: number, compact = false) {
  if (compact && amount >= 1000) {
    return `₱${(amount / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}k`;
  }
  return `₱${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function formatPesoWhole(amount: number) {
  return `₱${Math.round(amount).toLocaleString()}`;
}

export function formatChartDay(isoDate: string) {
  const d = new Date(`${isoDate}T12:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'short' });
}
