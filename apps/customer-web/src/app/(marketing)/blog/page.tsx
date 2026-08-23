import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarDays, Newspaper } from 'lucide-react';
import { appConfig } from '@lunara/config';
import { resolveApiV1BaseUrl } from '@lunara/hooks';
import { MarketingShell } from '../../../components/marketing/marketing-shell';
import {
  MarketingBackLink,
  MarketingHeroGlow,
  MarketingStatRow,
} from '../../../components/marketing/marketing-design';
import { fetchBlogPosts } from '../../../components/marketing/blog-data';
import { buildPageMetadata } from '../../../lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'Blog',
  description: `Tips, updates, and stories from ${appConfig.name} — laundry care, service updates, and what's new.`,
  path: '/blog',
});

function formatDate(dateStr?: string) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default async function BlogIndexPage() {
  const apiBase = resolveApiV1BaseUrl(process.env.NEXT_PUBLIC_API_URL);
  const posts = await fetchBlogPosts(apiBase);

  return (
    <MarketingShell>
      <section className="relative overflow-hidden border-b border-border/40 bg-surface/60">
        <MarketingHeroGlow />
        <div className="marketing-container relative py-12 text-center sm:py-16">
          <span className="badge-primary">Blog</span>
          <h1 className="mx-auto mt-4 max-w-2xl text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            News &amp; laundry tips
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-muted">
            Updates from {appConfig.name} plus practical laundry care advice.
          </p>
          <MarketingStatRow
            className="mx-auto mt-8 max-w-md"
            align="center"
            stats={[{ icon: Newspaper, label: `${posts.length} ${posts.length === 1 ? 'post' : 'posts'}` }]}
          />
        </div>
      </section>

      <section className="marketing-container py-12 sm:py-16">
        {posts.length === 0 ? (
          <div className="card">
            <div className="card-body text-center text-sm text-muted">
              No posts yet — check back soon.
            </div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Link
                key={post._id}
                href={`/blog/${post.slug}`}
                className="card group flex h-full flex-col overflow-hidden transition hover:shadow-md"
              >
                {post.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={post.coverImageUrl}
                    alt={post.title}
                    className="h-40 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-40 w-full items-center justify-center bg-surface-muted">
                    <Newspaper className="h-8 w-8 text-muted-foreground" aria-hidden />
                  </div>
                )}
                <div className="card-body flex flex-1 flex-col">
                  <h2 className="text-lg font-semibold text-slate-900 group-hover:text-primary">
                    {post.title}
                  </h2>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{post.excerpt}</p>
                  <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                    {formatDate(post.publishedAt)}
                    {post.authorName ? ` · ${post.authorName}` : ''}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <MarketingBackLink />
      </section>
    </MarketingShell>
  );
}
