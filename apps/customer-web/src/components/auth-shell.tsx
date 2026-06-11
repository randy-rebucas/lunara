import Link from 'next/link';
import { BrandMark } from '@lunara/ui';
import { MarketingShell } from './marketing/marketing-shell';

export { BrandMark };

export function AuthShell({
  children,
  showBrand = true,
}: {
  children: React.ReactNode;
  showBrand?: boolean;
}) {
  return (
    <MarketingShell>
      <section className="marketing-container flex flex-1 flex-col items-center justify-center py-12 sm:py-16">
        {showBrand && (
          <Link href="/" className="mb-8 transition-opacity hover:opacity-90">
            <BrandMark variant="customer" />
          </Link>
        )}
        <div className="card-elevated w-full max-w-xl">
          <div className="card-body">{children}</div>
        </div>
      </section>
    </MarketingShell>
  );
}

export function AuthShellWide({ children }: { children: React.ReactNode }) {
  return (
    <MarketingShell>
      <section className="marketing-container py-8 sm:py-12">
        <Link href="/" className="mb-8 inline-block transition-opacity hover:opacity-90">
          <BrandMark variant="customer" compact />
        </Link>
        <div className="mx-auto max-w-xl">{children}</div>
      </section>
    </MarketingShell>
  );
}
