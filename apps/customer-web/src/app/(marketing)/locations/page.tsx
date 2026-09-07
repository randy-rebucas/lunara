import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { Building2, MapPin, Sparkles } from 'lucide-react';
import { appConfig } from '@lunara/config';
import { resolveApiV1BaseUrl } from '@lunara/hooks';
import { resolveMediaUrl } from '@lunara/utils';
import { MarketingShell } from '../../../components/marketing/marketing-shell';
import {
  MarketingBackLink,
  MarketingCtaPanel,
  MarketingHeroGlow,
  MarketingSectionIcon,
  MarketingStatRow,
} from '../../../components/marketing/marketing-design';
import {
  EXPANDING_AREAS,
  fetchActiveServiceAreas,
  groupServiceAreasByPartner,
} from '../../../components/marketing/home-page-data';
import { MarketingActions } from '../../../components/marketing/marketing-actions';
import { ButtonLink } from '../../../components/ui/button-link';
import { buildPageMetadata } from '../../../lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'Laundry service areas in Metro Manila',
  description: `See where ${appConfig.name} offers laundry pickup and delivery in Metro Manila — live branches, coverage radius, and expanding areas.`,
  path: '/locations',
});

export default async function LocationsPage() {
  const apiBase = resolveApiV1BaseUrl(process.env.NEXT_PUBLIC_API_URL);
  const host = (await headers()).get('host') ?? undefined;
  const serviceAreas = await fetchActiveServiceAreas(apiBase, host);

  const cityCount = new Set(serviceAreas.map((b) => b.city)).size;
  const avgRadius =
    serviceAreas.length > 0
      ? Math.round(serviceAreas.reduce((sum, b) => sum + b.radiusKm, 0) / serviceAreas.length)
      : 0;

  return (
    <MarketingShell>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden border-b border-border/40 bg-surface/60">
        <MarketingHeroGlow />
        <div className="marketing-container relative py-12 text-center sm:py-16">
          <span className="badge-primary">Metro Manila</span>
          <h1 className="mx-auto mt-4 max-w-2xl text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Service locations
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-muted">
            Lunara partner branches and pickup zones across Metro Manila. Enter your address when
            booking to confirm coverage.
          </p>

          <MarketingStatRow
            className="mx-auto mt-8 max-w-md"
            align="center"
            stats={[
              { icon: Building2, label: `${serviceAreas.length} active ${serviceAreas.length === 1 ? 'branch' : 'branches'}` },
              { icon: MapPin, label: `${cityCount} ${cityCount === 1 ? 'city' : 'cities'} covered` },
              { icon: Sparkles, label: `~${avgRadius} km avg. radius` },
            ]}
          />
        </div>
      </section>

      {/* ── Body ── */}
      <section className="marketing-container py-12 sm:py-16">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {groupServiceAreasByPartner(serviceAreas).map((partner) => {
            const primary = partner.branches[0];
            const logoUrl = resolveMediaUrl(primary.logoUrl, process.env.NEXT_PUBLIC_API_URL);
            const isSingleBranch = partner.branches.length === 1;

            return (
              <div key={partner.partnerId} className="card flex h-full flex-col">
                <div className="card-body flex flex-1 flex-col">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 text-primary">
                      {logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logoUrl} alt={`${partner.partnerName} logo`} className="h-full w-full object-cover" />
                      ) : (
                        <Building2 className="h-5 w-5" aria-hidden />
                      )}
                    </div>
                    <div className="min-w-0">
                      {isSingleBranch ? <span className="badge-primary w-fit">{primary.province}</span> : null}
                      <h3 className="mt-1 truncate text-lg font-semibold text-slate-900">
                        {partner.partnerName}
                      </h3>
                    </div>
                  </div>

                  {isSingleBranch ? (
                    <>
                      <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{primary.area}</p>
                      <Link
                        href={`/service-areas/${primary.id}`}
                        className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary"
                      >
                        <MapPin className="h-3.5 w-3.5" aria-hidden />
                        ~{primary.radiusKm} km service radius
                      </Link>
                    </>
                  ) : (
                    <ul className="mt-3 flex-1 space-y-3">
                      {partner.branches.map((branch) => (
                        <li key={branch.id} className="border-t border-border/40 pt-3 first:border-t-0 first:pt-0">
                          <Link
                            href={`/service-areas/${branch.id}`}
                            className="group block rounded-lg -m-1 p-1 transition hover:bg-surface-muted"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-sm font-semibold text-slate-900 group-hover:text-primary">
                                {branch.name}
                              </span>
                              <span className="badge-primary shrink-0">{branch.province}</span>
                            </div>
                            <p className="mt-1 text-sm leading-relaxed text-muted">{branch.area}</p>
                            <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                              <MapPin className="h-3.5 w-3.5" aria-hidden />
                              ~{branch.radiusKm} km service radius
                            </p>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="card mt-10">
          <div className="card-body text-center sm:text-left">
            <div className="flex justify-center sm:justify-start">
              <MarketingSectionIcon icon={Sparkles} title="Expanding soon" />
            </div>
            <p className="mt-3 text-sm text-muted">
              We are growing across the Philippines. These areas are on our roadmap — join the
              waitlist by booking with your address or contacting support.
            </p>
            <ul className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
              {EXPANDING_AREAS.map((city) => (
                <li
                  key={city}
                  className="rounded-full bg-surface-muted px-3 py-1.5 text-sm text-slate-700 ring-1 ring-border/60"
                >
                  {city}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <MarketingCtaPanel
          className="mt-10"
          title="Check coverage at your address"
          description="Availability depends on your pin location and nearest active branch. Sign up and add your address to see if pickup and delivery are available today."
          align="center"
        >
          <MarketingActions align="center" gap="loose">
            <ButtonLink href="/signup" size="lg" layout="responsive">
              Check my address
            </ButtonLink>
            <ButtonLink href="/signup" variant="outline" size="lg" layout="responsive">
              Book laundry
            </ButtonLink>
          </MarketingActions>
        </MarketingCtaPanel>

        <MarketingBackLink />
      </section>
    </MarketingShell>
  );
}
