export type BlogPost = {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImageUrl?: string;
  authorName?: string;
  publishedAt?: string;
};

export async function fetchBlogPosts(apiBase: string): Promise<BlogPost[]> {
  try {
    const res = await fetch(`${apiBase}/blog`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const body = await res.json();
    return Array.isArray(body?.data) ? body.data : [];
  } catch {
    return [];
  }
}

export async function fetchBlogPostBySlug(apiBase: string, slug: string): Promise<BlogPost | null> {
  try {
    const res = await fetch(`${apiBase}/blog/${slug}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.data ?? null;
  } catch {
    return null;
  }
}
