import React from 'react';

export const StatusBadge = ({ value = 'Unknown' }) => {
  const normalized = String(value).toUpperCase();
  const tone = ['ACTIVE', 'PAID', 'SUCCESS', 'COMPLETED', 'ENABLED', 'NORMAL'].includes(normalized) ? 'bg-emerald-100 text-emerald-800' : ['TRIAL', 'PENDING', 'UNDER_REVIEW', 'NEAR_LIMIT'].includes(normalized) ? 'bg-amber-100 text-amber-800' : ['SUSPENDED', 'EXPIRED', 'OVERDUE', 'FAILED', 'USER_DROPPED', 'CANCELLED', 'OVER_LIMIT', 'BLOCKED'].includes(normalized) ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${tone}`}>{String(value).replaceAll('_', ' ')}</span>;
};

export const PageSkeleton = () => <div className="space-y-4" aria-label="Loading"><div className="h-24 animate-pulse rounded-2xl bg-slate-200" /><div className="h-72 animate-pulse rounded-2xl bg-slate-100" /></div>;

export const ErrorPanel = ({ error, retry }) => <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">{error?.message || 'Unable to load platform data.'}{retry && <button type="button" onClick={retry} className="ml-4 font-black underline">Retry</button>}</div>;

export const EmptyRow = ({ columns, text }) => <tr><td colSpan={columns} className="px-5 py-14 text-center text-sm font-semibold text-slate-400">{text}</td></tr>;

export const ConfirmModal = ({ title, text, confirmLabel, reason, setReason, onClose, onConfirm, busy }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/35 px-5 backdrop-blur-sm">
    <div className="w-full max-w-md rounded-4xl border border-slate-200 bg-white p-7 shadow-2xl">
      <h2 className="font-serif text-2xl font-black italic text-slate-950">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
      <label className="mt-5 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">Reason</label>
      <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-500" />
      <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-3 text-xs font-black uppercase text-slate-500">Cancel</button><button type="button" disabled={busy || !reason.trim()} onClick={onConfirm} className="rounded-xl bg-slate-950 px-5 py-3 text-xs font-black uppercase text-white disabled:opacity-40">{busy ? 'Saving...' : confirmLabel}</button></div>
    </div>
  </div>
);

export const formatMoney = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value || 0));
export const formatDate = (value) => value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value)) : 'Not set';
