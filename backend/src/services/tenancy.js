import { Tenancy, Bed, VacateNotice, KycDocument } from '../models/index.js';

/** Recalculate a tenancy's overall KYC status from its documents. */
export async function recomputeKyc(tenancyId) {
  const docs = await KycDocument.find({ tenancy: tenancyId }).select('status').lean();
  let status = 'pending';
  if (docs.length) {
    if (docs.some((d) => d.status === 'rejected')) status = 'rejected';
    else if (docs.every((d) => d.status === 'verified')) status = 'verified';
  }
  await Tenancy.updateOne({ _id: tenancyId }, { kycStatus: status });
  return status;
}

/** End a tenancy and free its bed. Must be called inside a transaction (pass session). */
export async function endTenancy(tenancyId, session) {
  const t = await Tenancy.findOneAndUpdate({ _id: tenancyId, status: 'active' }, { status: 'vacated', vacatedOn: new Date() }, { session, new: true });
  if (!t) return null;
  await Bed.updateOne({ _id: t.bed }, { status: 'vacant', tenancy: null }, { session });
  await VacateNotice.updateMany({ tenancy: t._id, status: 'notice_given' }, { status: 'vacated' }, { session });
  return t;
}
