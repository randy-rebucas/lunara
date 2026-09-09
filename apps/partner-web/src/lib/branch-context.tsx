'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useParams, useRouter, useSearchParams } from 'next/navigation';
import { UserRole } from '@lunara/types';
import { getPartnerToken, getPortalUser, listOwnBranches, type PartnerBranch } from './partner-api';

export const ALL_BRANCHES = 'all' as const;
const BRANCH_QUERY_PARAM = 'branch';

interface BranchContextValue {
  branches: PartnerBranch[];
  /** The currently active branch id, or 'all' to aggregate across every branch. */
  activeBranchId: string | typeof ALL_BRANCHES;
  setActiveBranchId: (id: string | typeof ALL_BRANCHES) => void;
  /** True when the signed-in user may switch branches (PARTNER/ADMIN with >1 branch). */
  canSwitchBranch: boolean;
  loading: boolean;
}

const BranchContext = createContext<BranchContextValue | null>(null);

function storageKey(slug: string) {
  return `lunara_active_branch_${slug}`;
}

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const { partnerSlug } = useParams<{ partnerSlug: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const branchFromUrl = searchParams.get(BRANCH_QUERY_PARAM);

  const [branches, setBranches] = useState<PartnerBranch[]>([]);
  const [activeBranchId, setActiveBranchIdState] = useState<string | typeof ALL_BRANCHES>(ALL_BRANCHES);
  const [loading, setLoading] = useState(true);

  const user = getPortalUser();
  const isStaff = user?.role === UserRole.STAFF;

  /** Writes the branch id into the ?branch= query param without a navigation/scroll reset, so
   * the current selection is shareable and survives a hard refresh. */
  const syncUrl = useCallback(
    (id: string | typeof ALL_BRANCHES) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id === ALL_BRANCHES) {
        params.delete(BRANCH_QUERY_PARAM);
      } else {
        params.set(BRANCH_QUERY_PARAM, id);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    let cancelled = false;
    if (!partnerSlug || !getPartnerToken()) {
      // Bare "/" root, or unauthenticated (login/signup/verify-email/offline) — nothing to fetch yet.
      setLoading(false);
      return;
    }
    if (isStaff) {
      // Staff are pinned to their own branch — no fetch, no switching.
      if (user?.branchId) setActiveBranchIdState(user.branchId);
      setLoading(false);
      return;
    }
    listOwnBranches()
      .then((list) => {
        if (cancelled) return;
        setBranches(list);
        const stored = typeof window !== 'undefined' ? localStorage.getItem(storageKey(partnerSlug)) : null;
        // The URL wins over the last-remembered branch, so a shared/bookmarked link is honored.
        const fromUrlIsValid = branchFromUrl && (branchFromUrl === ALL_BRANCHES || list.some((b) => b._id === branchFromUrl));
        const storedIsValid = stored && (stored === ALL_BRANCHES || list.some((b) => b._id === stored));
        if (fromUrlIsValid) {
          setActiveBranchIdState(branchFromUrl as string);
          if (typeof window !== 'undefined') localStorage.setItem(storageKey(partnerSlug), branchFromUrl as string);
        } else if (storedIsValid) {
          setActiveBranchIdState(stored as string);
        } else {
          const mainShop = list.find((b) => b.isMainShop);
          setActiveBranchIdState(mainShop?._id ?? list[0]?._id ?? ALL_BRANCHES);
        }
      })
      .catch(() => {
        if (!cancelled) setBranches([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerSlug, isStaff]);

  const setActiveBranchId = useCallback(
    (id: string | typeof ALL_BRANCHES) => {
      if (isStaff) return;
      setActiveBranchIdState(id);
      if (typeof window !== 'undefined') localStorage.setItem(storageKey(partnerSlug), id);
      syncUrl(id);
    },
    [partnerSlug, isStaff, syncUrl],
  );

  const value = useMemo<BranchContextValue>(
    () => ({
      branches,
      activeBranchId,
      setActiveBranchId,
      canSwitchBranch: !isStaff && branches.length > 1,
      loading,
    }),
    [branches, activeBranchId, setActiveBranchId, isStaff, loading],
  );

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}

export function useBranchContext() {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error('useBranchContext must be used within a BranchProvider');
  return ctx;
}
