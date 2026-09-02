import type { ComponentType } from 'react';
import type { AppBlock } from '@lunara/types';
import { HeroPreview } from './hero';
import { ListPreview } from './list';
import { BannerPreview } from './banner';
import { ButtonRowPreview } from './button-row';
import { ProductGridPreview } from './product-grid';
import { TestimonialPreview } from './testimonial';
import { FaqPreview } from './faq';
import { MapPreview } from './map';
import { PromoPreview } from './promo';
import { StatusTimelinePreview } from './status-timeline';
import { DataListPreview } from './data-list';
import { FilterChipListPreview } from './filter-chip-list';
import { OrderCardListPreview } from './order-card-list';
import { StepperProgressPreview } from './stepper-progress';
import { FormCardPreview } from './form-card';
import { MenuListPreview } from './menu-list';
import { BalanceCardPreview } from './balance-card';
import { TransactionListPreview } from './transaction-list';
import { TileGridPreview } from './tile-grid';
import { AddressListPreview } from './address-list';
import { MapPickerPreview } from './map-picker';
import { QrPanelPreview } from './qr-panel';
import { AvatarHeroPreview } from './avatar-hero';
import { StatRowPreview } from './stat-row';
import { AuthFormPreview } from './auth-form';
import { PaymentSummaryPreview } from './payment-summary';
import { ReceiptCardPreview } from './receipt-card';

const BLOCK_COMPONENTS: Record<string, ComponentType<any>> = {
  hero: HeroPreview,
  list: ListPreview,
  banner: BannerPreview,
  'button-row': ButtonRowPreview,
  'product-grid': ProductGridPreview,
  testimonial: TestimonialPreview,
  faq: FaqPreview,
  map: MapPreview,
  promo: PromoPreview,
  'status-timeline': StatusTimelinePreview,
  'data-list': DataListPreview,
  'filter-chip-list': FilterChipListPreview,
  'order-card-list': OrderCardListPreview,
  'stepper-progress': StepperProgressPreview,
  'form-card': FormCardPreview,
  'menu-list': MenuListPreview,
  'balance-card': BalanceCardPreview,
  'transaction-list': TransactionListPreview,
  'tile-grid': TileGridPreview,
  'address-list': AddressListPreview,
  'map-picker': MapPickerPreview,
  'qr-panel': QrPanelPreview,
  'avatar-hero': AvatarHeroPreview,
  'stat-row': StatRowPreview,
  'auth-form': AuthFormPreview,
  'payment-summary': PaymentSummaryPreview,
  'receipt-card': ReceiptCardPreview,
};

export function BlockListPreview({ blocks }: { blocks: AppBlock[] }) {
  return (
    <div className="space-y-2">
      {[...blocks]
        .sort((a, b) => a.order - b.order)
        .map((block) => {
          const Component = BLOCK_COMPONENTS[block.type];
          if (!Component) return null;
          return <Component key={block.id} {...block.props} />;
        })}
    </div>
  );
}
