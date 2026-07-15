import type { MetadataRoute } from 'next';
import { resolveApiV1BaseUrl } from '@lunara/hooks';
import { fetchActiveServiceAreas } from '../components/marketing/home-page-data';
import { absoluteUrl } from '../lib/seo';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  type ChangeFrequency = NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>;
  const staticRouteDefs: [path: string, changeFrequency: ChangeFrequency, priority: number][] = [
    ['/', 'weekly', 1],
    ['/locations', 'weekly', 0.8],
    ['/faq', 'monthly', 0.7],
    ['/partners', 'monthly', 0.7],
    ['/riders', 'monthly', 0.7],
    ['/partners/apply', 'monthly', 0.5],
    ['/riders/apply', 'monthly', 0.5],
    ['/signup', 'monthly', 0.6],
    ['/privacy', 'yearly', 0.2],
  ];
  const staticRoutes: MetadataRoute.Sitemap = staticRouteDefs.map(
    ([path, changeFrequency, priority]) => ({
      url: absoluteUrl(path),
      lastModified: new Date(),
      changeFrequency,
      priority,
    }),
  );

  const apiBase = resolveApiV1BaseUrl(process.env.NEXT_PUBLIC_API_URL);
  const serviceAreas = await fetchActiveServiceAreas(apiBase);
  const branchRoutes: MetadataRoute.Sitemap = serviceAreas.map((branch) => ({
    url: absoluteUrl(`/service-areas/${branch.id}`),
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.6,
  }));

  return [...staticRoutes, ...branchRoutes];
}
