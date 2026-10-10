import axios from 'axios';
import { Platform } from 'react-native';

const getDefaultBaseUrl = () => {
  // 1. Check if user configured a custom URL in localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const saved = window.localStorage.getItem('CHITKART_API_URL');
      if (saved && saved.trim()) {
        return saved.trim();
      }
    } catch (e) {}
  }

  // 2. If running on Web (in any browser, automatically uses the current website's domain)
  if (typeof window !== 'undefined' && window.location) {
    return `${window.location.origin}/api/v1`;
  }

  // 3. Android Emulator fallback
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5000/api/v1';
  }

  return 'http://localhost:5000/api/v1';
};

export let API_BASE_URL = getDefaultBaseUrl();

export const setCustomBaseUrl = (newUrl: string) => {
  const formatted = newUrl.trim().replace(/\/+$/, '');
  API_BASE_URL = formatted;
  api.defaults.baseURL = formatted;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem('CHITKART_API_URL', formatted);
    } catch (e) {}
  }
};

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
