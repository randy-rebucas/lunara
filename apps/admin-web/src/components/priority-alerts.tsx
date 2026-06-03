import Link from 'next/link';

export type PriorityAlert = {
  label: string;
  href: string;
  tone: 'amber' | 'red' | 'primary';
};

const toneClass: Record<PriorityAlert['tone'], string> = {
  amber: 'border-amber-200/80 bg-amber-50/60 text-amber-950',
  red: 'border-red-200/80 bg-red-50/60 text-red-950',
  primary: 'border-primary/20 bg-primary/5 text-primary',
};

export function PriorityAlerts({ items }: { items: PriorityAlert[] }) {
  if (items.length === 0) return null;

  return (
    <ul className="mb-8 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      {items.map((item) => (
        <li key={item.href + item.label}>
          <Link
            href={item.href}
            className={`inline-flex rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors hover:opacity-90 ${toneClass[item.tone]}`}
          >
            {item.label} →
          </Link>
        </li>
      ))}
    </ul>
  );
}
