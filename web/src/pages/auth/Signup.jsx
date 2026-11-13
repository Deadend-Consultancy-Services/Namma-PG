import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import AuthShell from './AuthShell.jsx';
import { Button, Field, OtpInput } from '../../components/ui.jsx';
import api, { errMsg } from '../../lib/api.js';
import { useAuth } from '../../components/AuthContext.jsx';

export default function Signup() {
  const role = sessionStorage.getItem('pg_role');
  const nav = useNavigate();
  const { setSession } = useAuth();
  const [step, setStep] = useState(1);
  const [f, setF] = useState({ name: '', phone: '', password: '', confirm: '' });
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  useEffect(() => { if (wait <= 0) return undefined; const t = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(t); }, [wait]);
  if (role !== 'owner') return <Navigate to="/role" replace />;

  const sendOtp = async (e) => {
    e?.preventDefault();
    if (f.password !== f.confirm) return toast.error('Passwords do not match');
    setBusy(true);
    try {
      const { data } = await api.post('/auth/signup/send-otp', { name: f.name, phone: f.phone, password: f.password, role: 'owner' });
      setStep(2); setWait(data.resendInSec || 45); setOtp(''); toast.success('OTP sent to your phone');
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };
  const verify = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) return toast.error('Enter the 6-digit OTP');
    setBusy(true);
    try { const { data } = await api.post('/auth/signup/verify-otp', { phone: f.phone, otp }); setSession(data); toast.success('Account created'); nav('/dashboard'); }
    catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };

  return (
    <AuthShell title={step === 1 ? 'Create owner account' : 'Verify your number'} subtitle={step === 1 ? 'Takes less than a minute' : `Enter the OTP sent to ${f.phone}`}
      footer={<>Already have an account? <Link to="/login" className="font-medium text-brand-600">Login</Link></>}>
      {step === 1 ? (
        <form onSubmit={sendOtp} className="space-y-4">
          <Field label="Full name"><input className="input" value={f.name} onChange={set('name')} required minLength={2} autoComplete="name" /></Field>
          <Field label="Phone number"><input className="input" inputMode="numeric" value={f.phone} onChange={set('phone')} required maxLength={13} placeholder="10-digit mobile number" autoComplete="tel" /></Field>
          <Field label="Password" hint="At least 8 characters"><input className="input" type="password" value={f.password} onChange={set('password')} required minLength={8} autoComplete="new-password" /></Field>
          <Field label="Confirm password"><input className="input" type="password" value={f.confirm} onChange={set('confirm')} required autoComplete="new-password" /></Field>
          <Button type="submit" loading={busy} className="w-full py-2.5">Send OTP</Button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-5">
          <OtpInput value={otp} onChange={setOtp} />
          <Button type="submit" loading={busy} className="w-full py-2.5">Verify & create account</Button>
          <div className="flex justify-between text-sm">
            <button type="button" className="text-slate-500 hover:text-slate-700" onClick={() => setStep(1)}>← Edit details</button>
            <button type="button" disabled={wait > 0 || busy} onClick={sendOtp} className="font-medium text-brand-600 disabled:text-slate-400">{wait > 0 ? `Resend in ${wait}s` : 'Resend OTP'}</button>
          </div>
        </form>
      )}
    </AuthShell>
  );
}
