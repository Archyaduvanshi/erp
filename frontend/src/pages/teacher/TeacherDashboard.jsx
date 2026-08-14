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
import { attendanceApi, holidayApi, noticeApi, studentApi, teacherApi, timetableApi } from '../../utils/api';
import { getCurrentMonthSalaryStatus, normalizeTeacherSalary } from '../../utils/salaryUtils';
import { formatNoticeDate, getPortalNotices } from '../../utils/noticeUtils';

const HOLIDAY_NOTICE_EVENT = 'holiday-notice-updated';
const HOLIDAY_NOTICE_STORAGE_KEY = 'holiday_notice_updated_at';

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const [session] = useState(() => JSON.parse(localStorage.getItem('active_session')) || null);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [classTimetables, setClassTimetables] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [examSlots] = useState(() => db.getAll('timetable_exam_slots'));
  const [notices, setNotices] = useState([]);
  const [holidays, setHolidays] = useState([]);
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
  const teacherSubjectsByClass = useMemo(() => deriveTeacherSubjectsByClass(classTimetables, teacher), [classTimetables, teacher]);

  const assignedStudents = useMemo(() => {
    if (!teachingClasses.length) return [];
    return students.filter((student) => teachingClasses.includes(student.assignedClass));
  }, [students, teachingClasses]);

  const teacherAttendance = useMemo(() => {
    if (!teachingClasses.length) return [];
    return attendanceRecords
      .filter((record) => teachingClasses.includes(record.className))
      .filter((record) => {
        const allowedSubjects = teacherSubjectsByClass[record.className] || [];
        return allowedSubjects.some((subjectName) => normalizeTeacherValue(subjectName) === normalizeTeacherValue(record.subject));
      });
  }, [attendanceRecords, teacherSubjectsByClass, teachingClasses]);

  const teacherExamDuty = useMemo(() => {
    if (!teacherName) return [];
    return examSlots.filter((slot) => slot.invigilatorName === teacherName);
  }, [examSlots, teacherName]);

  const today = new Date().toISOString().split('T')[0];
  const todayAttendanceCount = teacherAttendance.filter((record) => record.date === today).length;
  const upcomingExamCount = teacherExamDuty.filter((slot) => slot.examDate >= today).length;
  const currentSalaryStatus = getCurrentMonthSalaryStatus(teacher);
  const portalNotices = useMemo(() => getPortalNotices(notices, 'teacher', '', holidays), [holidays, notices]);

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
        const [teacherResponse, studentResponse, timetableResponse, attendanceResponse, noticeResponse, holidayResponse] = await Promise.all([
          teacherApi.getAll(),
          studentApi.getAll(),
          timetableApi.getClassTimetables(),
          attendanceApi.getAll(),
          noticeApi.getAll(),
          holidayApi.getAll(),
        ]);
        setTeachers(teacherResponse);
        setStudents(studentResponse);
        setClassTimetables(timetableResponse);
        setAttendanceRecords(attendanceResponse);
        setNotices(noticeResponse);
        setHolidays(holidayResponse);
        setLoadError('');
      } catch (error) {
        setTeachers([]);
        setStudents([]);
        setClassTimetables([]);
        setAttendanceRecords([]);
        setNotices([]);
        setHolidays([]);
        setLoadError(error.message || 'Unable to load dashboard data.');
      }
    };

    if (session?.role === 'teacher') {
      loadData();
    }
  }, [session]);

  useEffect(() => {
    if (!session || session.role !== 'teacher') return undefined;

    let isMounted = true;
    const refreshHolidays = async () => {
      try {
        const holidayResponse = await holidayApi.getAll();
        if (isMounted) setHolidays(holidayResponse);
      } catch {
        // Keep the last good holiday list if a background refresh fails.
      }
    };
    const handleStorage = (event) => {
      if (event.key === HOLIDAY_NOTICE_STORAGE_KEY) refreshHolidays();
    };

    window.addEventListener(HOLIDAY_NOTICE_EVENT, refreshHolidays);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', refreshHolidays);
    const intervalId = window.setInterval(refreshHolidays, 10000);

    return () => {
      isMounted = false;
      window.removeEventListener(HOLIDAY_NOTICE_EVENT, refreshHolidays);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', refreshHolidays);
      window.clearInterval(intervalId);
    };
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
    const template = readTeacherTimetableTemplate(record);
    const hasTeacherSlot = template?.rows?.some((row) =>
      (row.slots || []).some((slot) => slotMatchesTeacher(slot, teacherKeys)),
    );

    if (hasTeacherSlot && record.className) {
      classSet.add(record.className);
    }
  });

  return [...classSet];
};

const deriveTeacherSubjectsByClass = (classTimetables, teacher) => {
  if (!teacher) return {};

  const teacherKeys = buildTeacherIdentityKeys(teacher);
  return classTimetables.reduce((accumulator, record) => {
    const template = readTeacherTimetableTemplate(record);
    if (!record?.className || !template?.rows?.length) return accumulator;

    const subjectSet = new Set();
    template.rows.forEach((row) => {
      (row.slots || []).forEach((slot) => {
        if (!slotMatchesTeacher(slot, teacherKeys)) return;
        const subjectName = String(slot?.subjectName || '').trim();
        if (subjectName) subjectSet.add(subjectName);
      });
    });

    if (subjectSet.size) {
      accumulator[record.className] = [...subjectSet].sort((left, right) => left.localeCompare(right));
    }

    return accumulator;
  }, {});
};

const readTeacherTimetableTemplate = (record) => {
  if (record?.templateData?.rows?.length && record?.templateData?.lecturePlan?.length) {
    return record.templateData;
  }

  if (record?.fileType === 'text/html' && typeof window !== 'undefined') {
    return parseTemplateFromHtmlDataUri(record.fileData, record.className);
  }

  return null;
};

const parseTemplateFromHtmlDataUri = (dataUri, className) => {
  const html = decodeTimetableHtml(dataUri);
  if (!html) return null;

  const parser = new DOMParser();
  const documentNode = parser.parseFromString(html, 'text/html');
  const table = documentNode.querySelector('table');
  if (!table) return null;

  const rows = Array.from(table.querySelectorAll('tr'));
  if (rows.length < 3) return null;

  const headerCells = Array.from(rows[1].querySelectorAll('th'));
  const lecturePlan = headerCells.slice(1)
    .map((cell) => {
      const text = cell.textContent?.replace(/\s+/g, ' ').trim() || '';
      const lectureMatch = text.match(/Lecture\s+(\d+)/i);
      if (!lectureMatch) return null;
      const timeMatch = text.match(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
      return {
        lectureNumber: Number(lectureMatch[1]),
        timeFrom: timeMatch?.[1] || '',
        timeTo: timeMatch?.[2] || '',
      };
    })
    .filter(Boolean);

  const routineRows = rows.slice(2)
    .map((rowNode) => {
      const cells = Array.from(rowNode.querySelectorAll('td'));
      if (!cells.length) return null;

      const day = cells[0]?.textContent?.trim();
      if (!day) return null;

      const slotCells = cells.filter((cell, index) => {
        if (index === 0) return false;
        return !/Lunch/i.test(cell.textContent || '');
      });

      return {
        day,
        slots: lecturePlan.map((_, slotIndex) => {
          const slotCell = slotCells[slotIndex];
          const slotText = slotCell?.textContent?.replace(/\s+/g, ' ').trim() || '';
          return {
            subjectName: extractSlotValue(slotText, 'S'),
            teacherName: extractSlotValue(slotText, 'T'),
          };
        }),
      };
    })
    .filter(Boolean);

  if (!lecturePlan.length || !routineRows.length) return null;

  return {
    className,
    lecturePlan,
    rows: routineRows,
  };
};

const decodeTimetableHtml = (dataUri) => {
  if (!dataUri || typeof dataUri !== 'string') return '';
  const prefix = 'data:text/html;charset=utf-8,';
  if (!dataUri.startsWith(prefix)) return '';

  try {
    return decodeURIComponent(dataUri.slice(prefix.length));
  } catch {
    return '';
  }
};

const extractSlotValue = (slotText, key) => {
  const expression = new RegExp(`${key}:\\s*(.*?)(?=\\s+[A-Z]:|$)`, 'i');
  return slotText.match(expression)?.[1]?.trim() || '';
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

const slotMatchesTeacher = (slot, teacherKeys) => {
  const teacherValue = String(slot?.teacherName || '').trim().toLowerCase();
  return Boolean(teacherValue) && teacherKeys.some((key) => key === teacherValue);
};

const normalizeTeacherValue = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

export default TeacherDashboard;
