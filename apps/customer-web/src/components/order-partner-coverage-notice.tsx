import type { PartnerCoverageInfo } from '@lunara/utils';

interface OrderPartnerCoverageNoticeProps {
  coverage?: PartnerCoverageInfo | null;
  className?: string;
}

export function OrderPartnerCoverageNotice({
  coverage,
  className = '',
}: OrderPartnerCoverageNoticeProps) {
  if (!coverage) return null;

  if (coverage.message) {
    return (
      <p
        className={`rounded-md bg-amber-50 px-2.5 py-2 text-xs leading-relaxed text-amber-900 ring-1 ring-amber-200/70 ${className}`}
        role="status"
      >
        {coverage.message}
      </p>
    );
  }

  if (coverage.inServiceArea && coverage.hasPartnerNearby) {
    return (
      <p
        className={`rounded-md bg-emerald-50 px-2.5 py-2 text-xs leading-relaxed text-emerald-900 ring-1 ring-emerald-200/70 ${className}`}
        role="status"
      >
        Partner laundry is available near your pickup address. Lunara will assign your shop after
        payment.
      </p>
    );
  }

  return null;
}
