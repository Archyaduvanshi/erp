import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Clock3,
  Search,
} from 'lucide-react';
import { db } from '../../utils/db';
import { attendanceApi, studentApi } from '../../utils/api';

const StudentAttendance = () => {
  const navigate = useNavigate();
  const [session] = useState(() => JSON.parse(localStorage.getItem('active_session')) || null);
  const [student, setStudent] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [holidays, setHolidays] = useState(() => db.getAll('holiday_calendar'));
  const [searchValue, setSearchValue] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [loadError, setLoadError] = useState('');

  const studentName = student
    ? `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.enrollmentNo || student.systemId || 'Student'
    : 'Student';

  const studentRecords = useMemo(() => {
    if (!student) return [];

    const studentKeys = [student.systemId, student.enrollmentNo, String(student.id)]
      .filter(Boolean)
      .map((value) => String(value));
    const query = searchValue.trim().toLowerCase();

    return attendanceRecords
      .filter((record) => {
        const recordStudentId = String(record.studentId || '');
        const recordRollNo = String(record.rollNo || '');
        const recordName = String(record.studentName || '').trim().toLowerCase();
        return (
          studentKeys.includes(recordStudentId) ||
          studentKeys.includes(recordRollNo) ||
          recordName === studentName.toLowerCase()
        );
      })
      .filter((record) => {
        if (!query) return true;
        return (
          String(record.date || '').toLowerCase().includes(query) ||
          String(record.className || '').toLowerCase().includes(query) ||
          String(record.subject || '').toLowerCase().includes(query) ||
          String(record.status || '').toLowerCase().includes(query) ||
          String(record.markedBy || '').toLowerCase().includes(query) ||
          String(record.lectureNumber || '').toLowerCase().includes(query)
        );
      })
      .sort((a, b) => new Date(b.createdAt || b.date || 0).getTime() - new Date(a.createdAt || a.date || 0).getTime());
  }, [attendanceRecords, searchValue, student, studentName]);

  const today = new Date().toISOString().split('T')[0];
  const todayRecords = studentRecords.filter((record) => record.date === today);
  const presentCount = studentRecords.filter((record) => record.status === 'Present').length;
  const absentCount = studentRecords.filter((record) => record.status === 'Absent').length;
  const attendanceRate = studentRecords.length ? Math.round((presentCount / studentRecords.length) * 100) : 0;

  const attendanceMonthOptions = useMemo(() => {
    const monthSet = new Set(studentRecords
      .map((record) => String(record.date || '').slice(0, 7))
      .filter(Boolean));
    monthSet.add(new Date().toISOString().slice(0, 7));
    return [...monthSet].sort((left, right) => right.localeCompare(left));
  }, [studentRecords]);

  useEffect(() => {
    if (!attendanceMonthOptions.length) return;
    if (!attendanceMonthOptions.includes(selectedMonth)) {
      setSelectedMonth(attendanceMonthOptions[0]);
    }
  }, [attendanceMonthOptions, selectedMonth]);

  const monthlyAttendanceRegister = useMemo(() => {
    if (!student || !studentRecords.length) return null;

    const monthValue = selectedMonth || attendanceMonthOptions[0];
    if (!monthValue) return null;

    const [yearValue, monthValueIndex] = monthValue.split('-').map(Number);
    if (!yearValue || !monthValueIndex) return null;

    const selectedYear = yearValue;
    const selectedMonthIndex = monthValueIndex - 1;
    const monthRecords = studentRecords
      .filter((record) => {
        const recordDate = new Date(`${record.date || ''}T00:00:00`);
        return recordDate.getFullYear() === selectedYear && recordDate.getMonth() === selectedMonthIndex;
      })
      .sort((a, b) => new Date(a.createdAt || a.date || 0).getTime() - new Date(b.createdAt || b.date || 0).getTime());

    const currentDate = new Date();
    const isCurrentMonth = currentDate.getFullYear() === selectedYear && currentDate.getMonth() === selectedMonthIndex;
    const daysInMonth = new Date(selectedYear, selectedMonthIndex + 1, 0).getDate();
    const visibleDayCount = isCurrentMonth ? currentDate.getDate() : daysInMonth;
    const dayColumns = Array.from({ length: visibleDayCount }, (_, index) => index + 1);
    const holidayColumnMap = new Map();

    dayColumns.forEach((dayNumber) => {
      const dayDateValue = formatMonthDateKey(selectedYear, selectedMonthIndex + 1, dayNumber);
      const matchingHoliday = holidays.find((holiday) => String(holiday.holidayDate || '') === dayDateValue);
      if (matchingHoliday?.title) {
        holidayColumnMap.set(dayNumber, matchingHoliday.title);
        return;
      }

      const dayDate = new Date(selectedYear, selectedMonthIndex, dayNumber);
      if (dayDate.toLocaleDateString('en-US', { weekday: 'long' }) === 'Sunday') {
        holidayColumnMap.set(dayNumber, 'Sunday');
      }
    });

    const dailyStatusMap = new Map();
    monthRecords.forEach((record) => {
      const recordDate = new Date(`${record.date || ''}T00:00:00`);
      const dayNumber = recordDate.getDate();
      if (dayNumber > visibleDayCount || holidayColumnMap.has(dayNumber)) return;
      dailyStatusMap.set(dayNumber, record.status === 'Present' ? 'P' : 'A');
    });

    return {
      studentName,
      monthLabel: new Date(selectedYear, selectedMonthIndex, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
      dayColumns,
      holidayColumnMap,
      days: dayColumns.map((dayNumber) => dailyStatusMap.get(dayNumber) || ''),
    };
  }, [attendanceMonthOptions, holidays, selectedMonth, student, studentName, studentRecords]);

  useEffect(() => {
    if (!session || session.role !== 'student') {
      navigate('/login');
      return;
    }

    const loadData = async () => {
      try {
        const [studentResponse, attendanceResponse] = await Promise.all([
          studentApi.getById(session.studentId),
          attendanceApi.getAll(),
        ]);
        setStudent(studentResponse);
        setAttendanceRecords(attendanceResponse);
        setHolidays(db.getAll('holiday_calendar'));
        setLoadError('');
      } catch (error) {
        setStudent(null);
        setAttendanceRecords([]);
        setLoadError(error.message || 'Unable to load attendance data.');
      }
    };

    loadData();
  }, [navigate, session]);

  if (!session || session.role !== 'student') return null;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eefbf4_44%,#f8fafc_100%)] text-slate-900">
      <div className="border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/student')}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 transition hover:border-emerald-300 hover:text-emerald-700"
            >
              <ArrowLeft size={14} />
              Back
            </button>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-emerald-600">Student Attendance</p>
              <h1 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">My Attendance Record</h1>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-10 lg:py-10">
        {loadError ? (
          <div className="mb-6 rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
            {loadError}
          </div>
        ) : null}
        <section className="rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">Saved Attendance Register</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Search your attendance by date, class, subject, teacher, lecture, or status.
              </p>
            </div>
            <SearchInput value={searchValue} onChange={setSearchValue} placeholder="Search date, subject, teacher..." />
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <HighlightCard label="Today Records" value={todayRecords.length} icon={CalendarDays} tone="emerald" />
            <HighlightCard label="Class" value={student?.assignedClass || 'Not assigned'} icon={BookOpen} tone="slate" />
            <HighlightCard label="Student ID" value={student?.enrollmentNo || student?.systemId || 'Pending'} icon={Clock3} tone="slate" />
          </div>

          {monthlyAttendanceRegister ? (
            <div className="mt-8 overflow-hidden rounded-[1.8rem] border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-lg font-black tracking-tight text-slate-950">{monthlyAttendanceRegister.studentName}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-600">
                      Month: {monthlyAttendanceRegister.monthLabel}
                    </p>
                  </div>
                  <label className="space-y-2">
                    <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Select Month</span>
                    <input
                      type="month"
                      value={selectedMonth}
                      min={attendanceMonthOptions[attendanceMonthOptions.length - 1] || undefined}
                      max={attendanceMonthOptions[0] || undefined}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    />
                  </label>
                </div>
              </div>
              <div className="mx-auto w-full max-w-[72rem] overflow-x-auto">
                <table className="w-max min-w-full border-collapse text-center">
                  <thead>
                    <tr className="bg-slate-950 text-white">
                      <th className="sticky left-0 z-10 min-w-64 border-b border-r border-slate-800 bg-slate-950 px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.2em]">
                        Student
                      </th>
                      {monthlyAttendanceRegister.dayColumns.map((dayNumber) => (
                        <th
                          key={`day-${dayNumber}`}
                          className="min-w-16 border-b border-l border-slate-800 px-3 py-3 text-[11px] font-black uppercase tracking-[0.18em]"
                        >
                          {dayNumber}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-white">
                      <td className="sticky left-0 z-10 min-w-64 border-b border-r border-slate-200 bg-white px-4 py-4 text-left text-sm font-black text-slate-950">
                        {monthlyAttendanceRegister.studentName}
                      </td>
                      {monthlyAttendanceRegister.days.map((value, index) => {
                        const dayNumber = monthlyAttendanceRegister.dayColumns[index];
                        const holidayLabel = monthlyAttendanceRegister.holidayColumnMap?.get(dayNumber);

                        if (holidayLabel) {
                          return (
                            <td
                              key={`holiday-${dayNumber}`}
                              className="min-w-16 border-b border-l border-slate-200 bg-amber-50 px-2 py-3"
                            >
                              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-700">
                                {holidayLabel}
                              </span>
                            </td>
                          );
                        }

                        return (
                          <td
                            key={`status-${dayNumber}`}
                            className={`min-w-16 border-b border-l border-slate-200 px-3 py-3 text-sm font-black ${
                              value === 'P'
                                ? 'text-emerald-700'
                                : value === 'A'
                                  ? 'text-rose-700'
                                  : 'text-slate-300'
                            }`}
                          >
                            {value || '-'}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <EmptyState
              title="No attendance found"
              description="No attendance records are linked to this student yet. Once a teacher saves attendance for your class, it will appear here."
            />
          )}
        </section>
      </main>
    </div>
  );
};

const SearchInput = ({ value, onChange, placeholder }) => (
  <div className="relative w-full lg:w-80">
    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-12 py-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
    />
  </div>
);

const HighlightCard = ({ label, value, icon: Icon, tone }) => (
  <div className={`rounded-[1.6rem] border p-5 ${tone === 'emerald' ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
        <p className="mt-3 text-lg font-black tracking-tight text-slate-900">{value}</p>
      </div>
      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tone === 'emerald' ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-slate-700'}`}>
        <Icon size={18} />
      </div>
    </div>
  </div>
);

const EmptyState = ({ title, description }) => (
  <div className="mt-8 rounded-4xl border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center">
    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-white text-slate-300 shadow-sm">
      <BookOpen size={34} />
    </div>
    <h3 className="mt-6 font-serif text-3xl font-black italic tracking-tight text-slate-950">{title}</h3>
    <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-500">{description}</p>
  </div>
);

const formatMonthDateKey = (year, month, day) => {
  const monthValue = String(month).padStart(2, '0');
  const dayValue = String(day).padStart(2, '0');
  return `${year}-${monthValue}-${dayValue}`;
};

export default StudentAttendance;
