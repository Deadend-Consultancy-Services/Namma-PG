import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api, { tokens, setOnLogout } from './api';
import { disconnectSocket } from './socket';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [role, setRole] = useState(null); // chosen on the role screen
  const qc = useQueryClient();

  const logout = useCallback(async () => {
    try { if (tokens.refresh) await api.post('/auth/logout', { refreshToken: tokens.refresh }); } catch {}
    await tokens.clear(); disconnectSocket(); qc.clear(); setUser(null);
  }, [qc]);

  useEffect(() => {
    setOnLogout(() => { disconnectSocket(); qc.clear(); setUser(null); });
    (async () => {
      try {
        if (await tokens.load()) { const { data } = await api.get('/auth/me'); if (data.user.role === 'tenant') setUser(data.user); else await tokens.clear(); }
      } catch { await tokens.clear(); } finally { setBooting(false); }
    })();
  }, [qc]);

  const setSession = useCallback(async (d) => { await tokens.set(d); setUser(d.user); }, []);
  return <Ctx.Provider value={{ user, setUser, booting, role, setRole, setSession, logout }}>{children}</Ctx.Provider>;
}
