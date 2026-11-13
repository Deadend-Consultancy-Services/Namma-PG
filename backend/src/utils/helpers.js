import mongoose from 'mongoose';

export const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export class HttpError extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code; }
}
export const bad = (m, code) => new HttpError(400, m, code);
export const notFound = (m = 'Not found') => new HttpError(404, m);
export const forbidden = (m = 'Forbidden') => new HttpError(403, m);

export const isId = (v) => mongoose.isValidObjectId(v);
export const oid = (v) => new mongoose.Types.ObjectId(v);

/** Normalise an Indian mobile number to 10 digits. Returns null if invalid. */
export function normalizePhone(input) {
  const d = String(input || '').replace(/\D/g, '');
  const ten = d.length === 12 && d.startsWith('91') ? d.slice(2) : d.length === 11 && d.startsWith('0') ? d.slice(1) : d;
  return /^[6-9]\d{9}$/.test(ten) ? ten : null;
}

export const ymd = (d = new Date()) => {
  const x = new Date(d.getTime() + 5.5 * 3600 * 1000); // IST
  return x.toISOString().slice(0, 10);
};
export const startOfDay = (s) => new Date(`${s}T00:00:00.000+05:30`);
export const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
export const monthRange = (month, year) => ({
  from: new Date(Date.UTC(year, month - 1, 1)),
  to: new Date(Date.UTC(year, month, 1)),
});
export const istParts = () => {
  const x = new Date(Date.now() + 5.5 * 3600 * 1000);
  return { month: x.getUTCMonth() + 1, year: x.getUTCFullYear(), day: x.getUTCDate() };
};
export const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));
export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

import crypto from 'crypto';
export const newReceiptNo = () => {
  const { month, year } = istParts();
  return `RCT-${year}${String(month).padStart(2, '0')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
};
