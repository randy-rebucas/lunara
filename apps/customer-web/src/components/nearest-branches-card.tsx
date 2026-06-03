export interface NearestBranchRow {
  branchId: string;
  code: string;
  name: string;
  city: string;
  distanceLabel: string;
  capacityAvailable: boolean;
  withinRadius: boolean;
  isNearest?: boolean;
}

interface NearestBranchesCardProps {
  branches: NearestBranchRow[];
  note?: string;
}

export function NearestBranchesCard({ branches, note }: NearestBranchesCardProps) {
  if (branches.length === 0) return null;

  return (
    <div className="mt-4 rounded-lg bg-primary/5 p-4 ring-1 ring-primary/15">
      <p className="text-sm font-semibold text-primary">Lunara network near you</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Reference only — operations assigns your partner branch after payment.
      </p>
      {note ? <p className="mt-2 text-xs italic text-slate-600">{note}</p> : null}
      <ul className="mt-3 divide-y divide-primary/10">
        {branches.slice(0, 4).map((b) => (
          <li key={b.branchId} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
            <div className="min-w-0 text-left">
              <p className="text-sm font-medium text-slate-900">
                {b.name}
                {b.isNearest ? ' · nearest' : ''}
              </p>
              <p className="text-xs text-muted-foreground">
                {b.code} · {b.city} · {b.distanceLabel}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                b.capacityAvailable && b.withinRadius
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {b.capacityAvailable && b.withinRadius ? 'Available' : 'Limited'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
