import Link from 'next/link';
import { BrandMark } from '@lunara/ui';

export { BrandMark };

export function AuthShell({
  children,
  showBrand = true,
}: {
  children: React.ReactNode;
  showBrand?: boolean;
}) {
  return (
    <div className="laundry-bg flex min-h-screen flex-col items-center justify-center py-12">
      <div className="page-container flex w-full flex-col items-center">
        {showBrand && (
          <Link href="/" className="mb-8 transition-opacity hover:opacity-90">
            <BrandMark variant="customer" />
          </Link>
        )}
        <div className="card-elevated page-content-narrow">
          <div className="card-body">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function AuthShellWide({ children }: { children: React.ReactNode }) {
  return (
    <div className="laundry-bg min-h-screen py-8 sm:py-12">
      <div className="page-container">
        <Link href="/" className="mb-8 inline-block transition-opacity hover:opacity-90">
          <BrandMark variant="customer" compact />
        </Link>
        <div className="page-content-narrow">{children}</div>
      </div>
    </div>
  );
}
