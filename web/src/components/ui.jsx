import { useEffect, useRef } from 'react';
import { X, Loader2, Inbox } from 'lucide-react';

export const cn = (...a) => a.filter(Boolean).join(' ');

export function Spinner({ className = 'h-5 w-5' }) { return <Loader2 className={cn('animate-spin', className)} />; }

export function Button({ variant = 'primary', loading, className, children, ...p }) {
  const v = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700',
    secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'text-slate-600 hover:bg-slate-100',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  }[variant];
  return (
    <button type="button" {...p} disabled={p.disabled || loading} className={cn('btn', v, className)}>
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function Card({ title, action, children, className, bodyClass }) {
  return (
    <section className={cn('rounded-2xl bg-white p-4 shadow-card', className)}>
      {(title || action) && (
        <header className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          {action}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

const tones = {
  green: 'bg-emerald-50 text-emerald-700', yellow: 'bg-amber-50 text-amber-700', red: 'bg-red-50 text-red-700',
  blue: 'bg-blue-50 text-blue-700', gray: 'bg-slate-100 text-slate-600', purple: 'bg-violet-50 text-violet-700',
};
export function Badge({ tone = 'gray', children, className }) {
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', tones[tone], className)}>{children}</span>;
}
export const statusTone = (s) => ({ paid: 'green', verified: 'green', occupied: 'green', resolved: 'green', completed: 'green', vacant: 'yellow', pending: 'yellow', processing: 'blue', open: 'red', overdue: 'red', rejected: 'red', failed: 'red', partial: 'blue', in_progress: 'blue', full: 'green', upcoming: 'blue', cancelled: 'gray' }[s] || 'gray');

export function Avatar({ name = '?', url, size = 'h-9 w-9' }) {
  if (url) return <img src={url} alt={name} className={cn('rounded-full object-cover', size)} />;
  return <div className={cn('flex items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700', size)}>{(name || '?').trim().charAt(0).toUpperCase()}</div>;
}

export function Skeleton({ className = 'h-24' }) { return <div className={cn('animate-pulse rounded-xl bg-slate-200/70', className)} />; }

export function Empty({ title = 'Nothing here yet', hint, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
      <Inbox className="h-8 w-8 text-slate-300" />
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {hint && <p className="max-w-xs text-xs text-slate-400">{hint}</p>}
      {action}
    </div>
  );
}

export function ErrorBox({ error, retry }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {error?.response?.data?.message || 'Could not load this section.'}
      {retry && <button onClick={retry} className="ml-2 font-medium underline">Retry</button>}
    </div>
  );
}

export function Field({ label, hint, children, className }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

export function Drawer({ open, onClose, title, children, footer }) {
  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex h-full w-full max-w-lg flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title = 'Are you sure?', message, confirmText = 'Confirm', danger, loading, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-semibold">{title}</h3>
        {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>{confirmText}</Button>
        </div>
      </div>
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, tone = 'blue', hint }) {
  const t = { blue: 'bg-blue-50 text-blue-600', green: 'bg-emerald-50 text-emerald-600', orange: 'bg-amber-50 text-amber-600', purple: 'bg-violet-50 text-violet-600', red: 'bg-red-50 text-red-600' }[tone];
  return (
    <div className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-card">
      <div>
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
      </div>
      <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl', t)}><Icon className="h-5 w-5" /></div>
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="mb-4 flex max-w-full overflow-x-auto rounded-xl bg-slate-200/60 p-1 sm:inline-flex">
      {tabs.map((t) => (
        <button key={t.value} onClick={() => onChange(t.value)} className={cn('shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition', value === t.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>{t.label}</button>
      ))}
    </div>
  );
}

export function DataTable({ columns, rows, empty, rowKey = (r) => r._id }) {
  if (!rows?.length) return empty || <Empty />;
  const data = columns.filter((c) => c.title);
  const actions = columns.filter((c) => !c.title);
  const [first, ...rest] = data;
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-xs uppercase tracking-wide text-slate-400">{columns.map((c) => <th key={c.key} className={cn('whitespace-nowrap px-3 py-2 font-medium', c.className)}>{c.title}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={rowKey(r)} className="border-b last:border-0 hover:bg-slate-50/60">
                {columns.map((c) => <td key={c.key} className={cn('px-3 py-3 align-middle', c.className)}>{c.render ? c.render(r) : r[c.key]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">
        {rows.map((r) => (
          <div key={rowKey(r)} className="rounded-xl border bg-white p-3">
            <div className="mb-2 font-medium">{first.render ? first.render(r) : r[first.key]}</div>
            <dl className="space-y-1.5 text-sm">
              {rest.map((c) => (
                <div key={c.key} className="flex items-center justify-between gap-3">
                  <dt className="text-xs text-slate-400">{c.title}</dt>
                  <dd className="min-w-0 text-right">{c.render ? c.render(r) : r[c.key]}</dd>
                </div>
              ))}
            </dl>
            {actions.length > 0 && <div className="mt-3 flex flex-wrap justify-end gap-1 border-t pt-2">{actions.map((c) => <span key={c.key}>{c.render ? c.render(r) : null}</span>)}</div>}
          </div>
        ))}
      </div>
    </>
  );
}

export function OtpInput({ value, onChange, length = 6 }) {
  const refs = useRef([]);
  const chars = Array.from({ length }, (_, i) => value[i] || '');
  const setAt = (i, ch) => {
    const arr = chars.slice(); arr[i] = ch; onChange(arr.join(''));
  };
  return (
    <div className="flex justify-center gap-2" onPaste={(e) => { const t = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length); if (t) { e.preventDefault(); onChange(t); refs.current[Math.min(t.length, length - 1)]?.focus(); } }}>
      {chars.map((c, i) => (
        <input key={i} ref={(el) => (refs.current[i] = el)} inputMode="numeric" maxLength={1} value={c} autoFocus={i === 0}
          onChange={(e) => { const d = e.target.value.replace(/\D/g, ''); setAt(i, d); if (d && i < length - 1) refs.current[i + 1]?.focus(); }}
          onKeyDown={(e) => { if (e.key === 'Backspace' && !chars[i] && i > 0) refs.current[i - 1]?.focus(); }}
          className="h-12 w-11 rounded-lg border border-slate-300 text-center text-lg font-semibold outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
      ))}
    </div>
  );
}
