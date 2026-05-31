import { BrandMark as SharedBrandMark, type BrandMarkVariant } from '@lunara/ui';

export function BrandMark({ partner }: { partner?: boolean }) {
  const variant: BrandMarkVariant = partner ? 'partner' : 'staff';
  return <SharedBrandMark variant={variant} />;
}
