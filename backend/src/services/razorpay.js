import Razorpay from 'razorpay';
import crypto from 'crypto';
import { env } from '../config/env.js';
import { HttpError } from '../utils/helpers.js';

let client;
export function razorpay() {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) throw new HttpError(503, 'Online payments are not configured yet');
  client ||= new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
  return client;
}

const safeEq = (a, b) => {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
export const verifyPaymentSignature = (orderId, paymentId, signature) =>
  safeEq(crypto.createHmac('sha256', env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex'), signature || '');
export const verifyWebhookSignature = (rawBody, signature) =>
  !!env.RAZORPAY_WEBHOOK_SECRET && safeEq(crypto.createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex'), signature || '');
