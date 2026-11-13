import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api, { tokens } from '../lib/api.js';
import { disconnectSocket } from '../lib/socket.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!tokens.access);
  const qc = useQueryClient();

  useEffect(() => {
    if (!tokens.access) return;
    api.get('/auth/me').then((r) => setUser(r.data.user)).catch(() => tokens.clear()).finally(() => setLoading(false));
  }, []);

  const setSession = useCallback((data) => { tokens.set(data); setUser(data.user); }, []);
  const logout = useCallback(async () => {
    try { await api.post('/auth/logout', { refreshToken: tokens.refresh }); } catch { /* ignore */ }
    tokens.clear(); disconnectSocket(); qc.clear(); setUser(null);
  }, [qc]);

  return <Ctx.Provider value={{ user, setUser, loading, setSession, logout }}>{children}</Ctx.Provider>;
}
