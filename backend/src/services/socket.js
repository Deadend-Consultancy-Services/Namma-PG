import { Server } from 'socket.io';
import { clientOrigins } from '../config/env.js';
import { verifyAccess } from '../middleware/auth.js';

let io;
export function initSocket(httpServer) {
  io = new Server(httpServer, { cors: { origin: (o, cb) => cb(null, !o || clientOrigins.includes(o) || clientOrigins.includes('*')), credentials: true } });
  io.use((socket, next) => {
    try {
      const p = verifyAccess(socket.handshake.auth?.token);
      socket.data.userId = p.sub;
      next();
    } catch { next(new Error('unauthorized')); }
  });
  io.on('connection', (socket) => socket.join(`user:${socket.data.userId}`));
  return io;
}
export const emitTo = (userId, event, payload = {}) => io?.to(`user:${userId}`).emit(event, payload);
