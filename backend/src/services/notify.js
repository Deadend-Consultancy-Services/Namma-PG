import { Notification } from '../models/index.js';
import { emitTo } from './socket.js';

export async function notify(userId, { title, body = '', type = 'general' }) {
  const n = await Notification.create({ user: userId, title, body, type });
  emitTo(String(userId), 'notification:new', { id: String(n._id), title, body, type });
  return n;
}
