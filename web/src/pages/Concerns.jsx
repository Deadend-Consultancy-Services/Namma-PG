import { useState } from 'react';
import { Phone, Siren } from 'lucide-react';
import { Button, Card, Drawer, Field, PageHeader, Skeleton, Empty, Badge, statusTone, ErrorBox, Avatar, Tabs } from '../components/ui.jsx';
import { useGet, useMut } from '../lib/hooks.js';
import { fmtDateTime, label } from '../lib/format.js';

export default function Concerns() {
  const [status, setStatus] = useState('');
  const q = useGet('concerns', '/owner/concerns', { status: status || undefined });
  const [sel, setSel] = useState(null);
  const [msg, setMsg] = useState('');
  const upd = useMut('put', (v) => `/owner/concerns/${v.id}`, { success: 'Updated', onSuccess: () => setMsg('') });
  const live = sel && q.data?.items.find((c) => c._id === sel);

  return (
    <>
      <PageHeader title="Concerns & Emergencies" subtitle="Raised by your tenants from the app" />
      <Tabs value={status} onChange={setStatus} tabs={[{ value: '', label: 'All' }, { value: 'open', label: 'Open' }, { value: 'in_progress', label: 'In progress' }, { value: 'resolved', label: 'Resolved' }]} />
      {q.isError ? <ErrorBox error={q.error} retry={q.refetch} /> : !q.data ? <Skeleton className="h-48" /> : !q.data.items.length ? <Card><Empty title="No concerns" hint="Nothing to handle right now." /></Card> : (
        <div className="space-y-3">{q.data.items.map((c) => (
          <button key={c._id} onClick={() => setSel(c._id)} className={`flex w-full items-start justify-between gap-3 rounded-2xl p-4 text-left shadow-card ${c.isEmergency && c.status !== 'resolved' ? 'bg-red-50 ring-2 ring-red-400' : 'bg-white'}`}>
            <div className="flex items-start gap-3">{c.isEmergency ? <Siren className="mt-1 h-5 w-5 text-red-600" /> : <Avatar name={c.tenant?.name} />}<div><p className="font-medium">{c.tenant?.name} <span className="text-xs text-slate-400">· Room {c.roomNumber || '—'} · {c.property?.name}</span></p><p className="text-sm text-slate-600 line-clamp-2">{c.description}</p><p className="mt-1 text-xs text-slate-400">{label(c.category)} · {fmtDateTime(c.createdAt)}</p></div></div>
            <Badge tone={statusTone(c.status)}>{label(c.status)}</Badge>
          </button>))}</div>
      )}
      <Drawer open={!!live} onClose={() => setSel(null)} title={live?.isEmergency ? '🚨 Emergency' : 'Concern'}>
        {live && <>
          <div className="flex items-center justify-between"><div><p className="font-semibold">{live.tenant?.name}</p><p className="text-sm text-slate-500">Room {live.roomNumber || '—'} · {live.property?.name}</p></div><a href={`tel:${live.tenant?.phone}`} className="btn bg-emerald-600 text-white"><Phone className="h-4 w-4" /> Call</a></div>
          <p className="rounded-xl bg-slate-50 p-3 text-sm">{live.description}</p>
          {live.attachmentUrl && <a href={live.attachmentUrl} target="_blank" rel="noreferrer"><img src={live.attachmentUrl} alt="Attachment" className="max-h-64 rounded-xl border object-contain" /></a>}
          <Field label="Status"><select className="input" value={live.status} onChange={(e) => upd.mutate({ id: live._id, status: e.target.value })}><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select></Field>
          <div><p className="mb-1 text-sm font-semibold">Updates</p>{!live.updates?.length ? <p className="text-sm text-slate-400">No updates yet</p> : live.updates.map((u, i) => <div key={i} className="border-b py-2 text-sm"><b>{label(u.by)}:</b> {u.message}<span className="ml-2 text-xs text-slate-400">{fmtDateTime(u.at)}</span></div>)}</div>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (msg.trim()) upd.mutate({ id: live._id, message: msg.trim() }); }}><input className="input" placeholder="Write an update for the tenant…" value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={500} /><Button type="submit" loading={upd.isPending}>Send</Button></form>
        </>}
      </Drawer>
    </>
  );
}
