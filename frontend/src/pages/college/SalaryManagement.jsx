import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { db } from '../../utils/db';
import { noticeApi, salaryApi, teacherApi } from '../../utils/api';
import {
  buildSalaryTimeline,
  formatCurrencyAmount,
  formatSalary,
  getMonthKey,
  getMonthLabel,
  getPreviousPendingSalaryEntries,
  markSalaryPaid,
  normalizeTeacherSalary,
} from '../../utils/salaryUtils';

const isCollegeModuleSession = (session) => session?.role === 'admin' || session?.role === 'feature';
const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white';

const SalaryManagement = () => {
  const navigate = useNavigate();
  const { teacherId } = useParams();
  const [session] = useState(() => JSON.parse(localStorage.getItem('active_session')) || null);
  const [collegeId] = useState(() => localStorage.getItem('current_college_id'));
  const [teachers, setTeachers] = useState(() => db.getAll('teachers').map(normalizeTeacherSalary));
  const [salaryPayments, setSalaryPayments] = useState([]);
  const [teacherAttendanceRecords, setTeacherAttendanceRecords] = useState(() => db.getAll('teacher_attendance_records'));
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!isCollegeModuleSession(session) || !collegeId) {
      navigate('/login');
      return;
    }

    const loadTeachers = async () => {
      try {
        const [apiTeachers, apiSalaryPayments] = await Promise.all([
          teacherApi.getAll(),
          salaryApi.getPayments(),
        ]);
        if (apiTeachers.length === 0) {
          const localTeachers = db.getAll('teachers');
          if (localTeachers.length > 0) {
            const importedTeachers = await teacherApi.import(localTeachers);
            db.replaceAll('teachers', importedTeachers);
            setTeachers(importedTeachers.map(normalizeTeacherSalary));
            setSalaryPayments(apiSalaryPayments);
            setLoadError('');
            return;
          }
        }

        db.replaceAll('teachers', apiTeachers);
        setTeachers(apiTeachers.map(normalizeTeacherSalary));
        setSalaryPayments(apiSalaryPayments);
        setTeacherAttendanceRecords(db.getAll('teacher_attendance_records'));
        setLoadError('');
      } catch (error) {
        setTeachers(db.getAll('teachers').map(normalizeTeacherSalary));
        setSalaryPayments([]);
        setTeacherAttendanceRecords(db.getAll('teacher_attendance_records'));
        setLoadError(error.message || 'Unable to load teachers from the server.');
      }
    };

    loadTeachers();
  }, [collegeId, navigate, session]);

  if (!isCollegeModuleSession(session) || !collegeId) return null;

  return teacherId ? (
    <TeacherPayrollDesk
      teacherId={teacherId}
      teachers={teachers}
      salaryPayments={salaryPayments}
      teacherAttendanceRecords={teacherAttendanceRecords}
      setSalaryPayments={setSalaryPayments}
      loadError={loadError}
      setLoadError={setLoadError}
      navigate={navigate}
    />
  ) : (
    <PayrollRegister teachers={teachers} salaryPayments={salaryPayments} loadError={loadError} navigate={navigate} />
  );
};

const PayrollRegister = ({ teachers, salaryPayments, loadError, navigate }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const currentMonthKey = getMonthKey(new Date());

  const rows = useMemo(() => (
    teachers.map((teacher) => {
      const teacherWithPayments = attachSalaryPayments(teacher, salaryPayments);
      const timeline = buildSalaryTimeline(teacherWithPayments);
      const currentEntry = timeline.find((entry) => entry.monthKey === currentMonthKey) || null;
      const pendingEntries = timeline.filter((entry) => !entry.isPaid);
      const paidEntries = timeline.filter((entry) => entry.isPaid);
      const teacherName = getTeacherName(teacher);
      const pendingAmount = pendingEntries.reduce((sum, entry) => sum + (Number(entry.baseSalary || entry.amount) || 0), 0);

      return {
        teacher,
        teacherName,
        currentEntry,
        status: currentEntry?.isPaid ? 'Paid' : 'Pending',
        paidCount: paidEntries.length,
        pendingCount: pendingEntries.length,
        pendingAmount,
      };
    })
  ), [currentMonthKey, salaryPayments, teachers]);

  const filteredRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== 'All' && row.status !== statusFilter) return false;
      if (!query) return true;
      return (
        row.teacherName.toLowerCase().includes(query) ||
        String(row.teacher.teacherSystemId || '').toLowerCase().includes(query) ||
        String(row.teacher.employeeId || '').toLowerCase().includes(query) ||
        String(row.teacher.assignedClass || '').toLowerCase().includes(query)
      );
    });
  }, [rows, searchTerm, statusFilter]);

  const monthlyPayroll = rows.reduce((sum, row) => sum + (Number(row.teacher.salary) || 0), 0);
  const paidThisMonth = rows.filter((row) => row.status === 'Paid').length;
  const pendingThisMonth = rows.filter((row) => row.status === 'Pending').length;
  const missingSalary = rows.filter((row) => !row.teacher.salary).length;

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
            <div className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_170px]">
              <SearchBox value={searchTerm} onChange={setSearchTerm} placeholder="Search teacher, ID, class..." />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white"
              >
                {['All', 'Paid', 'Pending'].map((option) => <option key={option}>{option}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
            <div className="hidden grid-cols-[1fr_1.2fr_0.9fr_0.9fr_0.8fr_0.8fr] gap-4 bg-slate-100 px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 lg:grid">
              <div>Teacher ID</div>
              <div>Name</div>
              <div>Class</div>
              <div>Monthly Salary</div>
              <div>Status</div>
              <div>Pending</div>
            </div>

            {filteredRows.length ? (
              <div className="divide-y divide-slate-200">
                {filteredRows.map((row) => (
                  <button
                    key={row.teacher.id}
                    type="button"
                    onClick={() => navigate(`/college/salary/${row.teacher.id}`)}
                    className="block w-full bg-white px-4 py-4 text-left transition hover:bg-emerald-50/70"
                  >
                    <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr_0.9fr_0.9fr_0.8fr_0.8fr] lg:items-center lg:gap-4">
                      <TableCell label="Teacher ID" value={row.teacher.teacherSystemId || row.teacher.employeeId || 'Pending'} strong />
                      <TableCell label="Name" value={row.teacherName} strong />
                      <TableCell label="Class" value={row.teacher.assignedClass || 'Not assigned'} />
                      <TableCell label="Monthly Salary" value={formatSalary(row.teacher.salary)} />
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
        </section>
      </main>
    </div>
  );
};

const TeacherPayrollDesk = ({ teacherId, teachers, salaryPayments, teacherAttendanceRecords, setSalaryPayments, loadError, setLoadError, navigate }) => {
  const [selectedMonth, setSelectedMonth] = useState(getMonthKey(new Date()));
  const [draft, setDraft] = useState({});

  const teacher = useMemo(
    () => teachers.find((entry) => String(entry.id) === String(teacherId)) || null,
    [teacherId, teachers],
  );

  const teacherWithPayments = useMemo(
    () => (teacher ? attachSalaryPayments(teacher, salaryPayments) : null),
    [salaryPayments, teacher],
  );
  const timeline = useMemo(() => (teacherWithPayments ? buildSalaryTimeline(teacherWithPayments) : []), [teacherWithPayments]);
  const selectedEntry = useMemo(
    () => timeline.find((entry) => entry.monthKey === selectedMonth) || null,
    [selectedMonth, timeline],
  );
  const previousPendingEntries = useMemo(
    () => (teacherWithPayments ? getPreviousPendingSalaryEntries(teacherWithPayments, selectedMonth) : []),
    [selectedMonth, teacherWithPayments],
  );
  const paidHistory = useMemo(() => timeline.filter((entry) => entry.isPaid), [timeline]);
  const previousPendingAmount = previousPendingEntries.reduce((sum, entry) => sum + (Number(entry.baseSalary) || 0), 0);
  const draftSalary = Number(draft.salary ?? teacher?.salary) || 0;
  const bonusAmount = Math.max(0, Number(draft.bonusAmount) || 0);
  const attendanceDeduction = useMemo(
    () => calculateTeacherAttendanceDeduction(teacher, selectedMonth, teacherAttendanceRecords),
    [selectedMonth, teacher, teacherAttendanceRecords],
  );
  const payableAmount = Math.max(0, draftSalary + previousPendingAmount + bonusAmount - attendanceDeduction.leaveDeductionAmount);

  const updateSalaryPaymentsState = (savedPayments) => {
    const savedList = Array.isArray(savedPayments) ? savedPayments : [savedPayments];
    setSalaryPayments((current) => {
      const savedKeys = new Set(savedList.map((entry) => `${entry.teacherId}-${entry.monthKey}`));
      return [
        ...current.filter((entry) => !savedKeys.has(`${entry.teacherId}-${entry.monthKey}`)),
        ...savedList,
      ];
    });
  };

  const handleMarkPaid = async () => {
    if (!teacher || !teacherWithPayments || !teacher.salary || selectedEntry?.isPaid) return;
    const paymentOptions = {
      bonusAmount: draft.bonusAmount,
      ...attendanceDeduction,
      note: draft.note,
    };
    const updatedTeacherPayload = markSalaryPaid(teacherWithPayments, selectedMonth, {
      ...paymentOptions,
    });
    const monthsToSave = new Set([selectedMonth, ...previousPendingEntries.map((entry) => entry.monthKey)]);
    const paymentPayloads = updatedTeacherPayload.paymentHistory
      .filter((entry) => monthsToSave.has(entry.monthKey))
      .map((entry) => toSalaryPaymentPayload(teacher.id, entry));

    try {
      const savedPayments = await Promise.all(paymentPayloads.map((payload) => salaryApi.savePayment(payload)));
      let noticeCreateError = '';
      try {
        await noticeApi.create(buildSalaryPaidNoticePayload({
          teacher,
          monthKey: selectedMonth,
          payableAmount,
          previousPendingAmount,
          bonusAmount,
          attendanceDeduction,
          note: draft.note,
        }));
      } catch (noticeError) {
        noticeCreateError = noticeError.message || 'Salary paid, but teacher notice could not be created.';
      }
      updateSalaryPaymentsState(savedPayments);
      setDraft({});
      setLoadError(noticeCreateError);
    } catch (error) {
      setLoadError(error.message || 'Unable to mark teacher salary as paid.');
    }
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
                  label={selectedEntry?.isPaid ? 'Already Paid' : 'Tap To Paid'}
                  onClick={handleMarkPaid}
                  disabled={!teacher.salary || selectedEntry?.isPaid}
                  full
                />
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
      `Teacher ID: ${teacher.teacherSystemId || teacher.employeeId || '-'}`,
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

export default SalaryManagement;
