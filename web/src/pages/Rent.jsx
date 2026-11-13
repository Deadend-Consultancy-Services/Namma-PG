import { useState } from 'react';
import { Bell, CheckCircle2 } from 'lucide-react';
import { Button, Card, Drawer, Field, PageHeader, Skeleton, Empty, Badge, statusTone, ErrorBox, Avatar, DataTable, StatCard } from '../components/ui.jsx';
import { useGet, useMut } from '../lib/hooks.js';
import { inr, fmtDate, label, MONTHS } from '../lib/format.js';
import { Wallet, Clock, AlertTriangle, CheckCheck } from 'lucide-react';

export default function Rent() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [propertyId, setPropertyId] = useState('');
  const [status, setStatus] = useState('');
  const props = useGet('properties', '/owner/properties');
  const q = useGet('rent', '/owner/rent', { month, year, propertyId: propertyId || undefined, status: status || undefined });
  const [pay, setPay] = useState(null);
  const mark = useMut('put', (v) => `/owner/rent/${v.id}/mark-paid`, { success: 'Marked as paid', onSuccess: () => setPay(null) });
  const remind = useMut('post', (v) => `/owner/rent/${v.id}/remind`, { success: 'Reminder sent' });
  const s = q.data?.summary;

  return (
    <>
      <PageHeader title="Rent & Payments" subtitle="Collections update live when tenants pay online">
        <select className="input w-32" value={month} onChange={(e) => setMonth(+e.target.value)}>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
        <select className="input w-24" value={year} onChange={(e) => setYear(+e.target.value)}>{[year - 1, year, year + 1].filter((v, i, a) => a.indexOf(v) === i).map((y) => <option key={y}>{y}</option>)}</select>
        <select className="input w-44" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}><option value="">All properties</option>{props.data?.items.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select>
        <select className="input w-36" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All status</option>{['paid', 'pending', 'processing', 'overdue', 'failed'].map((x) => <option key={x} value={x}>{label(x)}</option>)}</select>
      </PageHeader>
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Wallet} label="Expected" value={inr(s?.expected)} tone="blue" /><StatCard icon={CheckCheck} label="Collected" value={inr(s?.collected)} tone="green" hint={`${s?.paidCount || 0} paid`} />
        <StatCard icon={Clock} label="Pending" value={inr(s?.pending)} tone="orange" /><StatCard icon={AlertTriangle} label="Overdue" value={s?.overdueCount ?? 0} tone="red" />
      </div>
      <Card>
        {q.isError ? <ErrorBox error={q.error} retry={q.refetch} /> : !q.data ? <Skeleton className="h-48" /> : (
          <DataTable rows={q.data.items} empty={<Empty title="No rent records for this month" hint="Rent records are created automatically for every active tenant." />} columns={[
            { key: 't', title: 'Tenant', render: (r) => <div className="flex items-center gap-3"><Avatar name={r.tenant?.name} url={r.tenant?.avatar?.url} /><div><p className="font-medium">{r.tenant?.name}</p><p className="text-xs text-slate-400">{r.property?.name}</p></div></div> },
            { key: 'r', title: 'Room', render: (r) => `${r.tenancy?.room?.roomNumber || '—'} / ${r.tenancy?.bed?.label || ''}` },
            { key: 'a', title: 'Rent', render: (r) => inr(r.amountDue) },
            { key: 'd', title: 'Due date', render: (r) => fmtDate(r.dueDate) },
            { key: 's', title: 'Status', render: (r) => <Badge tone={statusTone(r.status)}>{label(r.status)}</Badge> },
            { key: 'm', title: 'Paid via', render: (r) => (r.status === 'paid' ? `${label(r.method)} · ${fmtDate(r.paidAt)}` : '—') },
            { key: 'x', title: '', render: (r) => r.status === 'paid' ? <span className="text-xs text-slate-400">{r.receiptNumber}</span> : <div className="flex gap-1"><Button variant="ghost" loading={remind.isPending && remind.variables?.id === r._id} onClick={() => remind.mutate({ id: r._id })}><Bell className="h-4 w-4" /></Button><Button variant="secondary" onClick={() => setPay({ ...r, method: 'cash', note: '' })}><CheckCircle2 className="h-4 w-4" /> Mark paid</Button></div> },
          ]} />
        )}
      </Card>
      <Drawer open={!!pay} onClose={() => setPay(null)} title="Record payment" footer={<Button variant="success" loading={mark.isPending} onClick={() => mark.mutate({ id: pay._id, method: pay.method, note: pay.note || undefined })}>Confirm {inr(pay?.amountDue)} received</Button>}>
        {pay && <><p className="text-sm text-slate-600">Use this for cash / direct transfers. Online payments are marked automatically.</p>
          <Field label="Received via"><select className="input" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}><option value="cash">Cash</option><option value="upi">UPI (direct)</option><option value="bank">Bank transfer</option></select></Field>
          <Field label="Note (optional)"><input className="input" value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} /></Field></>}
      </Drawer>
    </>
  );
}
