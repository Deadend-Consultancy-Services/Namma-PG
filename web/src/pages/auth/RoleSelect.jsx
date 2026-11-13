import { useNavigate } from 'react-router-dom';
import { Building2, User, ArrowLeft } from 'lucide-react';
import AuthShell from './AuthShell.jsx';

export default function RoleSelect() {
  const nav = useNavigate();
  const pick = (role) => { sessionStorage.setItem('pg_role', role); nav('/login'); };
  return (
    <AuthShell title="Who are you?" subtitle="Choose how you will use the app" footer={<button onClick={() => nav('/')} className="inline-flex items-center gap-1 hover:text-slate-700"><ArrowLeft className="h-4 w-4" /> Back</button>}>
      <div className="space-y-3">
        {[['owner', Building2, 'I am a PG Owner', 'Manage properties, tenants, rent & expenses'], ['tenant', User, 'I am a Tenant', 'Find a PG, pay rent, raise concerns']].map(([r, I, t, d]) => (
          <button key={r} onClick={() => pick(r)} className="flex w-full items-center gap-4 rounded-2xl border-2 border-slate-200 p-4 text-left transition hover:border-brand-500 hover:bg-brand-50">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100 text-brand-700"><I className="h-6 w-6" /></div>
            <div><p className="font-semibold text-slate-900">{t}</p><p className="text-sm text-slate-500">{d}</p></div>
          </button>
        ))}
      </div>
    </AuthShell>
  );
}
