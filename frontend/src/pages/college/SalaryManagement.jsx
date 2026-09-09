import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  CircleAlert,
  IndianRupee,
  PlusCircle,
  ReceiptText,
  Search,
  Wallet,
} from 'lucide-react';
import { salaryApi } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import QRScannerButton from '../../components/scanner/QRScannerButton';
import {
  formatCurrencyAmount,
  formatSalary,
  getMonthKey,
  getMonthLabel,
} from '../../utils/salaryUtils';

const isCollegeModuleSession = (session) => ['admin', 'feature', 'teacher'].includes(session?.role);
const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white';

const SalaryManagement = () => {
  const navigate = useNavigate();
  const { teacherId } = useParams();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const collegeId = session?.id || '';
  const [loadError, setLoadError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [payrollPage, setPayrollPage] = useState(0);
  const currentMonthKey = getMonthKey(new Date());
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 350);

  React.useEffect(() => {
    if (!isCollegeModuleSession(session) || !collegeId) {
      navigate('/login');
    }
  }, [collegeId, navigate, session]);

  const overviewQuery = useQuery({
    queryKey: ['salary', 'overview', currentMonthKey],
    queryFn: () => salaryApi.getOverview({ monthKey: currentMonthKey }),
    enabled: isCollegeModuleSession(session) && Boolean(collegeId),
  });

  const payrollQuery = useQuery({
    queryKey: ['salary', 'payroll-periods', currentMonthKey, debouncedSearchTerm, statusFilter, payrollPage],
    queryFn: () => salaryApi.getPayrollPeriods({
      monthKey: currentMonthKey,
      search: debouncedSearchTerm,
      status: statusFilter === 'Paid' ? 'PAID' : statusFilter === 'Pending' ? 'UNPAID' : '',
      page: payrollPage,
      size: 25,
    }),
    enabled: isCollegeModuleSession(session) && Boolean(collegeId),
  });

  const generatePayrollMutation = useMutation({
    mutationFn: () => salaryApi.generatePayrollPeriodsForMonth({ monthKey: currentMonthKey }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary'] });
    },
  });

  React.useEffect(() => {
    const error = overviewQuery.error || payrollQuery.error || generatePayrollMutation.error;
    setLoadError(error?.message || '');
  }, [generatePayrollMutation.error, overviewQuery.error, payrollQuery.error]);

  React.useEffect(() => {
    setPayrollPage(0);
  }, [debouncedSearchTerm, statusFilter]);

  if (!isCollegeModuleSession(session) || !collegeId) return null;

  return teacherId ? (
    <TeacherPayrollDesk
      teacherId={teacherId}
      loadError={loadError}
      setLoadError={setLoadError}
      navigate={navigate}
      queryClient={queryClient}
    />
  ) : (
      <PayrollRegister
        payrollPeriods={pageContent(payrollQuery.data)}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        payrollPage={payrollPage}
        setPayrollPage={setPayrollPage}
        payrollPageData={payrollQuery.data}
        overview={overviewQuery.data}
        loadError={loadError}
        loading={payrollQuery.isLoading || overviewQuery.isLoading || generatePayrollMutation.isPending}
        navigate={navigate}
        onGenerateMonth={() => generatePayrollMutation.mutate()}
        onScanTeacher={(identity) => navigate(`/college/salary/${identity.id}`)}
      />
  );
};

const PayrollRegister = ({ payrollPeriods, searchTerm, setSearchTerm, statusFilter, setStatusFilter, payrollPage, setPayrollPage, payrollPageData, overview, loadError, loading, navigate, onGenerateMonth, onScanTeacher }) => {
  const currentMonthKey = getMonthKey(new Date());

  const rows = useMemo(() => (
    payrollPeriods.map((currentEntry) => {
      const teacherName = currentEntry.teacherName || 'Teacher';
      const teacher = {
        id: currentEntry.teacherId,
        employeeId: currentEntry.employeeId,
        firstName: currentEntry.teacherName,
        specialization: currentEntry.specialization,
        salary: currentEntry.baseSalary,
      };
      const status = currentEntry?.status === 'PAID' ? 'Paid' : 'Pending';

      return {
        teacher,
        teacherName,
        currentEntry,
        status,
        pendingCount: currentEntry ? (Number(currentEntry.outstandingAmount) > 0 ? 1 : 0) : 1,
        pendingAmount: Number(currentEntry?.outstandingAmount ?? teacher.salary ?? 0),
      };
    })
  ), [payrollPeriods]);

  const filteredRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== 'All' && row.status !== statusFilter) return false;
      if (!query) return true;
      return (
        row.teacherName.toLowerCase().includes(query) ||
        String(row.teacher.employeeId || '').toLowerCase().includes(query) ||
        String(row.teacher.employeeId || '').toLowerCase().includes(query) ||
        String(row.teacher.assignedClass || '').toLowerCase().includes(query)
      );
    });
  }, [rows, searchTerm, statusFilter]);

  const monthlyPayroll = Number(overview?.currentMonthObligation ?? overview?.totalObligation ?? 0);
  const paidThisMonth = Number(overview?.paidTeachers ?? rows.filter((row) => row.status === 'Paid').length);
  const pendingThisMonth = Number(overview?.pendingTeachers ?? rows.filter((row) => row.status === 'Pending').length);
  const missingSalary = Number(overview?.teachersMissingSalaryProfile ?? rows.filter((row) => !row.teacher.salary).length);

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-12 text-slate-900">
      <Header title="Teacher Salary Register" eyebrow="Salary Management" onBack={() => navigate('/college')} />

      <main className="mx-auto max-w-screen-2xl px-6 py-8 md:px-10">
        <ErrorBanner message={loadError} />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatTile icon={Wallet} label="Monthly Payroll" value={formatCurrencyAmount(monthlyPayroll)} />
          <StatTile icon={CheckCircle2} label="Paid This Month" value={String(paidThisMonth)} tone="success" />
          <StatTile icon={CircleAlert} label="Pending This Month" value={String(pendingThisMonth)} tone="warning" />
          <StatTile icon={Banknote} label="Salary Missing" value={String(missingSalary)} tone={missingSalary ? 'danger' : 'default'} />
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700">{getMonthLabel(currentMonthKey)}</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Payroll Register</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">Teacher select karke salary update, adjustment add, aur monthly payment mark kar sakte ho.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_170px_auto]">
              <SearchBox value={searchTerm} onChange={setSearchTerm} placeholder="Search teacher, ID, class..." />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white"
              >
                {['All', 'Paid', 'Pending'].map((option) => <option key={option}>{option}</option>)}
              </select>
              <div className="flex gap-2">
                <QRScannerButton feature="salary" onResolved={onScanTeacher} />
                <ActionButton icon={PlusCircle} label="Generate Month" onClick={onGenerateMonth} disabled={loading} />
              </div>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
            <div className="hidden grid-cols-[1fr_1.2fr_0.9fr_0.9fr_0.8fr_0.8fr] gap-4 bg-slate-100 px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 lg:grid">
              <div>Employee ID</div>
              <div>Name</div>
              <div>Class</div>
              <div>Monthly Salary</div>
              <div>Status</div>
              <div>Pending</div>
            </div>

            {loading ? (
              <EmptyState text="Loading salary register..." />
            ) : filteredRows.length ? (
              <div className="divide-y divide-slate-200">
                {filteredRows.map((row) => (
                  <button
                    key={row.teacher.id}
                    type="button"
                    onClick={() => navigate(`/college/salary/${row.teacher.id}`)}
                    className="block w-full bg-white px-4 py-4 text-left transition hover:bg-emerald-50/70"
                  >
                    <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr_0.9fr_0.9fr_0.8fr_0.8fr] lg:items-center lg:gap-4">
                      <TableCell label="Employee ID" value={row.teacher.employeeId || 'Pending'} strong />
                      <TableCell label="Name" value={row.teacherName} strong />
                      <TableCell label="Class" value={row.teacher.specialization || 'Not assigned'} />
                      <TableCell label="Monthly Salary" value={formatSalary(row.currentEntry?.baseSalary ?? row.teacher.salary)} />
                      <div>
                        <MobileLabel>Status</MobileLabel>
                        <StatusPill status={row.status} />
                      </div>
                      <TableCell label="Pending" value={`${row.pendingCount} month${row.pendingCount === 1 ? '' : 's'}`} tone={row.pendingCount ? 'text-amber-700' : 'text-slate-700'} />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState text="No teacher record matched your filters." />
            )}
          </div>
          <Pager
            page={payrollPage}
            totalPages={payrollPageData?.totalPages || 1}
            onPrev={() => setPayrollPage((page) => Math.max(0, page - 1))}
            onNext={() => setPayrollPage((page) => page + 1)}
          />
        </section>
      </main>
    </div>
  );
};

const TeacherPayrollDesk = ({ teacherId, loadError, setLoadError, navigate, queryClient }) => {
  const [selectedMonth, setSelectedMonth] = useState(getMonthKey(new Date()));
  const [draft, setDraft] = useState({});
  const [paymentsPage, setPaymentsPage] = useState(0);

  const summaryQuery = useQuery({
    queryKey: ['salary', 'teacher-summary', teacherId, selectedMonth],
    queryFn: () => salaryApi.getTeacherSummary(teacherId, { monthKey: selectedMonth }),
    enabled: Boolean(teacherId && selectedMonth),
  });

  const paymentsQuery = useQuery({
    queryKey: ['salary', 'payments', teacherId, paymentsPage],
    queryFn: () => salaryApi.getTeacherPayments(teacherId, { page: paymentsPage, size: 25 }),
    enabled: Boolean(teacherId),
  });

  const savePaymentMutation = useMutation({
    mutationFn: salaryApi.savePayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary'] });
    },
  });

  const generatePayrollMutation = useMutation({
    mutationFn: () => salaryApi.generatePayrollPeriod({ teacherId, monthKey: selectedMonth }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary'] });
    },
  });

  React.useEffect(() => {
    const error = summaryQuery.error || paymentsQuery.error || savePaymentMutation.error || generatePayrollMutation.error;
    setLoadError(error?.message || '');
  }, [generatePayrollMutation.error, paymentsQuery.error, savePaymentMutation.error, setLoadError, summaryQuery.error]);

  const summary = summaryQuery.data || null;
  const teacher = summary ? {
    id: summary.teacherId,
    firstName: summary.teacherName,
    employeeId: summary.employeeId,
    specialization: summary.specialization,
    contractType: summary.contractType,
    salary: summary.salaryProfile?.baseSalary,
  } : null;
  const selectedEntry = summary?.payrollPeriod || null;
  const paidHistory = pageContent(paymentsQuery.data).map((payment) => ({
    ...payment,
    label: getMonthLabel(payment.monthKey),
    isPaid: payment.status === 'COMPLETED',
  }));
  const previousPendingAmount = Number(summary?.previousOutstanding || 0);
  const draftSalary = Number(selectedEntry?.baseSalary ?? teacher?.salary) || 0;
  const bonusAmount = Math.max(0, Number(draft.bonusAmount) || 0);
  const attendanceDeduction = selectedEntry || {};
  const payableAmount = Math.max(0, Number(summary?.totalPayable ?? selectedEntry?.outstandingAmount ?? 0) + bonusAmount);

  const handleMarkPaid = async () => {
    if (!teacher || !selectedEntry || selectedEntry.status === 'PAID') return;
    try {
      await savePaymentMutation.mutateAsync({
        teacherId: teacher.id,
        monthKey: selectedMonth,
        payrollMonth: selectedMonth,
        totalAmount: payableAmount,
        bonusAmount,
        settlePreviousOutstanding: true,
        paidOn: new Date().toISOString().slice(0, 10),
        idempotencyKey: crypto.randomUUID?.() || `${teacher.id}-${selectedMonth}-${Date.now()}`,
        note: draft.note || '',
      });
      setDraft({});
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Unable to mark teacher salary as paid.');
    }
  };

  const handleGeneratePayroll = () => {
    if (!teacherId || !selectedMonth) return;
    generatePayrollMutation.mutate();
  };

  if (!teacher) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] pb-12 text-slate-900">
        <Header title="Teacher Not Found" eyebrow="Salary Management" backLabel="Back To Register" onBack={() => navigate('/college/salary')} />
        <main className="mx-auto max-w-4xl px-6 py-8">
          <EmptyState text="Teacher record not found." />
        </main>
      </div>
    );
  }

  const teacherName = getTeacherName(teacher);

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-12 text-slate-900">
      <Header
        title={teacherName}
        eyebrow="Teacher Payroll Desk"
        backLabel="Back To Register"
        onBack={() => navigate('/college/salary')}
        rightContent={(
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500"
          />
        )}
      />

      <main className="mx-auto max-w-screen-2xl px-6 py-8 md:px-10">
        <ErrorBanner message={loadError} />

        <section>
          <Panel title={`${getMonthLabel(selectedMonth)} Payout`} description="Salary aur joining date Teacher Management se fetch hoti hai. Extra absent days par salary per-day deduct ho kar payable amount me show hogi.">
            <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
              <div className="grid gap-4">
                <Field label="Bonus Amount">
                  <input
                    type="number"
                    min="0"
                    value={draft.bonusAmount ?? ''}
                    onChange={(e) => setDraft((current) => ({ ...current, bonusAmount: e.target.value }))}
                    placeholder="0"
                    className={inputClass}
                  />
                </Field>
                <Field label="Payroll Note">
                  <textarea
                    value={draft.note ?? ''}
                    onChange={(e) => setDraft((current) => ({ ...current, note: e.target.value }))}
                    placeholder="Optional note for this payout"
                    className={`${inputClass} min-h-24 resize-y`}
                  />
                </Field>
              </div>

              <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <BreakdownLine icon={IndianRupee} label="Base Salary" value={formatCurrencyAmount(draftSalary)} positive />
                <BreakdownLine icon={Wallet} label="Previous Unpaid Salary" value={formatCurrencyAmount(previousPendingAmount)} positive />
                <BreakdownLine icon={PlusCircle} label="Bonus" value={formatCurrencyAmount(bonusAmount)} positive />
                <BreakdownLine icon={CircleAlert} label="Leave Deduction" value={formatCurrencyAmount(attendanceDeduction.leaveDeductionAmount)} />
                <BreakdownLine icon={CheckCircle2} label="Final Payable" value={formatCurrencyAmount(payableAmount)} positive />
              </div>

              <div className="lg:col-span-2 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-5">
                <MiniInfo label="Open School Days" value={String(attendanceDeduction.openSchoolDays)} />
                <MiniInfo label="Present Days" value={String(attendanceDeduction.presentDays)} />
                <MiniInfo label="Allowed Leaves" value={String(attendanceDeduction.allowedLeaves)} />
                <MiniInfo label="Extra Leave Days" value={String(attendanceDeduction.extraLeaveDays)} />
                <MiniInfo label="Per Day Salary" value={formatCurrencyAmount(attendanceDeduction.perDaySalary)} />
              </div>

              <div className="lg:col-span-2">
                <ActionButton
                  icon={CheckCircle2}
                  label={selectedEntry?.status === 'PAID' ? 'Already Paid' : 'Tap To Paid'}
                  onClick={handleMarkPaid}
                  disabled={draftSalary <= 0 || selectedEntry?.status === 'PAID' || selectedEntry?.status === 'DRAFT' || savePaymentMutation.isPending}
                  full
                />
                {!selectedEntry ? (
                  <div className="mt-3">
                    <ActionButton
                      icon={PlusCircle}
                      label="Generate Payroll"
                      onClick={handleGeneratePayroll}
                      disabled={generatePayrollMutation.isPending}
                      full
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </Panel>
        </section>

        <Panel className="mt-8" title="Paid Salary History" description="Paid month, amount, deductions, bonus, paid date aur settled pending months yahan record hote hain.">
          {paidHistory.length ? (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="min-w-[1280px] w-full divide-y divide-slate-200 text-left text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      {['Month', 'Paid Amount', 'Base', 'Previous Pending', 'Bonus', 'Leave Deduction', 'Open Days', 'Present', 'Extra Leave', 'Paid On', 'Settled Months', 'Note'].map((heading) => (
                        <th key={heading} className="px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {paidHistory.map((entry) => (
                      <tr key={entry.monthKey} className="hover:bg-emerald-50/50">
                        <td className="px-4 py-4 font-black text-slate-950">{entry.label}</td>
                        <td className="px-4 py-4 font-black text-emerald-700">{formatCurrencyAmount(entry.totalAmount || entry.amount)}</td>
                        <td className="px-4 py-4 text-slate-700">{formatCurrencyAmount(entry.baseSalary)}</td>
                        <td className="px-4 py-4 text-slate-700">{formatCurrencyAmount(entry.previousPendingAmount)}</td>
                        <td className="px-4 py-4 text-slate-700">{formatCurrencyAmount(entry.bonusAmount)}</td>
                        <td className="px-4 py-4 text-slate-700">{formatCurrencyAmount(entry.leaveDeductionAmount)}</td>
                        <td className="px-4 py-4 text-slate-700">{entry.openSchoolDays || '-'}</td>
                        <td className="px-4 py-4 text-slate-700">{entry.presentDays || '-'}</td>
                        <td className="px-4 py-4 text-slate-700">{entry.extraLeaveDays || '-'}</td>
                        <td className="px-4 py-4 text-slate-700">{entry.paidOn ? new Date(entry.paidOn).toLocaleDateString('en-IN') : '-'}</td>
                        <td className="px-4 py-4 text-slate-700">{entry.settledMonthKeys?.length ? entry.settledMonthKeys.map((monthKey) => getMonthLabel(monthKey)).join(', ') : '-'}</td>
                        <td className="px-4 py-4 text-slate-700">{entry.note || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <EmptyState text="No paid salary history available yet." />
          )}
          <Pager
            page={paymentsPage}
            totalPages={paymentsQuery.data?.totalPages || 1}
            onPrev={() => setPaymentsPage((page) => Math.max(0, page - 1))}
            onNext={() => setPaymentsPage((page) => page + 1)}
          />
        </Panel>
      </main>
    </div>
  );
};

const Header = ({ title, eyebrow, onBack, backLabel = 'Dashboard', rightContent = null }) => (
  <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
    <div className="mx-auto flex max-w-screen-2xl flex-col gap-4 px-6 py-4 md:px-10 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700"
        >
          <ArrowLeft size={16} />
          {backLabel}
        </button>
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-700">{eyebrow}</p>
          <h1 className="truncate text-2xl font-black tracking-tight text-slate-950">{title}</h1>
        </div>
      </div>
      {rightContent}
    </div>
  </header>
);

const Panel = ({ title, description, className = '', children }) => (
  <section className={`${className} rounded-2xl border border-slate-200 bg-white p-5 shadow-sm`}>
    <h2 className="text-xl font-black tracking-tight text-slate-950">{title}</h2>
    <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
    <div className="mt-5">{children}</div>
  </section>
);

const StatTile = ({ icon: Icon, label, value, tone = 'default' }) => {
  const toneClass = {
    default: 'bg-slate-100 text-slate-700',
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    danger: 'bg-rose-100 text-rose-700',
  }[tone] || 'bg-slate-100 text-slate-700';

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">{label}</p>
          <p className="mt-3 text-2xl font-black tracking-tight text-slate-950">{value}</p>
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${toneClass}`}>
          <Icon size={19} />
        </div>
      </div>
    </article>
  );
};

const SearchBox = ({ value, onChange, placeholder }) => (
  <div className="relative">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-10 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white"
    />
  </div>
);

const StatusPill = ({ status }) => (
  <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${
    status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
  }`}>
    {status}
  </span>
);

const Field = ({ label, span = false, children }) => (
  <label className={`${span ? 'md:col-span-2' : ''} block`}>
    <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</span>
    <div className="mt-2">{children}</div>
  </label>
);

const ActionButton = ({ icon: Icon, label, onClick, disabled = false, full = false }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`${full ? 'w-full' : ''} inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition ${
      disabled ? 'cursor-not-allowed bg-slate-200 text-slate-400' : 'bg-slate-950 text-white hover:bg-emerald-700'
    }`}
  >
    <Icon size={16} />
    {label}
  </button>
);

const BreakdownLine = ({ icon: Icon, label, value, positive = false, strong = false }) => (
  <div className={`flex items-center justify-between gap-4 rounded-xl px-4 py-3 ${strong ? 'bg-slate-950 text-white' : 'bg-white'}`}>
    <div className="flex min-w-0 items-center gap-3">
      <Icon size={16} className={strong ? 'text-white' : positive ? 'text-emerald-700' : 'text-slate-500'} />
      <span className={`text-sm ${strong ? 'font-black text-white' : 'font-semibold text-slate-600'}`}>{label}</span>
    </div>
    <span className={`text-sm font-black ${strong ? 'text-white' : 'text-slate-950'}`}>{value}</span>
  </div>
);

const MiniInfo = ({ label, value }) => (
  <div className="rounded-xl bg-slate-50 px-4 py-3">
    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
    <p className="mt-2 text-sm font-black text-slate-950">{value}</p>
  </div>
);

const TableCell = ({ label, value, tone = 'text-slate-700', strong = false }) => (
  <div className="min-w-0">
    <MobileLabel>{label}</MobileLabel>
    <p className={`truncate text-sm ${strong ? 'font-black' : 'font-semibold'} ${tone}`}>{value}</p>
  </div>
);

const MobileLabel = ({ children }) => (
  <p className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 lg:hidden">{children}</p>
);

const ErrorBanner = ({ message }) => (
  message ? (
    <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
      {message}
    </div>
  ) : null
);

const EmptyState = ({ text, compact = false }) => (
  <div className={`rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-sm font-semibold text-slate-500 ${compact ? 'py-6' : 'py-10'}`}>
    {text}
  </div>
);

const Pager = ({ page, totalPages, onPrev, onNext }) => (
  <div className="mt-4 flex items-center justify-end gap-2">
    <button
      type="button"
      onClick={onPrev}
      disabled={page <= 0}
      className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 disabled:cursor-not-allowed disabled:text-slate-300"
    >
      Previous
    </button>
    <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
      Page {page + 1} / {Math.max(totalPages, 1)}
    </span>
    <button
      type="button"
      onClick={onNext}
      disabled={page + 1 >= Math.max(totalPages, 1)}
      className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 disabled:cursor-not-allowed disabled:text-slate-300"
    >
      Next
    </button>
  </div>
);

function useDebouncedValue(value, delayMs) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, value]);
  return debouncedValue;
}

const getTeacherName = (teacher) => `${teacher?.firstName || ''} ${teacher?.lastName || ''}`.trim() || 'Unnamed teacher';

const calculateTeacherAttendanceDeduction = (teacher, monthKey, records = []) => {
  if (!teacher || !monthKey) {
    return {
      openSchoolDays: 0,
      presentDays: 0,
      absentDays: 0,
      allowedLeaves: 0,
      extraLeaveDays: 0,
      perDaySalary: 0,
      leaveDeductionAmount: 0,
    };
  }

  const monthRecords = records.filter((record) => (
    String(record.teacherId) === String(teacher.id)
    && String(record.date || '').slice(0, 7) === monthKey
  ));
  const uniqueOpenDates = [...new Set(monthRecords.map((record) => record.date).filter(Boolean))];
  const presentDates = new Set(
    monthRecords
      .filter((record) => record.status === 'Present')
      .map((record) => record.date)
      .filter(Boolean),
  );
  const openSchoolDays = uniqueOpenDates.length;
  const presentDays = presentDates.size;
  const absentDays = Math.max(openSchoolDays - presentDays, 0);
  const allowedLeaves = Math.max(0, Number(teacher.leaveBalance) || 0);
  const extraLeaveDays = Math.max(absentDays - allowedLeaves, 0);
  const monthlySalary = Number(teacher.salary) || 0;
  const perDaySalary = openSchoolDays > 0 ? Math.round(monthlySalary / openSchoolDays) : 0;
  const leaveDeductionAmount = extraLeaveDays * perDaySalary;

  return {
    openSchoolDays,
    presentDays,
    absentDays,
    allowedLeaves,
    extraLeaveDays,
    perDaySalary,
    leaveDeductionAmount,
  };
};

const attachSalaryPayments = (teacher, salaryPayments = []) => {
  if (!teacher) return null;
  const dbPayments = salaryPayments
    .filter((payment) => String(payment.teacherId) === String(teacher.id))
    .map(toTimelinePaymentEntry);
  const legacyPayments = Array.isArray(teacher.paymentHistory) ? teacher.paymentHistory : [];
  const paymentMap = new Map();
  legacyPayments.forEach((payment) => {
    if (payment?.monthKey) paymentMap.set(payment.monthKey, payment);
  });
  dbPayments.forEach((payment) => {
    if (payment?.monthKey) paymentMap.set(payment.monthKey, payment);
  });

  return {
    ...teacher,
    paymentHistory: [...paymentMap.values()],
  };
};

const toTimelinePaymentEntry = (payment) => ({
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

const toSalaryPaymentPayload = (teacherId, entry) => ({
  teacherId,
  monthKey: entry.monthKey,
  baseSalary: Number(entry.baseSalary) || 0,
  previousPendingAmount: Number(entry.previousPendingAmount) || 0,
  bonusAmount: Number(entry.bonusAmount) || 0,
  leaveDeductionAmount: Number(entry.leaveDeductionAmount) || 0,
  totalAmount: Number(entry.totalAmount ?? entry.amount) || 0,
  openSchoolDays: Number(entry.openSchoolDays) || 0,
  presentDays: Number(entry.presentDays) || 0,
  absentDays: Number(entry.absentDays) || 0,
  allowedLeaves: Number(entry.allowedLeaves) || 0,
  extraLeaveDays: Number(entry.extraLeaveDays) || 0,
  perDaySalary: Number(entry.perDaySalary) || 0,
  paidOn: entry.paidOn || new Date().toISOString(),
  settledMonthKeys: Array.isArray(entry.settledMonthKeys) ? entry.settledMonthKeys : [],
  note: entry.note || '',
});

const buildSalaryPaidNoticePayload = ({
  teacher,
  monthKey,
  payableAmount,
  previousPendingAmount,
  bonusAmount,
  attendanceDeduction,
  note,
}) => {
  const teacherName = getTeacherName(teacher);
  const monthLabel = getMonthLabel(monthKey);
  const salary = Number(teacher.salary) || 0;
  const today = new Date().toISOString().split('T')[0];

  return {
    title: `Salary paid: ${monthLabel}`,
    category: 'Salary',
    audience: 'Teachers',
    targetClasses: ['All'],
    targetTeacherId: teacher.id,
    priority: 'Normal',
    publishDate: today,
    expireDate: null,
    status: 'Published',
    isPinned: false,
    summary: `${teacherName}, your ${monthLabel} salary of ${formatCurrencyAmount(payableAmount)} has been marked paid.`,
    details: [
      `Teacher: ${teacherName}`,
      `Employee ID: ${teacher.employeeId || '-'}`,
      `Salary Month: ${monthLabel}`,
      `Paid Date: ${today}`,
      '',
      `Base Salary: ${formatCurrencyAmount(salary)}`,
      `Previous Pending: ${formatCurrencyAmount(previousPendingAmount)}`,
      `Bonus: ${formatCurrencyAmount(bonusAmount)}`,
      `Leave Deduction: ${formatCurrencyAmount(attendanceDeduction.leaveDeductionAmount)}`,
      `Final Paid Amount: ${formatCurrencyAmount(payableAmount)}`,
      '',
      `Open School Days: ${attendanceDeduction.openSchoolDays}`,
      `Present Days: ${attendanceDeduction.presentDays}`,
      `Absent Days: ${attendanceDeduction.absentDays}`,
      `Allowed Leaves: ${attendanceDeduction.allowedLeaves}`,
      `Extra Leave Days: ${attendanceDeduction.extraLeaveDays}`,
      `Per Day Salary: ${formatCurrencyAmount(attendanceDeduction.perDaySalary)}`,
      note ? `Note: ${String(note).trim()}` : 'Note: -',
    ].join('\n'),
  };
};

function pageContent(page) {
  if (Array.isArray(page)) return page;
  if (Array.isArray(page?.content)) return page.content;
  return [];
}

export default SalaryManagement;
