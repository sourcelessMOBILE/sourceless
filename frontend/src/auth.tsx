import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, getToken, setToken, clearToken, getStoredUser, setStoredUser, User } from './api';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName?: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const tok = await getToken();
        if (tok) {
          try {
            const me = await api.me();
            setUser(me);
            await setStoredUser(me);
          } catch {
            const cached = await getStoredUser();
            if (cached) setUser(cached);
            else await clearToken();
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password);
    await setToken(res.access_token);
    await setStoredUser(res.user);
    setUser(res.user);
  };
  const register = async (email: string, password: string, fullName?: string) => {
    const res = await api.register(email, password, fullName);
    await setToken(res.access_token);
    await setStoredUser(res.user);
    setUser(res.user);
  };
  const logout = async () => {
    await clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const c = useContext(AuthContext);
  if (!c) throw new Error('useAuth must be inside AuthProvider');
  return c;
};
