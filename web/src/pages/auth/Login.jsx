import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';
import AuthShell from './AuthShell.jsx';
import { Button, Field } from '../../components/ui.jsx';
import api, { errMsg } from '../../lib/api.js';
import { useAuth } from '../../components/AuthContext.jsx';

export default function Login() {
  const role = sessionStorage.getItem('pg_role');
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const { setSession } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!role) return <Navigate to="/role" replace />;
  if (role === 'tenant') {
    return (
      <AuthShell title="Tenant app" subtitle="Tenants use the PG mobile app" footer={<button onClick={() => nav('/role')} className="hover:text-slate-700">← Choose a different role</button>}>
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-brand-50 p-6 text-center"><Smartphone className="h-10 w-10 text-brand-600" />
          <p className="text-sm text-slate-600">Open the PG tenant mobile app on your phone to search PGs, book visits, pay rent and raise concerns.</p></div>
      </AuthShell>
    );
  }

  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { const { data } = await api.post('/auth/login', { phone, password, role: 'owner' }); setSession(data); toast.success('Welcome back!'); nav('/dashboard'); }
    catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };

  return (
    <AuthShell title="Owner login" subtitle="Log in with your phone number" footer={<>New here? <Link to="/signup" className="font-medium text-brand-600">Create account</Link> · <button onClick={() => nav('/role')} className="hover:text-slate-700">Change role</button></>}>
      {sp.get('expired') && <p className="mb-3 rounded-lg bg-amber-50 p-2 text-sm text-amber-700">Your session expired. Please log in again.</p>}
      <form onSubmit={submit} className="space-y-4">
        <Field label="Phone number"><input className="input" inputMode="numeric" autoComplete="tel" maxLength={13} placeholder="10-digit mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} required /></Field>
        <Field label="Password">
          <div className="relative"><input className="input pr-10" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-2.5 text-slate-400" aria-label="Toggle password">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
        </Field>
        <div className="text-right"><Link to="/forgot" className="text-sm text-brand-600">Forgot password?</Link></div>
        <Button type="submit" onClick={undefined} loading={busy} className="w-full py-2.5">Login</Button>
      </form>
    </AuthShell>
  );
}
