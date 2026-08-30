import React, { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  UserRound,
} from 'lucide-react';
import { teacherApi } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

const FEATURE_CARDS = {
  admissionStudent: { title: 'Student Management', route: '/college/students', icon: UserRound, tone: 'text-cyan-700' },
  teacher: { title: 'Teacher Management', route: '/college/teachers', icon: GraduationCap, tone: 'text-violet-700' },
  library: { title: 'Library Management', route: '/college/library', icon: BookOpen, tone: 'text-blue-700' },
  hostel: { title: 'Hostel Management', route: '/college/hostel', icon: Pin, tone: 'text-emerald-700' },
  fees: { title: 'Fees Management', route: '/college/fees', icon: Banknote, tone: 'text-amber-700' },
  transport: { title: 'Transport Management', route: '/college/transport', icon: CalendarDays, tone: 'text-sky-700' },
  attendance: { title: 'Attendance Management', route: '/college/attendance', icon: CheckCircle2, tone: 'text-emerald-700' },
  courses: { title: 'Course & Subject', route: '/college/courses', icon: BookOpen, tone: 'text-indigo-700' },
  examinations: { title: 'Examination Management', route: '/college/examinations', icon: FileText, tone: 'text-rose-700' },
  timetable: { title: 'Timetable Management', route: '/college/timetable', icon: CalendarDays, tone: 'text-teal-700' },
  salary: { title: 'Salary Management', route: '/college/salary', icon: Banknote, tone: 'text-emerald-700' },
  notices: { title: 'Notice Management', route: '/college/notices', icon: Megaphone, tone: 'text-orange-700' },
  holidays: { title: 'Holiday Management', route: '/college/holidays', icon: CalendarDays, tone: 'text-pink-700' },
};

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const { session, logout } = useAuth();
  const dashboardQuery = useQuery({
    queryKey: ['teacher', 'dashboard'],
    queryFn: teacherApi.getMyDashboard,
    enabled: session?.role === 'teacher',
    staleTime: 60 * 1000,
  });

  const dashboard = dashboardQuery.data || {};
  const teacherName = dashboard.teacherName || 'Teacher';
  const assignedStudentCount = Number(dashboard.assignedStudentCount) || 0;
  const todayAttendanceCount = Number(dashboard.todayPresent) || 0;
  const salaryStatus = String(dashboard.salaryStatus || 'NOT_GENERATED').toUpperCase();
  const salaryPaid = salaryStatus === 'PAID' || Number(dashboard.salaryOutstanding || 0) <= 0 && Number(dashboard.salaryNetPayable || 0) > 0;
  const portalNotices = Array.isArray(dashboard.latestNotices) ? dashboard.latestNotices : [];
  const noticeCount = Number(dashboard.noticeCount) || 0;
  const assignedFeatureCards = useMemo(() => (
    (session?.assignedFeatures || [])
      .filter((feature) => feature?.enabled && FEATURE_CARDS[feature.feature])
      .map((feature) => ({ ...feature, ...FEATURE_CARDS[feature.feature] }))
  ), [session?.assignedFeatures]);

  const handleLogout = () => {
    logout().finally(() => navigate('/login'));
  };

  useEffect(() => {
    if (!session || session.role !== 'teacher') {
      navigate('/login');
    }
  }, [navigate, session]);

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
        {dashboardQuery.error ? (
          <div className="mb-6 rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
            {dashboardQuery.error.message || 'Unable to load dashboard data.'}
          </div>
        ) : null}
        <div className="mb-10 px-4 text-center">
          <h1 className="flex flex-wrap items-center justify-center gap-3 text-3xl font-black tracking-tighter text-slate-950 md:gap-4 md:text-5xl">
            <UserRound size={38} className="text-emerald-700" />
            Teacher Dashboard
          </h1>
          <p className="mt-4 text-sm font-semibold text-slate-500">
            {session.instituteName} | {dashboard.employeeId || 'Employee ID pending'} | {dashboard.specialization || 'Subject not assigned'}
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
              <MetricCard label="Assigned Students" value={assignedStudentCount} icon={CalendarDays} />
              <MetricCard label="Salary This Month" value={salaryPaid ? 'Paid' : 'Pending'} icon={Banknote} />
              <MetricCard label="Notices" value={noticeCount} icon={Megaphone} />
            </div>
          </div>
        </section>

        <section className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-10 lg:grid-cols-3">
          <NoticeSummaryCard
            notices={portalNotices}
            noticeCount={noticeCount}
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
            desc={`Employee ID ${dashboard.employeeId || 'Pending'} | Salary ${salaryPaid ? 'paid' : 'pending'} this month`}
            onClick={() => navigate('/teacher/profile')}
          />
          <ModuleCard
            icon={<Banknote className="text-emerald-700" size={42} />}
            title="My Salary"
            desc={`See whether ${dashboard.salaryMonthKey ? 'this month' : 'your'} salary is paid or pending.`}
            onClick={() => navigate('/teacher/salary')}
          />
          {assignedFeatureCards.map((feature) => {
            const Icon = feature.icon;
            const operationLabel = feature.operation === 'read_write' ? 'Read + Write access' : 'Read only access';
            return (
              <ModuleCard
                key={`${feature.feature}-${feature.teacherId || session.teacherId}`}
                icon={<Icon className={feature.tone} size={42} />}
                title={feature.title}
                desc={`${operationLabel}. Open assigned management feature from your teacher dashboard.`}
                onClick={() => navigate(feature.route)}
              />
            );
          })}
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

const NoticeSummaryCard = ({ notices, noticeCount, onClick }) => (
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
        {noticeCount} Live
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

export default TeacherDashboard;
