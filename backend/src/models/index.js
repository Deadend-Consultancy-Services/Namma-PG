import mongoose from 'mongoose';
mongoose.set('autoIndex', false);
const { Schema, model } = mongoose;
const ref = (to, extra = {}) => ({ type: Schema.Types.ObjectId, ref: to, ...extra });
const file = { url: String, publicId: String, resourceType: String, format: String };
const opts = { timestamps: true };

/* ---------- Users & auth ---------- */
const userSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  phone: { type: String, required: true, unique: true },
  email: { type: String, trim: true, lowercase: true },
  passwordHash: { type: String },
  role: { type: String, enum: ['owner', 'tenant'], required: true },
  // tenants onboarded by an owner exist before they sign up; they "claim" the account via OTP
  claimed: { type: Boolean, default: true },
  avatar: file,
  emergencyContact: { name: String, phone: String },
}, opts);
export const User = model('User', userSchema);

const otpSchema = new Schema({
  phone: { type: String, required: true, index: true },
  purpose: { type: String, enum: ['signup', 'reset'], required: true },
  otpHash: { type: String, required: true },
  payload: { name: String, passwordHash: String, role: String },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  lastSentAt: { type: Date, default: Date.now },
}, opts);
otpSchema.index({ phone: 1, purpose: 1 }, { unique: true });
export const Otp = model('Otp', otpSchema);

const refreshSchema = new Schema({
  user: ref('User', { required: true, index: true }),
  tokenHash: { type: String, required: true, index: true },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
}, opts);
export const RefreshToken = model('RefreshToken', refreshSchema);

/* ---------- Property structure ---------- */
const propertySchema = new Schema({
  owner: ref('User', { required: true, index: true }),
  name: { type: String, required: true, trim: true },
  address: { type: String, required: true, trim: true },
  city: { type: String, required: true, trim: true },
  locality: { type: String, required: true, trim: true },
  pgType: { type: String, enum: ['boys', 'girls', 'co-living'], required: true },
  description: { type: String, default: '' },
  images: [file],
  isActive: { type: Boolean, default: true },
}, opts);
propertySchema.index({ name: 'text', city: 'text', locality: 'text', address: 'text' });
export const Property = model('Property', propertySchema);

const roomSchema = new Schema({
  owner: ref('User', { required: true, index: true }),
  property: ref('Property', { required: true, index: true }),
  roomNumber: { type: String, required: true, trim: true },
  floor: { type: Number, default: 0 },
  sharingType: { type: Number, required: true, min: 1, max: 12 },
  rentPerBed: { type: Number, required: true, min: 0 },
}, opts);
roomSchema.index({ property: 1, roomNumber: 1 }, { unique: true });
export const Room = model('Room', roomSchema);

const bedSchema = new Schema({
  owner: ref('User', { required: true, index: true }),
  property: ref('Property', { required: true, index: true }),
  room: ref('Room', { required: true, index: true }),
  label: { type: String, required: true },
  status: { type: String, enum: ['vacant', 'occupied'], default: 'vacant', index: true },
  tenancy: ref('Tenancy', { default: null }),
}, opts);
bedSchema.index({ room: 1, label: 1 }, { unique: true });
export const Bed = model('Bed', bedSchema);

const tenancySchema = new Schema({
  owner: ref('User', { required: true, index: true }),
  tenant: ref('User', { required: true }),
  property: ref('Property', { required: true, index: true }),
  room: ref('Room', { required: true }),
  bed: ref('Bed', { required: true }),
  rentAmount: { type: Number, required: true, min: 0 },
  depositAmount: { type: Number, default: 0, min: 0 },
  moveInDate: { type: Date, required: true },
  rentDueDay: { type: Number, default: 5, min: 1, max: 28 },
  status: { type: String, enum: ['active', 'vacated'], default: 'active', index: true },
  vacatedOn: Date,
  kycStatus: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
}, opts);
// A bed can have at most one active tenancy; a tenant at most one active tenancy.
tenancySchema.index({ bed: 1 }, { unique: true, partialFilterExpression: { status: 'active' } });
tenancySchema.index({ tenant: 1 }, { unique: true, partialFilterExpression: { status: 'active' } });
export const Tenancy = model('Tenancy', tenancySchema);

const facilitySchema = new Schema({
  owner: ref('User', { required: true, index: true }),
  property: ref('Property', { default: null }), // null = applies to all properties
  name: { type: String, required: true, trim: true },
  icon: { type: String, default: 'check' },
  isActive: { type: Boolean, default: true },
}, opts);
export const Facility = model('Facility', facilitySchema);

const foodMenuSchema = new Schema({
  owner: ref('User', { required: true, index: true }),
  property: ref('Property', { required: true }),
  date: { type: String, required: true }, // YYYY-MM-DD
  breakfast: [String], lunch: [String], eveningSnacks: [String], dinner: [String],
}, opts);
foodMenuSchema.index({ property: 1, date: 1 }, { unique: true });
export const FoodMenu = model('FoodMenu', foodMenuSchema);

/* ---------- KYC, money ---------- */
const kycSchema = new Schema({
  owner: ref('User', { required: true, index: true }),
  tenant: ref('User', { required: true, index: true }),
  tenancy: ref('Tenancy', { required: true, index: true }),
  documentType: { type: String, enum: ['aadhaar', 'pan', 'passport', 'driving_license', 'voter_id', 'college_id', 'photo'], required: true },
  file: { ...file },
  status: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending', index: true },
  rejectionReason: String,
  reviewedAt: Date,
}, opts);
export const KycDocument = model('KycDocument', kycSchema);

const rentSchema = new Schema({
  owner: ref('User', { required: true, index: true }),
  tenant: ref('User', { required: true, index: true }),
  tenancy: ref('Tenancy', { required: true }),
  property: ref('Property', { required: true }),
  month: { type: Number, min: 1, max: 12, required: true },
  year: { type: Number, required: true },
  amountDue: { type: Number, required: true },
  amountPaid: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'processing', 'paid', 'failed', 'overdue'], default: 'pending', index: true },
  dueDate: { type: Date, required: true },
  paidAt: Date,
  method: { type: String, enum: ['razorpay', 'cash', 'upi', 'bank'], default: undefined },
  note: String,
  razorpayOrderId: { type: String, index: true, sparse: true },
  razorpayPaymentId: String,
  receiptNumber: String,
  failureReason: String,
}, opts);
rentSchema.index({ tenancy: 1, month: 1, year: 1 }, { unique: true });
export const RentPayment = model('RentPayment', rentSchema);

export const ProcessedEvent = model('ProcessedEvent', new Schema({
  eventId: { type: String, unique: true, required: true },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 7 },
}));

const expenseSchema = new Schema({
  owner: ref('User', { required: true, index: true }),
  property: ref('Property', { required: true }),
  category: { type: String, enum: ['maintenance', 'food', 'utilities', 'salary', 'rent', 'supplies', 'other'], required: true },
  amount: { type: Number, required: true, min: 0 },
  date: { type: Date, required: true, index: true },
  notes: String,
  receipt: file,
}, opts);
export const Expense = model('Expense', expenseSchema);

/* ---------- Operations ---------- */
const vacateSchema = new Schema({
  owner: ref('User', { required: true, index: true }),
  tenant: ref('User', { required: true }),
  tenancy: ref('Tenancy', { required: true, index: true }),
  noticeDate: { type: Date, default: Date.now },
  vacateDate: { type: Date, required: true },
  reason: String,
  status: { type: String, enum: ['notice_given', 'vacated', 'cancelled'], default: 'notice_given', index: true },
  requestedBy: { type: String, enum: ['owner', 'tenant'], default: 'owner' },
}, opts);
export const VacateNotice = model('VacateNotice', vacateSchema);

const reviewSchema = new Schema({
  property: ref('Property', { required: true, index: true }),
  tenant: ref('User', { required: true }),
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String, maxlength: 1000 },
}, opts);
reviewSchema.index({ property: 1, tenant: 1 }, { unique: true });
export const Review = model('Review', reviewSchema);

const slotSchema = new Schema({
  owner: ref('User', { required: true, index: true }),
  property: ref('Property', { required: true }),
  date: { type: String, required: true }, // YYYY-MM-DD
  time: { type: String, required: true }, // HH:mm
  isBooked: { type: Boolean, default: false },
}, opts);
slotSchema.index({ property: 1, date: 1, time: 1 }, { unique: true });
export const VisitSlot = model('VisitSlot', slotSchema);

const visitSchema = new Schema({
  owner: ref('User', { required: true, index: true }),
  tenant: ref('User', { required: true, index: true }),
  property: ref('Property', { required: true }),
  slot: ref('VisitSlot', { required: true }),
  date: String, time: String,
  status: { type: String, enum: ['upcoming', 'completed', 'cancelled'], default: 'upcoming' },
}, opts);
export const VisitBooking = model('VisitBooking', visitSchema);

const concernSchema = new Schema({
  owner: ref('User', { required: true, index: true }),
  tenant: ref('User', { required: true, index: true }),
  property: ref('Property', { required: true }),
  category: { type: String, enum: ['maintenance', 'food', 'cleanliness', 'noise', 'safety', 'other', 'emergency'], required: true },
  description: { type: String, required: true, maxlength: 2000 },
  attachment: file,
  isEmergency: { type: Boolean, default: false, index: true },
  status: { type: String, enum: ['open', 'in_progress', 'resolved'], default: 'open', index: true },
  updates: [{ message: String, by: { type: String, enum: ['owner', 'tenant'] }, at: { type: Date, default: Date.now } }],
}, opts);
export const Concern = model('Concern', concernSchema);

const messageSchema = new Schema({
  from: ref('User', { required: true }),
  to: ref('User', { required: true }),
  text: { type: String, required: true, maxlength: 2000 },
  readAt: Date,
}, opts);
messageSchema.index({ from: 1, to: 1, createdAt: -1 });
export const Message = model('Message', messageSchema);

const notificationSchema = new Schema({
  user: ref('User', { required: true, index: true }),
  type: { type: String, default: 'general' },
  title: { type: String, required: true },
  body: String,
  readAt: Date,
}, opts);
export const Notification = model('Notification', notificationSchema);

export const Reminder = model('Reminder', new Schema({
  owner: ref('User', { required: true, index: true }),
  type: { type: String, enum: ['rent', 'kyc', 'custom'], required: true },
  message: String,
  recipients: [ref('User')],
}, opts));
