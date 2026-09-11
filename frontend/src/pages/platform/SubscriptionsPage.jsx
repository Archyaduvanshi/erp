import React, { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { platformApi } from '../../api/platformApi';
import PlatformLayout from '../../components/platform/PlatformLayout';
import { EmptyRow, ErrorPanel, StatusBadge, formatDate, formatMoney } from '../../components/platform/PlatformUi';
import { Field, inputClass, buttonClass, daysRemaining } from '../../components/platform/SubscriptionUi';
import { PlanList } from './PlansPage';

export default function SubscriptionsPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'institutes' ? 'institutes' : 'plans';
  const plans = useQuery({ queryKey: ['platform', 'plans'], queryFn: platformApi.plans });
  const summary = useQuery({ queryKey: ['platform', 'subscription-summary'], queryFn: platformApi.subscriptionSummary });
  const cards = [['Total Plans', plans.data?.length], ['Active Plans', plans.data?.filter(x => x.status === 'ACTIVE').length], ['Active Subscriptions', summary.data?.activeSubscriptions], ['Trial Institutes', summary.data?.trialInstitutes], ['Expiring in 7 Days', summary.data?.expiringIn7Days], ['Expiring in 30 Days', summary.data?.expiringIn30Days]];
  return <PlatformLayout title="Subscriptions" subtitle="Manage plans, institute subscriptions, trials and renewals">
    {summary.isError && <ErrorPanel error={summary.error} retry={summary.refetch} />}
    <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-6">{cards.map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-lg shadow-slate-200/30"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-3 text-3xl font-black">{value ?? '?'}</p></div>)}</div>
    <div className="mb-6 flex gap-2 border-b border-slate-200" role="tablist">{[['plans', 'Plans'], ['institutes', 'Institute Subscriptions']].map(([key, label]) => <button key={key} role="tab" aria-selected={tab === key} onClick={() => setParams({ tab: key })} className={`border-b-2 px-4 py-3 text-xs font-black uppercase tracking-wider ${tab === key ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-400'}`}>{label}</button>)}</div>
    {tab === 'plans' ? <PlanList /> : <SubscriptionDirectory plans={plans.data || []} />}
  </PlatformLayout>;
}
function SubscriptionDirectory({ plans }) {
  const navigate = useNavigate();
  const [page, setPage] = useState(0), [size, setSize] = useState(25), [input, setInput] = useState(''), [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ status: '', plan: '', billingCycle: '', expiryFrom: '', expiryTo: '', expiringDays: '' });
  useEffect(() => { const timer = setTimeout(() => { setSearch(input); setPage(0); }, 350); return () => clearTimeout(timer); }, [input]);
  const set = (key, value) => { setFilters(f => ({ ...f, [key]: value })); setPage(0); };
  const queryFilters = { ...filters, search, page, size };
  const query = useQuery({ queryKey: ['platform', 'subscriptions', queryFilters], queryFn: () => platformApi.subscriptionDirectory(queryFilters), placeholderData: keepPreviousData });
  return <>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-serif text-2xl font-black italic">Institute Subscriptions</h2><button className={buttonClass} onClick={() => navigate('/platform/institutes')}>Select Institute / Assign Plan</button></div>
    <div className="mb-4 flex flex-wrap gap-2">{[['', 'All'], ['TRIAL', 'Trial'], ['ACTIVE', 'Active'], ['EXPIRING', 'Expiring Soon'], ['PAST_DUE', 'Past Due'], ['EXPIRED', 'Expired'], ['CANCELLED', 'Cancelled']].map(([value, label]) => <button key={value} onClick={() => { setFilters(f => ({ ...f, status: value === 'EXPIRING' ? '' : value, expiringDays: value === 'EXPIRING' ? '30' : '' })); setPage(0); }} className={`rounded-lg border px-3 py-2 text-xs font-bold ${(value === 'EXPIRING' ? !!filters.expiringDays : !filters.expiringDays && filters.status === value) ? 'bg-slate-950 text-white' : 'bg-white text-slate-500'}`}>{label}</button>)}</div>
    <div className="mb-5 grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-3 xl:grid-cols-6">
      <Field label="Search Institute"><input className={inputClass} placeholder="Institute or code" value={input} onChange={e => setInput(e.target.value)} /></Field>
      <Field label="Plan"><select className={inputClass} value={filters.plan} onChange={e => set('plan', e.target.value)}><option value="">All plans</option>{plans.map(p => <option key={p.id} value={p.code}>{p.name}</option>)}</select></Field>
      <Field label="Billing Cycle"><select className={inputClass} value={filters.billingCycle} onChange={e => set('billingCycle', e.target.value)}><option value="">All cycles</option>{['MONTHLY', 'YEARLY', 'CUSTOM'].map(x => <option key={x}>{x}</option>)}</select></Field>
      <Field label="Expiry From"><input className={inputClass} type="date" value={filters.expiryFrom} onChange={e => set('expiryFrom', e.target.value)} /></Field>
      <Field label="Expiry To"><input className={inputClass} type="date" min={filters.expiryFrom} value={filters.expiryTo} onChange={e => set('expiryTo', e.target.value)} /></Field>
      <Field label="Expiring Soon"><select className={inputClass} value={filters.expiringDays} onChange={e => { setFilters(f => ({ ...f, expiringDays: e.target.value, status: '' })); setPage(0); }}><option value="">Any time</option><option value="7">In 7 days</option><option value="30">In 30 days</option></select></Field>
    </div>
    {query.isError ? <ErrorPanel error={query.error} retry={query.refetch} /> : <div className="overflow-hidden rounded-2xl border bg-white shadow-xl shadow-slate-200/30"><div className="overflow-x-auto" aria-busy={query.isFetching}><table className="w-full min-w-[1100px] text-left text-sm"><thead className="bg-slate-950 text-[10px] uppercase tracking-widest text-white"><tr>{['Institute', 'Code', 'Plan', 'Status', 'Billing Cycle', 'Start Date', 'End Date', 'Days Remaining', 'Amount', 'Actions'].map(x => <th key={x} className="px-4 py-4">{x}</th>)}</tr></thead><tbody className="divide-y">{query.data?.content?.length ? query.data.content.map(x => <tr key={x.id}><td className="px-4 py-4 font-black">{x.instituteName}</td><td className="px-4 py-4">{x.institutionCode}</td><td className="px-4 py-4">{x.planName}</td><td className="px-4 py-4"><StatusBadge value={x.status} /></td><td className="px-4 py-4">{x.billingCycle}</td><td className="px-4 py-4">{formatDate(x.startDate)}</td><td className="px-4 py-4">{formatDate(x.endDate)}</td><td className="px-4 py-4">{daysRemaining(x.endDate)}</td><td className="px-4 py-4 font-bold">{formatMoney(x.amount)}</td><td className="px-4 py-4"><button className="rounded-lg border px-3 py-2 text-xs font-bold" onClick={() => navigate(`/platform/institutes/${x.instituteId}?tab=Subscription`)}>Assign / Change Plan</button></td></tr>) : <EmptyRow columns={10} text={query.isLoading ? 'Loading subscriptions...' : 'No subscriptions found'} />}</tbody></table></div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-xs"><label>Rows per page <select aria-label="Rows per page" className="ml-2 rounded-lg border p-2" value={size} onChange={e => { setSize(Number(e.target.value)); setPage(0); }}>{[25, 50, 100].map(x => <option key={x}>{x}</option>)}</select></label><span>{query.data?.totalElements || 0} subscriptions ? Page {page + 1} of {Math.max(1, query.data?.totalPages || 0)}</span><div className="flex gap-3"><button disabled={!page || query.isFetching} onClick={() => setPage(page - 1)} className="rounded-lg border px-4 py-2 disabled:opacity-40">Previous</button><button disabled={query.isFetching || !query.data || page + 1 >= query.data.totalPages} onClick={() => setPage(page + 1)} className="rounded-lg border px-4 py-2 disabled:opacity-40">Next</button></div></div>
    </div>}
  </>;
}
