import type { BannerProps } from '@lunara/blocks';
import { cn } from '@lunara/ui';

const TONE_CLASS: Record<BannerProps['tone'], string> = {
  info: 'bg-accent',
  success: 'bg-primary',
  warning: 'bg-destructive',
};

export function BannerPreview({ message, tone }: BannerProps) {
  return (
    <div className={cn('rounded-lg px-2 py-1.5 text-[8px] font-medium text-white', TONE_CLASS[tone])}>
      {message}
    </div>
  );
}
