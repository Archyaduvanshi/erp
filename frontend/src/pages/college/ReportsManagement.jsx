import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Banknote,
  BookOpen,
  CalendarDays,
  Download,
  GraduationCap,
  IndianRupee,
  Printer,
  Search,
  Shield,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  attendanceApi,
  feeApi,
  hostelApi,
  resultApi,
  salaryApi,
  studentApi,
  teacherApi,
} from '../../utils/api';

const ALL_VALUE = 'all';

const REPORT_TABS = [
  { key: 'students', label: 'Students', icon: Users },
  { key: 'fees', label: 'Fees', icon: IndianRupee },
  { key: 'salary', label: 'Salary', icon: Banknote },
  { key: 'attendance', label: 'Attendance', icon: CalendarDays },
  { key: 'results', label: 'Results', icon: BookOpen },
];

const ReportsManagement = () => {
  const navigate = useNavigate();
  const [session] = useState(() => JSON.parse(localStorage.getItem('active_session')) || null);
  const [activeTab, setActiveTab] = useState('students');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({ academicYear: ALL_VALUE, className: ALL_VALUE, month: ALL_VALUE, status: ALL_VALUE });
  const [loadError, setLoadError] = useState('');
  const [reports, setReports] = useState({
    students: [],
    teachers: [],
    attendance: [],
    feeStructures: [],
    feePayments: [],
    salaryPayments: [],
    resultClasses: [],
    hostelOverview: null,
  });

  useEffect(() => {
    if (!session || !['admin', 'feature'].includes(session.role)) {
      navigate('/login');
      return;
    }

    const loadReports = async () => {
      try {
        const [
          students,
          teachers,
          attendance,
          feeStructures,
          feePayments,
          salaryPayments,
          resultClasses,
          hostelOverview,
        ] = await Promise.all([
          studentApi.getAll(),
          teacherApi.getAll(),
          attendanceApi.getAll(),
          feeApi.getStructures(),
          feeApi.getPayments(),
          salaryApi.getPayments(),
          resultApi.getClasses(),
          hostelApi.getOverview(),
        ]);

        setReports({ students, teachers, attendance, feeStructures, feePayments, salaryPayments, resultClasses, hostelOverview });
        setLoadError('');
      } catch (error) {
        setLoadError(error.message || 'Unable to load reports from database.');
      }
    };

    loadReports();
  }, [navigate, session]);

  const filterOptions = useMemo(() => buildFilterOptions(reports), [reports]);
  const reportData = useMemo(() => buildReportData(reports, query, filters), [reports, query, filters]);
  const activeRows = reportData.tables[activeTab]?.rows || [];

  if (!session || !['admin', 'feature'].includes(session.role)) return null;

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-12 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-screen-2xl items-center gap-3 px-6 py-4 md:px-10">
          <button
            type="button"
            onClick={() => navigate('/college')}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700"
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-700">Reports</p>
            <h1 className="truncate text-2xl font-black tracking-tight text-slate-950">Visual Analytics</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-screen-2xl px-6 py-8 md:px-10">
        {loadError ? (
          <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {loadError}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={Users} label="Students" value={reportData.totals.students} helper={`${reportData.totals.classes} classes`} tone="emerald" />
          <MetricCard icon={Shield} label="Teachers" value={reportData.totals.teachers} helper={`${reportData.totals.activeTeachers} active`} tone="blue" />
          <MetricCard icon={IndianRupee} label="Fee Collected" value={formatCurrency(reportData.totals.feeCollected)} helper={`${formatCurrency(reportData.totals.feeBalance)} balance`} tone="rose" />
          <MetricCard icon={GraduationCap} label="Hostel Occupancy" value={`${reportData.totals.hostelOccupancy}%`} helper={`${reportData.totals.occupiedBeds}/${reportData.totals.totalBeds} beds`} tone="cyan" />
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SelectFilter label="Academic Year" value={filters.academicYear} options={filterOptions.academicYears} onChange={(value) => setFilters((current) => ({ ...current, academicYear: value }))} />
            <SelectFilter label="Class" value={filters.className} options={filterOptions.classNames} onChange={(value) => setFilters((current) => ({ ...current, className: value }))} />
            <SelectFilter label="Month" value={filters.month} options={filterOptions.months} onChange={(value) => setFilters((current) => ({ ...current, month: value }))} />
            <SelectFilter label="Status" value={filters.status} options={filterOptions.statuses} onChange={(value) => setFilters((current) => ({ ...current, status: value }))} />
          </div>
        </section>

        <section className="mt-6 grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
          <ChartPanel title="Finance Flow" subtitle="Collection, pending balance, salary paid, and leave deductions.">
            <StackedFinanceChart data={reportData.charts.financeMix} />
          </ChartPanel>
          <ChartPanel title="Attendance Gauge" subtitle="Present rate from marked attendance records.">
            <DonutGauge value={reportData.totals.attendancePercentage} label="Present" tone="emerald" />
          </ChartPanel>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-3">
          <ChartPanel title="Class Strength" subtitle="Student distribution by class.">
            <VerticalBars rows={reportData.charts.classStrength} valueLabel="students" tone="emerald" />
          </ChartPanel>
          <ChartPanel title="Attendance Status" subtitle="Present, absent, late, and leave split.">
            <SegmentChart rows={reportData.charts.attendanceStatus} />
          </ChartPanel>
          <ChartPanel title="Result Coverage" subtitle="Classes with saved result records.">
            <RingSummary
              value={reportData.totals.resultCoverage}
              primary={`${reportData.totals.resultClasses}/${Math.max(reportData.totals.classes, reportData.totals.resultClasses)}`}
              label="classes covered"
              tone="fuchsia"
            />
          </ChartPanel>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <ChartPanel title="Facility Capacity" subtitle="Hostel beds and active student facility choices.">
            <div className="grid gap-5 lg:grid-cols-2">
              <DonutGauge value={reportData.totals.hostelOccupancy} label="Beds Used" tone="cyan" />
              <HorizontalBars rows={reportData.charts.facilities} valueLabel="students" tone="blue" />
            </div>
          </ChartPanel>
          <ChartPanel title="Monthly Movement" subtitle="Month-wise fee collection and salary payout.">
            <GroupedMonthChart rows={reportData.charts.monthlyMovement} />
          </ChartPanel>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[1fr_0.9fr]">
          <ChartPanel title="Student Composition" subtitle="Gender and admission status distribution.">
            <div className="grid gap-5 lg:grid-cols-2">
              <SegmentChart rows={reportData.charts.genderSplit} />
              <SegmentChart rows={reportData.charts.studentStatus} />
            </div>
          </ChartPanel>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionTitle title="Quick Insights" text="Signals that need admin attention." />
            <div className="mt-5 grid gap-3">
              {reportData.insights.map((insight) => <InsightRow key={insight.title} {...insight} />)}
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              {REPORT_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.key);
                    setQuery('');
                  }}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] transition ${
                    activeTab === tab.key
                      ? 'bg-slate-950 text-white'
                      : 'border border-slate-200 bg-slate-50 text-slate-500 hover:border-emerald-300 hover:text-emerald-700'
                  }`}
                >
                  {React.createElement(tab.icon, { size: 14 })}
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <SearchBox value={query} onChange={setQuery} />
              <IconButton icon={Printer} label="Print" onClick={() => window.print()} enabled />
              <IconButton icon={Download} label="Export CSV" onClick={() => downloadCsv(`${activeTab}-report.csv`, activeRows)} enabled={activeRows.length > 0} />
            </div>
          </div>
          <ReportTable report={reportData.tables[activeTab]} emptyText={`No ${activeTab} report records found.`} />
        </section>
      </main>
    </div>
  );
};

const ChartPanel = ({ title, subtitle, children }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <SectionTitle title={title} text={subtitle} />
    <div className="mt-5">{children}</div>
  </section>
);

const MetricCard = ({ icon, label, value, helper, tone }) => {
  const tones = {
    emerald: 'bg-emerald-100 text-emerald-700',
    blue: 'bg-blue-100 text-blue-700',
    rose: 'bg-rose-100 text-rose-700',
    cyan: 'bg-cyan-100 text-cyan-700',
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${tones[tone]}`}>
        {React.createElement(icon, { size: 20 })}
      </div>
      <p className="mt-5 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 truncate text-2xl font-black tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 truncate text-xs font-bold text-slate-500">{helper}</p>
    </div>
  );
};

const StackedFinanceChart = ({ data }) => {
  const total = data.reduce((sum, row) => sum + row.value, 0);
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <div className="h-64">
        {total ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="label" innerRadius={64} outerRadius={96} paddingAngle={2}>
                {data.map((row) => <Cell key={row.label} fill={row.fill} />)}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        ) : <EmptyChart />}
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {data.map((row) => (
          <div key={row.label} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: row.fill }} />
              <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">{row.label}</span>
            </div>
            <p className="mt-2 text-lg font-black text-slate-950">{formatCurrency(row.value)}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const DonutGauge = ({ value, label, tone }) => {
  const colors = {
    emerald: '#10b981',
    cyan: '#0891b2',
    fuchsia: '#c026d3',
  };
  const chartValue = Math.max(0, Math.min(Number(value) || 0, 100));
  const color = colors[tone] || colors.emerald;

  return (
    <div className="relative flex min-h-60 items-center justify-center rounded-xl bg-slate-50">
      <ResponsiveContainer width="100%" height={240}>
        <RadialBarChart cx="50%" cy="50%" innerRadius="62%" outerRadius="86%" barSize={16} data={[{ name: label, value: chartValue, fill: color }]} startAngle={90} endAngle={-270}>
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar dataKey="value" cornerRadius={12} background={{ fill: '#e2e8f0' }} />
          <Tooltip formatter={(tooltipValue) => `${tooltipValue}%`} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-4xl font-black tracking-tight text-slate-950">{chartValue}%</p>
          <p className="mt-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
        </div>
      </div>
    </div>
  );
};

const RingSummary = ({ value, primary, label, tone }) => (
  <div className="grid min-h-60 place-items-center">
    <DonutGauge value={value} label={label} tone={tone} />
    <p className="-mt-10 text-center text-sm font-black text-slate-700">{primary}</p>
  </div>
);

const VerticalBars = ({ rows, valueLabel, tone }) => {
  const colors = {
    emerald: '#10b981',
    blue: '#3b82f6',
  };

  return (
    <div className="h-72 rounded-xl bg-slate-50 p-4">
      {rows.length ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 10, right: 10, left: -16, bottom: 28 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="label" angle={-24} textAnchor="end" interval={0} height={54} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }} />
            <YAxis tick={{ fontSize: 11, fill: '#64748b', fontWeight: 700 }} />
            <Tooltip formatter={(value) => [`${value} ${valueLabel}`, 'Total']} />
            <Bar dataKey="value" radius={[8, 8, 0, 0]} fill={colors[tone] || colors.emerald} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-full"><EmptyChart /></div>
      )}
    </div>
  );
};

const HorizontalBars = ({ rows, valueLabel, tone }) => {
  const color = tone === 'blue' ? '#3b82f6' : '#10b981';
  return (
    <div className="h-60 rounded-xl bg-slate-50 p-4">
      {rows.length ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={rows} margin={{ top: 8, right: 20, left: 16, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 700 }} />
            <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 700 }} width={78} />
            <Tooltip formatter={(value) => [`${value} ${valueLabel}`, 'Total']} />
            <Bar dataKey="value" radius={[0, 8, 8, 0]} fill={color} />
          </BarChart>
        </ResponsiveContainer>
      ) : <div className="flex h-full"><EmptyChart /></div>}
    </div>
  );
};

const SegmentChart = ({ rows }) => {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <div className="h-52">
        {total ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={rows} dataKey="value" nameKey="label" innerRadius={48} outerRadius={78} paddingAngle={2}>
                {rows.map((row) => <Cell key={row.label} fill={row.fill} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        ) : <EmptyChart />}
      </div>
      <div className="mt-4 grid gap-3">
        {rows.length ? rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: row.fill }} />
              <span className="truncate text-xs font-black uppercase tracking-[0.12em] text-slate-500">{row.label}</span>
            </div>
            <span className="text-xs font-black text-slate-950">{row.value}</span>
          </div>
        )) : <EmptyChart />}
      </div>
    </div>
  );
};

const GroupedMonthChart = ({ rows }) => {
  return (
    <div className="h-72 rounded-xl bg-slate-50 p-4">
      {rows.length ? (
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 10, right: 16, left: 4, bottom: 6 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 700 }} />
            <YAxis tickFormatter={(value) => compactNumber(value)} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 700 }} />
            <Tooltip formatter={(value) => formatCurrency(value)} />
            <Legend />
            <Bar dataKey="fees" name="Fee Collection" fill="#10b981" radius={[8, 8, 0, 0]} />
            <Bar dataKey="salary" name="Salary Paid" fill="#3b82f6" radius={[8, 8, 0, 0]} />
          </ComposedChart>
        </ResponsiveContainer>
      ) : <div className="flex h-full"><EmptyChart /></div>}
    </div>
  );
};

const ReportTable = ({ report, emptyText }) => (
  <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
    {report?.rows?.length ? (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-100">
            <tr>
              {report.columns.map((column) => (
                <th key={column.key} className="px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {report.rows.map((row, index) => (
              <tr key={row.id || index} className="hover:bg-emerald-50/50">
                {report.columns.map((column) => (
                  <td key={`${row.id || index}-${column.key}`} className="px-4 py-4 font-semibold text-slate-700">{row[column.key] ?? '-'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <div className="bg-slate-50 px-4 py-12 text-center text-sm font-semibold text-slate-500">{emptyText}</div>
    )}
  </div>
);

const InsightRow = ({ title, value, tone }) => {
  const tones = {
    good: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warn: 'border-amber-200 bg-amber-50 text-amber-700',
    danger: 'border-rose-200 bg-rose-50 text-rose-700',
    neutral: 'border-slate-200 bg-slate-50 text-slate-600',
  };
  return (
    <div className={`rounded-xl border px-4 py-3 ${tones[tone] || tones.neutral}`}>
      <p className="text-[11px] font-black uppercase tracking-[0.14em]">{title}</p>
      <p className="mt-1 text-sm font-black text-slate-950">{value}</p>
    </div>
  );
};

const SectionTitle = ({ title, text }) => (
  <div>
    <h2 className="text-lg font-black tracking-tight text-slate-950">{title}</h2>
    <p className="mt-1 text-sm leading-6 text-slate-500">{text}</p>
  </div>
);

const SelectFilter = ({ label, value, options, onChange }) => (
  <label className="block">
    <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</span>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-black text-slate-800 outline-none transition focus:border-emerald-500 focus:bg-white"
    >
      <option value={ALL_VALUE}>All</option>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  </label>
);

const SearchBox = ({ value, onChange }) => (
  <div className="relative min-w-72">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Search report..."
      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-10 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white"
    />
  </div>
);

const IconButton = ({ icon, label, onClick, enabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!enabled}
    className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-[11px] font-black uppercase tracking-[0.16em] transition ${
      enabled ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'cursor-not-allowed bg-slate-100 text-slate-400'
    }`}
  >
    {React.createElement(icon, { size: 14 })}
    {label}
  </button>
);

const EmptyChart = () => <p className="m-auto text-sm font-semibold text-slate-500">No chart data available.</p>;

const buildFilterOptions = (reports) => {
  const students = reports.students || [];
  const attendance = reports.attendance || [];
  const feePayments = reports.feePayments || [];
  const salaryPayments = reports.salaryPayments || [];
  return {
    academicYears: uniqueSorted(students.map((student) => student.academicYear)),
    classNames: uniqueSorted([
      ...students.map((student) => student.assignedClass || student.className),
      ...attendance.map((record) => record.className),
      ...(reports.resultClasses || []).map((entry) => entry.className),
    ]),
    months: uniqueSorted([
      ...feePayments.map((payment) => monthFromDate(payment.paymentDate || payment.createdAt)),
      ...salaryPayments.map((payment) => payment.monthKey || monthFromDate(payment.paidOn || payment.createdAt)),
      ...attendance.map((record) => monthFromDate(record.date)),
    ]),
    statuses: uniqueSorted([
      ...students.map((student) => student.status),
      ...attendance.map((record) => record.status),
      ...feePayments.map((payment) => payment.paymentStatus),
      'Pass',
      'Fail',
      'Pending',
    ]),
  };
};

const buildReportData = (reports, query, filters) => {
  const students = applySharedFilters(reports.students || [], filters, 'student');
  const teachers = applySharedFilters(reports.teachers || [], filters, 'teacher');
  const attendance = applySharedFilters(reports.attendance || [], filters, 'attendance');
  const feeStructures = reports.feeStructures || [];
  const feePayments = applySharedFilters(reports.feePayments || [], filters, 'fees');
  const salaryPayments = applySharedFilters(reports.salaryPayments || [], filters, 'salary');
  const resultClasses = applySharedFilters(reports.resultClasses || [], filters, 'results');
  const hostelOverview = reports.hostelOverview || {};
  const classNames = new Set(students.map((student) => student.assignedClass || student.className).filter(Boolean));
  const attendancePresent = attendance.filter((record) => normalize(record.status) === 'present').length;
  const attendanceMarked = attendance.length;
  const attendancePercentage = attendanceMarked ? Math.round((attendancePresent / attendanceMarked) * 100) : 0;
  const totalBeds = hostelOverview.totalBeds || 0;
  const hostelOccupancy = totalBeds ? Math.round(((hostelOverview.occupiedBeds || 0) / totalBeds) * 100) : 0;
  const denominatorClasses = Math.max(classNames.size, resultClasses.length);
  const resultCoverage = denominatorClasses ? Math.round((resultClasses.length / denominatorClasses) * 100) : 0;
  const feeCollected = sumBy(feePayments, 'paidAmount');
  const feeBalance = sumBy(feePayments, 'balanceRemaining');
  const salaryPaid = sumBy(salaryPayments, 'totalAmount');
  const leaveDeduction = sumBy(salaryPayments, 'leaveDeductionAmount');
  const search = query.trim().toLowerCase();
  const studentRows = students.map((student) => ({
    id: student.id,
    name: fullName(student),
    rollNo: student.rollNo || student.enrollmentNo || student.systemId || '-',
    className: student.assignedClass || student.className || '-',
    academicYear: student.academicYear || '-',
    status: student.status || 'Active',
    mobile: student.mobile || '-',
  }));

  return {
    totals: {
      students: students.length,
      teachers: teachers.length,
      activeTeachers: teachers.filter((teacher) => normalize(teacher.status || 'active') !== 'inactive').length,
      classes: classNames.size,
      resultClasses: resultClasses.length,
      resultCoverage,
      attendancePercentage,
      feeCollected,
      feeBalance,
      salaryPaid,
      feeStructures: feeStructures.length,
      hostelRooms: hostelOverview.totalRooms || 0,
      occupiedBeds: hostelOverview.occupiedBeds || 0,
      vacantBeds: hostelOverview.vacantBeds || 0,
      totalBeds,
      hostelOccupancy,
    },
    charts: {
      financeMix: [
        { label: 'Fee Collected', value: feeCollected, fill: '#10b981' },
        { label: 'Fee Balance', value: feeBalance, fill: '#f43f5e' },
        { label: 'Salary Paid', value: salaryPaid, fill: '#3b82f6' },
        { label: 'Leave Deduction', value: leaveDeduction, fill: '#f59e0b' },
      ],
      classStrength: topRows(countBy(students, (student) => student.assignedClass || student.className || 'Unassigned'), 8),
      attendanceStatus: withSegmentColors(countBy(attendance, (record) => record.status || 'Pending')),
      genderSplit: withSegmentColors(countBy(students, (student) => student.gender || 'Not Added')),
      studentStatus: withSegmentColors(countBy(students, (student) => student.status || 'Active')),
      facilities: [
        { label: 'Transport', value: countTruthy(students, 'transportOptIn') },
        { label: 'Hostel', value: countTruthy(students, 'hostelOptIn') },
        { label: 'Library', value: countTruthy(students, 'libraryOptIn') },
      ],
      monthlyMovement: buildMonthlyMovement(feePayments, salaryPayments),
    },
    insights: buildInsights({ students, teachers, attendancePercentage, feeBalance, hostelOccupancy, resultClasses }),
    tables: {
      students: {
        columns: [
          { key: 'name', label: 'Student' },
          { key: 'rollNo', label: 'Roll No' },
          { key: 'className', label: 'Class' },
          { key: 'academicYear', label: 'Academic Year' },
          { key: 'status', label: 'Status' },
          { key: 'mobile', label: 'Mobile' },
        ],
        rows: filterRows(studentRows, search),
      },
      fees: {
        columns: [
          { key: 'receiptNumber', label: 'Receipt' },
          { key: 'studentId', label: 'Student ID' },
          { key: 'paymentDate', label: 'Date' },
          { key: 'mode', label: 'Mode' },
          { key: 'paidAmount', label: 'Paid' },
          { key: 'balanceRemaining', label: 'Balance' },
          { key: 'paymentStatus', label: 'Status' },
        ],
        rows: filterRows(feePayments.map((payment) => ({
          id: payment.id,
          receiptNumber: payment.receiptNumber || payment.transactionId || '-',
          studentId: payment.studentId || '-',
          paymentDate: payment.paymentDate || '-',
          mode: payment.mode || '-',
          paidAmount: formatCurrency(payment.paidAmount),
          balanceRemaining: formatCurrency(payment.balanceRemaining),
          paymentStatus: payment.paymentStatus || '-',
        })), search),
      },
      salary: {
        columns: [
          { key: 'teacherId', label: 'Teacher ID' },
          { key: 'monthKey', label: 'Month' },
          { key: 'baseSalary', label: 'Base Salary' },
          { key: 'leaveDeductionAmount', label: 'Leave Deduction' },
          { key: 'totalAmount', label: 'Paid Amount' },
          { key: 'paidOn', label: 'Paid On' },
        ],
        rows: filterRows(salaryPayments.map((payment) => ({
          id: payment.id,
          teacherId: payment.teacherId || '-',
          monthKey: payment.monthKey || '-',
          baseSalary: formatCurrency(payment.baseSalary),
          leaveDeductionAmount: formatCurrency(payment.leaveDeductionAmount),
          totalAmount: formatCurrency(payment.totalAmount),
          paidOn: payment.paidOn || '-',
        })), search),
      },
      attendance: {
        columns: [
          { key: 'date', label: 'Date' },
          { key: 'studentName', label: 'Student' },
          { key: 'rollNo', label: 'Roll No' },
          { key: 'className', label: 'Class' },
          { key: 'subject', label: 'Subject' },
          { key: 'status', label: 'Status' },
          { key: 'markedBy', label: 'Marked By' },
        ],
        rows: filterRows(attendance.map((record) => ({
          id: record.id,
          date: record.date || '-',
          studentName: record.studentName || '-',
          rollNo: record.rollNo || '-',
          className: record.className || '-',
          subject: record.subject || '-',
          status: record.status || '-',
          markedBy: record.markedBy || '-',
        })), search),
      },
      results: {
        columns: [
          { key: 'className', label: 'Class' },
          { key: 'studentCount', label: 'Students' },
          { key: 'resultCount', label: 'Result Entries' },
          { key: 'subjectCount', label: 'Subjects' },
        ],
        rows: filterRows(resultClasses.map((entry) => ({
          id: entry.className,
          className: entry.className,
          studentCount: entry.studentCount,
          resultCount: entry.resultCount,
          subjectCount: entry.subjectCount,
        })), search),
      },
    },
  };
};

const applySharedFilters = (rows, filters, type) => rows.filter((row) => {
  if (filters.academicYear !== ALL_VALUE && type === 'student' && row.academicYear !== filters.academicYear) return false;
  if (filters.className !== ALL_VALUE && getReportClass(row, type) !== filters.className) return false;
  if (filters.month !== ALL_VALUE && getReportMonth(row, type) !== filters.month) return false;
  if (filters.status !== ALL_VALUE && getReportStatus(row, type).toLowerCase() !== filters.status.toLowerCase()) return false;
  return true;
});

const getReportClass = (row, type) => {
  if (type === 'student') return row.assignedClass || row.className || '';
  if (type === 'attendance' || type === 'results') return row.className || '';
  return '';
};

const getReportMonth = (row, type) => {
  if (type === 'fees') return monthFromDate(row.paymentDate || row.createdAt);
  if (type === 'salary') return row.monthKey || monthFromDate(row.paidOn || row.createdAt);
  if (type === 'attendance') return monthFromDate(row.date);
  return '';
};

const getReportStatus = (row, type) => {
  if (type === 'fees') return row.paymentStatus || '';
  if (type === 'attendance' || type === 'student') return row.status || '';
  return '';
};

const buildInsights = ({ students, teachers, attendancePercentage, feeBalance, hostelOccupancy, resultClasses }) => [
  {
    title: attendancePercentage >= 85 ? 'Attendance Healthy' : 'Attendance Needs Review',
    value: `${attendancePercentage}% present from marked records`,
    tone: attendancePercentage >= 85 ? 'good' : attendancePercentage >= 70 ? 'warn' : 'danger',
  },
  {
    title: feeBalance > 0 ? 'Pending Fee Balance' : 'Fee Balance Clear',
    value: formatCurrency(feeBalance),
    tone: feeBalance > 0 ? 'warn' : 'good',
  },
  {
    title: 'Academic Coverage',
    value: `${resultClasses.length} classes have result records`,
    tone: resultClasses.length ? 'good' : 'neutral',
  },
  {
    title: 'Staff Ratio',
    value: teachers.length ? `${Math.round(students.length / teachers.length)} students per teacher` : 'No teacher records',
    tone: teachers.length ? 'neutral' : 'warn',
  },
  {
    title: hostelOccupancy >= 90 ? 'Hostel Near Full' : 'Hostel Capacity',
    value: `${hostelOccupancy}% beds occupied`,
    tone: hostelOccupancy >= 90 ? 'warn' : 'good',
  },
];

const buildMonthlyMovement = (feePayments, salaryPayments) => {
  const months = uniqueSorted([
    ...feePayments.map((payment) => monthFromDate(payment.paymentDate || payment.createdAt)),
    ...salaryPayments.map((payment) => payment.monthKey || monthFromDate(payment.paidOn || payment.createdAt)),
  ]).slice(-6);

  return months.map((month) => ({
    month,
    fees: sumBy(feePayments.filter((payment) => monthFromDate(payment.paymentDate || payment.createdAt) === month), 'paidAmount'),
    salary: sumBy(salaryPayments.filter((payment) => (payment.monthKey || monthFromDate(payment.paidOn || payment.createdAt)) === month), 'totalAmount'),
  }));
};

const withSegmentColors = (map) => {
  const colors = [
    '#10b981',
    '#3b82f6',
    '#f59e0b',
    '#f43f5e',
    '#c026d3',
  ];
  return [...map.entries()].map(([label, value], index) => ({
    label,
    value,
    fill: colors[index % colors.length],
  }));
};

const filterRows = (rows, search) => (
  search ? rows.filter((row) => Object.values(row).some((value) => String(value || '').toLowerCase().includes(search))) : rows
);

const uniqueSorted = (values) => [...new Set(values.filter(Boolean).map(String))].sort((a, b) => a.localeCompare(b));

const countBy = (rows, getKey) => rows.reduce((map, row) => {
  const key = getKey(row);
  map.set(key, (map.get(key) || 0) + 1);
  return map;
}, new Map());

const countTruthy = (rows, key) => rows.filter((row) => ['yes', 'true', 'active', 'enabled'].includes(normalize(row[key]))).length;

const topRows = (map, limit) => [...map.entries()]
  .map(([label, value]) => ({ label, value }))
  .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
  .slice(0, limit);

const sumBy = (rows, key) => rows.reduce((sum, row) => sum + (Number(row?.[key]) || 0), 0);

const fullName = (person) => `${person.firstName || ''} ${person.lastName || ''}`.trim() || person.name || 'Unnamed';

const monthFromDate = (value) => {
  const text = String(value || '');
  const match = text.match(/\d{4}-\d{2}/);
  return match ? match[0] : '';
};

const normalize = (value) => String(value || '').trim().toLowerCase();

const formatCurrency = (value) => {
  const amount = Number(value) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
};

const compactNumber = (value) => new Intl.NumberFormat('en-IN', {
  notation: 'compact',
  maximumFractionDigits: 1,
}).format(Number(value) || 0);

const downloadCsv = (fileName, rows) => {
  if (!rows.length) return;
  const columns = Object.keys(rows[0]).filter((key) => key !== 'id');
  const csvRows = [
    columns.join(','),
    ...rows.map((row) => columns.map((column) => escapeCsvValue(row[column])).join(',')),
  ];
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
};

const escapeCsvValue = (value) => {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export default ReportsManagement;
