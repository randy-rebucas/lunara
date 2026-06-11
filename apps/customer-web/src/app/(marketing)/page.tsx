import type { Metadata } from 'next';
import { appConfig } from '@lunara/config';
import { HomePage } from '../../components/marketing/home-page';

export const metadata: Metadata = {
  title: `${appConfig.name} — Laundry pickup & delivery`,
  description:
    'Book door-to-door laundry in Metro Manila. Download the app, schedule pickup, track orders live, and pay with GCash, card, wallet, or cash.',
};

export default function MarketingHomePage() {
  return <HomePage />;
}
