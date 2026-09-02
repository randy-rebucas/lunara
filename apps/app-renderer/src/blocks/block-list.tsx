import type { ComponentType } from 'react';
import { Text } from 'react-native';
import type { AppBlock } from '@lunara/types';
import { Hero } from './hero';
import { ListBlock } from './list';
import { Banner } from './banner';
import { ButtonRow } from './button-row';
import { ProductGrid } from './product-grid';
import { Testimonial } from './testimonial';
import { Faq } from './faq';
import { MapBlock } from './map';
import { Promo } from './promo';
import { StatusTimeline } from './status-timeline';
import { DataList } from './data-list';
import { FilterChipList } from './filter-chip-list';
import { OrderCardList } from './order-card-list';
import { StepperProgress } from './stepper-progress';
import { FormCard } from './form-card';
import { MenuList } from './menu-list';
import { BalanceCard } from './balance-card';
import { TransactionList } from './transaction-list';
import { TileGrid } from './tile-grid';
import { AddressList } from './address-list';
import { MapPicker } from './map-picker';
import { QrPanel } from './qr-panel';
import { AvatarHero } from './avatar-hero';
import { StatRow } from './stat-row';
import { AuthForm } from './auth-form';
import { PaymentSummary } from './payment-summary';
import { ReceiptCard } from './receipt-card';

const BLOCK_COMPONENTS: Record<string, ComponentType<any>> = {
  hero: Hero,
  list: ListBlock,
  banner: Banner,
  'button-row': ButtonRow,
  'product-grid': ProductGrid,
  testimonial: Testimonial,
  faq: Faq,
  map: MapBlock,
  promo: Promo,
  'status-timeline': StatusTimeline,
  'data-list': DataList,
  'filter-chip-list': FilterChipList,
  'order-card-list': OrderCardList,
  'stepper-progress': StepperProgress,
  'form-card': FormCard,
  'menu-list': MenuList,
  'balance-card': BalanceCard,
  'transaction-list': TransactionList,
  'tile-grid': TileGrid,
  'address-list': AddressList,
  'map-picker': MapPicker,
  'qr-panel': QrPanel,
  'avatar-hero': AvatarHero,
  'stat-row': StatRow,
  'auth-form': AuthForm,
  'payment-summary': PaymentSummary,
  'receipt-card': ReceiptCard,
};

export function BlockList({ blocks }: { blocks: AppBlock[] }) {
  return (
    <>
      {[...blocks]
        .sort((a, b) => a.order - b.order)
        .map((block) => {
          const Component = BLOCK_COMPONENTS[block.type];
          if (!Component) return <Text key={block.id}>Unknown block: {block.type}</Text>;
          return <Component key={block.id} {...block.props} />;
        })}
    </>
  );
}
