import { cn } from '@lunara/ui';
import { Card, CardBody } from './card';

export function OpsPanel({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn(className)}>
      <CardBody>
        <h3 className="font-semibold text-slate-900">{title}</h3>
        {description ? <p className="mt-1 text-xs text-muted">{description}</p> : null}
        <div className="mt-4">{children}</div>
      </CardBody>
    </Card>
  );
}

export function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{value}</dd>
    </div>
  );
}
