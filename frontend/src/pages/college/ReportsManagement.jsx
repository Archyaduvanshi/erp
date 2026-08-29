import { AlertCircle, BarChart3, ListFilter, Save, Table2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { academicSessionApi, reportApi } from '../../utils/api';
import ReportCategoryTabs from '../../components/report/ReportCategoryTabs';
import ReportChart from '../../components/report/ReportChart';
import ReportEmptyState from '../../components/report/ReportEmptyState';
import ReportFilters from '../../components/report/ReportFilters';
import ReportHeader from '../../components/report/ReportHeader';
import ReportInsights from '../../components/report/ReportInsights';
import ReportKpis from '../../components/report/ReportKpis';
import ReportTable from '../../components/report/ReportTable';
import { exportRows } from '../../utils/report/reportExport';
import { ALL_VALUE, withColors } from '../../utils/report/reportFormatters';

const categories = [
  { id: 'overview', label: 'Overview' },
  { id: 'students', label: 'Students' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'fees', label: 'Fees' },
  { id: 'results', label: 'Examination & Results' },
  { id: 'teachers', label: 'Teachers' },
  { id: 'salary', label: 'Salary' },
  { id: 'timetable', label: 'Timetable' },
  { id: 'library', label: 'Library' },
  { id: 'transport', label: 'Transport' },
  { id: 'hostel', label: 'Hostel' },
  { id: 'holidays', label: 'Holidays' },
];

const defaultFilters = { dateRange: ALL_VALUE, threshold: 75, search: '' };
const reportCatalog = {
  students: [
    { id: 'student-summary', title: 'Student Summary', description: 'Student analytics from aggregate database queries.' },
    { id: 'class-strength', title: 'Class & Section Strength', description: 'Class strength grouped in PostgreSQL.' },
    { id: 'gender-distribution', title: 'Gender Distribution', description: 'Gender distribution grouped in PostgreSQL.' },
    { id: 'student-directory', title: 'Student Directory', description: 'Paginated lightweight student directory.' },
  ],
  attendance: [
    { id: 'attendance-summary', title: 'Attendance Summary', description: 'Attendance summary from saved attendance entries.' },
    { id: 'monthly-attendance', title: 'Monthly Attendance', description: 'Monthly attendance trend from one aggregate query.' },
    { id: 'class-attendance', title: 'Class Attendance', description: 'Class-wise attendance trend from one aggregate query.' },
    { id: 'low-attendance', title: 'Low Attendance', description: 'Students below configured threshold.' },
    { id: 'absentees', title: 'Absentee Report', description: 'Paginated absentee records for the selected date or range.' },
  ],
  fees: [
    { id: 'fee-summary', title: 'Fee Summary', description: 'Fee totals from charge and payment allocation aggregates.' },
    { id: 'daily-fee-collections', title: 'Daily Collections', description: 'Daily fee collections from backend aggregates.' },
    { id: 'monthly-fee-collections', title: 'Monthly Collections', description: 'Monthly fee collections from backend aggregates.' },
    { id: 'fee-payment-modes', title: 'Payment Modes', description: 'Fee collections grouped by payment mode.' },
    { id: 'fee-outstanding', title: 'Outstanding Fees', description: 'Outstanding fees by class from backend ledger query.' },
  ],
  results: [
    { id: 'result-summary', title: 'Result Summary', description: 'Result summary from uploaded marks aggregates.' },
    { id: 'class-performance', title: 'Class Performance', description: 'Class performance grouped in PostgreSQL.' },
    { id: 'subject-performance', title: 'Subject Performance', description: 'Subject performance grouped in PostgreSQL.' },
    { id: 'pass-fail', title: 'Pass / Fail Analysis', description: 'Pass/fail distribution from backend pass policy.' },
    { id: 'top-performers', title: 'Top Performers', description: 'Top student ranking calculated in PostgreSQL.' },
    { id: 'needs-attention', title: 'Students Needing Attention', description: 'Students below pass threshold.' },
  ],
  teachers: [
    { id: 'teacher-summary', title: 'Teacher Summary', description: 'Teacher totals from aggregate queries.' },
    { id: 'teacher-subject-distribution', title: 'Subject Distribution', description: 'Teacher distribution by subject.' },
    { id: 'teacher-directory', title: 'Teacher Directory', description: 'Paginated lightweight teacher directory.' },
  ],
  salary: [
    { id: 'salary-summary', title: 'Salary Summary', description: 'Salary obligation and payment aggregates.' },
    { id: 'salary-payments-monthly', title: 'Monthly Salary Payments', description: 'Monthly salary payments grouped in PostgreSQL.' },
    { id: 'salary-payments-teacher', title: 'Teacher Salary Payments', description: 'Salary payments grouped by teacher.' },
    { id: 'salary-outstanding', title: 'Salary Outstanding', description: 'Outstanding payroll periods from backend aggregates.' },
  ],
  timetable: [
    { id: 'timetable-summary', title: 'Timetable Summary', description: 'Timetable totals from period rows.' },
    { id: 'period-distribution', title: 'Period Distribution', description: 'Period distribution by day.' },
  ],
  library: [
    { id: 'library-summary', title: 'Library Summary', description: 'Library totals from books and issues.' },
    { id: 'library-issues', title: 'Library Issues', description: 'Paginated issue report.' },
  ],
  transport: [
    { id: 'transport-summary', title: 'Transport Summary', description: 'Transport totals from aggregate queries.' },
    { id: 'transport-routes', title: 'Route Distribution', description: 'Transport route distribution.' },
  ],
  hostel: [
    { id: 'hostel-summary', title: 'Hostel Summary', description: 'Hostel capacity and occupancy from aggregate queries.' },
    { id: 'hostel-occupancy', title: 'Room Occupancy', description: 'Paginated room occupancy report.' },
  ],
  holidays: [
    { id: 'holiday-summary', title: 'Holiday Summary', description: 'Holiday totals from saved records.' },
    { id: 'holiday-types', title: 'Holiday Types', description: 'Holiday distribution by type.' },
  ],
};

export default function ReportsManagement() {
  const queryClient = useQueryClient();
  const [activeCategory, setActiveCategory] = useState('overview');
  const [selectedReport, setSelectedReport] = useState('overview-dashboard');
  const [filters, setFilters] = useState(defaultFilters);
  const [view, setView] = useState('chart');
  const [snapshotMessage, setSnapshotMessage] = useState('');
  const [reportPage, setReportPage] = useState(0);
  const [reportPageSize, setReportPageSize] = useState(25);
  const debouncedSearch = useDebouncedValue(filters.search || '', 350);

  const sessionsQuery = useQuery({
    queryKey: ['reports', 'academic-sessions'],
    queryFn: () => academicSessionApi.getAll(),
    staleTime: 5 * 60 * 1000,
  });

  const activeSession = useMemo(() => (
    sessionsQuery.data?.find((session) => session.current) || sessionsQuery.data?.[0] || null
  ), [sessionsQuery.data]);

  const [academicSessionId, setAcademicSessionId] = useState('');

  useEffect(() => {
    if (!academicSessionId && activeSession?.id) {
      setAcademicSessionId(String(activeSession.id));
    }
  }, [academicSessionId, activeSession?.id]);

  const commonParams = useMemo(() => ({
    academicSessionId: academicSessionId || undefined,
  }), [academicSessionId]);

  const selectedReportKey = activeCategory === 'overview'
    ? 'overview-dashboard'
    : selectedReport || reportCatalog[activeCategory]?.[0]?.id;

  const reportParams = useMemo(() => buildReportParams({
    ...commonParams,
    ...filters,
    search: debouncedSearch,
    page: reportPage,
    size: reportPageSize,
  }), [commonParams, debouncedSearch, filters, reportPage, reportPageSize]);

  const overviewQuery = useQuery({
    queryKey: ['reports', 'overview', commonParams],
    queryFn: () => reportApi.getOverview(commonParams),
    enabled: Boolean(academicSessionId),
    staleTime: 60 * 1000,
  });

  const reportQuery = useQuery({
    queryKey: ['reports', activeCategory, selectedReportKey, reportParams],
    queryFn: () => reportApi.getReport(activeCategory, selectedReportKey, reportParams),
    enabled: activeCategory !== 'overview' && Boolean(academicSessionId) && Boolean(selectedReportKey),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  });

  const saveSnapshotMutation = useMutation({
    mutationFn: (payload) => reportApi.saveSnapshot(payload),
    onSuccess: () => {
      setSnapshotMessage('Snapshot saved.');
      queryClient.invalidateQueries({ queryKey: ['reports', 'snapshots'] });
    },
    onError: (error) => setSnapshotMessage(error.message || 'Unable to save snapshot.'),
  });

  const reports = useMemo(() => {
    if (activeCategory === 'overview') {
      return [buildOverviewReport(overviewQuery.data)];
    }
    return normalizeReports(reportCatalog[activeCategory] || []);
  }, [activeCategory, overviewQuery.data]);

  const reportShell = reports.find((item) => item.id === selectedReportKey) || reports[0] || null;
  const reportData = activeCategory === 'overview' ? reportShell : normalizeReport(reportQuery.data);
  const report = reportData ? { ...reportData, ...(reportShell || {}), ...reportData, id: reportShell?.id || reportData.id, title: reportShell?.title || reportData.title, description: reportData.description || reportShell?.description } : reportShell;
  const loading = overviewQuery.isLoading || sessionsQuery.isLoading || (activeCategory !== 'overview' && reportQuery.isLoading);
  const error = overviewQuery.error || sessionsQuery.error || reportQuery.error;

  useEffect(() => {
    const firstReport = reports[0];
    if (firstReport && !reports.some((item) => item.id === selectedReport)) {
      setSelectedReport(firstReport.id);
    }
  }, [reports, selectedReport]);

  const handleCategoryChange = (categoryId) => {
    setActiveCategory(categoryId);
    setSelectedReport(categoryId === 'overview' ? 'overview-dashboard' : reportCatalog[categoryId]?.[0]?.id || '');
    setFilters(defaultFilters);
    setReportPage(0);
    setSnapshotMessage('');
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['reports'] });
  };

  const handleExport = async (format) => {
    if (!report) return;
    if (format === 'print' || format === 'pdf' || activeCategory === 'overview') {
      exportRows(format, report.title.toLowerCase().replace(/\s+/g, '-'), report.rows || [], report.columns || []);
      return;
    }
    const exportData = await reportApi.exportReport(activeCategory, report.id, { ...reportParams, page: undefined, size: undefined });
    exportRows(format, report.title.toLowerCase().replace(/\s+/g, '-'), exportData.rows || [], exportData.columns || []);
  };

  const handleSaveSnapshot = () => {
    if (!report) return;
    const limitedRows = (report.rows || []).slice(0, 100);
    saveSnapshotMutation.mutate({
      category: activeCategory,
      reportKey: report.id,
      title: report.title,
      filtersJson: JSON.stringify({ ...filters, academicSessionId }),
      kpisJson: JSON.stringify(report.kpis || []),
      chartsJson: JSON.stringify(report.charts || []),
      rowsJson: JSON.stringify(limitedRows),
      rowCount: limitedRows.length,
      generatedAt: new Date().toISOString().replace('Z', ''),
    });
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f4f7fb_0%,#eef4ff_55%,#f9fbff_100%)] font-sans text-slate-900 selection:bg-cyan-500 selection:text-slate-950">
      <ReportHeader
        title="Reports & Analytics"
        subtitle="Live operational reports from saved ERP database records."
        onRefresh={handleRefresh}
        onExport={handleExport}
        loading={loading || reportQuery.isFetching || overviewQuery.isFetching}
      />
      <ReportCategoryTabs categories={categories} activeCategory={activeCategory} onChange={handleCategoryChange} />

      <main className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        {error ? (
          <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em]"><AlertCircle className="h-4 w-4" /> Some data could not be loaded</div>
            <p className="mt-1">{error.message || 'Unable to load report data.'}</p>
          </div>
        ) : null}

        <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {reports.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSelectedReport(item.id);
                  setReportPage(0);
                }}
                className={`rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] transition ${
                  report?.id === item.id ? 'bg-cyan-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-cyan-50 hover:text-cyan-800'
                }`}
              >
                {item.title}
              </button>
            ))}

            <select
              value={academicSessionId}
              onChange={(event) => setAcademicSessionId(event.target.value)}
              className="ml-auto h-9 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-black uppercase tracking-[0.14em] text-slate-600 outline-none transition hover:border-cyan-300 focus:border-cyan-500"
            >
              {(sessionsQuery.data || []).map((session) => (
                <option key={session.id} value={session.id}>{session.name || session.academicYear || session.year || `Session ${session.id}`}</option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleSaveSnapshot}
              disabled={!report || saveSnapshotMutation.isPending}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-black uppercase tracking-[0.14em] text-slate-600 transition hover:border-cyan-300 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              Save Snapshot
            </button>

            <div className="flex rounded-full bg-slate-100 p-1">
              <button type="button" onClick={() => setView('chart')} className={`rounded-full p-2 ${view === 'chart' ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-500'}`} title="Chart view">
                <BarChart3 className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setView('table')} className={`rounded-full p-2 ${view === 'table' ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-500'}`} title="Table view">
                <Table2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          {snapshotMessage ? <p className="mt-2 text-xs font-bold text-cyan-700">{snapshotMessage}</p> : null}
        </section>

        {report ? (
          <>
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
              <ListFilter className="h-4 w-4 text-cyan-700" />
              {report.description}
            </div>
            <ReportFilters
              filters={report.filters || []}
              values={filters}
              options={{}}
              onChange={(key, value) => {
                setReportPage(0);
                setFilters((current) => ({ ...current, [key]: value }));
              }}
              onReset={() => {
                setReportPage(0);
                setFilters(defaultFilters);
              }}
            />
            <ReportKpis items={report.kpis || []} />
            <ReportInsights insights={report.insights || []} />
            {loading ? (
              <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-500 shadow-sm">Loading reports...</div>
            ) : (report.rows || []).length ? (
              view === 'chart' ? (
                <div className="grid gap-5 xl:grid-cols-2">
                  {(report.charts?.length ? report.charts : [{ title: report.title, data: report.chartRows }]).map((chart) => (
                    <ReportChart key={chart.title} {...chart} />
                  ))}
                </div>
              ) : (
                <ReportTable
                  rows={report.rows || []}
                  columns={report.columns || []}
                  title={report.title}
                  pagination={report.page}
                  onPageChange={setReportPage}
                  onPageSizeChange={(size) => {
                    setReportPageSize(size);
                    setReportPage(0);
                  }}
                />
              )
            ) : (
              <ReportEmptyState />
            )}
          </>
        ) : (
          <ReportEmptyState title="Report Not Available" message="No database-backed report is available for this category yet." />
        )}
      </main>
    </div>
  );
}

function normalizeReports(reports) {
  return Array.isArray(reports) ? reports.map((report) => ({
    ...report,
    rows: Array.isArray(report.rows) ? report.rows : [],
    columns: Array.isArray(report.columns) ? report.columns : [],
    charts: Array.isArray(report.charts) ? report.charts : [],
    kpis: Array.isArray(report.kpis) ? report.kpis : [],
    filters: Array.isArray(report.filters) ? report.filters : [],
  })) : [];
}

function normalizeReport(report) {
  if (!report) return null;
  return normalizeReports([report])[0];
}

function buildReportParams(params) {
  const next = { ...params };
  const range = expandDateRange(next.dateRange);
  delete next.dateRange;
  if (range.dateFrom) next.dateFrom = range.dateFrom;
  if (range.dateTo) next.dateTo = range.dateTo;
  Object.keys(next).forEach((key) => {
    if (next[key] === undefined || next[key] === null || next[key] === '' || next[key] === ALL_VALUE) {
      delete next[key];
    }
  });
  return next;
}

function expandDateRange(value) {
  if (!value || value === ALL_VALUE) return {};
  const today = new Date();
  const end = new Date(today);
  const start = new Date(today);

  if (value === 'yesterday') {
    start.setDate(today.getDate() - 1);
    end.setDate(today.getDate() - 1);
  } else if (value === 'last7') {
    start.setDate(today.getDate() - 6);
  } else if (value === 'last30') {
    start.setDate(today.getDate() - 29);
  } else if (value === 'thisMonth') {
    start.setDate(1);
  } else if (value === 'previousMonth') {
    start.setMonth(today.getMonth() - 1, 1);
    end.setDate(0);
  } else if (value !== 'today') {
    return {};
  }

  return { dateFrom: formatDate(start), dateTo: formatDate(end) };
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildOverviewReport(data) {
  const rows = [
    { label: 'Students', value: data?.students?.total || 0 },
    { label: 'Teachers', value: data?.teachers?.total || 0 },
    { label: 'Attendance %', value: data?.attendance?.attendancePercentage || 0 },
    { label: 'Fee Collected', value: data?.fees?.totalCollected || 0 },
    { label: 'Salary Outstanding', value: data?.salary?.outstanding || 0 },
    { label: 'Library Issued', value: data?.library?.issuedBooks || 0 },
    { label: 'Transport Students', value: data?.transport?.assignedStudents || 0 },
    { label: 'Hostel Occupied', value: data?.hostel?.occupied || 0 },
  ];

  return {
    id: 'overview-dashboard',
    title: 'Overview Dashboard',
    description: 'One lightweight backend overview request. Category details lazy-load only when opened.',
    filters: [],
    rows,
    columns: [{ key: 'label', label: 'Area' }, { key: 'value', label: 'Value' }],
    chartRows: withColors(rows),
    charts: [{ title: 'Overview', type: 'bar', data: withColors(rows), xLabel: 'Area', yLabel: 'Value' }],
    kpis: rows.slice(0, 4).map((row) => ({ label: row.label, value: row.value })),
    insights: [
      'Reports page no longer loads every ERP module on open.',
      'Attendance, Results, Fees, Salary, and other categories are fetched only when selected.',
      'Snapshots are saved only through the explicit Save Snapshot action.',
    ],
  };
}

function useDebouncedValue(value, delay = 350) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timeoutId);
  }, [value, delay]);

  return debouncedValue;
}
