'use client';

import { getTodayScheduleSummary, type BranchHoliday } from '@lunara/utils';

interface BranchOption {
  branchId: string;
  name: string;
  city: string;
  distanceLabel: string;
  operatingHours: { isClosed: boolean; openTime: string; closeTime: string }[];
  holidays: BranchHoliday[];
  capacityAvailable: boolean;
  withinMaxDeliveryRadius: boolean;
}

interface BranchPickerModalProps {
  shopName: string;
  branches: BranchOption[];
  selectedBranchId: string;
  onSelect: (branchId: string) => void;
  onClose: () => void;
}

/** Lets a customer choose a specific branch when a partner has more than one location nearby —
 * mirrors mobile's BranchPickerSheet. Only rendered when a shop card is tapped and has >1 branch. */
export function BranchPickerModal({
  shopName,
  branches,
  selectedBranchId,
  onSelect,
  onClose,
}: BranchPickerModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/40 p-4 sm:items-center">
      <div className="absolute inset-0" aria-hidden onClick={onClose} />
      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-surface shadow-[var(--shadow-elevated)]">
        <div className="card-body">
          <h2 className="text-lg font-semibold text-slate-900">{shopName} — choose a branch</h2>
          <p className="mt-1 text-sm text-muted">
            This partner has {branches.length} branches near you.
          </p>
          <div className="list-stack mt-4">
            {branches.map((branch) => {
              const disabled = !branch.capacityAvailable || !branch.withinMaxDeliveryRadius;
              const schedule = getTodayScheduleSummary(branch.operatingHours, branch.holidays);
              const selected = branch.branchId === selectedBranchId;
              return (
                <button
                  key={branch.branchId}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelect(branch.branchId)}
                  className={`w-full rounded-lg bg-surface p-4 text-left ring-1 ring-border/50 transition-all hover:ring-border disabled:cursor-not-allowed disabled:opacity-40 ${
                    selected ? 'ring-2 ring-primary/30 bg-primary/5' : ''
                  }`}
                >
                  <p className="font-medium text-slate-900">{branch.name}</p>
                  <p className="mt-1 text-sm text-muted">
                    {branch.city} · {branch.distanceLabel}
                  </p>
                  <p className={`mt-1 text-xs font-medium ${schedule.isOpenNow ? 'text-accent' : 'text-muted'}`}>
                    {schedule.label}
                  </p>
                  {!branch.capacityAvailable && (
                    <p className="mt-1 text-xs text-amber-700">Currently at capacity</p>
                  )}
                  {!branch.withinMaxDeliveryRadius && (
                    <p className="mt-1 text-xs text-amber-700">Outside delivery range</p>
                  )}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full rounded-lg py-2 text-center text-sm font-medium text-muted hover:text-slate-900"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
