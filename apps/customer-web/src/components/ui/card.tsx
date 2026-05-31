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
