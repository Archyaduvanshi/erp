import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle, Plus } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { platformApi } from '../../api/platformApi';
import { usePlatformAuth } from '../../context/PlatformAuthContext';
import { ErrorPanel, PageSkeleton, StatusBadge, formatMoney } from '../../components/platform/PlatformUi';
import { SubscriptionModal, Input, Field, inputClass, buttonClass, limitLabel, invalidatePlan } from '../../components/platform/SubscriptionUi';

const empty = { code: '', name: '', monthlyPrice: '0', yearlyPrice: '0', maxStudents: '', maxTeachers: '', maxUsers: '', maxStorageMb: '', trialDays: 14, status: 'ACTIVE', features: [], reason: '' };
export function PlanList() {
  const client = useQueryClient();
  const { session } = usePlatformAuth();
  const canManage = session?.role === 'SUPER_ADMIN';
  const [editing, setEditing] = useState(null);
  const [statusPlan, setStatusPlan] = useState(null);
  const [reason, setReason] = useState('');
  const plans = useQuery({ queryKey: ['platform', 'plans'], queryFn: platformApi.plans });
  const status = useMutation({ mutationFn: () => platformApi.planStatus(statusPlan.id, { status: statusPlan.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE', version: statusPlan.version, reason }), onError: () => client.invalidateQueries({ queryKey: ['platform', 'plans'] }), onSuccess: () => { invalidatePlan(client, statusPlan); setStatusPlan(null); } });
  const createButton = canManage && <button className={buttonClass} onClick={() => setEditing({ ...empty })}><Plus size={16} />Create Plan</button>;
  return <>
    <div className="mb-5 flex items-center justify-between gap-4"><h2 className="font-serif text-2xl font-black italic">Subscription Plans</h2>{createButton}</div>
    {plans.isLoading ? <PageSkeleton /> : plans.isError ? <ErrorPanel error={plans.error} retry={plans.refetch} /> : !plans.data.length ? <div className="rounded-2xl border bg-white p-12 text-center"><h3 className="font-serif text-2xl font-black italic">No Subscription Plans Yet</h3><p className="my-5 text-sm text-slate-500">Create your first plan to start assigning subscriptions.</p>{createButton}</div> : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{plans.data.map(plan => <article key={plan.id} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-xl shadow-slate-200/30">
      <div className="flex items-start justify-between gap-3"><div><h3 className="font-serif text-2xl font-black italic">{plan.name}</h3><p className="mt-1 text-xs font-black text-slate-400">{plan.code}</p></div><StatusBadge value={plan.status} /></div>
      <p className="mt-5 text-3xl font-black">{formatMoney(plan.monthlyPrice)}<span className="text-xs text-slate-400"> / month</span></p><p className="mt-2 text-sm font-bold text-slate-500">{formatMoney(plan.yearlyPrice)} / year</p>
      <div className="mt-5 grid grid-cols-2 gap-3 text-sm text-slate-500"><p>{limitLabel(plan.maxStudents)} students</p><p>{limitLabel(plan.maxTeachers)} teachers</p><p>{limitLabel(plan.maxUsers)} active users</p><p>{limitLabel(plan.maxStorageMb)} MB storage</p><p>{plan.features.length} features</p><p>{plan.trialDays} trial days</p></div>
      {canManage && <div className="mt-6 flex flex-wrap gap-2"><button className="rounded-lg border px-3 py-2 text-xs font-bold" onClick={() => setEditing({ ...plan, reason: '' })}>Edit</button><button className="rounded-lg border px-3 py-2 text-xs font-bold" onClick={() => setEditing({ ...plan, reason: '', focusFeatures: true })}>Manage Features</button><button className="rounded-lg border px-3 py-2 text-xs font-bold" onClick={() => { status.reset(); setReason(''); setStatusPlan(plan); }}>{plan.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</button></div>}
    </article>)}</div>}
    {editing && <PlanEditor plan={editing} onClose={() => setEditing(null)} />}
    {statusPlan && <SubscriptionModal title={`${statusPlan.status === 'ACTIVE' ? 'Deactivate' : 'Activate'} ${statusPlan.name}`} onClose={() => setStatusPlan(null)} busy={status.isPending}><p className="mb-5 text-sm text-slate-500">Existing subscriptions keep their dates and amounts. Only active plans can be assigned to institutes.</p><form onSubmit={e => { e.preventDefault(); if (!status.isPending) status.mutate(); }}><Input label="Reason" required maxLength={500} value={reason} onChange={e => setReason(e.target.value)} />{status.isError && <div className="mt-4"><ErrorPanel error={status.error} /></div>}<button className={`${buttonClass} mt-5`} disabled={status.isPending || !reason.trim()}>{status.isPending ? 'Saving...' : 'Confirm'}</button></form></SubscriptionModal>}
  </>;
}
function PlanEditor({ plan, onClose }) {
  const client = useQueryClient();
  const [form, setForm] = useState(plan);
  const registry = useQuery({ queryKey: ['platform', 'feature-options'], queryFn: platformApi.featureRegistry });
  const save = useMutation({ mutationFn: platformApi.savePlan, onError: () => client.invalidateQueries({ queryKey: ['platform', 'plans'] }), onSuccess: () => { invalidatePlan(client, plan.id ? plan : null); onClose(); } });
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const submit = e => { e.preventDefault(); if (save.isPending) return; const payload = { ...form, code: form.code.trim().toUpperCase(), name: form.name.trim() }; for (const key of ['maxStudents', 'maxTeachers', 'maxUsers', 'maxStorageMb']) payload[key] = form[key] === '' || form[key] == null ? null : Number(form[key]); save.mutate(payload); };
  return <SubscriptionModal title={plan.id ? `Edit ${plan.name}` : 'Create Plan'} onClose={onClose} busy={save.isPending}><form onSubmit={submit}>
    <div className="grid gap-4 md:grid-cols-2"><Input label="Plan Code *" required pattern="[A-Za-z0-9_]{1,40}" maxLength={40} value={form.code} disabled={!!plan.id} onChange={e => set('code', e.target.value.toUpperCase())} /><Input label="Plan Name *" required maxLength={100} value={form.name} onChange={e => set('name', e.target.value)} />
      {['monthlyPrice', 'yearlyPrice'].map(key => <Input key={key} label={key === 'monthlyPrice' ? 'Monthly Price (INR)' : 'Yearly Price (INR)'} type="number" required min="0" max="999999999999.99" step="0.01" value={form[key]} onChange={e => set(key, e.target.value)} />)}
      {Object.entries({ maxStudents: 'Max Students', maxTeachers: 'Max Teachers', maxUsers: 'Max Active Users', maxStorageMb: 'Max Storage MB' }).map(([key, label]) => <Input key={key} label={label} type="number" min="0" max="2147483647" step="1" placeholder="Unlimited" value={form[key] ?? ''} onChange={e => set(key, e.target.value)} />)}
      <Input label="Trial Days" type="number" required min="0" max="365" step="1" value={form.trialDays} onChange={e => set('trialDays', e.target.value)} /><Field label="Status"><select className={inputClass} value={form.status} onChange={e => set('status', e.target.value)}><option>ACTIVE</option><option>INACTIVE</option></select></Field>
    </div><p className="mt-3 text-xs text-slate-500">Blank limits mean unlimited. Zero allows no additional capacity. Actual storage usage: Not Available.</p>
    <fieldset className="mt-6"><legend className="text-sm font-black">Included Features ({form.features.length})</legend>{registry.isLoading ? <p className="py-4 text-sm">Loading features...</p> : registry.isError ? <ErrorPanel error={registry.error} retry={registry.refetch} /> : <div className="mt-3 grid gap-2 sm:grid-cols-2 md:grid-cols-3">{registry.data.map((feature, i) => <label key={feature.code} className="flex items-center gap-2 rounded-lg border p-3 text-xs font-bold"><input autoFocus={plan.focusFeatures && i === 0} type="checkbox" checked={form.features.includes(feature.code)} onChange={e => set('features', e.target.checked ? [...form.features, feature.code] : form.features.filter(x => x !== feature.code))} />{feature.displayName || feature.label}</label>)}</div>}</fieldset>
    <div className="mt-5"><Input label="Change Reason" maxLength={500} value={form.reason} onChange={e => set('reason', e.target.value)} /></div>
    {save.isError && <div className="mt-4"><ErrorPanel error={save.error} /><p className="mt-2 text-xs text-slate-500">For a concurrent change, close and reopen this editor after refreshing the plans.</p></div>}
    <div className="mt-5 flex justify-end"><button className={buttonClass} disabled={save.isPending || registry.isLoading || registry.isError}>{save.isPending && <LoaderCircle size={16} className="animate-spin" />}{save.isPending ? 'Saving...' : 'Save Plan'}</button></div>
  </form></SubscriptionModal>;
}
export default function PlansPage() { return <Navigate to="/platform/subscriptions?tab=plans" replace />; }
