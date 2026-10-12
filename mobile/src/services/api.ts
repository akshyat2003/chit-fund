import axios from 'axios';
import { Platform } from 'react-native';

const getDefaultBaseUrl = () => {
  // If running on Web
  if (typeof window !== 'undefined' && window.location) {
    // If running in local web development (e.g. Metro on port 8081 or 19006), point to local backend port 5000
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      if (window.location.port !== '5000') {
        return 'http://localhost:5000/api/v1';
      }
    }
    return `${window.location.origin}/api/v1`;
  }

  // Native mobile default (production backend URL)
  return 'https://chit-fund-mobile.vercel.app/api/v1';
};

export const API_BASE_URL = getDefaultBaseUrl();

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

// Helper to retrieve tab-isolated token (sessionStorage first for multi-tab isolation, then localStorage)
export const getStoredAuthToken = (): string | null => {
  if (typeof window !== 'undefined') {
    if (window.sessionStorage) {
      const sess = window.sessionStorage.getItem('chitkart_auth_token');
      if (sess) return sess;
    }
    if (window.localStorage) {
      return window.localStorage.getItem('chitkart_auth_token');
    }
  }
  return null;
};

// Ensure EVERY outgoing request carries the tab-specific Bearer token
api.interceptors.request.use(
  (config) => {
    const savedToken = getStoredAuthToken();
    if (savedToken) {
      if (config.headers && typeof (config.headers as any).set === 'function') {
        (config.headers as any).set('Authorization', `Bearer ${savedToken}`);
      } else if (config.headers) {
        config.headers['Authorization'] = `Bearer ${savedToken}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Immediately restore token upon tab launch or reload
const initialToken = getStoredAuthToken();
if (initialToken) {
  api.defaults.headers.common['Authorization'] = `Bearer ${initialToken}`;
}

// Global response interceptor: kick out screen if same account was logged into another screen
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && error.response?.data?.code === 'SESSION_TERMINATED') {
      if (typeof window !== 'undefined' && (window as any).__chitkart_session_terminated_handler) {
        (window as any).__chitkart_session_terminated_handler(
          error.response?.data?.message || 'This account was logged in from another screen. You have been logged out.'
        );
      }
    }
    return Promise.reject(error);
  }
);
