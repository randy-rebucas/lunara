import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-bold text-slate-900">Page not found</h1>
      <p className="text-sm text-muted">The admin page you requested does not exist.</p>
      <Link href="/" className="btn-primary btn-sm">
        Back to overview
      </Link>
    </div>
  );
}
