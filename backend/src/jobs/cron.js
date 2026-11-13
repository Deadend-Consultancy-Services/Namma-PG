import cron from 'node-cron';
import { RentPayment, VacateNotice } from '../models/index.js';
import { ensureRentRecords } from '../services/rent.js';
import { endTenancy } from '../services/tenancy.js';
import { withTx } from '../config/db.js';
import { emitTo } from '../services/socket.js';
import { notify } from '../services/notify.js';

export function startJobs() {
  // Daily 00:10 IST: create this month's rent records + flag overdue
  cron.schedule('10 0 * * *', () => ensureRentRecords().catch((e) => console.error('rent job', e.message)), { timezone: 'Asia/Kolkata' });

  // Daily 00:20 IST: complete vacate notices whose date has arrived
  cron.schedule('20 0 * * *', async () => {
    try {
      const due = await VacateNotice.find({ status: 'notice_given', vacateDate: { $lte: new Date() } });
      for (const n of due) {
        await withTx((s) => endTenancy(n.tenancy, s));
        await notify(n.owner, { title: 'Tenant vacated', body: 'A vacate date has arrived; the bed is free again.', type: 'vacate' });
        emitTo(String(n.owner), 'dashboard:updated', {});
      }
    } catch (e) { console.error('vacate job', e.message); }
  }, { timezone: 'Asia/Kolkata' });

  // Every 15 min: abandoned online checkouts go back to pending
  cron.schedule('*/15 * * * *', () =>
    RentPayment.updateMany({ status: 'processing', updatedAt: { $lt: new Date(Date.now() - 30 * 60 * 1000) } }, { status: 'pending' }).catch((e) => console.error('order job', e.message)));

  // Run once at boot
  ensureRentRecords().catch((e) => console.error('rent boot', e.message));
}
