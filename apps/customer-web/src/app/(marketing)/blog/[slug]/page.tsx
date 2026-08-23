import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { appConfig } from '@lunara/config';
import { resolveApiV1BaseUrl } from '@lunara/hooks';
import { PublicShell } from '../../../../components/public-shell';
import { fetchBlogPostBySlug } from '../../../../components/marketing/blog-data';
import { buildPageMetadata } from '../../../../lib/seo';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const apiBase = resolveApiV1BaseUrl(process.env.NEXT_PUBLIC_API_URL);
  const post = await fetchBlogPostBySlug(apiBase, slug);
  if (!post) {
    return buildPageMetadata({
      title: 'Blog',
      description: `Tips, updates, and stories from ${appConfig.name}.`,
      path: `/blog/${slug}`,
    });
  }
  return buildPageMetadata({
    title: post.title,
    description: post.excerpt,
    path: `/blog/${post.slug}`,
  });
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const apiBase = resolveApiV1BaseUrl(process.env.NEXT_PUBLIC_API_URL);
  const post = await fetchBlogPostBySlug(apiBase, slug);
  if (!post) notFound();

  return (
    <PublicShell
      badge={appConfig.name}
      title={post.title}
      description={[post.authorName, formatDate(post.publishedAt)].filter(Boolean).join(' · ')}
    >
      {post.coverImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.coverImageUrl}
          alt={post.title}
          className="mb-6 w-full rounded-xl object-cover"
        />
      )}
      <ReactMarkdown>{post.content}</ReactMarkdown>
    </PublicShell>
  );
}
