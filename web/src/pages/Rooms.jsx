import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, BedDouble, UserPlus } from 'lucide-react';
import { Button, Card, Drawer, Field, PageHeader, Skeleton, Empty, ConfirmDialog, Badge, statusTone, ErrorBox, Avatar } from '../components/ui.jsx';
import { useGet, useMut, useForm } from '../lib/hooks.js';
import { inr, label } from '../lib/format.js';

const blank = { propertyId: '', roomNumber: '', floor: 0, sharingType: 2, rentPerBed: '' };

export default function Rooms() {
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const [propertyId, setPropertyId] = useState('');
  const [status, setStatus] = useState('');
  const props = useGet('properties', '/owner/properties');
  const q = useGet('rooms', '/owner/rooms', { propertyId: propertyId || undefined, status: status || undefined });
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const [beds, setBeds] = useState(null);
  const f = useForm(blank);
  const create = useMut('post', '/owner/rooms', { success: 'Room added with beds', onSuccess: () => setEdit(null) });
  const update = useMut('put', (v) => `/owner/rooms/${v.id}`, { success: 'Room updated', onSuccess: () => setEdit(null) });
  const remove = useMut('delete', (v) => `/owner/rooms/${v.id}`, { success: 'Room deleted', onSuccess: () => setDel(null) });

  useEffect(() => { if (sp.get('new')) { setEdit('new'); sp.delete('new'); setSp(sp, { replace: true }); } }, [sp, setSp]);
  useEffect(() => {
    if (edit === 'new') f.reset({ ...blank, propertyId: propertyId || props.data?.items?.[0]?._id || '' });
    else if (edit) f.reset({ propertyId: edit.property?._id, roomNumber: edit.roomNumber, floor: edit.floor, sharingType: edit.sharingType, rentPerBed: edit.rentPerBed });
    // eslint-disable-next-line
  }, [edit]);

  const submit = (e) => { e.preventDefault(); const { propertyId: p, ...rest } = f.v; edit === 'new' ? create.mutate(f.v) : update.mutate({ id: edit._id, ...rest }); };
  const noProps = props.data && !props.data.items.length;
  const liveBeds = beds && q.data?.items.find((r) => r._id === beds._id);

  return (
    <>
      <PageHeader title="Rooms & Beds" subtitle="Manage rooms and see every bed's status">
        <select className="input w-44" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}><option value="">All properties</option>{props.data?.items.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select>
        <select className="input w-40" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All status</option><option value="vacant">Vacant</option><option value="partial">Partially occupied</option><option value="full">Full</option></select>
        <Button disabled={noProps} onClick={() => setEdit('new')}><Plus className="h-4 w-4" /> Add Room</Button>
      </PageHeader>
      {noProps && <Card><Empty title="Add a property first" hint="Rooms belong to a property." /></Card>}
      {q.isError ? <ErrorBox error={q.error} retry={q.refetch} /> : !q.data ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
        : !q.data.items.length ? (!noProps && <Card><Empty title="No rooms found" hint="Add a room — beds are created automatically from the sharing type." /></Card>) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {q.data.items.map((r) => (
            <div key={r._id} className="rounded-2xl bg-white p-4 shadow-card">
              <div className="flex items-start justify-between"><div><h3 className="font-semibold">Room {r.roomNumber}</h3><p className="text-xs text-slate-500">{r.property?.name} · Floor {r.floor} · {r.sharingType} Sharing</p></div><Badge tone={statusTone(r.status)}>{r.status === 'partial' ? 'Partially occupied' : label(r.status)}</Badge></div>
              <p className="mt-2 text-sm text-slate-600">{inr(r.rentPerBed)} / bed · <b>{r.vacant}</b> vacant of {r.beds.length}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">{r.beds.map((b) => <span key={b._id} title={b.tenancy?.tenant?.name || 'Vacant'} className={`flex h-8 w-8 items-center justify-center rounded-lg text-[11px] font-semibold ${b.status === 'vacant' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{b.label}</span>)}</div>
              <div className="mt-3 flex justify-between"><Button variant="secondary" onClick={() => setBeds(r)}><BedDouble className="h-4 w-4" /> Manage beds</Button>
                <div><Button variant="ghost" onClick={() => setEdit(r)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button><Button variant="ghost" className="text-red-600" onClick={() => setDel(r)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button></div></div>
            </div>
          ))}
        </div>
      )}

      <Drawer open={!!liveBeds} onClose={() => setBeds(null)} title={`Room ${liveBeds?.roomNumber} — beds`}>
        <div className="space-y-2">
          {liveBeds?.beds.map((b) => (
            <div key={b._id} className="flex items-center justify-between rounded-xl border p-3">
              <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold">{b.label}</span>
                {b.status === 'occupied' ? <div className="flex items-center gap-2"><Avatar name={b.tenancy?.tenant?.name} url={b.tenancy?.tenant?.avatar?.url} size="h-8 w-8" /><div><p className="text-sm font-medium">{b.tenancy?.tenant?.name}</p><p className="text-xs text-slate-400">{b.tenancy?.tenant?.phone}</p></div></div> : <Badge tone="yellow">Vacant</Badge>}</div>
              {b.status === 'vacant' && <Button variant="secondary" onClick={() => nav(`/tenants?new=1&propertyId=${liveBeds.property._id}&roomId=${liveBeds._id}&bedId=${b._id}`)}><UserPlus className="h-4 w-4" /> Assign tenant</Button>}
            </div>
          ))}
        </div>
      </Drawer>

      <Drawer open={!!edit} onClose={() => setEdit(null)} title={edit === 'new' ? 'Add Room' : `Edit Room ${edit?.roomNumber}`}
        footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button loading={create.isPending || update.isPending} onClick={() => document.getElementById('room-form').requestSubmit()}>Save</Button></>}>
        <form id="room-form" onSubmit={submit} className="space-y-4">
          {edit === 'new' && <Field label="Property"><select className="input" required {...f.bind('propertyId')}><option value="" disabled>Select…</option>{props.data?.items.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select></Field>}
          <div className="grid grid-cols-2 gap-3"><Field label="Room number"><input className="input" required {...f.bind('roomNumber')} /></Field><Field label="Floor"><input className="input" type="number" min={0} {...f.bind('floor')} /></Field></div>
          <div className="grid grid-cols-2 gap-3"><Field label="Sharing type" hint={edit === 'new' ? 'Creates this many beds' : 'Changing adds/removes vacant beds'}><input className="input" type="number" min={1} max={12} required {...f.bind('sharingType')} /></Field><Field label="Rent per bed (₹)"><input className="input" type="number" min={0} required {...f.bind('rentPerBed')} /></Field></div>
        </form>
      </Drawer>
      <ConfirmDialog open={!!del} danger title="Delete room?" message={`Room ${del?.roomNumber} and its beds will be deleted. Rooms with tenants cannot be deleted.`} confirmText="Delete" loading={remove.isPending} onCancel={() => setDel(null)} onConfirm={() => remove.mutate({ id: del._id })} />
    </>
  );
}
