import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { db } from '../../utils/db';
import { salaryApi, teacherApi } from '../../utils/api';
import {
  buildSalaryTimeline,
  formatCurrencyAmount,
  formatSalary,
  getCurrentMonthSalaryStatus,
  getMonthLabel,
  normalizeTeacherSalary,
} from '../../utils/salaryUtils';

const TeacherSalary = () => {
  const navigate = useNavigate();
  const [session] = useState(() => JSON.parse(localStorage.getItem('active_session')) || null);
  const [teacher, setTeacher] = useState(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!session || session.role !== 'teacher') {
      navigate('/login');
      return;
    }

    const loadSalary = async () => {
      try {
        const [teacherResponse, paymentResponse] = await Promise.all([
          teacherApi.getById(session.teacherId),
          salaryApi.getPayments(session.teacherId),
        ]);
        setTeacher(attachSalaryPayments(normalizeTeacherSalary(teacherResponse), paymentResponse));
        setLoadError('');
      } catch (error) {
        const fallbackTeacher = db.getAll('teachers').find((entry) => String(entry.id) === String(session.teacherId)) || null;
        setTeacher(fallbackTeacher ? normalizeTeacherSalary(fallbackTeacher) : null);
        setLoadError(error.message || 'Unable to load salary details.');
      }
    };

    loadSalary();
  }, [navigate, session]);

  const currentSalaryStatus = useMemo(() => getCurrentMonthSalaryStatus(teacher), [teacher]);
  const salaryTimeline = useMemo(() => buildSalaryTimeline(teacher), [teacher]);
  const salaryHistory = useMemo(() => salaryTimeline.filter((entry) => entry.isPaid), [salaryTimeline]);
  const paidMonths = salaryTimeline.filter((entry) => entry.isPaid).length;
  const pendingMonths = salaryTimeline.filter((entry) => !entry.isPaid).length;
  const latestPaidEntry = salaryHistory[0] || null;
  const totalPaidAmount = salaryHistory.reduce((sum, entry) => sum + (Number(entry.totalAmount || entry.amount) || 0), 0);
  const totalPendingAmount = salaryTimeline
    .filter((entry) => !entry.isPaid)
    .reduce((sum, entry) => sum + (Number(entry.baseSalary || entry.amount) || 0), 0);

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
            <span className="hidden font-black uppercase italic tracking-tighter text-emerald-900 sm:block sm:text-xl">EduStream</span>
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
            caption={`${salaryHistory.length} settled salary record${salaryHistory.length === 1 ? '' : 's'}`}
          />
          <InsightCard
            icon={ReceiptText}
            title="Total Pending Exposure"
            value={formatCurrencyAmount(totalPendingAmount)}
            caption={pendingMonths ? `${pendingMonths} pending month${pendingMonths > 1 ? 's' : ''}` : 'No pending dues'}
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

const attachSalaryPayments = (teacher, salaryPayments = []) => {
  if (!teacher) return null;
  const paymentMap = new Map();
  (Array.isArray(teacher.paymentHistory) ? teacher.paymentHistory : []).forEach((payment) => {
    if (payment?.monthKey) paymentMap.set(payment.monthKey, payment);
  });
  salaryPayments.forEach((payment) => {
    if (!payment?.monthKey) return;
    paymentMap.set(payment.monthKey, {
      monthKey: payment.monthKey,
      baseSalary: Number(payment.baseSalary) || 0,
      previousPendingAmount: Number(payment.previousPendingAmount) || 0,
      bonusAmount: Number(payment.bonusAmount) || 0,
      advanceAmount: Number(payment.advanceAmount) || 0,
      leaveDeductionAmount: Number(payment.leaveDeductionAmount) || 0,
      amount: Number(payment.totalAmount ?? payment.amount) || 0,
      totalAmount: Number(payment.totalAmount ?? payment.amount) || 0,
      openSchoolDays: Number(payment.openSchoolDays) || 0,
      presentDays: Number(payment.presentDays) || 0,
      absentDays: Number(payment.absentDays) || 0,
      allowedLeaves: Number(payment.allowedLeaves) || 0,
      extraLeaveDays: Number(payment.extraLeaveDays) || 0,
      perDaySalary: Number(payment.perDaySalary) || 0,
      paidOn: payment.paidOn || '',
      settledMonthKeys: Array.isArray(payment.settledMonthKeys) ? payment.settledMonthKeys : [],
      note: payment.note || '',
    });
  });

  return {
    ...teacher,
    paymentHistory: [...paymentMap.values()],
  };
};

export default TeacherSalary;
