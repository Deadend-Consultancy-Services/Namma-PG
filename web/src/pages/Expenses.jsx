import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Paperclip } from 'lucide-react';
import { Button, Card, Drawer, Field, PageHeader, Skeleton, Empty, ConfirmDialog, Badge, ErrorBox, DataTable } from '../components/ui.jsx';
import { useGet, useMut, useForm } from '../lib/hooks.js';
import { inr, fmtDate, label, todayYmd } from '../lib/format.js';
import toast from 'react-hot-toast';
import { prepareFile } from '../lib/files.js';

const CATS = ['maintenance', 'food', 'utilities', 'salary', 'rent', 'supplies', 'other'];
const blank = { propertyId: '', category: 'maintenance', amount: '', date: todayYmd(), notes: '' };

export default function Expenses() {
  const [sp, setSp] = useSearchParams();
  const [propertyId, setPropertyId] = useState('');
  const [category, setCategory] = useState('');
  const [from, setFrom] = useState(() => todayYmd().slice(0, 8) + '01');
  const [to, setTo] = useState('');
  const props = useGet('properties', '/owner/properties');
  const q = useGet('expenses', '/owner/expenses', { propertyId: propertyId || undefined, category: category || undefined, from: from || undefined, to: to ? `${to}T23:59:59` : undefined });
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const fileRef = useRef();
  const [file, setFile] = useState(null);
  const f = useForm(blank);
  const done = () => { setEdit(null); setFile(null); };
  const create = useMut('post', '/owner/expenses', { success: 'Expense added', onSuccess: done });
  const update = useMut('put', (v) => `/owner/expenses/${v.id}`, { success: 'Expense updated', onSuccess: done });
  const remove = useMut('delete', (v) => `/owner/expenses/${v.id}`, { success: 'Expense deleted', onSuccess: () => setDel(null) });

  useEffect(() => { if (sp.get('new')) { setEdit('new'); sp.delete('new'); setSp(sp, { replace: true }); } }, [sp, setSp]);
  useEffect(() => {
    if (edit === 'new') f.reset({ ...blank, date: todayYmd(), propertyId: propertyId || props.data?.items?.[0]?._id || '' });
    else if (edit) f.reset({ propertyId: edit.property?._id, category: edit.category, amount: edit.amount, date: edit.date.slice(0, 10), notes: edit.notes || '' });
    // eslint-disable-next-line
  }, [edit]);

  const submit = (e) => {
    e.preventDefault();
    const fd = new FormData(); Object.entries(f.v).forEach(([k, v]) => { if (v !== '' && v != null) fd.append(k, v); }); if (file) fd.append('receipt', file);
    edit === 'new' ? create.mutate({ __body: fd }) : update.mutate({ id: edit._id, __body: fd });
  };

  return (
    <>
      <PageHeader title="Expenses" subtitle="Track every rupee spent"><Button disabled={!props.data?.items.length} onClick={() => setEdit('new')}><Plus className="h-4 w-4" /> Add Expense</Button></PageHeader>
      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1"><p className="text-xs text-slate-500">Total (filtered)</p><p className="text-3xl font-bold">{inr(q.data?.total)}</p></Card>
        <Card title="By category" className="lg:col-span-2">{!q.data?.byCategory.length ? <p className="text-sm text-slate-400">No data</p> : <div className="flex flex-wrap gap-2">{q.data.byCategory.map((c) => <Badge key={c.category} tone="purple" className="px-3 py-1 text-sm">{label(c.category)}: {inr(c.total)}</Badge>)}</div>}</Card>
      </div>
      <Card>
        <div className="mb-3 flex flex-wrap gap-2">
          <select className="input w-44" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}><option value="">All properties</option>{props.data?.items.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select>
          <select className="input w-40" value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All categories</option>{CATS.map((c) => <option key={c} value={c}>{label(c)}</option>)}</select>
          <input type="date" className="input w-40" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" /><input type="date" className="input w-40" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" />
        </div>
        {q.isError ? <ErrorBox error={q.error} retry={q.refetch} /> : !q.data ? <Skeleton className="h-48" /> : (
          <DataTable rows={q.data.items} empty={<Empty title="No expenses in this period" />} columns={[
            { key: 'd', title: 'Date', render: (e) => fmtDate(e.date) }, { key: 'c', title: 'Category', render: (e) => <Badge tone="purple">{label(e.category)}</Badge> },
            { key: 'p', title: 'Property', render: (e) => e.property?.name }, { key: 'n', title: 'Notes', render: (e) => e.notes || '—' },
            { key: 'a', title: 'Amount', render: (e) => <b>{inr(e.amount)}</b> },
            { key: 'r', title: '', render: (e) => <div className="flex items-center gap-1">{e.receipt?.url && <a href={e.receipt.url} target="_blank" rel="noreferrer" className="p-2 text-slate-500 hover:text-brand-600" aria-label="Receipt"><Paperclip className="h-4 w-4" /></a>}<Button variant="ghost" onClick={() => setEdit(e)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" className="text-red-600" onClick={() => setDel(e)}><Trash2 className="h-4 w-4" /></Button></div> },
          ]} />
        )}
      </Card>
      <Drawer open={!!edit} onClose={done} title={edit === 'new' ? 'Add Expense' : 'Edit Expense'} footer={<><Button variant="secondary" onClick={done}>Cancel</Button><Button loading={create.isPending || update.isPending} onClick={() => document.getElementById('exp-form').requestSubmit()}>Save</Button></>}>
        <form id="exp-form" onSubmit={submit} className="space-y-4">
          <Field label="Property"><select className="input" required {...f.bind('propertyId')}><option value="" disabled>Select…</option>{props.data?.items.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Category"><select className="input" {...f.bind('category')}>{CATS.map((c) => <option key={c} value={c}>{label(c)}</option>)}</select></Field><Field label="Amount (₹)"><input className="input" type="number" min={1} required {...f.bind('amount')} /></Field></div>
          <Field label="Date"><input className="input" type="date" required {...f.bind('date')} /></Field>
          <Field label="Notes"><textarea className="input" rows={2} {...f.bind('notes')} /></Field>
          <Field label="Receipt (optional)"><div className="flex items-center gap-2"><Button variant="secondary" onClick={() => fileRef.current.click()}><Paperclip className="h-4 w-4" /> {file ? file.name : 'Attach file'}</Button><input ref={fileRef} hidden type="file" accept="image/*,application/pdf" onChange={async (e) => { const f0 = e.target.files[0]; e.target.value = ''; if (!f0) return setFile(null); try { setFile(await prepareFile(f0)); } catch (err) { toast.error(err.message); } }} /></div></Field>
        </form>
      </Drawer>
      <ConfirmDialog open={!!del} danger title="Delete expense?" message="This expense will be removed from your records." confirmText="Delete" loading={remove.isPending} onCancel={() => setDel(null)} onConfirm={() => remove.mutate({ id: del._id })} />
    </>
  );
}
