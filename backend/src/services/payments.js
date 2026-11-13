import { RentPayment } from '../models/index.js';
import { newReceiptNo } from '../utils/helpers.js';
import { notify } from './notify.js';
import { emitTo } from './socket.js';

/** Idempotently mark a rent payment as paid (called by verify endpoint AND webhook). */
export async function markPaid(orderId, paymentId, method = 'razorpay') {
  const p = await RentPayment.findOneAndUpdate(
    { razorpayOrderId: orderId, status: { $ne: 'paid' } },
    [{ $set: { status: 'paid', paidAt: new Date(), amountPaid: '$amountDue', method, razorpayPaymentId: paymentId, receiptNumber: newReceiptNo(), failureReason: null } }],
    { new: true },
  );
  if (!p) return RentPayment.findOne({ razorpayOrderId: orderId });
  await notify(p.owner, { title: 'Rent received', body: `₹${p.amountDue} paid online for ${p.month}/${p.year}.`, type: 'payment' });
  await notify(p.tenant, { title: 'Payment successful', body: `Receipt ${p.receiptNumber}`, type: 'payment' });
  emitTo(String(p.owner), 'payment:updated', { id: String(p._id) }); emitTo(String(p.owner), 'dashboard:updated', {});
  emitTo(String(p.tenant), 'payment:updated', { id: String(p._id) });
  return p;
}

export async function markFailed(orderId, reason) {
  const p = await RentPayment.findOneAndUpdate({ razorpayOrderId: orderId, status: { $in: ['processing', 'pending'] } }, { status: 'failed', failureReason: reason || 'Payment failed' }, { new: true });
  if (p) { emitTo(String(p.tenant), 'payment:updated', { id: String(p._id) }); emitTo(String(p.owner), 'payment:updated', { id: String(p._id) }); }
  return p;
}
