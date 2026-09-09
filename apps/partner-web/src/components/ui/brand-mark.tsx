import { BrandMark as SharedBrandMark, type BrandMarkVariant } from '@lunara/ui';

interface BrandMarkProps {
  partner?: boolean;
  title?: string;
  subtitle?: string;
  logoSrc?: string;
}

export function BrandMark({ partner, title, subtitle, logoSrc }: BrandMarkProps) {
  const variant: BrandMarkVariant = partner ? 'partner' : 'staff';
  return <SharedBrandMark variant={variant} title={title} subtitle={subtitle} logoSrc={logoSrc} />;
}
