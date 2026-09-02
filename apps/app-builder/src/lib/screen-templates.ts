import { BLOCK_REGISTRY, type BlockType } from '@lunara/blocks';
import type { AppBlock, AppScreen } from '@lunara/types';

export interface ScreenTemplate {
  key: string;
  title: string;
  description: string;
  /** Icon name from lucide-react, rendered by the picker UI. */
  icon: string;
  blocks: { type: BlockType; props?: Record<string, unknown> }[];
}

export const SCREEN_TEMPLATES: ScreenTemplate[] = [
  {
    key: 'home',
    title: 'Home',
    description: 'Welcome screen with quick actions for booking and offers.',
    icon: 'Home',
    blocks: [
      { type: 'hero' },
      { type: 'banner' },
      {
        type: 'list',
        props: {
          title: 'Quick actions',
          items: [
            { id: 'home-item-1', label: 'Book a pickup' },
            { id: 'home-item-2', label: 'Track my order' },
            { id: 'home-item-3', label: 'View offers' },
          ],
        },
      },
    ],
  },
  {
    key: 'orders',
    title: 'Orders',
    description: 'Active order tracking with live status.',
    icon: 'Package',
    blocks: [{ type: 'order-card-list' }, { type: 'status-timeline' }],
  },
  {
    key: 'offers',
    title: 'Offers',
    description: 'Promotions and a browsable catalog of services.',
    icon: 'Percent',
    blocks: [
      { type: 'promo' },
      {
        type: 'product-grid',
        props: {
          title: 'Popular services',
          columns: 2,
          items: [
            { id: 'offer-item-1', name: 'Wash & Fold', price: '₱250' },
            { id: 'offer-item-2', name: 'Dry Cleaning', price: '₱400' },
            { id: 'offer-item-3', name: 'Ironing', price: '₱150' },
            { id: 'offer-item-4', name: 'Shoe Cleaning', price: '₱300' },
          ],
        },
      },
    ],
  },
  {
    key: 'profile',
    title: 'Profile',
    description: 'Account details and lifetime activity stats.',
    icon: 'UserCircle',
    blocks: [{ type: 'avatar-hero' }, { type: 'stat-row' }],
  },
  {
    key: 'support',
    title: 'Support',
    description: 'Frequently asked questions and help topics.',
    icon: 'HelpCircle',
    blocks: [
      {
        type: 'faq',
        props: {
          title: 'FAQs',
          items: [
            {
              id: 'support-item-1',
              question: 'How do I book a pickup?',
              answer: 'Tap "Book a pickup" on the home screen and choose a time that works for you.',
            },
            {
              id: 'support-item-2',
              question: 'What areas do you serve?',
              answer: 'We currently serve Metro Manila, with more cities coming soon.',
            },
            {
              id: 'support-item-3',
              question: 'How do I pay?',
              answer: 'Cash on pickup or any major card — you choose at checkout.',
            },
          ],
        },
      },
    ],
  },
  {
    key: 'sign-in',
    title: 'Sign in',
    description: 'Login and account creation for returning customers.',
    icon: 'KeyRound',
    blocks: [{ type: 'auth-form' }],
  },
];

export function buildScreenFromTemplate(template: ScreenTemplate): AppScreen {
  const blocks: AppBlock[] = template.blocks.map((b, order) => ({
    id: crypto.randomUUID(),
    type: b.type,
    order,
    props: { ...BLOCK_REGISTRY[b.type].defaultProps, ...b.props },
  }));

  return {
    id: crypto.randomUUID(),
    key: template.key,
    title: template.title,
    blocks,
  };
}
