'use client';

import { ALL_BRANCHES, useBranchContext } from '../lib/branch-context';

/** Global "active branch" selector shown in the portal header. Only rendered for PARTNER/ADMIN
 * users with more than one branch — staff are pinned to their assigned branch. Selecting a
 * branch here updates every page that reads from BranchContext, replacing the old per-page
 * local branch filters. */
export function BranchSwitcher() {
  const { branches, activeBranchId, setActiveBranchId, canSwitchBranch } = useBranchContext();

  if (!canSwitchBranch) return null;

  return (
    <select
      value={activeBranchId}
      onChange={(e) => setActiveBranchId(e.target.value)}
      className="ml-2 max-w-[10rem] truncate rounded-lg border border-border/60 bg-surface px-2 py-1.5 text-xs font-medium text-slate-700 sm:max-w-[14rem]"
      aria-label="Active branch"
    >
      <option value={ALL_BRANCHES}>All branches</option>
      {branches.map((b) => (
        <option key={b._id} value={b._id}>
          {b.name}
        </option>
      ))}
    </select>
  );
}
