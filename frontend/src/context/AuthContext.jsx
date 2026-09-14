import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { authApi, setAccessToken } from '../utils/api';

const AuthContext = createContext(null);
const PUBLIC_AUTH_PATHS = new Set([
  '/',
  '/register',
  '/privacy',
  '/terms',
  '/login',
  '/forgot-password',
  '/reset-password',
]);

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(() => authApi.getCachedSession());
  const [isLoading, setIsLoading] = useState(true);
  const sessionVersionRef = useRef(0);

  const refreshSession = async () => {
    const refreshVersion = sessionVersionRef.current;
    setIsLoading(true);
    try {
      const nextSession = await authApi.getSession();
      if (sessionVersionRef.current === refreshVersion) {
        setSession(nextSession);
      }
      return nextSession;
    } catch {
      if (sessionVersionRef.current === refreshVersion) {
        setSession(null);
      }
      return null;
    } finally {
      if (sessionVersionRef.current === refreshVersion) {
        setIsLoading(false);
      }
    }
  };

  const acceptLogin = (nextSession) => {
    sessionVersionRef.current += 1;
    const savedSession = authApi.persistSession(nextSession);
    setSession(savedSession);
    setIsLoading(false);
    return savedSession;
  };

  const logout = async () => {
    sessionVersionRef.current += 1;
    try {
      await authApi.logout();
    } finally {
      setAccessToken('');
      setSession(null);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const path = window.location?.pathname || '/';
    if (PUBLIC_AUTH_PATHS.has(path) || path.startsWith('/platform')) {
      setIsLoading(false);
      return;
    }
    refreshSession();
  }, []);

  useEffect(() => {
    const handleSessionCleared = () => {
      sessionVersionRef.current += 1;
      setAccessToken('');
      setSession(null);
      setIsLoading(false);
    };

    window.addEventListener('erp:auth-session-cleared', handleSessionCleared);
    return () => window.removeEventListener('erp:auth-session-cleared', handleSessionCleared);
  }, []);

  const value = useMemo(() => ({
    session,
    isLoading,
    acceptLogin,
    refreshSession,
    logout,
  }), [session, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }
  return context;
};
