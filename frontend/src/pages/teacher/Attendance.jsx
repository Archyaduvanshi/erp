import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  ClipboardCheck,
  Search,
  Users,
} from 'lucide-react';
import { db } from '../../utils/db';
import { attendanceApi, studentApi, teacherApi, timetableApi } from '../../utils/api';

const createSessionForm = () => ({
  date: new Date().toISOString().split('T')[0],
  lectureNumber: '',
  subject: '',
});

const TeacherAttendance = () => {
  const navigate = useNavigate();
  const [session] = useState(() => JSON.parse(localStorage.getItem('active_session')) || null);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [classTimetables, setClassTimetables] = useState([]);
  const [holidays, setHolidays] = useState(() => db.getAll('holiday_calendar'));
  const [selectedClass, setSelectedClass] = useState('');
  const [sessionForm, setSessionForm] = useState(createSessionForm);
  const [attendanceMap, setAttendanceMap] = useState({});
  const [classSearch, setClassSearch] = useState('');
  const [recordSearch, setRecordSearch] = useState('');
  const [loadError, setLoadError] = useState('');
  const registerScrollRef = useRef(null);

  async function refreshData() {
    const [studentResponse, teacherResponse, timetableResponse, attendanceResponse] = await Promise.all([
      studentApi.getAll(),
      teacherApi.getAll(),
      timetableApi.getClassTimetables(),
      attendanceApi.getAll(),
    ]);
    setStudents(studentResponse);
    setTeachers(teacherResponse);
    setAttendanceRecords(attendanceResponse);
    setClassTimetables(timetableResponse);
    setHolidays(db.getAll('holiday_calendar'));
    setLoadError('');
  }

  useEffect(() => {
    if (!session || session.role !== 'teacher') {
      navigate('/login');
      return;
    }
    const timer = setTimeout(() => {
      refreshData().catch((error) => {
        setStudents([]);
        setTeachers([]);
        setClassTimetables([]);
        setAttendanceRecords([]);
        setLoadError(error.message || 'Unable to load teacher attendance data.');
      });
    }, 0);

    return () => clearTimeout(timer);
  }, [navigate, session]);

  const teacher = useMemo(() => {
    if (!session || session.role !== 'teacher') return null;
    return teachers.find((entry) => String(entry.id) === String(session.teacherId)) || null;
  }, [session, teachers]);

  const teacherName = teacher
    ? `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim() || teacher.teacherSystemId || 'Teacher'
    : 'Teacher';

  const assignedClasses = useMemo(() => {
    return deriveTeacherClassesFromTimetables(classTimetables, teacher);
  }, [classTimetables, teacher]);

  const teachingClasses = useMemo(() => {
    const classesWithStudents = new Set(
      students
        .map((student) => student.assignedClass?.trim())
        .filter(Boolean),
    );

    return assignedClasses.filter((className) => classesWithStudents.has(className));
  }, [assignedClasses, students]);

  const filteredClasses = useMemo(() => {
    const query = classSearch.trim().toLowerCase();
    return teachingClasses.filter((className) => !query || className.toLowerCase().includes(query));
  }, [classSearch, teachingClasses]);

  const selectedClassStudents = useMemo(() => {
    return students
      .filter((student) => student.assignedClass === selectedClass)
      .sort((a, b) => {
        const left = `${a.firstName || ''} ${a.lastName || ''}`.trim().toLowerCase();
        const right = `${b.firstName || ''} ${b.lastName || ''}`.trim().toLowerCase();
        return left.localeCompare(right);
      });
  }, [selectedClass, students]);

  const selectedClassTimetableTemplate = useMemo(() => {
    if (!selectedClass) return null;
    const selectedClassRecord = classTimetables.find((record) => record.className === selectedClass);
    return readTimetableTemplate(selectedClassRecord);
  }, [classTimetables, selectedClass]);

  const timetableSubject = useMemo(() => {
    if (!selectedClassTimetableTemplate || !sessionForm.lectureNumber) return '';
    return getTimetableSubjectForSession(
      selectedClassTimetableTemplate,
      sessionForm.date,
      sessionForm.lectureNumber,
    );
  }, [selectedClassTimetableTemplate, sessionForm.date, sessionForm.lectureNumber]);

  useEffect(() => {
    setSessionForm((current) => {
      if (timetableSubject) {
        return current.subject === timetableSubject ? current : { ...current, subject: timetableSubject };
      }

      return current;
    });
  }, [timetableSubject]);

  const teacherRecords = useMemo(() => {
    const query = recordSearch.trim().toLowerCase();
    return attendanceRecords
      .filter((record) => teachingClasses.includes(record.className) || record.markedBy === teacherName)
      .filter((record) => selectedClass ? record.className === selectedClass : true)
      .filter((record) => {
        if (!query) return true;
        return (
          record.date?.toLowerCase().includes(query) ||
          record.className?.toLowerCase().includes(query) ||
          record.studentName?.toLowerCase().includes(query) ||
          record.rollNo?.toLowerCase().includes(query) ||
          record.status?.toLowerCase().includes(query) ||
          record.subject?.toLowerCase().includes(query) ||
          String(record.lectureNumber || '').toLowerCase().includes(query)
        );
      })
      .sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
  }, [attendanceRecords, recordSearch, selectedClass, teacherName, teachingClasses]);

  const today = new Date().toISOString().split('T')[0];
  const isSundaySession = getDayNameFromDate(sessionForm.date) === 'Sunday';
  const selectedHoliday = useMemo(() => (
    holidays.find((holiday) => String(holiday.holidayDate || '') === String(sessionForm.date || '')) || null
  ), [holidays, sessionForm.date]);
  const isHolidaySession = Boolean(selectedHoliday);

  const monthlyAttendanceRegister = useMemo(() => {
    if (!selectedClass) return null;

    const classRecords = teacherRecords
      .filter((record) => record.className === selectedClass)
      .filter((record) => !Number.isNaN(new Date(`${record.date || ''}T00:00:00`).getTime()))
      .sort((a, b) => new Date(a.createdAt || a.date).getTime() - new Date(b.createdAt || b.date).getTime());

    const requestedMonthDate = new Date(`${sessionForm.date || today}T00:00:00`);
    const fallbackRecordDate = classRecords.length ? new Date(`${classRecords[classRecords.length - 1].date}T00:00:00`) : null;
    const selectedMonthDate = !Number.isNaN(requestedMonthDate.getTime())
      ? requestedMonthDate
      : fallbackRecordDate;
    if (!selectedMonthDate || Number.isNaN(selectedMonthDate.getTime())) return null;

    let selectedYear = selectedMonthDate.getFullYear();
    let selectedMonth = selectedMonthDate.getMonth();

    let recordsForMonth = classRecords.filter((record) => {
      const recordDate = new Date(`${record.date || ''}T00:00:00`);
      return recordDate.getFullYear() === selectedYear && recordDate.getMonth() === selectedMonth;
    });

    if (!recordsForMonth.length && fallbackRecordDate) {
      selectedYear = fallbackRecordDate.getFullYear();
      selectedMonth = fallbackRecordDate.getMonth();
      recordsForMonth = classRecords.filter((record) => {
        const recordDate = new Date(`${record.date || ''}T00:00:00`);
        return recordDate.getFullYear() === selectedYear && recordDate.getMonth() === selectedMonth;
      });
    }

    const currentDate = new Date(`${today}T00:00:00`);
    const isCurrentMonth = currentDate.getFullYear() === selectedYear && currentDate.getMonth() === selectedMonth;
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const visibleDayCount = isCurrentMonth ? currentDate.getDate() : daysInMonth;
    const dayColumns = Array.from({ length: visibleDayCount }, (_, index) => index + 1);
    const holidayColumnMap = new Map();
    dayColumns.forEach((dayNumber) => {
      const dayDateValue = formatMonthDateKey(selectedYear, selectedMonth + 1, dayNumber);
      const matchingHoliday = holidays.find((holiday) => String(holiday.holidayDate || '') === dayDateValue);
      if (matchingHoliday?.title) {
        holidayColumnMap.set(dayNumber, matchingHoliday.title);
        return;
      }

      const dayDate = new Date(selectedYear, selectedMonth, dayNumber);
      if (dayDate.toLocaleDateString('en-US', { weekday: 'long' }) === 'Sunday') {
        holidayColumnMap.set(dayNumber, 'Sunday');
      }
    });

    const dailyStatusMap = new Map();
    recordsForMonth.forEach((record) => {
      const recordDate = new Date(`${record.date}T00:00:00`);
      const dayNumber = recordDate.getDate();
      const studentKey = String(record.studentId || '');
      if (!studentKey || dayNumber > visibleDayCount || holidayColumnMap.has(dayNumber)) return;
      dailyStatusMap.set(`${studentKey}-${dayNumber}`, record.status === 'Present' ? 'P' : 'A');
    });

    const savedStudentsMap = new Map();
    recordsForMonth.forEach((record) => {
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

    const query = recordSearch.trim().toLowerCase();
    const rows = [...savedStudentsMap.values()]
      .filter((student) => {
        if (!query) return true;
        return String(student.name || '').toLowerCase().includes(query)
          || String(student.rollNo || '').toLowerCase().includes(query);
      })
      .map((student) => ({
        id: student.id,
        name: student.name,
        rollNo: student.rollNo || '-',
        days: dayColumns.map((dayNumber) => dailyStatusMap.get(`${student.id}-${dayNumber}`) || ''),
      }));

    return {
      schoolName: session?.instituteName || 'School Name',
      className: selectedClass,
      monthLabel: new Date(selectedYear, selectedMonth, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
      dayColumns,
      holidayColumnMap,
      rows,
    };
  }, [holidays, recordSearch, selectedClass, selectedClassStudents, session?.instituteName, sessionForm.date, teacherRecords, today]);

  useEffect(() => {
    const scrollContainer = registerScrollRef.current;
    if (!scrollContainer || !monthlyAttendanceRegister?.dayColumns?.length) return;

    scrollContainer.scrollLeft = scrollContainer.scrollWidth;
  }, [monthlyAttendanceRegister]);

  const openClassSheet = (className) => {
    setSelectedClass(className);
    setSessionForm({
      ...createSessionForm(),
      subject: '',
    });
    setAttendanceMap({});
  };

  const handleStatusChange = (studentId, status) => {
    setAttendanceMap((current) => ({
      ...current,
      [studentId]: status,
    }));
  };

  const handleSaveAttendance = async (e) => {
    e.preventDefault();

    if (isSundaySession || isHolidaySession) {
      return;
    }

    const unmarkedStudents = selectedClassStudents.filter((student) => !attendanceMap[String(student.id)]);
    if (!selectedClass || !sessionForm.lectureNumber.trim() || !sessionForm.subject.trim() || unmarkedStudents.length > 0) {
      return;
    }

    try {
      await attendanceApi.saveSession({
        className: selectedClass,
        date: sessionForm.date,
        lectureNumber: sessionForm.lectureNumber.trim(),
        subject: sessionForm.subject.trim(),
        markedBy: teacherName,
        entries: selectedClassStudents.map((student) => ({
          studentId: Number(student.id),
          status: attendanceMap[String(student.id)] || 'Present',
        })),
      });
      await refreshData();
    } catch (error) {
      setLoadError(error.message || 'Unable to save teacher attendance.');
    }
  };

  if (!session || session.role !== 'teacher') return null;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eefbf4_44%,#f8fafc_100%)] text-slate-900">
      <div className="border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => selectedClass ? setSelectedClass('') : navigate('/teacher')}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 transition hover:border-emerald-300 hover:text-emerald-700"
            >
              <ArrowLeft size={14} />
              {selectedClass ? 'Back To Classes' : 'Back'}
            </button>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-emerald-600">Teacher Attendance</p>
              <h1 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">
                {selectedClass ? `${selectedClass} Attendance Sheet` : 'Attendance Register'}
              </h1>
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
        {!selectedClass ? (
          <section className="mt-8 rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <FormTitle title="Teaching Classes" description="Open one of your assigned classes to mark attendance." />
              <SearchInput value={classSearch} onChange={setClassSearch} placeholder="Search class..." />
            </div>

            {filteredClasses.length > 0 ? (
              <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {filteredClasses.map((className) => {
                  const classStrength = students.filter((student) => student.assignedClass === className).length;
                  return (
                    <button
                      key={className}
                      type="button"
                      onClick={() => openClassSheet(className)}
                      className="rounded-[1.8rem] border border-slate-200 bg-slate-50 p-6 text-left transition hover:-translate-y-1 hover:border-emerald-200 hover:bg-white hover:shadow-[0_18px_40px_-28px_rgba(16,185,129,0.35)]"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                        <BookOpen size={20} />
                      </div>
                      <h3 className="mt-5 text-xl font-black tracking-tight text-slate-950">{className}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-500">{classStrength} students ready for attendance.</p>
                      <span className="mt-5 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                        Open attendance sheet
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={BookOpen}
                title="No teaching classes available"
                description="Only classes assigned to you and available in your teaching data appear here."
              />
            )}
          </section>
        ) : (
          <div className="mx-auto mt-8 grid w-full max-w-6xl justify-items-center gap-8">
            <Panel title={`${selectedClass} Session Details`} description="Set date, lecture number, and subject before saving attendance.">
              <form className="mt-8 space-y-8" onSubmit={handleSaveAttendance}>
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                  <InputField
                    label="Date"
                    type="date"
                    value={sessionForm.date}
                    onChange={(e) => setSessionForm({ ...sessionForm, date: e.target.value })}
                  />
                  <SelectField
                    label="Lecture Number"
                    value={sessionForm.lectureNumber}
                    onChange={(e) => setSessionForm({ ...sessionForm, lectureNumber: e.target.value, subject: '' })}
                    options={['', '1', '2', '3', '4', '5', '6', '7', '8']}
                    renderOptionLabel={(value) => value || 'Select lecture'}
                  />
                  <InputField
                    label="Subject"
                    value={sessionForm.subject}
                    onChange={(e) => setSessionForm({ ...sessionForm, subject: e.target.value })}
                    placeholder="Subject name"
                    disabled={Boolean(timetableSubject)}
                  />
                  <StaticField label="Teacher" value={teacherName} />
                </div>

                {timetableSubject ? (
                  <div className="rounded-[1.6rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                    Lecture {sessionForm.lectureNumber} ke liye timetable ke hisab se subject "{timetableSubject}" auto-selected hai.
                  </div>
                ) : null}

                {isHolidaySession ? (
                  <div className="rounded-[1.6rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                    Selected date "{selectedHoliday?.title || 'Holiday'}" holiday hai. Is din attendance save nahi hogi.
                  </div>
                ) : null}

                {isSundaySession && !isHolidaySession ? (
                  <div className="rounded-[1.6rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                    Selected date Sunday hai. Sunday ko college holiday treat kiya ja raha hai, isliye attendance save nahi hogi.
                  </div>
                ) : null}

                {selectedClassStudents.length > 0 ? (
                  <div className="overflow-hidden rounded-[1.8rem] border border-slate-200">
                    <table className="w-full text-left">
                      <thead className="bg-slate-950 text-white">
                        <tr className="text-[11px] font-black uppercase tracking-[0.24em]">
                          <th className="px-6 py-4">Student Name</th>
                          <th className="px-6 py-4">Guardian</th>
                          <th className="px-6 py-4">Roll No</th>
                          <th className="px-6 py-4 text-center">Present</th>
                          <th className="px-6 py-4 text-center">Absent</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {selectedClassStudents.map((student) => {
                          const studentKey = String(student.id);
                          const fullName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Unnamed student';
                          const guardianName = student.guardianName || 'Guardian not added';
                          const rollNo = student.rollNo || student.enrollmentNo || student.systemId || String(student.id);

                          return (
                            <tr key={student.id} className="transition hover:bg-emerald-50/50">
                              <td className="px-6 py-5 text-sm font-black text-slate-950">{fullName}</td>
                              <td className="px-6 py-5 text-sm font-semibold text-slate-600">{guardianName}</td>
                              <td className="px-6 py-5 text-sm font-semibold text-slate-600">{rollNo}</td>
                              <td className="px-6 py-5 text-center">
                                <StatusButton
                                  active={attendanceMap[studentKey] === 'Present'}
                                  label="Present"
                                  tone="present"
                                  onClick={() => handleStatusChange(studentKey, 'Present')}
                                />
                              </td>
                              <td className="px-6 py-5 text-center">
                                <StatusButton
                                  active={attendanceMap[studentKey] === 'Absent'}
                                  label="Absent"
                                  tone="absent"
                                  onClick={() => handleStatusChange(studentKey, 'Absent')}
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
                    title="No students found"
                    description="This class is assigned, but no students are available in it yet."
                  />
                )}

                <PrimaryButton
                  type="submit"
                  icon={ClipboardCheck}
                  label="Save Attendance"
                  disabled={
                    isSundaySession ||
                    isHolidaySession ||
                    !sessionForm.lectureNumber ||
                    !sessionForm.subject ||
                    selectedClassStudents.some((student) => !attendanceMap[String(student.id)])
                  }
                />
              </form>
            </Panel>

            <Panel title="Saved Attendance Register" description="Monthly table view for your class with daily P and A marks.">
              <div className="mt-6">
                <SearchInput value={recordSearch} onChange={setRecordSearch} placeholder="Search student or roll no..." />
              </div>

              {monthlyAttendanceRegister?.rows?.length ? (
                <div className="mt-8 overflow-hidden rounded-[1.8rem] border border-slate-200">
                  <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
                    <p className="text-center text-lg font-black tracking-tight text-slate-950">{monthlyAttendanceRegister.schoolName}</p>
                    <p className="mt-2 text-center text-sm font-semibold text-slate-600">
                      Class: {monthlyAttendanceRegister.className} | Month: {monthlyAttendanceRegister.monthLabel}
                    </p>
                  </div>
                  <div ref={registerScrollRef} className="mx-auto w-full max-w-[68.5rem] overflow-x-auto">
                    <table className="w-max min-w-full border-collapse text-center">
                      <thead>
                        <tr className="bg-slate-950 text-white">
                          <th className="sticky left-0 z-20 min-w-64 border-b border-r border-slate-800 bg-slate-950 px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.2em] shadow-[6px_0_12px_-8px_rgba(15,23,42,0.45)]">
                            Student Name
                          </th>
                          {monthlyAttendanceRegister.dayColumns.map((dayNumber) => (
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
                        {monthlyAttendanceRegister.rows.map((row, rowIndex) => (
                          <tr key={`days-${row.id}`} className="odd:bg-white even:bg-slate-50">
                            <td className={`sticky left-0 z-10 min-w-64 border-b border-r border-slate-200 px-4 py-3 text-left text-sm font-black text-slate-950 shadow-[6px_0_12px_-8px_rgba(15,23,42,0.15)] ${rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                              <div className="text-sm font-black text-slate-950">
                                {row.name} <span className="text-slate-500">({row.rollNo || '-'})</span>
                              </div>
                            </td>
                            {row.days.map((value, index) => {
                              const dayNumber = monthlyAttendanceRegister.dayColumns[index];
                              const holidayLabel = monthlyAttendanceRegister.holidayColumnMap?.get(dayNumber);

                              if (holidayLabel && rowIndex > 0) {
                                return null;
                              }

                              if (holidayLabel) {
                                return (
                                  <td
                                    key={`${row.id}-day-${dayNumber}-holiday`}
                                    rowSpan={monthlyAttendanceRegister.rows.length}
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
              ) : (
                <EmptyState
                  icon={ClipboardCheck}
                  title="No attendance register available"
                  description="Save attendance for this class and the monthly P/A register will appear here."
                />
              )}
            </Panel>
          </div>
        )}
      </main>
    </div>
  );
};

const deriveTeacherClassesFromTimetables = (classTimetables, teacher) => {
  if (!teacher) return [];

  const teacherKeys = buildTeacherIdentityKeys(teacher);
  const classSet = new Set();

  classTimetables.forEach((record) => {
    const template = readTimetableTemplate(record);
    const hasTeacherSlot = template?.rows?.some((row) =>
      (row.slots || []).some((slot) => slotMatchesTeacher(slot, teacherKeys)),
    );

    if (hasTeacherSlot && record.className) {
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

const slotMatchesTeacher = (slot, teacherKeys) => {
  const teacherValue = String(slot?.teacherName || '').trim().toLowerCase();
  return Boolean(teacherValue) && teacherKeys.some((key) => key === teacherValue);
};

const readTimetableTemplate = (record) => {
  if (record?.templateData?.rows?.length) {
    return record.templateData;
  }

  return null;
};

const getTimetableSubjectForSession = (template, dateValue, lectureNumber) => {
  if (!template?.rows?.length || !template?.lecturePlan?.length || !lectureNumber) return '';

  const selectedDay = getDayNameFromDate(dateValue);
  const dayRow = template.rows.find((row) => normalizeAttendanceText(row.day) === normalizeAttendanceText(selectedDay));
  if (!dayRow) return '';

  const lectureIndex = template.lecturePlan.findIndex((lecture) => String(lecture.lectureNumber) === String(lectureNumber));
  if (lectureIndex < 0) return '';

  return formatAttendanceText(dayRow.slots?.[lectureIndex]?.subjectName);
};

const getDayNameFromDate = (dateValue) => {
  if (!dateValue) return '';

  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString('en-US', { weekday: 'long' });
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

const formatMonthDateKey = (year, month, day) => (
  `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
);

const Panel = ({ title, description, children }) => (
  <section className="w-full rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
    <h3 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">{title}</h3>
    <p className="mt-2 text-sm leading-7 text-slate-500">{description}</p>
    {children}
  </section>
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

const InputField = ({ label, ...props }) => (
  <div className="space-y-2.5">
    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
    <input
      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
      {...props}
    />
  </div>
);

const SelectField = ({ label, options, renderOptionLabel, ...props }) => (
  <div className="space-y-2.5">
    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
    <select
      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-3.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
      {...props}
    >
      {options.map((option) => (
        <option key={option || 'empty-option'} value={option}>
          {renderOptionLabel ? renderOptionLabel(option) : option || 'Select'}
        </option>
      ))}
    </select>
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

export default TeacherAttendance;
