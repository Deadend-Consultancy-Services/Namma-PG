import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Home, LayoutDashboard, Building2, BedDouble, Users, ShieldCheck, Wallet, Receipt, Utensils, Wrench, BellRing, LogOut as LogOutIcon, FileBarChart, MessageSquare, Settings as Cog, Bell, Menu, Search, CalendarClock, CalendarCheck, AlertTriangle } from 'lucide-react';
import { useAuth } from './AuthContext.jsx';
import { Avatar, cn } from './ui.jsx';
import { useGet, useMut } from '../lib/hooks.js';
import { connectSocket } from '../lib/socket.js';
import { fmtDateTime } from '../lib/format.js';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/properties', label: 'Properties', icon: Building2 },
  { to: '/rooms', label: 'Rooms & Beds', icon: BedDouble },
  { to: '/tenants', label: 'Tenants', icon: Users },
  { to: '/kyc', label: 'KYC Management', icon: ShieldCheck },
  { to: '/rent', label: 'Rent & Payments', icon: Wallet },
  { to: '/expenses', label: 'Expenses', icon: Receipt },
  { to: '/food-menu', label: 'Food Menu', icon: Utensils },
  { to: '/facilities', label: 'Facilities', icon: Wrench },
  { to: '/reminders', label: 'Reminders', icon: BellRing },
  { to: '/vacate', label: 'Vacate Notice', icon: CalendarClock },
  { to: '/visits', label: 'Visits', icon: CalendarCheck },
  { to: '/concerns', label: 'Concerns', icon: AlertTriangle, badgeKey: 'concerns' },
  { to: '/reports', label: 'Reports', icon: FileBarChart },
  { to: '/messages', label: 'Messages', icon: MessageSquare, badgeKey: 'messages' },
  { to: '/settings', label: 'Settings', icon: Cog },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [bell, setBell] = useState(false);
  const bellRef = useRef();

  const unreadMsgs = useGet('msg-unread', '/messages/unread-count');
  const notifs = useGet('notifications', '/notifications');
  const alerts = useGet('dashboard', '/owner/dashboard', {}, { select: (d) => d.alerts });
  const readAll = useMut('put', '/notifications/read-all');
  const badges = { messages: unreadMsgs.data?.count, concerns: alerts.data?.openConcerns };

  // Real-time: server pushes events, every screen refetches fresh data from MongoDB
  useEffect(() => {
    const s = connectSocket();
    const refresh = () => qc.invalidateQueries();
    ['dashboard:updated', 'payment:updated', 'kyc:updated', 'concern:new', 'concern:updated', 'message:new'].forEach((e) => s.on(e, refresh));
    s.on('notification:new', (n) => { qc.invalidateQueries({ queryKey: ['notifications'] }); toast(n.title + (n.body ? ` — ${n.body}` : ''), { icon: '🔔' }); });
    s.on('concern:emergency', (e) => { refresh(); toast.error(`EMERGENCY: ${e.tenant} (Room ${e.room}) — ${e.phone}`, { duration: 15000 }); });
    return () => { s.off(); };
  }, [qc]);

  useEffect(() => {
    const h = (e) => bellRef.current && !bellRef.current.contains(e.target) && setBell(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div className="flex h-dvh overflow-hidden">
      {open && <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={cn('fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-navy-900 text-slate-300 transition-transform lg:static lg:translate-x-0', open ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white"><Home className="h-5 w-5" /></div>
          <div><p className="text-sm font-semibold text-white">PG Owner</p><p className="text-xs text-slate-400">Owner Dashboard</p></div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
          {NAV.map(({ to, label, icon: Icon, badgeKey }) => (
            <NavLink key={to} to={to} onClick={() => setOpen(false)} className={({ isActive }) => cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition', isActive ? 'bg-brand-600 text-white' : 'hover:bg-navy-700 hover:text-white')}>
              <Icon className="h-4 w-4" />
              <span className="flex-1">{label}</span>
              {badges[badgeKey] > 0 && <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white">{badges[badgeKey]}</span>}
            </NavLink>
          ))}
        </nav>
        <button onClick={async () => { await logout(); nav('/'); }} className="m-3 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-navy-700 hover:text-white"><LogOutIcon className="h-4 w-4" /> Log out</button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b bg-white px-4 py-3">
          <button className="rounded p-1.5 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Menu"><Menu className="h-5 w-5" /></button>
          <div className="hidden sm:block"><p className="text-sm font-semibold">Welcome back, {user.name.split(' ')[0]} 👋</p></div>
          <div className="ml-auto flex items-center gap-3">
            <form className="relative hidden md:block" onSubmit={(e) => { e.preventDefault(); const q = new FormData(e.target).get('q'); if (q) nav(`/tenants?search=${encodeURIComponent(q)}`); }}>
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input name="q" className="input w-64 pl-9" placeholder="Search tenants, rooms…" />
            </form>
            <div className="relative" ref={bellRef}>
              <button onClick={() => setBell((b) => !b)} className="relative rounded-full p-2 hover:bg-slate-100" aria-label="Notifications">
                <Bell className="h-5 w-5 text-slate-600" />
                {notifs.data?.unread > 0 && <span className="absolute right-0.5 top-0.5 rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">{notifs.data.unread}</span>}
              </button>
              {bell && (
                <div className="fixed inset-x-3 top-16 z-50 rounded-xl border bg-white p-2 shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-80">
                  <div className="flex items-center justify-between px-2 py-1"><p className="text-sm font-semibold">Notifications</p>
                    {notifs.data?.unread > 0 && <button onClick={() => readAll.mutate({})} className="text-xs text-brand-600">Mark all read</button>}</div>
                  <div className="max-h-80 overflow-y-auto">
                    {!notifs.data?.items?.length ? <p className="p-4 text-center text-sm text-slate-400">No notifications yet</p> : notifs.data.items.map((n) => (
                      <div key={n._id} className={cn('rounded-lg px-2 py-2 text-sm', !n.readAt && 'bg-brand-50')}><p className="font-medium">{n.title}</p>{n.body && <p className="text-xs text-slate-500">{n.body}</p>}<p className="mt-0.5 text-[11px] text-slate-400">{fmtDateTime(n.createdAt)}</p></div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button onClick={() => nav('/settings')} className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 hover:bg-slate-100">
              <Avatar name={user.name} url={user.avatarUrl} />
              <div className="hidden text-left leading-tight sm:block"><p className="text-sm font-medium">{user.name}</p><p className="text-[11px] text-emerald-600">Owner</p></div>
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6"><Outlet /></main>
      </div>
    </div>
  );
}
