import { useEffect, useState } from 'react';
import { partnerFetch } from '../api';
import { useAuthStore } from '../store/auth';

export interface OwnBranch {
  id: string;
  name: string;
  city: string;
  province: string;
}

/** Resolves the branch the signed-in staff member is assigned to, from their `branchId`. */
export function useOwnBranch() {
  const branchId = useAuthStore((s) => s.user?.branchId);
  const [branch, setBranch] = useState<OwnBranch | null>(null);
  const [loading, setLoading] = useState(Boolean(branchId));

  useEffect(() => {
    if (!branchId) {
      setBranch(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    partnerFetch<OwnBranch>(`/public/branches/${branchId}`)
      .then((data) => {
        if (!cancelled) setBranch(data);
      })
      .catch(() => {
        if (!cancelled) setBranch(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [branchId]);

  return { branch, loading };
}
