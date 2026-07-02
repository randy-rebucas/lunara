import type { LucideIcon } from 'lucide-react';
import { cn } from '@lunara/ui';

export function Card({
  className,
  elevated,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { elevated?: boolean }) {
  return (
    <div className={cn(elevated ? 'card-elevated' : 'card', className)} {...props} />
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('card-body', className)} {...props} />;
}

export function CardSectionHeader({
  icon: Icon,
  title,
  className,
}: {
  icon: LucideIcon;
  title: string;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Icon className="h-4 w-4 text-primary" aria-hidden />
      </span>
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
    </div>
  );
}
