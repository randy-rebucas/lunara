import brandIcon from '@lunara/brand/icon';
import { DEFAULT_PALETTE } from './brand-palette';

/** The default Lunara brand — used as the phone preview's content whenever a
 * partner hasn't uploaded their own logo/name, or explicitly chose to keep the
 * default (unbranded) Lunara app. */
export const LUNARA_BASE_BRAND = {
  name: 'Lunara',
  logoUrl: brandIcon.src,
  palette: DEFAULT_PALETTE,
};
