import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Search,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import { db } from '../../utils/db';
import { attendanceApi, holidayApi, studentApi, teacherApi, timetableApi } from '../../utils/api';
import { holidayAppliesToStudentClass } from '../../utils/noticeUtils';

const AttendanceManagement = () => {
  const navigate = useNavigate();
  const [session] = useState(() => JSON.parse(localStorage.getItem('active_session')) || null);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [teacherAttendanceRecords, setTeacherAttendanceRecords] = useState([]);
  const [classTimetables, setClassTimetables] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [activeSection, setActiveSection] = useState(() => (session?.role === 'teacher' ? 'student' : ''));
  const [selectedClass, setSelectedClass] = useState('');
  const [classSearch, setClassSearch] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [teacherAttendanceDate, setTeacherAttendanceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [teacherAttendanceMonth, setTeacherAttendanceMonth] = useState('');
  const [teacherSearch, setTeacherSearch] = useState('');
  const [teacherAttendanceMap, setTeacherAttendanceMap] = useState({});
  const [loadError, setLoadError] = useState('');

  const refreshData = async () => {
    const [studentResponse, teacherResponse, timetableResponse, attendanceResponse, holidayResponse] = await Promise.all([
      studentApi.getAll(),
      teacherApi.getAll(),
      timetableApi.getClassTimetables(),
      attendanceApi.getAll(),
      holidayApi.getAll(),
    ]);
    setStudents(studentResponse);
    setTeachers(teacherResponse);
    setAttendanceRecords(attendanceResponse);
    setClassTimetables(timetableResponse);
    setTeacherAttendanceRecords(db.getAll('teacher_attendance_records'));
    setHolidays(holidayResponse);
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        await refreshData();
        setLoadError('');
      } catch (error) {
        setStudents([]);
        setTeachers([]);
        setClassTimetables([]);
        setAttendanceRecords([]);
        setTeacherAttendanceRecords(db.getAll('teacher_attendance_records'));
        setLoadError(error.message || 'Unable to load attendance data.');
      }
    };

    loadData();
  }, []);

  const teacherSession = useMemo(() => {
    if (!session || session.role !== 'teacher') return null;
    return teachers.find((teacher) => String(teacher.id) === String(session.teacherId)) || null;
  }, [session, teachers]);

  const teacherName = teacherSession
    ? `${teacherSession.firstName || ''} ${teacherSession.lastName || ''}`.trim() || teacherSession.teacherSystemId || 'Teacher'
    : '';

  const teacherClassOptions = useMemo(() => deriveTeacherClassesFromTimetables(classTimetables, teacherSession), [classTimetables, teacherSession]);

  const classList = useMemo(() => {
    const classes = [...new Set(students.map((student) => student.assignedClass?.trim()).filter(Boolean))];
    const visibleClasses = teacherSession
      ? classes.filter((className) => teacherClassOptions.includes(className))
      : classes;
    return visibleClasses.sort(compareClassNames);
  }, [students, teacherClassOptions, teacherSession]);

  const filteredClasses = useMemo(() => {
    const query = classSearch.trim().toLowerCase();
    return classList.filter((className) => !query || className.toLowerCase().includes(query));
  }, [classList, classSearch]);

  const selectedClassStudents = useMemo(() => {
    return students
      .filter((student) => student.assignedClass === selectedClass)
      .sort((a, b) => {
        const nameA = `${a.firstName || ''} ${a.lastName || ''}`.trim().toLowerCase();
        const nameB = `${b.firstName || ''} ${b.lastName || ''}`.trim().toLowerCase();
        return nameA.localeCompare(nameB);
      });
  }, [selectedClass, students]);

  const teacherOptions = useMemo(() => {
    const visibleTeachers = selectedClass
      ? teachers.filter((teacher) => deriveTeacherClassesFromTimetables(classTimetables, teacher).includes(selectedClass))
      : teachers;

    return visibleTeachers
      .map((teacher) => ({
        id: teacher.id,
        name: `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim(),
        subject: teacher.specialization || '',
      }))
      .filter((teacher) => teacher.name)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [classTimetables, selectedClass, teachers]);

  useEffect(() => {
    setSelectedTeacher('');
    setSelectedMonth('');
  }, [selectedClass]);

  const today = new Date().toISOString().split('T')[0];
  const todayRecords = attendanceRecords.filter((record) => record.date === today);
  const presentCount = todayRecords.filter((record) => record.status === 'Present').length;
  const absentCount = todayRecords.filter((record) => record.status === 'Absent').length;

  const availableMonthOptions = useMemo(() => {
    const classMonthKeys = attendanceRecords
      .filter((record) => record.className === selectedClass)
      .filter((record) => !selectedTeacher || normalizeAttendanceText(record.markedBy) === normalizeAttendanceText(selectedTeacher))
      .map((record) => String(record.date || '').slice(0, 7))
      .filter((value) => /^\d{4}-\d{2}$/.test(value));

    return [...new Set(classMonthKeys)]
      .sort((a, b) => b.localeCompare(a))
      .map((value) => ({
        value,
        label: formatMonthKey(value),
      }));
  }, [attendanceRecords, selectedClass, selectedTeacher]);

  const monthlyAttendanceRegister = useMemo(() => {
    if (!selectedClass || !selectedTeacher) return null;

    const classRecords = attendanceRecords
      .filter((record) => record.className === selectedClass)
      .filter((record) => !selectedTeacher || normalizeAttendanceText(record.markedBy) === normalizeAttendanceText(selectedTeacher))
      .filter((record) => !Number.isNaN(new Date(`${record.date || ''}T00:00:00`).getTime()))
      .sort((a, b) => new Date(a.createdAt || a.date).getTime() - new Date(b.createdAt || b.date).getTime());

    const currentMonthKey = today.slice(0, 7);
    const fallbackMonthKey = classRecords.length ? String(classRecords[classRecords.length - 1].date).slice(0, 7) : '';
    const effectiveMonthKey = selectedMonth
      || (availableMonthOptions.some((option) => option.value === currentMonthKey) ? currentMonthKey : fallbackMonthKey);

    let recordsInWindow = classRecords.filter((record) => String(record.date || '').slice(0, 7) === effectiveMonthKey);

    if (!recordsInWindow.length && fallbackMonthKey) {
      recordsInWindow = classRecords.filter((record) => String(record.date || '').slice(0, 7) === fallbackMonthKey);
    }

    if (!recordsInWindow.length) return null;

    const [selectedYear, selectedMonthNumber] = String(effectiveMonthKey).split('-').map(Number);
    if (!selectedYear || !selectedMonthNumber) return null;

    const currentDate = new Date(`${today}T00:00:00`);
    const isCurrentMonth = currentDate.getFullYear() === selectedYear && currentDate.getMonth() + 1 === selectedMonthNumber;
    const daysInMonth = new Date(selectedYear, selectedMonthNumber, 0).getDate();
    const visibleDayCount = isCurrentMonth ? currentDate.getDate() : daysInMonth;
    const dayColumns = Array.from({ length: visibleDayCount }, (_, index) => index + 1);
    const holidayColumnMap = new Map();
    dayColumns.forEach((dayNumber) => {
      const dayDateValue = formatMonthDateKey(selectedYear, selectedMonthNumber, dayNumber);
      const matchingHoliday = holidays.find((holiday) => (
        String(holiday.holidayDate || '') === dayDateValue &&
        holidayAppliesToStudentClass(holiday, selectedClass)
      ));
      if (matchingHoliday?.title) {
        holidayColumnMap.set(dayNumber, matchingHoliday.title);
        return;
      }

      const dayDate = new Date(selectedYear, selectedMonthNumber - 1, dayNumber);
      if (dayDate.toLocaleDateString('en-US', { weekday: 'long' }) === 'Sunday') {
        holidayColumnMap.set(dayNumber, 'Sunday');
      }
    });

    const dailyStatusMap = new Map();
    recordsInWindow.forEach((record) => {
      const recordDate = new Date(`${record.date || ''}T00:00:00`);
      const dayNumber = recordDate.getDate();
      const studentKey = String(record.studentId || '');
      if (!studentKey || dayNumber > visibleDayCount || holidayColumnMap.has(dayNumber)) return;
      dailyStatusMap.set(`${studentKey}-${dayNumber}`, record.status === 'Present' ? 'P' : 'A');
    });

    const savedStudentsMap = new Map();
    recordsInWindow.forEach((record) => {
      const studentKey = String(record.studentId || record.rollNo || record.studentName || '');
      if (!studentKey || savedStudentsMap.has(studentKey)) return;
      savedStudentsMap.set(studentKey, {
        id: record.studentId || studentKey,
        name: record.studentName || 'Unnamed student',
        rollNo: record.rollNo || '-',
      });
    });

    selectedClassStudents.forEach((student) => {
      const studentKey = String(student.id);
      if (savedStudentsMap.has(studentKey)) return;
      savedStudentsMap.set(studentKey, {
        id: student.id,
        name: `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Unnamed student',
        rollNo: student.rollNo || student.enrollmentNo || student.systemId || String(student.id),
      });
    });

    const rows = [...savedStudentsMap.values()]
      .sort((a, b) => String(a.rollNo || '').localeCompare(String(b.rollNo || '')) || String(a.name || '').localeCompare(String(b.name || '')))
      .map((student) => ({
        id: student.id,
        name: student.name,
        days: dayColumns.map((dayNumber) => dailyStatusMap.get(`${student.id}-${dayNumber}`) || ''),
      }));

    return {
      schoolName: session?.instituteName || 'School Name',
      className: selectedClass,
      teacherLabel: selectedTeacher,
      classNumberLabel: selectedClass,
      monthLabel: formatMonthKey(effectiveMonthKey),
      dayColumns,
      holidayColumnMap,
      rows,
    };
  }, [
    attendanceRecords,
    availableMonthOptions,
    holidays,
    selectedClass,
    selectedClassStudents,
    selectedMonth,
    selectedTeacher,
    session?.instituteName,
    today,
  ]);

  const teachersSorted = useMemo(() => {
    return [...teachers].sort((a, b) => {
      const left = `${a.firstName || ''} ${a.lastName || ''}`.trim().toLowerCase();
      const right = `${b.firstName || ''} ${b.lastName || ''}`.trim().toLowerCase();
      return left.localeCompare(right);
    });
  }, [teachers]);

  const filteredTeacherRows = useMemo(() => {
    const query = teacherSearch.trim().toLowerCase();
    return teachersSorted.filter((teacher) => {
      if (!query) return true;
      const fullName = `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim().toLowerCase();
      return (
        fullName.includes(query)
        || String(teacher.teacherSystemId || '').toLowerCase().includes(query)
        || String(teacher.employeeId || '').toLowerCase().includes(query)
        || String(teacher.specialization || '').toLowerCase().includes(query)
      );
    });
  }, [teacherSearch, teachersSorted]);

  useEffect(() => {
    const existingForDate = teacherAttendanceRecords.filter((record) => record.date === teacherAttendanceDate);
    if (!existingForDate.length) {
      setTeacherAttendanceMap({});
      return;
    }

    const nextMap = existingForDate.reduce((accumulator, record) => {
      accumulator[String(record.teacherId)] = record.status;
      return accumulator;
    }, {});
    setTeacherAttendanceMap(nextMap);
  }, [teacherAttendanceDate, teacherAttendanceRecords]);

  const teacherAttendanceMonthOptions = useMemo(() => {
    const monthKeys = teacherAttendanceRecords
      .map((record) => String(record.date || '').slice(0, 7))
      .filter((value) => /^\d{4}-\d{2}$/.test(value));

    return [...new Set(monthKeys)]
      .sort((a, b) => b.localeCompare(a))
      .map((value) => ({ value, label: formatMonthKey(value) }));
  }, [teacherAttendanceRecords]);

  const teacherTodayRecords = teacherAttendanceRecords.filter((record) => record.date === teacherAttendanceDate);
  const teacherPresentCount = teacherTodayRecords.filter((record) => record.status === 'Present').length;
  const teacherAbsentCount = teacherTodayRecords.filter((record) => record.status === 'Absent').length;

  const teacherMonthlyRegister = useMemo(() => {
    if (!teachersSorted.length) return null;

    const currentMonthKey = teacherAttendanceDate.slice(0, 7);
    const fallbackMonthKey = teacherAttendanceMonthOptions[0]?.value || '';
    const effectiveMonthKey = teacherAttendanceMonth || currentMonthKey || fallbackMonthKey;
    if (!effectiveMonthKey) return null;

    const [selectedYear, selectedMonthNumber] = effectiveMonthKey.split('-').map(Number);
    if (!selectedYear || !selectedMonthNumber) return null;

    const daysInMonth = new Date(selectedYear, selectedMonthNumber, 0).getDate();
    const currentDate = new Date(`${today}T00:00:00`);
    const isCurrentMonth = currentDate.getFullYear() === selectedYear && currentDate.getMonth() + 1 === selectedMonthNumber;
    const visibleDayCount = isCurrentMonth ? currentDate.getDate() : daysInMonth;
    const dayColumns = Array.from({ length: visibleDayCount }, (_, index) => index + 1);
    const holidayColumnMap = new Map();

    dayColumns.forEach((dayNumber) => {
      const dayDateValue = formatMonthDateKey(selectedYear, selectedMonthNumber, dayNumber);
      const matchingHoliday = holidays.find((holiday) => (
        String(holiday.holidayDate || '') === dayDateValue &&
        (holiday.audience === 'All' || holiday.audience === 'Teachers')
      ));
      if (matchingHoliday?.title) {
        holidayColumnMap.set(dayNumber, matchingHoliday.title);
        return;
      }

      const dayDate = new Date(selectedYear, selectedMonthNumber - 1, dayNumber);
      if (dayDate.toLocaleDateString('en-US', { weekday: 'long' }) === 'Sunday') {
        holidayColumnMap.set(dayNumber, 'Sunday');
      }
    });

    const recordsForMonth = teacherAttendanceRecords.filter((record) => String(record.date || '').slice(0, 7) === effectiveMonthKey);
    const statusMap = new Map();
    recordsForMonth.forEach((record) => {
      const date = new Date(`${record.date || ''}T00:00:00`);
      const dayNumber = date.getDate();
      if (Number.isNaN(date.getTime()) || holidayColumnMap.has(dayNumber)) return;
      statusMap.set(`${record.teacherId}-${dayNumber}`, record.status === 'Present' ? 'P' : 'A');
    });

    const query = teacherSearch.trim().toLowerCase();
    const rows = teachersSorted
      .filter((teacher) => {
        if (!query) return true;
        const fullName = `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim().toLowerCase();
        return fullName.includes(query)
          || String(teacher.teacherSystemId || '').toLowerCase().includes(query)
          || String(teacher.employeeId || '').toLowerCase().includes(query);
      })
      .map((teacher) => ({
        id: teacher.id,
        name: `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim() || 'Unnamed teacher',
        employeeId: teacher.teacherSystemId || teacher.employeeId || '-',
        days: dayColumns.map((dayNumber) => statusMap.get(`${teacher.id}-${dayNumber}`) || ''),
      }));

    return {
      schoolName: session?.instituteName || 'School Name',
      monthLabel: formatMonthKey(effectiveMonthKey),
      dayColumns,
      holidayColumnMap,
      rows,
    };
  }, [holidays, session?.instituteName, teacherAttendanceDate, teacherAttendanceMonth, teacherAttendanceMonthOptions, teacherAttendanceRecords, teacherSearch, teachersSorted, today]);

  const openClassSheet = (className) => {
    setActiveSection('student');
    setSelectedClass(className);
    setSelectedTeacher('');
    setSelectedMonth('');
  };

  const handleBack = () => {
    if (activeSection === 'student' && selectedClass) {
      setSelectedClass('');
      return;
    }

    if (session?.role !== 'teacher' && activeSection) {
      setActiveSection('');
      setSelectedClass('');
      return;
    }

    navigate(session?.role === 'teacher' ? '/teacher' : '/college');
  };

  const handleTeacherStatusChange = (teacherId, status) => {
    setTeacherAttendanceMap((current) => ({
      ...current,
      [teacherId]: status,
    }));
  };

  const handleTeacherAttendanceSave = async (e) => {
    e.preventDefault();

    const unmarkedTeachers = teachersSorted.filter((teacher) => !teacherAttendanceMap[String(teacher.id)]);
    if (!teachersSorted.length || unmarkedTeachers.length > 0) return;

    const existingRecords = db.getAll('teacher_attendance_records');
    const preservedRecords = existingRecords.filter((record) => String(record.date) !== String(teacherAttendanceDate));
    const nextRecords = [
      ...preservedRecords,
      ...teachersSorted.map((teacher) => ({
        teacherId: teacher.id,
        teacherName: `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim() || 'Teacher',
        employeeId: teacher.teacherSystemId || teacher.employeeId || '',
        specialization: teacher.specialization || '',
        date: teacherAttendanceDate,
        status: teacherAttendanceMap[String(teacher.id)] || 'Absent',
        markedBy: session?.username || 'Admin',
      })),
    ];

    try {
      db.replaceAll('teacher_attendance_records', nextRecords);
      setTeacherAttendanceRecords(nextRecords);

      const updatedTeachers = await Promise.all(teachersSorted.map((teacher) => (
        teacherApi.update(teacher.id, {
          ...teacher,
          attendanceStatus: teacherAttendanceMap[String(teacher.id)] || teacher.attendanceStatus || 'Present',
        })
      )));

      setTeachers(updatedTeachers);
      db.replaceAll('teachers', updatedTeachers);
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Unable to save teacher attendance.');
    }
  };

  const studentViewTitle = selectedClass ? `${selectedClass} Attendance Sheet` : 'Student Attendance Register';
  const teacherViewTitle = 'Teacher Attendance Register';
  const pageTitle = !activeSection
    ? 'Attendance Management'
    : activeSection === 'student'
      ? studentViewTitle
      : teacherViewTitle;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#ecfdf5_48%,#f8fafc_100%)] text-slate-900">
      <div className="border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 transition hover:border-emerald-300 hover:text-emerald-700"
            >
              <ArrowLeft size={14} />
              {activeSection === 'student' && selectedClass ? 'Back to Classes' : activeSection && session?.role !== 'teacher' ? 'Back to Attendance Desk' : 'Back'}
            </button>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-emerald-600">Attendance Management</p>
              <h1 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">{pageTitle}</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10 lg:py-10">
        {loadError ? (
          <div className="mb-6 rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
            {loadError}
          </div>
        ) : null}

        <section className="overflow-hidden rounded-4xl bg-[linear-gradient(145deg,#052e16_0%,#14532d_55%,#022c22_100%)] px-7 py-8 text-white shadow-[0_30px_80px_-40px_rgba(20,83,45,0.8)] lg:px-10 lg:py-10">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-emerald-200">
                {activeSection === 'teacher' ? 'Teacher Attendance' : activeSection === 'student' ? 'Student Attendance' : 'Attendance Desk'}
              </p>
              <h2 className="mt-4 max-w-3xl font-serif text-4xl font-black italic leading-none tracking-tight">
                {!activeSection
                  ? 'Choose whether you want to open student attendance or teacher attendance.'
                  : activeSection === 'teacher'
                    ? 'Mark teacher presence date-wise and review the saved monthly register.'
                    : 'Select a class and review its saved student attendance register.'}
              </h2>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-emerald-50/80">
                {activeSection === 'teacher'
                  ? 'Teacher attendance is managed from the college dashboard and saved date-wise for the full staff roster.'
                  : teacherSession
                    ? `Only the classes assigned to ${teacherName || 'this teacher'} are shown here. Open any class to review its saved attendance register.`
                    : !activeSection
                      ? 'Student attendance keeps the current class-wise saved register logic. Teacher attendance gives you a separate staff attendance desk.'
                      : 'Open any class to review the saved attendance register month-wise. This page is now read-only for student attendance records.'}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {activeSection === 'teacher' ? (
                <>
                  <MetricCard label="Teachers" value={teachers.length} icon={Users} />
                  <MetricCard label="Marked Present" value={teacherPresentCount} icon={UserCheck} />
                  <MetricCard label="Marked Absent" value={teacherAbsentCount} icon={UserX} />
                  <MetricCard label="Saved Months" value={teacherAttendanceMonthOptions.length} icon={ClipboardCheck} />
                </>
              ) : (
                <>
                  <MetricCard label="Classes" value={classList.length} icon={BookOpen} />
                  <MetricCard label="Students" value={students.length} icon={Users} />
                  <MetricCard label="Today Present" value={presentCount} icon={CheckCircle2} />
                  <MetricCard label="Today Absent" value={absentCount} icon={UserX} />
                </>
              )}
            </div>
          </div>
        </section>

        {!activeSection ? (
          <section className="mt-8 rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
            <FormTitle title="Open Attendance Section" description="Choose which register you want to manage from the college dashboard." />
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              <button
                type="button"
                onClick={() => setActiveSection('student')}
                className="rounded-[1.8rem] border border-slate-200 bg-slate-50 p-6 text-left transition hover:-translate-y-1 hover:border-emerald-200 hover:bg-white hover:shadow-[0_18px_40px_-28px_rgba(16,185,129,0.35)]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <BookOpen size={20} />
                </div>
                <h3 className="mt-5 text-2xl font-black tracking-tight text-slate-950">Student Attendance</h3>
                <p className="mt-3 text-sm leading-7 text-slate-500">
                  Current class-wise student attendance register, teacher filter, subject filter, and monthly P/A sheet.
                </p>
                <span className="mt-5 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                  Open student register
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSection('teacher')}
                className="rounded-[1.8rem] border border-slate-200 bg-slate-50 p-6 text-left transition hover:-translate-y-1 hover:border-emerald-200 hover:bg-white hover:shadow-[0_18px_40px_-28px_rgba(16,185,129,0.35)]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <ClipboardCheck size={20} />
                </div>
                <h3 className="mt-5 text-2xl font-black tracking-tight text-slate-950">Teacher Attendance</h3>
                <p className="mt-3 text-sm leading-7 text-slate-500">
                  Mark daily teacher attendance for the full staff list and review the saved monthly teacher attendance register.
                </p>
                <span className="mt-5 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                  Open teacher register
                </span>
              </button>
            </div>
          </section>
        ) : null}

        {activeSection === 'student' ? (
          !selectedClass ? (
            <section className="mt-8 rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <FormTitle
                  title={teacherSession ? 'Teaching Classes' : 'Select Class'}
                  description={teacherSession
                    ? 'Open one of your assigned classes to review attendance.'
                    : 'Open any class to view its saved attendance register.'}
                />
                <SearchInput value={classSearch} onChange={setClassSearch} placeholder="Search class or section..." />
              </div>

              {filteredClasses.length > 0 ? (
                <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {filteredClasses.map((className) => {
                    const classStudents = students.filter((student) => student.assignedClass === className);
                    return (
                      <button
                        key={className}
                        onClick={() => openClassSheet(className)}
                        className="rounded-[1.8rem] border border-slate-200 bg-slate-50 p-6 text-left transition hover:-translate-y-1 hover:border-emerald-200 hover:bg-white hover:shadow-[0_18px_40px_-28px_rgba(16,185,129,0.35)]"
                      >
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                          <BookOpen size={20} />
                        </div>
                        <h3 className="mt-5 text-xl font-black tracking-tight text-slate-950">{className}</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-500">
                          {classStudents.length} students in saved attendance register.
                        </p>
                        <span className="mt-5 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                          View saved register
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  icon={BookOpen}
                  title="No classes available"
                  description="Add students with assigned class or section first, then attendance classes will appear here."
                />
              )}
            </section>
          ) : (
            <div className="mt-8 grid gap-8">
              <section className="rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <FormTitle title="Saved Attendance Register" description="Class open karne ke baad teacher aur month select karke saved attendance dekhein." />
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <CreativeSelect
                    label="Teacher Name"
                    value={selectedTeacher}
                    onChange={(e) => setSelectedTeacher(e.target.value)}
                    options={['', ...teacherOptions.map((teacher) => teacher.name)]}
                    renderOptionLabel={(value) => {
                      if (!value) return 'Select teacher';
                      return value;
                    }}
                    required
                  />
                  <StaticField label="Class Number" value={selectedClass || '-'} />
                  <CreativeSelect
                    label="Month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    options={['', ...availableMonthOptions.map((option) => option.value)]}
                    renderOptionLabel={(value) => {
                      if (!value) return 'Latest saved month';
                      return availableMonthOptions.find((option) => option.value === value)?.label || value;
                    }}
                  />
                </div>

                {monthlyAttendanceRegister?.rows?.length ? (
                  <RegisterTable
                    titleLine={`${monthlyAttendanceRegister.schoolName}`}
                    subtitleLine={`Class Number: ${monthlyAttendanceRegister.classNumberLabel} | Teacher: ${monthlyAttendanceRegister.teacherLabel} | Month: ${monthlyAttendanceRegister.monthLabel}`}
                    nameHeader="Student Name"
                    rows={monthlyAttendanceRegister.rows}
                    dayColumns={monthlyAttendanceRegister.dayColumns}
                    holidayColumnMap={monthlyAttendanceRegister.holidayColumnMap}
                  />
                ) : null}

                {!monthlyAttendanceRegister?.rows?.length ? (
                  <EmptyState
                    icon={ClipboardCheck}
                    title="No attendance register available"
                    description={!selectedTeacher
                      ? 'Attendance register dekhne ke liye Teacher Name required hai.'
                      : 'Is class ke selected teacher aur selected month ke liye koi saved attendance data available nahi hai.'}
                  />
                ) : null}
              </section>
            </div>
          )
        ) : null}

        {activeSection === 'teacher' ? (
          <div className="mt-8 grid gap-8">
            <section className="rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
              <form className="space-y-8" onSubmit={handleTeacherAttendanceSave}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <FormTitle title="Mark Teacher Attendance" description="Choose a date and mark every teacher as present or absent." />
                  <SearchInput value={teacherSearch} onChange={setTeacherSearch} placeholder="Search teacher or ID..." />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <CreativeInput label="Attendance Date" type="date" value={teacherAttendanceDate} onChange={(e) => setTeacherAttendanceDate(e.target.value)} />
                  <StaticField label="Marked By" value={session?.username || 'Admin'} />
                </div>

                {filteredTeacherRows.length ? (
                  <div className="overflow-hidden rounded-[1.8rem] border border-slate-200">
                    <table className="w-full text-left">
                      <thead className="bg-slate-950 text-white">
                        <tr className="text-[11px] font-black uppercase tracking-[0.24em]">
                          <th className="px-6 py-4">Teacher Name</th>
                          <th className="px-6 py-4">Teacher ID</th>
                          <th className="px-6 py-4 text-center">Present</th>
                          <th className="px-6 py-4 text-center">Absent</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {filteredTeacherRows.map((teacher) => {
                          const teacherKey = String(teacher.id);
                          const fullName = `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim() || 'Unnamed teacher';

                          return (
                            <tr key={teacher.id} className="transition hover:bg-emerald-50/50">
                              <td className="px-6 py-5 text-sm font-black text-slate-950">{fullName}</td>
                              <td className="px-6 py-5 text-sm font-semibold text-slate-600">{teacher.teacherSystemId || teacher.employeeId || '-'}</td>
                              <td className="px-6 py-5 text-center">
                                <StatusButton
                                  active={teacherAttendanceMap[teacherKey] === 'Present'}
                                  label="Present"
                                  tone="present"
                                  onClick={() => handleTeacherStatusChange(teacherKey, 'Present')}
                                />
                              </td>
                              <td className="px-6 py-5 text-center">
                                <StatusButton
                                  active={teacherAttendanceMap[teacherKey] === 'Absent'}
                                  label="Absent"
                                  tone="absent"
                                  onClick={() => handleTeacherStatusChange(teacherKey, 'Absent')}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState
                    icon={Users}
                    title="No teachers available"
                    description="Add teacher records first, then the teacher attendance sheet will appear here."
                  />
                )}

                <PrimaryButton
                  type="submit"
                  icon={ClipboardCheck}
                  label="Save Teacher Attendance"
                  disabled={!teachersSorted.length || teachersSorted.some((teacher) => !teacherAttendanceMap[String(teacher.id)])}
                />
              </form>
            </section>

            <section className="rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <FormTitle title="Saved Teacher Attendance Register" description="Monthly P/A register for all saved teacher attendance records." />
                <div className="w-full lg:max-w-sm">
                  <CreativeSelect
                    label="Month"
                    value={teacherAttendanceMonth}
                    onChange={(e) => setTeacherAttendanceMonth(e.target.value)}
                    options={['', ...teacherAttendanceMonthOptions.map((option) => option.value)]}
                    renderOptionLabel={(value) => {
                      if (!value) return 'Current Month';
                      return teacherAttendanceMonthOptions.find((option) => option.value === value)?.label || value;
                    }}
                  />
                </div>
              </div>

              {teacherMonthlyRegister?.rows?.length ? (
                <RegisterTable
                  titleLine={`${teacherMonthlyRegister.schoolName}`}
                  subtitleLine={`Teacher Attendance | Month: ${teacherMonthlyRegister.monthLabel}`}
                  nameHeader="Teacher Name"
                  secondaryHeader="Teacher ID"
                  rows={teacherMonthlyRegister.rows}
                  dayColumns={teacherMonthlyRegister.dayColumns}
                  holidayColumnMap={teacherMonthlyRegister.holidayColumnMap}
                />
              ) : (
                <EmptyState
                  icon={ClipboardCheck}
                  title="No teacher attendance register available"
                  description="Save one teacher attendance sheet and the monthly register will appear here."
                />
              )}
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
};

const RegisterTable = ({ titleLine, subtitleLine, nameHeader, secondaryHeader = '', rows, dayColumns, holidayColumnMap }) => (
  <div className="mt-8 overflow-hidden rounded-[1.8rem] border border-slate-200">
    <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
      <p className="text-center text-lg font-black tracking-tight text-slate-950">{titleLine}</p>
      <p className="mt-2 text-center text-sm font-semibold text-slate-600">{subtitleLine}</p>
    </div>
    <div className="w-full overflow-x-auto">
      <table className="min-w-max border-collapse text-center">
        <thead>
          <tr className="bg-slate-950 text-white">
            <th className="sticky left-0 z-30 min-w-56 border-b border-r border-slate-800 bg-slate-950 px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.2em] shadow-[8px_0_18px_-14px_rgba(15,23,42,0.75)]">
              {nameHeader}
            </th>
            {secondaryHeader ? (
              <th className="min-w-32 border-b border-l border-slate-800 px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.2em]">
                {secondaryHeader}
              </th>
            ) : null}
            {dayColumns.map((dayNumber) => (
              <th
                key={`day-${dayNumber}`}
                className="min-w-14 border-b border-l border-slate-800 px-3 py-3 text-[11px] font-black uppercase tracking-[0.18em]"
              >
                {dayNumber}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`days-${row.id}`} className="odd:bg-white even:bg-slate-50">
              <td className="sticky left-0 z-20 min-w-56 border-b border-r border-slate-200 bg-inherit px-4 py-3 text-left text-sm font-black text-slate-950 shadow-[8px_0_18px_-14px_rgba(15,23,42,0.5)]">
                {row.name}
              </td>
              {secondaryHeader ? (
                <td className="min-w-32 border-b border-l border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-600">
                  {row.employeeId || '-'}
                </td>
              ) : null}
              {row.days.map((value, index) => {
                const dayNumber = dayColumns[index];
                const holidayLabel = holidayColumnMap?.get(dayNumber);

                if (holidayLabel && rowIndex > 0) {
                  return null;
                }

                if (holidayLabel) {
                  return (
                    <td
                      key={`${row.id}-day-${dayNumber}-holiday`}
                      rowSpan={rows.length}
                      className="min-w-14 border-b border-l border-slate-200 bg-amber-50 px-1 py-3 align-middle"
                    >
                      <div className="mx-auto flex min-h-full items-center justify-center">
                        <span className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-700 [writing-mode:vertical-rl] [text-orientation:mixed]">
                          {holidayLabel}
                        </span>
                      </div>
                    </td>
                  );
                }

                return (
                  <td
                    key={`${row.id}-day-${dayNumber}`}
                    className={`min-w-14 border-b border-l border-slate-200 px-3 py-3 text-sm font-black ${
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
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const MetricCard = ({ label, value, icon }) => (
  <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-50/80">{label}</p>
        <p className="mt-3 text-4xl font-black tracking-tight text-white">{value}</p>
      </div>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-200/20 bg-emerald-200/10 text-emerald-50">
        {React.createElement(icon, { size: 20 })}
      </div>
    </div>
  </div>
);

const FormTitle = ({ title, description }) => (
  <div>
    <h3 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">{title}</h3>
    <p className="mt-2 text-sm leading-7 text-slate-500">{description}</p>
  </div>
);

const SearchInput = ({ value, onChange, placeholder }) => (
  <div className="relative min-w-65">
    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-12 py-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
    />
  </div>
);

const CreativeInput = ({ label, ...props }) => (
  <div className="space-y-2.5">
    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
    <input
      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 read-only:bg-slate-100 read-only:text-slate-600 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
      {...props}
    />
  </div>
);

const CreativeSelect = ({ label, options, renderOptionLabel, ...props }) => (
  <div className="space-y-2.5">
    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
    <div className="relative">
      <select
        className="w-full appearance-none rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-3.5 pr-11 text-sm font-semibold text-slate-900 outline-none transition disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
        {...props}
      >
        {options.map((option) => (
          <option key={option || 'empty-option'} value={option}>
            {renderOptionLabel ? renderOptionLabel(option) : option || 'Select'}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
    </div>
  </div>
);

const StaticField = ({ label, value }) => (
  <div className="space-y-2.5">
    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
    <div className="rounded-2xl border-2 border-slate-200 bg-slate-100 px-5 py-3.5 text-sm font-semibold text-slate-700">
      {value}
    </div>
  </div>
);

const StatusButton = ({ active, label, tone, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`min-w-28 rounded-2xl px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] transition ${
      tone === 'present'
        ? active
          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100'
          : 'border border-slate-200 bg-slate-50 text-slate-500 hover:border-emerald-300 hover:text-emerald-700'
        : active
          ? 'bg-rose-600 text-white shadow-lg shadow-rose-100'
          : 'border border-slate-200 bg-slate-50 text-slate-500 hover:border-rose-300 hover:text-rose-700'
    }`}
  >
    {label}
  </button>
);

const PrimaryButton = ({ type, icon, label, disabled = false }) => (
  <button
    type={type}
    disabled={disabled}
    className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] transition ${
      disabled ? 'cursor-not-allowed bg-slate-200 text-slate-400' : 'bg-slate-950 text-white hover:bg-emerald-600'
    }`}
  >
    {React.createElement(icon, { size: 15 })}
    {label}
  </button>
);

const EmptyState = ({ icon, title, description }) => (
  <div className="mt-8 rounded-4xl border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center">
    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-white text-slate-300 shadow-sm">
      {React.createElement(icon, { size: 34 })}
    </div>
    <h4 className="mt-6 font-serif text-3xl font-black italic tracking-tight text-slate-950">{title}</h4>
    <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-500">{description}</p>
  </div>
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

  return [...classSet].sort(compareClassNames);
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

const resolveTimetableAttendanceTeacher = (record) => {
  return formatAttendanceText(
    record?.templateData?.attendanceTeacher
      || record?.templateMeta?.attendanceTeacher
      || '',
  );
};

const attendanceTeacherMatches = (record, teacherKeys) => {
  const attendanceTeacher = normalizeAttendanceText(resolveTimetableAttendanceTeacher(record));
  return Boolean(attendanceTeacher) && teacherKeys.some((key) => key === attendanceTeacher);
};

const formatMonthDateKey = (year, month, day) => (
  `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
);

const formatMonthKey = (monthKey) => {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return 'Month Pending';
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

const normalizeAttendanceText = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

const formatAttendanceText = (value) => {
  const normalized = String(value || '').trim().replace(/\s+/g, ' ');
  if (!normalized) return '';

  return normalized
    .toLowerCase()
    .split(' ')
    .map((word) => word ? `${word[0].toUpperCase()}${word.slice(1)}` : '')
    .join(' ');
};

const compareClassNames = (a, b) => {
  const left = getClassSortValue(a);
  const right = getClassSortValue(b);
  return left.rank - right.rank || left.section.localeCompare(right.section) || a.localeCompare(b);
};

const getClassSortValue = (className) => {
  const normalized = String(className || '').toLowerCase();
  const section = String(className || '').split('/')[1]?.trim() || '';

  if (normalized.includes('nursery')) return { rank: 0, section };
  if (normalized.includes('lkg')) return { rank: 1, section };
  if (normalized.includes('ukg')) return { rank: 2, section };

  const classMatch = normalized.match(/class\s*(\d+)/);
  if (classMatch) {
    return { rank: 2 + Number(classMatch[1]), section };
  }

  return { rank: 1000, section };
};

export default AttendanceManagement;
