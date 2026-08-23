'use client';

import { useCallback, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Bold, Heading2, Italic, Link2, List, ListOrdered, Quote } from 'lucide-react';
import { adminFetch, adminUpload } from '../../lib/admin-api';
import { useAdminQuery } from '../../lib/use-admin-query';
import { PageHeader } from '../ui/page-header';
import { Card, CardBody } from '../ui/card';

interface BlogPost {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImageUrl?: string;
  authorName?: string;
  isPublished: boolean;
  publishedAt?: string;
  createdAt: string;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const MARKDOWN_PREVIEW_CLASSES =
  'space-y-3 [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-slate-600 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-slate-900 [&_h3]:font-semibold [&_h3]:text-slate-900 [&_li]:leading-relaxed [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_p]:leading-relaxed [&_strong]:font-semibold [&_strong]:text-slate-900 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5';

type MarkdownAction =
  | { type: 'wrap'; before: string; after?: string; placeholder: string }
  | { type: 'line-prefix'; prefix: string; placeholder: string };

const TOOLBAR_ACTIONS: { icon: typeof Bold; label: string; action: MarkdownAction }[] = [
  { icon: Bold, label: 'Bold', action: { type: 'wrap', before: '**', after: '**', placeholder: 'bold text' } },
  { icon: Italic, label: 'Italic', action: { type: 'wrap', before: '_', after: '_', placeholder: 'italic text' } },
  { icon: Heading2, label: 'Heading', action: { type: 'line-prefix', prefix: '## ', placeholder: 'Heading' } },
  { icon: List, label: 'Bulleted list', action: { type: 'line-prefix', prefix: '- ', placeholder: 'List item' } },
  { icon: ListOrdered, label: 'Numbered list', action: { type: 'line-prefix', prefix: '1. ', placeholder: 'List item' } },
  { icon: Quote, label: 'Quote', action: { type: 'line-prefix', prefix: '> ', placeholder: 'Quote' } },
  { icon: Link2, label: 'Link', action: { type: 'wrap', before: '[', after: '](https://)', placeholder: 'link text' } },
];

/** Markdown editor with a formatting toolbar (insert-at-cursor) and an Edit/Preview toggle. */
function MarkdownField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [showPreview, setShowPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function applyAction(action: MarkdownAction) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end);

    let next: string;
    let selectStart: number;
    let selectEnd: number;

    if (action.type === 'wrap') {
      const text = selected || action.placeholder;
      const after = action.after ?? action.before;
      next = value.slice(0, start) + action.before + text + after + value.slice(end);
      selectStart = start + action.before.length;
      selectEnd = selectStart + text.length;
    } else {
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const text = selected || action.placeholder;
      next = value.slice(0, lineStart) + action.prefix + value.slice(lineStart, start) + text + value.slice(end);
      selectStart = lineStart + action.prefix.length + (start - lineStart);
      selectEnd = selectStart + text.length;
    }

    onChange(next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(selectStart, selectEnd);
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="block text-sm font-medium text-slate-700">Content (Markdown)</span>
        <button
          type="button"
          className="text-xs font-medium text-primary hover:underline"
          onClick={() => setShowPreview((v) => !v)}
        >
          {showPreview ? 'Edit' : 'Preview'}
        </button>
      </div>

      {!showPreview && (
        <div className="mt-1 flex flex-wrap items-center gap-1 rounded-t-lg border border-b-0 border-border bg-surface-muted px-2 py-1.5">
          {TOOLBAR_ACTIONS.map(({ icon: Icon, label, action }) => (
            <button
              key={label}
              type="button"
              title={label}
              aria-label={label}
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-600 transition hover:bg-white hover:text-primary"
              onClick={() => applyAction(action)}
            >
              <Icon className="h-4 w-4" aria-hidden />
            </button>
          ))}
        </div>
      )}

      {showPreview ? (
        <div className="mt-1 min-h-[18rem] rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm">
          {value.trim() ? (
            <div className={MARKDOWN_PREVIEW_CLASSES}>
              <ReactMarkdown>{value}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-muted">Nothing to preview yet.</p>
          )}
        </div>
      ) : (
        <textarea
          id={id}
          ref={textareaRef}
          className="w-full resize-y rounded-b-lg border border-border px-3 py-2 font-mono text-sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={14}
          required
          minLength={20}
          placeholder={'## Heading\n\nWrite your post in Markdown — **bold**, _italics_, [links](https://example.com), lists, etc.'}
        />
      )}
    </div>
  );
}

type PostFormValues = { title: string; slug: string; excerpt: string; content: string };
const EMPTY_FORM: PostFormValues = { title: '', slug: '', excerpt: '', content: '' };

export function BlogBoard() {
  const load = useCallback(() => adminFetch<BlogPost[]>('/admin/blog'), []);
  const { data, loading, error, reload } = useAdminQuery(load, []);
  const posts = data ?? [];

  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PostFormValues>(EMPTY_FORM);
  const [slugEdited, setSlugEdited] = useState(false);
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actioningId, setActioningId] = useState<string | null>(null);
  const replaceImageInputRef = useRef<HTMLInputElement>(null);
  const [replacingForId, setReplacingForId] = useState<string | null>(null);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSlugEdited(false);
    setCoverImageFile(null);
    setActionError('');
    setShowCreate((v) => !v);
  }

  function openEdit(p: BlogPost) {
    setShowCreate(false);
    setActionError('');
    setForm({ title: p.title, slug: p.slug, excerpt: p.excerpt, content: p.content });
    setSlugEdited(true);
    setEditingId((current) => (current === p._id ? null : p._id));
  }

  function handleTitleChange(value: string) {
    setForm((f) => ({ ...f, title: value, slug: slugEdited ? f.slug : slugify(value) }));
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setActionError('');
    try {
      const formData = new FormData();
      formData.append('title', form.title.trim());
      formData.append('slug', form.slug.trim());
      formData.append('excerpt', form.excerpt.trim());
      formData.append('content', form.content);
      if (coverImageFile) formData.append('coverImage', coverImageFile);

      await adminUpload('/admin/blog', formData);
      setForm(EMPTY_FORM);
      setSlugEdited(false);
      setCoverImageFile(null);
      setShowCreate(false);
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to create post');
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setSaving(true);
    setActionError('');
    try {
      await adminFetch(`/admin/blog/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: form.title.trim(),
          slug: form.slug.trim(),
          excerpt: form.excerpt.trim(),
          content: form.content,
        }),
      });
      setEditingId(null);
      setForm(EMPTY_FORM);
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to save post');
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(p: BlogPost) {
    setActioningId(p._id);
    setActionError('');
    try {
      await adminFetch(`/admin/blog/${p._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isPublished: !p.isPublished }),
      });
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update post');
    } finally {
      setActioningId(null);
    }
  }

  function startReplaceImage(postId: string) {
    setReplacingForId(postId);
    replaceImageInputRef.current?.click();
  }

  async function handleReplaceImageSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !replacingForId) return;
    setActioningId(replacingForId);
    try {
      const formData = new FormData();
      formData.append('coverImage', file);
      await adminUpload(`/admin/blog/${replacingForId}/cover-image`, formData);
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update cover image');
    } finally {
      setActioningId(null);
      setReplacingForId(null);
    }
  }

  async function remove(p: BlogPost) {
    if (!window.confirm(`Delete post "${p.title}"?`)) return;
    setActioningId(p._id);
    setActionError('');
    try {
      await adminFetch(`/admin/blog/${p._id}`, { method: 'DELETE' });
      if (editingId === p._id) {
        setEditingId(null);
        setForm(EMPTY_FORM);
      }
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete post');
    } finally {
      setActioningId(null);
    }
  }

  function renderFields(onSubmit: (e: React.FormEvent) => void, submitLabel: string, showCoverInput: boolean) {
    return (
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
          Title
          <input
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
            value={form.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            required
            minLength={3}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
          Slug
          <input
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
            value={form.slug}
            onChange={(e) => {
              setForm((f) => ({ ...f, slug: e.target.value }));
              setSlugEdited(true);
            }}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            required
          />
          <span className="mt-1 block text-xs text-muted">
            Used in the post URL, e.g. /blog/{form.slug || 'your-slug'}
          </span>
        </label>
        <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
          Excerpt
          <textarea
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
            value={form.excerpt}
            onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
            rows={2}
            required
            minLength={10}
          />
        </label>
        <div className="sm:col-span-2">
          <MarkdownField
            id="blog-content"
            value={form.content}
            onChange={(value) => setForm((f) => ({ ...f, content: value }))}
          />
        </div>
        {showCoverInput && (
          <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
            Cover image (optional)
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="mt-1 w-full text-sm"
              onChange={(e) => setCoverImageFile(e.target.files?.[0] ?? null)}
            />
          </label>
        )}
        {actionError && <p className="text-sm text-red-600 sm:col-span-2">{actionError}</p>}
        <div className="flex items-center gap-2 sm:col-span-2">
          <button type="submit" className="btn-primary btn-sm" disabled={saving}>
            {saving ? 'Saving…' : submitLabel}
          </button>
          {editingId && (
            <button
              type="button"
              className="btn-outline btn-sm"
              onClick={() => {
                setEditingId(null);
                setForm(EMPTY_FORM);
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    );
  }

  return (
    <div>
      <input
        ref={replaceImageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleReplaceImageSelected}
      />

      <PageHeader
        title="Blog"
        description="Posts shown on the customer site's blog."
        actions={
          <button type="button" className="btn-primary btn-sm" onClick={openCreate}>
            {showCreate ? 'Cancel' : 'New post'}
          </button>
        }
      />

      {showCreate && (
        <Card className="mb-6">
          <CardBody>{renderFields(create, 'Create post', true)}</CardBody>
        </Card>
      )}

      {actionError && !showCreate && !editingId && (
        <div className="alert-error mb-4" role="alert">
          {actionError}
        </div>
      )}

      {loading && <p className="text-sm text-muted">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && posts.length === 0 && (
        <Card>
          <CardBody className="text-center text-sm text-muted">No posts yet.</CardBody>
        </Card>
      )}

      <div className="flex flex-col gap-4">
        {posts.map((p) => (
          <Card key={p._id}>
            <CardBody className="flex items-center gap-4">
              {p.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.coverImageUrl}
                  alt={p.title}
                  className="h-16 w-28 shrink-0 rounded-lg object-cover ring-1 ring-border"
                />
              ) : (
                <div className="h-16 w-28 shrink-0 rounded-lg bg-slate-100 ring-1 ring-border" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900">{p.title}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">/blog/{p.slug}</p>
                {p.authorName && (
                  <p className="mt-0.5 text-xs text-muted-foreground">By {p.authorName}</p>
                )}
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                  p.isPublished ? 'bg-accent/15 text-accent-dark' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {p.isPublished ? 'Published' : 'Draft'}
              </span>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  disabled={actioningId === p._id}
                  onClick={() => openEdit(p)}
                >
                  {editingId === p._id ? 'Close' : 'Edit'}
                </button>
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  disabled={actioningId === p._id}
                  onClick={() => startReplaceImage(p._id)}
                >
                  {actioningId === p._id ? 'Working…' : 'Replace image'}
                </button>
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  disabled={actioningId === p._id}
                  onClick={() => togglePublished(p)}
                >
                  {p.isPublished ? 'Unpublish' : 'Publish'}
                </button>
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  disabled={actioningId === p._id}
                  onClick={() => remove(p)}
                >
                  Delete
                </button>
              </div>
            </CardBody>
            {editingId === p._id && (
              <div className="border-t border-border/60 px-6 py-5">
                {renderFields(saveEdit, 'Save changes', false)}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
