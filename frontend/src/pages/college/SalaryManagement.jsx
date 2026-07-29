import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, IndianRupee, MinusCircle, PlusCircle, Save, Search, Wallet } from 'lucide-react';
import { db } from '../../utils/db';
import { teacherApi } from '../../utils/api';
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

const useSalaryTeachers = (navigate) => {
  const [session] = useState(() => JSON.parse(localStorage.getItem('active_session')) || null);
  const [collegeId] = useState(() => localStorage.getItem('current_college_id'));
  const [teachers, setTeachers] = useState(() => db.getAll('teachers').map(normalizeTeacherSalary));
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!session || session.role !== 'admin' || !collegeId) {
      navigate('/login');
      return;
    }

    const loadTeachers = async () => {
      try {
        const apiTeachers = await teacherApi.getAll();
        if (apiTeachers.length === 0) {
          const localTeachers = db.getAll('teachers');
          if (localTeachers.length > 0) {
            const importedTeachers = await teacherApi.import(localTeachers);
            db.replaceAll('teachers', importedTeachers);
            setTeachers(importedTeachers.map(normalizeTeacherSalary));
            setLoadError('');
            return;
          }
        }

        db.replaceAll('teachers', apiTeachers);
        setTeachers(apiTeachers.map(normalizeTeacherSalary));
        setLoadError('');
      } catch (error) {
        setTeachers(db.getAll('teachers').map(normalizeTeacherSalary));
        setLoadError(error.message || 'Unable to load teachers from the server.');
      }
    };

    loadTeachers();
  }, [collegeId, navigate, session]);

  return { collegeId, loadError, setLoadError, session, teachers, setTeachers };
};

const SalaryManagement = () => {
  const navigate = useNavigate();
  const { teacherId } = useParams();
  const data = useSalaryTeachers(navigate);

  if (!data.session || data.session.role !== 'admin' || !data.collegeId) return null;

  return teacherId
    ? <SalaryTeacherDetails {...data} teacherId={teacherId} navigate={navigate} />
    : <SalaryRegisterList {...data} navigate={navigate} />;
};

const SalaryRegisterList = ({ teachers, loadError, navigate }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const selectedMonth = getMonthKey(new Date());

  const filteredTeachers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return teachers.filter((teacher) => {
      if (!query) return true;
      const fullName = `${teacher.firstName || ''} ${teacher.lastName || ''}`.toLowerCase();
      return (
        fullName.includes(query) ||
        String(teacher.teacherSystemId || '').toLowerCase().includes(query) ||
        String(teacher.employeeId || '').toLowerCase().includes(query)
      );
    });
  }, [searchTerm, teachers]);

  const rows = useMemo(() => (
    filteredTeachers.map((teacher) => {
      const monthEntry = buildSalaryTimeline(teacher).find((entry) => entry.monthKey === selectedMonth) || null;
      return {
        teacher,
        status: monthEntry?.isPaid ? 'Paid' : 'Pending',
      };
    })
  ), [filteredTeachers, selectedMonth]);

  return (
    <div className="min-h-screen bg-slate-50 pb-12 text-slate-900">
      <PageHeader
        title="Teacher Salary Register"
        subtitle="Salary Management"
        onBack={() => navigate('/college')}
      />

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        {loadError ? (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {loadError}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          <SimpleStat label="Total Teachers" value={String(rows.length)} />
          <SimpleStat label="Paid This Month" value={String(rows.filter((row) => row.status === 'Paid').length)} />
          <SimpleStat label="Pending This Month" value={String(rows.filter((row) => row.status === 'Pending').length)} />
        </div>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-950">All Teachers</h2>
              <p className="text-sm text-slate-500">Click any teacher row to open full salary details.</p>
            </div>

            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search teacher, teacher ID..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-10 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500 focus:bg-white"
              />
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            <div className="hidden grid-cols-[1fr_1.2fr_0.9fr_0.7fr] gap-4 bg-slate-100 px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-600 md:grid">
              <div>Teacher ID</div>
              <div>Teacher Name</div>
              <div>Salary</div>
              <div>Status</div>
            </div>

            {rows.length ? (
              <div className="divide-y divide-slate-200">
                {rows.map(({ teacher, status }) => {
                  const teacherName = `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim() || 'Unnamed teacher';

                  return (
                    <button
                      key={teacher.id}
                      type="button"
                      onClick={() => navigate(`/college/salary/${teacher.id}`)}
                      className="w-full bg-white px-4 py-4 text-left transition hover:bg-emerald-50"
                    >
                      <div className="grid gap-3 md:grid-cols-[1fr_1.2fr_0.9fr_0.7fr] md:items-center md:gap-4">
                        <RowInfo label="Teacher ID" value={teacher.teacherSystemId || teacher.employeeId || 'Pending'} />
                        <RowInfo label="Teacher Name" value={teacherName} />
                        <RowInfo label="Salary" value={formatSalary(teacher.salary)} />
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 md:hidden">Status</p>
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {status}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="px-4 py-10 text-center text-sm text-slate-500">
                No teacher record found.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

const SalaryTeacherDetails = ({ teacherId, teachers, setTeachers, loadError, setLoadError, navigate }) => {
  const [selectedMonth, setSelectedMonth] = useState(getMonthKey(new Date()));
  const [draft, setDraft] = useState({});

  const teacher = useMemo(
    () => teachers.find((entry) => String(entry.id) === String(teacherId)) || null,
    [teacherId, teachers],
  );

  const selectedMonthEntry = useMemo(
    () => (teacher ? buildSalaryTimeline(teacher).find((entry) => entry.monthKey === selectedMonth) || null : null),
    [selectedMonth, teacher],
  );
  const timeline = useMemo(() => (teacher ? buildSalaryTimeline(teacher) : []), [teacher]);
  const salaryHistory = useMemo(
    () => timeline.filter((entry) => entry.isPaid),
    [timeline],
  );
  const previousPendingEntries = useMemo(
    () => (teacher ? getPreviousPendingSalaryEntries(teacher, selectedMonth) : []),
    [selectedMonth, teacher],
  );
  const autoPendingAmount = previousPendingEntries.reduce((sum, entry) => sum + (Number(entry.baseSalary) || 0), 0);
  const bonusAmount = Math.max(0, Number(draft.bonusAmount) || 0);
  const advanceAmount = Math.max(0, Number(draft.advanceAmount) || 0);
  const totalPayable = Math.max(
    0,
    (Number(teacher?.salary) || 0) + autoPendingAmount + bonusAmount - advanceAmount,
  );

  const updateTeachersState = (updatedTeacher) => {
    const updatedTeachers = teachers.map((entry) => (entry.id === updatedTeacher.id ? updatedTeacher : entry));
    db.replaceAll('teachers', updatedTeachers);
    setTeachers(updatedTeachers.map(normalizeTeacherSalary));
  };

  const handleSaveCompensation = async () => {
    if (!teacher) return;
    const nextSalary = Number(draft.salary ?? teacher.salary);
    const nextJoiningDate = draft.joiningDate || teacher.joiningDate;

    try {
      const updatedTeacher = await teacherApi.update(teacher.id, {
        ...teacher,
        salary: Number.isFinite(nextSalary) && nextSalary > 0 ? nextSalary : '',
        joiningDate: nextJoiningDate,
      });
      updateTeachersState(updatedTeacher);
      setDraft((current) => ({
        bonusAmount: current.bonusAmount || '',
        advanceAmount: current.advanceAmount || '',
        note: current.note || '',
      }));
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Unable to update teacher compensation.');
    }
  };

  const handleMarkPaid = async () => {
    if (!teacher) return;
    const updatedTeacherPayload = markSalaryPaid(teacher, selectedMonth, {
      bonusAmount: draft.bonusAmount,
      advanceAmount: draft.advanceAmount,
      note: draft.note,
    });

    try {
      const updatedTeacher = await teacherApi.update(teacher.id, updatedTeacherPayload);
      updateTeachersState(updatedTeacher);
      setDraft({});
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Unable to mark teacher salary as paid.');
    }
  };

  if (!teacher) {
    return (
      <div className="min-h-screen bg-slate-50 pb-12 text-slate-900">
        <PageHeader
          title="Teacher Salary Details"
          subtitle="Salary Management"
          backLabel="Back To Register"
          onBack={() => navigate('/college/salary')}
        />
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
            Teacher record not found.
          </div>
        </div>
      </div>
    );
  }

  const teacherName = `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim() || 'Teacher';

  return (
    <div className="min-h-screen bg-slate-50 pb-12 text-slate-900">
      <PageHeader
        title={teacherName}
        subtitle="Teacher Salary Details"
        backLabel="Back To Register"
        onBack={() => navigate('/college/salary')}
        rightContent={(
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-500 sm:w-auto"
          />
        )}
      />

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {loadError ? (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {loadError}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SimpleStat label="Monthly Salary" value={formatSalary(teacher.salary)} />
          <SimpleStat label="Previous Pending" value={formatCurrencyAmount(autoPendingAmount)} />
          <SimpleStat label="Total Payable" value={formatCurrencyAmount(totalPayable)} />
          <SimpleStat label="This Month" value={selectedMonthEntry?.isPaid ? 'Paid' : 'Pending'} />
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold text-slate-950">Teacher Summary</h2>
            <div className="mt-4 space-y-3 text-sm">
              <DetailRow label="Teacher ID" value={teacher.teacherSystemId || 'Pending'} />
              <DetailRow label="Employee ID" value={teacher.employeeId || 'Not added'} />
              <DetailRow label="Class" value={teacher.assignedClass || 'Not assigned'} />
              <DetailRow label="Joining Date" value={teacher.joiningDate || 'Not added'} />
              <DetailRow label="Selected Month" value={getMonthLabel(selectedMonth)} />
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <CompactField
                label="Base Salary"
                input={(
                  <input
                    type="number"
                    min="0"
                    value={draft.salary ?? teacher.salary}
                    onChange={(e) => setDraft((current) => ({ ...current, salary: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                    placeholder="35000"
                  />
                )}
              />
              <CompactField
                label="Joining Date"
                input={(
                  <input
                    type="date"
                    value={draft.joiningDate ?? teacher.joiningDate}
                    onChange={(e) => setDraft((current) => ({ ...current, joiningDate: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  />
                )}
              />
              <CompactInfo
                label="Previous Pending"
                value={formatCurrencyAmount(autoPendingAmount)}
                hint={previousPendingEntries.length
                  ? `${previousPendingEntries.length} month${previousPendingEntries.length > 1 ? 's' : ''} pending`
                  : 'No previous due'}
              />
              <CompactInfo
                label="Current Status"
                value={selectedMonthEntry?.isPaid ? 'Paid' : 'Pending'}
                hint={getMonthLabel(selectedMonth)}
              />
              <CompactField
                label="Bonus"
                input={(
                  <input
                    type="number"
                    min="0"
                    value={draft.bonusAmount ?? ''}
                    onChange={(e) => setDraft((current) => ({ ...current, bonusAmount: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                    placeholder="0"
                  />
                )}
              />
              <CompactField
                label="Advance"
                input={(
                  <input
                    type="number"
                    min="0"
                    value={draft.advanceAmount ?? ''}
                    onChange={(e) => setDraft((current) => ({ ...current, advanceAmount: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                    placeholder="0"
                  />
                )}
              />
              <CompactField
                label="Note"
                input={(
                  <textarea
                    value={draft.note ?? ''}
                    onChange={(e) => setDraft((current) => ({ ...current, note: e.target.value }))}
                    placeholder="Optional note"
                    className="min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  />
                )}
              />
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleSaveCompensation}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                <Save size={16} />
                Save Compensation
              </button>
              <button
                type="button"
                onClick={handleMarkPaid}
                disabled={!teacher.salary || selectedMonthEntry?.isPaid}
                className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold ${
                  !teacher.salary || selectedMonthEntry?.isPaid
                    ? 'cursor-not-allowed bg-slate-200 text-slate-400'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                <CheckCircle2 size={16} />
                {selectedMonthEntry?.isPaid ? 'Already Paid' : 'Mark Salary Paid'}
              </button>
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-950">Pay Breakdown</h2>
              <div className="mt-4 space-y-2 text-sm">
                <BreakdownRow icon={IndianRupee} label="Base salary" value={formatCurrencyAmount((draft.salary ?? teacher.salary) || 0)} positive />
                <BreakdownRow icon={Wallet} label="Previous unpaid salary" value={formatCurrencyAmount(autoPendingAmount)} positive />
                <BreakdownRow icon={PlusCircle} label="Bonus" value={formatCurrencyAmount(bonusAmount)} positive />
                <BreakdownRow icon={MinusCircle} label="Advance deduction" value={formatCurrencyAmount(advanceAmount)} />
                <BreakdownRow icon={CheckCircle2} label="Final payable" value={formatCurrencyAmount(totalPayable)} positive />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-950">Salary Timeline</h2>
              <div className="mt-4 space-y-2">
                {timeline.length ? (
                  timeline.slice(0, 8).map((entry) => (
                    <div key={entry.monthKey} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-slate-800">{entry.label}</span>
                        <span className={`text-xs font-semibold ${entry.isPaid ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {entry.isPaid ? 'Paid' : 'Pending'}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{formatCurrencyAmount(entry.totalAmount || entry.amount)}</p>
                      {(entry.previousPendingAmount || entry.bonusAmount || entry.advanceAmount) ? (
                        <p className="mt-1 text-xs text-slate-500">
                          Pending {formatCurrencyAmount(entry.previousPendingAmount)} | Bonus {formatCurrencyAmount(entry.bonusAmount)} | Advance {formatCurrencyAmount(entry.advanceAmount)}
                        </p>
                      ) : null}
                      {entry.note ? <p className="mt-1 text-xs text-slate-500">{entry.note}</p> : null}
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
                    No salary timeline available.
                  </div>
                )}
              </div>
            </section>
          </aside>
        </div>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-950">Salary History</h2>
              <p className="text-sm text-slate-500">Previously paid salary records for this teacher.</p>
            </div>
            <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
              {salaryHistory.length} Paid Record{salaryHistory.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="mt-5">
            {salaryHistory.length ? (
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse bg-white">
                    <thead>
                      <tr className="bg-emerald-50">
                        <th className="border-b border-r border-slate-200 px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.16em] text-slate-600">S.No</th>
                        <th className="border-b border-r border-slate-200 px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.16em] text-slate-600">Salary Month</th>
                        <th className="border-b border-r border-slate-200 px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.16em] text-slate-600">Paid Amount</th>
                        <th className="border-b border-r border-slate-200 px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.16em] text-slate-600">Base Salary</th>
                        <th className="border-b border-r border-slate-200 px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.16em] text-slate-600">Previous Pending</th>
                        <th className="border-b border-r border-slate-200 px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.16em] text-slate-600">Bonus</th>
                        <th className="border-b border-r border-slate-200 px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.16em] text-slate-600">Advance</th>
                        <th className="border-b border-r border-slate-200 px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.16em] text-slate-600">Paid On</th>
                        <th className="border-b border-r border-slate-200 px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.16em] text-slate-600">Settled Months</th>
                        <th className="border-b border-slate-200 px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.16em] text-slate-600">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salaryHistory.map((entry, index) => (
                        <tr key={entry.monthKey} className="align-top odd:bg-white even:bg-slate-50">
                          <td className="border-b border-r border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600">{index + 1}</td>
                          <td className="border-b border-r border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">{entry.label}</td>
                          <td className="border-b border-r border-slate-200 px-4 py-3 text-sm font-semibold text-emerald-700">{formatCurrencyAmount(entry.totalAmount || entry.amount)}</td>
                          <td className="border-b border-r border-slate-200 px-4 py-3 text-sm text-slate-700">{formatCurrencyAmount(entry.baseSalary)}</td>
                          <td className="border-b border-r border-slate-200 px-4 py-3 text-sm text-slate-700">{formatCurrencyAmount(entry.previousPendingAmount)}</td>
                          <td className="border-b border-r border-slate-200 px-4 py-3 text-sm text-slate-700">{formatCurrencyAmount(entry.bonusAmount)}</td>
                          <td className="border-b border-r border-slate-200 px-4 py-3 text-sm text-slate-700">{formatCurrencyAmount(entry.advanceAmount)}</td>
                          <td className="border-b border-r border-slate-200 px-4 py-3 text-sm text-slate-700">{entry.paidOn ? new Date(entry.paidOn).toLocaleDateString('en-IN') : 'Not available'}</td>
                          <td className="border-b border-r border-slate-200 px-4 py-3 text-sm text-slate-700">
                            {entry.settledMonthKeys?.length
                              ? entry.settledMonthKeys.map((monthKey) => getMonthLabel(monthKey)).join(', ')
                              : '-'}
                          </td>
                          <td className="border-b border-slate-200 px-4 py-3 text-sm text-slate-700">{entry.note || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                No paid salary history available yet.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

const PageHeader = ({ title, subtitle, onBack, backLabel = 'Dashboard', rightContent = null }) => (
  <div className="border-b border-slate-200 bg-white">
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <button
          onClick={onBack}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700 sm:px-4"
        >
          <ArrowLeft size={16} />
          {backLabel}
        </button>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-emerald-700">{subtitle}</p>
          <h1 className="truncate text-xl font-bold text-slate-950 sm:text-2xl">{title}</h1>
        </div>
      </div>
      {rightContent}
    </div>
  </div>
);

const SimpleStat = ({ label, value }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <p className="text-sm font-medium text-slate-500">{label}</p>
    <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
  </div>
);

const RowInfo = ({ label, value }) => (
  <div className="min-w-0">
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 md:hidden">{label}</p>
    <p className="truncate text-sm font-medium text-slate-900">{value}</p>
  </div>
);

const DetailRow = ({ label, value }) => (
  <div className="flex flex-col gap-1 rounded-xl bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
    <span className="text-slate-500">{label}</span>
    <span className="font-medium text-slate-900">{value}</span>
  </div>
);

const BreakdownRow = ({ icon: Icon, label, value, positive = false }) => (
  <div className="flex flex-col gap-2 rounded-xl bg-slate-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
    <div className="flex items-center gap-2 text-slate-600">
      <Icon size={15} className={positive ? 'text-emerald-600' : 'text-slate-500'} />
      <span>{label}</span>
    </div>
    <span className="font-semibold text-slate-900">{value}</span>
  </div>
);

const CompactField = ({ label, input }) => (
  <div className="rounded-xl bg-slate-50 p-3">
    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
    {input}
  </div>
);

const CompactInfo = ({ label, value, hint }) => (
  <div className="rounded-xl bg-slate-50 p-3">
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
    <p className="mt-2 text-sm font-bold text-slate-950">{value}</p>
    {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
  </div>
);

export default SalaryManagement;
