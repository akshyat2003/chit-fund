import React, { createContext, useState, useContext, useEffect } from 'react';
import { api, setAuthToken } from '../services/api';

export interface User {
  id: string;
  username: string;
  fullName: string;
  phone: string;
  role: 'SUPER_ADMIN' | 'MANAGER' | 'COLLECTION_STAFF';
  company: { id: string; name: string; code: string };
  branch?: { id: string; name: string; code: string } | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (usernameOrPhone: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const login = async (usernameOrPhone: string, password: string) => {
    try {
      setLoading(true);
      const res = await api.post('/auth/login', { usernameOrPhone, password });
      if (res.data.success) {
        const { accessToken, user: loggedUser } = res.data.data;
        setToken(accessToken);
        setUser(loggedUser);
        setAuthToken(accessToken);
        setLoading(false);
        return { success: true };
      }
      setLoading(false);
      return { success: false, message: res.data.message || 'Login failed' };
    } catch (err: any) {
      setLoading(false);
      const msg = !err.response
        ? 'Network Error: Unable to reach server. Please try again.'
        : err.response?.data?.message || err.message || 'Login failed';
      return { success: false, message: msg };
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // Ignore network errors on logout
    }
    setUser(null);
    setToken(null);
    setAuthToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
