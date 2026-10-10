import React, { createContext, useState, useContext, useEffect } from 'react';
import { api, setAuthToken } from '../services/api';

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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [inactivityMessage, setInactivityMessage] = useState<string | null>(null);

  const clearInactivityMessage = () => setInactivityMessage(null);

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
      }
    } catch (e) {
      // Ignore
    }
  };

  const logout = async (reason?: string) => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // Ignore network errors on logout
    }
    setUser(null);
    setToken(null);
    setAuthToken(null);
    if (reason) {
      setInactivityMessage(reason);
    }
  };

  // 5-Minute Inactivity Auto-Logout Tracker (FR-AUTH-010 / SA-01 Session Management)
  // Automatically logs out when the administrator does not move the mouse cursor or interact for 5 minutes
  useEffect(() => {
    if (!user) return;

    const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes (300,000ms)
    let timeoutId: any = null;

    const performAutoLogout = () => {
      console.warn(`[Session] Admin ${user.username} inactive for 5 minutes without mouse movement. Automatically logging out.`);
      logout('You have been automatically logged out due to 5 minutes of inactivity.');
    };

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(performAutoLogout, INACTIVITY_TIMEOUT_MS);
    };

    // Initialize the 5-minute timer
    resetTimer();

    // Listen to mouse cursor movements and user interactions on web
    if (typeof window !== 'undefined' && window.addEventListener) {
      let lastActivityTime = Date.now();
      const onUserActivity = () => {
        const now = Date.now();
        // Throttle resetting the timer to at most once per second for zero performance overhead
        if (now - lastActivityTime > 1000) {
          lastActivityTime = now;
          resetTimer();
        }
      };

      const interactionEvents = [
        'mousemove',
        'pointermove',
        'mousedown',
        'keydown',
        'scroll',
        'wheel',
        'touchstart',
      ];

      interactionEvents.forEach((evt) => {
        window.addEventListener(evt, onUserActivity, { passive: true });
      });

      return () => {
        if (timeoutId) clearTimeout(timeoutId);
        interactionEvents.forEach((evt) => {
          window.removeEventListener(evt, onUserActivity);
        });
      };
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, refreshUser, inactivityMessage, clearInactivityMessage }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
