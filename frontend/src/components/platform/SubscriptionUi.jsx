import React, { useEffect, useRef, useId } from 'react';
import { X } from 'lucide-react';

export const inputClass = 'mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-emerald-500 disabled:bg-slate-100';
export const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-xs font-black uppercase text-white disabled:opacity-40';
export const Panel = ({ children }) => <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-lg shadow-slate-200/20">{children}</div>;
export const Field = ({ label, children }) => {
  const id = useId();
  return <div><label htmlFor={id} className="block text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</label>{React.cloneElement(children, { id })}</div>;
};
export const Input = ({ label, ...props }) => <Field label={label}><input className={inputClass} {...props} /></Field>;
export const limitLabel = value => value == null ? 'Unlimited' : Number(value).toLocaleString('en-IN');
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const daysRemaining = end => Math.round((Date.parse(end) - Date.parse(today())) / 86400000);

export function SubscriptionModal({ title, children, onClose, busy }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current;
    dialog?.focus();
    return () => previous?.focus();
  }, []);
  const keyDown = event => {
    if (event.key === 'Escape' && !busy) onClose();
    if (event.key !== 'Tab') return;
    const items = [...ref.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')];
    if (!items.length) { event.preventDefault(); return; }
    const first = items[0], last = items.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { event.preventDefault(); first.focus(); }
  };
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/35 p-5 backdrop-blur-sm"><div ref={ref} tabIndex={-1} onKeyDown={keyDown} role="dialog" aria-modal="true" aria-label={title} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl outline-none"><div className="mb-5 flex items-center justify-between gap-4"><h2 className="font-serif text-2xl font-black italic">{title}</h2><button type="button" aria-label="Close dialog" disabled={busy} onClick={onClose}><X /></button></div>{children}</div></div>;
}

export function invalidateSubscription(client, instituteId) {
  for (const key of ['subscription-history', 'institute', 'features', 'usage']) client.invalidateQueries({ queryKey: ['platform', key, instituteId] });
  for (const key of ['overview', 'subscription-summary', 'subscriptions', 'feature-directory', 'usage-directory']) client.invalidateQueries({ queryKey: ['platform', key] });
  client.invalidateQueries({ queryKey: ['platform', 'audit'] });
}

export function invalidatePlan(client, oldPlan) {
  client.invalidateQueries({ queryKey: ['platform', 'plans'] });
  if (!oldPlan) return;
  const ids = new Set();
  for (const query of client.getQueryCache().findAll({ queryKey: ['platform'] })) {
    const [ , type, id] = query.queryKey;
    const data = query.state.data;
    if (type === 'subscription-history' && data?.[0]?.planId === oldPlan.id) ids.add(Number(id));
    if (type === 'institute' && data?.currentPlan === oldPlan.name) ids.add(Number(id));
    if (type === 'subscriptions') data?.content?.filter(x => x.planId === oldPlan.id).forEach(x => ids.add(Number(x.instituteId)));
  }
  for (const id of ids) for (const key of ['subscription-history', 'features', 'usage', 'institute']) client.invalidateQueries({ queryKey: ['platform', key, id] });
  for (const key of ['subscriptions', 'feature-directory', 'usage-directory']) client.invalidateQueries({ queryKey: ['platform', key] });
}
