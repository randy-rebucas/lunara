'use client';

import { useEffect } from 'react';
import { loadAdminSettings } from '../lib/admin-settings';

/** Applies display preferences (e.g. compact tables) to the document root. */
export function AdminSettingsSync() {
  useEffect(() => {
    function apply() {
      const { denseTables } = loadAdminSettings();
      document.documentElement.classList.toggle('admin-dense-tables', denseTables);
    }

    apply();
    window.addEventListener('lunara-admin-settings', apply);
    return () => {
      window.removeEventListener('lunara-admin-settings', apply);
      document.documentElement.classList.remove('admin-dense-tables');
    };
  }, []);

  return null;
}
