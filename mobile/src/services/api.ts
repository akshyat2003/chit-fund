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
