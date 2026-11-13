import { Router } from 'express';
import { z } from 'zod';
import { User, Property, Room, Bed, Tenancy, Facility, FoodMenu, KycDocument, RentPayment, Expense, VacateNotice, Concern, VisitBooking } from '../models/index.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { upload, uploadToCloudinary, deleteFromCloudinary, privateFileUrl } from '../middleware/upload.js';
import { asyncH, bad, notFound, forbidden, isId, oid, normalizePhone, istParts, ymd, addDays, startOfDay, HttpError } from '../utils/helpers.js';
import { withTx } from '../config/db.js';
import { ensureRentRecords } from '../services/rent.js';
import { recomputeKyc, endTenancy } from '../services/tenancy.js';
import { notify } from '../services/notify.js';
import { emitTo } from '../services/socket.js';
import { FoodMenu as FM } from '../models/index.js';

const r = Router();
r.use(authenticate, requireRole('owner'));

const ownProperty = async (req, id) => {
  if (!isId(id)) throw bad('Invalid property');
  const p = await Property.findOne({ _id: id, owner: req.user.id });
  if (!p) throw notFound('Property not found');
  return p;
};
const live = (ownerId, event = 'dashboard:updated') => emitTo(ownerId, event, {});

/* ================= DASHBOARD ================= */
r.get('/dashboard', asyncH(async (req, res) => {
  const owner = req.user.id;
  await ensureRentRecords(owner);
  const pid = req.query.propertyId && isId(req.query.propertyId) ? oid(req.query.propertyId) : null;
  const pf = pid ? { property: pid } : {};
  const now = new Date();
  const { month, year } = istParts();
  const prev = month === 1 ? { month: 12, year: year - 1 } : { month: month - 1, year };
  const mStart = new Date(Date.UTC(year, month - 1, 1)); const mEnd = new Date(Date.UTC(year, month, 1));
  const pStart = new Date(Date.UTC(prev.year, prev.month - 1, 1));
  const today = ymd();

  const [total, allocated, occupied, rentAgg, expAgg, expPrev, expDaily, menus, vacantRooms, roomCounts, stayingRaw, vacating, kycPending, rentDue, overdue, kycPendingCount, openConcerns, emergencies, upcomingVisits] = await Promise.all([
    Bed.countDocuments({ owner, ...pf }),
    Tenancy.countDocuments({ owner, status: 'active', ...pf }),
    Tenancy.countDocuments({ owner, status: 'active', moveInDate: { $lte: now }, ...pf }),
    RentPayment.aggregate([{ $match: { owner: oid(owner), month, year, ...pf } }, { $group: { _id: null, expected: { $sum: '$amountDue' }, collected: { $sum: '$amountPaid' } } }]),
    Expense.aggregate([{ $match: { owner: oid(owner), date: { $gte: mStart, $lt: mEnd }, ...pf } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Expense.aggregate([{ $match: { owner: oid(owner), date: { $gte: pStart, $lt: mStart }, ...pf } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Expense.aggregate([{ $match: { owner: oid(owner), date: { $gte: mStart, $lt: mEnd }, ...pf } }, { $group: { _id: { $dayOfMonth: '$date' }, amount: { $sum: '$amount' } } }, { $sort: { _id: 1 } }]),
    FoodMenu.find({ owner, date: today, ...pf }).populate('property', 'name').lean(),
    Bed.aggregate([{ $match: { owner: oid(owner), status: 'vacant', ...pf } }, { $group: { _id: '$room', vacant: { $sum: 1 } } }, { $sort: { vacant: -1 } }, { $limit: 6 },
      { $lookup: { from: 'rooms', localField: '_id', foreignField: '_id', as: 'room' } }, { $unwind: '$room' },
      { $project: { roomId: '$_id', roomNumber: '$room.roomNumber', sharingType: '$room.sharingType', vacant: 1, _id: 0 } }]),
    Tenancy.aggregate([{ $match: { owner: oid(owner), status: 'active', ...pf } }, { $group: { _id: '$room', n: { $sum: 1 } } }]),
    Tenancy.find({ owner, status: 'active', ...pf }).sort({ createdAt: -1 }).limit(6).populate('tenant', 'name avatar').populate('room', 'roomNumber sharingType').lean(),
    VacateNotice.find({ owner, status: 'notice_given', vacateDate: { $gte: startOfDay(today), $lte: addDays(now, 15) } }).sort({ vacateDate: 1 }).limit(6)
      .populate('tenant', 'name avatar').populate({ path: 'tenancy', select: 'room', populate: { path: 'room', select: 'roomNumber' } }).lean(),
    Tenancy.find({ owner, status: 'active', kycStatus: 'pending', ...pf }).sort({ createdAt: -1 }).limit(4).populate('tenant', 'name avatar').populate('room', 'roomNumber').lean(),
    RentPayment.countDocuments({ owner, month, year, status: 'pending', ...pf }),
    RentPayment.countDocuments({ owner, status: 'overdue', ...pf }),
    Tenancy.countDocuments({ owner, status: 'active', kycStatus: 'pending', ...pf }),
    Concern.countDocuments({ owner, status: { $ne: 'resolved' } }),
    Concern.countDocuments({ owner, isEmergency: true, status: { $ne: 'resolved' } }),
    VisitBooking.countDocuments({ owner, status: 'upcoming', date: { $gte: today } }),
  ]);
  const cnt = Object.fromEntries(roomCounts.map((c) => [String(c._id), c.n]));
  const expected = rentAgg[0]?.expected || 0; const collected = rentAgg[0]?.collected || 0;
  const expTotal = expAgg[0]?.total || 0; const expPrevTotal = expPrev[0]?.total || 0;
  res.json({
    success: true,
    beds: { total, occupied, vacant: total - allocated, allocated, reserved: allocated - occupied },
    rent: { month, year, expected, collected, pending: expected - collected, percent: expected ? Math.round((collected / expected) * 100) : 0 },
    expenses: { total: expTotal, previous: expPrevTotal, changePercent: expPrevTotal ? Math.round(((expTotal - expPrevTotal) / expPrevTotal) * 100) : null, daily: expDaily.map((d) => ({ day: d._id, amount: d.amount })) },
    menus: menus.map((m) => ({ property: m.property?.name, breakfast: m.breakfast, lunch: m.lunch, eveningSnacks: m.eveningSnacks, dinner: m.dinner })),
    vacantRooms,
    staying: stayingRaw.map((t) => ({ tenancyId: t._id, name: t.tenant?.name, avatarUrl: t.tenant?.avatar?.url || null, roomNumber: t.room?.roomNumber, sharingType: t.room?.sharingType, occupied: cnt[String(t.room?._id)] || 0, capacity: t.room?.sharingType })),
    vacating: vacating.map((v) => ({ id: v._id, name: v.tenant?.name, avatarUrl: v.tenant?.avatar?.url || null, roomNumber: v.tenancy?.room?.roomNumber, vacateDate: v.vacateDate, daysLeft: Math.max(0, Math.ceil((v.vacateDate - now) / 86400000)) })),
    kycPending: kycPending.map((t) => ({ tenancyId: t._id, name: t.tenant?.name, avatarUrl: t.tenant?.avatar?.url || null, roomNumber: t.room?.roomNumber })),
    reminders: { rentDue, overdue, kycPending: kycPendingCount, vacatingSoon: vacating.length },
    alerts: { openConcerns, emergencies, upcomingVisits },
  });
}));

/* ================= PROPERTIES ================= */
const propSchema = z.object({
  name: z.string().trim().min(2).max(100), address: z.string().trim().min(3).max(300),
  city: z.string().trim().min(2).max(60), locality: z.string().trim().min(2).max(80),
  pgType: z.enum(['boys', 'girls', 'co-living']), description: z.string().max(2000).optional().default(''),
  isActive: z.boolean().optional(),
});

r.get('/properties', asyncH(async (req, res) => {
  const [props, beds, rooms] = await Promise.all([
    Property.find({ owner: req.user.id }).sort({ createdAt: -1 }).lean(),
    Bed.aggregate([{ $match: { owner: oid(req.user.id) } }, { $group: { _id: '$property', total: { $sum: 1 }, vacant: { $sum: { $cond: [{ $eq: ['$status', 'vacant'] }, 1, 0] } } } }]),
    Room.aggregate([{ $match: { owner: oid(req.user.id) } }, { $group: { _id: '$property', n: { $sum: 1 } } }]),
  ]);
  const b = Object.fromEntries(beds.map((x) => [String(x._id), x])); const rm = Object.fromEntries(rooms.map((x) => [String(x._id), x.n]));
  res.json({ success: true, items: props.map((p) => ({ ...p, rooms: rm[String(p._id)] || 0, totalBeds: b[String(p._id)]?.total || 0, vacantBeds: b[String(p._id)]?.vacant || 0 })) });
}));
r.post('/properties', validate(propSchema), asyncH(async (req, res) => {
  const p = await Property.create({ ...req.body, owner: req.user.id });
  res.status(201).json({ success: true, item: p });
}));
r.put('/properties/:id', validate(propSchema.partial()), asyncH(async (req, res) => {
  const p = await ownProperty(req, req.params.id);
  Object.assign(p, req.body); await p.save();
  res.json({ success: true, item: p });
}));
r.delete('/properties/:id', asyncH(async (req, res) => {
  const p = await ownProperty(req, req.params.id);
  if (await Tenancy.exists({ property: p._id, status: 'active' })) throw bad('Move out all tenants before deleting this property');
  await Promise.all(p.images.map((i) => deleteFromCloudinary(i)));
  await withTx(async (s) => {
    await Promise.all([Bed.deleteMany({ property: p._id }, { session: s }), Room.deleteMany({ property: p._id }, { session: s }), Facility.deleteMany({ property: p._id }, { session: s }), FoodMenu.deleteMany({ property: p._id }, { session: s }), p.deleteOne({ session: s })]);
  });
  res.json({ success: true });
}));
r.post('/properties/:id/images', upload.array('files', 5), asyncH(async (req, res) => {
  const p = await ownProperty(req, req.params.id);
  const files = (req.files || []).filter((f) => f.mimetype.startsWith('image/'));
  if (!files.length) throw bad('Choose at least one image');
  if (p.images.length + files.length > 12) throw bad('A property can have at most 12 images');
  p.images.push(...(await Promise.all(files.map((f) => uploadToCloudinary(f, { folder: 'properties' })))));
  await p.save();
  res.json({ success: true, item: p });
}));
r.delete('/properties/:id/images/:publicId', asyncH(async (req, res) => {
  const p = await ownProperty(req, req.params.id);
  const pid = decodeURIComponent(req.params.publicId);
  const img = p.images.find((i) => i.publicId === pid);
  if (!img) throw notFound('Image not found');
  await deleteFromCloudinary(img);
  p.images = p.images.filter((i) => i.publicId !== pid);
  await p.save();
  res.json({ success: true, item: p });
}));

/* ================= ROOMS & BEDS ================= */
const roomSchema = z.object({
  propertyId: z.string(), roomNumber: z.string().trim().min(1).max(20),
  floor: z.coerce.number().int().min(0).max(100).default(0),
  sharingType: z.coerce.number().int().min(1).max(12), rentPerBed: z.coerce.number().min(0),
});
const bedLabels = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => `B${from + i}`);

r.get('/rooms', asyncH(async (req, res) => {
  const q = { owner: req.user.id };
  if (req.query.propertyId) q.property = req.query.propertyId;
  const rooms = await Room.find(q).populate('property', 'name').sort({ property: 1, roomNumber: 1 }).lean();
  const beds = await Bed.find({ room: { $in: rooms.map((x) => x._id) } }).sort({ label: 1 })
    .populate({ path: 'tenancy', select: 'tenant moveInDate', populate: { path: 'tenant', select: 'name phone avatar' } }).lean();
  const by = {}; beds.forEach((b) => (by[String(b.room)] ||= []).push(b));
  let items = rooms.map((rm) => {
    const bs = by[String(rm._id)] || []; const vacant = bs.filter((b) => b.status === 'vacant').length;
    return { ...rm, beds: bs, vacant, occupied: bs.length - vacant, status: vacant === bs.length ? 'vacant' : vacant === 0 ? 'full' : 'partial' };
  });
  if (req.query.status) items = items.filter((x) => x.status === req.query.status);
  res.json({ success: true, items });
}));
r.post('/rooms', validate(roomSchema), asyncH(async (req, res) => {
  const p = await ownProperty(req, req.body.propertyId);
  const room = await withTx(async (s) => {
    const [rm] = await Room.create([{ owner: req.user.id, property: p._id, roomNumber: req.body.roomNumber, floor: req.body.floor, sharingType: req.body.sharingType, rentPerBed: req.body.rentPerBed }], { session: s });
    await Bed.create(bedLabels(1, rm.sharingType).map((label) => ({ owner: req.user.id, property: p._id, room: rm._id, label })), { session: s, ordered: true });
    return rm;
  });
  live(req.user.id);
  res.status(201).json({ success: true, item: room });
}));
r.put('/rooms/:id', validate(roomSchema.omit({ propertyId: true }).partial()), asyncH(async (req, res) => {
  const room = await Room.findOne({ _id: req.params.id, owner: req.user.id });
  if (!room) throw notFound('Room not found');
  await withTx(async (s) => {
    const beds = await Bed.find({ room: room._id }).session(s);
    const want = req.body.sharingType ?? room.sharingType;
    if (want > beds.length) await Bed.create(bedLabels(beds.length + 1, want).map((label) => ({ owner: room.owner, property: room.property, room: room._id, label })), { session: s, ordered: true });
    if (want < beds.length) {
      const removable = beds.filter((b) => b.status === 'vacant').sort((a, b) => b.label.localeCompare(a.label, undefined, { numeric: true })).slice(0, beds.length - want);
      if (removable.length < beds.length - want) throw bad('Cannot reduce beds: some beds are occupied');
      await Bed.deleteMany({ _id: { $in: removable.map((b) => b._id) } }, { session: s });
    }
    Object.assign(room, req.body);
    await room.save({ session: s });
  });
  live(req.user.id);
  res.json({ success: true, item: room });
}));
r.delete('/rooms/:id', asyncH(async (req, res) => {
  const room = await Room.findOne({ _id: req.params.id, owner: req.user.id });
  if (!room) throw notFound('Room not found');
  if (await Tenancy.exists({ room: room._id, status: 'active' })) throw bad('Move out all tenants before deleting this room');
  await withTx(async (s) => { await Bed.deleteMany({ room: room._id }, { session: s }); await room.deleteOne({ session: s }); });
  live(req.user.id);
  res.json({ success: true });
}));
r.get('/beds/vacant', asyncH(async (req, res) => {
  const q = { owner: req.user.id, status: 'vacant' };
  if (req.query.propertyId) q.property = req.query.propertyId;
  const beds = await Bed.find(q).populate('room', 'roomNumber sharingType rentPerBed floor').sort({ room: 1, label: 1 }).lean();
  res.json({ success: true, items: beds });
}));

/* ================= FACILITIES ================= */
const facSchema = z.object({ name: z.string().trim().min(2).max(60), icon: z.string().max(30).optional().default('check'), propertyId: z.string().nullable().optional(), isActive: z.boolean().optional() });
r.get('/facilities', asyncH(async (req, res) => {
  res.json({ success: true, items: await Facility.find({ owner: req.user.id }).populate('property', 'name').sort({ createdAt: -1 }).lean() });
}));
r.post('/facilities', validate(facSchema), asyncH(async (req, res) => {
  const { propertyId, ...rest } = req.body;
  if (propertyId) await ownProperty(req, propertyId);
  res.status(201).json({ success: true, item: await Facility.create({ ...rest, owner: req.user.id, property: propertyId || null }) });
}));
r.put('/facilities/:id', validate(facSchema.partial()), asyncH(async (req, res) => {
  const { propertyId, ...rest } = req.body;
  const upd = { ...rest };
  if (propertyId !== undefined) { if (propertyId) await ownProperty(req, propertyId); upd.property = propertyId || null; }
  const f = await Facility.findOneAndUpdate({ _id: req.params.id, owner: req.user.id }, upd, { new: true });
  if (!f) throw notFound('Facility not found');
  res.json({ success: true, item: f });
}));
r.delete('/facilities/:id', asyncH(async (req, res) => {
  const f = await Facility.findOneAndDelete({ _id: req.params.id, owner: req.user.id });
  if (!f) throw notFound('Facility not found');
  res.json({ success: true });
}));

/* ================= FOOD MENU ================= */
const menuSchema = z.object({
  propertyId: z.string(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  breakfast: z.array(z.string().trim().min(1).max(60)).max(15).default([]), lunch: z.array(z.string().trim().min(1).max(60)).max(15).default([]),
  eveningSnacks: z.array(z.string().trim().min(1).max(60)).max(15).default([]), dinner: z.array(z.string().trim().min(1).max(60)).max(15).default([]),
});
r.get('/food-menu', asyncH(async (req, res) => {
  const q = { owner: req.user.id };
  if (req.query.propertyId) q.property = req.query.propertyId;
  if (req.query.date) q.date = req.query.date;
  else if (req.query.from) q.date = { $gte: req.query.from, ...(req.query.to ? { $lte: req.query.to } : {}) };
  res.json({ success: true, items: await FM.find(q).populate('property', 'name').sort({ date: 1 }).lean() });
}));
r.put('/food-menu', validate(menuSchema), asyncH(async (req, res) => {
  const { propertyId, date, ...meals } = req.body;
  await ownProperty(req, propertyId);
  const m = await FM.findOneAndUpdate({ property: propertyId, date }, { $set: { ...meals, owner: req.user.id } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  live(req.user.id);
  res.json({ success: true, item: m });
}));

/* ================= TENANTS ================= */
const onboardSchema = z.object({
  name: z.string().trim().min(2).max(80), phone: z.string(), email: z.string().email().or(z.literal('')).optional(),
  propertyId: z.string(), roomId: z.string(), bedId: z.string(),
  rentAmount: z.coerce.number().min(0), depositAmount: z.coerce.number().min(0).default(0),
  moveInDate: z.coerce.date(), rentDueDay: z.coerce.number().int().min(1).max(28).default(5),
  emergencyContact: z.object({ name: z.string().max(80).optional(), phone: z.string().max(15).optional() }).optional(),
});

r.get('/tenants', asyncH(async (req, res) => {
  await ensureRentRecords(req.user.id);
  const { month, year } = istParts();
  const q = { owner: req.user.id, status: req.query.status === 'vacated' ? 'vacated' : 'active' };
  if (req.query.propertyId) q.property = req.query.propertyId;
  if (req.query.kyc) q.kycStatus = req.query.kyc;
  let rows = await Tenancy.find(q).sort({ createdAt: -1 }).limit(500)
    .populate('tenant', 'name phone email avatar claimed').populate('room', 'roomNumber sharingType').populate('bed', 'label').populate('property', 'name').lean();
  const rents = await RentPayment.find({ tenancy: { $in: rows.map((x) => x._id) }, month, year }).select('tenancy status').lean();
  const rm = Object.fromEntries(rents.map((x) => [String(x.tenancy), x.status]));
  const s = String(req.query.search || '').trim().toLowerCase();
  if (s) rows = rows.filter((t) => t.tenant?.name?.toLowerCase().includes(s) || t.tenant?.phone?.includes(s) || t.room?.roomNumber?.toLowerCase().includes(s));
  res.json({ success: true, items: rows.map((t) => ({ ...t, rentStatus: rm[String(t._id)] || 'pending' })) });
}));

r.post('/tenants', validate(onboardSchema), asyncH(async (req, res) => {
  const b = req.body;
  const phone = normalizePhone(b.phone);
  if (!phone) throw bad('Enter a valid 10-digit mobile number');
  const prop = await ownProperty(req, b.propertyId);
  const result = await withTx(async (s) => {
    const bed = await Bed.findOne({ _id: b.bedId, room: b.roomId, property: prop._id, owner: req.user.id }).session(s);
    if (!bed) throw notFound('Bed not found');
    if (bed.status !== 'vacant') throw bad('This bed is already occupied');
    let user = await User.findOne({ phone }).session(s);
    if (user && user.role !== 'tenant') throw bad('This number belongs to an owner account');
    if (user && (await Tenancy.exists({ tenant: user._id, status: 'active' }).session(s))) throw bad('This tenant already has an active stay');
    if (!user) [user] = await User.create([{ name: b.name, phone, email: b.email || undefined, role: 'tenant', claimed: false, emergencyContact: b.emergencyContact }], { session: s });
    const [t] = await Tenancy.create([{ owner: req.user.id, tenant: user._id, property: prop._id, room: b.roomId, bed: bed._id, rentAmount: b.rentAmount, depositAmount: b.depositAmount, moveInDate: b.moveInDate, rentDueDay: b.rentDueDay }], { session: s });
    bed.status = 'occupied'; bed.tenancy = t._id; await bed.save({ session: s });
    return { tenancy: t, user };
  });
  await ensureRentRecords(req.user.id);
  if (result.user.claimed) await notify(result.user._id, { title: 'Welcome to your PG', body: `You have been added to ${prop.name}.`, type: 'tenancy' });
  live(req.user.id);
  res.status(201).json({ success: true, item: result.tenancy, tenantNeedsSignup: !result.user.claimed });
}));

r.get('/tenants/:id', asyncH(async (req, res) => {
  const t = await Tenancy.findOne({ _id: req.params.id, owner: req.user.id })
    .populate('tenant', 'name phone email avatar claimed emergencyContact').populate('room', 'roomNumber sharingType').populate('bed', 'label').populate('property', 'name').lean();
  if (!t) throw notFound('Tenant not found');
  const [kyc, payments, notice] = await Promise.all([
    KycDocument.find({ tenancy: t._id }).sort({ createdAt: -1 }).lean(),
    RentPayment.find({ tenancy: t._id }).sort({ year: -1, month: -1 }).limit(24).lean(),
    VacateNotice.findOne({ tenancy: t._id, status: 'notice_given' }).lean(),
  ]);
  res.json({ success: true, item: t, kyc: kyc.map(({ file, ...k }) => ({ ...k, hasFile: !!file?.publicId })), payments, notice });
}));
r.put('/tenants/:id', validate(z.object({ rentAmount: z.coerce.number().min(0).optional(), depositAmount: z.coerce.number().min(0).optional(), rentDueDay: z.coerce.number().int().min(1).max(28).optional() })), asyncH(async (req, res) => {
  const t = await Tenancy.findOneAndUpdate({ _id: req.params.id, owner: req.user.id, status: 'active' }, req.body, { new: true });
  if (!t) throw notFound('Tenant not found');
  res.json({ success: true, item: t });
}));
r.post('/tenants/:id/vacate', asyncH(async (req, res) => {
  const t = await Tenancy.findOne({ _id: req.params.id, owner: req.user.id, status: 'active' });
  if (!t) throw notFound('Active stay not found');
  await withTx((s) => endTenancy(t._id, s));
  await notify(t.tenant, { title: 'Stay ended', body: 'Your stay has been marked as vacated.', type: 'tenancy' });
  live(req.user.id);
  res.json({ success: true });
}));

/* ================= KYC ================= */
r.get('/kyc', asyncH(async (req, res) => {
  const q = { owner: req.user.id };
  if (req.query.status) q.status = req.query.status;
  const items = await KycDocument.find(q).sort({ createdAt: -1 }).limit(300)
    .populate('tenant', 'name phone avatar').populate({ path: 'tenancy', select: 'room', populate: { path: 'room', select: 'roomNumber' } }).lean();
  res.json({ success: true, items: items.map(({ file, ...k }) => ({ ...k, hasFile: !!file?.publicId })) });
}));
r.post('/kyc/upload/:tenancyId', upload.single('file'), asyncH(async (req, res) => {
  const t = await Tenancy.findOne({ _id: req.params.tenancyId, owner: req.user.id });
  if (!t) throw notFound('Tenant not found');
  if (!req.file) throw bad('Choose a document to upload');
  const documentType = z.enum(['aadhaar', 'pan', 'passport', 'driving_license', 'voter_id', 'college_id', 'photo']).parse(req.body.documentType);
  const file = await uploadToCloudinary(req.file, { folder: 'kyc', priv: true });
  const doc = await KycDocument.create({ owner: t.owner, tenant: t.tenant, tenancy: t._id, documentType, file });
  await recomputeKyc(t._id);
  live(req.user.id);
  res.status(201).json({ success: true, item: { ...doc.toObject(), file: undefined } });
}));
r.get('/kyc/:id/file', asyncH(async (req, res) => {
  const d = await KycDocument.findOne({ _id: req.params.id, owner: req.user.id });
  if (!d) throw notFound();
  res.json({ success: true, url: privateFileUrl(d.file), expiresInSec: 300 });
}));
r.put('/kyc/:id/review', validate(z.object({ action: z.enum(['approve', 'reject']), reason: z.string().trim().max(300).optional() })), asyncH(async (req, res) => {
  const { action, reason } = req.body;
  if (action === 'reject' && !reason) throw bad('Please give a reason for rejection');
  const d = await KycDocument.findOne({ _id: req.params.id, owner: req.user.id });
  if (!d) throw notFound();
  d.status = action === 'approve' ? 'verified' : 'rejected'; d.rejectionReason = action === 'reject' ? reason : undefined; d.reviewedAt = new Date();
  await d.save();
  await recomputeKyc(d.tenancy);
  await notify(d.tenant, { title: action === 'approve' ? 'KYC document verified' : 'KYC document rejected', body: action === 'approve' ? 'Your document was verified.' : `Reason: ${reason}`, type: 'kyc' });
  emitTo(String(d.tenant), 'kyc:updated', {});
  live(req.user.id);
  res.json({ success: true });
}));
r.delete('/kyc/:id', asyncH(async (req, res) => {
  const d = await KycDocument.findOneAndDelete({ _id: req.params.id, owner: req.user.id });
  if (!d) throw notFound();
  await deleteFromCloudinary(d.file, true);
  await recomputeKyc(d.tenancy);
  res.json({ success: true });
}));

/* ================= VACATE NOTICES ================= */
r.get('/vacate-notices', asyncH(async (req, res) => {
  const days = Math.min(Number(req.query.days) || 0, 365);
  const q = { owner: req.user.id, status: req.query.status || 'notice_given' };
  if (days) q.vacateDate = { $gte: startOfDay(ymd()), $lte: addDays(new Date(), days) };
  const items = await VacateNotice.find(q).sort({ vacateDate: 1 }).populate('tenant', 'name phone avatar')
    .populate({ path: 'tenancy', select: 'room property', populate: [{ path: 'room', select: 'roomNumber' }, { path: 'property', select: 'name' }] }).lean();
  res.json({ success: true, items: items.map((v) => ({ ...v, daysLeft: Math.max(0, Math.ceil((v.vacateDate - new Date()) / 86400000)) })) });
}));
r.post('/vacate-notices', validate(z.object({ tenancyId: z.string(), vacateDate: z.coerce.date(), reason: z.string().max(300).optional() })), asyncH(async (req, res) => {
  const t = await Tenancy.findOne({ _id: req.body.tenancyId, owner: req.user.id, status: 'active' });
  if (!t) throw notFound('Active stay not found');
  if (req.body.vacateDate < startOfDay(ymd())) throw bad('Vacate date cannot be in the past');
  if (await VacateNotice.exists({ tenancy: t._id, status: 'notice_given' })) throw bad('A vacate notice already exists for this tenant');
  const n = await VacateNotice.create({ owner: req.user.id, tenant: t.tenant, tenancy: t._id, vacateDate: req.body.vacateDate, reason: req.body.reason, requestedBy: 'owner' });
  await notify(t.tenant, { title: 'Vacate notice recorded', body: `Your vacate date is ${req.body.vacateDate.toDateString()}.`, type: 'vacate' });
  live(req.user.id);
  res.status(201).json({ success: true, item: n });
}));
r.put('/vacate-notices/:id/complete', asyncH(async (req, res) => {
  const n = await VacateNotice.findOne({ _id: req.params.id, owner: req.user.id, status: 'notice_given' });
  if (!n) throw notFound('Notice not found');
  await withTx((s) => endTenancy(n.tenancy, s));
  live(req.user.id);
  res.json({ success: true });
}));
r.put('/vacate-notices/:id/cancel', asyncH(async (req, res) => {
  const n = await VacateNotice.findOneAndUpdate({ _id: req.params.id, owner: req.user.id, status: 'notice_given' }, { status: 'cancelled' }, { new: true });
  if (!n) throw notFound('Notice not found');
  live(req.user.id);
  res.json({ success: true });
}));

export default r;
