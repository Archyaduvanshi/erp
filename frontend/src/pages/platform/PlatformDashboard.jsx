import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Building2, CreditCard, FileClock, Receipt, Settings, ShieldCheck, WalletCards } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ModuleCard from '../../components/dashboard/ModuleCard';
import PlatformLayout from '../../components/platform/PlatformLayout';
import { ErrorPanel, PageSkeleton, StatusBadge, formatDate, formatMoney } from '../../components/platform/PlatformUi';
import { platformApi } from '../../api/platformApi';

const cards = [
  ['/platform/institutes', Building2, 'Institutes', 'Manage all registered schools and colleges on VidyantraErp.', 'text-emerald-700'],
  ['/platform/subscriptions', CreditCard, 'Subscriptions', 'Manage plans, trials, renewals and expiry dates.', 'text-blue-700'],
  ['/platform/features', ShieldCheck, 'Feature Access', 'Control which ERP modules each institute can use.', 'text-amber-700'],
  ['/platform/billing', Receipt, 'Billing', 'Track VidyantraErp invoices and subscription revenue.', 'text-rose-700'],
  ['/platform/gateways', WalletCards, 'Payment Gateway', 'Monitor provider onboarding and payment status.', 'text-cyan-700'],
  ['/platform/usage', BarChart3, 'Platform Usage', 'Review lightweight usage counts across institutes.', 'text-violet-700'],
  ['/platform/audit', FileClock, 'Audit Logs', 'Review immutable platform administration activity.', 'text-slate-700'],
  ['/platform/settings', Settings, 'Platform Settings', 'Manage registration, trials and support preferences.', 'text-emerald-800'],
];

const Kpi = ({ label, value, accent = 'text-slate-950' }) => <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-lg shadow-slate-200/30"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p><p className={`mt-3 text-3xl font-black ${accent}`}>{value}</p></div>;

const PlatformDashboard = () => {
  const navigate = useNavigate();
  const overview = useQuery({ queryKey: ['platform', 'overview'], queryFn: platformApi.overview, staleTime: 30000 });
  return <PlatformLayout title="Platform Dashboard" subtitle="VidyantraErp portfolio overview">
    {overview.isLoading ? <PageSkeleton /> : overview.isError ? <ErrorPanel error={overview.error} retry={overview.refetch} /> : <>
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-6">
        <Kpi label="Total Institutes" value={overview.data.totalInstitutes} /><Kpi label="Active" value={overview.data.activeInstitutes} accent="text-emerald-700" />
        <Kpi label="Trials" value={overview.data.trialInstitutes} accent="text-amber-700" /><Kpi label="Suspended" value={overview.data.suspendedInstitutes} accent="text-rose-700" />
        <Kpi label="Students" value={overview.data.totalStudents} /><Kpi label="Teachers" value={overview.data.totalTeachers} />
        <Kpi label="Active Subscriptions" value={overview.data.activeSubscriptions} /><Kpi label="Expiring In 7 Days" value={overview.data.expiringIn7Days} accent="text-amber-700" />
        <Kpi label="Gateway Enabled" value={overview.data.paymentGatewayEnabledInstitutes} /><Kpi label="Monthly Revenue" value={formatMoney(overview.data.monthlySubscriptionRevenue)} />
      </section>
      <section className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-10 lg:grid-cols-3">{cards.map(([to, Icon, title, desc, color]) => <ModuleCard key={to} icon={<Icon className={color} size={42} />} title={title} desc={desc} onClick={() => navigate(to)} />)}</section>
      <section className="mt-10 grid gap-6 xl:grid-cols-2"><DashboardTable title="Recently Registered" headers={['Institute', 'Code', 'Status', 'Registered']} rows={overview.data.recentInstitutes.map((item) => [item.instituteName, item.institutionCode, <StatusBadge value={item.status} />, formatDate(item.registeredAt)])} /><DashboardTable title="Expiring Subscriptions" headers={['Institute', 'Plan', 'Expiry', 'Days']} rows={overview.data.expiringSubscriptions.map((item) => [item.instituteName, item.plan, formatDate(item.endDate), item.daysRemaining])} /></section>
    </>}
  </PlatformLayout>;
};

const DashboardTable = ({ title, headers, rows }) => <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-lg shadow-slate-200/30"><h2 className="px-6 py-5 font-serif text-xl font-black italic text-slate-950">{title}</h2><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-950 text-[10px] font-black uppercase tracking-widest text-white"><tr>{headers.map((header) => <th key={header} className="px-5 py-4">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.length ? rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} className="whitespace-nowrap px-5 py-4 font-semibold text-slate-600">{cell}</td>)}</tr>) : <tr><td colSpan={headers.length} className="px-5 py-10 text-center text-slate-400">No records found</td></tr>}</tbody></table></div></div>;

export default PlatformDashboard;
