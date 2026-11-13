import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Wifi, WashingMachine, Sparkles, Zap, Camera, Car, Snowflake, UtensilsCrossed, Dumbbell, Tv, ShowerHead, ShieldCheck, Check } from 'lucide-react';
import { Button, Card, Drawer, Field, PageHeader, Skeleton, Empty, ConfirmDialog, ErrorBox, cn } from '../components/ui.jsx';
import { useGet, useMut, useForm } from '../lib/hooks.js';

const ICONS = { wifi: Wifi, laundry: WashingMachine, housekeeping: Sparkles, power: Zap, cctv: Camera, parking: Car, ac: Snowflake, meals: UtensilsCrossed, gym: Dumbbell, tv: Tv, water: ShowerHead, security: ShieldCheck, check: Check };
const blank = { name: '', icon: 'check', propertyId: '' };

export default function Facilities() {
  const [sp, setSp] = useSearchParams();
  const q = useGet('facilities', '/owner/facilities');
  const props = useGet('properties', '/owner/properties');
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const f = useForm(blank);
  const create = useMut('post', '/owner/facilities', { success: 'Facility added', onSuccess: () => setEdit(null) });
  const update = useMut('put', (v) => `/owner/facilities/${v.id}`, { success: 'Facility updated', onSuccess: () => setEdit(null) });
  const toggle = useMut('put', (v) => `/owner/facilities/${v.id}`);
  const remove = useMut('delete', (v) => `/owner/facilities/${v.id}`, { success: 'Facility deleted', onSuccess: () => setDel(null) });

  useEffect(() => { if (sp.get('new')) { setEdit('new'); sp.delete('new'); setSp(sp, { replace: true }); } }, [sp, setSp]);
  useEffect(() => { if (edit === 'new') f.reset(blank); else if (edit) f.reset({ name: edit.name, icon: edit.icon, propertyId: edit.property?._id || '' }); /* eslint-disable-next-line */ }, [edit]);
  const submit = (e) => { e.preventDefault(); const body = { name: f.v.name, icon: f.v.icon, propertyId: f.v.propertyId || null }; edit === 'new' ? create.mutate(body) : update.mutate({ id: edit._id, ...body }); };

  return (
    <>
      <PageHeader title="Facilities" subtitle="What your PG offers — shown to tenants searching for a PG"><Button onClick={() => setEdit('new')}><Plus className="h-4 w-4" /> Add Facility</Button></PageHeader>
      {q.isError ? <ErrorBox error={q.error} retry={q.refetch} /> : !q.data ? <Skeleton className="h-40" /> : !q.data.items.length ? <Card><Empty title="No facilities yet" hint="Add WiFi, laundry, meals and more." action={<Button onClick={() => setEdit('new')}>Add facility</Button>} /></Card> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {q.data.items.map((fc) => { const I = ICONS[fc.icon] || Check; return (
            <div key={fc._id} className={cn('rounded-2xl bg-white p-4 shadow-card', !fc.isActive && 'opacity-60')}>
              <div className="flex items-start justify-between"><button onClick={() => setEdit(fc)} className="flex items-center gap-3 text-left"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><I className="h-5 w-5" /></div><div><p className="font-medium">{fc.name}</p><p className="text-xs text-slate-400">{fc.property?.name || 'All properties'}</p></div></button>
                <button onClick={() => setDel(fc)} className="rounded p-1 text-slate-400 hover:text-red-600" aria-label="Delete"><Trash2 className="h-4 w-4" /></button></div>
              <label className="mt-3 flex cursor-pointer items-center justify-between text-xs text-slate-500">{fc.isActive ? 'Active' : 'Inactive'}
                <input type="checkbox" role="switch" className="h-4 w-8 cursor-pointer accent-brand-600" checked={fc.isActive} onChange={(e) => toggle.mutate({ id: fc._id, isActive: e.target.checked })} /></label>
            </div>); })}
        </div>
      )}
      <Drawer open={!!edit} onClose={() => setEdit(null)} title={edit === 'new' ? 'Add Facility' : 'Edit Facility'} footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button loading={create.isPending || update.isPending} onClick={() => document.getElementById('fac-form').requestSubmit()}>Save</Button></>}>
        <form id="fac-form" onSubmit={submit} className="space-y-4">
          <Field label="Facility name"><input className="input" required minLength={2} {...f.bind('name')} placeholder="e.g. High-speed WiFi" /></Field>
          <Field label="Icon"><div className="flex flex-wrap gap-2">{Object.entries(ICONS).map(([k, I]) => <button type="button" key={k} onClick={() => f.set('icon', k)} className={cn('flex h-10 w-10 items-center justify-center rounded-lg border', f.v.icon === k ? 'border-brand-600 bg-brand-50 text-brand-600' : 'text-slate-500')} aria-label={k}><I className="h-5 w-5" /></button>)}</div></Field>
          <Field label="Applies to"><select className="input" {...f.bind('propertyId')}><option value="">All properties</option>{props.data?.items.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select></Field>
        </form>
      </Drawer>
      <ConfirmDialog open={!!del} danger title="Delete facility?" message={`"${del?.name}" will be removed.`} confirmText="Delete" loading={remove.isPending} onCancel={() => setDel(null)} onConfirm={() => remove.mutate({ id: del._id })} />
    </>
  );
}
