import { Tenancy, RentPayment } from '../models/index.js';
import { istParts } from '../utils/helpers.js';

const DAY = 86400000;

/**
 * Make sure every active tenancy has a rent record for each month from the month it started (move-in or the date the
 * tenant was added, whichever is later) up to the current month, and keep Overdue flags correct.
 * The first month is due 7 days after the start date if the normal due day has already passed, so a tenant who joins
 * on the 27th is not marked "Overdue" immediately.
 */
export async function ensureRentRecords(ownerId) {
  const { month: curM, year: curY } = istParts();
  const q = { status: 'active' };
  if (ownerId) q.owner = ownerId;
  const tenancies = await Tenancy.find(q).select('owner tenant property rentAmount rentDueDay moveInDate createdAt').lean();

  const ops = [];
  for (const t of tenancies) {
    const start = new Date(Math.max(new Date(t.moveInDate).getTime(), new Date(t.createdAt).getTime()));
    const sy = start.getUTCFullYear(); const sm = start.getUTCMonth() + 1;
    let y = sy; let m = sm; let guard = 0;
    while ((y < curY || (y === curY && m <= curM)) && guard++ < 36) {
      const normalDue = Date.UTC(y, m - 1, t.rentDueDay);
      const dueDate = new Date(y === sy && m === sm ? Math.max(normalDue, start.getTime() + 7 * DAY) : normalDue);
      ops.push({ updateOne: {
        filter: { tenancy: t._id, month: m, year: y },
        update: { $setOnInsert: { owner: t.owner, tenant: t.tenant, property: t.property, amountDue: t.rentAmount, amountPaid: 0, status: 'pending', dueDate } },
        upsert: true,
      } });
      if (y === sy && m === sm) {
        // repair records created by earlier versions with an unfair first due date
        ops.push({ updateOne: { filter: { tenancy: t._id, month: m, year: y, status: { $in: ['pending', 'overdue'] }, dueDate: { $lt: dueDate } }, update: { $set: { dueDate } } } });
      }
      m += 1; if (m > 12) { m = 1; y += 1; }
    }
  }
  for (let i = 0; i < ops.length; i += 500) await RentPayment.bulkWrite(ops.slice(i, i + 500), { ordered: false });

  const cutoff = new Date(Date.now() - DAY);
  const base = ownerId ? { owner: ownerId } : {};
  await RentPayment.updateMany({ ...base, status: 'overdue', dueDate: { $gte: cutoff } }, { $set: { status: 'pending' } });
  await RentPayment.updateMany({ ...base, status: 'pending', dueDate: { $lt: cutoff } }, { $set: { status: 'overdue' } });
}
