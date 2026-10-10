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
  // Automatically logs out when there is no mouse cursor movement or interaction for 5 minutes
  useEffect(() => {
    if (!user) return;

    const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes (300,000ms)
    let lastActivityTime = Date.now();
    let timeoutId: any = null;
    let intervalId: any = null;

    const performAutoLogout = () => {
      console.warn(`[Session] User ${user.username} inactive for 5 minutes without cursor movement. Auto-logging out.`);
      logout('You have been automatically logged out due to 5 minutes of inactivity (no cursor movement).');
    };

    const resetTimer = () => {
      lastActivityTime = Date.now();
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(performAutoLogout, INACTIVITY_TIMEOUT_MS);
    };

    // Initialize 5-minute timer
    resetTimer();

    // Periodic 5-second check (handles laptop sleep, background tabs, and throttled timers)
    intervalId = setInterval(() => {
      if (Date.now() - lastActivityTime >= INACTIVITY_TIMEOUT_MS) {
        performAutoLogout();
      }
    }, 5000);

    // Listen to mouse cursor movements and user interactions on both window and document
    if (typeof window !== 'undefined') {
      let lastThrottleTime = 0;
      const onUserActivity = () => {
        const now = Date.now();
        // Throttle resetting the timer to at most once per second for zero overhead
        if (now - lastThrottleTime >= 1000) {
          lastThrottleTime = now;
          resetTimer();
        }
      };

      const interactionEvents = [
        'mousemove',
        'pointermove',
        'mousedown',
        'mouseup',
        'keydown',
        'keyup',
        'scroll',
        'wheel',
        'touchstart',
        'touchmove',
        'click',
      ];

      interactionEvents.forEach((evt) => {
        window.addEventListener(evt, onUserActivity, { passive: true, capture: true });
        if (typeof document !== 'undefined' && document.addEventListener) {
          document.addEventListener(evt, onUserActivity, { passive: true, capture: true });
        }
      });

      // Immediate check when browser tab becomes visible again
      const onVisibilityChange = () => {
        if (typeof document !== 'undefined' && !document.hidden) {
          if (Date.now() - lastActivityTime >= INACTIVITY_TIMEOUT_MS) {
            performAutoLogout();
          }
        }
      };
      if (typeof document !== 'undefined' && document.addEventListener) {
        document.addEventListener('visibilitychange', onVisibilityChange);
      }

      return () => {
        if (timeoutId) clearTimeout(timeoutId);
        if (intervalId) clearInterval(intervalId);
        interactionEvents.forEach((evt) => {
          window.removeEventListener(evt, onUserActivity, { capture: true } as any);
          if (typeof document !== 'undefined' && document.removeEventListener) {
            document.removeEventListener(evt, onUserActivity, { capture: true } as any);
          }
        });
        if (typeof document !== 'undefined' && document.removeEventListener) {
          document.removeEventListener('visibilitychange', onVisibilityChange);
        }
      };
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, refreshUser, inactivityMessage, clearInactivityMessage }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
