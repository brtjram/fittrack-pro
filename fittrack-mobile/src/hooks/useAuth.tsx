import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { loginWithCredentials } from '../services/api';
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
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [token, stored] = await Promise.all([getToken(), getUser()]);
      if (token && stored) {
        setUser(stored);
      }
      setLoading(false);
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await loginWithCredentials(email, password);
    await saveToken(result.token);
    await saveUser(result.user);
    setUser(result.user);
  }, []);

  const logout = useCallback(async () => {
    await removeToken();
    await removeUser();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
