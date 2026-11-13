import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Building2, Pencil, Trash2, Plus, ImagePlus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Card, Drawer, Field, PageHeader, Skeleton, Empty, ConfirmDialog, Badge, ErrorBox } from '../components/ui.jsx';
import { useGet, useMut, useForm } from '../lib/hooks.js';
import api, { errMsg } from '../lib/api.js';
import { useQueryClient } from '@tanstack/react-query';
import { label } from '../lib/format.js';
import { prepareFile } from '../lib/files.js';

const blank = { name: '', address: '', city: '', locality: '', pgType: 'boys', description: '' };

export default function Properties() {
  const [sp, setSp] = useSearchParams();
  const q = useGet('properties', '/owner/properties');
  const qc = useQueryClient();
  const [edit, setEdit] = useState(null); // null | 'new' | property
  const [del, setDel] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();
  const f = useForm(blank);
  const save = useMut('post', '/owner/properties', { success: 'Property created. You can add photos now.', onSuccess: (d) => setEdit(d.item) });
  const upd = useMut('put', (v) => `/owner/properties/${v.id}`, { success: 'Property updated', onSuccess: () => setEdit(null) });
  const rm = useMut('delete', (v) => `/owner/properties/${v.id}`, { success: 'Property deleted', onSuccess: () => setDel(null) });

  useEffect(() => { if (sp.get('new')) { setEdit('new'); sp.delete('new'); setSp(sp, { replace: true }); } }, [sp, setSp]);
  useEffect(() => { if (edit === 'new') f.reset(blank); else if (edit) f.reset({ name: edit.name, address: edit.address, city: edit.city, locality: edit.locality, pgType: edit.pgType, description: edit.description || '' }); /* eslint-disable-next-line */ }, [edit]);

  const submit = (e) => { e.preventDefault(); edit === 'new' ? save.mutate(f.v) : upd.mutate({ id: edit._id, ...f.v }); };
  const uploadImgs = async (files) => {
    if (!files.length || edit === 'new') return;
    setUploading(true);
    try {
      const prepared = await Promise.all([...files].map((x) => prepareFile(x, { imageOnly: true })));
      const fd = new FormData(); prepared.forEach((x) => fd.append('files', x));
      const { data } = await api.post(`/owner/properties/${edit._id}/images`, fd); setEdit(data.item); qc.invalidateQueries(); toast.success('Images uploaded'); } catch (err) { toast.error(errMsg(err)); } finally { setUploading(false); }
  };
  const rmImg = async (img) => {
    try { const { data } = await api.delete(`/owner/properties/${edit._id}/images/${encodeURIComponent(img.publicId)}`); setEdit(data.item); qc.invalidateQueries(); } catch (err) { toast.error(errMsg(err)); }
  };

  return (
    <>
      <PageHeader title="Properties" subtitle="All your PGs in one place"><Button onClick={() => setEdit('new')}><Plus className="h-4 w-4" /> Add Property</Button></PageHeader>
      {q.isError ? <ErrorBox error={q.error} retry={q.refetch} /> : !q.data ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-64" />)}</div>
        : !q.data.items.length ? <Card><Empty title="No properties yet" hint="Add your first PG to start managing rooms and tenants." action={<Button onClick={() => setEdit('new')}>Add your first property</Button>} /></Card> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {q.data.items.map((p) => (
            <div key={p._id} className="overflow-hidden rounded-2xl bg-white shadow-card">
              <div className="h-36 bg-slate-100">{p.images?.[0]?.url ? <img src={p.images[0].url} alt={p.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-slate-300"><Building2 className="h-10 w-10" /></div>}</div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2"><div><h3 className="font-semibold">{p.name}</h3><p className="text-xs text-slate-500">{p.locality}, {p.city}</p></div><Badge tone="blue">{label(p.pgType)}</Badge></div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded-lg bg-slate-50 p-2"><b className="block text-base">{p.rooms}</b>Rooms</div><div className="rounded-lg bg-slate-50 p-2"><b className="block text-base">{p.totalBeds}</b>Beds</div><div className="rounded-lg bg-slate-50 p-2"><b className="block text-base">{p.totalBeds ? Math.round(((p.totalBeds - p.vacantBeds) / p.totalBeds) * 100) : 0}%</b>Occupied</div></div>
                <div className="mt-3 flex justify-end gap-1"><Button variant="ghost" onClick={() => setEdit(p)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button><Button variant="ghost" className="text-red-600" onClick={() => setDel(p)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button></div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Drawer open={!!edit} onClose={() => setEdit(null)} title={edit === 'new' ? 'Add Property' : 'Edit Property'}
        footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button loading={save.isPending || upd.isPending} onClick={() => document.getElementById('prop-form').requestSubmit()}>{edit === 'new' ? 'Create' : 'Save changes'}</Button></>}>
        <form id="prop-form" onSubmit={submit} className="space-y-4">
          <Field label="Property name"><input className="input" required minLength={2} {...f.bind('name')} /></Field>
          <Field label="Address"><input className="input" required {...f.bind('address')} /></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="City"><input className="input" required {...f.bind('city')} /></Field><Field label="Locality / Area"><input className="input" required {...f.bind('locality')} /></Field></div>
          <Field label="PG type"><select className="input" {...f.bind('pgType')}><option value="boys">Boys</option><option value="girls">Girls</option><option value="co-living">Co-living</option></select></Field>
          <Field label="Description"><textarea className="input" rows={3} {...f.bind('description')} /></Field>
        </form>
        {edit && edit !== 'new' && (
          <div>
            <p className="mb-2 text-xs font-medium text-slate-600">Photos</p>
            <div className="flex flex-wrap gap-2">
              {edit.images?.map((img) => <div key={img.publicId} className="relative h-20 w-20"><img src={img.url} alt="" className="h-full w-full rounded-lg object-cover" /><button onClick={() => rmImg(img)} className="absolute -right-1 -top-1 rounded-full bg-red-600 p-0.5 text-white" aria-label="Remove image"><X className="h-3 w-3" /></button></div>)}
              <button onClick={() => fileRef.current.click()} disabled={uploading} className="flex h-20 w-20 flex-col items-center justify-center rounded-lg border-2 border-dashed text-xs text-slate-400 hover:border-brand-500">{uploading ? '…' : <><ImagePlus className="h-5 w-5" />Add</>}</button>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { uploadImgs(e.target.files); e.target.value = ''; }} />
            </div>
          </div>
        )}
        {edit === 'new' && <p className="text-xs text-slate-400">You can add photos right after creating the property.</p>}
      </Drawer>
      <ConfirmDialog open={!!del} danger title="Delete property?" message={`"${del?.name}" with all its rooms, beds, facilities and menus will be permanently deleted. This cannot be undone.`} confirmText="Delete" loading={rm.isPending} onCancel={() => setDel(null)} onConfirm={() => rm.mutate({ id: del._id })} />
    </>
  );
}
