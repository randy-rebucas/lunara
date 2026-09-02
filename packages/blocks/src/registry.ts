import type { z } from 'zod';
import { heroPropsSchema, heroDefaultProps } from './blocks/hero.schema.js';
import { listPropsSchema, listDefaultProps } from './blocks/list.schema.js';
import { bannerPropsSchema, bannerDefaultProps } from './blocks/banner.schema.js';
import { buttonRowPropsSchema, buttonRowDefaultProps } from './blocks/button-row.schema.js';
import { productGridPropsSchema, productGridDefaultProps } from './blocks/product-grid.schema.js';
import { testimonialPropsSchema, testimonialDefaultProps } from './blocks/testimonial.schema.js';
import { faqPropsSchema, faqDefaultProps } from './blocks/faq.schema.js';
import { mapPropsSchema, mapDefaultProps } from './blocks/map.schema.js';
import { promoPropsSchema, promoDefaultProps } from './blocks/promo.schema.js';
import { statusTimelinePropsSchema, statusTimelineDefaultProps } from './blocks/status-timeline.schema.js';
import { dataListPropsSchema, dataListDefaultProps } from './blocks/data-list.schema.js';
import { filterChipListPropsSchema, filterChipListDefaultProps } from './blocks/filter-chip-list.schema.js';
import { orderCardListPropsSchema, orderCardListDefaultProps } from './blocks/order-card-list.schema.js';
import { stepperProgressPropsSchema, stepperProgressDefaultProps } from './blocks/stepper-progress.schema.js';
import { formCardPropsSchema, formCardDefaultProps } from './blocks/form-card.schema.js';
import { menuListPropsSchema, menuListDefaultProps } from './blocks/menu-list.schema.js';
import { balanceCardPropsSchema, balanceCardDefaultProps } from './blocks/balance-card.schema.js';
import { transactionListPropsSchema, transactionListDefaultProps } from './blocks/transaction-list.schema.js';
import { tileGridPropsSchema, tileGridDefaultProps } from './blocks/tile-grid.schema.js';
import { addressListPropsSchema, addressListDefaultProps } from './blocks/address-list.schema.js';
import { mapPickerPropsSchema, mapPickerDefaultProps } from './blocks/map-picker.schema.js';
import { qrPanelPropsSchema, qrPanelDefaultProps } from './blocks/qr-panel.schema.js';
import { avatarHeroPropsSchema, avatarHeroDefaultProps } from './blocks/avatar-hero.schema.js';
import { statRowPropsSchema, statRowDefaultProps } from './blocks/stat-row.schema.js';
import { authFormPropsSchema, authFormDefaultProps } from './blocks/auth-form.schema.js';
import { paymentSummaryPropsSchema, paymentSummaryDefaultProps } from './blocks/payment-summary.schema.js';
import { receiptCardPropsSchema, receiptCardDefaultProps } from './blocks/receipt-card.schema.js';

export interface BlockDefinition<TSchema extends z.ZodTypeAny = z.ZodTypeAny> {
  type: string;
  label: string;
  /** Icon name from the icon set each renderer already uses (e.g. lucide-react / lucide-react-native). */
  icon: string;
  propsSchema: TSchema;
  defaultProps: z.infer<TSchema>;
}

export const BLOCK_REGISTRY = {
  hero: {
    type: 'hero',
    label: 'Hero',
    icon: 'Sparkles',
    propsSchema: heroPropsSchema,
    defaultProps: heroDefaultProps,
  },
  list: {
    type: 'list',
    label: 'List',
    icon: 'List',
    propsSchema: listPropsSchema,
    defaultProps: listDefaultProps,
  },
  banner: {
    type: 'banner',
    label: 'Banner',
    icon: 'Megaphone',
    propsSchema: bannerPropsSchema,
    defaultProps: bannerDefaultProps,
  },
  'button-row': {
    type: 'button-row',
    label: 'Button row',
    icon: 'MousePointerClick',
    propsSchema: buttonRowPropsSchema,
    defaultProps: buttonRowDefaultProps,
  },
  'product-grid': {
    type: 'product-grid',
    label: 'Product grid',
    icon: 'ShoppingBag',
    propsSchema: productGridPropsSchema,
    defaultProps: productGridDefaultProps,
  },
  testimonial: {
    type: 'testimonial',
    label: 'Testimonial',
    icon: 'Quote',
    propsSchema: testimonialPropsSchema,
    defaultProps: testimonialDefaultProps,
  },
  faq: {
    type: 'faq',
    label: 'FAQ',
    icon: 'HelpCircle',
    propsSchema: faqPropsSchema,
    defaultProps: faqDefaultProps,
  },
  map: {
    type: 'map',
    label: 'Map',
    icon: 'MapPin',
    propsSchema: mapPropsSchema,
    defaultProps: mapDefaultProps,
  },
  promo: {
    type: 'promo',
    label: 'Promo',
    icon: 'Percent',
    propsSchema: promoPropsSchema,
    defaultProps: promoDefaultProps,
  },
  'status-timeline': {
    type: 'status-timeline',
    label: 'Status timeline',
    icon: 'GitCommitVertical',
    propsSchema: statusTimelinePropsSchema,
    defaultProps: statusTimelineDefaultProps,
  },
  'data-list': {
    type: 'data-list',
    label: 'Data list',
    icon: 'ListChecks',
    propsSchema: dataListPropsSchema,
    defaultProps: dataListDefaultProps,
  },
  'filter-chip-list': {
    type: 'filter-chip-list',
    label: 'Filter chips',
    icon: 'SlidersHorizontal',
    propsSchema: filterChipListPropsSchema,
    defaultProps: filterChipListDefaultProps,
  },
  'order-card-list': {
    type: 'order-card-list',
    label: 'Order card list',
    icon: 'PackageSearch',
    propsSchema: orderCardListPropsSchema,
    defaultProps: orderCardListDefaultProps,
  },
  'stepper-progress': {
    type: 'stepper-progress',
    label: 'Stepper progress',
    icon: 'ListOrdered',
    propsSchema: stepperProgressPropsSchema,
    defaultProps: stepperProgressDefaultProps,
  },
  'form-card': {
    type: 'form-card',
    label: 'Form card',
    icon: 'FileText',
    propsSchema: formCardPropsSchema,
    defaultProps: formCardDefaultProps,
  },
  'menu-list': {
    type: 'menu-list',
    label: 'Menu list',
    icon: 'Menu',
    propsSchema: menuListPropsSchema,
    defaultProps: menuListDefaultProps,
  },
  'balance-card': {
    type: 'balance-card',
    label: 'Balance card',
    icon: 'Wallet',
    propsSchema: balanceCardPropsSchema,
    defaultProps: balanceCardDefaultProps,
  },
  'transaction-list': {
    type: 'transaction-list',
    label: 'Transaction list',
    icon: 'Receipt',
    propsSchema: transactionListPropsSchema,
    defaultProps: transactionListDefaultProps,
  },
  'tile-grid': {
    type: 'tile-grid',
    label: 'Tile grid',
    icon: 'LayoutGrid',
    propsSchema: tileGridPropsSchema,
    defaultProps: tileGridDefaultProps,
  },
  'address-list': {
    type: 'address-list',
    label: 'Address list',
    icon: 'MapPinned',
    propsSchema: addressListPropsSchema,
    defaultProps: addressListDefaultProps,
  },
  'map-picker': {
    type: 'map-picker',
    label: 'Map picker',
    icon: 'Map',
    propsSchema: mapPickerPropsSchema,
    defaultProps: mapPickerDefaultProps,
  },
  'qr-panel': {
    type: 'qr-panel',
    label: 'QR panel',
    icon: 'QrCode',
    propsSchema: qrPanelPropsSchema,
    defaultProps: qrPanelDefaultProps,
  },
  'avatar-hero': {
    type: 'avatar-hero',
    label: 'Avatar hero',
    icon: 'UserCircle',
    propsSchema: avatarHeroPropsSchema,
    defaultProps: avatarHeroDefaultProps,
  },
  'stat-row': {
    type: 'stat-row',
    label: 'Stat row',
    icon: 'BarChart3',
    propsSchema: statRowPropsSchema,
    defaultProps: statRowDefaultProps,
  },
  'auth-form': {
    type: 'auth-form',
    label: 'Auth form',
    icon: 'KeyRound',
    propsSchema: authFormPropsSchema,
    defaultProps: authFormDefaultProps,
  },
  'payment-summary': {
    type: 'payment-summary',
    label: 'Payment summary',
    icon: 'CreditCard',
    propsSchema: paymentSummaryPropsSchema,
    defaultProps: paymentSummaryDefaultProps,
  },
  'receipt-card': {
    type: 'receipt-card',
    label: 'Receipt card',
    icon: 'ReceiptText',
    propsSchema: receiptCardPropsSchema,
    defaultProps: receiptCardDefaultProps,
  },
} as const satisfies Record<string, BlockDefinition>;

export type BlockType = keyof typeof BLOCK_REGISTRY;

export function isBlockType(type: string): type is BlockType {
  return type in BLOCK_REGISTRY;
}

/** Throws if props don't match the registered schema for `type`. Used by the API service layer
 *  (not the Mongoose schema, which stores props as Mixed) and by the builder's config panel. */
export function validateBlockProps(type: string, props: unknown) {
  if (!isBlockType(type)) {
    throw new Error(`Unknown block type: ${type}`);
  }
  return BLOCK_REGISTRY[type].propsSchema.parse(props);
}
