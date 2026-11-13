import { Link, useNavigate } from 'react-router-dom';
import { Home, ShieldCheck, Wallet, BedDouble } from 'lucide-react';
import { Button } from '../../components/ui.jsx';

export default function Welcome() {
  const nav = useNavigate();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-navy-900 to-navy-700 p-6 text-center text-white">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-600"><Home className="h-10 w-10" /></div>
      <h1 className="text-3xl font-bold sm:text-4xl">Run your PG, effortlessly</h1>
      <p className="mt-3 max-w-md text-slate-300">Beds, tenants, KYC, rent and expenses — all in one place, updated in real time.</p>
      <div className="mt-6 grid max-w-xl grid-cols-3 gap-3 text-xs text-slate-300">
        {[[BedDouble, 'Live bed status'], [ShieldCheck, 'KYC in minutes'], [Wallet, 'Online rent']].map(([I, t]) => (
          <div key={t} className="rounded-2xl bg-white/10 p-3"><I className="mx-auto mb-1 h-5 w-5" />{t}</div>
        ))}
      </div>
      <Button className="mt-8 px-10 py-3 text-base" onClick={() => nav('/role')}>Get Started</Button>
      <nav className="mt-10 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-slate-400">
        <Link to="/terms" className="hover:text-white">Terms &amp; Conditions</Link><Link to="/privacy" className="hover:text-white">Privacy Policy</Link>
        <Link to="/refund-policy" className="hover:text-white">Refund Policy</Link><Link to="/contact" className="hover:text-white">Contact Us</Link>
      </nav>
    </div>
  );
}
