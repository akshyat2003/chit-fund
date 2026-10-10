import axios from 'axios';
import { Platform } from 'react-native';

const getDefaultBaseUrl = () => {
  // If running on Web (in any browser, automatically uses the current website's domain)
  if (typeof window !== 'undefined' && window.location) {
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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && error.response?.data?.code === 'SESSION_TERMINATED') {
      if (onSessionTerminatedCallback) {
        onSessionTerminatedCallback(
          error.response?.data?.message || 'You have been logged out because this account was signed in from another window or device.'
        );
      }
    }
    return Promise.reject(error);
  }
);
