import { useState } from 'react';
import { Trash2, Phone } from 'lucide-react';
import { Button, Card, Field, PageHeader, Skeleton, Empty, Badge, statusTone, ErrorBox, Avatar } from '../components/ui.jsx';
import { useGet, useMut } from '../lib/hooks.js';
import { todayYmd, fmtDate, label } from '../lib/format.js';

const DEFAULT_TIMES = ['10:00', '11:00', '12:00', '16:00', '17:00', '18:00'];

export default function Visits() {
  const props = useGet('properties', '/owner/properties');
  const slots = useGet('slots', '/owner/visits/slots');
  const visits = useGet('visits', '/owner/visits');
  const [propertyId, setPropertyId] = useState('');
  const [date, setDate] = useState(todayYmd());
  const [times, setTimes] = useState(DEFAULT_TIMES.slice(0, 3));
  const [custom, setCustom] = useState('');
  const pid = propertyId || props.data?.items?.[0]?._id;
  const add = useMut('post', '/owner/visits/slots', { success: (d) => `${d.created} slot(s) added` });
  const del = useMut('delete', (v) => `/owner/visits/slots/${v.id}`, { success: 'Slot removed' });
  const done = useMut('put', (v) => `/owner/visits/${v.id}/complete`, { success: 'Marked completed' });
  const toggle = (t) => setTimes((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));
  const grouped = {}; (slots.data?.items || []).forEach((s) => (grouped[`${s.date}|${s.property?.name}`] ||= []).push(s));

  return (
    <>
      <PageHeader title="Visits" subtitle="Publish visit slots; tenants book them from the app" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Add visit slots">
          {!props.data?.items.length ? <Empty title="Add a property first" /> : (
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); add.mutate({ propertyId: pid, date, times }); }}>
              <div className="grid grid-cols-2 gap-3"><Field label="Property"><select className="input" value={pid || ''} onChange={(e) => setPropertyId(e.target.value)}>{props.data.items.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select></Field><Field label="Date"><input type="date" className="input" min={todayYmd()} value={date} onChange={(e) => setDate(e.target.value)} /></Field></div>
              <div><p className="mb-1 text-xs font-medium text-slate-600">Time slots</p><div className="flex flex-wrap gap-2">{[...new Set([...DEFAULT_TIMES, ...times])].sort().map((t) => <button type="button" key={t} onClick={() => toggle(t)} className={`rounded-lg border px-3 py-1.5 text-sm ${times.includes(t) ? 'border-brand-600 bg-brand-50 text-brand-700' : 'text-slate-500'}`}>{t}</button>)}
                <span className="flex gap-1"><input type="time" className="input w-28" value={custom} onChange={(e) => setCustom(e.target.value)} /><Button variant="secondary" disabled={!custom} onClick={() => { toggle(custom); setCustom(''); }}>Add</Button></span></div></div>
              <Button type="submit" loading={add.isPending} disabled={!times.length}>Publish {times.length} slot(s)</Button>
            </form>
          )}
        </Card>
        <Card title="Upcoming slots">
          {slots.isError ? <ErrorBox error={slots.error} /> : !slots.data ? <Skeleton className="h-32" /> : !slots.data.items.length ? <Empty title="No upcoming slots" /> : Object.entries(grouped).map(([k, list]) => (
            <div key={k} className="mb-3"><p className="text-sm font-medium">{fmtDate(k.split('|')[0])} <span className="text-xs text-slate-400">· {k.split('|')[1]}</span></p>
              <div className="mt-1 flex flex-wrap gap-2">{list.map((s) => <span key={s._id} className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs ${s.isBooked ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{s.time}{s.isBooked ? ' · booked' : <button onClick={() => del.mutate({ id: s._id })} aria-label="Remove slot"><Trash2 className="h-3 w-3 text-red-500" /></button>}</span>)}</div></div>
          ))}
        </Card>
      </div>
      <Card title="Visit bookings" className="mt-4">
        {visits.isError ? <ErrorBox error={visits.error} /> : !visits.data ? <Skeleton className="h-32" /> : !visits.data.items.length ? <Empty title="No visit bookings yet" /> : visits.data.items.map((v) => (
          <div key={v._id} className="flex flex-wrap items-center justify-between gap-2 border-b py-3 last:border-0"><div className="flex items-center gap-3"><Avatar name={v.tenant?.name} /><div><p className="text-sm font-medium">{v.tenant?.name}</p><a href={`tel:${v.tenant?.phone}`} className="inline-flex items-center gap-1 text-xs text-brand-600"><Phone className="h-3 w-3" />{v.tenant?.phone}</a></div></div>
            <div className="text-sm">{v.property?.name} · {fmtDate(v.date)} {v.time}</div><div className="flex items-center gap-2"><Badge tone={statusTone(v.status)}>{label(v.status)}</Badge>{v.status === 'upcoming' && <Button variant="secondary" onClick={() => done.mutate({ id: v._id })}>Mark done</Button>}</div></div>
        ))}
      </Card>
    </>
  );
}
