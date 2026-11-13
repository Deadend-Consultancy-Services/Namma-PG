import axios from 'axios';

const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export const API_ORIGIN = base;
export const tokens = {
  get access() { return localStorage.getItem('pg_access'); },
  get refresh() { return localStorage.getItem('pg_refresh'); },
  set({ accessToken, refreshToken }) { localStorage.setItem('pg_access', accessToken); localStorage.setItem('pg_refresh', refreshToken); },
  clear() { localStorage.removeItem('pg_access'); localStorage.removeItem('pg_refresh'); },
};

const api = axios.create({ baseURL: `${base}/api`, timeout: 30000 });
api.interceptors.request.use((c) => { if (tokens.access) c.headers.Authorization = `Bearer ${tokens.access}`; return c; });

let refreshing = null;
api.interceptors.response.use((r) => r, async (error) => {
  const { config, response } = error;
  const isAuthCall = config?.url?.startsWith('/auth/');
  if (response?.status === 401 && !config._retried && !isAuthCall && tokens.refresh) {
    config._retried = true;
    try {
      refreshing ||= axios.post(`${base}/api/auth/refresh`, { refreshToken: tokens.refresh }).finally(() => { refreshing = null; });
      const { data } = await refreshing;
      tokens.set(data);
      config.headers.Authorization = `Bearer ${data.accessToken}`;
      return api(config);
    } catch {
      tokens.clear();
      window.location.assign('/login?expired=1');
    }
  } else if (response?.status === 401 && !isAuthCall) {
    tokens.clear();
    window.location.assign('/login?expired=1');
  }
  return Promise.reject(error);
});

export const errMsg = (e) => e?.response?.data?.message || (e?.code === 'ERR_NETWORK' ? 'Cannot reach the server. Check your connection.' : e?.message || 'Something went wrong');
export default api;
