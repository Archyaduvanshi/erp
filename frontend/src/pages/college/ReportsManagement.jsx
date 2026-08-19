import { AlertCircle, BarChart3, ListFilter, Table2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  attendanceApi,
  examApi,
  feeApi,
  holidayApi,
  hostelApi,
  libraryApi,
  marksApi,
  reportApi,
  salaryApi,
  studentApi,
  teacherApi,
  timetableApi,
  transportApi,
} from '../../utils/api';
import ReportCategoryTabs from '../../components/report/ReportCategoryTabs';
import ReportChart from '../../components/report/ReportChart';
import ReportEmptyState from '../../components/report/ReportEmptyState';
import ReportFilters from '../../components/report/ReportFilters';
import ReportHeader from '../../components/report/ReportHeader';
import ReportInsights from '../../components/report/ReportInsights';
import ReportKpis from '../../components/report/ReportKpis';
import ReportTable from '../../components/report/ReportTable';
import { exportRows } from '../../utils/report/reportExport';
import {
  ALL_VALUE,
  countBy,
  dateKey,
  formatCurrency,
  formatPercent,
  fullName,
  inDateRange,
  mapToChartRows,
  monthKey,
  normalize,
  sumBy,
  uniqueSorted,
  withColors,
} from '../../utils/report/reportFormatters';

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

const initialData = {
  students: [],
  teachers: [],
  attendance: [],
  feeClasses: [],
  feeStructures: [],
  feePayments: [],
  salaries: [],
  marks: [],
  dateSheets: [],
  timetables: [],
  books: [],
  issues: [],
  drivers: [],
  transportAssignments: [],
  transportAttendance: [],
  hostelOverview: null,
  hostels: [],
  rooms: [],
  residents: [],
  holidays: [],
  reportSnapshots: [],
};

const loaders = {
  students: () => studentApi.getAll(),
  teachers: () => teacherApi.getAll(),
  attendance: () => attendanceApi.getAll(),
  feeClasses: () => feeApi.getClasses(),
  feeStructures: () => feeApi.getStructures(),
  feePayments: () => feeApi.getPayments(),
  salaries: () => salaryApi.getPayments(),
  marks: () => marksApi.getAll(),
  dateSheets: () => examApi.getDateSheets(),
  timetables: () => timetableApi.getClassTimetables(),
  books: () => libraryApi.getBooks(),
  issues: () => libraryApi.getIssues(),
  drivers: () => transportApi.getDrivers(),
  transportAssignments: () => transportApi.getAssignments(),
  transportAttendance: () => transportApi.getAttendance(),
  hostelOverview: () => hostelApi.getOverview(),
  hostels: () => hostelApi.getHostels(),
  rooms: () => hostelApi.getRooms(),
  residents: () => hostelApi.getResidents(),
  holidays: () => holidayApi.getAll(),
  reportSnapshots: () => reportApi.getSnapshots(),
};

const columns = {
  student: [
    { key: 'name', label: 'Student' },
    { key: 'className', label: 'Class' },
    { key: 'section', label: 'Section' },
    { key: 'rollNo', label: 'Roll No' },
    { key: 'gender', label: 'Gender' },
    { key: 'status', label: 'Status' },
  ],
  attendance: [
    { key: 'date', label: 'Date' },
    { key: 'studentName', label: 'Student' },
    { key: 'className', label: 'Class' },
    { key: 'status', label: 'Status' },
    { key: 'percentage', label: 'Attendance %' },
  ],
  fees: [
    { key: 'studentName', label: 'Student' },
    { key: 'className', label: 'Class' },
    { key: 'amount', label: 'Amount' },
    { key: 'paid', label: 'Paid' },
    { key: 'pending', label: 'Pending' },
    { key: 'paymentMode', label: 'Mode' },
    { key: 'date', label: 'Date' },
  ],
  marks: [
    { key: 'studentName', label: 'Student' },
    { key: 'className', label: 'Class' },
    { key: 'subjectName', label: 'Subject' },
    { key: 'examTitle', label: 'Exam' },
    { key: 'marksObtained', label: 'Marks' },
    { key: 'maxMarks', label: 'Max' },
    { key: 'percentage', label: '%' },
    { key: 'status', label: 'Status' },
  ],
  teacher: [
    { key: 'name', label: 'Teacher' },
    { key: 'subject', label: 'Subject' },
    { key: 'department', label: 'Department' },
    { key: 'phone', label: 'Phone' },
    { key: 'salary', label: 'Salary' },
    { key: 'status', label: 'Status' },
  ],
  salary: [
    { key: 'teacherName', label: 'Teacher' },
    { key: 'month', label: 'Month' },
    { key: 'baseSalary', label: 'Base Salary' },
    { key: 'deduction', label: 'Deduction' },
    { key: 'paidAmount', label: 'Paid' },
    { key: 'paymentDate', label: 'Date' },
    { key: 'status', label: 'Status' },
  ],
  simple: [
    { key: 'label', label: 'Name' },
    { key: 'value', label: 'Value' },
  ],
};

const apiTitle = (key) => key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());
const getStatus = (value) => String(value || 'Active');
const match = (value, selected) => selected === ALL_VALUE || normalize(value) === normalize(selected);
const getPaymentDate = (row) => row?.paymentDate || row?.paidDate || row?.date || row?.createdAt;
const getAttendanceDate = (row) => row?.date || row?.attendanceDate || row?.createdAt;
const getAttendanceStudentId = (row) => row?.studentId || row?.student?.id;
const isPresent = (row) => ['present', 'p', 'half day', 'late'].includes(normalize(row?.status));
const isReturned = (issue) => Boolean(issue?.returnDate);

export default function ReportsManagement() {
  const [activeCategory, setActiveCategory] = useState('overview');
  const [selectedReport, setSelectedReport] = useState('overview-dashboard');
  const [filters, setFilters] = useState({ dateRange: ALL_VALUE, threshold: 75 });
  const [view, setView] = useState('chart');
  const [data, setData] = useState(initialData);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const lastSavedReportKey = useRef('');

  const loadData = async () => {
    setLoading(true);
    const entries = await Promise.allSettled(
      Object.entries(loaders).map(([key, loader]) => loader().then((value) => [key, value]))
    );

    const nextData = { ...initialData };
    const nextErrors = {};
    entries.forEach((entry, index) => {
      const key = Object.keys(loaders)[index];
      if (entry.status === 'fulfilled') {
        const [fulfilledKey, value] = entry.value;
        nextData[fulfilledKey] = Array.isArray(value) || value == null ? value || [] : value;
      } else {
        nextErrors[key] = entry.reason?.message || `Unable to load ${apiTitle(key)}`;
      }
    });
    setData(nextData);
    setErrors(nextErrors);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const options = useMemo(() => buildOptions(data), [data]);
  const reports = useMemo(() => buildReports(data, filters), [data, filters]);
  const currentReports = reports[activeCategory] || [];
  const report = currentReports.find((item) => item.id === selectedReport) || currentReports[0];

  useEffect(() => {
    if (loading || !report?.id) return undefined;

    const snapshot = serializeReportSnapshot(activeCategory, report, filters);
    const snapshotKey = `${snapshot.category}:${snapshot.reportKey}:${snapshot.filtersJson}:${snapshot.rowCount}:${snapshot.rowsJson.length}`;
    if (lastSavedReportKey.current === snapshotKey) return undefined;

    const timeoutId = window.setTimeout(() => {
      reportApi.saveSnapshot(snapshot)
        .then((savedSnapshot) => {
          lastSavedReportKey.current = snapshotKey;
          setData((current) => ({
            ...current,
            reportSnapshots: [savedSnapshot, ...(current.reportSnapshots || [])].slice(0, 50),
          }));
        })
        .catch(() => null);
    }, 900);

    return () => window.clearTimeout(timeoutId);
  }, [activeCategory, filters, loading, report]);

  useEffect(() => {
    const firstReport = reports[activeCategory]?.[0];
    if (firstReport && !reports[activeCategory].some((item) => item.id === selectedReport)) {
      setSelectedReport(firstReport.id);
      setFilters({ dateRange: ALL_VALUE, threshold: 75 });
    }
  }, [activeCategory, reports, selectedReport]);

  const handleCategoryChange = (categoryId) => {
    setActiveCategory(categoryId);
    setFilters({ dateRange: ALL_VALUE, threshold: 75 });
  };

  const handleExport = (format) => {
    if (!report) return;
    exportRows(format, report.title.toLowerCase().replace(/\s+/g, '-'), report.rows, report.columns);
  };

  const applyDrillDown = (row) => {
    if (report?.drillDown) setFilters((current) => ({ ...current, ...report.drillDown(row) }));
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f4f7fb_0%,#eef4ff_55%,#f9fbff_100%)] font-sans text-slate-900 selection:bg-cyan-500 selection:text-slate-950">
      <ReportHeader
        title="Reports & Analytics"
        subtitle="Live operational reports from saved ERP database records."
        onRefresh={loadData}
        onExport={handleExport}
        loading={loading}
      />
      <ReportCategoryTabs categories={categories} activeCategory={activeCategory} onChange={handleCategoryChange} />

      <main className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        {Object.keys(errors).length ? (
          <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em]"><AlertCircle className="h-4 w-4" /> Some data could not be loaded</div>
            <p className="mt-1">{Object.keys(errors).map(apiTitle).join(', ')}</p>
          </div>
        ) : null}

        <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {currentReports.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedReport(item.id)}
                className={`rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] transition ${
                  report?.id === item.id ? 'bg-cyan-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-cyan-50 hover:text-cyan-800'
                }`}
              >
                {item.title}
              </button>
            ))}
            <div className="ml-auto flex rounded-full bg-slate-100 p-1">
              <button type="button" onClick={() => setView('chart')} className={`rounded-full p-2 ${view === 'chart' ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-500'}`} title="Chart view">
                <BarChart3 className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setView('table')} className={`rounded-full p-2 ${view === 'table' ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-500'}`} title="Table view">
                <Table2 className="h-4 w-4" />
              </button>
            </div>
          </div>
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
              options={options}
              onChange={(key, value) => setFilters((current) => ({ ...current, [key]: value }))}
              onReset={() => setFilters({ dateRange: ALL_VALUE, threshold: 75 })}
            />
            <ReportKpis items={report.kpis} />
            <ReportInsights insights={report.insights} />
            {loading ? (
              <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-500 shadow-sm">Loading reports...</div>
            ) : report.rows.length ? (
              view === 'chart' ? (
                <div className="grid gap-5 xl:grid-cols-2">
                  {(report.charts?.length ? report.charts : [{ title: report.title, data: report.chartRows }]).map((chart) => (
                    <ReportChart key={chart.title} {...chart} onPointClick={applyDrillDown} />
                  ))}
                </div>
              ) : (
                <ReportTable rows={report.rows} columns={report.columns} title={report.title} />
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

function buildOptions(data) {
  return {
    className: uniqueSorted(data.students.map((student) => student.className || student.assignedClass).concat(data.marks.map((mark) => mark.className))),
    section: uniqueSorted(data.students.map((student) => student.section)),
    gender: uniqueSorted(data.students.map((student) => student.gender)),
    status: uniqueSorted(data.students.map((student) => getStatus(student.status))),
    student: uniqueSorted(data.students.map(fullName)),
    teacher: uniqueSorted(data.teachers.map(fullName).concat(data.salaries.map((row) => row.teacherName))),
    subject: uniqueSorted(data.marks.map((mark) => mark.subjectName).concat(data.teachers.map((teacher) => teacher.subject))),
    exam: uniqueSorted(data.marks.map((mark) => mark.examTitle).concat(data.dateSheets.map((exam) => exam.examType))),
    month: uniqueSorted(data.feePayments.map((row) => monthKey(getPaymentDate(row))).concat(data.salaries.map((row) => row.month || monthKey(row.paymentDate)))),
    paymentMode: uniqueSorted(data.feePayments.map((row) => row.paymentMode || row.mode)),
    paymentStatus: uniqueSorted(data.feePayments.map((row) => row.status)),
    feeType: uniqueSorted(data.feeStructures.map((row) => row.feeType || row.name || row.title)),
    hostel: uniqueSorted(data.hostels.map((row) => row.hostelName)),
    room: uniqueSorted(data.rooms.map((row) => row.roomNumber)),
    book: uniqueSorted(data.books.map((row) => row.title)),
    issueStatus: [
      { value: 'issued', label: 'Issued' },
      { value: 'returned', label: 'Returned' },
      { value: 'overdue', label: 'Overdue' },
    ],
    driver: uniqueSorted(data.drivers.map((row) => row.driverName)),
    route: uniqueSorted(data.drivers.map((row) => row.routeName).concat(data.transportAssignments.map((row) => row.routeName))),
    holidayType: uniqueSorted(data.holidays.map((row) => row.holidayType)),
    audience: uniqueSorted(data.holidays.map((row) => row.audience)),
  };
}

function buildReports(data, filters) {
  const students = filteredStudents(data.students, filters);
  const attendance = filteredAttendance(data.attendance, filters);
  const feeRows = buildFeeRows(data, filters);
  const markRows = filteredMarks(data.marks, filters);
  const teacherRows = filteredTeachers(data.teachers, filters);
  const salaryRows = filteredSalaries(data, filters);
  const timetableRows = buildTimetableRows(data.timetables, filters);
  const libraryRows = buildLibraryRows(data, filters);
  const transportRows = buildTransportRows(data, filters);
  const hostelRows = buildHostelRows(data, filters);
  const holidayRows = filteredHolidays(data.holidays, filters);

  return {
    overview: [overviewReport(data, { students, attendance, feeRows, markRows, teacherRows, salaryRows, libraryRows, transportRows, hostelRows, holidayRows })],
    students: [
      simpleReport('student-directory', 'Student Directory', students.map(toStudentRow), columns.student, 'Students', 'Number of Students'),
      groupedReport('class-strength', 'Class & Section Strength', students, (row) => `${row.className || row.assignedClass || 'Not Added'} ${row.section || ''}`.trim(), 'Students', 'Number of Students', { className: 'label' }),
      groupedReport('gender-distribution', 'Gender Distribution', students, (row) => row.gender, 'Gender', 'Number of Students', { gender: 'label' }, 'donut'),
      groupedReport('student-status', 'Student Status', students, (row) => getStatus(row.status), 'Status', 'Number of Students', { status: 'label' }, 'donut'),
      groupedReport('admission-analysis', 'Admission Analysis', students, (row) => monthKey(row.admissionDate || row.createdAt), 'Admission Month', 'Number of Students', {}, 'line'),
      simpleReport('facility-enrollment', 'Facility Enrollment', buildFacilityRows(data), columns.simple, 'Facility', 'Number of Students'),
      simpleReport('documents-pending', 'Documents Pending', students.filter((row) => !row.fileUploadPath && !row.documentsJson).map(toStudentRow), columns.student, 'Students', 'Pending Documents'),
    ],
    attendance: [
      attendanceSummary('daily-attendance', 'Daily Attendance', attendance, 'date'),
      attendanceSummary('monthly-attendance', 'Monthly Attendance', attendance, 'month'),
      attendanceSummary('class-attendance', 'Class Attendance', attendance, 'className'),
      studentAttendanceReport(attendance, students, Number(filters.threshold) || 75),
      lowAttendanceReport(attendance, students, Number(filters.threshold) || 75),
      absenteeReport(attendance),
    ],
    fees: [
      simpleReport('fee-collection', 'Collection Summary', feeRows, columns.fees, 'Students', 'Amount'),
      amountGroupReport('daily-collection', 'Daily Collection', feeRows, (row) => row.date, 'Payment Date', 'Amount Collected'),
      amountGroupReport('monthly-collection', 'Monthly Collection', feeRows, (row) => row.month, 'Payment Month', 'Amount Collected', 'area'),
      simpleReport('pending-fees', 'Pending Fees', feeRows.filter((row) => row.pending > 0), columns.fees, 'Students', 'Pending Amount'),
      simpleReport('fee-defaulters', 'Fee Defaulters', feeRows.filter((row) => row.pending > 0 && !row.paid), columns.fees, 'Students', 'Pending Amount'),
      groupedReport('payment-mode-analysis', 'Payment Mode Analysis', feeRows.filter((row) => row.paid > 0), (row) => row.paymentMode, 'Payment Mode', 'Payments', { paymentMode: 'label' }, 'donut'),
      amountGroupReport('class-wise-collection', 'Class-wise Collection', feeRows, (row) => row.className, 'Class', 'Amount Collected'),
      amountGroupReport('fee-type-collection', 'Fee Type Collection', feeRows, (row) => row.feeType, 'Fee Type', 'Amount Collected'),
    ],
    results: [
      simpleReport('marks-ledger', 'Marks Ledger', markRows.map(toMarkRow), columns.marks, 'Students', 'Marks'),
      resultGroupReport('overall-result', 'Overall Result', markRows, (row) => row.examTitle, 'Exam', 'Average Percentage'),
      resultGroupReport('class-performance', 'Class Performance', markRows, (row) => row.className, 'Class', 'Average Percentage'),
      resultGroupReport('subject-performance', 'Subject Performance', markRows, (row) => row.subjectName, 'Subject', 'Average Percentage', 'horizontal'),
      passFailReport(markRows),
      topPerformersReport(markRows),
      needingAttentionReport(markRows),
    ],
    teachers: [
      simpleReport('teacher-directory', 'Teacher Directory', teacherRows.map(toTeacherRow), columns.teacher, 'Teachers', 'Number of Teachers'),
      groupedReport('active-teachers', 'Active Teachers', teacherRows.filter((row) => normalize(row.status) !== 'inactive'), (row) => row.subject || row.department, 'Subject', 'Active Teachers'),
      groupedReport('department-distribution', 'Subject / Department Distribution', teacherRows, (row) => row.department || row.subject, 'Department', 'Teachers', {}, 'donut'),
      groupedReport('joining-analysis', 'Joining Analysis', teacherRows, (row) => monthKey(row.joiningDate || row.createdAt), 'Joining Month', 'Teachers', {}, 'line'),
    ],
    salary: [
      simpleReport('salary-ledger', 'Teacher Salary Ledger', salaryRows, columns.salary, 'Teachers', 'Salary Paid'),
      amountGroupReport('monthly-payroll', 'Monthly Payroll', salaryRows, (row) => row.month, 'Month', 'Paid Salary', 'area', 'paidAmount'),
      simpleReport('paid-salaries', 'Paid Salaries', salaryRows.filter((row) => normalize(row.status) === 'paid' || row.paidAmount > 0), columns.salary, 'Teachers', 'Paid Salary'),
      simpleReport('pending-salaries', 'Pending Salaries', buildPendingSalaryRows(data, filters), columns.salary, 'Teachers', 'Pending Salary'),
    ],
    timetable: [
      simpleReport('class-timetable', 'Class Timetable', timetableRows, [{ key: 'className', label: 'Class' }, { key: 'day', label: 'Day' }, { key: 'period', label: 'Period' }, { key: 'subject', label: 'Subject' }, { key: 'teacher', label: 'Teacher' }], 'Periods', 'Scheduled Periods'),
      groupedReport('weekly-periods', 'Weekly Period Distribution', timetableRows, (row) => row.day, 'Day', 'Periods'),
      groupedReport('subject-periods', 'Subject Period Distribution', timetableRows, (row) => row.subject, 'Subject', 'Periods', { subject: 'label' }, 'horizontal'),
      groupedReport('teacher-periods', 'Teacher Timetable', timetableRows, (row) => row.teacher, 'Teacher', 'Periods', { teacher: 'label' }, 'horizontal'),
    ],
    library: [
      simpleReport('library-inventory', 'Library Inventory', libraryRows.books, [{ key: 'title', label: 'Book' }, { key: 'author', label: 'Author' }, { key: 'format', label: 'Format' }, { key: 'availableQuantity', label: 'Available' }, { key: 'activeIssues', label: 'Issued' }], 'Books', 'Copies'),
      simpleReport('issued-books', 'Issued Books', libraryRows.issues.filter((row) => row.status === 'Issued'), [{ key: 'bookTitle', label: 'Book' }, { key: 'borrowerName', label: 'Borrower' }, { key: 'issueDate', label: 'Issue Date' }, { key: 'dueDate', label: 'Due Date' }, { key: 'status', label: 'Status' }], 'Books', 'Issued'),
      simpleReport('overdue-books', 'Overdue Books', libraryRows.issues.filter((row) => row.status === 'Overdue'), [{ key: 'bookTitle', label: 'Book' }, { key: 'borrowerName', label: 'Borrower' }, { key: 'dueDate', label: 'Due Date' }, { key: 'status', label: 'Status' }], 'Books', 'Overdue'),
      groupedReport('most-borrowed-books', 'Most Borrowed Books', libraryRows.issues, (row) => row.bookTitle, 'Book', 'Issues', { book: 'label' }, 'horizontal'),
    ],
    transport: [
      simpleReport('transport-students', 'Transport Students', transportRows.assignments, [{ key: 'studentName', label: 'Student' }, { key: 'className', label: 'Class' }, { key: 'pickupStop', label: 'Stop' }, { key: 'driverName', label: 'Driver' }, { key: 'routeName', label: 'Route' }, { key: 'busNumber', label: 'Bus' }], 'Students', 'Assigned Students'),
      simpleReport('driver-directory', 'Driver Directory', transportRows.drivers, [{ key: 'driverName', label: 'Driver' }, { key: 'driverPhone', label: 'Phone' }, { key: 'busNumber', label: 'Bus' }, { key: 'routeName', label: 'Route' }, { key: 'seatCapacity', label: 'Seats' }, { key: 'status', label: 'Status' }], 'Drivers', 'Vehicles'),
      groupedReport('route-assignments', 'Driver Assignments', transportRows.assignments, (row) => row.routeName || row.driverName, 'Route', 'Students', { route: 'label' }),
      groupedReport('transport-attendance', 'Transport Attendance', transportRows.attendance, (row) => row.status, 'Status', 'Students', {}, 'donut'),
    ],
    hostel: [
      simpleReport('resident-list', 'Resident List', hostelRows.residents, [{ key: 'studentName', label: 'Student' }, { key: 'className', label: 'Class' }, { key: 'hostelName', label: 'Hostel' }, { key: 'roomNumber', label: 'Room' }, { key: 'bedNumber', label: 'Bed' }, { key: 'messFood', label: 'Mess Food' }], 'Residents', 'Students'),
      groupedReport('hostel-occupancy', 'Hostel-wise Occupancy', hostelRows.hostels, (row) => row.hostelName, 'Hostel', 'Occupied Beds'),
      simpleReport('room-wise-students', 'Room-wise Students', hostelRows.rooms, [{ key: 'hostelName', label: 'Hostel' }, { key: 'roomNumber', label: 'Room' }, { key: 'capacity', label: 'Capacity' }, { key: 'occupiedBeds', label: 'Occupied' }, { key: 'vacantBeds', label: 'Vacant' }, { key: 'status', label: 'Status' }], 'Rooms', 'Students'),
      simpleReport('vacant-beds', 'Vacant Beds', hostelRows.rooms.filter((row) => row.vacantBeds > 0), [{ key: 'hostelName', label: 'Hostel' }, { key: 'roomNumber', label: 'Room' }, { key: 'capacity', label: 'Capacity' }, { key: 'occupiedBeds', label: 'Occupied' }, { key: 'vacantBeds', label: 'Vacant' }], 'Rooms', 'Vacant Beds'),
    ],
    holidays: [
      simpleReport('holiday-calendar', 'Holiday Calendar', holidayRows.map(toHolidayRow), [{ key: 'title', label: 'Holiday' }, { key: 'holidayDate', label: 'Date' }, { key: 'holidayType', label: 'Type' }, { key: 'audience', label: 'Audience' }, { key: 'targetClasses', label: 'Classes' }], 'Holidays', 'Days'),
      groupedReport('monthly-holidays', 'Monthly Holidays', holidayRows, (row) => monthKey(row.holidayDate), 'Month', 'Holidays', {}, 'line'),
      simpleReport('upcoming-holidays', 'Upcoming Holidays', holidayRows.filter((row) => dateKey(row.holidayDate) >= dateKey(new Date())).map(toHolidayRow), [{ key: 'title', label: 'Holiday' }, { key: 'holidayDate', label: 'Date' }, { key: 'holidayType', label: 'Type' }, { key: 'audience', label: 'Audience' }], 'Holidays', 'Upcoming'),
      groupedReport('holiday-types', 'Holiday Type Distribution', holidayRows, (row) => row.holidayType, 'Type', 'Holidays', { holidayType: 'label' }, 'donut'),
      groupedReport('holiday-audience', 'Applicable Class / Role Holidays', holidayRows, (row) => row.audience, 'Audience', 'Holidays', { audience: 'label' }, 'donut'),
    ],
  };
}

function simpleReport(id, title, rows, tableColumns, xLabel, yLabel, chartType = 'bar') {
  const chartRows = withColors(rows.map((row) => ({ label: row.label || row.name || row.studentName || row.teacherName || row.title || row.className || row.date || row.month || 'Record', value: Number(row.value ?? row.amount ?? row.paid ?? row.paidAmount ?? row.marksObtained ?? 1) || 1 })).slice(0, 20));
  return {
    id,
    title,
    description: `${title} report uses saved ERP records only.`,
    rows,
    columns: tableColumns,
    chartRows,
    charts: [{ title, type: chartType, data: chartRows, xLabel, yLabel }],
    filters: reportFilters(id),
    kpis: [{ label: 'Records', value: rows.length }, { label: yLabel, value: sumBy(chartRows, 'value') }],
  };
}

function groupedReport(id, title, rows, groupKey, xLabel, yLabel, drillMap = {}, chartType = 'bar') {
  const chartRows = withColors(mapToChartRows(countBy(rows, groupKey), 18));
  return {
    id,
    title,
    description: `${title} grouped from saved records.`,
    rows: chartRows,
    columns: columns.simple,
    chartRows,
    charts: [{ title, type: chartType, data: chartRows, xLabel, yLabel }],
    filters: reportFilters(id),
    drillDown: (row) => Object.fromEntries(Object.entries(drillMap).map(([filterKey, rowKey]) => [filterKey, row[rowKey]])),
    kpis: [{ label: 'Groups', value: chartRows.length }, { label: yLabel, value: sumBy(chartRows, 'value') }],
  };
}

function amountGroupReport(id, title, rows, groupKey, xLabel, yLabel, chartType = 'bar', amountKey = 'paid') {
  const map = rows.reduce((result, row) => {
    const key = groupKey(row) || 'Not Added';
    result.set(key, (result.get(key) || 0) + (Number(row[amountKey]) || 0));
    return result;
  }, new Map());
  const chartRows = withColors(mapToChartRows(map, 18));
  return {
    id,
    title,
    description: `${title} calculated from payment records.`,
    rows,
    columns: id.includes('salary') || amountKey === 'paidAmount' ? columns.salary : columns.fees,
    chartRows,
    charts: [{ title, type: chartType, data: chartRows, xLabel, yLabel }],
    filters: reportFilters(id),
    kpis: [{ label: 'Collected', value: formatCurrency(sumBy(rows, amountKey)) }, { label: 'Records', value: rows.length }],
  };
}

function reportFilters(id) {
  const base = [{ key: 'dateRange', label: 'Date Range' }];
  const map = {
    'student-directory': ['className', 'section', 'gender', 'status'],
    'class-strength': ['className', 'section'],
    'gender-distribution': ['className'],
    'student-status': ['className', 'status'],
    'admission-analysis': ['className', 'dateRange'],
    'documents-pending': ['className', 'section'],
    'daily-attendance': ['className', 'student', 'dateRange'],
    'monthly-attendance': ['className', 'month'],
    'class-attendance': ['className', 'dateRange'],
    'student-attendance': ['className', 'student', 'threshold', 'dateRange'],
    'low-attendance': ['className', 'threshold', 'dateRange'],
    absentees: ['className', 'dateRange'],
    'fee-collection': ['className', 'student', 'paymentMode', 'paymentStatus', 'dateRange'],
    'daily-collection': ['className', 'paymentMode', 'dateRange'],
    'monthly-collection': ['className', 'month', 'paymentMode'],
    'pending-fees': ['className', 'student'],
    'fee-defaulters': ['className'],
    'payment-mode-analysis': ['paymentMode', 'dateRange'],
    'class-wise-collection': ['className', 'dateRange'],
    'fee-type-collection': ['feeType', 'dateRange'],
    'marks-ledger': ['className', 'student', 'subject', 'exam'],
    'overall-result': ['className', 'exam'],
    'class-performance': ['className', 'exam'],
    'subject-performance': ['className', 'subject', 'exam'],
    'pass-fail': ['className', 'exam'],
    'top-performers': ['className', 'exam'],
    'needs-attention': ['className', 'exam'],
    'teacher-directory': ['teacher', 'subject', 'status'],
    'salary-ledger': ['teacher', 'month', 'dateRange'],
    'paid-salaries': ['teacher', 'month'],
    'pending-salaries': ['teacher', 'month'],
    'class-timetable': ['className', 'teacher', 'subject'],
    'subject-periods': ['className', 'subject'],
    'teacher-periods': ['teacher'],
    'library-inventory': ['book'],
    'issued-books': ['book', 'issueStatus', 'dateRange'],
    'overdue-books': ['book'],
    'most-borrowed-books': ['book'],
    'transport-students': ['className', 'driver', 'route'],
    'driver-directory': ['driver', 'route', 'status'],
    'route-assignments': ['driver', 'route'],
    'transport-attendance': ['driver', 'route', 'dateRange'],
    'resident-list': ['className', 'hostel', 'room'],
    'room-wise-students': ['hostel', 'room', 'status'],
    'vacant-beds': ['hostel'],
    'holiday-calendar': ['holidayType', 'audience', 'dateRange'],
    'upcoming-holidays': ['holidayType', 'audience'],
    'holiday-types': ['holidayType', 'dateRange'],
    'holiday-audience': ['audience', 'dateRange'],
  };
  const keys = map[id] || [];
  return keys.map((key) => key === 'threshold'
    ? { key, label: 'Threshold %', type: 'number', defaultValue: 75 }
    : { key, label: labelFor(key) }).filter(Boolean).concat(keys.includes('dateRange') ? [] : base.filter(() => false));
}

function labelFor(key) {
  return {
    className: 'Class',
    section: 'Section',
    gender: 'Gender',
    status: 'Status',
    student: 'Student',
    teacher: 'Teacher',
    subject: 'Subject',
    exam: 'Exam',
    month: 'Month',
    paymentMode: 'Payment Mode',
    paymentStatus: 'Payment Status',
    feeType: 'Fee Type',
    dateRange: 'Date Range',
    hostel: 'Hostel',
    room: 'Room',
    book: 'Book',
    issueStatus: 'Issue Status',
    driver: 'Driver',
    route: 'Route',
    holidayType: 'Holiday Type',
    audience: 'Audience',
  }[key] || key;
}

function overviewReport(data, prepared) {
  const paidFees = sumBy(prepared.feeRows, 'paid');
  const pendingFees = sumBy(prepared.feeRows, 'pending');
  const attendancePercent = attendancePercentFromRows(prepared.attendance);
  const today = dateKey(new Date());
  const upcomingExams = data.dateSheets.filter((exam) => dateKey(exam.examStartDate) >= today).length;
  const charts = [
    chartFromGroup('Student Strength by Class', prepared.students, (row) => row.className || row.assignedClass, 'Class', 'Number of Students'),
    chartFromAttendance('Attendance Trend', prepared.attendance, 'Attendance Date', 'Attendance %'),
    chartFromAmount('Fee Collection Trend', prepared.feeRows, (row) => row.month, 'Month', 'Amount Collected'),
    chartFromGroup('Gender Distribution', prepared.students, (row) => row.gender, 'Gender', 'Number of Students', 'donut'),
    chartFromGroup('Hostel Occupancy', prepared.hostelRows.residents, (row) => row.hostelName, 'Hostel', 'Residents'),
    chartFromGroup('Library Issue Status', prepared.libraryRows.issues, (row) => row.status, 'Status', 'Books', 'donut'),
  ].filter((chart) => chart.data.length);

  return {
    id: 'overview-dashboard',
    title: 'Overview Dashboard',
    description: 'A live snapshot from all connected ERP modules.',
    filters: [],
    rows: [
      { label: 'Students', value: prepared.students.length },
      { label: 'Teachers', value: prepared.teacherRows.length },
      { label: 'Fee Collected', value: paidFees },
      { label: 'Pending Fees', value: pendingFees },
      { label: 'Salary Paid', value: sumBy(prepared.salaryRows, 'paidAmount') },
      { label: 'Hostel Residents', value: prepared.hostelRows.residents.length },
      { label: 'Transport Students', value: prepared.transportRows.assignments.length },
      { label: 'Upcoming Exams', value: upcomingExams },
    ],
    columns: columns.simple,
    charts,
    chartRows: charts[0]?.data || [],
    kpis: [
      { label: 'Students', value: prepared.students.length },
      { label: 'Teachers', value: prepared.teacherRows.length },
      { label: 'Attendance', value: formatPercent(attendancePercent) },
      { label: 'Fee Collected', value: formatCurrency(paidFees) },
      { label: 'Pending Fees', value: formatCurrency(pendingFees) },
      { label: 'Salary Paid', value: formatCurrency(sumBy(prepared.salaryRows, 'paidAmount')) },
      { label: 'Hostel Occupancy', value: `${prepared.hostelRows.residents.length}/${sumBy(prepared.hostelRows.rooms, 'capacity') || 0}` },
      { label: 'Upcoming Exams', value: upcomingExams },
    ],
    insights: [
      { title: 'Database Only', text: 'Charts change when saved module records change.' },
      { title: 'Partial API Safe', text: 'If one module fails, available reports still render.' },
      { title: 'Export Ready', text: 'Current report rows can be exported as CSV, Excel, PDF print, or print view.' },
    ],
  };
}

function filteredStudents(rows, filters) {
  return rows.filter((row) =>
    match(row.className || row.assignedClass, filters.className || ALL_VALUE)
    && match(row.section, filters.section || ALL_VALUE)
    && match(row.gender, filters.gender || ALL_VALUE)
    && match(getStatus(row.status), filters.status || ALL_VALUE)
    && match(fullName(row), filters.student || ALL_VALUE)
    && inDateRange(row.admissionDate || row.createdAt, filters.dateRange || ALL_VALUE)
  );
}

function filteredAttendance(rows, filters) {
  return rows.filter((row) =>
    match(row.className, filters.className || ALL_VALUE)
    && match(row.studentName, filters.student || ALL_VALUE)
    && match(monthKey(getAttendanceDate(row)), filters.month || ALL_VALUE)
    && inDateRange(getAttendanceDate(row), filters.dateRange || ALL_VALUE)
  );
}

function buildFeeRows(data, filters) {
  const paymentsByStudent = data.feePayments.reduce((map, payment) => {
    const key = String(payment.studentId || payment.student?.id || payment.studentName || '');
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(payment);
    return map;
  }, new Map());

  return data.students.flatMap((student) => {
    const expected = expectedFeeForStudent(student, data.feeStructures);
    const payments = paymentsByStudent.get(String(student.id)) || paymentsByStudent.get(fullName(student)) || [];
    const rows = payments.length ? payments : [{ studentId: student.id, studentName: fullName(student), amountPaid: 0 }];
    return rows.map((payment) => {
      const paid = Number(payment.amountPaid ?? payment.paidAmount ?? payment.amount ?? 0);
      const pending = Math.max(0, Number(payment.balanceRemaining ?? expected - payments.reduce((sum, item) => sum + Number(item.amountPaid ?? item.paidAmount ?? item.amount ?? 0), 0)));
      const row = {
        id: payment.id || `${student.id}-fee`,
        studentName: payment.studentName || fullName(student),
        studentId: student.id,
        className: student.className || student.assignedClass || payment.className,
        amount: expected,
        paid,
        pending,
        paymentMode: payment.paymentMode || payment.mode || 'Not Added',
        status: payment.status || (pending > 0 ? 'Pending' : 'Paid'),
        feeType: payment.feeType || payment.category || 'Fee',
        date: dateKey(getPaymentDate(payment)),
        month: monthKey(getPaymentDate(payment)),
      };
      return row;
    });
  }).filter((row) =>
    match(row.className, filters.className || ALL_VALUE)
    && match(row.studentName, filters.student || ALL_VALUE)
    && match(row.paymentMode, filters.paymentMode || ALL_VALUE)
    && match(row.status, filters.paymentStatus || ALL_VALUE)
    && match(row.feeType, filters.feeType || ALL_VALUE)
    && match(row.month, filters.month || ALL_VALUE)
    && inDateRange(row.date, filters.dateRange || ALL_VALUE)
  );
}

function expectedFeeForStudent(student, structures) {
  const className = normalize(student.className || student.assignedClass);
  return structures
    .filter((structure) => {
      const target = normalize(structure.className || structure.courseId || structure.courseName || structure.applicableClass);
      return !target || target === 'all' || target === 'all students' || target === className;
    })
    .reduce((sum, structure) => sum + Number(structure.amount || structure.feeAmount || 0), 0);
}

function filteredMarks(rows, filters) {
  return rows.filter((row) =>
    match(row.className, filters.className || ALL_VALUE)
    && match(row.studentName, filters.student || ALL_VALUE)
    && match(row.subjectName, filters.subject || ALL_VALUE)
    && match(row.examTitle, filters.exam || ALL_VALUE)
  );
}

function filteredTeachers(rows, filters) {
  return rows.filter((row) =>
    match(fullName(row), filters.teacher || ALL_VALUE)
    && match(row.subject, filters.subject || ALL_VALUE)
    && match(getStatus(row.status), filters.status || ALL_VALUE)
  );
}

function filteredSalaries(data, filters) {
  return data.salaries.map((row) => ({
    id: row.id,
    teacherName: row.teacherName || fullName(data.teachers.find((teacher) => String(teacher.id) === String(row.teacherId))) || 'Teacher',
    month: row.month || monthKey(row.paymentDate || row.createdAt),
    baseSalary: Number(row.baseSalary || row.monthlySalary || row.salary || 0),
    deduction: Number(row.deduction || row.totalDeduction || 0),
    paidAmount: Number(row.paidAmount || row.netSalary || row.amount || 0),
    paymentDate: dateKey(row.paymentDate || row.createdAt),
    status: row.status || (row.paidAmount ? 'Paid' : 'Pending'),
  })).filter((row) =>
    match(row.teacherName, filters.teacher || ALL_VALUE)
    && match(row.month, filters.month || ALL_VALUE)
    && inDateRange(row.paymentDate, filters.dateRange || ALL_VALUE)
  );
}

function buildPendingSalaryRows(data, filters) {
  const paidMonths = new Set(data.salaries.map((row) => `${row.teacherId || row.teacherName}-${row.month || monthKey(row.paymentDate)}`));
  const month = filters.month && filters.month !== ALL_VALUE ? filters.month : monthKey(new Date());
  return data.teachers
    .filter((teacher) => !paidMonths.has(`${teacher.id}-${month}`) && !paidMonths.has(`${fullName(teacher)}-${month}`))
    .map((teacher) => ({
      id: `pending-${teacher.id}`,
      teacherName: fullName(teacher),
      month,
      baseSalary: Number(teacher.salary || teacher.monthlySalary || 0),
      deduction: 0,
      paidAmount: 0,
      paymentDate: '',
      status: 'Pending',
    }))
    .filter((row) => match(row.teacherName, filters.teacher || ALL_VALUE));
}

function buildTimetableRows(rows, filters) {
  return rows.flatMap((timetable) => parseTimetable(timetable)).filter((row) =>
    match(row.className, filters.className || ALL_VALUE)
    && match(row.teacher, filters.teacher || ALL_VALUE)
    && match(row.subject, filters.subject || ALL_VALUE)
  );
}

function parseTimetable(timetable) {
  const template = typeof timetable.templateData === 'string' ? safeJson(timetable.templateData) : timetable.templateData;
  const rows = Array.isArray(template?.rows) ? template.rows : Array.isArray(template) ? template : [];
  return rows.flatMap((row, rowIndex) => Object.entries(row || {})
    .filter(([key, value]) => value && !['id', 'day', 'time'].includes(key))
    .map(([period, value]) => {
      const text = typeof value === 'object' ? [value.subject, value.teacher].filter(Boolean).join(' - ') : String(value);
      const [subject, teacher] = text.split(' - ');
      return {
        id: `${timetable.id}-${rowIndex}-${period}`,
        className: timetable.className,
        day: row.day || row.dayName || `Row ${rowIndex + 1}`,
        period,
        subject: subject || text,
        teacher: teacher || '',
      };
    }));
}

function buildLibraryRows(data, filters) {
  const activeIssues = countBy(data.issues.filter((issue) => !isReturned(issue)), (issue) => issue.bookId || issue.bookTitle);
  const today = dateKey(new Date());
  const books = data.books.map((book) => ({
    ...book,
    activeIssues: activeIssues.get(book.id) || activeIssues.get(book.title) || 0,
  })).filter((row) => match(row.title, filters.book || ALL_VALUE));
  const issues = data.issues.map((issue) => ({
    ...issue,
    issueDate: dateKey(issue.issueDate),
    dueDate: dateKey(issue.dueDate),
    status: isReturned(issue) ? 'Returned' : dateKey(issue.dueDate) && dateKey(issue.dueDate) < today ? 'Overdue' : 'Issued',
  })).filter((row) =>
    match(row.bookTitle, filters.book || ALL_VALUE)
    && match(row.status, filters.issueStatus || ALL_VALUE)
    && inDateRange(row.issueDate, filters.dateRange || ALL_VALUE)
  );
  return { books, issues };
}

function buildTransportRows(data, filters) {
  const drivers = data.drivers.filter((row) =>
    match(row.driverName, filters.driver || ALL_VALUE)
    && match(row.routeName, filters.route || ALL_VALUE)
    && match(getStatus(row.status), filters.status || ALL_VALUE)
  );
  const assignments = data.transportAssignments.filter((row) =>
    match(row.className, filters.className || ALL_VALUE)
    && match(row.driverName, filters.driver || ALL_VALUE)
    && match(row.routeName, filters.route || ALL_VALUE)
  );
  const attendance = data.transportAttendance.filter((row) =>
    match(row.driverName, filters.driver || ALL_VALUE)
    && match(row.routeName, filters.route || ALL_VALUE)
    && inDateRange(row.date, filters.dateRange || ALL_VALUE)
  );
  return { drivers, assignments, attendance };
}

function buildHostelRows(data, filters) {
  const hostels = data.hostels.filter((row) => match(row.hostelName, filters.hostel || ALL_VALUE));
  const rooms = data.rooms.map((room) => ({ ...room, vacantBeds: Number(room.capacity || 0) - Number(room.occupiedBeds || 0) })).filter((row) =>
    match(row.hostelName, filters.hostel || ALL_VALUE)
    && match(row.roomNumber, filters.room || ALL_VALUE)
    && match(getStatus(row.status), filters.status || ALL_VALUE)
  );
  const residents = data.residents.filter((row) =>
    match(row.className, filters.className || ALL_VALUE)
    && match(row.hostelName, filters.hostel || ALL_VALUE)
    && match(row.roomNumber, filters.room || ALL_VALUE)
  );
  return { hostels, rooms, residents };
}

function filteredHolidays(rows, filters) {
  return rows.filter((row) =>
    match(row.holidayType, filters.holidayType || ALL_VALUE)
    && match(row.audience, filters.audience || ALL_VALUE)
    && inDateRange(row.holidayDate, filters.dateRange || ALL_VALUE)
  );
}

function toStudentRow(student) {
  return {
    id: student.id,
    name: fullName(student),
    className: student.className || student.assignedClass || 'Not Added',
    section: student.section || 'Not Added',
    rollNo: student.rollNo || student.rollNumber || 'Not Added',
    gender: student.gender || 'Not Added',
    status: getStatus(student.status),
  };
}

function toTeacherRow(teacher) {
  return {
    id: teacher.id,
    name: fullName(teacher),
    subject: teacher.subject || 'Not Added',
    department: teacher.department || 'Not Added',
    phone: teacher.phone || teacher.mobile || 'Not Added',
    salary: formatCurrency(teacher.salary || teacher.monthlySalary || 0),
    status: getStatus(teacher.status),
  };
}

function toMarkRow(mark) {
  const percentage = Number(mark.maxMarks) ? (Number(mark.marksObtained) / Number(mark.maxMarks)) * 100 : 0;
  return {
    id: mark.id,
    studentName: mark.studentName,
    className: mark.className,
    subjectName: mark.subjectName,
    examTitle: mark.examTitle,
    marksObtained: Number(mark.marksObtained || 0),
    maxMarks: Number(mark.maxMarks || 0),
    percentage: formatPercent(percentage),
    status: percentage >= 33 ? 'Pass' : 'Fail',
  };
}

function toHolidayRow(row) {
  return {
    id: row.id,
    title: row.title,
    holidayDate: dateKey(row.holidayDate),
    holidayType: row.holidayType || 'Holiday',
    audience: row.audience || 'All',
    targetClasses: Array.isArray(row.targetClasses) ? row.targetClasses.join(', ') : row.targetClasses || 'All',
  };
}

function buildFacilityRows(data) {
  return [
    { label: 'Hostel Residents', value: data.residents.length },
    { label: 'Transport Students', value: data.transportAssignments.length },
    { label: 'Library Borrowers', value: new Set(data.issues.map((issue) => issue.borrowerId || issue.borrowerName)).size },
  ];
}

function attendanceSummary(id, title, rows, group) {
  const groups = groupAttendance(rows, group);
  return {
    id,
    title,
    description: `${title} calculated from saved attendance records.`,
    filters: reportFilters(id),
    rows: groups,
    columns: columns.attendance,
    chartRows: withColors(groups.map((row) => ({ label: row.date || row.month || row.className, value: row.percentage }))),
    charts: [{ title, type: group === 'month' ? 'area' : 'bar', data: withColors(groups.map((row) => ({ label: row.date || row.month || row.className, value: row.percentage }))), xLabel: group === 'className' ? 'Class' : 'Date / Month', yLabel: 'Attendance %' }],
    kpis: [{ label: 'Attendance', value: formatPercent(attendancePercentFromRows(rows)) }, { label: 'Records', value: rows.length }],
  };
}

function groupAttendance(rows, group) {
  const map = rows.reduce((result, row) => {
    const key = group === 'month' ? monthKey(getAttendanceDate(row)) : group === 'className' ? row.className || 'Not Added' : dateKey(getAttendanceDate(row));
    if (!result.has(key)) result.set(key, []);
    result.get(key).push(row);
    return result;
  }, new Map());
  return [...map.entries()].map(([key, groupRows]) => ({
    id: key,
    date: group === 'date' ? key : '',
    month: group === 'month' ? key : '',
    className: group === 'className' ? key : '',
    studentName: 'All Students',
    status: 'Summary',
    percentage: Math.round(attendancePercentFromRows(groupRows)),
  })).sort((a, b) => String(a.date || a.month || a.className).localeCompare(String(b.date || b.month || b.className)));
}

function studentAttendanceReport(rows, students, threshold) {
  const grouped = studentAttendanceRows(rows, students);
  return simpleReport('student-attendance', 'Student Attendance', grouped, columns.attendance, 'Students', 'Attendance %').withThreshold
    || { ...simpleReport('student-attendance', 'Student Attendance', grouped, columns.attendance, 'Students', 'Attendance %'), kpis: [{ label: 'Average', value: formatPercent(avg(grouped, 'percentage')) }, { label: `Below ${threshold}%`, value: grouped.filter((row) => row.percentage < threshold).length }] };
}

function lowAttendanceReport(rows, students, threshold) {
  const lowRows = studentAttendanceRows(rows, students).filter((row) => row.percentage < threshold);
  return { ...simpleReport('low-attendance', 'Low Attendance', lowRows, columns.attendance, 'Students', 'Attendance %'), kpis: [{ label: 'Students', value: lowRows.length }, { label: 'Threshold', value: formatPercent(threshold) }] };
}

function absenteeReport(rows) {
  const absent = rows.filter((row) => ['absent', 'a'].includes(normalize(row.status))).map((row) => ({
    id: row.id,
    date: dateKey(getAttendanceDate(row)),
    studentName: row.studentName,
    className: row.className,
    status: row.status,
    percentage: 0,
  }));
  return simpleReport('absentees', 'Absentee Report', absent, columns.attendance, 'Students', 'Absences');
}

function studentAttendanceRows(rows, students) {
  const map = rows.reduce((result, row) => {
    const key = getAttendanceStudentId(row) || row.studentName;
    if (!result.has(key)) result.set(key, []);
    result.get(key).push(row);
    return result;
  }, new Map());
  return [...map.entries()].map(([key, groupRows]) => {
    const student = students.find((item) => String(item.id) === String(key));
    return {
      id: key,
      date: '',
      studentName: groupRows[0]?.studentName || fullName(student),
      className: groupRows[0]?.className || student?.className || student?.assignedClass,
      status: 'Summary',
      percentage: Math.round(attendancePercentFromRows(groupRows)),
    };
  });
}

function attendancePercentFromRows(rows) {
  if (!rows.length) return 0;
  return (rows.filter(isPresent).length / rows.length) * 100;
}

function resultGroupReport(id, title, rows, groupKey, xLabel, yLabel, chartType = 'bar') {
  const groups = aggregateMarks(rows, groupKey);
  return {
    id,
    title,
    description: `${title} calculated from uploaded marks.`,
    rows: groups,
    columns: [{ key: 'label', label: xLabel }, { key: 'value', label: 'Average %' }, { key: 'students', label: 'Records' }],
    chartRows: withColors(groups),
    charts: [{ title, type: chartType, data: withColors(groups), xLabel, yLabel }],
    filters: reportFilters(id),
    kpis: [{ label: 'Average', value: formatPercent(avg(groups, 'value')) }, { label: 'Records', value: rows.length }],
  };
}

function aggregateMarks(rows, groupKey) {
  const map = rows.reduce((result, row) => {
    const key = groupKey(row) || 'Not Added';
    if (!result.has(key)) result.set(key, { obtained: 0, max: 0, count: 0 });
    const item = result.get(key);
    item.obtained += Number(row.marksObtained || 0);
    item.max += Number(row.maxMarks || 0);
    item.count += 1;
    return result;
  }, new Map());
  return [...map.entries()].map(([label, item]) => ({ label, value: item.max ? Math.round((item.obtained / item.max) * 100) : 0, students: item.count }));
}

function passFailReport(rows) {
  const chartRows = withColors(mapToChartRows(countBy(rows, (row) => {
    const percentage = Number(row.maxMarks) ? (Number(row.marksObtained) / Number(row.maxMarks)) * 100 : 0;
    return percentage >= 33 ? 'Pass' : 'Fail';
  }), 2));
  return {
    id: 'pass-fail',
    title: 'Pass / Fail Analysis',
    description: 'Pass and fail count from uploaded marks.',
    rows: chartRows,
    columns: columns.simple,
    chartRows,
    charts: [{ title: 'Pass / Fail Analysis', type: 'donut', data: chartRows, xLabel: 'Status', yLabel: 'Students' }],
    filters: reportFilters('pass-fail'),
    kpis: [{ label: 'Pass', value: chartRows.find((row) => row.label === 'Pass')?.value || 0 }, { label: 'Fail', value: chartRows.find((row) => row.label === 'Fail')?.value || 0 }],
  };
}

function topPerformersReport(rows) {
  const grouped = aggregateMarks(rows, (row) => row.studentName).sort((a, b) => b.value - a.value).slice(0, 20);
  return simpleReport('top-performers', 'Top Performers', grouped, [{ key: 'label', label: 'Student' }, { key: 'value', label: 'Percentage' }, { key: 'students', label: 'Marks Records' }], 'Students', 'Percentage', 'horizontal');
}

function needingAttentionReport(rows) {
  const grouped = aggregateMarks(rows, (row) => row.studentName).filter((row) => row.value < 33).sort((a, b) => a.value - b.value);
  return simpleReport('needs-attention', 'Students Needing Attention', grouped, [{ key: 'label', label: 'Student' }, { key: 'value', label: 'Percentage' }, { key: 'students', label: 'Marks Records' }], 'Students', 'Percentage', 'horizontal');
}

function chartFromGroup(title, rows, groupKey, xLabel, yLabel, type = 'bar') {
  return { title, type, data: withColors(mapToChartRows(countBy(rows, groupKey), 12)), xLabel, yLabel };
}

function chartFromAttendance(title, rows, xLabel, yLabel) {
  const data = groupAttendance(rows, 'date').map((row) => ({ label: row.date, value: row.percentage }));
  return { title, type: 'line', data, xLabel, yLabel };
}

function chartFromAmount(title, rows, groupKey, xLabel, yLabel) {
  const map = rows.reduce((result, row) => {
    const key = groupKey(row);
    result.set(key, (result.get(key) || 0) + Number(row.paid || 0));
    return result;
  }, new Map());
  return { title, type: 'area', data: withColors(mapToChartRows(map, 12)), xLabel, yLabel };
}

function safeJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function avg(rows, key) {
  return rows.length ? rows.reduce((sum, row) => sum + Number(row[key] || 0), 0) / rows.length : 0;
}

function serializeReportSnapshot(category, report, filters) {
  return {
    category,
    reportKey: report.id,
    title: report.title,
    filtersJson: JSON.stringify(filters || {}),
    kpisJson: JSON.stringify(report.kpis || []),
    chartsJson: JSON.stringify(report.charts || []),
    rowsJson: JSON.stringify(report.rows || []),
    rowCount: Array.isArray(report.rows) ? report.rows.length : 0,
    generatedAt: new Date().toISOString().replace('Z', ''),
  };
}
