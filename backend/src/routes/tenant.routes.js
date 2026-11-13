import { Router } from 'express';
import { z } from 'zod';
import { Property, Room, Bed, Tenancy, Facility, FoodMenu, Review, VisitSlot, VisitBooking, RentPayment, Concern, KycDocument, VacateNotice, User } from '../models/index.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { upload, uploadToCloudinary } from '../middleware/upload.js';
import { asyncH, bad, notFound, forbidden, isId, oid, ymd, escapeRegex, istParts } from '../utils/helpers.js';
import { ensureRentRecords } from '../services/rent.js';
import { recomputeKyc } from '../services/tenancy.js';
import { notify } from '../services/notify.js';
import { emitTo } from '../services/socket.js';
import { razorpay, verifyPaymentSignature } from '../services/razorpay.js';
import { env } from '../config/env.js';
import { markPaid } from '../services/payments.js';

const r = Router();
r.use(authenticate, requireRole('tenant'));

const myStay = async (req, required = true) => {
  const t = await Tenancy.findOne({ tenant: req.user.id, status: 'active' }).populate('property', 'name address city locality').populate('room', 'roomNumber sharingType floor').populate('bed', 'label');
  if (!t && required) throw bad('You are not assigned to a PG yet', 'NO_STAY');
  return t;
};

/* ================= SEARCH ================= */
r.get('/pgs/search', asyncH(async (req, res) => {
  const { q, area, locality, minPrice, maxPrice, type, sharing } = req.query;
  const page = Math.max(1, Number(req.query.page) || 1); const limit = 12;
  const rq = {};
  if (sharing) rq.sharingType = Number(sharing);
  if (minPrice || maxPrice) rq.rentPerBed = { ...(minPrice ? { $gte: Number(minPrice) } : {}), ...(maxPrice ? { $lte: Number(maxPrice) } : {}) };
  const pq = { isActive: true };
  if (type) pq.pgType = type;
  if (area) pq.city = new RegExp(escapeRegex(area), 'i');
  if (locality) pq.locality = new RegExp(escapeRegex(locality), 'i');
  if (q) { const rx = new RegExp(escapeRegex(q), 'i'); pq.$or = [{ name: rx }, { city: rx }, { locality: rx }, { address: rx }]; }
  if (Object.keys(rq).length) pq._id = { $in: await Room.distinct('property', rq) };
  const [props, total] = await Promise.all([Property.find(pq).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).select('-owner').lean(), Property.countDocuments(pq)]);
  const ids = props.map((p) => p._id);
  const [rooms, beds, ratings, facs] = await Promise.all([
    Room.aggregate([{ $match: { property: { $in: ids } } }, { $group: { _id: '$property', minRent: { $min: '$rentPerBed' }, maxRent: { $max: '$rentPerBed' } } }]),
    Bed.aggregate([{ $match: { property: { $in: ids }, status: 'vacant' } }, { $group: { _id: '$property', vacant: { $sum: 1 } } }]),
    Review.aggregate([{ $match: { property: { $in: ids } } }, { $group: { _id: '$property', avg: { $avg: '$rating' }, n: { $sum: 1 } } }]),
    Facility.find({ property: { $in: [...ids, null] }, isActive: true }).select('name icon property').lean(),
  ]);
  const m = (a) => Object.fromEntries(a.map((x) => [String(x._id), x]));
  const rm = m(rooms), bm = m(beds), ratm = m(ratings);
  res.json({
    success: true, page, total, pages: Math.ceil(total / limit),
    items: props.map((p) => ({
      ...p, images: p.images.map((i) => i.url), minRent: rm[String(p._id)]?.minRent ?? null, maxRent: rm[String(p._id)]?.maxRent ?? null,
      vacantBeds: bm[String(p._id)]?.vacant || 0, rating: ratm[String(p._id)] ? Math.round(ratm[String(p._id)].avg * 10) / 10 : null, reviewCount: ratm[String(p._id)]?.n || 0,
      facilities: facs.filter((f) => !f.property || String(f.property) === String(p._id)).slice(0, 6).map((f) => ({ name: f.name, icon: f.icon })),
    })),
  });
}));

r.get('/pgs/:id', asyncH(async (req, res) => {
  if (!isId(req.params.id)) throw notFound();
  const p = await Property.findOne({ _id: req.params.id, isActive: true }).populate('owner', 'name').lean();
  if (!p) throw notFound('PG not found');
  const [facs, rooms, beds, rating] = await Promise.all([
    Facility.find({ owner: p.owner._id, isActive: true, property: { $in: [p._id, null] } }).select('name icon').lean(),
    Room.find({ property: p._id }).select('sharingType rentPerBed').lean(),
    Bed.aggregate([{ $match: { property: p._id, status: 'vacant' } }, { $lookup: { from: 'rooms', localField: 'room', foreignField: '_id', as: 'r' } }, { $unwind: '$r' }, { $group: { _id: '$r.sharingType', vacant: { $sum: 1 } } }]),
    Review.aggregate([{ $match: { property: p._id } }, { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } }]),
  ]);
  const vac = Object.fromEntries(beds.map((b) => [b._id, b.vacant]));
  const types = {};
  rooms.forEach((rm) => { const t = (types[rm.sharingType] ||= { sharingType: rm.sharingType, minRent: rm.rentPerBed, vacant: vac[rm.sharingType] || 0 }); t.minRent = Math.min(t.minRent, rm.rentPerBed); });
  res.json({ success: true, item: { ...p, owner: { name: p.owner.name }, images: p.images.map((i) => i.url), facilities: facs, roomTypes: Object.values(types).sort((a, b) => a.sharingType - b.sharingType), rating: rating[0] ? Math.round(rating[0].avg * 10) / 10 : null, reviewCount: rating[0]?.n || 0 } });
}));

r.get('/pgs/:id/reviews', asyncH(async (req, res) => {
  const items = await Review.find({ property: req.params.id }).sort({ createdAt: -1 }).limit(50).populate('tenant', 'name avatar').lean();
  res.json({ success: true, items: items.map((x) => ({ id: x._id, rating: x.rating, comment: x.comment, createdAt: x.createdAt, name: x.tenant?.name, avatarUrl: x.tenant?.avatar?.url || null })) });
}));
r.post('/pgs/:id/reviews', validate(z.object({ rating: z.coerce.number().int().min(1).max(5), comment: z.string().trim().max(1000).optional() })), asyncH(async (req, res) => {
  if (!(await Tenancy.exists({ tenant: req.user.id, property: req.params.id }))) throw forbidden('Only people who have stayed here can leave a review');
  const rv = await Review.findOneAndUpdate({ property: req.params.id, tenant: req.user.id }, { $set: req.body }, { upsert: true, new: true, setDefaultsOnInsert: true });
  res.status(201).json({ success: true, item: rv });
}));

/* ================= VISITS ================= */
r.get('/pgs/:id/slots', asyncH(async (req, res) => {
  const date = req.query.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw bad('Choose a date');
  const q = { property: req.params.id, date };
  const slots = await VisitSlot.find(q).sort({ time: 1 }).lean();
  const nowIst = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString();
  const items = slots.map((s) => ({ id: s._id, time: s.time, available: !s.isBooked && `${s.date}T${s.time}` > nowIst.slice(0, 16) }));
  res.json({ success: true, items });
}));
r.get('/pgs/:id/slot-dates', asyncH(async (req, res) => {
  const dates = await VisitSlot.distinct('date', { property: req.params.id, isBooked: false, date: { $gte: ymd() } });
  res.json({ success: true, dates: dates.sort() });
}));
r.post('/visits', validate(z.object({ slotId: z.string() })), asyncH(async (req, res) => {
  const slot = await VisitSlot.findOneAndUpdate({ _id: req.body.slotId, isBooked: false, date: { $gte: ymd() } }, { isBooked: true }, { new: true });
  if (!slot) throw bad('Sorry, this slot was just taken. Please pick another.');
  const v = await VisitBooking.create({ owner: slot.owner, tenant: req.user.id, property: slot.property, slot: slot._id, date: slot.date, time: slot.time });
  await notify(slot.owner, { title: 'New visit booked', body: `${req.user.doc.name} booked a visit on ${slot.date} at ${slot.time}.`, type: 'visit' });
  emitTo(String(slot.owner), 'dashboard:updated', {});
  res.status(201).json({ success: true, item: v });
}));
r.get('/visits', asyncH(async (req, res) => {
  const items = await VisitBooking.find({ tenant: req.user.id }).sort({ date: -1, time: -1 }).populate('property', 'name address locality city').lean();
  res.json({ success: true, items });
}));
r.put('/visits/:id/cancel', asyncH(async (req, res) => {
  const v = await VisitBooking.findOneAndUpdate({ _id: req.params.id, tenant: req.user.id, status: 'upcoming' }, { status: 'cancelled' }, { new: true });
  if (!v) throw notFound('Booking not found');
  await VisitSlot.updateOne({ _id: v.slot }, { isBooked: false });
  res.json({ success: true });
}));

/* ================= MY STAY ================= */
r.get('/stay', asyncH(async (req, res) => {
  const t = await myStay(req, false);
  if (!t) return res.json({ success: true, item: null });
  const owner = await User.findById(t.owner).select('name phone').lean();
  const notice = await VacateNotice.findOne({ tenancy: t._id, status: 'notice_given' }).lean();
  res.json({ success: true, item: { ...t.toObject(), owner, notice } });
}));
r.post('/vacate-notice', validate(z.object({ vacateDate: z.coerce.date(), reason: z.string().max(300).optional() })), asyncH(async (req, res) => {
  const t = await myStay(req);
  if (await VacateNotice.exists({ tenancy: t._id, status: 'notice_given' })) throw bad('You have already given a vacate notice');
  if (req.body.vacateDate < new Date()) throw bad('Vacate date must be in the future');
  const n = await VacateNotice.create({ owner: t.owner, tenant: req.user.id, tenancy: t._id, vacateDate: req.body.vacateDate, reason: req.body.reason, requestedBy: 'tenant' });
  await notify(t.owner, { title: 'Vacate notice', body: `${req.user.doc.name} will vacate on ${req.body.vacateDate.toDateString()}.`, type: 'vacate' });
  emitTo(String(t.owner), 'dashboard:updated', {});
  res.status(201).json({ success: true, item: n });
}));

/* ================= FOOD MENU ================= */
r.get('/food-menu', asyncH(async (req, res) => {
  const t = await myStay(req);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '') ? req.query.date : ymd();
  const m = await FoodMenu.findOne({ property: t.property._id, date }).lean();
  res.json({ success: true, date, item: m ? { breakfast: m.breakfast, lunch: m.lunch, eveningSnacks: m.eveningSnacks, dinner: m.dinner } : null });
}));

/* ================= PAYMENTS (Razorpay) ================= */
r.get('/payments', asyncH(async (req, res) => {
  await ensureRentRecords();
  const items = await RentPayment.find({ tenant: req.user.id }).sort({ year: -1, month: -1 }).limit(36).populate('property', 'name').lean();
  res.json({ success: true, items: items.map(({ razorpayOrderId, ...p }) => p) });
}));

r.post('/payments/create-order', validate(z.object({ rentPaymentId: z.string() })), asyncH(async (req, res) => {
  const p = await RentPayment.findOne({ _id: req.body.rentPaymentId, tenant: req.user.id });
  if (!p) throw notFound('Payment not found');
  if (p.status === 'paid') throw bad('This month is already paid');
  const rz = razorpay();
  let orderId = p.razorpayOrderId;
  if (orderId && p.status === 'processing') {
    // reuse an open order if it is still unpaid on Razorpay
    try { const o = await rz.orders.fetch(orderId); if (o.status === 'paid') orderId = null; } catch { orderId = null; }
  } else orderId = null;
  if (!orderId) {
    const o = await rz.orders.create({ amount: Math.round(p.amountDue * 100), currency: 'INR', receipt: `rent_${String(p._id).slice(-12)}_${Date.now().toString(36)}`.slice(0, 40), notes: { rentPaymentId: String(p._id), tenantId: req.user.id } });
    orderId = o.id;
    p.razorpayOrderId = orderId; p.status = 'processing'; await p.save();
  }
  res.json({ success: true, orderId, amount: Math.round(p.amountDue * 100), currency: 'INR', keyId: env.RAZORPAY_KEY_ID, tenant: { name: req.user.doc.name, phone: req.user.doc.phone, email: req.user.doc.email || '' }, description: `Rent ${p.month}/${p.year}` });
}));

r.post('/payments/verify', validate(z.object({ razorpay_order_id: z.string(), razorpay_payment_id: z.string(), razorpay_signature: z.string() })), asyncH(async (req, res) => {
  const { razorpay_order_id: oidv, razorpay_payment_id: pid, razorpay_signature: sig } = req.body;
  const p = await RentPayment.findOne({ razorpayOrderId: oidv, tenant: req.user.id });
  if (!p) throw notFound('Payment not found');
  if (!verifyPaymentSignature(oidv, pid, sig)) { console.warn('Razorpay signature mismatch for order', oidv); throw bad('Payment verification failed'); }
  const done = await markPaid(oidv, pid);
  res.json({ success: true, status: done?.status || p.status });
}));

r.get('/payments/:id/status', asyncH(async (req, res) => {
  const p = await RentPayment.findOne({ _id: req.params.id, tenant: req.user.id }).select('status paidAt receiptNumber failureReason').lean();
  if (!p) throw notFound();
  res.json({ success: true, item: p });
}));
r.get('/payments/:id/receipt', asyncH(async (req, res) => {
  const p = await RentPayment.findOne({ _id: req.params.id, tenant: req.user.id, status: 'paid' }).populate('property', 'name address city').populate('tenant', 'name phone').lean();
  if (!p) throw notFound('Receipt not available');
  res.json({ success: true, item: { receiptNumber: p.receiptNumber, pg: p.property?.name, address: `${p.property?.address}, ${p.property?.city}`, tenant: p.tenant?.name, phone: p.tenant?.phone, month: p.month, year: p.year, amount: p.amountPaid, method: p.method, paymentId: p.razorpayPaymentId || null, paidAt: p.paidAt } });
}));

/* ================= CONCERNS & EMERGENCY ================= */
r.get('/concerns', asyncH(async (req, res) => {
  const items = await Concern.find({ tenant: req.user.id }).sort({ createdAt: -1 }).limit(100).lean();
  res.json({ success: true, items: items.map((c) => ({ ...c, attachmentUrl: c.attachment?.url || null, attachment: undefined })) });
}));
r.post('/concerns', upload.single('file'), validate(z.object({ category: z.enum(['maintenance', 'food', 'cleanliness', 'noise', 'safety', 'other']), description: z.string().trim().min(5, 'Please describe the issue').max(2000) })), asyncH(async (req, res) => {
  const t = await myStay(req);
  const attachment = req.file && req.file.mimetype.startsWith('image/') ? await uploadToCloudinary(req.file, { folder: 'concerns' }) : undefined;
  const c = await Concern.create({ owner: t.owner, tenant: req.user.id, property: t.property._id, category: req.body.category, description: req.body.description, attachment });
  await notify(t.owner, { title: 'New concern raised', body: `${req.user.doc.name} (Room ${t.room?.roomNumber}): ${req.body.category}`, type: 'concern' });
  emitTo(String(t.owner), 'concern:new', { id: String(c._id) });
  res.status(201).json({ success: true, item: c });
}));
r.post('/emergency', validate(z.object({ message: z.string().trim().max(500).optional() })), asyncH(async (req, res) => {
  const t = await myStay(req);
  const c = await Concern.create({ owner: t.owner, tenant: req.user.id, property: t.property._id, category: 'emergency', isEmergency: true, description: req.body.message || 'Emergency alert triggered from the app', });
  await notify(t.owner, { title: '🚨 EMERGENCY alert', body: `${req.user.doc.name} (Room ${t.room?.roomNumber}, ${t.property.name}) needs help. Phone: ${req.user.doc.phone}`, type: 'emergency' });
  emitTo(String(t.owner), 'concern:emergency', { id: String(c._id), tenant: req.user.doc.name, phone: req.user.doc.phone, room: t.room?.roomNumber });
  const owner = await User.findById(t.owner).select('name phone').lean();
  res.status(201).json({ success: true, item: c, owner });
}));

/* ================= KYC ================= */
r.get('/kyc', asyncH(async (req, res) => {
  const t = await myStay(req, false);
  if (!t) return res.json({ success: true, status: null, items: [] });
  const items = await KycDocument.find({ tenancy: t._id }).sort({ createdAt: -1 }).select('documentType status rejectionReason createdAt').lean();
  res.json({ success: true, status: t.kycStatus, items });
}));
r.post('/kyc', upload.single('file'), asyncH(async (req, res) => {
  const t = await myStay(req);
  if (!req.file) throw bad('Choose a document to upload');
  const documentType = z.enum(['aadhaar', 'pan', 'passport', 'driving_license', 'voter_id', 'college_id', 'photo']).parse(req.body.documentType);
  const file = await uploadToCloudinary(req.file, { folder: 'kyc', priv: true });
  const d = await KycDocument.create({ owner: t.owner, tenant: req.user.id, tenancy: t._id, documentType, file });
  await recomputeKyc(t._id);
  await notify(t.owner, { title: 'KYC uploaded', body: `${req.user.doc.name} uploaded a ${documentType.replace('_', ' ')}.`, type: 'kyc' });
  emitTo(String(t.owner), 'kyc:updated', {}); emitTo(String(t.owner), 'dashboard:updated', {});
  res.status(201).json({ success: true, item: { _id: d._id, documentType, status: d.status } });
}));

export default r;
