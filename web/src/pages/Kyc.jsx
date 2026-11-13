import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Card, Drawer, Field, PageHeader, Skeleton, Empty, Badge, statusTone, ErrorBox, Avatar, DataTable, Tabs } from '../components/ui.jsx';
import { useGet, useMut } from '../lib/hooks.js';
import api, { errMsg } from '../lib/api.js';
import { fmtDate, label } from '../lib/format.js';

export default function Kyc() {
  const [status, setStatus] = useState('pending');
  const q = useGet('kyc', '/owner/kyc', { status });
  const [sel, setSel] = useState(null);
  const [url, setUrl] = useState(null);
  const [reason, setReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const review = useMut('put', (v) => `/owner/kyc/${v.id}/review`, { success: 'KYC updated', onSuccess: () => close() });
  const close = () => { setSel(null); setUrl(null); setReason(''); setRejecting(false); };
  const open = async (k) => {
    setSel(k); setUrl(null);
    if (!k.hasFile) return;
    try { const { data } = await api.get(`/owner/kyc/${k._id}/file`); setUrl(data.url); } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <>
      <PageHeader title="KYC Management" subtitle="Verify tenant documents" />
      <Tabs value={status} onChange={setStatus} tabs={[{ value: 'pending', label: 'Pending' }, { value: 'verified', label: 'Verified' }, { value: 'rejected', label: 'Rejected' }]} />
      <Card>
        {q.isError ? <ErrorBox error={q.error} retry={q.refetch} /> : !q.data ? <Skeleton className="h-48" /> : (
          <DataTable rows={q.data.items} empty={<Empty title={`No ${status} documents`} hint="Tenants (or you) can upload documents from the tenant profile / mobile app." />} columns={[
            { key: 't', title: 'Tenant', render: (k) => <div className="flex items-center gap-3"><Avatar name={k.tenant?.name} url={k.tenant?.avatar?.url} /><div><p className="font-medium">{k.tenant?.name}</p><p className="text-xs text-slate-400">{k.tenant?.phone}</p></div></div> },
            { key: 'r', title: 'Room', render: (k) => k.tenancy?.room?.roomNumber || '—' },
            { key: 'd', title: 'Document', render: (k) => label(k.documentType) },
            { key: 'u', title: 'Uploaded', render: (k) => fmtDate(k.createdAt) },
            { key: 's', title: 'Status', render: (k) => <Badge tone={statusTone(k.status)}>{label(k.status)}</Badge> },
            { key: 'a', title: '', render: (k) => <Button variant="secondary" onClick={() => open(k)}>Review</Button> },
          ]} />
        )}
      </Card>
      <Drawer open={!!sel} onClose={close} title="Review document"
        footer={sel?.status === 'pending' || sel?.status === 'rejected' ? (rejecting ? <><Button variant="secondary" onClick={() => setRejecting(false)}>Back</Button><Button variant="danger" loading={review.isPending} onClick={() => review.mutate({ id: sel._id, action: 'reject', reason })}>Confirm reject</Button></> : <><Button variant="danger" onClick={() => setRejecting(true)}>Reject</Button><Button variant="success" loading={review.isPending} onClick={() => review.mutate({ id: sel._id, action: 'approve' })}>Approve</Button></>) : null}>
        {sel && <>
          <div className="flex items-center gap-3"><Avatar name={sel.tenant?.name} /><div><p className="font-semibold">{sel.tenant?.name}</p><p className="text-sm text-slate-500">{label(sel.documentType)} · {fmtDate(sel.createdAt)}</p></div></div>
          {!sel.hasFile ? <p className="text-sm text-slate-400">No file attached.</p> : !url ? <Skeleton className="h-64" /> : (
            <div className="space-y-2">
              <img src={url} alt="KYC document" className="max-h-96 w-full rounded-xl border bg-slate-50 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-brand-600"><ExternalLink className="h-4 w-4" /> Open file in new tab</a>
              <p className="text-xs text-slate-400">This secure link expires in 5 minutes.</p>
            </div>
          )}
          {sel.status === 'rejected' && sel.rejectionReason && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">Previously rejected: {sel.rejectionReason}</p>}
          {rejecting && <Field label="Reason for rejection (sent to the tenant)"><textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Photo is blurry, please upload again" /></Field>}
        </>}
      </Drawer>
    </>
  );
}
