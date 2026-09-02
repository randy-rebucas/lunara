import { createContext, useContext } from 'react';
import type { PartnerAppConfig } from '@lunara/types';

const ConfigContext = createContext<PartnerAppConfig | null>(null);

export const ConfigProvider = ConfigContext.Provider;

export function useAppConfig(): PartnerAppConfig | null {
  return useContext(ConfigContext);
}
