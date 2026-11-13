import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Card, Field, PageHeader, Tabs, Avatar } from '../components/ui.jsx';
import { useMut, useForm } from '../lib/hooks.js';
import api, { errMsg } from '../lib/api.js';
import { useAuth } from '../components/AuthContext.jsx';
import { prepareFile } from '../lib/files.js';

export default function Settings() {
  const { user, setUser, logout } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState('profile');
  const f = useForm({ name: user.name, email: user.email || '' });
  const pw = useForm({ currentPassword: '', newPassword: '', confirm: '' });
  const fileRef = useRef();
  const [up, setUp] = useState(false);
  const save = useMut('put', '/profile', { success: 'Profile updated', onSuccess: (d) => setUser(d.user) });
  const chg = useMut('put', '/profile/password', { success: 'Password changed. Please log in again.', onSuccess: async () => { await logout(); nav('/'); } });
  const avatar = async (file) => {
    setUp(true);
    try {
      const fd = new FormData(); fd.append('file', await prepareFile(file, { imageOnly: true }));
      const { data } = await api.post('/profile/avatar', fd); setUser(data.user); toast.success('Photo updated'); } catch (e) { toast.error(errMsg(e)); } finally { setUp(false); }
  };
  return (
    <>
      <PageHeader title="Settings" />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'profile', label: 'Profile' }, { value: 'account', label: 'Account' }]} />
      {tab === 'profile' ? (
        <Card className="max-w-xl">
          <div className="mb-5 flex items-center gap-4"><div className="relative"><Avatar name={user.name} url={user.avatarUrl} size="h-20 w-20" /><button onClick={() => fileRef.current.click()} disabled={up} className="absolute -bottom-1 -right-1 rounded-full bg-brand-600 p-1.5 text-white" aria-label="Change photo"><Camera className="h-4 w-4" /></button><input ref={fileRef} hidden type="file" accept="image/*" onChange={(e) => { if (e.target.files[0]) avatar(e.target.files[0]); e.target.value = ''; }} /></div><div><p className="font-semibold">{user.name}</p><p className="text-sm text-slate-500">{user.phone}</p></div></div>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(f.v); }}>
            <Field label="Full name"><input className="input" required minLength={2} {...f.bind('name')} /></Field>
            <Field label="Email"><input className="input" type="email" {...f.bind('email')} /></Field>
            <Field label="Phone" hint="Phone number cannot be changed"><input className="input" value={user.phone} disabled /></Field>
            <Button type="submit" loading={save.isPending}>Save changes</Button>
          </form>
        </Card>
      ) : (
        <Card title="Change password" className="max-w-xl">
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (pw.v.newPassword !== pw.v.confirm) return toast.error('Passwords do not match'); chg.mutate({ currentPassword: pw.v.currentPassword, newPassword: pw.v.newPassword }); }}>
            <Field label="Current password"><input className="input" type="password" required autoComplete="current-password" {...pw.bind('currentPassword')} /></Field>
            <Field label="New password" hint="At least 8 characters"><input className="input" type="password" required minLength={8} autoComplete="new-password" {...pw.bind('newPassword')} /></Field>
            <Field label="Confirm new password"><input className="input" type="password" required autoComplete="new-password" {...pw.bind('confirm')} /></Field>
            <div className="flex gap-2"><Button type="submit" loading={chg.isPending}>Update password</Button><Button variant="secondary" onClick={async () => { await logout(); nav('/'); }}>Log out</Button></div>
          </form>
        </Card>
      )}
    </>
  );
}
