import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Banknote,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardPenLine,
  FileText,
  GraduationCap,
  LogOut,
  Megaphone,
  Pin,
  Settings,
  Shield,
  UserRound,
} from 'lucide-react';
import { db } from '../../utils/db';
import { attendanceApi, noticeApi, studentApi, teacherApi, timetableApi } from '../../utils/api';
import { getCurrentMonthSalaryStatus, normalizeTeacherSalary } from '../../utils/salaryUtils';
import { formatNoticeDate, getPortalNotices } from '../../utils/noticeUtils';

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const [session] = useState(() => JSON.parse(localStorage.getItem('active_session')) || null);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [classTimetables, setClassTimetables] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [examSlots] = useState(() => db.getAll('timetable_exam_slots'));
  const [notices, setNotices] = useState([]);
  const [loadError, setLoadError] = useState('');

  const teacher = useMemo(() => {
    if (!session || session.role !== 'teacher') return null;
    const matchingTeacher = teachers.find((entry) => String(entry.id) === String(session.teacherId)) || null;
    return matchingTeacher ? normalizeTeacherSalary(matchingTeacher) : null;
  }, [session, teachers]);

  const teacherName = teacher
    ? `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim() || teacher.teacherSystemId || 'Teacher'
    : 'Teacher';

  const teachingClasses = useMemo(() => deriveTeacherClassesFromTimetables(classTimetables, teacher), [classTimetables, teacher]);

  const assignedStudents = useMemo(() => {
    if (!teachingClasses.length) return [];
    return students.filter((student) => teachingClasses.includes(student.assignedClass));
  }, [students, teachingClasses]);

  const teacherAttendance = useMemo(() => {
    if (!teachingClasses.length) return [];
    return attendanceRecords
      .filter((record) => teachingClasses.includes(record.className))
      .filter((record) => normalizeTeacherValue(record.markedBy) === normalizeTeacherValue(teacherName));
  }, [attendanceRecords, teacherName, teachingClasses]);

  const teacherExamDuty = useMemo(() => {
    if (!teacherName) return [];
    return examSlots.filter((slot) => slot.invigilatorName === teacherName);
  }, [examSlots, teacherName]);

  const today = new Date().toISOString().split('T')[0];
  const todayAttendanceCount = teacherAttendance.filter((record) => record.date === today).length;
  const upcomingExamCount = teacherExamDuty.filter((slot) => slot.examDate >= today).length;
  const currentSalaryStatus = getCurrentMonthSalaryStatus(teacher);
  const portalNotices = useMemo(() => getPortalNotices(notices, 'teacher'), [notices]);

  const handleLogout = () => {
    localStorage.removeItem('active_session');
    localStorage.removeItem('current_college_id');
    navigate('/login');
  };

  useEffect(() => {
    if (!session || session.role !== 'teacher') {
      navigate('/login');
    }
  }, [navigate, session]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [teacherResponse, studentResponse, timetableResponse, attendanceResponse, noticeResponse] = await Promise.all([
          teacherApi.getAll(),
          studentApi.getAll(),
          timetableApi.getClassTimetables(),
          attendanceApi.getAll(),
          noticeApi.getPortalAll(),
        ]);
        setTeachers(teacherResponse);
        setStudents(studentResponse);
        setClassTimetables(timetableResponse);
        setAttendanceRecords(attendanceResponse);
        setNotices(noticeResponse);
        setLoadError('');
      } catch (error) {
        setTeachers([]);
        setStudents([]);
        setClassTimetables([]);
        setAttendanceRecords([]);
        setNotices([]);
        setLoadError(error.message || 'Unable to load dashboard data.');
      }
    };

    if (session?.role === 'teacher') {
      loadData();
    }
  }, [session]);

  if (!session || session.role !== 'teacher') return null;

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20 font-sans text-slate-900">
      <header className="sticky top-0 z-50 h-20 border-b border-slate-100 bg-white">
        <div className="mx-auto flex h-full max-w-screen-2xl items-center justify-between px-6 md:px-12 lg:px-20">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-600 p-1.5 shadow-sm">
              <GraduationCap size={20} className="text-white" />
            </div>
            <span className="hidden font-black uppercase italic tracking-tighter text-emerald-800 sm:block sm:text-xl">EduStream</span>
          </div>

          <div className="flex items-center gap-4 lg:gap-8">
            <div className="flex items-center gap-3 border-r border-slate-100 pr-4 lg:gap-6 lg:pr-8">
              <button className="rounded-full bg-slate-50 p-2 text-slate-400 transition-all hover:text-blue-600">
                <Bell size={18} />
              </button>
              <div className="hidden text-right md:block">
                <p className="text-[10px] font-black uppercase text-slate-400">{teacherName}</p>
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-700">
                  Teacher Session
                </span>
              </div>
              <button className="rounded-lg bg-slate-50 p-2 text-slate-400 transition-all hover:text-blue-600">
                <Settings size={18} />
              </button>
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
            <UserRound size={38} className="text-emerald-700" />
            Teacher Dashboard
          </h1>
          <p className="mt-4 text-sm font-semibold text-slate-500">
            {session.instituteName} | {teacher?.employeeId || 'Employee ID pending'} | {teacher?.specialization || 'Subject not assigned'}
          </p>
        </div>

        <section className="mb-12 overflow-hidden rounded-[2.5rem] bg-[linear-gradient(145deg,#0f172a_0%,#0f766e_52%,#14532d_100%)] px-8 py-8 text-white shadow-[0_30px_80px_-40px_rgba(15,23,42,0.85)] md:px-12 md:py-10">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-emerald-200">Teacher Portal</p>
              <h2 className="mt-4 max-w-3xl font-serif text-4xl font-black italic leading-none tracking-tight">
                Welcome {teacherName}, manage your classroom work from one focused dashboard.
              </h2>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-emerald-50/80">
                Your account is created by the college admin. Use your teacher ID or phone number with the password provided by the college to access attendance, timetable, examination duty, and class-related records.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <MetricCard label="Attendance Today" value={todayAttendanceCount} icon={CheckCircle2} />
              <MetricCard label="Exam Duty" value={upcomingExamCount} icon={Shield} />
              <MetricCard label="Students In Class" value={assignedStudents.length} icon={CalendarDays} />
              <MetricCard label="Salary This Month" value={currentSalaryStatus?.isPaid ? 'Paid' : 'Pending'} icon={Banknote} />
              <MetricCard label="Notices" value={portalNotices.length} icon={Megaphone} />
            </div>
          </div>
        </section>

        <section className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-10 lg:grid-cols-3">
          <NoticeSummaryCard
            notices={portalNotices}
            onClick={() => navigate('/teacher/notices')}
          />
          <ModuleCard
            icon={<CalendarDays className="text-emerald-700" size={42} />}
            title="Attendance"
            desc="Open your teacher attendance page to mark and review attendance for assigned classes."
            onClick={() => navigate('/teacher/attendance')}
          />
          <ModuleCard
            icon={<BookOpen className="text-blue-700" size={42} />}
            title="Timetable"
            desc="Open your teacher timetable page with class periods and examination schedule."
            onClick={() => navigate('/teacher/timetable')}
          />
          <ModuleCard
            icon={<FileText className="text-indigo-700" size={42} />}
            title="Examinations"
            desc="Review exam duty, datesheets, question papers, and classroom invigilation work."
            onClick={() => navigate('/teacher/examinations')}
          />
          <ModuleCard
            icon={<ClipboardPenLine className="text-amber-700" size={42} />}
            title="Marks"
            desc="Open your assigned classes, choose a subject, and upload marks for conducted exams."
            onClick={() => navigate('/teacher/marks')}
          />
          <ModuleCard
            icon={<UserRound className="text-teal-700" size={42} />}
            title="My Profile"
            desc={`Teacher ID ${teacher?.teacherSystemId || 'Pending'} | Salary ${currentSalaryStatus?.isPaid ? 'paid' : 'pending'} this month`}
            onClick={() => navigate('/teacher/profile')}
          />
          <ModuleCard
            icon={<Banknote className="text-emerald-700" size={42} />}
            title="My Salary"
            desc={`See whether ${currentSalaryStatus?.monthKey ? 'this month' : 'your'} salary is paid or pending.`}
            onClick={() => navigate('/teacher/salary')}
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
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-50/80">{label}</p>
        <p className="mt-3 text-3xl font-black tracking-tight text-white">{value}</p>
      </div>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-200/20 bg-emerald-200/10 text-emerald-50">
        {React.createElement(icon, { size: 20 })}
      </div>
    </div>
  </div>
);

const NoticeSummaryCard = ({ notices, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex w-full flex-col rounded-4xl border border-emerald-100 bg-white p-8 text-left shadow-xl shadow-emerald-100/50 transition-all duration-300 hover:-translate-y-3 hover:scale-105 hover:shadow-2xl md:rounded-[2.5rem] md:p-10"
  >
    <div className="flex items-start justify-between gap-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-700 transition group-hover:bg-emerald-600 group-hover:text-white">
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
    <span className="mt-6 text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700">Open Notice Board</span>
  </button>
);

const ModuleCard = ({ icon, title, desc, onClick }) => (
  <button
    onClick={onClick}
    className="group flex w-full flex-col items-center rounded-4xl border border-slate-100 bg-white p-8 text-center shadow-xl shadow-slate-200/40 transition-all duration-300 hover:-translate-y-3 hover:scale-105 hover:shadow-2xl md:rounded-[2.5rem] md:p-12"
  >
    <div className="mb-6 transition-transform group-hover:scale-110 md:mb-8">
      {icon}
    </div>
    <h3 className="mb-2 text-xl font-bold tracking-tight text-slate-800 md:mb-3 md:text-2xl">{title}</h3>
    <p className="max-w-60 text-xs leading-relaxed text-slate-500 md:text-sm">{desc}</p>
  </button>
);

const deriveTeacherClassesFromTimetables = (classTimetables, teacher) => {
  if (!teacher) return [];

  const teacherKeys = buildTeacherIdentityKeys(teacher);
  const classSet = new Set();

  classTimetables.forEach((record) => {
    if (attendanceTeacherMatches(record, teacherKeys) && record.className) {
      classSet.add(record.className);
    }
  });

  return [...classSet];
};

const resolveTimetableAttendanceTeacher = (record) => String(
  record?.templateData?.attendanceTeacher
    || record?.templateMeta?.attendanceTeacher
    || '',
).trim();

const attendanceTeacherMatches = (record, teacherKeys) => {
  const attendanceTeacher = normalizeTeacherValue(resolveTimetableAttendanceTeacher(record));
  return Boolean(attendanceTeacher) && teacherKeys.some((key) => key === attendanceTeacher);
};

const buildTeacherIdentityKeys = (teacher) => {
  const fullName = `${teacher?.firstName || ''} ${teacher?.lastName || ''}`.trim();
  return [
    fullName,
    teacher?.teacherSystemId,
    teacher?.employeeId,
    fullName && teacher?.teacherSystemId ? `${fullName} (${teacher.teacherSystemId})` : '',
    fullName && teacher?.employeeId ? `${fullName} (${teacher.employeeId})` : '',
  ]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean);
};

const normalizeTeacherValue = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

export default TeacherDashboard;
