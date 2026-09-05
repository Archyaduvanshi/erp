import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Banknote,
  CalendarDays,
  GraduationCap,
  IndianRupee,
  ReceiptText,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import { salaryApi } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import {
  formatCurrencyAmount,
  getMonthLabel,
} from '../../utils/salaryUtils';

const TeacherSalary = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const currentMonthKey = new Date().toISOString().slice(0, 7);

  React.useEffect(() => {
    if (!session || session.role !== 'teacher') {
      navigate('/login');
    }
  }, [navigate, session]);

  const summaryQuery = useQuery({
    queryKey: ['salary', 'teacher-me', 'summary', currentMonthKey],
    queryFn: () => salaryApi.getMySummary({ monthKey: currentMonthKey }),
    enabled: session?.role === 'teacher',
  });

  const payrollQuery = useInfiniteQuery({
    queryKey: ['salary', 'teacher-me', 'payroll-periods'],
    queryFn: ({ pageParam = 0 }) => salaryApi.getMyPayrollPeriods({ page: pageParam, size: 12 }),
    enabled: session?.role === 'teacher',
    initialPageParam: 0,
    getNextPageParam: nextPageParam,
  });

  const paymentsQuery = useInfiniteQuery({
    queryKey: ['salary', 'teacher-me', 'payments'],
    queryFn: ({ pageParam = 0 }) => salaryApi.getMyPayments({ page: pageParam, size: 12 }),
    enabled: session?.role === 'teacher',
    initialPageParam: 0,
    getNextPageParam: nextPageParam,
  });

  const loadError = summaryQuery.error?.message || payrollQuery.error?.message || paymentsQuery.error?.message || '';
  const salaryTimeline = useMemo(() => pagesContent(payrollQuery.data).map((period) => ({
    ...period,
    label: getMonthLabel(period.monthKey),
    amount: Number(period.netPayableAmount) || 0,
    totalAmount: Number(period.netPayableAmount) || 0,
    baseSalary: Number(period.baseSalary) || 0,
    previousPendingAmount: Number(period.outstandingAmount) || 0,
    leaveDeductionAmount: Number(period.leaveDeductionAmount) || 0,
    isPaid: period.status === 'PAID',
  })), [payrollQuery.data]);
  const salaryHistory = useMemo(() => pagesContent(paymentsQuery.data).map((payment) => ({
    ...payment,
    label: getMonthLabel(payment.monthKey),
    isPaid: payment.status === 'COMPLETED',
  })), [paymentsQuery.data]);
  const paidMonths = salaryTimeline.filter((entry) => entry.isPaid).length;
  const pendingMonths = salaryTimeline.filter((entry) => !entry.isPaid).length;
  const latestPaidEntry = salaryHistory[0] || null;
  const totalPaidAmount = Number(summaryQuery.data?.totalPaid) || 0;
  const totalPendingAmount = salaryTimeline
    .filter((entry) => !entry.isPaid)
    .reduce((sum, entry) => sum + (Number(entry.baseSalary || entry.amount) || 0), 0);
  const authoritativePending = Number(summaryQuery.data?.totalPayable ?? totalPendingAmount);

  if (!session || session.role !== 'teacher') return null;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.14),_transparent_32%),linear-gradient(180deg,#f8fafc_0%,#f0fdf4_46%,#ffffff_100%)] pb-16 text-slate-900">
      <header className="sticky top-0 z-50 border-b border-white/60 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-6 py-5 md:px-12 lg:px-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/teacher')}
              className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700"
            >
              <ArrowLeft size={16} />
              Dashboard
            </button>
            <div className="rounded-2xl bg-emerald-600 p-2 shadow-sm">
              <GraduationCap size={18} className="text-white" />
            </div>
            <span className="hidden font-black uppercase italic tracking-tighter text-emerald-900 sm:block sm:text-xl">VidyantraErp</span>
          </div>

          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.24em] text-emerald-700">
            My Salary
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-screen-2xl px-6 pt-10 md:px-12 lg:px-20">
        {loadError ? (
          <div className="mb-6 rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
            {loadError}
          </div>
        ) : null}
        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <InsightCard
            icon={WalletCards}
            title="Total Paid So Far"
            value={formatCurrencyAmount(totalPaidAmount)}
            caption="Lifetime completed salary payments"
          />
          <InsightCard
            icon={ReceiptText}
            title="Total Pending Exposure"
            value={formatCurrencyAmount(authoritativePending)}
            caption={authoritativePending > 0 ? 'Backend outstanding salary ledger' : 'No pending dues'}
          />
          <InsightCard
            icon={ShieldCheck}
            title="Latest Settled Cycle"
            value={latestPaidEntry?.label || 'Not available'}
            caption={latestPaidEntry?.paidOn ? `Paid on ${new Date(latestPaidEntry.paidOn).toLocaleDateString('en-IN')}` : 'No payment history yet'}
          />
        </section>

        <section className="mt-8">
          <InfoPanel
            title="Salary Timeline"
            description="Track every monthly cycle from your joining date to the current month, including payout status and adjustments."
          >
            {salaryTimeline.length ? (
              <div className="grid gap-4">
                {salaryTimeline.map((entry, index) => (
                  <TimelineCard
                    key={entry.monthKey}
                    entry={entry}
                    highlight={index === 0}
                  />
                ))}
                {payrollQuery.hasNextPage ? (
                  <LoadMoreButton
                    loading={payrollQuery.isFetchingNextPage}
                    onClick={() => payrollQuery.fetchNextPage()}
                    label={`Load More Salary Cycles (${salaryTimeline.length}/${payrollQuery.data?.pages?.at(-1)?.totalElements || salaryTimeline.length})`}
                  />
                ) : null}
              </div>
            ) : (
              <EmptyState text="Your college has not added salary details yet." />
            )}
          </InfoPanel>
        </section>

        <section className="mt-8">
          <InfoPanel
            title="Paid Salary History"
            description="A complete review of already-settled salary cycles, including payout dates and any bonus, deduction, or pending adjustments."
          >
            {salaryHistory.length ? (
              <div className="overflow-hidden rounded-[1.9rem] border border-slate-200">
                <div className="hidden grid-cols-[1.1fr_1fr_0.95fr_0.85fr_0.85fr_0.85fr_0.95fr_1fr] gap-4 bg-slate-100 px-5 py-4 text-[11px] font-black uppercase tracking-[0.18em] text-slate-600 lg:grid">
                  <div>Salary Month</div>
                  <div>Paid Amount</div>
                  <div>Paid On</div>
                  <div>Pending</div>
                  <div>Bonus</div>
                  <div>Advance</div>
                  <div>Leave Deduction</div>
                  <div>Note</div>
                </div>

                <div className="divide-y divide-slate-200">
                  {salaryHistory.map((entry) => (
                    <HistoryRow key={entry.monthKey} entry={entry} />
                  ))}
                </div>
                {paymentsQuery.hasNextPage ? (
                  <LoadMoreButton
                    loading={paymentsQuery.isFetchingNextPage}
                    onClick={() => paymentsQuery.fetchNextPage()}
                    label={`Load More Payments (${salaryHistory.length}/${paymentsQuery.data?.pages?.at(-1)?.totalElements || salaryHistory.length})`}
                  />
                ) : null}
              </div>
            ) : (
              <EmptyState text="No paid salary history is available yet." />
            )}
          </InfoPanel>
        </section>
      </div>
    </div>
  );
};

const InsightCard = ({ icon, title, value, caption }) => (
  <div className="rounded-[2rem] border border-slate-200/90 bg-white/90 p-5 shadow-[0_20px_55px_-38px_rgba(15,23,42,0.35)] backdrop-blur">
    <div className="flex items-center justify-between gap-3">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
        {React.createElement(icon, { size: 20 })}
      </div>
      <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
        Insight
      </span>
    </div>
    <p className="mt-5 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">{title}</p>
    <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">{value}</p>
    <p className="mt-2 text-sm leading-6 text-slate-500">{caption}</p>
  </div>
);

const InfoPanel = ({ title, description, children }) => (
  <section className="rounded-[2.25rem] border border-slate-200/80 bg-white p-6 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.35)] lg:p-8">
    <h2 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">{title}</h2>
    <p className="mt-2 text-sm leading-7 text-slate-500">{description}</p>
    <div className="mt-6">{children}</div>
  </section>
);

const InfoRow = ({ icon, label, value }) => (
  <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-700 shadow-sm">
        {React.createElement(icon, { size: 18 })}
      </div>
      <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</span>
    </div>
    <span className="text-right text-sm font-black text-slate-800">{value}</span>
  </div>
);

const TimelineCard = ({ entry, highlight = false }) => (
  <div className={`rounded-[1.8rem] border px-5 py-5 ${entry.isPaid ? 'border-emerald-200 bg-emerald-50/80' : 'border-amber-200 bg-amber-50/80'} ${highlight ? 'shadow-[0_18px_45px_-35px_rgba(15,23,42,0.45)]' : ''}`}>
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div>
        <div className="flex items-center gap-3">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-600">{entry.label}</p>
          {highlight ? (
            <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white">
              Latest
            </span>
          ) : null}
        </div>
        <p className="mt-3 text-2xl font-black tracking-tight text-slate-950">{formatCurrencyAmount(entry.totalAmount || entry.amount)}</p>
        <p className="mt-2 text-sm font-semibold text-slate-600">
          {entry.isPaid
            ? `Paid on ${entry.paidOn ? new Date(entry.paidOn).toLocaleDateString('en-IN') : 'recorded date'}`
            : 'Awaiting salary payment from the college payroll team'}
        </p>
      </div>

      <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${entry.isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
        {entry.isPaid ? 'Paid' : 'Pending'}
      </span>
    </div>

    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      <MiniMetric label="Base" value={formatCurrencyAmount(entry.baseSalary)} />
      <MiniMetric label="Pending" value={formatCurrencyAmount(entry.previousPendingAmount)} />
      <MiniMetric label="Bonus" value={formatCurrencyAmount(entry.bonusAmount)} />
      <MiniMetric label="Advance" value={formatCurrencyAmount(entry.advanceAmount)} />
      <MiniMetric label="Leave Deduction" value={formatCurrencyAmount(entry.leaveDeductionAmount)} />
    </div>

    {entry.settledMonthKeys?.length ? (
      <div className="mt-4 rounded-2xl bg-white/70 px-4 py-3 text-sm font-medium text-slate-600">
        Settled months: {entry.settledMonthKeys.map((monthKey) => getMonthLabel(monthKey)).join(', ')}
      </div>
    ) : null}

    {entry.note ? (
      <div className="mt-3 rounded-2xl bg-white/70 px-4 py-3 text-sm font-medium text-slate-600">
        {entry.note}
      </div>
    ) : null}
  </div>
);

const MiniMetric = ({ label, value }) => (
  <div className="rounded-2xl border border-white/60 bg-white/80 px-4 py-3">
    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
    <p className="mt-2 text-sm font-black text-slate-900">{value}</p>
  </div>
);

const HistoryRow = ({ entry }) => (
  <div className="bg-white px-5 py-4 transition hover:bg-slate-50">
    <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr_0.95fr_0.85fr_0.85fr_0.85fr_0.95fr_1fr] lg:items-center lg:gap-4">
      <RowCell label="Salary Month" value={entry.label} strong />
      <RowCell label="Paid Amount" value={formatCurrencyAmount(entry.totalAmount || entry.amount)} tone="text-emerald-700" strong />
      <RowCell label="Paid On" value={entry.paidOn ? new Date(entry.paidOn).toLocaleDateString('en-IN') : 'Not available'} />
      <RowCell label="Pending" value={formatCurrencyAmount(entry.previousPendingAmount)} />
      <RowCell label="Bonus" value={formatCurrencyAmount(entry.bonusAmount)} />
      <RowCell label="Advance" value={formatCurrencyAmount(entry.advanceAmount)} />
      <RowCell label="Leave Deduction" value={formatCurrencyAmount(entry.leaveDeductionAmount)} />
      <RowCell label="Note" value={entry.note || (entry.settledMonthKeys?.length ? `Settled: ${entry.settledMonthKeys.map((monthKey) => getMonthLabel(monthKey)).join(', ')}` : '-')} />
    </div>
  </div>
);

const RowCell = ({ label, value, tone = 'text-slate-700', strong = false }) => (
  <div className="min-w-0">
    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 lg:hidden">{label}</p>
    <p className={`mt-1 truncate text-sm ${strong ? 'font-black' : 'font-semibold'} ${tone}`}>{value}</p>
  </div>
);

const EmptyState = ({ text }) => (
  <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-500">
    {text}
  </div>
);

const LoadMoreButton = ({ label, loading, onClick }) => (
  <button
    type="button"
    disabled={loading}
    onClick={onClick}
    className="mt-5 inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
  >
    {loading ? 'Loading...' : label}
  </button>
);

function pageContent(page) {
  if (Array.isArray(page)) return page;
  if (Array.isArray(page?.content)) return page.content;
  return [];
}

function pagesContent(data) {
  if (!data?.pages) return pageContent(data);
  return data.pages.flatMap(pageContent);
}

function nextPageParam(lastPage) {
  if (!lastPage || Array.isArray(lastPage) || lastPage.last) return undefined;
  const nextPage = Number(lastPage.number || 0) + 1;
  return nextPage < Number(lastPage.totalPages || 0) ? nextPage : undefined;
}

export default TeacherSalary;
