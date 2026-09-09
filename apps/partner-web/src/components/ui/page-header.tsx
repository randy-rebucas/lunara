'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { TourStep } from '../../lib/app-tour';
import { useAppTour } from '../../hooks/use-app-tour';

/** Extra, page-specific stops appended after the shared nav/title/actions steps. */
export interface PageTourStep {
  /** CSS selector for the element to highlight, e.g. `[data-tour="orders-table"]`. */
  element: string;
  title: string;
  description: string;
}

function TourButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-slate-100 hover:text-primary"
      aria-label="Take a tour of this page"
      title="Take a tour of this page"
    >
      <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 17.25h.008v.008H12v-.008zM12 21a9 9 0 100-18 9 9 0 000 18z" />
      </svg>
    </button>
  );
}

export function PageHeader({
  title,
  description,
  backHref,
  backLabel = 'Back',
  badge,
  actions,
  tourSteps,
}: {
  title: string;
  description?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  /** Optional page-specific stops added to the standard nav/title/actions tour for this page. */
  tourSteps?: PageTourStep[];
}) {
  const pathname = usePathname();

  const baseDescription =
    typeof description === 'string' ? description : `Explore the tools available on the ${title} page.`;

  const steps: TourStep[] = [
    {
      element: '[data-tour-id="sidebar-nav"]',
      popover: {
        title: 'Navigation',
        description: 'Jump between sections of your shop from here at any time.',
        side: 'right',
      },
    },
    {
      element: '[data-tour-id="page-title"]',
      popover: {
        title,
        description: baseDescription,
        side: 'bottom',
      },
    },
    ...(tourSteps ?? []).map((step) => ({
      element: step.element,
      popover: { title: step.title, description: step.description, side: 'bottom' as const },
    })),
    {
      element: '[data-tour-id="header-actions"]',
      popover: {
        title: 'Notifications & account',
        description: 'Check notifications and manage your profile or shop settings here.',
        side: 'bottom',
      },
    },
  ];

  const { start } = useAppTour(`page:${pathname}`, steps);

  return (
    <header className="mb-8">
      {backHref && (
        <Link
          href={backHref}
          className="mb-3 inline-flex items-center text-sm text-muted transition-colors hover:text-primary"
        >
          ← {backLabel}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3" data-tour-id="page-title">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
            {badge}
            <TourButton onClick={start} />
          </div>
          {description && (
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
