import Image from 'next/image';
import { appConfig } from '@lunara/config';
import brandIcon from '@lunara/brand/icon';

const iconSizes = {
  sm: 32,
  md: 40,
  lg: 64,
} as const;

export type BrandMarkVariant = 'customer' | 'admin' | 'partner' | 'staff';

const variantCopy: Record<
  BrandMarkVariant,
  { title: string; subtitle: string }
> = {
  customer: { title: appConfig.name, subtitle: appConfig.tagline },
  admin: { title: 'Lunara Admin', subtitle: 'Platform management' },
  partner: { title: 'Partner Portal', subtitle: 'Shop operations' },
  staff: { title: 'Lunara Staff', subtitle: 'Laundry processing' },
};

export interface BrandMarkProps {
  compact?: boolean;
  size?: keyof typeof iconSizes;
  variant?: BrandMarkVariant;
  title?: string;
  subtitle?: string;
  className?: string;
  /** Partner-branded logo URL override — defaults to the Lunara icon when unset. */
  logoSrc?: string;
}

export function BrandMark({
  compact,
  size = 'md',
  variant = 'customer',
  title,
  subtitle,
  className = '',
  logoSrc,
}: BrandMarkProps) {
  const copy = variantCopy[variant];
  const label = title ?? copy.title;
  const tagline = subtitle ?? copy.subtitle;
  const px = iconSizes[size];
  const showText = !compact;

  return (
    <div
      className={`flex items-center gap-2.5 ${showText && variant === 'customer' ? 'justify-center' : ''} ${className}`}
    >
      <Image
        src={logoSrc ?? brandIcon}
        alt=""
        width={px}
        height={px}
        unoptimized={Boolean(logoSrc)}
        className="shrink-0 rounded-xl shadow-[var(--shadow-card)]"
        aria-hidden
        priority
      />
      {showText && (
        <div className="min-w-0 text-left">
          <p className="truncate text-sm font-bold tracking-tight text-slate-900">{label}</p>
          <p className="truncate text-xs text-muted-foreground">{tagline}</p>
        </div>
      )}
    </div>
  );
}
