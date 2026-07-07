import { resolveMediaUrl } from '@lunara/utils';
import { cn } from '@lunara/ui';

function initials(name?: string) {
  if (!name) return '?';
  return name.trim().charAt(0).toUpperCase() || '?';
}

export function AvatarWithFallback({
  name,
  avatarUrl,
  size = 'md',
  className,
}: {
  name?: string;
  avatarUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const resolvedUrl = resolveMediaUrl(avatarUrl, process.env.NEXT_PUBLIC_API_URL);
  const sizeClass =
    size === 'lg'
      ? 'h-[200px] w-[200px] text-5xl'
      : size === 'sm'
        ? 'h-10 w-10 text-sm'
        : 'h-14 w-14 text-lg';

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 font-semibold text-primary',
        sizeClass,
        className,
      )}
    >
      {resolvedUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={resolvedUrl} alt={name ?? 'Photo'} className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </div>
  );
}
