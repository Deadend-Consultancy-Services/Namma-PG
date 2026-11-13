import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User, Message, Notification, Tenancy, RefreshToken } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { upload, uploadToCloudinary, deleteFromCloudinary } from '../middleware/upload.js';
import { asyncH, bad, forbidden, isId, oid } from '../utils/helpers.js';
import { emitTo } from '../services/socket.js';
import { notify } from '../services/notify.js';
import { userDto } from './auth.routes.js';

const router = Router();
router.use(authenticate);

/* ----- Profile ----- */
router.get('/profile', (req, res) => res.json({ success: true, user: { ...userDto(req.user.doc), emergencyContact: req.user.doc.emergencyContact || {} } }));

router.put('/profile', validate(z.object({
  name: z.string().trim().min(2).max(80).optional(),
  email: z.string().trim().email().or(z.literal('')).optional(),
  emergencyContact: z.object({ name: z.string().max(80).optional(), phone: z.string().max(15).optional() }).optional(),
})), asyncH(async (req, res) => {
  const u = await User.findByIdAndUpdate(req.user.id, { $set: req.body }, { new: true });
  res.json({ success: true, user: { ...userDto(u), emergencyContact: u.emergencyContact || {} } });
}));

router.post('/profile/avatar', upload.single('file'), asyncH(async (req, res) => {
  if (!req.file || !req.file.mimetype.startsWith('image/')) throw bad('Please choose an image');
  const u = await User.findById(req.user.id);
  const f = await uploadToCloudinary(req.file, { folder: 'avatars' });
  await deleteFromCloudinary(u.avatar);
  u.avatar = f;
  await u.save();
  res.json({ success: true, user: userDto(u) });
}));

router.put('/profile/password', validate(z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8).max(72) })), asyncH(async (req, res) => {
  const u = await User.findById(req.user.id);
  if (!(await bcrypt.compare(req.body.currentPassword, u.passwordHash))) throw bad('Current password is incorrect');
  u.passwordHash = await bcrypt.hash(req.body.newPassword, 11);
  await u.save();
  await RefreshToken.deleteMany({ user: u._id });
  res.json({ success: true, message: 'Password changed' });
}));

/* ----- Notifications ----- */
router.get('/notifications', asyncH(async (req, res) => {
  const [items, unread] = await Promise.all([
    Notification.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(30).lean(),
    Notification.countDocuments({ user: req.user.id, readAt: null }),
  ]);
  res.json({ success: true, unread, items });
}));
router.put('/notifications/read-all', asyncH(async (req, res) => {
  await Notification.updateMany({ user: req.user.id, readAt: null }, { readAt: new Date() });
  res.json({ success: true });
}));

/* ----- Messages (owner <-> own tenants only) ----- */
async function canChat(me, otherId) {
  if (!isId(otherId)) return false;
  const q = me.role === 'owner' ? { owner: me.id, tenant: otherId } : { tenant: me.id, owner: otherId };
  return !!(await Tenancy.exists(q));
}

router.get('/messages/conversations', asyncH(async (req, res) => {
  const me = req.user;
  const field = me.role === 'owner' ? 'tenant' : 'owner';
  const tenancies = await Tenancy.find(me.role === 'owner' ? { owner: me.id, status: 'active' } : { tenant: me.id })
    .populate(field, 'name phone avatar').populate('room', 'roomNumber').lean();
  const seen = new Set();
  const people = tenancies.map((t) => ({ person: t[field], room: t.room?.roomNumber })).filter((x) => x.person && !seen.has(String(x.person._id)) && seen.add(String(x.person._id)));
  const ids = people.map((p) => p.person._id);
  const [last, unread] = await Promise.all([
    Message.aggregate([
      { $match: { $or: [{ from: oid(me.id), to: { $in: ids } }, { to: oid(me.id), from: { $in: ids } }] } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: { $cond: [{ $eq: ['$from', oid(me.id)] }, '$to', '$from'] }, text: { $first: '$text' }, at: { $first: '$createdAt' } } },
    ]),
    Message.aggregate([{ $match: { to: oid(me.id), readAt: null, from: { $in: ids } } }, { $group: { _id: '$from', n: { $sum: 1 } } }]),
  ]);
  const lastMap = Object.fromEntries(last.map((l) => [String(l._id), l]));
  const unreadMap = Object.fromEntries(unread.map((u) => [String(u._id), u.n]));
  const items = people.map(({ person, room }) => ({
    userId: String(person._id), name: person.name, phone: person.phone, avatarUrl: person.avatar?.url || null, room,
    lastMessage: lastMap[String(person._id)]?.text || '', lastAt: lastMap[String(person._id)]?.at || null, unread: unreadMap[String(person._id)] || 0,
  })).sort((a, b) => new Date(b.lastAt || 0) - new Date(a.lastAt || 0));
  res.json({ success: true, items });
}));

router.get('/messages/unread-count', asyncH(async (req, res) => {
  res.json({ success: true, count: await Message.countDocuments({ to: req.user.id, readAt: null }) });
}));

router.get('/messages/:userId', asyncH(async (req, res) => {
  if (!(await canChat(req.user, req.params.userId))) throw forbidden();
  const q = { $or: [{ from: req.user.id, to: req.params.userId }, { from: req.params.userId, to: req.user.id }] };
  const items = await Message.find(q).sort({ createdAt: -1 }).limit(100).lean();
  await Message.updateMany({ from: req.params.userId, to: req.user.id, readAt: null }, { readAt: new Date() });
  res.json({ success: true, items: items.reverse() });
}));

router.post('/messages', validate(z.object({ to: z.string(), text: z.string().trim().min(1).max(2000) })), asyncH(async (req, res) => {
  if (!(await canChat(req.user, req.body.to))) throw forbidden('You can only message people in your PG');
  const m = await Message.create({ from: req.user.id, to: req.body.to, text: req.body.text });
  emitTo(req.body.to, 'message:new', { from: req.user.id, text: m.text, at: m.createdAt });
  res.status(201).json({ success: true, item: m });
}));

export default router;
