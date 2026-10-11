import React, { createContext, useState, useContext, useEffect } from 'react';
import { api, setAuthToken, setOnSessionTerminated } from '../services/api';

export interface User {
  id: string;
  username: string;
  fullName: string;
  phone: string;
  email?: string | null;
  role: 'SUPER_ADMIN' | 'MANAGER' | 'COLLECTION_STAFF';
  company: { id: string; name: string; code: string } | null;
  branch?: { id: string; name: string; code: string } | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (usernameOrPhone: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: (reason?: string) => void;
  refreshUser: () => Promise<void>;
  inactivityMessage: string | null;
  clearInactivityMessage: () => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const getInitialAuth = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const storedToken = localStorage.getItem('chitkart_auth_token');
      const storedUser = localStorage.getItem('chitkart_auth_user');
      if (storedToken && storedUser) {
        setAuthToken(storedToken);
        return { token: storedToken, user: JSON.parse(storedUser) as User };
      }
    } catch (e) {}
  }
  return { token: null, user: null };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialAuth = getInitialAuth();
  const [user, setUser] = useState<User | null>(initialAuth.user);
  const [token, setToken] = useState<string | null>(initialAuth.token);
  const [loading, setLoading] = useState<boolean>(false);
  const [inactivityMessage, setInactivityMessage] = useState<string | null>(null);

  const clearInactivityMessage = () => setInactivityMessage(null);

  // Background verification of persisted session upon browser refresh or app launch
  useEffect(() => {
    if (token) {
      api.get('/auth/me')
        .then((res) => {
          if (res.data.success && res.data.data) {
            setUser(res.data.data);
            if (typeof window !== 'undefined' && window.localStorage) {
              try {
                localStorage.setItem('chitkart_auth_user', JSON.stringify(res.data.data));
              } catch (e) {}
            }
          }
        })
        .catch((err) => {
          if (err.response?.status === 401) {
            // Silently clean up expired token without page reloads or loops
            if (typeof window !== 'undefined' && window.localStorage) {
              try {
                localStorage.removeItem('chitkart_auth_token');
                localStorage.removeItem('chitkart_auth_user');
              } catch (e) {}
            }
            setUser(null);
            setToken(null);
            setAuthToken(null);
          }
        });
    }
  }, []);

  const login = async (usernameOrPhone: string, password: string) => {
    try {
      setLoading(true);
      setInactivityMessage(null);
      const res = await api.post('/auth/login', { usernameOrPhone, password });
      if (res.data.success) {
        const { accessToken, user: loggedUser } = res.data.data;
        setToken(accessToken);
        setUser(loggedUser);
        setAuthToken(accessToken);

        // Persist token and user in localStorage so page refresh doesn't log out
        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            localStorage.setItem('chitkart_auth_token', accessToken);
            localStorage.setItem('chitkart_auth_user', JSON.stringify(loggedUser));
          } catch (e) {}
        }

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

  const refreshUser = async () => {
    try {
      const res = await api.get('/auth/me');
      if (res.data.success && res.data.data) {
        setUser(res.data.data);
        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            localStorage.setItem('chitkart_auth_user', JSON.stringify(res.data.data));
          } catch (e) {}
        }
      }
    } catch (e) {
      // Ignore background errors
    }
  };

  const logout = async (reason?: string) => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // Ignore network errors on logout
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.removeItem('chitkart_auth_token');
        localStorage.removeItem('chitkart_auth_user');
        localStorage.removeItem('chitkart_session_stamp');
      } catch (e) {}
    }

    setUser(null);
    setToken(null);
    setAuthToken(null);
    if (reason) {
      setInactivityMessage(reason);
    }
  };

  // Listen only for explicit 401 session terminations from API requests (without aggressive 5-min timer)
  useEffect(() => {
    if (!user) return;

    setOnSessionTerminated((msg) => {
      logout(msg);
    });
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, refreshUser, inactivityMessage, clearInactivityMessage }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
