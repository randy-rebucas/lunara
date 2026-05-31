import { CustomerNav } from './customer-nav';

export function PageShell({
  children,
  narrow,
  className,
}: {
  children: React.ReactNode;
  /** Center content at home-page inner width (max-w-xl) within the page shell */
  narrow?: boolean;
  className?: string;
}) {
  return (
    <div className="laundry-bg min-h-screen">
      <CustomerNav />
      <main className={`page-main ${className ?? ''}`.trim()}>
        {narrow ? <div className="page-content-narrow">{children}</div> : children}
      </main>
    </div>
  );
}
