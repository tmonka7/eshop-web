import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';
export const ASSET_URL = import.meta.env.VITE_ASSET_URL || 'http://localhost:5000';

const ACCESS_KEY = 'auramart.access';
const REFRESH_KEY = 'auramart.refresh';

export const tokenStore = {
  get access() {
    return localStorage.getItem(ACCESS_KEY) || '';
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY) || '';
  },
  set({ accessToken, refreshToken }) {
    if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

const client = axios.create({
  baseURL: API_URL,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((config) => {
  const token = tokenStore.access;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// A single in-flight refresh shared by every 401 that lands while it runs.
let refreshing = null;

client.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const { response, config } = error;

    if (!response) {
      return Promise.reject(new Error('Cannot reach the server. Is the API running?'));
    }

    const isAuthCall = config.url?.includes('/auth/login') || config.url?.includes('/auth/register');

    if (response.status === 401 && !config._retried && !isAuthCall && tokenStore.refresh) {
      config._retried = true;
      try {
        refreshing = refreshing || axios.post(`${API_URL}/auth/refresh`, {
          refreshToken: tokenStore.refresh,
        });
        const { data } = await refreshing;
        refreshing = null;
        tokenStore.set(data.data);
        config.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return client(config);
      } catch (_err) {
        refreshing = null;
        tokenStore.clear();
        window.dispatchEvent(new CustomEvent('auramart:signed-out'));
      }
    }

    const message = response.data?.message || 'Something went wrong';
    const err = new Error(message);
    err.status = response.status;
    err.errors = response.data?.errors;
    return Promise.reject(err);
  },
);

export default client;
