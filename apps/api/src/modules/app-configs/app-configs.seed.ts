import { validateBlockProps } from '@lunara/blocks';
import type { AppScreen, BrandTheme } from '@lunara/types';
import type { Collection } from 'mongodb';

/** Builds a block with the plan's `${screenKey}-${index}` id convention. */
function block(screenKey: string, index: number, type: string, props: Record<string, unknown>) {
  return { id: `${screenKey}-${index}`, type, order: index, props };
}

const landing: AppScreen = {
  id: 'landing',
  key: 'landing',
  title: 'Landing',
  blocks: [
    block('landing', 0, 'hero', {
      headline: 'Laundry, picked up and delivered',
      subheadline: 'Same-day wash & fold, dry cleaning, and more — right to your door.',
      ctaLabel: 'Get started',
    }),
    block('landing', 1, 'product-grid', {
      title: 'Our services',
      columns: 2,
      items: [
        { id: 'wf', name: 'Wash & Fold', price: '₱80/kg' },
        { id: 'dc', name: 'Dry Cleaning', price: '₱200/kg' },
        { id: 'iron', name: 'Ironing', price: '₱100/kg' },
        { id: 'shoes', name: 'Shoe Cleaning', price: '₱250/kg' },
      ],
    }),
    block('landing', 2, 'testimonial', {
      quote: 'Lunara saved me hours every week. My clothes come back perfectly folded.',
      authorName: 'Angela R.',
      authorRole: 'Customer since 2024',
    }),
    block('landing', 3, 'banner', { message: 'First pickup free for new customers', tone: 'success' }),
  ],
};

const authLogin: AppScreen = {
  id: 'auth-login',
  key: 'auth-login',
  title: 'Log in',
  blocks: [
    block('auth-login', 0, 'hero', { headline: 'Welcome back', subheadline: 'Log in to track your orders' }),
    block('auth-login', 1, 'auth-form', {
      mode: 'login',
      tabs: ['otp', 'email'],
      showCountryPicker: true,
      showTrustBadges: true,
    }),
  ],
};

const authSignup: AppScreen = {
  id: 'auth-signup',
  key: 'auth-signup',
  title: 'Sign up',
  blocks: [
    block('auth-signup', 0, 'stepper-progress', {
      steps: ['Details', 'Verify', 'Address'],
      currentStep: 0,
      variant: 'signup',
    }),
    block('auth-signup', 1, 'auth-form', {
      mode: 'signup',
      tabs: ['otp', 'email'],
      showCountryPicker: true,
      termsText: 'By continuing you agree to our Terms and Privacy Policy',
      showTrustBadges: true,
    }),
  ],
};

const home: AppScreen = {
  id: 'home',
  key: 'home',
  title: 'Home',
  blocks: [
    block('home', 0, 'hero', {
      headline: 'Hi, Maria 👋',
      subheadline: "Here's what's happening with your laundry",
      ctaLabel: 'Book a pickup',
    }),
    block('home', 1, 'order-card-list', {
      title: 'Active orders',
      ctaLabel: 'View all',
      orders: [
        {
          id: 'o1',
          orderNumber: 'LN-10245',
          status: 'in_progress',
          branchName: 'Lunara — Ortigas',
          scheduledAt: 'Today, 2:00 PM',
          itemsSummary: 'Wash & Fold · 6kg',
          total: '₱480.00',
          showStepper: true,
        },
      ],
    }),
    block('home', 2, 'tile-grid', {
      title: 'Quick actions',
      columns: 4,
      tiles: [
        { id: 'book', label: 'Book pickup', icon: 'Shirt' },
        { id: 'track', label: 'Track order', icon: 'MapPin' },
        { id: 'wallet', label: 'Top up', icon: 'Wallet' },
        { id: 'support', label: 'Support', icon: 'MessageCircle' },
      ],
    }),
    block('home', 3, 'product-grid', {
      title: 'Recommended for you',
      columns: 2,
      items: [
        { id: 'r1', name: 'Dry Cleaning', price: '₱200/kg' },
        { id: 'r2', name: 'Shoe Cleaning', price: '₱250/kg' },
      ],
    }),
    block('home', 4, 'banner', { message: 'Free express delivery this week', tone: 'info' }),
    block('home', 5, 'promo', {
      title: 'Refer a friend',
      description: 'Give ₱100, get ₱100 when they book their first order',
      code: 'FRIEND100',
    }),
  ],
};

const orders: AppScreen = {
  id: 'orders',
  key: 'orders',
  title: 'Orders',
  blocks: [
    block('orders', 0, 'filter-chip-list', {
      selectedId: 'ongoing',
      options: [
        { id: 'ongoing', label: 'Ongoing', count: 2 },
        { id: 'past', label: 'Past', count: 12 },
        { id: 'cancelled', label: 'Cancelled', count: 1 },
      ],
    }),
    block('orders', 1, 'order-card-list', {
      title: 'Ongoing',
      orders: [
        {
          id: 'o1',
          orderNumber: 'LN-10245',
          status: 'in_progress',
          branchName: 'Lunara — Ortigas',
          scheduledAt: 'Today, 2:00 PM',
          itemsSummary: 'Wash & Fold · 6kg',
          total: '₱480.00',
          showStepper: true,
        },
      ],
    }),
    block('orders', 2, 'order-card-list', {
      title: 'Past orders',
      orders: [
        {
          id: 'o2',
          orderNumber: 'LN-10230',
          status: 'delivered',
          itemsSummary: 'Dry Cleaning · 3kg',
          total: '₱600.00',
        },
      ],
    }),
    block('orders', 3, 'promo', {
      title: 'Free pickup this week',
      description: 'Book any service and skip the pickup fee',
      code: 'FREEPICKUP',
    }),
  ],
};

const ordersDetail: AppScreen = {
  id: 'orders-detail',
  key: 'orders-detail',
  title: 'Order detail',
  blocks: [
    block('orders-detail', 0, 'status-timeline', {
      title: 'Order LN-10245',
      currentStatus: 'in_progress',
      variant: 'order',
      steps: [
        { status: 'placed', label: 'Order placed', timestamp: '9:00 AM' },
        { status: 'picked_up', label: 'Picked up', timestamp: '10:30 AM' },
        { status: 'in_progress', label: 'Washing in progress' },
        { status: 'out_for_delivery', label: 'Out for delivery' },
        { status: 'delivered', label: 'Delivered' },
      ],
    }),
    block('orders-detail', 1, 'map-picker', {
      mode: 'live',
      centerLabel: 'Ortigas Center, Pasig City',
      markerLabel: 'Your rider',
    }),
    block('orders-detail', 2, 'qr-panel', {
      mode: 'display',
      instructions: 'Show this code to your rider at handoff',
      code: 'LN-10245-HANDOFF',
    }),
    block('orders-detail', 3, 'payment-summary', {
      lineItems: [
        { label: 'Wash & Fold (6kg)', amount: '₱480.00' },
        { label: 'Express return', amount: '₱80.00' },
      ],
      total: '₱560.00',
      status: 'paid',
      methodLabel: 'GCash',
    }),
    block('orders-detail', 4, 'button-row', {
      buttons: [
        { id: 'reschedule', label: 'Reschedule', action: 'reschedule' },
        { id: 'cancel', label: 'Cancel order', action: 'cancel' },
      ],
    }),
  ],
};

const wallet: AppScreen = {
  id: 'wallet',
  key: 'wallet',
  title: 'Wallet',
  blocks: [
    block('wallet', 0, 'balance-card', {
      label: 'Wallet balance',
      amount: '1,240.00',
      currency: '₱',
      subLabel: 'Available for your next booking',
      ctaLabel: 'Top up',
    }),
    block('wallet', 1, 'tile-grid', {
      title: 'Top up amount',
      columns: 4,
      tiles: [
        { id: 't1', label: '₱500', value: '₱500' },
        { id: 't2', label: '₱1000', value: '₱1000' },
        { id: 't3', label: '₱2000', value: '₱2000' },
        { id: 't4', label: 'Custom', value: '' },
      ],
    }),
    block('wallet', 2, 'transaction-list', {
      title: 'Recent transactions',
      transactions: [
        { id: 't1', label: 'Wallet top-up', amount: '₱500.00', direction: 'credit', timestamp: 'Sep 1, 2026' },
        {
          id: 't2',
          label: 'Order LN-10230',
          amount: '₱600.00',
          direction: 'debit',
          timestamp: 'Aug 29, 2026',
          status: 'paid',
        },
      ],
    }),
  ],
};

const profile: AppScreen = {
  id: 'profile',
  key: 'profile',
  title: 'Profile',
  blocks: [
    block('profile', 0, 'avatar-hero', {
      name: 'Maria Santos',
      subtitle: 'Member since 2024',
      editable: true,
    }),
    block('profile', 1, 'form-card', {
      title: 'Your details',
      submitLabel: 'Save changes',
      fields: [
        { id: 'fullName', label: 'Full name', type: 'text', required: true },
        { id: 'phone', label: 'Mobile number', type: 'phone', required: true },
        { id: 'email', label: 'Email', type: 'email' },
      ],
    }),
    block('profile', 2, 'stat-row', {
      title: 'Your impact',
      stats: [
        { id: 's1', label: 'Orders', value: '24', icon: 'Package' },
        { id: 's2', label: 'kg washed', value: '132', icon: 'Shirt' },
        { id: 's3', label: 'Water saved', value: '480L', icon: 'Droplet' },
      ],
    }),
    block('profile', 3, 'address-list', {
      title: 'Saved addresses',
      allowAdd: true,
      addLabel: 'Add new address',
      addresses: [
        { id: 'a1', label: 'Home', line1: '12 Kalayaan Ave, Unit 4B', line2: 'Quezon City', isDefault: true },
        { id: 'a2', label: 'Office', line1: '8th Floor, Ortigas Tower' },
      ],
    }),
    block('profile', 4, 'data-list', {
      title: 'Favorite services',
      layout: 'row',
      items: [
        { id: 'f1', title: 'Wash & Fold', subtitle: 'Most booked' },
        { id: 'f2', title: 'Dry Cleaning' },
      ],
    }),
    block('profile', 5, 'menu-list', {
      title: 'Account',
      items: [
        { id: 'payment', label: 'Payment methods', icon: 'CreditCard', route: '/payment' },
        { id: 'notifications', label: 'Notification settings', icon: 'Bell', route: '/notifications' },
      ],
    }),
    block('profile', 6, 'menu-list', {
      title: 'Help & preferences',
      items: [
        { id: 'help', label: 'Help center', icon: 'HelpCircle', route: '/help' },
        { id: 'language', label: 'Language', icon: 'Globe', value: 'English' },
        { id: 'logout', label: 'Log out', icon: 'LogOut', danger: true },
      ],
    }),
    block('profile', 7, 'tile-grid', {
      title: 'Share Lunara',
      columns: 2,
      tiles: [
        { id: 'refer', label: 'Refer a friend', icon: 'Gift' },
        { id: 'rate', label: 'Rate the app', icon: 'Star' },
      ],
    }),
  ],
};

const book: AppScreen = {
  id: 'book',
  key: 'book',
  title: 'Book a pickup',
  blocks: [
    block('book', 0, 'stepper-progress', {
      steps: ['Service', 'Weight', 'Address', 'Schedule', 'Review'],
      currentStep: 0,
      variant: 'booking',
    }),
    block('book', 1, 'product-grid', {
      title: 'Choose a service',
      columns: 2,
      items: [
        { id: 'wf', name: 'Wash & Fold', price: '₱80/kg' },
        { id: 'wdf', name: 'Wash, Dry & Fold', price: '₱120/kg' },
        { id: 'dc', name: 'Dry Cleaning', price: '₱200/kg' },
      ],
    }),
    block('book', 2, 'form-card', {
      title: 'Estimated weight',
      description: 'Not sure? We weigh it for you at pickup.',
      submitLabel: 'Continue',
      fields: [{ id: 'weight', label: 'Weight (kg)', type: 'text', placeholder: '6' }],
    }),
    block('book', 3, 'address-list', {
      title: 'Pickup address',
      allowAdd: true,
      addLabel: 'Add new address',
      addresses: [
        { id: 'a1', label: 'Home', line1: '12 Kalayaan Ave, Unit 4B', line2: 'Quezon City', isDefault: true },
      ],
    }),
    block('book', 4, 'map-picker', { mode: 'pick', centerLabel: 'Quezon City' }),
    block('book', 5, 'payment-summary', {
      lineItems: [{ label: 'Wash & Fold (6kg est.)', amount: '₱480.00' }],
      total: '₱480.00',
      status: 'pending',
      ctaLabel: 'Confirm booking',
    }),
  ],
};

const checkout: AppScreen = {
  id: 'checkout',
  key: 'checkout',
  title: 'Checkout',
  blocks: [
    block('checkout', 0, 'payment-summary', {
      lineItems: [
        { label: 'Wash & Fold (6kg)', amount: '₱480.00' },
        { label: 'Express return', amount: '₱80.00' },
      ],
      total: '₱560.00',
      status: 'pending',
      methodLabel: 'GCash',
      ctaLabel: 'Pay now',
    }),
    block('checkout', 1, 'button-row', {
      buttons: [{ id: 'change-method', label: 'Change payment method', action: 'change-method' }],
    }),
  ],
};

const checkoutSuccess: AppScreen = {
  id: 'checkout-success',
  key: 'checkout-success',
  title: 'Payment successful',
  blocks: [
    block('checkout-success', 0, 'receipt-card', {
      orderNumber: 'LN-10245',
      amount: '₱560.00',
      timestamp: 'Sep 2, 2026 · 2:14 PM',
      methodLabel: 'GCash',
      shareLabel: 'Share receipt',
    }),
    block('checkout-success', 1, 'button-row', {
      buttons: [{ id: 'track', label: 'Track your order', action: 'track' }],
    }),
  ],
};

const onboardingProfile: AppScreen = {
  id: 'onboarding-profile',
  key: 'onboarding-profile',
  title: 'Tell us about you',
  blocks: [
    block('onboarding-profile', 0, 'stepper-progress', {
      steps: ['Profile', 'Address'],
      currentStep: 0,
      variant: 'onboarding',
    }),
    block('onboarding-profile', 1, 'form-card', {
      title: 'Your details',
      description: 'This helps us personalize your experience',
      submitLabel: 'Continue',
      fields: [
        { id: 'fullName', label: 'Full name', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'email' },
        { id: 'birthday', label: 'Birthday', type: 'text', placeholder: 'MM/DD/YYYY' },
      ],
    }),
  ],
};

const onboardingAddress: AppScreen = {
  id: 'onboarding-address',
  key: 'onboarding-address',
  title: 'Where should we pick up?',
  blocks: [
    block('onboarding-address', 0, 'stepper-progress', {
      steps: ['Profile', 'Address'],
      currentStep: 1,
      variant: 'onboarding',
    }),
    block('onboarding-address', 1, 'map-picker', { mode: 'pick', centerLabel: 'Metro Manila' }),
    block('onboarding-address', 2, 'form-card', {
      title: 'Address details',
      submitLabel: 'Finish',
      fields: [
        { id: 'label', label: 'Label', type: 'text', placeholder: 'Home' },
        { id: 'line1', label: 'Street address', type: 'text', required: true },
        { id: 'line2', label: 'City', type: 'text' },
      ],
    }),
  ],
};

const refunds: AppScreen = {
  id: 'refunds',
  key: 'refunds',
  title: 'Refunds',
  blocks: [
    block('refunds', 0, 'data-list', {
      title: 'Refund requests',
      emptyStateText: "You haven't requested any refunds",
      items: [
        {
          id: 'r1',
          title: 'Refund for LN-10190',
          subtitle: 'Missing item',
          timestamp: 'Aug 20, 2026',
          badge: 'Processing',
          badgeVariant: 'warning',
        },
        {
          id: 'r2',
          title: 'Refund for LN-10102',
          subtitle: 'Damaged item',
          timestamp: 'Jul 12, 2026',
          badge: 'Approved',
          badgeVariant: 'success',
        },
      ],
    }),
    block('refunds', 1, 'form-card', {
      title: 'Report an issue',
      description: 'Lost or damaged item? Let us know.',
      submitLabel: 'Submit request',
      fields: [
        { id: 'orderNumber', label: 'Order number', type: 'text', required: true },
        { id: 'issue', label: 'What happened?', type: 'textarea', required: true },
      ],
    }),
  ],
};

const refundsDetail: AppScreen = {
  id: 'refunds-detail',
  key: 'refunds-detail',
  title: 'Refund detail',
  blocks: [
    block('refunds-detail', 0, 'status-timeline', {
      title: 'Refund for LN-10190',
      currentStatus: 'reviewing',
      variant: 'refund',
      steps: [
        { status: 'submitted', label: 'Request submitted', timestamp: 'Aug 20, 2026' },
        { status: 'reviewing', label: 'Under review' },
        { status: 'approved', label: 'Approved' },
        { status: 'refunded', label: 'Refunded to wallet' },
      ],
    }),
    block('refunds-detail', 1, 'data-list', {
      title: 'Details',
      items: [{ id: 'd1', title: 'Missing item', subtitle: '1 blue polo shirt not returned' }],
    }),
  ],
};

const support: AppScreen = {
  id: 'support',
  key: 'support',
  title: 'Support',
  blocks: [
    block('support', 0, 'data-list', {
      title: 'Your tickets',
      emptyStateText: 'No support tickets yet',
      items: [
        {
          id: 't1',
          title: 'Late pickup on LN-10188',
          subtitle: 'Rider was 40 minutes late',
          timestamp: 'Aug 18, 2026',
          badge: 'Resolved',
          badgeVariant: 'success',
        },
      ],
    }),
    block('support', 1, 'form-card', {
      title: 'Contact support',
      description: "We'll get back to you within 24 hours",
      submitLabel: 'Send message',
      fields: [
        { id: 'topic', label: 'Topic', type: 'select', options: ['Order issue', 'Payment', 'Account', 'Other'] },
        { id: 'message', label: 'Message', type: 'textarea', required: true },
      ],
    }),
    block('support', 2, 'menu-list', {
      title: 'FAQs',
      items: [
        { id: 'f1', label: 'How do I reschedule a pickup?' },
        { id: 'f2', label: 'What if my item is damaged?' },
      ],
    }),
  ],
};

const supportDetail: AppScreen = {
  id: 'support-detail',
  key: 'support-detail',
  title: 'Ticket detail',
  blocks: [
    block('support-detail', 0, 'status-timeline', {
      title: 'Late pickup on LN-10188',
      currentStatus: 'resolved',
      variant: 'support',
      steps: [
        { status: 'submitted', label: 'Ticket submitted', timestamp: 'Aug 18, 2026' },
        { status: 'in_review', label: 'Agent assigned' },
        { status: 'resolved', label: 'Resolved' },
      ],
    }),
    block('support-detail', 1, 'data-list', {
      title: 'Conversation',
      layout: 'row',
      items: [
        { id: 'm1', title: 'You', subtitle: 'Rider was 40 minutes late', timestamp: '9:10 AM' },
        { id: 'm2', title: 'Support', subtitle: 'Sorry about that — here is a ₱50 credit', timestamp: '10:02 AM' },
      ],
    }),
  ],
};

const notifications: AppScreen = {
  id: 'notifications',
  key: 'notifications',
  title: 'Notifications',
  blocks: [
    block('notifications', 0, 'data-list', {
      title: 'Notifications',
      emptyStateText: "You're all caught up",
      items: [
        {
          id: 'n1',
          title: 'Pickup confirmed',
          subtitle: 'Your rider is on the way',
          timestamp: '2m ago',
          badge: 'New',
          badgeVariant: 'info',
        },
        { id: 'n2', title: 'Order delivered', subtitle: 'Thanks for choosing Lunara', timestamp: '1d ago' },
        { id: 'n3', title: 'Wallet top-up successful', subtitle: '₱500.00 added', timestamp: '3d ago' },
      ],
    }),
  ],
};

const review: AppScreen = {
  id: 'review',
  key: 'review',
  title: 'Rate your order',
  blocks: [
    block('review', 0, 'form-card', {
      title: 'How was LN-10230?',
      description: 'Your feedback helps us improve',
      submitLabel: 'Submit review',
      fields: [
        { id: 'rating', label: 'Rating', type: 'rating', required: true },
        { id: 'comment', label: 'Additional comments', type: 'textarea' },
      ],
    }),
  ],
};

const rewards: AppScreen = {
  id: 'rewards',
  key: 'rewards',
  title: 'Rewards',
  blocks: [
    block('rewards', 0, 'balance-card', {
      label: 'Reward points',
      amount: '2,450',
      currency: '',
      subLabel: '550 points to next tier',
      tier: 'Gold member',
    }),
    block('rewards', 1, 'stat-row', {
      title: 'Tier progress',
      stats: [
        { id: 's1', label: 'This month', value: '120 pts' },
        { id: 's2', label: 'Lifetime', value: '2,450 pts' },
        { id: 's3', label: 'Next tier', value: 'Platinum' },
      ],
    }),
    block('rewards', 2, 'tile-grid', {
      title: 'Redeem points',
      columns: 3,
      tiles: [
        { id: 'r1', label: '₱50 off', value: '500 pts' },
        { id: 'r2', label: '₱150 off', value: '1200 pts' },
        { id: 'r3', label: 'Free pickup', value: '300 pts' },
      ],
    }),
    block('rewards', 3, 'transaction-list', {
      title: 'Points history',
      transactions: [
        { id: 'p1', label: 'Order LN-10245', amount: '48 pts', direction: 'credit', timestamp: 'Sep 2, 2026' },
        { id: 'p2', label: 'Redeemed ₱50 off', amount: '500 pts', direction: 'debit', timestamp: 'Aug 15, 2026' },
      ],
    }),
  ],
};

const scanTag: AppScreen = {
  id: 'scan-tag',
  key: 'scan-tag',
  title: 'Scan tag',
  blocks: [
    block('scan-tag', 0, 'qr-panel', {
      mode: 'scan',
      instructions: 'Scan the bag tag to check in your order',
    }),
    block('scan-tag', 1, 'map-picker', { mode: 'static', centerLabel: 'Lunara — Ortigas branch' }),
  ],
};

const subscriptions: AppScreen = {
  id: 'subscriptions',
  key: 'subscriptions',
  title: 'Subscriptions',
  blocks: [
    block('subscriptions', 0, 'data-list', {
      title: 'Your plan',
      items: [
        {
          id: 'sub1',
          title: 'Lunara Unlimited — Monthly',
          subtitle: 'Unlimited wash & fold up to 30kg/month',
          badge: 'Active',
          badgeVariant: 'success',
          actionLabel: 'Manage',
        },
      ],
    }),
    block('subscriptions', 1, 'tile-grid', {
      title: 'Available plans',
      columns: 2,
      tiles: [
        { id: 'basic', label: 'Basic', value: '₱999/mo' },
        { id: 'unlimited', label: 'Unlimited', value: '₱1999/mo' },
      ],
    }),
    block('subscriptions', 2, 'payment-summary', {
      lineItems: [{ label: 'Lunara Unlimited — Monthly', amount: '₱1,999.00' }],
      total: '₱1,999.00',
      status: 'paid',
      methodLabel: 'GCash',
    }),
  ],
};

export const SCREENS: AppScreen[] = [
  landing,
  authLogin,
  authSignup,
  home,
  orders,
  ordersDetail,
  wallet,
  profile,
  book,
  checkout,
  checkoutSuccess,
  onboardingProfile,
  onboardingAddress,
  refunds,
  refundsDetail,
  support,
  supportDetail,
  notifications,
  review,
  rewards,
  scanTag,
  subscriptions,
];

/** Seeds the full customer-mobile-derived screen set as a partner's draft app config, mirroring
 *  `reseedLaundryServices`'s updateOne+upsert shape. Writes a draft (not published) so it goes
 *  through app-builder review before going live. Every block's props are validated against the
 *  @lunara/blocks registry first — mirrors AppConfigsService.validateScreens. */
export async function reseedAppConfigScreens(
  collection: Collection,
  opts: { partnerId: string; slug: string; theme: BrandTheme },
) {
  for (const screen of SCREENS) {
    for (const b of screen.blocks) {
      try {
        validateBlockProps(b.type, b.props);
      } catch (err) {
        throw new Error(`Invalid props for block "${b.id}" (${b.type}): ${(err as Error).message}`);
      }
    }
  }

  const now = new Date();
  await collection.updateOne(
    { partnerId: opts.partnerId, status: 'draft' },
    {
      $set: {
        partnerId: opts.partnerId,
        slug: opts.slug,
        theme: opts.theme,
        screens: SCREENS,
        updatedAt: now,
      },
      $setOnInsert: { version: 1, status: 'draft', createdAt: now },
    },
    { upsert: true },
  );
  console.log(`  Seeded ${SCREENS.length} screens for partner ${opts.partnerId} (slug: ${opts.slug})`);
}
