import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PartnerAppConfig } from '@lunara/types';
import { fetchPublishedAppConfig } from '../api/fetch-app-config';

const CACHE_KEY = 'lunara-app-renderer:last-config';

interface AppConfigState {
  config: PartnerAppConfig | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  load: (slug: string) => Promise<void>;
}

export const useAppConfigStore = create<AppConfigState>((set) => ({
  config: null,
  status: 'idle',
  error: null,
  async load(slug: string) {
    set({ status: 'loading', error: null });
    try {
      const config = await fetchPublishedAppConfig(slug);
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(config));
      set({ config, status: 'ready' });
    } catch (err) {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        set({ config: JSON.parse(cached) as PartnerAppConfig, status: 'ready' });
        return;
      }
      set({ status: 'error', error: (err as Error).message });
    }
  },
}));
