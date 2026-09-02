export interface BrandTheme {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  foreground: string;
  muted: string;
  border: string;
  destructive: string;
}

export interface AppBlock {
  id: string;
  type: string;
  order: number;
  props: Record<string, unknown>;
}

export interface AppScreen {
  id: string;
  key: string;
  title: string;
  blocks: AppBlock[];
}

export type PartnerAppConfigStatus = 'draft' | 'published';

export type AppNavStyle = 'tabs' | 'drawer';

export interface PartnerAppConfig {
  partnerId: string;
  slug: string;
  version: number;
  status: PartnerAppConfigStatus;
  theme: BrandTheme;
  screens: AppScreen[];
  /** How the previewed/shipped app navigates between screens. Optional for configs saved before
   *  this field existed — treat a missing value as 'tabs'. */
  navStyle?: AppNavStyle;
}
