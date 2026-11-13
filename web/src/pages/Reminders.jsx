import { useState } from 'react';
import { Send, Wallet, ShieldCheck } from 'lucide-react';
import { Button, Card, PageHeader, Skeleton, Empty, ConfirmDialog, ErrorBox, Field, Drawer } from '../components/ui.jsx';
import { useGet, useMut } from '../lib/hooks.js';
import { fmtDateTime, label } from '../lib/format.js';

export default function Reminders() {
  const q = useGet('reminders', '/owner/reminders');
  const tenants = useGet('tenants', '/owner/tenants', { status: 'active' });
  const [confirm, setConfirm] = useState(null);
  const [custom, setCustom] = useState(null);
  const send = useMut('post', '/owner/reminders/send', { success: (d) => `Reminder sent to ${d.sent} tenant(s).${d.notInApp ? ` ${d.notInApp} ha${d.notInApp === 1 ? 's' : 've'}n't created an app account yet and will see it after signing up — please also contact them directly.` : ''}`, onSuccess: () => { setConfirm(null); setCustom(null); } });
  const cards = [['rent', Wallet, 'Rent reminder', q.data?.rentDue, 'tenants with rent pending or overdue'], ['kyc', ShieldCheck, 'KYC reminder', q.data?.kycPending, 'tenants with KYC pending or rejected']];

  return (
    <>
      <PageHeader title="Reminders" subtitle="Notify tenants instantly in their app"><Button variant="secondary" onClick={() => setCustom({ ids: [], message: '' })}><Send className="h-4 w-4" /> Custom message</Button></PageHeader>
      {q.isError ? <ErrorBox error={q.error} retry={q.refetch} /> : !q.data ? <Skeleton className="h-40" /> : <>
        <div className="mb-4 grid gap-4 md:grid-cols-2">
          {cards.map(([type, I, title, n, hint]) => (
            <Card key={type}><div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><I className="h-5 w-5" /></div><div><p className="font-semibold">{title}</p><p className="text-sm text-slate-500"><b>{n}</b> {hint}</p></div></div>
              <Button disabled={!n} onClick={() => setConfirm({ type, n })}><Send className="h-4 w-4" /> Send to all</Button></div></Card>
          ))}
        </div>
        <Card title="Recently sent">
          {!q.data.history.length ? <Empty title="No reminders sent yet" /> : q.data.history.map((h) => <div key={h.id} className="flex items-center justify-between border-b py-2 text-sm last:border-0"><div><p className="font-medium">{label(h.type)} reminder</p><p className="text-xs text-slate-400 line-clamp-1">{h.message}</p></div><div className="text-right text-xs text-slate-400"><p>{h.count} tenant(s)</p><p>{fmtDateTime(h.at)}</p></div></div>)}
        </Card>
      </>}
      <ConfirmDialog open={!!confirm} title="Send reminder?" message={`This will notify ${confirm?.n} tenant(s) in their app.`} confirmText="Send" loading={send.isPending} onCancel={() => setConfirm(null)} onConfirm={() => send.mutate({ type: confirm.type })} />
      <Drawer open={!!custom} onClose={() => setCustom(null)} title="Custom message" footer={<Button loading={send.isPending} disabled={!custom?.ids.length || !custom?.message.trim()} onClick={() => send.mutate({ type: 'custom', tenancyIds: custom.ids, message: custom.message })}>Send to {custom?.ids.length || 0}</Button>}>
        {custom && <><Field label="Message"><textarea className="input" rows={3} maxLength={300} value={custom.message} onChange={(e) => setCustom({ ...custom, message: e.target.value })} /></Field>
          <div><p className="mb-1 text-xs font-medium text-slate-600">Tenants</p>{tenants.data?.items.map((t) => <label key={t._id} className="flex items-center gap-2 border-b py-2 text-sm"><input type="checkbox" checked={custom.ids.includes(t._id)} onChange={(e) => setCustom({ ...custom, ids: e.target.checked ? [...custom.ids, t._id] : custom.ids.filter((x) => x !== t._id) })} />{t.tenant?.name} <span className="text-xs text-slate-400">Room {t.room?.roomNumber}</span></label>)}</div></>}
      </Drawer>
    </>
  );
}
