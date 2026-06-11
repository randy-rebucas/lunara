import { cn } from '@lunara/ui';

type MarketingActionsProps = {
  children: React.ReactNode;
  className?: string;
  align?: 'start' | 'center' | 'end';
  /** Tighter on mobile, roomier from sm up */
  gap?: 'default' | 'loose';
};

export function MarketingActions({
  children,
  className,
  align = 'start',
  gap = 'default',
}: MarketingActionsProps) {
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:flex-wrap sm:items-stretch sm:items-center',
        gap === 'loose' ? 'gap-3 sm:gap-4' : 'gap-2.5 sm:gap-3',
        align === 'center' && 'sm:justify-center',
        align === 'end' && 'sm:justify-end',
        className,
      )}
    >
      {children}
    </div>
  );
}
