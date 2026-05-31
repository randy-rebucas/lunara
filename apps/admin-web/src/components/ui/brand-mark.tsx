import { BrandMark as SharedBrandMark } from '@lunara/ui';

export function BrandMark({ compact }: { compact?: boolean }) {
  return <SharedBrandMark variant="admin" compact={compact} />;
}
