import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { platformAuthApi } from '../api/platformApi';

const PlatformAuthContext = createContext(null);

export const PlatformAuthProvider = ({ children }) => {
  const [session, setSession] = useState(() => platformAuthApi.cachedSession());
  const [isLoading, setIsLoading] = useState(() => window.location.pathname.startsWith('/platform') && window.location.pathname !== '/platform/login');

  useEffect(() => {
    if (!window.location.pathname.startsWith('/platform') || window.location.pathname === '/platform/login') return;
    platformAuthApi.restore().then(setSession).catch(() => setSession(null)).finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    const clear = () => setSession(null);
    window.addEventListener('erp:platform-session-cleared', clear);
    return () => window.removeEventListener('erp:platform-session-cleared', clear);
  }, []);

  const value = useMemo(() => ({
    session, isLoading,
    login: async (payload) => { const next = await platformAuthApi.login(payload); setSession(next); return next; },
    logout: async () => { await platformAuthApi.logout(); setSession(null); },
  }), [session, isLoading]);

  return <PlatformAuthContext.Provider value={value}>{children}</PlatformAuthContext.Provider>;
};

export const usePlatformAuth = () => {
  const value = useContext(PlatformAuthContext);
  if (!value) throw new Error('usePlatformAuth must be used inside PlatformAuthProvider.');
  return value;
};
