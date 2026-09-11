import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { platformApi } from '../../api/platformApi';
import { EmptyRow, ErrorPanel, StatusBadge, formatMoney } from './PlatformUi';
import { SubscriptionModal, Input, buttonClass } from './SubscriptionUi';

export default function GatewayManager() {
  const [params, setParams] = useSearchParams();
  const instituteId = params.get('instituteId') || '';
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => { const timer = setTimeout(() => setSearch(input), 350); return () => clearTimeout(timer); }, [input]);
  const institutes = useQuery({ queryKey: ['platform', 'gateway-institutes', search], queryFn: () => platformApi.institutes({ search, page: 0, size: 25 }) });
  return <section className="mb-6 space-y-4 rounded-2xl border bg-white p-5">
    <h2 className="font-serif text-xl font-black italic">Manage Institute Payment Gateway</h2>
    <input aria-label="Search institute for gateway setup" placeholder="Search institute to set up or manage payments" value={input} onChange={e => setInput(e.target.value)} className="w-full rounded-xl border px-4 py-3" />
    {institutes.isError ? <ErrorPanel error={institutes.error} retry={institutes.refetch} /> : <select aria-label="Select institute" value={instituteId} onChange={e => { const next = new URLSearchParams(params); e.target.value ? next.set('instituteId', e.target.value) : next.delete('instituteId'); setParams(next); }} className="w-full rounded-xl border px-4 py-3">
      <option value="">{institutes.isLoading ? 'Loading institutes...' : 'Select institute'}</option>
      {instituteId && !institutes.data?.content?.some(x => String(x.id) === instituteId) && <option value={instituteId}>Selected institute #{instituteId}</option>}
      {institutes.data?.content?.map(x => <option key={x.id} value={x.id}>{x.instituteName} ({x.institutionCode})</option>)}
    </select>}
    {institutes.data?.content?.length === 0 && <p className="text-sm text-slate-500">No institutes found. Try another search.</p>}
    {instituteId && <InstituteGateway key={instituteId} instituteId={instituteId} />}
  </section>;
}

function InstituteGateway({ instituteId }) {
  const client = useQueryClient();
  const [page, setPage] = useState(0);
  const [merchant, setMerchant] = useState(null);
  const [link, setLink] = useState('');
  const [editing, setEditing] = useState(false);
  const [merchantId, setMerchantId] = useState('');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const configured = useQuery({ queryKey: ['platform', 'cashfree-merchant', instituteId], queryFn: () => platformApi.currentGatewayMerchant(instituteId) });
  const [expected, setExpected] = useState(null);
  const institute = useQuery({ queryKey: ['platform', 'institute', instituteId], queryFn: () => platformApi.institute(instituteId) });
  const gateway = useQuery({ queryKey: ['platform', 'gateway', instituteId], queryFn: () => platformApi.gateway(instituteId) });
  const attempts = useQuery({ queryKey: ['platform', 'gateway-attempts', instituteId, page], queryFn: () => platformApi.gatewayAttempts(instituteId, { page, size: 25 }) });
  const action = useMutation({
    mutationFn: kind => ({ create: platformApi.createGatewayMerchant, refresh: platformApi.refreshGatewayMerchant, onboarding: platformApi.gatewayOnboardingLink })[kind](instituteId),
    onSuccess: result => {
      setMerchant(result);
      if (result.onboardingLink) setLink(result.onboardingLink);
      client.invalidateQueries({ queryKey: ['platform', 'gateway', instituteId] });
      client.invalidateQueries({ queryKey: ['platform', 'gateways'] });
      client.invalidateQueries({ queryKey: ['platform', 'gateway-attempts', instituteId] });
      client.invalidateQueries({ queryKey: ['platform', 'cashfree-merchant', instituteId] });
    },
  });
  const saveMerchant = useMutation({
    mutationFn: () => platformApi.linkGatewayMerchant(instituteId, { merchantId: merchantId.trim(), reason: reason.trim(), confirmSchoolOwnership: confirmed, expectedAccountId: expected?.accountId ?? null, expectedVersion: expected?.version ?? null }),
    onSuccess: result => {
      setMerchant(result); setLink(''); setEditing(false);
      client.setQueryData(['platform', 'cashfree-merchant', instituteId], result);
      for (const key of ['gateway', 'gateway-attempts', 'institute']) client.invalidateQueries({ queryKey: ['platform', key, instituteId] });
      for (const key of ['gateways', 'overview', 'audit']) client.invalidateQueries({ queryKey: ['platform', key] });
    },
    onError: () => client.invalidateQueries({ queryKey: ['platform', 'cashfree-merchant', instituteId] }),
  });
  if (institute.isError) return <ErrorPanel error={institute.error} retry={institute.refetch} />;
  const current = merchant || configured.data || gateway.data;
  return <div className="space-y-4">
    <h3 className="font-bold">{institute.data?.instituteName || `Institute #${instituteId}`} — Cashfree</h3>
    {gateway.isError && <ErrorPanel error={gateway.error} retry={gateway.refetch} />}
    {current && <div className="flex flex-wrap items-center gap-4 text-sm"><span>Merchant: {current.merchantId || 'Not configured'}</span><StatusBadge value={current.onboardingStatus || current.kycStatus} /><StatusBadge value={current.paymentsEnabled ? 'Enabled' : 'Disabled'} /><span>Product: {current.productStatus || '-'}</span></div>}
    <div className="flex flex-wrap gap-3">{[['create', 'Initialize Account'], ['onboarding', 'Start / Continue KYC'], ['refresh', 'Refresh Status']].map(([kind, label]) => <button key={kind} disabled={action.isPending || !institute.data || gateway.isLoading} onClick={() => action.mutate(kind)} className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-40">{action.isPending && action.variables === kind ? 'Please wait...' : label}</button>)}</div>
    {action.isError && <ErrorPanel error={action.error} />}
    <button className={buttonClass} disabled={action.isPending || configured.isLoading || configured.isError || !institute.data} onClick={() => { saveMerchant.reset(); setExpected(configured.data); setMerchantId(configured.data?.merchantId || ''); setReason(''); setConfirmed(false); setEditing(true); }}>Link / Change Merchant ID</button>
    {configured.isError && <ErrorPanel error={configured.error} retry={configured.refetch} />}
    {editing && <SubscriptionModal title="Link Cashfree Merchant ID" busy={saveMerchant.isPending} onClose={() => setEditing(false)}><form className="space-y-4" onSubmit={e => { e.preventDefault(); if (!saveMerchant.isPending) saveMerchant.mutate(); }}>
      <p className="text-sm text-slate-500">Link an existing Cashfree merchant belonging to {institute.data?.instituteName}. New payments use this account; previous orders retain their original merchant account.</p>
      <p className="text-sm font-bold">Current Merchant: {expected?.merchantId || 'Not configured'}</p>
      <Input label="Merchant ID" required maxLength={40} pattern="[A-Za-z0-9_-]{1,40}" value={merchantId} onChange={e => setMerchantId(e.target.value)} />
      <Input label="Reason" required maxLength={500} value={reason} onChange={e => setReason(e.target.value)} />
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" required checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /><span>I confirm this merchant account belongs to this institute and should receive its new payments.</span></label>
      {saveMerchant.isError && <ErrorPanel error={saveMerchant.error} />}
      <button className={buttonClass} disabled={saveMerchant.isPending || !confirmed || !merchantId.trim() || !reason.trim()}>{saveMerchant.isPending ? 'Verifying merchant...' : 'Verify & Link Merchant'}</button>
    </form></SubscriptionModal>}
    {link && <div className="space-y-3"><a href={link} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-emerald-700 underline">Open Cashfree KYC in a new tab</a><iframe title="Cashfree merchant onboarding" src={link} className="h-[720px] w-full rounded-xl border" allow="camera; microphone" /></div>}
    <h3 className="font-bold">Cashfree Transaction Register</h3>
    {attempts.isError ? <ErrorPanel error={attempts.error} retry={attempts.refetch} /> : <div className="overflow-x-auto rounded-xl border"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr>{['Date & Time', 'Student', 'Order ID', 'Payment ID', 'Mode', 'Status', 'Amount'].map(x => <th key={x} className="px-4 py-3">{x}</th>)}</tr></thead><tbody className="divide-y">{attempts.data?.content?.length ? attempts.data.content.map(x => <tr key={x.attemptId}><td className="px-4 py-3">{x.paidAt || x.createdAt || '-'}</td><td className="px-4 py-3">{x.studentName || x.studentId}</td><td className="px-4 py-3">{x.orderId}</td><td className="px-4 py-3">{x.cfPaymentId || '-'}</td><td className="px-4 py-3">{x.paymentMode || '-'}</td><td className="px-4 py-3"><StatusBadge value={displayAttemptStatus(x.status)} /></td><td className="px-4 py-3">{formatMoney(x.amount)}</td></tr>) : <EmptyRow columns={7} text={attempts.isLoading ? 'Loading transactions...' : 'No transactions recorded'} />}</tbody></table></div>}
    <div className="flex justify-end gap-3"><button disabled={page === 0 || attempts.isFetching} onClick={() => setPage(page - 1)} className="rounded-lg border px-4 py-2 disabled:opacity-40">Previous</button><button disabled={attempts.isFetching || !attempts.data || page + 1 >= attempts.data.totalPages} onClick={() => setPage(page + 1)} className="rounded-lg border px-4 py-2 disabled:opacity-40">Next</button></div>
  </div>;
}

function displayAttemptStatus(status) {
  return String(status || '').toUpperCase() === 'ACTIVE' ? 'PENDING' : status;
}
