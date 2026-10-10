import axios from 'axios';
import { Platform } from 'react-native';

const getDefaultBaseUrl = () => {
  if (typeof window !== 'undefined' && window.location) {
    // If running on Vercel or any non-localhost web domain, connect to production Render backend
    if (!window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')) {
      return 'https://chit-fund-backend.onrender.com/api/v1';
    }
  }
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5000/api/v1';
  }
  return 'http://localhost:5000/api/v1';
};

export let API_BASE_URL = getDefaultBaseUrl();

export const setCustomBaseUrl = (newUrl: string) => {
  API_BASE_URL = newUrl;
  api.defaults.baseURL = newUrl;
};

export const api = axios.create({
  baseURL: API_BASE_URL,
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
