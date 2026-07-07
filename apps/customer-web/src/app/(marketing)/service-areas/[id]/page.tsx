import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { appConfig } from '@lunara/config';
import { resolveApiV1BaseUrl } from '@lunara/hooks';
import { MarketingContentPage } from '../../../../components/marketing/marketing-content-page';
import {
  MarketingBackLink,
  MarketingCtaPanel,
  MarketingInfoCard,
} from '../../../../components/marketing/marketing-design';
import { fetchServiceAreaById } from '../../../../components/marketing/home-page-data';
import { MarketingActions } from '../../../../components/marketing/marketing-actions';
import { ButtonLink } from '../../../../components/ui/button-link';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const apiBase = resolveApiV1BaseUrl(process.env.NEXT_PUBLIC_API_URL);
  const branch = await fetchServiceAreaById(apiBase, id);
  if (!branch) {
    return { title: `Laundry partner — ${appConfig.name}` };
  }
  return {
    title: `${branch.name} — ${appConfig.name}`,
    description: `Laundry pickup and delivery coverage for ${branch.area}, serviced by ${branch.name}.`,
  };
}

export default async function ServiceAreaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const apiBase = resolveApiV1BaseUrl(process.env.NEXT_PUBLIC_API_URL);
  const branch = await fetchServiceAreaById(apiBase, id);

  if (!branch) {
    notFound();
  }

  return (
    <MarketingContentPage
      badge={branch.province}
      title={branch.name}
      description={`Serving ${branch.area}. Enter your address when booking to confirm coverage.`}
    >
      {branch.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={branch.logoUrl}
          alt={`${branch.name} logo`}
          className="mb-6 h-16 w-16 rounded-lg object-cover ring-1 ring-border/60"
        />
      ) : null}

      <MarketingInfoCard title="Coverage">
        <p className="text-sm leading-relaxed text-muted">
          Approx. <strong>{branch.radiusKm} km</strong> service radius from this branch, covering{' '}
          {branch.area}.
        </p>
      </MarketingInfoCard>

      {branch.machines && branch.machines.length > 0 ? (
        <MarketingInfoCard title="Machines & services" className="mt-6">
          <ul className="flex flex-wrap gap-2">
            {branch.machines.map((machine, index) => (
              <li
                key={`${machine.label}-${index}`}
                className="rounded-full bg-surface-muted px-3 py-1.5 text-sm text-slate-700 ring-1 ring-border/60"
              >
                {machine.label} · {machine.machineType}
              </li>
            ))}
          </ul>
        </MarketingInfoCard>
      ) : null}

      <MarketingCtaPanel
        className="mt-10"
        title="Book laundry with this partner"
        description="Availability depends on your pin location and nearest active branch. Sign up and add your address to see if pickup and delivery are available today."
        align="center"
      >
        <MarketingActions align="center" gap="loose">
          <ButtonLink href="/signup" size="lg" layout="responsive">
            Book laundry
          </ButtonLink>
          <ButtonLink href="/locations" variant="outline" size="lg" layout="responsive">
            View all locations
          </ButtonLink>
        </MarketingActions>
      </MarketingCtaPanel>

      <MarketingBackLink href="/locations" label="← Back to service areas" />
    </MarketingContentPage>
  );
}
