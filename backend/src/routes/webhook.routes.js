import { Router } from 'express';
import express from 'express';
import { verifyWebhookSignature } from '../services/razorpay.js';
import { markPaid, markFailed } from '../services/payments.js';
import { ProcessedEvent } from '../models/index.js';

const router = Router();
// Must receive the RAW body: the signature is computed over the exact bytes Razorpay sent.
router.post('/razorpay', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
  try {
    const sig = req.headers['x-razorpay-signature'];
    if (!Buffer.isBuffer(req.body) || !verifyWebhookSignature(req.body, sig)) return res.status(400).json({ success: false });
    const eventId = req.headers['x-razorpay-event-id'];
    if (eventId) {
      try { await ProcessedEvent.create({ eventId }); } catch { return res.json({ success: true, duplicate: true }); }
    }
    const evt = JSON.parse(req.body.toString('utf8'));
    const pay = evt.payload?.payment?.entity;
    if (evt.event === 'payment.captured' || evt.event === 'order.paid') {
      const orderId = pay?.order_id || evt.payload?.order?.entity?.id;
      if (orderId) await markPaid(orderId, pay?.id || null);
    } else if (evt.event === 'payment.failed' && pay?.order_id) {
      await markFailed(pay.order_id, pay.error_description);
    }
    res.json({ success: true });
  } catch (e) {
    console.error('Webhook error', e.message);
    res.status(500).json({ success: false }); // Razorpay will retry
  }
});
export default router;
