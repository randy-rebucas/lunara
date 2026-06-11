import Link from 'next/link';
import { appConfig } from '@lunara/config';
import { BrandMark } from '@lunara/ui';
import { ButtonLink } from '../ui/button-link';

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="laundry-bg flex min-h-screen flex-col">
      <header className="marketing-container sticky top-0 z-10 border-b border-border/40 bg-surface-muted/80 py-4 backdrop-blur-md">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandMark variant="customer" compact size="sm" />
            <span className="font-bold tracking-tight text-primary">{appConfig.name}</span>
          </Link>
          <nav className="hidden items-center gap-5 text-sm font-medium text-muted lg:flex">
            <Link href="/#how-it-works" className="transition-colors hover:text-primary">
              How it works
            </Link>
            <Link href="/#service-areas" className="transition-colors hover:text-primary">
              Service areas
            </Link>
            <Link href="/locations" className="transition-colors hover:text-primary">
              Locations
            </Link>
            <Link href="/faq" className="transition-colors hover:text-primary">
              FAQ
            </Link>
            <Link href="/partners" className="transition-colors hover:text-primary">
              Partners
            </Link>
            <Link href="/riders" className="transition-colors hover:text-primary">
              Riders
            </Link>
          </nav>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Link href="/login" className="link-primary hidden text-sm sm:inline">
              Sign in
            </Link>
            <ButtonLink
              href="/signup"
              variant="outline"
              size="sm"
              layout="inline"
              className="hidden sm:inline-flex"
            >
              Book pickup
            </ButtonLink>
            <ButtonLink href="/signup" size="sm" layout="inline">
              Get started
            </ButtonLink>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="marketing-container border-t border-border/60 py-10">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <BrandMark variant="customer" compact size="sm" />
            <span className="text-sm font-semibold text-slate-900">{appConfig.name}</span>
          </div>
          <p className="text-center text-sm text-muted-foreground">{appConfig.tagline}</p>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
            <Link href="/" className="link-primary">
              Home
            </Link>
            <Link href="/locations" className="link-primary">
              Locations
            </Link>
            <Link href="/faq" className="link-primary">
              FAQ
            </Link>
            <Link href="/partners" className="link-primary">
              Partners
            </Link>
            <Link href="/riders" className="link-primary">
              Riders
            </Link>
            <Link href="/privacy" className="link-primary">
              Privacy
            </Link>
            <Link href="/login" className="link-primary">
              Sign in
            </Link>
            <Link href="/signup" className="link-primary">
              Sign up
            </Link>
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} {appConfig.name}. Laundry pickup &amp; delivery, simplified.
        </p>
      </footer>
    </div>
  );
}
