import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { platformApi } from '../../api/platformApi';
import { EmptyRow, ErrorPanel, PageSkeleton, StatusBadge, formatDate, formatMoney } from './PlatformUi';
import { SubscriptionModal, Panel, Field, Input, inputClass, buttonClass, today, daysRemaining, limitLabel, invalidateSubscription } from './SubscriptionUi';

export default function InstituteSubscriptions({ instituteId }) {
  const client = useQueryClient();
  const history = useQuery({ queryKey: ['platform', 'subscription-history', instituteId], queryFn: () => platformApi.subscriptions(instituteId) });
  const plans = useQuery({ queryKey: ['platform', 'plans'], queryFn: platformApi.plans });
  const usage = useQuery({ queryKey: ['platform', 'usage', instituteId], queryFn: () => platformApi.usage(instituteId) });
  const [editing, setEditing] = useState(null);
  const [trial, setTrial] = useState(null);
  const [reason, setReason] = useState('');
  const [endDate, setEndDate] = useState('');
  const current = history.data?.[0];
  const trialMutation = useMutation({ mutationFn: () => trial === 'extend' ? platformApi.extendTrial(instituteId, { endDate, reason, version: current.version }) : platformApi.endTrial(instituteId, { reason, version: current.version }), onSuccess: () => { invalidateSubscription(client, instituteId); setTrial(null); } });
  if (history.isLoading || plans.isLoading) return <PageSkeleton />;
  if (history.isError || plans.isError) return <ErrorPanel error={history.error || plans.error} retry={history.isError ? history.refetch : plans.refetch} />;
  const activePlans = plans.data.filter(p => p.status === 'ACTIVE');
  const selectedPlan = plans.data.find(p => p.id === current?.planId);
  return <Panel>
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-serif text-xl font-black italic">Subscription History</h2><div className="flex flex-wrap gap-2"><button className={buttonClass} disabled={!activePlans.length} onClick={() => setEditing('ACTIVE')}>Assign / Change Plan</button><button className="rounded-xl border px-4 py-3 text-xs font-bold disabled:opacity-40" disabled={!activePlans.length} onClick={() => setEditing('TRIAL')}>Start Trial</button></div></div>
    {!activePlans.length && <p className="mt-4 text-sm text-amber-700">Create or activate a plan in Subscriptions before assigning one.</p>}
    {current && <div className="mt-5 flex flex-wrap items-center gap-4 rounded-xl bg-slate-50 p-4 text-sm"><strong>{current.planName}</strong><StatusBadge value={current.status} /><span>Ends {formatDate(current.endDate)} · {daysRemaining(current.endDate)} days remaining</span>{current.status === 'TRIAL' && <><button className="font-bold text-emerald-700 underline" onClick={() => { trialMutation.reset(); setReason(''); setEndDate(current.endDate); setTrial('extend'); }}>Extend Trial</button><button className="font-bold text-emerald-700 underline" onClick={() => setEditing('ACTIVE')}>Convert to Paid</button><button className="font-bold text-rose-700 underline" onClick={() => { trialMutation.reset(); setReason(''); setTrial('end'); }}>End Trial</button></>}</div>}
    {usage.isError ? <ErrorPanel error={usage.error} retry={usage.refetch} /> : usage.data && <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[['Students', usage.data.students, usage.data.maxStudents], ['Teachers', usage.data.teachers, usage.data.maxTeachers], ['Active Users', usage.data.activeAccounts, usage.data.maxUsers]].map(([label, count, limit]) => <div key={label} className="rounded-xl border p-4"><p className="text-xs font-bold text-slate-500">{label}</p><p className="my-2 font-black">{count} / {limitLabel(limit)}</p><StatusBadge value={limit != null && count > limit ? 'OVER_LIMIT' : limit != null && count >= limit * 0.8 ? 'NEAR_LIMIT' : 'NORMAL'} /></div>)}<div className="rounded-xl border p-4"><p className="text-xs font-bold text-slate-500">Storage</p><p className="my-2 font-black">{limitLabel(selectedPlan?.maxStorageMb)} MB limit</p><p className="text-xs text-slate-500">Actual usage: Not Available</p></div></div>}
    <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm"><thead className="bg-slate-950 text-[10px] uppercase tracking-widest text-white"><tr>{['Plan', 'Status', 'Cycle', 'Start', 'End', 'Amount', 'Reason'].map(x => <th key={x} className="px-4 py-3">{x}</th>)}</tr></thead><tbody className="divide-y">{history.data.length ? history.data.map(row => <tr key={row.id}><td className="px-4 py-4 font-bold">{row.planName}</td><td className="px-4 py-4"><StatusBadge value={row.status} /></td><td className="px-4 py-4">{row.billingCycle}</td><td className="px-4 py-4">{formatDate(row.startDate)}</td><td className="px-4 py-4">{formatDate(row.endDate)}</td><td className="px-4 py-4">{formatMoney(row.amount)}</td><td className="px-4 py-4">{row.changeReason}</td></tr>) : <EmptyRow columns={7} text="No subscription history" />}</tbody></table></div>
    {editing && <AssignmentEditor instituteId={instituteId} current={current} plans={activePlans} status={editing} onClose={() => setEditing(null)} />}
    {trial && <SubscriptionModal title={trial === 'extend' ? 'Extend Trial' : 'End Trial'} onClose={() => setTrial(null)} busy={trialMutation.isPending}><form className="space-y-4" onSubmit={e => { e.preventDefault(); if (!trialMutation.isPending) trialMutation.mutate(); }}>{trial === 'extend' && <Input label="New End Date" type="date" required min={current.endDate} value={endDate} onChange={e => setEndDate(e.target.value)} />}<Input label="Reason *" required maxLength={500} value={reason} onChange={e => setReason(e.target.value)} />{trialMutation.isError && <ErrorPanel error={trialMutation.error} />}<button className={buttonClass} disabled={trialMutation.isPending || !reason.trim() || (trial === 'extend' && endDate <= current.endDate)}>{trialMutation.isPending ? 'Saving...' : 'Confirm'}</button></form></SubscriptionModal>}
  </Panel>;
}

function AssignmentEditor({ instituteId, current, plans, status, onClose }) {
  const client = useQueryClient();
  const initialPlan = plans.find(p => p.id === current?.planId) || plans[0];
  const dateAfter = (start, days) => !start ? '' : new Date(Date.parse(start) + days * 86400000).toISOString().slice(0, 10);
  const [form, setForm] = useState({ planId: initialPlan.id, status, billingCycle: status === 'TRIAL' ? 'CUSTOM' : 'MONTHLY', startDate: today(), endDate: dateAfter(today(), status === 'TRIAL' ? initialPlan.trialDays : 30), amount: status === 'TRIAL' ? '0' : String(initialPlan.monthlyPrice), reason: '', currentSubscriptionId: current?.id ?? null, currentVersion: current?.version ?? null });
  const plan = plans.find(p => p.id === Number(form.planId));
  const normal = form.status === 'TRIAL' ? 0 : form.billingCycle === 'MONTHLY' ? plan.monthlyPrice : form.billingCycle === 'YEARLY' ? plan.yearlyPrice : null;
  const overridden = normal == null || Number(form.amount) !== Number(normal);
  const update = (key, value) => setForm(previous => {
    const next = { ...previous, [key]: value };
    if (['planId', 'billingCycle', 'status'].includes(key)) {
      const chosen = plans.find(p => p.id === Number(next.planId));
      next.amount = next.status === 'TRIAL' ? '0' : next.billingCycle === 'CUSTOM' ? '' : String(next.billingCycle === 'YEARLY' ? chosen.yearlyPrice : chosen.monthlyPrice);
      next.endDate = dateAfter(next.startDate, next.status === 'TRIAL' ? chosen.trialDays : next.billingCycle === 'YEARLY' ? 365 : 30);
    }
    return next;
  });
  const mutation = useMutation({ mutationFn: () => platformApi.changeSubscription(instituteId, { ...form, planId: Number(form.planId) }), onSuccess: () => { invalidateSubscription(client, instituteId); onClose(); }, onError: () => client.invalidateQueries({ queryKey: ['platform', 'subscription-history', instituteId] }) });
  return <SubscriptionModal title={status === 'TRIAL' ? 'Start Trial' : 'Assign / Change Plan'} onClose={onClose} busy={mutation.isPending}><form onSubmit={e => { e.preventDefault(); if (!mutation.isPending) mutation.mutate(); }}>
    <div className="grid gap-4 md:grid-cols-2"><Field label="Plan *"><select className={inputClass} value={form.planId} onChange={e => update('planId', Number(e.target.value))}>{plans.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}</select></Field><Field label="Status"><select className={inputClass} value={form.status} onChange={e => update('status', e.target.value)}>{['ACTIVE', 'TRIAL', 'PAST_DUE', 'EXPIRED', 'CANCELLED'].map(x => <option key={x}>{x}</option>)}</select></Field><Field label="Billing Cycle"><select className={inputClass} value={form.billingCycle} onChange={e => update('billingCycle', e.target.value)}>{['MONTHLY', 'YEARLY', 'CUSTOM'].map(x => <option key={x}>{x}</option>)}</select></Field><Input label="Amount (INR) *" type="number" required min="0" max="999999999999.99" step="0.01" value={form.amount} onChange={e => update('amount', e.target.value)} /><Input label="Start Date *" type="date" required max={today()} value={form.startDate} onChange={e => update('startDate', e.target.value)} /><Input label="End Date *" type="date" required min={form.startDate} value={form.endDate} onChange={e => update('endDate', e.target.value)} /></div>
    <p className="mt-4 text-sm text-slate-500">{overridden ? 'Custom pricing / price override: explain the amount in the reason below.' : `Plan amount: ${formatMoney(normal)}`}</p><div className="mt-4"><Input label="Reason *" required maxLength={500} value={form.reason} onChange={e => update('reason', e.target.value)} /></div>
    {mutation.isError && <div className="mt-4"><ErrorPanel error={mutation.error} /><p className="mt-2 text-xs text-slate-500">If this subscription changed, close and reopen the form to review its latest state.</p></div>}
    <button className={`${buttonClass} mt-5`} disabled={mutation.isPending || !form.reason.trim()}>{mutation.isPending ? 'Saving...' : 'Save Subscription'}</button>
  </form></SubscriptionModal>;
}
