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

// Ensure EVERY outgoing request carries the Bearer token from localStorage
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const savedToken = localStorage.getItem('chitkart_auth_token');
      if (savedToken && !config.headers['Authorization']) {
        config.headers['Authorization'] = `Bearer ${savedToken}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Immediately restore token from localStorage upon browser refresh
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const savedToken = localStorage.getItem('chitkart_auth_token');
    if (savedToken) {
      api.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
    }
  } catch (e) {}
}

let onSessionTerminatedCallback: ((msg: string) => void) | null = null;

export const setOnSessionTerminated = (cb: (msg: string) => void) => {
  onSessionTerminatedCallback = cb;
};

// Response interceptor with graceful session termination
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const msg = error.response?.data?.message || '';
    if (
      status === 401 ||
      (status === 403 &&
        (msg.toLowerCase().includes('token') ||
          msg.toLowerCase().includes('inactive') ||
          msg.toLowerCase().includes('disabled') ||
          msg.toLowerCase().includes('session')))
    ) {
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          localStorage.removeItem('chitkart_auth_token');
          localStorage.removeItem('chitkart_auth_user');
        } catch (e) {}
      }
      if (onSessionTerminatedCallback) {
        onSessionTerminatedCallback(msg || 'Your session has expired. Please log in again.');
      }
    }
    return Promise.reject(error);
  }
);
