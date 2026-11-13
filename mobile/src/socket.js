import { io } from 'socket.io-client';
import { API_ORIGIN, tokens } from './api';
let socket;
export const connectSocket = () => {
  if (!socket) socket = io(API_ORIGIN, { auth: (cb) => cb({ token: tokens.access }), transports: ['websocket'], reconnectionDelay: 2000 });
  return socket;
};
export const disconnectSocket = () => { socket?.disconnect(); socket = undefined; };
