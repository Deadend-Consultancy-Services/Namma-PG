import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, Tooltip } from 'recharts';
import { BedDouble, CheckCircle2, DoorOpen, Users, Clock, Building2, Plus, Receipt, UserPlus, Wrench, BellRing, AlertTriangle } from 'lucide-react';
import { Card, StatCard, Skeleton, Empty, ErrorBox, Avatar, Badge, PageHeader, cn } from '../components/ui.jsx';
import { useGet } from '../lib/hooks.js';
import { inr, fmtDate } from '../lib/format.js';

const ViewAll = ({ to }) => <Link to={to} className="text-xs font-medium text-brand-600 hover:underline">View All</Link>;

export default function Dashboard() {
  const nav = useNavigate();
  const [propertyId, setPropertyId] = useState('');
  const props = useGet('properties', '/owner/properties');
  const q = useGet('dashboard', '/owner/dashboard', propertyId ? { propertyId } : {});
  const d = q.data;

  if (q.isError) return <ErrorBox error={q.error} retry={q.refetch} />;
  if (!d) return <div className="space-y-4"><div className="grid grid-cols-2 gap-4 lg:grid-cols-5">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-56" />)}</div></div>;

  const noProps = props.data && props.data.items.length === 0;
  const b = d.beds;
  const donut = [{ name: 'Occupied', value: b.allocated, c: '#22c55e' }, { name: 'Vacant', value: b.vacant, c: '#f59e0b' }];
  const menu = d.menus[0];
  const meals = menu ? [['Breakfast', menu.breakfast], ['Lunch', menu.lunch], ['Evening Snacks', menu.eveningSnacks], ['Dinner', menu.dinner]] : [];
  const actions = [['Add Property', Building2, '/properties?new=1'], ['Add Room', Plus, '/rooms?new=1'], ['Onboard Tenant', UserPlus, '/tenants?new=1'], ['Add Expense', Receipt, '/expenses?new=1'], ['Add Facility', Wrench, '/facilities?new=1'], ['Send Reminder', BellRing, '/reminders']];

  return (
    <div className="space-y-4">
      <PageHeader title="Dashboard" subtitle="Live numbers straight from your database">
        {props.data?.items.length > 1 && (
          <select className="input w-52" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
            <option value="">All properties</option>{props.data.items.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
        )}
      </PageHeader>

      {noProps && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-100 bg-brand-50 p-4">
          <div><p className="font-semibold text-brand-700">Let's set up your first PG</p><p className="text-sm text-slate-600">Add a property, then rooms and beds, then onboard your tenants.</p></div>
          <button onClick={() => nav('/properties?new=1')} className="btn bg-brand-600 text-white hover:bg-brand-700">Add property</button>
        </div>
      )}
      {(d.alerts.emergencies > 0) && (
        <Link to="/concerns" className="flex items-center gap-2 rounded-2xl bg-red-600 p-3 text-sm font-medium text-white"><AlertTriangle className="h-5 w-5" /> {d.alerts.emergencies} open emergency alert(s) — tap to respond</Link>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard icon={BedDouble} label="Total Beds" value={b.total} tone="blue" />
        <StatCard icon={CheckCircle2} label="Occupied Beds" value={b.occupied} tone="green" hint={b.total ? `${Math.round((b.occupied / b.total) * 100)}% of total` : ''} />
        <StatCard icon={DoorOpen} label="Vacant Beds" value={b.vacant} tone="orange" />
        <StatCard icon={Users} label="Allocated Beds" value={b.allocated} tone="purple" />
        <StatCard icon={Clock} label="Reserved (not moved in)" value={b.reserved} tone="red" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card title="Bed Occupancy Overview">
          {b.total === 0 ? <Empty title="No beds yet" hint="Add rooms to create beds." /> : (
            <div className="flex items-center gap-4">
              <div className="relative h-44 w-44 shrink-0">
                <ResponsiveContainer><PieChart><Pie data={donut} dataKey="value" innerRadius={52} outerRadius={74} paddingAngle={2} stroke="none">{donut.map((x) => <Cell key={x.name} fill={x.c} />)}</Pie></PieChart></ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><p className="text-2xl font-bold">{b.total}</p><p className="text-xs text-slate-400">Total Beds</p></div>
              </div>
              <ul className="space-y-2 text-sm">{donut.map((x) => <li key={x.name} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: x.c }} />{x.name}<b className="ml-1">{x.value}</b><span className="text-slate-400">({Math.round((x.value / b.total) * 100)}%)</span></li>)}</ul>
            </div>
          )}
        </Card>

        <Card title="Today's Food Menu" action={<Link to="/food-menu" className="rounded-md border px-2 py-0.5 text-xs font-medium text-brand-600">Edit Menu</Link>}>
          {!menu ? <Empty title="No menu set for today" action={<Link to="/food-menu" className="text-sm font-medium text-brand-600">Set today's menu</Link>} /> : (
            <div className="space-y-2">{menu.property && d.menus.length > 1 && <p className="text-xs text-slate-400">{menu.property}</p>}
              {meals.map(([n, items]) => <div key={n} className="rounded-lg bg-slate-50 p-2"><p className="text-xs font-semibold text-slate-700">{n}</p><p className="text-xs text-slate-500">{items?.length ? items.join(', ') : '—'}</p></div>)}</div>
          )}
        </Card>

        <Card title={`Rent Collection (${new Date(d.rent.year, d.rent.month - 1).toLocaleString('en-IN', { month: 'long' })})`} action={<ViewAll to="/rent" />}>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border p-3"><p className="text-xs text-slate-500">Collected</p><p className="text-lg font-bold">{inr(d.rent.collected)}</p><div className="mt-2 h-1.5 rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${d.rent.percent}%` }} /></div><p className="mt-1 text-right text-[11px] text-slate-400">{d.rent.percent}%</p></div>
            <div className="rounded-xl border p-3"><p className="text-xs text-slate-500">Pending</p><p className="text-lg font-bold">{inr(d.rent.pending)}</p><div className="mt-2 h-1.5 rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-red-500" style={{ width: `${100 - d.rent.percent}%` }} /></div><p className="mt-1 text-right text-[11px] text-slate-400">{d.rent.expected ? 100 - d.rent.percent : 0}%</p></div>
          </div>
          <p className="mt-3 text-sm text-slate-500">Total Expected: <b className="text-slate-800">{inr(d.rent.expected)}</b></p>
        </Card>

        <Card title="Vacant Beds in Rooms" action={<ViewAll to="/rooms" />}>
          {!d.vacantRooms.length ? <Empty title="No vacant beds" /> : d.vacantRooms.map((r) => (
            <div key={r.roomId} className="flex items-center justify-between border-b py-2 text-sm last:border-0"><span className="flex items-center gap-2"><BedDouble className="h-4 w-4 text-violet-500" />Room {r.roomNumber} <span className="text-slate-400">({r.sharingType} Sharing)</span></span><Badge tone="green">{r.vacant} {r.vacant === 1 ? 'Bed' : 'Beds'}</Badge></div>
          ))}
        </Card>

        <Card title="Who is Staying Where" action={<ViewAll to="/tenants" />}>
          {!d.staying.length ? <Empty title="No tenants yet" action={<Link to="/tenants?new=1" className="text-sm font-medium text-brand-600">Onboard a tenant</Link>} /> : d.staying.map((t) => (
            <div key={t.tenancyId} className="flex items-center justify-between border-b py-2 last:border-0"><div className="flex items-center gap-3"><Avatar name={t.name} url={t.avatarUrl} /><div><p className="text-sm font-medium">{t.name}</p><p className="text-xs text-slate-400">Room {t.roomNumber} ({t.sharingType} Sharing)</p></div></div><Badge tone={t.occupied >= t.capacity ? 'green' : 'yellow'}>{t.occupied}/{t.capacity}</Badge></div>
          ))}
        </Card>

        <Card title="Expense Overview (This Month)" action={<ViewAll to="/expenses" />}>
          <div className="flex items-end justify-between"><div><p className="text-xs text-slate-500">Total Expense</p><p className="text-2xl font-bold">{inr(d.expenses.total)}</p></div>
            {d.expenses.changePercent !== null && <Badge tone={d.expenses.changePercent > 0 ? 'red' : 'green'}>{d.expenses.changePercent > 0 ? '↑' : '↓'} {Math.abs(d.expenses.changePercent)}% vs last month</Badge>}</div>
          <div className="mt-3 h-24">{d.expenses.daily.length ? <ResponsiveContainer><AreaChart data={d.expenses.daily}><Tooltip formatter={(v) => inr(v)} labelFormatter={(l) => `Day ${l}`} /><Area dataKey="amount" stroke="#7c3aed" fill="#ede9fe" strokeWidth={2} /></AreaChart></ResponsiveContainer> : <p className="pt-8 text-center text-xs text-slate-400">No expenses recorded this month</p>}</div>
        </Card>

        <Card title="Reminders" action={<ViewAll to="/reminders" />}>
          {[['Rent due this month', d.reminders.rentDue, 'Pending', 'yellow'], ['Overdue rent', d.reminders.overdue, 'Overdue', 'red'], ['KYC pending', d.reminders.kycPending, 'Pending', 'yellow'], ['Vacating soon', d.reminders.vacatingSoon, 'Next 15 days', 'blue']].map(([t, n, bd, tone]) => (
            <div key={t} className="flex items-center justify-between border-b py-2 text-sm last:border-0"><span>{t}: <b>{n}</b></span><Badge tone={n ? tone : 'gray'}>{n ? bd : 'All clear'}</Badge></div>
          ))}
        </Card>

        <Card title="KYC Pending" action={<ViewAll to="/kyc" />}>
          {!d.kycPending.length ? <Empty title="No pending KYC" /> : d.kycPending.map((t) => (
            <div key={t.tenancyId} className="flex items-center justify-between border-b py-2 last:border-0"><div className="flex items-center gap-3"><Avatar name={t.name} url={t.avatarUrl} /><div><p className="text-sm font-medium">{t.name}</p><p className="text-xs text-slate-400">Room {t.roomNumber}</p></div></div><Badge tone="yellow">Pending</Badge></div>
          ))}
        </Card>

        <Card title="Vacating in Next 7-15 Days" action={<ViewAll to="/vacate" />}>
          {!d.vacating.length ? <Empty title="Nobody is vacating soon" /> : d.vacating.map((v) => (
            <div key={v.id} className="flex items-center justify-between border-b py-2 last:border-0"><div className="flex items-center gap-3"><Avatar name={v.name} url={v.avatarUrl} /><div><p className="text-sm font-medium">{v.name}</p><p className="text-xs text-slate-400">Room {v.roomNumber}</p></div></div><div className="text-right text-xs"><p className="font-medium">{fmtDate(v.vacateDate)}</p><p className="text-slate-400">({v.daysLeft} days left)</p></div></div>
          ))}
        </Card>
      </div>

      <Card title="Quick Actions">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {actions.map(([t, I, to]) => <button key={t} onClick={() => nav(to)} className="flex items-center gap-2 rounded-xl border bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700 transition hover:border-brand-500 hover:bg-brand-50"><I className="h-4 w-4 text-brand-600" />{t}</button>)}
        </div>
      </Card>
    </div>
  );
}
