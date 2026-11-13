import { useEffect, useState } from 'react';
import { Utensils } from 'lucide-react';
import { Button, Card, Field, PageHeader, Skeleton, Empty } from '../components/ui.jsx';
import { useGet, useMut } from '../lib/hooks.js';
import { todayYmd, fmtDate } from '../lib/format.js';

const MEALS = [['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['eveningSnacks', 'Evening Snacks'], ['dinner', 'Dinner']];
const toText = (a) => (a || []).join(', ');
const toArr = (s) => s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);

export default function FoodMenu() {
  const props = useGet('properties', '/owner/properties');
  const [propertyId, setPropertyId] = useState('');
  const [date, setDate] = useState(todayYmd());
  const pid = propertyId || props.data?.items?.[0]?._id;
  const q = useGet('food-menu', '/owner/food-menu', { propertyId: pid, date }, { enabled: !!pid });
  const week = useGet('food-menu-week', '/owner/food-menu', { propertyId: pid, from: todayYmd() }, { enabled: !!pid });
  const [t, setT] = useState({ breakfast: '', lunch: '', eveningSnacks: '', dinner: '' });
  const save = useMut('put', '/owner/food-menu', { success: 'Menu saved' });

  useEffect(() => { const m = q.data?.items?.[0]; setT({ breakfast: toText(m?.breakfast), lunch: toText(m?.lunch), eveningSnacks: toText(m?.eveningSnacks), dinner: toText(m?.dinner) }); }, [q.data, date, pid]);

  if (props.data && !props.data.items.length) return <><PageHeader title="Food Menu" /><Card><Empty title="Add a property first" /></Card></>;
  return (
    <>
      <PageHeader title="Food Menu" subtitle="Tenants see this in their app">
        {props.data?.items.length > 1 && <select className="input w-48" value={pid || ''} onChange={(e) => setPropertyId(e.target.value)}>{props.data.items.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select>}
        <input type="date" className="input w-44" value={date} onChange={(e) => setDate(e.target.value)} />
      </PageHeader>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={`Menu for ${fmtDate(date)}`} className="lg:col-span-2">
          {q.isLoading ? <Skeleton className="h-64" /> : (
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate({ propertyId: pid, date, breakfast: toArr(t.breakfast), lunch: toArr(t.lunch), eveningSnacks: toArr(t.eveningSnacks), dinner: toArr(t.dinner) }); }}>
              {MEALS.map(([k, n]) => <Field key={k} label={n} hint="Separate items with commas"><textarea className="input" rows={2} value={t[k]} onChange={(e) => setT({ ...t, [k]: e.target.value })} placeholder="e.g. Poha, Boiled eggs, Tea" /></Field>)}
              <Button type="submit" loading={save.isPending}>Save menu</Button>
            </form>
          )}
        </Card>
        <Card title="Upcoming menus">
          {!week.data?.items?.length ? <Empty title="No upcoming menus set" /> : week.data.items.slice(0, 7).map((m) => (
            <button key={m._id} onClick={() => setDate(m.date)} className="flex w-full items-center gap-2 border-b py-2 text-left text-sm last:border-0 hover:bg-slate-50"><Utensils className="h-4 w-4 text-brand-600" /><span className="font-medium">{fmtDate(m.date)}</span><span className="truncate text-xs text-slate-400">{toText(m.lunch)}</span></button>
          ))}
        </Card>
      </div>
    </>
  );
}
