import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/index.js';
import { HttpError, asyncH } from '../utils/helpers.js';

export const signAccess = (user) =>
  jwt.sign({ sub: String(user._id), role: user.role }, env.JWT_SECRET, { expiresIn: '15m' });
export const signRefresh = (user) =>
  jwt.sign({ sub: String(user._id), typ: 'refresh' }, env.JWT_REFRESH_SECRET, { expiresIn: '30d' });
export const verifyAccess = (t) => jwt.verify(t, env.JWT_SECRET);

export const authenticate = asyncH(async (req, _res, next) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) throw new HttpError(401, 'Authentication required', 'NO_TOKEN');
  let payload;
  try { payload = verifyAccess(token); } catch { throw new HttpError(401, 'Session expired', 'TOKEN_EXPIRED'); }
  const user = await User.findById(payload.sub).select('-passwordHash');
  if (!user || !user.claimed) throw new HttpError(401, 'Account not found', 'NO_USER');
  req.user = { id: String(user._id), role: user.role, doc: user };
  next();
});

export const requireRole = (role) => (req, _res, next) =>
  req.user?.role === role ? next() : next(new HttpError(403, 'You do not have access to this resource'));
