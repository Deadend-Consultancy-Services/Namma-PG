import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

export const API_ORIGIN = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '');
let access = null; let refresh = null; let onLogout = () => {};
export const setOnLogout = (fn) => { onLogout = fn; };

export const tokens = {
  get access() { return access; },
  async load() { access = await SecureStore.getItemAsync('pg_access'); refresh = await SecureStore.getItemAsync('pg_refresh'); return !!refresh; },
  async set(d) { access = d.accessToken; refresh = d.refreshToken; await SecureStore.setItemAsync('pg_access', access); await SecureStore.setItemAsync('pg_refresh', refresh); },
  async clear() { access = null; refresh = null; await SecureStore.deleteItemAsync('pg_access'); await SecureStore.deleteItemAsync('pg_refresh'); },
  get refresh() { return refresh; },
};

const api = axios.create({ baseURL: `${API_ORIGIN}/api`, timeout: 30000 });
api.interceptors.request.use((c) => { if (access) c.headers.Authorization = `Bearer ${access}`; return c; });
let refreshing = null;
api.interceptors.response.use((r) => r, async (error) => {
  const { config, response } = error;
  const isAuth = config?.url?.startsWith('/auth/');
  if (response?.status === 401 && !isAuth) {
    if (!config._retried && refresh) {
      config._retried = true;
      try {
        refreshing ||= axios.post(`${API_ORIGIN}/api/auth/refresh`, { refreshToken: refresh }).finally(() => { refreshing = null; });
        const { data } = await refreshing;
        await tokens.set(data);
        config.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(config);
      } catch { /* fall through */ }
    }
    await tokens.clear(); onLogout();
  }
  return Promise.reject(error);
});
export const errMsg = (e) => e?.response?.data?.message || (e?.code === 'ERR_NETWORK' ? 'Cannot reach the server. Check your internet.' : e?.message || 'Something went wrong');
export default api;
