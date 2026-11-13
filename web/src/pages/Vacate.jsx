import { useState } from 'react';
import { Button, Card, PageHeader, Skeleton, Empty, ConfirmDialog, Badge, ErrorBox, Avatar, DataTable, Tabs } from '../components/ui.jsx';
import { useGet, useMut } from '../lib/hooks.js';
import { fmtDate, label } from '../lib/format.js';

export default function Vacate() {
  const [days, setDays] = useState('15');
  const [status, setStatus] = useState('notice_given');
  const q = useGet('vacate', '/owner/vacate-notices', { status, days: status === 'notice_given' && days !== 'all' ? days : undefined });
  const [done, setDone] = useState(null);
  const [cancel, setCancel] = useState(null);
  const complete = useMut('put', (v) => `/owner/vacate-notices/${v.id}/complete`, { success: 'Tenant vacated; bed is free', onSuccess: () => setDone(null) });
  const cancelN = useMut('put', (v) => `/owner/vacate-notices/${v.id}/cancel`, { success: 'Notice cancelled', onSuccess: () => setCancel(null) });
  return (
    <>
      <PageHeader title="Vacate Notice" subtitle="Tenants who are leaving. Record notices from a tenant's profile.">
        {status === 'notice_given' && <select className="input w-44" value={days} onChange={(e) => setDays(e.target.value)}><option value="7">Next 7 days</option><option value="15">Next 15 days</option><option value="30">Next 30 days</option><option value="all">All upcoming</option></select>}
      </PageHeader>
      <Tabs value={status} onChange={setStatus} tabs={[{ value: 'notice_given', label: 'Upcoming' }, { value: 'vacated', label: 'Vacated' }, { value: 'cancelled', label: 'Cancelled' }]} />
      <Card>
        {q.isError ? <ErrorBox error={q.error} retry={q.refetch} /> : !q.data ? <Skeleton className="h-40" /> : (
          <DataTable rows={q.data.items} empty={<Empty title="No notices here" />} columns={[
            { key: 't', title: 'Tenant', render: (v) => <div className="flex items-center gap-3"><Avatar name={v.tenant?.name} url={v.tenant?.avatar?.url} /><div><p className="font-medium">{v.tenant?.name}</p><p className="text-xs text-slate-400">{v.tenant?.phone}</p></div></div> },
            { key: 'r', title: 'Room', render: (v) => `${v.tenancy?.room?.roomNumber || '—'} · ${v.tenancy?.property?.name || ''}` },
            { key: 'n', title: 'Notice date', render: (v) => fmtDate(v.noticeDate) }, { key: 'd', title: 'Vacate date', render: (v) => fmtDate(v.vacateDate) },
            { key: 'l', title: 'Days left', render: (v) => (v.status === 'notice_given' ? <Badge tone={v.daysLeft <= 7 ? 'red' : 'yellow'}>{v.daysLeft}</Badge> : '—') },
            { key: 'by', title: 'Requested by', render: (v) => label(v.requestedBy) }, { key: 'rs', title: 'Reason', render: (v) => v.reason || '—' },
            { key: 'a', title: '', render: (v) => v.status === 'notice_given' ? <div className="flex gap-1"><Button variant="secondary" onClick={() => setDone(v)}>Mark vacated</Button><Button variant="ghost" onClick={() => setCancel(v)}>Cancel</Button></div> : null },
          ]} />
        )}
      </Card>
      <ConfirmDialog open={!!done} danger title="Mark as vacated?" message={`${done?.tenant?.name}'s stay ends and the bed becomes vacant.`} confirmText="Mark vacated" loading={complete.isPending} onCancel={() => setDone(null)} onConfirm={() => complete.mutate({ id: done._id })} />
      <ConfirmDialog open={!!cancel} title="Cancel this notice?" message="The tenant will continue their stay." confirmText="Cancel notice" loading={cancelN.isPending} onCancel={() => setCancel(null)} onConfirm={() => cancelN.mutate({ id: cancel._id })} />
    </>
  );
}
