'use client';

import { useEffect, useState } from 'react';
import { loadAdminSettings, type AdminAppSettings } from './admin-settings';

export function useAdminSettings(): AdminAppSettings {
  const [settings, setSettings] = useState<AdminAppSettings>(() => loadAdminSettings());

  useEffect(() => {
    function sync() {
      setSettings(loadAdminSettings());
    }
    window.addEventListener('lunara-admin-settings', sync);
    return () => window.removeEventListener('lunara-admin-settings', sync);
  }, []);

  return settings;
}
