import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { Download } from 'lucide-react';
import { Button, Card, PageHeader, Skeleton, Empty, ErrorBox, Tabs, DataTable } from '../components/ui.jsx';
import { useGet } from '../lib/hooks.js';
import { inr, downloadCsv, label } from '../lib/format.js';

export default function Reports() {
  const [type, setType] = useState('revenue');
  const [propertyId, setPropertyId] = useState('');
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState('');
  const props = useGet('properties', '/owner/properties');
  const q = useGet('reports', '/owner/reports', { type, propertyId: propertyId || undefined, from, to: to ? `${to}T23:59:59` : undefined });
  const rows = q.data?.rows || [];
  const cols = { revenue: [['expected', 'Expected', '#93c5fd'], ['collected', 'Collected', '#22c55e']], expense: [['total', 'Expenses', '#8b5cf6']], occupancy: [['occupied', 'Occupied', '#22c55e'], ['vacant', 'Vacant', '#f59e0b']] }[type];
  const money = type !== 'occupancy';

  return (
    <>
      <PageHeader title="Reports" subtitle="Analyse revenue, expenses and occupancy">
        <select className="input w-44" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}><option value="">All properties</option>{props.data?.items.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select>
        {type !== 'occupancy' && <><input type="date" className="input w-40" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" /><input type="date" className="input w-40" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" /></>}
        <Button variant="secondary" disabled={!rows.length} onClick={() => downloadCsv(`${type}-report.csv`, rows)}><Download className="h-4 w-4" /> Export CSV</Button>
      </PageHeader>
      <Tabs value={type} onChange={setType} tabs={[{ value: 'revenue', label: 'Revenue' }, { value: 'expense', label: 'Expenses' }, { value: 'occupancy', label: 'Occupancy' }]} />
      {q.isError ? <ErrorBox error={q.error} retry={q.refetch} /> : !q.data ? <Skeleton className="h-72" /> : !rows.length ? <Card><Empty title="No data for this selection" /></Card> : (
        <div className="space-y-4">
          <Card><div className="h-72"><ResponsiveContainer><BarChart data={rows}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" fontSize={12} /><YAxis fontSize={12} tickFormatter={(v) => (money ? `₹${v >= 1000 ? `${v / 1000}k` : v}` : v)} /><Tooltip formatter={(v) => (money ? inr(v) : v)} /><Legend />{cols.map(([k, n, c]) => <Bar key={k} dataKey={k} name={n} fill={c} radius={[4, 4, 0, 0]} />)}</BarChart></ResponsiveContainer></div></Card>
          <Card><DataTable rowKey={(r) => r.label} rows={rows} columns={[{ key: 'label', title: type === 'occupancy' ? 'Property' : 'Month' }, ...Object.keys(rows[0]).filter((k) => k !== 'label').map((k) => ({ key: k, title: label(k), render: (r) => (money ? inr(r[k]) : r[k]) }))]} /></Card>
          {type === 'expense' && q.data.byCategory?.length > 0 && <Card title="By category">{q.data.byCategory.map((c) => <div key={c.category} className="flex justify-between border-b py-2 text-sm last:border-0"><span>{label(c.category)}</span><b>{inr(c.total)}</b></div>)}</Card>}
        </div>
      )}
    </>
  );
}
