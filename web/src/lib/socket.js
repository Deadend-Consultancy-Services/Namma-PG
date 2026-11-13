import { io } from 'socket.io-client';
import { API_ORIGIN, tokens } from './api.js';
import api from './api.js';

let socket;
export function connectSocket() {
  if (socket) return socket;
  socket = io(API_ORIGIN || undefined, { auth: (cb) => cb({ token: tokens.access }), reconnection: true, reconnectionDelay: 1500 });
  socket.on('connect_error', async () => {
    try { await api.get('/auth/me'); } catch { /* interceptor handles logout */ }
  });
  return socket;
}
export function disconnectSocket() { socket?.disconnect(); socket = undefined; }
