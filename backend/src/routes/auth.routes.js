import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import otpGenerator from 'otp-generator';
import { z } from 'zod';
import { env } from '../config/env.js';
import { User, Otp, RefreshToken } from '../models/index.js';
import { asyncH, HttpError, bad, normalizePhone } from '../utils/helpers.js';
import { validate } from '../middleware/validate.js';
import { authenticate, signAccess, signRefresh } from '../middleware/auth.js';
import { sendOtpSms } from '../services/sms.js';

const router = Router();
const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_MS = 45 * 1000;
const MAX_ATTEMPTS = 5;

const phoneF = z.string().transform((v, ctx) => {
  const p = normalizePhone(v);
  if (!p) ctx.addIssue({ code: 'custom', message: 'Enter a valid 10-digit mobile number' });
  return p;
});
const passwordF = z.string().min(8, 'Password must be at least 8 characters').max(72);
const roleF = z.enum(['owner', 'tenant']);
const otpF = z.string().regex(/^\d{6}$/, 'Enter the 6-digit OTP');

export const userDto = (u) => ({
  id: String(u._id), name: u.name, phone: u.phone, email: u.email || '', role: u.role, avatarUrl: u.avatar?.url || null,
});

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
async function issueTokens(user) {
  const refreshToken = signRefresh(user);
  await RefreshToken.create({ user: user._id, tokenHash: sha(refreshToken), expiresAt: new Date(Date.now() + 30 * 86400000) });
  return { accessToken: signAccess(user), refreshToken, user: userDto(user) };
}

async function createAndSendOtp(phone, purpose, payload) {
  const existing = await Otp.findOne({ phone, purpose });
  if (existing && Date.now() - existing.lastSentAt.getTime() < RESEND_MS) {
    const wait = Math.ceil((RESEND_MS - (Date.now() - existing.lastSentAt.getTime())) / 1000);
    throw new HttpError(429, `Please wait ${wait}s before requesting another OTP`, 'OTP_COOLDOWN');
  }
  const otp = otpGenerator.generate(6, { digits: true, lowerCaseAlphabets: false, upperCaseAlphabets: false, specialChars: false });
  await Otp.findOneAndUpdate(
    { phone, purpose },
    { otpHash: await bcrypt.hash(otp, 8), payload, attempts: 0, expiresAt: new Date(Date.now() + OTP_TTL_MS), lastSentAt: new Date() },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  try { await sendOtpSms(phone, otp); } catch (e) { await Otp.deleteOne({ phone, purpose }); throw e; }
}

async function checkOtp(phone, purpose, otp) {
  const rec = await Otp.findOne({ phone, purpose });
  if (!rec || rec.expiresAt < new Date()) throw bad('OTP expired. Please request a new one.', 'OTP_EXPIRED');
  if (rec.attempts >= MAX_ATTEMPTS) {
    await rec.deleteOne();
    throw new HttpError(429, 'Too many wrong attempts. Please request a new OTP.', 'OTP_LOCKED');
  }
  if (!(await bcrypt.compare(otp, rec.otpHash))) {
    rec.attempts += 1;
    await rec.save();
    throw bad(`Incorrect OTP. ${MAX_ATTEMPTS - rec.attempts} attempt(s) left.`, 'OTP_WRONG');
  }
  return rec;
}

/* ---------- Sign up (OTP verified) ---------- */
router.post('/signup/send-otp', validate(z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(80),
  phone: phoneF, password: passwordF, role: roleF,
})), asyncH(async (req, res) => {
  const { name, phone, password, role } = req.body;
  const existing = await User.findOne({ phone });
  if (existing?.claimed) throw new HttpError(409, 'This number is already registered. Please log in.', 'PHONE_EXISTS');
  if (existing && existing.role !== role) throw new HttpError(409, `This number is reserved for a ${existing.role} account.`);
  await createAndSendOtp(phone, 'signup', { name, role, passwordHash: await bcrypt.hash(password, 11) });
  res.json({ success: true, message: 'OTP sent', expiresInSec: OTP_TTL_MS / 1000, resendInSec: RESEND_MS / 1000 });
}));

router.post('/signup/verify-otp', validate(z.object({ phone: phoneF, otp: otpF })), asyncH(async (req, res) => {
  const { phone, otp } = req.body;
  const rec = await checkOtp(phone, 'signup', otp);
  const { name, role, passwordHash } = rec.payload;
  let user = await User.findOne({ phone });
  if (user?.claimed) throw new HttpError(409, 'This number is already registered. Please log in.');
  if (user) { user.name = name || user.name; user.passwordHash = passwordHash; user.claimed = true; await user.save(); }
  else user = await User.create({ name, phone, role, passwordHash, claimed: true });
  await rec.deleteOne();
  res.status(201).json({ success: true, ...(await issueTokens(user)) });
}));

/* ---------- Login ---------- */
router.post('/login', validate(z.object({ phone: phoneF, password: z.string().min(1, 'Enter your password'), role: roleF })), asyncH(async (req, res) => {
  const { phone, password, role } = req.body;
  const user = await User.findOne({ phone });
  if (!user) throw new HttpError(401, 'Invalid phone number or password', 'BAD_CREDENTIALS');
  if (!user.claimed || !user.passwordHash) throw new HttpError(403, 'Your PG owner has added you. Please create your account to continue.', 'NOT_CLAIMED');
  if (!(await bcrypt.compare(password, user.passwordHash))) throw new HttpError(401, 'Invalid phone number or password', 'BAD_CREDENTIALS');
  if (user.role !== role) throw new HttpError(403, `This number is registered as a ${user.role}. Please choose "${user.role}" and try again.`, 'WRONG_ROLE');
  res.json({ success: true, ...(await issueTokens(user)) });
}));

/* ---------- Session ---------- */
router.post('/refresh', validate(z.object({ refreshToken: z.string().min(10) })), asyncH(async (req, res) => {
  let payload;
  try { payload = jwt.verify(req.body.refreshToken, env.JWT_REFRESH_SECRET); } catch { throw new HttpError(401, 'Session expired', 'REFRESH_INVALID'); }
  const rec = await RefreshToken.findOneAndDelete({ tokenHash: sha(req.body.refreshToken), user: payload.sub });
  if (!rec) throw new HttpError(401, 'Session expired', 'REFRESH_INVALID');
  const user = await User.findById(payload.sub);
  if (!user) throw new HttpError(401, 'Session expired', 'REFRESH_INVALID');
  res.json({ success: true, ...(await issueTokens(user)) });
}));

router.post('/logout', asyncH(async (req, res) => {
  if (req.body?.refreshToken) await RefreshToken.deleteOne({ tokenHash: sha(req.body.refreshToken) });
  res.json({ success: true });
}));

router.get('/me', authenticate, (req, res) => res.json({ success: true, user: userDto(req.user.doc) }));

/* ---------- Forgot password ---------- */
router.post('/forgot/send-otp', validate(z.object({ phone: phoneF })), asyncH(async (req, res) => {
  const user = await User.findOne({ phone: req.body.phone, claimed: true });
  if (user) await createAndSendOtp(user.phone, 'reset', {});
  // identical response whether or not the number exists
  res.json({ success: true, message: 'If this number is registered, an OTP has been sent.', resendInSec: RESEND_MS / 1000 });
}));

router.post('/forgot/reset', validate(z.object({ phone: phoneF, otp: otpF, newPassword: passwordF })), asyncH(async (req, res) => {
  const { phone, otp, newPassword } = req.body;
  const rec = await checkOtp(phone, 'reset', otp);
  const user = await User.findOne({ phone, claimed: true });
  if (!user) throw bad('Account not found');
  user.passwordHash = await bcrypt.hash(newPassword, 11);
  await user.save();
  await RefreshToken.deleteMany({ user: user._id });
  await rec.deleteOne();
  res.json({ success: true, message: 'Password updated. Please log in.' });
}));

export default router;
