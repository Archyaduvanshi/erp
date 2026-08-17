import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Bus,
  CheckCircle2,
  CreditCard,
  CalendarClock,
  FileText,
  GraduationCap,
  Home,
  Library,
  LogOut,
  Megaphone,
  Pin,
  Receipt,
  ScrollText,
  UserRound,
} from 'lucide-react';
import { attendanceApi, examApi, feeApi, libraryApi, noticeApi, studentApi, timetableApi, transportApi } from '../../utils/api';
import { getFeeFacilityKey, isFeeStructureApplicableToStudent } from '../../utils/facilityUtils';
import { buildFeeRow, formatMoney } from '../../utils/feeUtils';
import { formatNoticeDate, getPortalNotices } from '../../utils/noticeUtils';

const StudentDashboard = () => {
  const navigate = useNavigate();
  const [session] = useState(() => JSON.parse(localStorage.getItem('active_session')) || null);
  const [student, setStudent] = useState(null);
  const [classTimetables, setClassTimetables] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [dateSheets, setDateSheets] = useState([]);
  const [admitCards, setAdmitCards] = useState([]);
  const [transportRecords, setTransportRecords] = useState([]);
  const [libraryIssues, setLibraryIssues] = useState([]);
  const [books, setBooks] = useState([]);
  const [feeStructures, setFeeStructures] = useState([]);
  const [feePayments, setFeePayments] = useState([]);
  const [notices, setNotices] = useState([]);
  const [loadError, setLoadError] = useState('');

  const studentName = student
    ? `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.enrollmentNo || student.systemId || 'Student'
    : 'Student';

  const studentAttendance = useMemo(() => {
    if (!student) return [];
    const studentKeys = [student.systemId, student.enrollmentNo, String(student.id)].filter(Boolean).map(String);
    return attendanceRecords.filter((record) => {
      const recordStudentId = String(record.studentId || '');
      const recordRollNo = String(record.rollNo || '');
      const recordName = String(record.studentName || '').trim().toLowerCase();
      return (
        studentKeys.includes(recordStudentId) ||
        studentKeys.includes(recordRollNo) ||
        recordName === studentName.toLowerCase()
      );
    });
  }, [attendanceRecords, student, studentName]);

  const presentCount = studentAttendance.filter((record) => record.status === 'Present').length;
  const attendanceRate = studentAttendance.length
    ? Math.round((presentCount / studentAttendance.length) * 100)
    : 0;

  const classDateSheets = useMemo(() => {
    if (!student?.assignedClass) return [];
    return dateSheets.filter((record) => record.className === student.assignedClass);
  }, [dateSheets, student]);

  const classTimetableRecord = useMemo(() => {
    if (!student?.assignedClass) return null;
    return classTimetables.find((record) => record.className === student.assignedClass) || null;
  }, [classTimetables, student]);

  const studentAdmitCards = useMemo(() => {
    if (!student) return [];
    const studentKeys = [student.systemId, student.enrollmentNo, String(student.id)].filter(Boolean).map(String);
    return admitCards.filter((record) => {
      const recordStudentId = String(record.studentId || '');
      const recordRollNo = String(record.rollNo || '');
      const recordName = String(record.studentName || '').trim().toLowerCase();
      return (
        studentKeys.includes(recordStudentId) ||
        studentKeys.includes(recordRollNo) ||
        recordName === studentName.toLowerCase()
      );
    });
  }, [admitCards, student, studentName]);

  const transportAssignment = useMemo(() => {
    if (!student) return null;
    const studentKeys = [String(student.id), String(student.systemId || ''), String(student.enrollmentNo || '')];
    return transportRecords.find((record) =>
      studentKeys.includes(String(record.studentId || '')) ||
      String(record.studentName || '').trim().toLowerCase() === studentName.toLowerCase(),
    ) || null;
  }, [student, studentName, transportRecords]);

  const activeLibraryIssues = useMemo(() => {
    if (!student) return [];
    return libraryIssues
      .filter((issue) => String(issue.borrowerId) === String(student.id) && !issue.returnDate)
      .map((issue) => ({
        ...issue,
        bookTitle: books.find((book) => book.id === issue.bookId)?.title || 'Library Book',
      }));
  }, [books, libraryIssues, student]);

  const studentPayments = useMemo(() => {
    if (!student) return [];
    return feePayments.filter((payment) => String(payment.studentId) === String(student.id));
  }, [feePayments, student]);

  const paidAmount = studentPayments
    .filter((payment) => payment.paymentStatus === 'Success')
    .reduce((sum, payment) => sum + (Number(payment.paidAmount) || 0), 0);

  const studentFeeRows = useMemo(() => {
    if (!student) return [];
    const studentClassName = normalizeClassName(student.assignedClass || student.className || '');
    if (!studentClassName) return [];
    const successfulPayments = studentPayments.filter((payment) => payment.paymentStatus === 'Success');
    return feeStructures
      .filter((structure) => normalizeClassName(structure.courseId) === studentClassName)
      .map((structure) => ({
        structure,
        ...buildFeeRow(structure, student.id, successfulPayments),
      }))
      .filter((row) => {
        if (!isFeeStructureApplicableToStudent(row.structure, student)) return false;
        return row.billingType !== 'monthly_active' || row.serviceMonthsCount > 0;
      });
  }, [feeStructures, student, studentPayments]);

  const feeSummary = useMemo(() => {
    const totalPayable = studentFeeRows.reduce((sum, row) => sum + (Number(row.totalOutstanding) || 0), 0);
    const currentCycleDue = studentFeeRows.reduce((sum, row) => sum + (Number(row.currentCycleDueAmount) || 0), 0);
    const previousPending = studentFeeRows.reduce((sum, row) => sum + (Number(row.previousPendingAmount) || 0), 0);
    const activeFacilityFee = studentFeeRows
      .filter((row) => isFacilityFeeStructure(row.structure))
      .reduce((sum, row) => sum + (Number(row.currentCycleDueAmount) || 0), 0);
    return {
      totalPayable,
      currentCycleDue,
      previousPending,
      activeFacilityFee,
    };
  }, [studentFeeRows]);

  const portalNotices = useMemo(
    () => getPortalNotices(notices, 'student', student?.assignedClass || student?.className, [], student?.id),
    [notices, student],
  );

  const handleLogout = () => {
    localStorage.removeItem('active_session');
    localStorage.removeItem('current_college_id');
    navigate('/login');
  };

  useEffect(() => {
    if (!session || session.role !== 'student') {
      navigate('/login');
      return;
    }

    const loadStudentDashboard = async () => {
      try {
        const [studentResponse, timetableResponse, assignmentResponse, bookResponse, issueResponse, attendanceResponse, dateSheetResponse, admitCardResponse, noticeResponse, feeStructureResponse, feePaymentResponse] = await Promise.all([
          studentApi.getById(session.studentId),
          timetableApi.getClassTimetables(),
          transportApi.getAssignments(),
          libraryApi.getBooks(),
          libraryApi.getIssues(),
          attendanceApi.getAll(),
          examApi.getDateSheets(),
          examApi.getAdmitCards(),
          noticeApi.getPortalAll(),
          feeApi.getStructures(),
          feeApi.getPayments(session.studentId),
        ]);
        setStudent(studentResponse);
        setClassTimetables(timetableResponse);
        setTransportRecords(assignmentResponse);
        setBooks(bookResponse);
        setLibraryIssues(issueResponse);
        setAttendanceRecords(attendanceResponse);
        setDateSheets(dateSheetResponse);
        setAdmitCards(admitCardResponse);
        setNotices(noticeResponse);
        setFeeStructures(feeStructureResponse);
        setFeePayments(feePaymentResponse);
        setLoadError('');
      } catch {
        setStudent(null);
        setClassTimetables([]);
        setTransportRecords([]);
        setBooks([]);
        setLibraryIssues([]);
        setAttendanceRecords([]);
        setDateSheets([]);
        setAdmitCards([]);
        setNotices([]);
        setFeeStructures([]);
        setFeePayments([]);
        setLoadError('Unable to load student dashboard data.');
      }
    };

    loadStudentDashboard();
  }, [navigate, session]);

  if (!session || session.role !== 'student') return null;

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20 font-sans text-slate-900">
      <header className="sticky top-0 z-50 h-20 border-b border-slate-100 bg-white">
        <div className="mx-auto flex h-full max-w-screen-2xl items-center justify-between px-6 md:px-12 lg:px-20">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-cyan-600 p-1.5 shadow-sm">
              <GraduationCap size={20} className="text-white" />
            </div>
            <span className="hidden font-black uppercase italic tracking-tighter text-cyan-800 sm:block sm:text-xl">EduStream</span>
          </div>

          <div className="flex items-center gap-4 lg:gap-8">
            <div className="flex items-center gap-3 border-r border-slate-100 pr-4 lg:gap-6 lg:pr-8">
              <button className="rounded-full bg-slate-50 p-2 text-slate-400 transition-all hover:text-cyan-600">
                <Bell size={18} />
              </button>
              <div className="hidden text-right md:block">
                <p className="text-[10px] font-black uppercase text-slate-400">{studentName}</p>
                <span className="rounded bg-cyan-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-cyan-700">
                  Student Session
                </span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-rose-100 transition-all hover:bg-rose-700 md:px-6 md:py-2.5 md:text-sm"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-screen-2xl px-6 pt-16 md:px-12 lg:px-20">
        {loadError ? (
          <div className="mb-6 rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
            {loadError}
          </div>
        ) : null}
        <div className="mb-10 px-4 text-center">
          <h1 className="flex flex-wrap items-center justify-center gap-3 text-3xl font-black tracking-tighter text-slate-950 md:gap-4 md:text-5xl">
            <UserRound size={38} className="text-cyan-700" />
            Student Dashboard
          </h1>
          <p className="mt-4 text-sm font-semibold text-slate-500">
            {session.instituteName} | {student?.assignedClass || 'Class not assigned'} | {student?.enrollmentNo || student?.systemId || 'Enrollment pending'}
          </p>
        </div>

        <section className="mb-12 overflow-hidden rounded-[2.5rem] bg-[linear-gradient(145deg,#082f49_0%,#0e7490_52%,#155e75_100%)] px-8 py-8 text-white shadow-[0_30px_80px_-40px_rgba(8,47,73,0.85)] md:px-12 md:py-10">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-cyan-200">Student Portal</p>
              <h2 className="mt-4 max-w-3xl font-serif text-4xl font-black italic leading-none tracking-tight">
                Welcome {studentName}, keep your academic records and daily essentials in one place.
              </h2>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-cyan-50/85">
                This dashboard gives each student a focused view of attendance, examination records, transport and library details, fee payments, and profile information saved by the institution.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <MetricCard label="Attendance Rate" value={`${attendanceRate}%`} icon={CheckCircle2} />
              <MetricCard label="Exam Documents" value={classDateSheets.length + studentAdmitCards.length} icon={FileText} />
              <MetricCard label="Timetable" value={classTimetableRecord ? 'Available' : 'Pending'} icon={CalendarClock} />
              <MetricCard label="Library Loans" value={activeLibraryIssues.length} icon={Library} />
              <MetricCard label="Fees Paid" value={formatMoney(paidAmount)} icon={CreditCard} />
              <MetricCard label="Notices" value={portalNotices.length} icon={Megaphone} />
            </div>
          </div>
        </section>

        <section className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-10 lg:grid-cols-3">
          <NoticeSummaryCard
            notices={portalNotices}
            onClick={() => navigate('/student/notices')}
          />
          <ModuleCard
            icon={<CheckCircle2 className="text-emerald-700" size={42} />}
            title="Attendance"
            desc={`${studentAttendance.length} saved attendance records for this student.`}
            onClick={() => navigate('/student/attendance')}
          />
          <ModuleCard
            icon={<CalendarClock className="text-cyan-700" size={42} />}
            title="Timetable"
            desc={classTimetableRecord?.fileName
              ? `${classTimetableRecord.fileName} available for your class.`
              : 'College timetable upload hote hi yahan read-only view me milega.'}
            onClick={() => navigate('/student/timetable')}
          />
          <ModuleCard
            icon={<ScrollText className="text-indigo-700" size={42} />}
            title="Examinations"
            desc={`${studentAdmitCards.length} admit cards and ${classDateSheets.length} class date sheets available.`}
            onClick={() => navigate('/student/examinations')}
          />
          <ModuleCard
            icon={<Bus className="text-sky-700" size={42} />}
            title="Transport"
            desc={transportAssignment?.routeName
              ? `${transportAssignment.routeName} | Bus ${transportAssignment.busNumber || 'Assigned'}`
              : ((student?.transportOptIn === 'yes' || student?.transportOptIn === true)
                ? `Transport ${student?.transportStatus || 'inactive'} | Waiting for assignment`
                : 'No transport facility requested yet.')}
            onClick={() => navigate('/student/transport')}
          />
          <ModuleCard
            icon={<Library className="text-amber-700" size={42} />}
            title="Library"
            desc={activeLibraryIssues.length
              ? `${activeLibraryIssues.length} active book issues currently linked to this student.`
              : ((student?.libraryOptIn === 'yes' || student?.libraryOptIn === true)
                ? `Library ${student?.libraryStatus || 'inactive'}`
                : 'No library facility requested yet.')}
            onClick={() => navigate('/student/library')}
          />
          <ModuleCard
            icon={<Home className="text-violet-700" size={42} />}
            title="Hostel"
            desc={(student?.hostelOptIn === 'yes' || student?.hostelOptIn === true)
              ? `Hostel ${student?.hostelStatus || 'inactive'} | Rs ${student?.hostelMonthlyCharge || '0'}/month`
              : 'No hostel facility requested yet.'}
            onClick={() => navigate('/student/hostel')}
          />
          <ModuleCard
            icon={<Receipt className="text-rose-700" size={42} />}
            title="Fees"
            desc={`Payable ${formatMoney(feeSummary.totalPayable)} | Cycle ${formatMoney(feeSummary.currentCycleDue)} | Previous ${formatMoney(feeSummary.previousPending)} | Facilities ${formatMoney(feeSummary.activeFacilityFee)}`}
            onClick={() => navigate('/student/fees')}
          />
          <ModuleCard
            icon={<UserRound className="text-cyan-700" size={42} />}
            title="My Profile"
            desc={`${student?.email || 'Email not added'} | ${student?.mobile || 'Phone not added'}`}
            onClick={() => navigate('/student/profile')}
          />
        </section>
      </div>
    </div>
  );
};

const MetricCard = ({ label, value, icon }) => (
  <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-50/80">{label}</p>
        <p className="mt-3 text-3xl font-black tracking-tight text-white">{value}</p>
      </div>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-200/10 text-cyan-50">
        {React.createElement(icon, { size: 20 })}
      </div>
    </div>
  </div>
);

const NoticeSummaryCard = ({ notices, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex w-full flex-col rounded-4xl border border-cyan-100 bg-white p-8 text-left shadow-xl shadow-cyan-100/50 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl md:rounded-[2.5rem] md:p-10"
  >
    <div className="flex items-start justify-between gap-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-cyan-100 text-cyan-700">
        <Megaphone size={26} />
      </div>
      <span className="rounded-full bg-slate-950 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white">
        {notices.length} Live
      </span>
    </div>
    <h3 className="mt-6 text-2xl font-black tracking-tight text-slate-900">Notice</h3>
    <p className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-600">
      {notices[0]?.title || 'College se published notice aate hi yahan show hoga.'}
    </p>
    <span className="mt-6 text-[11px] font-black uppercase tracking-[0.22em] text-cyan-700">Open Notice Board</span>
  </button>
);

const ModuleCard = ({ icon, title, desc, onClick }) => (
  <button
    onClick={onClick}
    className="flex w-full flex-col items-center rounded-4xl border border-slate-100 bg-white p-8 text-center shadow-xl shadow-slate-200/40 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl md:rounded-[2.5rem] md:p-12"
  >
    <div className="mb-6 md:mb-8">
      {icon}
    </div>
    <h3 className="mb-2 text-xl font-bold tracking-tight text-slate-800 md:mb-3 md:text-2xl">{title}</h3>
    <p className="max-w-60 text-xs leading-relaxed text-slate-500 md:text-sm">{desc}</p>
  </button>
);

const isFacilityFeeStructure = (structure = {}) => (
  structure.feeType === 'facility_fee' || structure.billingType === 'monthly_active' || Boolean(getFeeFacilityKey(structure))
);

const normalizeClassName = (className = '') => String(className)
  .split('/')
  .at(0)
  ?.replace(/\s+-\s+section\s+.+$/i, '')
  .replace(/\s+section\s+.+$/i, '')
  .trim() || '';

export default StudentDashboard;
