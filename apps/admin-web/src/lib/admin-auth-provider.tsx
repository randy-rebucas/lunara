'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { initAdminAuthSession } from '../lib/admin-api';

interface AdminAuthContextValue {
  isReady: boolean;
  isAuthenticated: boolean;
}

const AdminAuthContext = createContext<AdminAuthContextValue>({
  isReady: false,
  isAuthenticated: false,
});

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    setIsAuthenticated(initAdminAuthSession());
    setIsReady(true);
  }, []);

  return (
    <AdminAuthContext.Provider value={{ isReady, isAuthenticated }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  return useContext(AdminAuthContext);
}
