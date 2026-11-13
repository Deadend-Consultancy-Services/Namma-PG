import { Router } from 'express';
import { z } from 'zod';
import { Property, Tenancy, RentPayment, Expense, Reminder, Concern, VisitSlot, VisitBooking, Bed, User } from '../models/index.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { upload, uploadToCloudinary, deleteFromCloudinary } from '../middleware/upload.js';
import { asyncH, bad, notFound, isId, oid, istParts, ymd, newReceiptNo } from '../utils/helpers.js';
import { ensureRentRecords } from '../services/rent.js';
import { notify } from '../services/notify.js';
import { emitTo } from '../services/socket.js';

const r = Router();
r.use(authenticate, requireRole('owner'));
const live = (id) => emitTo(id, 'dashboard:updated', {});

/* ================= RENT ================= */
r.get('/rent', asyncH(async (req, res) => {
  await ensureRentRecords(req.user.id);
  const cur = istParts();
  const month = Number(req.query.month) || cur.month; const year = Number(req.query.year) || cur.year;
  const q = { owner: req.user.id, month, year };
  if (req.query.propertyId) q.property = req.query.propertyId;
  if (req.query.status) q.status = req.query.status;
  const items = await RentPayment.find(q).sort({ dueDate: 1 }).limit(500)
    .populate('tenant', 'name phone avatar').populate({ path: 'tenancy', select: 'room bed', populate: [{ path: 'room', select: 'roomNumber' }, { path: 'bed', select: 'label' }] }).populate('property', 'name').lean();
  const sum = { expected: 0, collected: 0, pending: 0, overdueCount: 0, paidCount: 0 };
  const all = await RentPayment.find({ owner: req.user.id, month, year, ...(req.query.propertyId ? { property: req.query.propertyId } : {}) }).select('amountDue amountPaid status').lean();
  all.forEach((p) => { sum.expected += p.amountDue; sum.collected += p.amountPaid; if (p.status === 'overdue') sum.overdueCount++; if (p.status === 'paid') sum.paidCount++; });
  sum.pending = sum.expected - sum.collected;
  res.json({ success: true, month, year, summary: sum, items });
}));
r.put('/rent/:id/mark-paid', validate(z.object({ method: z.enum(['cash', 'upi', 'bank']), note: z.string().max(200).optional() })), asyncH(async (req, res) => {
  const p = await RentPayment.findOneAndUpdate(
    { _id: req.params.id, owner: req.user.id, status: { $ne: 'paid' } },
    [{ $set: { status: 'paid', paidAt: new Date(), amountPaid: '$amountDue', method: req.body.method, note: req.body.note ?? null, receiptNumber: newReceiptNo() } }],
    { new: true },
  );
  if (!p) throw bad('Payment not found or already paid');
  await notify(p.tenant, { title: 'Rent received', body: `Your rent of ₹${p.amountDue} was recorded as paid (${req.body.method}).`, type: 'payment' });
  emitTo(String(p.tenant), 'payment:updated', { id: String(p._id) });
  live(req.user.id);
  res.json({ success: true, item: p });
}));
r.post('/rent/:id/remind', asyncH(async (req, res) => {
  const p = await RentPayment.findOne({ _id: req.params.id, owner: req.user.id, status: { $in: ['pending', 'overdue', 'failed'] } });
  if (!p) throw bad('Nothing to remind: rent already paid');
  await notify(p.tenant, { title: 'Rent reminder', body: `Your rent of ₹${p.amountDue} for ${p.month}/${p.year} is due.`, type: 'rent' });
  await Reminder.create({ owner: req.user.id, type: 'rent', message: 'Single rent reminder', recipients: [p.tenant] });
  res.json({ success: true });
}));

/* ================= EXPENSES ================= */
const expSchema = z.object({
  propertyId: z.string(), category: z.enum(['maintenance', 'food', 'utilities', 'salary', 'rent', 'supplies', 'other']),
  amount: z.coerce.number().positive('Enter an amount'), date: z.coerce.date(), notes: z.string().max(300).optional(),
});
r.get('/expenses', asyncH(async (req, res) => {
  const q = { owner: req.user.id };
  if (req.query.propertyId) q.property = req.query.propertyId;
  if (req.query.category) q.category = req.query.category;
  if (req.query.from || req.query.to) q.date = { ...(req.query.from ? { $gte: new Date(req.query.from) } : {}), ...(req.query.to ? { $lte: new Date(req.query.to) } : {}) };
  const [items, byCategory] = await Promise.all([
    Expense.find(q).sort({ date: -1 }).limit(500).populate('property', 'name').lean(),
    Expense.aggregate([{ $match: { ...q, owner: oid(req.user.id), ...(q.property ? { property: oid(q.property) } : {}) } }, { $group: { _id: '$category', total: { $sum: '$amount' } } }]),
  ]);
  res.json({ success: true, items, total: items.reduce((s, e) => s + e.amount, 0), byCategory: byCategory.map((c) => ({ category: c._id, total: c.total })) });
}));
r.post('/expenses', upload.single('receipt'), validate(expSchema), asyncH(async (req, res) => {
  const p = await Property.findOne({ _id: req.body.propertyId, owner: req.user.id });
  if (!p) throw notFound('Property not found');
  const { propertyId, ...rest } = req.body;
  const receipt = req.file ? await uploadToCloudinary(req.file, { folder: 'receipts' }) : undefined;
  const e = await Expense.create({ ...rest, property: p._id, owner: req.user.id, receipt });
  live(req.user.id);
  res.status(201).json({ success: true, item: e });
}));
r.put('/expenses/:id', upload.single('receipt'), validate(expSchema.partial()), asyncH(async (req, res) => {
  const e = await Expense.findOne({ _id: req.params.id, owner: req.user.id });
  if (!e) throw notFound('Expense not found');
  const { propertyId, ...rest } = req.body;
  if (propertyId) { if (!(await Property.exists({ _id: propertyId, owner: req.user.id }))) throw notFound('Property not found'); e.property = propertyId; }
  Object.assign(e, rest);
  if (req.file) { await deleteFromCloudinary(e.receipt); e.receipt = await uploadToCloudinary(req.file, { folder: 'receipts' }); }
  await e.save(); live(req.user.id);
  res.json({ success: true, item: e });
}));
r.delete('/expenses/:id', asyncH(async (req, res) => {
  const e = await Expense.findOneAndDelete({ _id: req.params.id, owner: req.user.id });
  if (!e) throw notFound('Expense not found');
  await deleteFromCloudinary(e.receipt); live(req.user.id);
  res.json({ success: true });
}));

/* ================= REMINDERS ================= */
async function rentRecipients(owner) {
  const { month, year } = istParts();
  const rows = await RentPayment.find({ owner, $or: [{ month, year, status: { $in: ['pending', 'overdue', 'failed'] } }, { status: 'overdue' }] }).select('tenant amountDue month year').lean();
  return rows;
}
r.get('/reminders', asyncH(async (req, res) => {
  await ensureRentRecords(req.user.id);
  const [rent, kyc, history] = await Promise.all([
    rentRecipients(req.user.id),
    Tenancy.countDocuments({ owner: req.user.id, status: 'active', kycStatus: { $in: ['pending', 'rejected'] } }),
    Reminder.find({ owner: req.user.id }).sort({ createdAt: -1 }).limit(20).lean(),
  ]);
  res.json({ success: true, rentDue: new Set(rent.map((x) => String(x.tenant))).size, kycPending: kyc, history: history.map((h) => ({ id: h._id, type: h.type, message: h.message, count: h.recipients.length, at: h.createdAt })) });
}));
r.post('/reminders/send', validate(z.object({ type: z.enum(['rent', 'kyc', 'custom']), tenancyIds: z.array(z.string()).optional(), message: z.string().trim().max(300).optional() })), asyncH(async (req, res) => {
  const { type, tenancyIds, message } = req.body;
  let tenants = [];
  if (type === 'rent') {
    const rows = await rentRecipients(req.user.id);
    tenants = [...new Set(rows.map((x) => String(x.tenant)))];
  } else if (type === 'kyc') {
    tenants = (await Tenancy.find({ owner: req.user.id, status: 'active', kycStatus: { $in: ['pending', 'rejected'] } }).select('tenant').lean()).map((t) => String(t.tenant));
  } else {
    if (!message || !tenancyIds?.length) throw bad('Choose tenants and write a message');
    tenants = (await Tenancy.find({ _id: { $in: tenancyIds.filter(isId) }, owner: req.user.id, status: 'active' }).select('tenant').lean()).map((t) => String(t.tenant));
  }
  if (!tenants.length) throw bad('There is nobody to remind right now');
  const titles = { rent: 'Rent reminder', kyc: 'KYC pending', custom: 'Message from your PG owner' };
  const bodies = { rent: 'Your monthly rent is pending. Please pay from the Payments tab.', kyc: 'Please upload your KYC documents to complete verification.', custom: message };
  await Promise.all(tenants.map((t) => notify(t, { title: titles[type], body: message || bodies[type], type })));
  await Reminder.create({ owner: req.user.id, type, message: message || bodies[type], recipients: tenants });
  const notInApp = await User.countDocuments({ _id: { $in: tenants }, claimed: false });
  res.json({ success: true, sent: tenants.length, notInApp });
}));

/* ================= REPORTS ================= */
r.get('/reports', asyncH(async (req, res) => {
  const type = z.enum(['revenue', 'expense', 'occupancy']).parse(req.query.type || 'revenue');
  const owner = oid(req.user.id);
  const pf = req.query.propertyId && isId(req.query.propertyId) ? { property: oid(req.query.propertyId) } : {};
  const from = req.query.from ? new Date(req.query.from) : new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
  const to = req.query.to ? new Date(req.query.to) : new Date();
  if (type === 'revenue') {
    const lo = from.getUTCFullYear() * 12 + from.getUTCMonth() + 1; const hi = to.getUTCFullYear() * 12 + to.getUTCMonth() + 1;
    const rows = await RentPayment.aggregate([
      { $match: { owner, ...pf } }, { $addFields: { idx: { $add: [{ $multiply: ['$year', 12] }, '$month'] } } }, { $match: { idx: { $gte: lo, $lte: hi } } },
      { $group: { _id: { year: '$year', month: '$month' }, expected: { $sum: '$amountDue' }, collected: { $sum: '$amountPaid' } } }, { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);
    const data = rows.map((x) => ({ label: `${x._id.year}-${String(x._id.month).padStart(2, '0')}`, expected: x.expected, collected: x.collected, pending: x.expected - x.collected }));
    return res.json({ success: true, type, rows: data, totals: { expected: data.reduce((s, x) => s + x.expected, 0), collected: data.reduce((s, x) => s + x.collected, 0) } });
  }
  if (type === 'expense') {
    const [byMonth, byCategory] = await Promise.all([
      Expense.aggregate([{ $match: { owner, date: { $gte: from, $lte: to }, ...pf } }, { $group: { _id: { y: { $year: '$date' }, m: { $month: '$date' } }, total: { $sum: '$amount' } } }, { $sort: { '_id.y': 1, '_id.m': 1 } }]),
      Expense.aggregate([{ $match: { owner, date: { $gte: from, $lte: to }, ...pf } }, { $group: { _id: '$category', total: { $sum: '$amount' } } }, { $sort: { total: -1 } }]),
    ]);
    const rows = byMonth.map((x) => ({ label: `${x._id.y}-${String(x._id.m).padStart(2, '0')}`, total: x.total }));
    return res.json({ success: true, type, rows, byCategory: byCategory.map((c) => ({ category: c._id, total: c.total })), totals: { total: rows.reduce((s, x) => s + x.total, 0) } });
  }
  const rows = await Bed.aggregate([{ $match: { owner, ...pf } }, { $group: { _id: '$property', total: { $sum: 1 }, occupied: { $sum: { $cond: [{ $eq: ['$status', 'occupied'] }, 1, 0] } } } },
    { $lookup: { from: 'properties', localField: '_id', foreignField: '_id', as: 'p' } }, { $unwind: '$p' }, { $project: { _id: 0, label: '$p.name', total: 1, occupied: 1, vacant: { $subtract: ['$total', '$occupied'] } } }]);
  res.json({ success: true, type, rows, totals: { total: rows.reduce((s, x) => s + x.total, 0), occupied: rows.reduce((s, x) => s + x.occupied, 0) } });
}));

/* ================= VISITS ================= */
r.get('/visits/slots', asyncH(async (req, res) => {
  const q = { owner: req.user.id, date: { $gte: req.query.from || ymd() } };
  if (req.query.propertyId) q.property = req.query.propertyId;
  res.json({ success: true, items: await VisitSlot.find(q).populate('property', 'name').sort({ date: 1, time: 1 }).limit(300).lean() });
}));
r.post('/visits/slots', validate(z.object({
  propertyId: z.string(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  times: z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)).min(1).max(24),
})), asyncH(async (req, res) => {
  const p = await Property.findOne({ _id: req.body.propertyId, owner: req.user.id });
  if (!p) throw notFound('Property not found');
  if (req.body.date < ymd()) throw bad('Choose today or a future date');
  const docs = [...new Set(req.body.times)].map((time) => ({ owner: req.user.id, property: p._id, date: req.body.date, time }));
  let created = 0;
  try { created = (await VisitSlot.insertMany(docs, { ordered: false })).length; } catch (e) { created = e.insertedDocs?.length ?? 0; }
  res.status(201).json({ success: true, created });
}));
r.delete('/visits/slots/:id', asyncH(async (req, res) => {
  const s = await VisitSlot.findOneAndDelete({ _id: req.params.id, owner: req.user.id, isBooked: false });
  if (!s) throw bad('Slot not found or already booked');
  res.json({ success: true });
}));
r.get('/visits', asyncH(async (req, res) => {
  const items = await VisitBooking.find({ owner: req.user.id, ...(req.query.status ? { status: req.query.status } : {}) }).sort({ date: -1, time: -1 }).limit(200)
    .populate('tenant', 'name phone avatar').populate('property', 'name').lean();
  res.json({ success: true, items });
}));
r.put('/visits/:id/complete', asyncH(async (req, res) => {
  const v = await VisitBooking.findOneAndUpdate({ _id: req.params.id, owner: req.user.id, status: 'upcoming' }, { status: 'completed' }, { new: true });
  if (!v) throw notFound('Booking not found');
  res.json({ success: true });
}));

/* ================= CONCERNS ================= */
r.get('/concerns', asyncH(async (req, res) => {
  const q = { owner: req.user.id };
  if (req.query.status) q.status = req.query.status;
  if (req.query.emergency === 'true') q.isEmergency = true;
  const items = await Concern.find(q).sort({ isEmergency: -1, createdAt: -1 }).limit(200)
    .populate('tenant', 'name phone avatar').populate('property', 'name').lean();
  const rooms = await Tenancy.find({ tenant: { $in: items.map((c) => c.tenant?._id) }, status: 'active' }).populate('room', 'roomNumber').select('tenant room').lean();
  const rm = Object.fromEntries(rooms.map((t) => [String(t.tenant), t.room?.roomNumber]));
  res.json({ success: true, items: items.map((c) => ({ ...c, attachmentUrl: c.attachment?.url || null, attachment: undefined, roomNumber: rm[String(c.tenant?._id)] })) });
}));
r.put('/concerns/:id', validate(z.object({ status: z.enum(['open', 'in_progress', 'resolved']).optional(), message: z.string().trim().max(500).optional() })), asyncH(async (req, res) => {
  const c = await Concern.findOne({ _id: req.params.id, owner: req.user.id });
  if (!c) throw notFound('Concern not found');
  if (req.body.status) c.status = req.body.status;
  if (req.body.message) c.updates.push({ message: req.body.message, by: 'owner' });
  await c.save();
  await notify(c.tenant, { title: 'Update on your concern', body: req.body.message || `Status: ${c.status.replace('_', ' ')}`, type: 'concern' });
  emitTo(String(c.tenant), 'concern:updated', { id: String(c._id) });
  live(req.user.id);
  res.json({ success: true, item: c });
}));

export default r;
