import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { loginWithCredentials, setUnauthorizedHandler } from '../services/api';
import { saveToken, getToken, removeToken, saveUser, getUser, removeUser } from '../services/auth-storage';

interface AuthUser {
  id: string;
  name: string;
  email: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithToken: (token: string, user: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  login: async () => {},
  loginWithToken: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [token, stored] = await Promise.all([getToken(), getUser()]);
        if (token && stored) {
          setUser(stored);
        }
      } catch (e) {
        console.warn('Failed to restore auth session:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await loginWithCredentials(email, password);
    await saveToken(result.token);
    await saveUser(result.user);
    setUser(result.user);
  }, []);

  const loginWithToken = useCallback(async (token: string, user: AuthUser) => {
    await saveToken(token);
    await saveUser(user);
    setUser(user);
  }, []);

  const logout = useCallback(async () => {
    await removeToken();
    await removeUser();
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => { logout(); });
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
