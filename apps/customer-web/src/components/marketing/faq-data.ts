export type FaqLink = { href: string; label: string };

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
  links?: FaqLink[];
};

export type FaqCategory = {
  id: string;
  label: string;
  description: string;
  items: FaqItem[];
};

export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    id: 'booking',
    label: 'Booking & pickup',
    description: 'Getting started with pickup and delivery.',
    items: [
      {
        id: 'book-pickup',
        question: 'How do I book laundry pickup?',
        answer:
          'Create a free account with your mobile number, add a pickup address, choose a service (wash & fold, dry clean, or express), select add-ons if needed, pick a time slot, and confirm your order. A rider collects your laundry at the scheduled window.',
        links: [{ href: '/signup', label: 'Create account & book' }],
      },
      {
        id: 'pickup-lead-time',
        question: 'How soon can I schedule a pickup?',
        answer:
          'Pickup slots must be at least 30 minutes from the time you book. Available windows depend on branch capacity and your location — you will see open slots when you choose a date and time.',
      },
      {
        id: 'service-areas',
        question: 'Which areas does Lunara serve?',
        answer:
          'We operate in Metro Manila with partner branches in Makati, Quezon City, and BGC. Each branch covers nearby neighborhoods within its service radius. Enter your address when booking to confirm pickup and delivery availability.',
        links: [{ href: '/locations', label: 'View service areas' }],
      },
      {
        id: 'weight-estimate',
        question: 'How do I estimate laundry weight?',
        answer:
          'Use your best guess during booking — you can adjust before pickup if needed. For planning, each machine holds up to 8 kg: 8 kg or less counts as one load, and above 8 kg counts as two loads.',
      },
    ],
  },
  {
    id: 'orders',
    label: 'Orders & delivery',
    description: 'Tracking, timing, and changes.',
    items: [
      {
        id: 'track-order',
        question: 'How can I track my order?',
        answer:
          'Open your order from the dashboard to see live status — rider dispatch, shop processing, out for delivery, and delivered. You will also get notifications when key steps change on web or mobile.',
        links: [{ href: '/login', label: 'Sign in to track' }],
      },
      {
        id: 'turnaround',
        question: 'How long does laundry take?',
        answer:
          'Standard wash-and-fold orders usually return within 24–48 hours, depending on service type and branch capacity. Express options may be available at checkout when your branch supports faster turnaround.',
      },
      {
        id: 'cancel-reschedule',
        question: 'Can I cancel or reschedule an order?',
        answer:
          'You can cancel or reschedule before a rider is dispatched for pickup. After pickup is in progress, contact support from your order details or dashboard for help with changes or refunds.',
      },
    ],
  },
  {
    id: 'payments',
    label: 'Payments & wallet',
    description: 'Checkout options and your Lunara balance.',
    items: [
      {
        id: 'payment-methods',
        question: 'What payment methods are accepted?',
        answer:
          'Pay with GCash, credit or debit card, your Lunara wallet, or cash on pickup or delivery. Available options are shown at checkout before you confirm.',
      },
      {
        id: 'wallet',
        question: 'How does the Lunara wallet work?',
        answer:
          'Top up your wallet from your account and use the balance at checkout. Wallet transactions and refunds appear in your wallet history so you can see credits and debits in one place.',
        links: [{ href: '/login', label: 'Sign in to manage wallet' }],
      },
      {
        id: 'pricing',
        question: 'When do I see the final price?',
        answer:
          'You get a full breakdown before confirming — service rate, estimated weight, add-ons, delivery fee, and any promo applied. The total is shown upfront so there are no surprises at checkout.',
      },
    ],
  },
  {
    id: 'support',
    label: 'Issues & support',
    description: 'Problems with an order or getting help.',
    items: [
      {
        id: 'missing-damaged',
        question: 'What if something is missing or damaged?',
        answer:
          'Report the issue from your order details or open a support ticket from your dashboard. We work with partner shops to investigate and process refunds when appropriate.',
      },
      {
        id: 'contact-support',
        question: 'How do I contact support?',
        answer:
          'Signed-in customers can open a support ticket from the dashboard. You can also email our team — include your order number if you have one so we can help faster.',
      },
    ],
  },
  {
    id: 'account',
    label: 'Account',
    description: 'Profile, sign-in, and data.',
    items: [
      {
        id: 'sign-in',
        question: 'Can I use the same account on web and mobile?',
        answer:
          'Yes. One Lunara account works on the customer website and mobile app. Sign in with the same phone number or credentials on either platform.',
        links: [
          { href: '/login', label: 'Sign in' },
          { href: '/signup', label: 'Create account' },
        ],
      },
      {
        id: 'delete-account',
        question: 'How do I delete my account?',
        answer:
          'Go to Profile → Account settings and request account deletion. We process requests in line with our Privacy Policy.',
        links: [{ href: '/privacy', label: 'Read privacy policy' }],
      },
    ],
  },
  {
    id: 'partners',
    label: 'Partners & riders',
    description: 'Joining the Lunara network.',
    items: [
      {
        id: 'become-partner-rider',
        question: 'How do I become a Lunara partner or rider?',
        answer:
          'Laundry shops can apply through our partner program. Delivery riders can learn about onboarding, earnings, and requirements on our riders page, then contact operations to start an application.',
        links: [
          { href: '/partners', label: 'Partner with Lunara' },
          { href: '/riders', label: 'Drive with Lunara' },
        ],
      },
    ],
  },
];
