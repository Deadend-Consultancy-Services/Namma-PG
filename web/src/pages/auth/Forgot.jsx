import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import AuthShell from './AuthShell.jsx';
import { Button, Field, OtpInput } from '../../components/ui.jsx';
import api, { errMsg } from '../../lib/api.js';

export default function Forgot() {
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  useEffect(() => { if (wait <= 0) return undefined; const t = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(t); }, [wait]);

  const send = async (e) => {
    e?.preventDefault(); setBusy(true);
    try { const { data } = await api.post('/auth/forgot/send-otp', { phone }); toast.success(data.message); setStep(2); setWait(data.resendInSec || 45); }
    catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };
  const reset = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api.post('/auth/forgot/reset', { phone, otp, newPassword: pw }); toast.success('Password updated. Please log in.'); nav('/login'); }
    catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };
  return (
    <AuthShell title="Reset password" subtitle={step === 1 ? 'We will send an OTP to your phone' : 'Enter the OTP and a new password'} footer={<Link to="/login" className="text-brand-600">Back to login</Link>}>
      {step === 1 ? (
        <form onSubmit={send} className="space-y-4">
          <Field label="Phone number"><input className="input" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} required maxLength={13} /></Field>
          <Button type="submit" loading={busy} className="w-full py-2.5">Send OTP</Button>
        </form>
      ) : (
        <form onSubmit={reset} className="space-y-4">
          <OtpInput value={otp} onChange={setOtp} />
          <Field label="New password" hint="At least 8 characters"><input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={8} autoComplete="new-password" /></Field>
          <Button type="submit" loading={busy} className="w-full py-2.5">Update password</Button>
          <button type="button" disabled={wait > 0 || busy} onClick={send} className="w-full text-sm font-medium text-brand-600 disabled:text-slate-400">{wait > 0 ? `Resend in ${wait}s` : 'Resend OTP'}</button>
        </form>
      )}
    </AuthShell>
  );
}
