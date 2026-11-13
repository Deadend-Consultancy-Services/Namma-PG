import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { UserPlus, Search, Upload, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Card, Drawer, Field, PageHeader, Skeleton, Empty, ConfirmDialog, Badge, statusTone, ErrorBox, Avatar, DataTable, Tabs } from '../components/ui.jsx';
import { useGet, useMut, useForm } from '../lib/hooks.js';
import api, { errMsg } from '../lib/api.js';
import { inr, fmtDate, label, todayYmd } from '../lib/format.js';
import { prepareFile } from '../lib/files.js';

const DOCS = ['aadhaar', 'pan', 'passport', 'driving_license', 'voter_id', 'college_id', 'photo'];
const blank = { name: '', phone: '', email: '', propertyId: '', roomId: '', bedId: '', rentAmount: '', depositAmount: 0, moveInDate: todayYmd(), rentDueDay: 5, ecName: '', ecPhone: '' };

function Onboard({ open, onClose, preset }) {
  const [step, setStep] = useState(1);
  const f = useForm(blank);
  const props = useGet('properties', '/owner/properties');
  const beds = useGet('beds-vacant', '/owner/beds/vacant', { propertyId: f.v.propertyId || undefined }, { enabled: open && !!f.v.propertyId });
  const create = useMut('post', '/owner/tenants', { success: (d) => (d.tenantNeedsSignup ? 'Tenant added. They can create their account with this phone number.' : 'Tenant added'), onSuccess: onClose });
  useEffect(() => { if (open) { setStep(1); f.reset({ ...blank, moveInDate: todayYmd(), ...preset, propertyId: preset?.propertyId || props.data?.items?.[0]?._id || '' }); } /* eslint-disable-next-line */ }, [open]);

  const roomsMap = {}; (beds.data?.items || []).forEach((b) => { (roomsMap[b.room._id] ||= { ...b.room, beds: [] }).beds.push(b); });
  const rooms = Object.values(roomsMap);
  const bed = beds.data?.items.find((b) => b._id === f.v.bedId);
  const pickRoom = (id) => { const r = roomsMap[id]; f.setAll((p) => ({ ...p, roomId: id, bedId: '', rentAmount: r ? r.rentPerBed : p.rentAmount })); };
  const next = () => {
    if (step === 1 && (f.v.name.trim().length < 2 || !/^\d{10,13}$/.test(f.v.phone.replace(/\D/g, '')))) return toast.error('Enter the tenant name and a valid phone number');
    if (step === 2 && (!f.v.propertyId || !f.v.roomId || !f.v.bedId || f.v.rentAmount === '')) return toast.error('Choose a bed and enter the rent');
    setStep(step + 1);
  };
  const submit = () => create.mutate({ name: f.v.name, phone: f.v.phone, email: f.v.email, propertyId: f.v.propertyId, roomId: f.v.roomId, bedId: f.v.bedId, rentAmount: f.v.rentAmount, depositAmount: f.v.depositAmount, moveInDate: f.v.moveInDate, rentDueDay: f.v.rentDueDay, emergencyContact: { name: f.v.ecName, phone: f.v.ecPhone } });

  return (
    <Drawer open={open} onClose={onClose} title={`Onboard Tenant — step ${step} of 3`}
      footer={<>{step > 1 && <Button variant="secondary" onClick={() => setStep(step - 1)}>Back</Button>}{step < 3 ? <Button onClick={next}>Next</Button> : <Button loading={create.isPending} onClick={submit}>Confirm & add tenant</Button>}</>}>
      {step === 1 && <>
        <Field label="Full name"><input className="input" {...f.bind('name')} /></Field>
        <Field label="Phone number" hint="The tenant uses this number to create their account"><input className="input" inputMode="numeric" {...f.bind('phone')} /></Field>
        <Field label="Email (optional)"><input className="input" type="email" {...f.bind('email')} /></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Emergency contact name"><input className="input" {...f.bind('ecName')} /></Field><Field label="Emergency contact phone"><input className="input" {...f.bind('ecPhone')} /></Field></div>
      </>}
      {step === 2 && <>
        <Field label="Property"><select className="input" value={f.v.propertyId} onChange={(e) => f.setAll((p) => ({ ...p, propertyId: e.target.value, roomId: '', bedId: '' }))}><option value="" disabled>Select…</option>{props.data?.items.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select></Field>
        <Field label="Room"><select className="input" value={f.v.roomId} onChange={(e) => pickRoom(e.target.value)}><option value="" disabled>{beds.isLoading ? 'Loading…' : rooms.length ? 'Select room…' : 'No vacant beds'}</option>{rooms.map((r) => <option key={r._id} value={r._id}>Room {r.roomNumber} ({r.sharingType} sharing) — {r.beds.length} vacant</option>)}</select></Field>
        <Field label="Bed"><select className="input" disabled={!f.v.roomId} {...f.bind('bedId')}><option value="" disabled>Select bed…</option>{roomsMap[f.v.roomId]?.beds.map((b) => <option key={b._id} value={b._id}>{b.label}</option>)}</select></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Monthly rent (₹)"><input className="input" type="number" min={0} {...f.bind('rentAmount')} /></Field><Field label="Deposit (₹)"><input className="input" type="number" min={0} {...f.bind('depositAmount')} /></Field></div>
        <div className="grid grid-cols-2 gap-3"><Field label="Move-in date"><input className="input" type="date" {...f.bind('moveInDate')} /></Field><Field label="Rent due day (1-28)"><input className="input" type="number" min={1} max={28} {...f.bind('rentDueDay')} /></Field></div>
      </>}
      {step === 3 && (
        <dl className="space-y-2 text-sm">{[['Name', f.v.name], ['Phone', f.v.phone], ['Property', props.data?.items.find((p) => p._id === f.v.propertyId)?.name], ['Room / Bed', `${roomsMap[f.v.roomId]?.roomNumber} / ${bed?.label}`], ['Rent', inr(f.v.rentAmount)], ['Deposit', inr(f.v.depositAmount)], ['Move-in', fmtDate(f.v.moveInDate)], ['Rent due day', f.v.rentDueDay]].map(([k, v]) => <div key={k} className="flex justify-between border-b pb-2"><dt className="text-slate-500">{k}</dt><dd className="font-medium">{v}</dd></div>)}</dl>
      )}
    </Drawer>
  );
}

function Profile({ id, onClose }) {
  const q = useGet(`tenant-${id}`, `/owner/tenants/${id}`, undefined, { enabled: !!id });
  const qc = useQueryClient();
  const [vac, setVac] = useState(false);
  const [notice, setNotice] = useState(null);
  const [docType, setDocType] = useState('aadhaar');
  const [up, setUp] = useState(false);
  const fileRef = useRef();
  const vacate = useMut('post', `/owner/tenants/${id}/vacate`, { success: 'Tenant vacated; bed is free', onSuccess: () => { setVac(false); onClose(); } });
  const recNotice = useMut('post', '/owner/vacate-notices', { success: 'Vacate notice recorded', onSuccess: () => setNotice(null) });
  const t = q.data?.item;
  const upload = async (file) => {
    setUp(true);
    try {
      const fd = new FormData(); fd.append('file', await prepareFile(file)); fd.append('documentType', docType);
      await api.post(`/owner/kyc/upload/${id}`, fd); qc.invalidateQueries(); toast.success('Document uploaded'); } catch (e) { toast.error(errMsg(e)); } finally { setUp(false); }
  };
  return (
    <Drawer open={!!id} onClose={onClose} title="Tenant profile">
      {!t ? <Skeleton className="h-48" /> : <>
        <div className="flex items-center gap-3"><Avatar name={t.tenant.name} url={t.tenant.avatar?.url} size="h-14 w-14" /><div><p className="text-lg font-semibold">{t.tenant.name}</p><p className="text-sm text-slate-500">{t.tenant.phone}{t.tenant.email ? ` · ${t.tenant.email}` : ''}</p>{!t.tenant.claimed && <Badge tone="yellow">Has not created account yet</Badge>}</div></div>
        <div className="grid grid-cols-2 gap-3 text-sm">{[['Property', t.property?.name], ['Room / Bed', `${t.room?.roomNumber} / ${t.bed?.label}`], ['Rent', inr(t.rentAmount)], ['Deposit', inr(t.depositAmount)], ['Move-in', fmtDate(t.moveInDate)], ['Due day', t.rentDueDay], ['Status', label(t.status)], ['KYC', label(t.kycStatus)]].map(([k, v]) => <div key={k} className="rounded-lg bg-slate-50 p-2"><p className="text-xs text-slate-400">{k}</p><p className="font-medium">{v}</p></div>)}</div>
        {q.data.notice && <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-700">Vacating on {fmtDate(q.data.notice.vacateDate)}</p>}
        <div><p className="mb-2 text-sm font-semibold">KYC documents</p>
          {!q.data.kyc.length ? <p className="text-sm text-slate-400">No documents yet</p> : q.data.kyc.map((k) => <div key={k._id} className="flex items-center justify-between border-b py-2 text-sm"><span>{label(k.documentType)}</span><Badge tone={statusTone(k.status)}>{label(k.status)}</Badge></div>)}
          {t.status === 'active' && <div className="mt-2 flex gap-2"><select className="input w-40" value={docType} onChange={(e) => setDocType(e.target.value)}>{DOCS.map((d) => <option key={d} value={d}>{label(d)}</option>)}</select><Button variant="secondary" loading={up} onClick={() => fileRef.current.click()}><Upload className="h-4 w-4" /> Upload</Button><input ref={fileRef} hidden type="file" accept="image/*,application/pdf" onChange={(e) => { if (e.target.files[0]) upload(e.target.files[0]); e.target.value = ''; }} /></div>}</div>
        <div><p className="mb-2 text-sm font-semibold">Payments</p>{!q.data.payments.length ? <p className="text-sm text-slate-400">No rent records yet</p> : q.data.payments.slice(0, 8).map((p) => <div key={p._id} className="flex items-center justify-between border-b py-2 text-sm"><span>{p.month}/{p.year} · {inr(p.amountDue)}</span><Badge tone={statusTone(p.status)}>{label(p.status)}</Badge></div>)}</div>
        {t.status === 'active' && <div className="flex gap-2 border-t pt-4"><Button variant="secondary" onClick={() => setNotice({ vacateDate: todayYmd(), reason: '' })}>Record vacate notice</Button><Button variant="danger" onClick={() => setVac(true)}>Vacate now</Button></div>}
      </>}
      <ConfirmDialog open={vac} danger title="Vacate this tenant now?" message="The stay will end and the bed becomes vacant immediately." confirmText="Vacate" loading={vacate.isPending} onCancel={() => setVac(false)} onConfirm={() => vacate.mutate({})} />
      <Drawer open={!!notice} onClose={() => setNotice(null)} title="Record vacate notice" footer={<Button loading={recNotice.isPending} onClick={() => recNotice.mutate({ tenancyId: id, ...notice })}>Save notice</Button>}>
        {notice && <><Field label="Vacate date"><input type="date" className="input" min={todayYmd()} value={notice.vacateDate} onChange={(e) => setNotice({ ...notice, vacateDate: e.target.value })} /></Field><Field label="Reason (optional)"><textarea className="input" rows={3} value={notice.reason} onChange={(e) => setNotice({ ...notice, reason: e.target.value })} /></Field></>}
      </Drawer>
    </Drawer>
  );
}

export default function Tenants() {
  const [sp, setSp] = useSearchParams();
  const [search, setSearch] = useState(sp.get('search') || '');
  const [status, setStatus] = useState('active');
  const [kyc, setKyc] = useState('');
  const [onb, setOnb] = useState(false);
  const [preset, setPreset] = useState(null);
  const [view, setView] = useState(null);
  const q = useGet('tenants', '/owner/tenants', { status, search: search || undefined, kyc: kyc || undefined });

  useEffect(() => {
    if (sp.get('new')) { setPreset({ propertyId: sp.get('propertyId') || '', roomId: sp.get('roomId') || '', bedId: sp.get('bedId') || '' }); setOnb(true); ['new', 'propertyId', 'roomId', 'bedId'].forEach((k) => sp.delete(k)); setSp(sp, { replace: true }); }
  }, [sp, setSp]);

  return (
    <>
      <PageHeader title="Tenants" subtitle="Everyone staying in your PGs"><Button onClick={() => { setPreset(null); setOnb(true); }}><UserPlus className="h-4 w-4" /> Onboard Tenant</Button></PageHeader>
      <Tabs value={status} onChange={setStatus} tabs={[{ value: 'active', label: 'Current' }, { value: 'vacated', label: 'Past tenants' }]} />
      <Card>
        <div className="mb-3 flex flex-wrap gap-2">
          <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input className="input w-64 pl-9" placeholder="Search name, phone, room" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <select className="input w-40" value={kyc} onChange={(e) => setKyc(e.target.value)}><option value="">All KYC</option><option value="pending">KYC pending</option><option value="verified">Verified</option><option value="rejected">Rejected</option></select>
        </div>
        {q.isError ? <ErrorBox error={q.error} retry={q.refetch} /> : !q.data ? <Skeleton className="h-48" /> : (
          <DataTable rows={q.data.items} empty={<Empty title="No tenants found" hint="Onboard a tenant to see them here." />} columns={[
            { key: 'n', title: 'Tenant', render: (t) => <div className="flex items-center gap-3"><Avatar name={t.tenant?.name} url={t.tenant?.avatar?.url} /><div><p className="font-medium">{t.tenant?.name}</p><p className="text-xs text-slate-400">{t.tenant?.phone}</p></div></div> },
            { key: 'r', title: 'Room / Bed', render: (t) => `${t.room?.roomNumber} / ${t.bed?.label}` },
            { key: 'p', title: 'Property', render: (t) => t.property?.name },
            { key: 'm', title: 'Move-in', render: (t) => fmtDate(t.moveInDate) },
            { key: 'rs', title: 'Rent', render: (t) => <Badge tone={statusTone(t.rentStatus)}>{label(t.rentStatus)}</Badge> },
            { key: 'k', title: 'KYC', render: (t) => <Badge tone={statusTone(t.kycStatus)}>{label(t.kycStatus)}</Badge> },
            { key: 'a', title: '', render: (t) => <Button variant="ghost" onClick={() => setView(t._id)}><Eye className="h-4 w-4" /> View</Button> },
          ]} />
        )}
      </Card>
      <Onboard open={onb} onClose={() => setOnb(false)} preset={preset} />
      <Profile id={view} onClose={() => setView(null)} />
    </>
  );
}
