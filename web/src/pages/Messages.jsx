import { useEffect, useRef, useState } from 'react';
import { Send, ArrowLeft } from 'lucide-react';
import { Avatar, Card, Empty, Skeleton, cn, Spinner } from '../components/ui.jsx';
import { useGet, useMut } from '../lib/hooks.js';
import { useAuth } from '../components/AuthContext.jsx';
import { fmtDateTime } from '../lib/format.js';

export default function Messages() {
  const { user } = useAuth();
  const conv = useGet('conversations', '/messages/conversations');
  const [sel, setSel] = useState(null);
  const msgs = useGet(`messages-${sel}`, `/messages/${sel}`, undefined, { enabled: !!sel });
  const [text, setText] = useState('');
  const send = useMut('post', '/messages', { onSuccess: () => setText('') });
  const bottom = useRef();
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs.data]);
  const person = conv.data?.items.find((c) => c.userId === sel);

  return (
    <Card className="h-[calc(100dvh-8.5rem)] min-h-[24rem] !p-0" bodyClass="flex h-full">
      <div className={cn('w-full shrink-0 overflow-y-auto border-r md:w-80', sel && 'hidden md:block')}>
        <p className="border-b p-4 font-semibold">Messages</p>
        {!conv.data ? <Skeleton className="m-4 h-24" /> : !conv.data.items.length ? <Empty title="No tenants to chat with" hint="Onboard tenants first." /> : conv.data.items.map((c) => (
          <button key={c.userId} onClick={() => setSel(c.userId)} className={cn('flex w-full items-center gap-3 border-b p-3 text-left hover:bg-slate-50', sel === c.userId && 'bg-brand-50')}>
            <Avatar name={c.name} url={c.avatarUrl} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{c.name} <span className="text-xs text-slate-400">· Room {c.room}</span></p><p className="truncate text-xs text-slate-400">{c.lastMessage || 'Say hello 👋'}</p></div>
            {c.unread > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-[10px] font-semibold text-white">{c.unread}</span>}
          </button>
        ))}
      </div>
      <div className={cn('flex min-w-0 flex-1 flex-col', !sel && 'hidden md:flex')}>
        {!sel ? <div className="flex flex-1 items-center justify-center text-sm text-slate-400">Select a tenant to start chatting</div> : <>
          <div className="flex items-center gap-3 border-b p-3"><button className="md:hidden" onClick={() => setSel(null)} aria-label="Back"><ArrowLeft className="h-5 w-5" /></button><Avatar name={person?.name} url={person?.avatarUrl} /><div><p className="text-sm font-semibold">{person?.name}</p><p className="text-xs text-slate-400">{person?.phone}</p></div></div>
          <div className="flex-1 space-y-2 overflow-y-auto bg-slate-50 p-4">
            {msgs.isLoading ? <Spinner /> : !msgs.data?.items.length ? <p className="pt-10 text-center text-sm text-slate-400">No messages yet</p> : msgs.data.items.map((m) => { const mine = String(m.from) === user.id; return <div key={m._id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}><div className={cn('max-w-[75%] rounded-2xl px-3 py-2 text-sm', mine ? 'bg-brand-600 text-white' : 'bg-white shadow-sm')}><p className="whitespace-pre-wrap break-words">{m.text}</p><p className={cn('mt-0.5 text-[10px]', mine ? 'text-blue-100' : 'text-slate-400')}>{fmtDateTime(m.createdAt)}</p></div></div>; })}
            <div ref={bottom} />
          </div>
          <form className="flex gap-2 border-t p-3" onSubmit={(e) => { e.preventDefault(); if (text.trim()) send.mutate({ to: sel, text: text.trim() }); }}>
            <input className="input" placeholder="Type a message…" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} /><button className="btn bg-brand-600 text-white" disabled={send.isPending || !text.trim()} aria-label="Send"><Send className="h-4 w-4" /></button>
          </form></>}
      </div>
    </Card>
  );
}
