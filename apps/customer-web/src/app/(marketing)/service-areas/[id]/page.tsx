import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Building2, Layers, MapPin, ShieldCheck, Users } from 'lucide-react';
import { appConfig } from '@lunara/config';
import { resolveApiV1BaseUrl } from '@lunara/hooks';
import { resolveMediaUrl } from '@lunara/utils';
import { cn } from '@lunara/ui';
import { MarketingShell } from '../../../../components/marketing/marketing-shell';
import {
  MarketingBackLink,
  MarketingCtaPanel,
  MarketingFeatureCard,
  MarketingHeroGlow,
  MarketingSectionIcon,
  MarketingStatRow,
} from '../../../../components/marketing/marketing-design';
import { fetchServiceAreaById } from '../../../../components/marketing/home-page-data';
import { AvatarWithFallback } from '../../../../components/marketing/avatar-card';
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

  const logoUrl = resolveMediaUrl(branch.logoUrl, process.env.NEXT_PUBLIC_API_URL);
  const hasOwner = !!(branch.owner?.displayName || branch.owner?.avatarUrl);
  const hasStaff = !!branch.staff?.length;
  const hasSiblings = !!branch.branches?.length;

  return (
    <MarketingShell>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden border-b border-border/40 bg-surface/60">
        <MarketingHeroGlow />
        <div className="marketing-container relative py-12 sm:py-16">
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-border/60 sm:h-24 sm:w-24">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={`${branch.name} logo`} className="h-full w-full object-cover" />
              ) : (
                <Building2 className="h-8 w-8 text-primary/60" aria-hidden />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge-primary">{branch.province}</span>
                <span className="inline-flex items-center gap-1 text-sm text-muted">
                  <MapPin className="h-3.5 w-3.5" aria-hidden />
                  {branch.city}
                </span>
              </div>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                {branch.name}
              </h1>
              <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted">
                Serving {branch.area}. Enter your address when booking to confirm coverage.
              </p>

              <MarketingStatRow
                className="mt-5"
                stats={[
                  { icon: MapPin, label: `~${branch.radiusKm} km service radius` },
                  ...(hasStaff
                    ? [
                        {
                          icon: Users,
                          label: `${branch.staff!.length} team ${branch.staff!.length === 1 ? 'member' : 'members'}`,
                        },
                      ]
                    : []),
                  ...(hasSiblings
                    ? [
                        {
                          icon: Building2,
                          label: `${branch.branches!.length} other ${branch.branches!.length === 1 ? 'branch' : 'branches'}`,
                        },
                      ]
                    : []),
                ]}
              />

              <div className="mt-6">
                <MarketingActions gap="loose">
                  <ButtonLink href="/signup" size="lg" layout="responsive">
                    Book laundry
                  </ButtonLink>
                  <ButtonLink href="/locations" variant="outline" size="lg" layout="responsive">
                    View all locations
                  </ButtonLink>
                </MarketingActions>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Body ── */}
      <section className="marketing-container py-12 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
          {/* Main column */}
          <div className="min-w-0 space-y-10">
            {branch.machines && branch.machines.length > 0 ? (
              <div>
                <MarketingSectionIcon icon={Layers} title="Machines & services" />
                <div className="card mt-4">
                  <div className="card-body">
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
                  </div>
                </div>
              </div>
            ) : null}

            {hasStaff ? (
              <div>
                <MarketingSectionIcon icon={Users} title="Meet the team" />
                <div className="card mt-4">
                  <div className="card-body">
                    <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
                      {branch.staff!.map((member, index) => (
                        <div
                          key={`${member.displayName}-${index}`}
                          className="flex flex-col items-center gap-3 text-center"
                        >
                          <AvatarWithFallback name={member.displayName} avatarUrl={member.avatarUrl} size="lg" />
                          <p className="text-sm font-medium text-slate-900">{member.displayName}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {hasSiblings ? (
              <div>
                <MarketingSectionIcon icon={Building2} title="Other branches" />
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {branch.branches!.map((sibling) => (
                    <MarketingFeatureCard
                      key={sibling.id}
                      href={`/service-areas/${sibling.id}`}
                      badge={sibling.province}
                      title={sibling.name}
                      subtitle={sibling.city}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            <MarketingCtaPanel
              title="Book laundry with this partner"
              description="Availability depends on your pin location and nearest active branch. Sign up and add your address to see if pickup and delivery are available today."
              layout="split"
            >
              <MarketingActions gap="loose">
                <ButtonLink href="/signup" size="lg" layout="responsive">
                  Book laundry
                </ButtonLink>
              </MarketingActions>
            </MarketingCtaPanel>

            <MarketingBackLink href="/locations" label="← Back to service areas" />
          </div>

          {/* Sidebar */}
          <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <div className="card">
              <div className="card-body">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Coverage</p>
                <div className="mt-3 flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <MapPin className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">~{branch.radiusKm} km radius</p>
                    <p className="text-xs text-muted">{branch.area}</p>
                  </div>
                </div>
              </div>
            </div>

            {hasOwner ? (
              <div className="card">
                <div className="card-body">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                    Business owner
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <AvatarWithFallback
                      name={branch.owner!.displayName}
                      avatarUrl={branch.owner!.avatarUrl}
                      size="md"
                    />
                    <p className="font-medium text-slate-900">{branch.owner!.displayName ?? 'Shop owner'}</p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className={cn('card-elevated overflow-hidden')}>
              <div className="card-body bg-gradient-to-br from-primary/8 via-surface to-primary/5 text-center">
                <p className="text-sm font-semibold text-slate-900">Ready to book?</p>
                <p className="mt-1 text-xs text-muted">
                  Confirm coverage at your address in under a minute.
                </p>
                <ButtonLink href="/signup" size="default" layout="responsive" className="mt-4 w-full">
                  Book laundry
                </ButtonLink>
              </div>
            </div>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
