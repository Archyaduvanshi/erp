import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, ChevronDown, ClipboardCheck, Search, Users } from 'lucide-react';
import { academicSessionApi, attendanceApi, holidayApi, teacherApi } from '../../utils/api';
import { holidayAppliesToStudentClass } from '../../utils/noticeUtils';
import { useAuth } from '../../context/AuthContext';
import QRScannerButton from '../../components/scanner/QRScannerButton';

const AttendanceManagement = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const instituteId = session?.id || '';
  const [activeSection, setActiveSection] = useState('student');
  const [selectedTargetKey, setSelectedTargetKey] = useState('');
  const [classSearch, setClassSearch] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [teacherAttendanceDate, setTeacherAttendanceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [teacherAttendanceMonth, setTeacherAttendanceMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [teacherSearch, setTeacherSearch] = useState('');
  const [teacherAttendanceMap, setTeacherAttendanceMap] = useState({});
  const [loadError, setLoadError] = useState('');

  const sessionsQuery = useQuery({
    queryKey: ['attendance-academic-sessions', instituteId],
    queryFn: () => academicSessionApi.getAll(),
    staleTime: 10 * 60 * 1000,
  });

  const academicSession = useMemo(() => {
    const sessions = sessionsQuery.data || [];
    return sessions.find((item) => item.current) || sessions[0] || null;
  }, [sessionsQuery.data]);
  const academicSessionId = academicSession?.id || null;

  const targetsQuery = useQuery({
    queryKey: ['attendance-targets', instituteId, academicSessionId],
    queryFn: () => attendanceApi.getTargets(academicSessionId),
    enabled: Boolean(academicSessionId),
    staleTime: 5 * 60 * 1000,
  });

  const attendanceTargets = targetsQuery.data || [];
  const selectedTarget = useMemo(
    () => attendanceTargets.find((target) => buildTargetKey(target) === selectedTargetKey) || null,
    [attendanceTargets, selectedTargetKey],
  );

  const classStudentsQuery = useQuery({
    queryKey: ['attendance-class-students', instituteId, academicSessionId, selectedTarget?.classId || null, selectedTarget?.sectionId ?? null],
    queryFn: () => attendanceApi.getClassStudents({
      academicSessionId,
      classId: selectedTarget.classId,
      sectionId: selectedTarget.sectionId,
    }),
    enabled: activeSection === 'student' && Boolean(academicSessionId && selectedTarget),
    staleTime: 2 * 60 * 1000,
  });

  const classMonthQuery = useQuery({
    queryKey: ['attendance-month', instituteId, academicSessionId, selectedTarget?.classId || null, selectedTarget?.sectionId ?? null, selectedMonth, selectedTeacher || null],
    queryFn: () => attendanceApi.getClassMonthly({
      academicSessionId,
      classId: selectedTarget.classId,
      sectionId: selectedTarget.sectionId,
      month: selectedMonth,
      teacherId: selectedTeacher,
    }),
    enabled: activeSection === 'student' && Boolean(academicSessionId && selectedTarget && selectedMonth),
  });

  const studentHolidayRange = useMemo(() => getMonthRange(selectedMonth), [selectedMonth]);
  const teacherHolidayRange = useMemo(() => getMonthRange(teacherAttendanceMonth), [teacherAttendanceMonth]);
  const activeHolidayRange = activeSection === 'teacher' ? teacherHolidayRange : studentHolidayRange;
  const holidaysQuery = useQuery({
    queryKey: ['attendance-holidays', instituteId, activeHolidayRange.from, activeHolidayRange.to],
    queryFn: () => holidayApi.getAll(activeHolidayRange),
    enabled: Boolean(activeHolidayRange.from && activeHolidayRange.to),
    staleTime: 15 * 60 * 1000,
  });

  const teacherOptionsQuery = useQuery({
    queryKey: ['attendance-teacher-options', instituteId],
    queryFn: () => teacherApi.getOptions('Active'),
    enabled: activeSection === 'teacher',
    staleTime: 5 * 60 * 1000,
  });

  const teacherDailyQuery = useQuery({
    queryKey: ['teacher-attendance-day', instituteId, teacherAttendanceDate],
    queryFn: () => attendanceApi.getTeacherAttendanceDaily(teacherAttendanceDate),
    enabled: activeSection === 'teacher' && Boolean(teacherAttendanceDate),
  });

  const teacherMonthQuery = useQuery({
    queryKey: ['teacher-attendance-month', instituteId, teacherAttendanceMonth],
    queryFn: () => attendanceApi.getTeacherAttendanceMonthly(teacherAttendanceMonth),
    enabled: activeSection === 'teacher' && Boolean(teacherAttendanceMonth),
  });

  const saveTeacherAttendanceMutation = useMutation({
    mutationFn: attendanceApi.saveTeacherAttendance,
    onSuccess: (savedRecords) => {
      queryClient.setQueryData(['teacher-attendance-day', instituteId, teacherAttendanceDate], savedRecords);
      queryClient.invalidateQueries({ queryKey: ['teacher-attendance-month', instituteId, teacherAttendanceDate.slice(0, 7)] });
      setLoadError('');
    },
    onError: (error) => setLoadError(error.message || 'Unable to save teacher attendance.'),
  });

  useEffect(() => {
    const records = teacherDailyQuery.data || [];
    setTeacherAttendanceMap(records.reduce((map, record) => ({ ...map, [String(record.teacherId)]: record.status }), {}));
  }, [teacherDailyQuery.data]);

  useEffect(() => {
    const firstError = [
      sessionsQuery.error,
      targetsQuery.error,
      classStudentsQuery.error,
      classMonthQuery.error,
      holidaysQuery.error,
      teacherOptionsQuery.error,
      teacherDailyQuery.error,
      teacherMonthQuery.error,
    ].find(Boolean);
    setLoadError(firstError?.message || '');
  }, [sessionsQuery.error, targetsQuery.error, classStudentsQuery.error, classMonthQuery.error, holidaysQuery.error, teacherOptionsQuery.error, teacherDailyQuery.error, teacherMonthQuery.error]);

  const filteredClasses = useMemo(() => {
    const query = classSearch.trim().toLowerCase();
    return attendanceTargets
      .filter((target) => !query || String(target.displayName || '').toLowerCase().includes(query))
      .sort((a, b) => compareClassNames(a.displayName, b.displayName));
  }, [attendanceTargets, classSearch]);

  const teacherOptions = useMemo(() => (teacherOptionsQuery.data || [])
    .map((teacher) => ({
      id: teacher.id,
      name: teacher.name || 'Unnamed teacher',
      employeeId: teacher.employeeId || '-',
      specialization: teacher.specialization || '',
    }))
    .sort((a, b) => a.name.localeCompare(b.name)), [teacherOptionsQuery.data]);

  const filteredTeacherRows = useMemo(() => {
    const query = teacherSearch.trim().toLowerCase();
    return teacherOptions.filter((teacher) => !query
      || teacher.name.toLowerCase().includes(query)
      || String(teacher.employeeId || '').toLowerCase().includes(query)
      || String(teacher.specialization || '').toLowerCase().includes(query));
  }, [teacherOptions, teacherSearch]);

  const studentRegisterTeachers = useMemo(() => (classMonthQuery.data?.teachers || [])
    .map((teacher) => ({
      id: teacher.teacherId,
      name: teacher.employeeId ? `${teacher.teacherName} (${teacher.employeeId})` : teacher.teacherName,
    }))
    .filter((teacher) => teacher.id && teacher.name), [classMonthQuery.data]);

  const attendanceTeacherLabel = useMemo(() => {
    const teacherName = classMonthQuery.data?.attendanceTeacherName;
    const employeeId = classMonthQuery.data?.attendanceTeacherEmployeeId;
    if (!teacherName) return '';
    return employeeId ? `${teacherName} (${employeeId})` : teacherName;
  }, [classMonthQuery.data]);

  const selectedStudentRegisterTeacherLabel = useMemo(() => {
    if (!selectedTeacher) return attendanceTeacherLabel || 'Class Attendance Teacher';
    return studentRegisterTeachers.find((teacher) => String(teacher.id) === String(selectedTeacher))?.name || 'Selected Teacher';
  }, [attendanceTeacherLabel, selectedTeacher, studentRegisterTeachers]);

  useEffect(() => {
    if (!selectedTeacher) return;
    const teacherStillExists = studentRegisterTeachers.some((teacher) => String(teacher.id) === String(selectedTeacher));
    if (!teacherStillExists && !classMonthQuery.isFetching) {
      setSelectedTeacher('');
    }
  }, [classMonthQuery.isFetching, selectedTeacher, studentRegisterTeachers]);

  const monthlyAttendanceRegister = useMemo(() => {
    if (!selectedTarget || !classMonthQuery.data) return null;
    const [year, monthNumber] = selectedMonth.split('-').map(Number);
    if (!year || !monthNumber) return null;
    const dayColumns = buildVisibleDayColumns(year, monthNumber);
    const savedDayNumbers = new Set((classMonthQuery.data.students || [])
      .flatMap((student) => Object.keys(student.days || {}))
      .map((dateValue) => Number(dateValue.split('-')[2]))
      .filter(Boolean));
    const holidayColumnMap = buildHolidayColumnMap(dayColumns, year, monthNumber, holidaysQuery.data || [], buildAssignedClassLabel(selectedTarget), 'student', savedDayNumbers);
    const rows = (classMonthQuery.data.students || []).map((student) => ({
      id: student.studentId,
      name: student.name || 'Unnamed student',
      days: dayColumns.map((dayNumber) => {
        if (holidayColumnMap.has(dayNumber)) return '';
        return toRegisterStatus(student.days?.[formatMonthDateKey(year, monthNumber, dayNumber)]);
      }),
    }));
    return {
      schoolName: session?.instituteName || 'School Name',
      classNumberLabel: selectedTarget.displayName,
      teacherLabel: selectedStudentRegisterTeacherLabel,
      monthLabel: formatMonthKey(selectedMonth),
      dayColumns,
      holidayColumnMap,
      savedMarkCount: (classMonthQuery.data.students || []).reduce((count, student) => count + Object.keys(student.days || {}).length, 0),
      rows,
    };
  }, [classMonthQuery.data, holidaysQuery.data, selectedMonth, selectedStudentRegisterTeacherLabel, selectedTarget, session?.instituteName]);

  const teacherMonthlyRegister = useMemo(() => {
    const [year, monthNumber] = teacherAttendanceMonth.split('-').map(Number);
    if (!year || !monthNumber) return null;
    const dayColumns = buildVisibleDayColumns(year, monthNumber);
    const savedDayNumbers = new Set((teacherMonthQuery.data?.teachers || [])
      .flatMap((teacher) => Object.keys(teacher.days || {}))
      .map((dateValue) => Number(dateValue.split('-')[2]))
      .filter(Boolean));
    const holidayColumnMap = buildHolidayColumnMap(dayColumns, year, monthNumber, holidaysQuery.data || [], '', 'teacher', savedDayNumbers);
    const monthlyByTeacher = new Map((teacherMonthQuery.data?.teachers || []).map((teacher) => [String(teacher.teacherId), teacher]));
    const query = teacherSearch.trim().toLowerCase();
    const rows = teacherOptions
      .filter((teacher) => !query || teacher.name.toLowerCase().includes(query) || String(teacher.employeeId || '').toLowerCase().includes(query))
      .map((teacher) => {
        const monthly = monthlyByTeacher.get(String(teacher.id));
        return {
          id: teacher.id,
          name: teacher.name || 'Unnamed teacher',
          employeeId: teacher.employeeId || '-',
          days: dayColumns.map((dayNumber) => {
            if (holidayColumnMap.has(dayNumber)) return '';
            return toRegisterStatus(monthly?.days?.[formatMonthDateKey(year, monthNumber, dayNumber)]);
          }),
        };
      });
    return {
      schoolName: session?.instituteName || 'School Name',
      monthLabel: formatMonthKey(teacherAttendanceMonth),
      dayColumns,
      holidayColumnMap,
      savedMarkCount: (teacherMonthQuery.data?.teachers || []).reduce((count, teacher) => count + Object.keys(teacher.days || {}).length, 0),
      rows,
    };
  }, [holidaysQuery.data, session?.instituteName, teacherAttendanceMonth, teacherMonthQuery.data, teacherOptions, teacherSearch]);

  const openClassSheet = (target) => {
    setSelectedTargetKey(buildTargetKey(target));
    setSelectedTeacher('');
    setSelectedMonth(new Date().toISOString().slice(0, 7));
  };

  const handleBack = () => {
    if (activeSection === 'student' && selectedTarget) {
      setSelectedTargetKey('');
      return;
    }
    navigate(session?.role === 'teacher' ? '/teacher' : '/college');
  };

  const handleSectionChange = (section) => {
    setActiveSection(section);
    setSelectedTargetKey('');
    setSelectedTeacher('');
  };

  const handleScannedIdentity = (identity) => {
    if (identity.entityType === 'TEACHER') {
      setActiveSection('teacher');
      setTeacherSearch(identity.referenceNumber || identity.name || '');
      return;
    }
    setActiveSection('student');
    const target = attendanceTargets.find((entry) => (
      String(entry.classId) === String(identity.classId)
      && String(entry.sectionId || '') === String(identity.sectionId || '')
    ));
    if (target) openClassSheet(target);
    setClassSearch(identity.className || identity.referenceNumber || '');
  };

  const handleTeacherAttendanceSave = (event) => {
    event.preventDefault();
    const unmarkedTeachers = teacherOptions.filter((teacher) => !teacherAttendanceMap[String(teacher.id)]);
    if (!teacherOptions.length || unmarkedTeachers.length > 0) return;
    saveTeacherAttendanceMutation.mutate({
      date: teacherAttendanceDate,
      markedBy: session?.username || 'Admin',
      entries: teacherOptions.map((teacher) => ({
        teacherId: teacher.id,
        status: teacherAttendanceMap[String(teacher.id)] || 'Absent',
      })),
    });
  };

  const pageTitle = activeSection === 'student'
    ? selectedTarget ? `${selectedTarget.displayName} Attendance Sheet` : 'Student Attendance Register'
    : 'Teacher Attendance Register';

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#ecfdf5_48%,#f8fafc_100%)] text-slate-900">
      <div className="border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <div className="flex items-center gap-4">
            <button onClick={handleBack} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 transition hover:border-emerald-300 hover:text-emerald-700">
              <ArrowLeft size={14} />
              {activeSection === 'student' && selectedTarget ? 'Back to Classes' : 'Back'}
            </button>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-emerald-600">Attendance Management</p>
              <h1 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">{pageTitle}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
          <QRScannerButton feature="attendance" onResolved={handleScannedIdentity} />
          <div className="flex rounded-full border border-slate-200 bg-slate-100 p-1">
            {[
              ['student', 'Student'],
              ['teacher', 'Teacher'],
            ].map(([section, label]) => (
              <button key={section} type="button" onClick={() => handleSectionChange(section)} className={`rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em] transition ${activeSection === section ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-500 hover:text-emerald-700'}`}>
                {label}
              </button>
            ))}
          </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10 lg:py-10">
        {loadError ? <div className="mb-6 rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">{loadError}</div> : null}

        {activeSection === 'student' ? (
          !selectedTarget ? (
            <section className="mt-8 rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <FormTitle title="Select Class" description="Open any class or section to view its saved attendance register." />
                <SearchInput value={classSearch} onChange={setClassSearch} placeholder="Search class or section..." />
              </div>
              {filteredClasses.length > 0 ? (
                <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {filteredClasses.map((target) => (
                    <button key={buildTargetKey(target)} onClick={() => openClassSheet(target)} className="rounded-[1.8rem] border border-slate-200 bg-slate-50 p-6 text-left transition hover:-translate-y-1 hover:border-emerald-200 hover:bg-white hover:shadow-[0_18px_40px_-28px_rgba(16,185,129,0.35)]">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                        <BookOpen size={20} />
                      </div>
                      <h3 className="mt-5 text-xl font-black tracking-tight text-slate-950">{target.displayName}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-500">{target.studentCount} students in this class target.</p>
                      <span className="mt-5 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">View saved register</span>
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState icon={BookOpen} title={targetsQuery.isLoading ? 'Loading classes' : 'No classes available'} description="Class and section targets come from the academic session class master." />
              )}
            </section>
          ) : (
            <div className="mt-8 grid gap-8">
              <section className="min-w-0 rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <FormTitle title="Saved Attendance Register" description="Class open karne ke baad month select karke saved attendance dekhein." />
                </div>
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <CreativeSelect
                    label="Teacher Name"
                    value={selectedTeacher}
                    onChange={(e) => setSelectedTeacher(e.target.value)}
                    options={['', ...studentRegisterTeachers.map((teacher) => String(teacher.id))]}
                    renderOptionLabel={(value) => {
                      if (!value) return attendanceTeacherLabel || 'Class Attendance Teacher';
                      return studentRegisterTeachers.find((teacher) => String(teacher.id) === String(value))?.name || 'Selected Teacher';
                    }}
                  />
                  <StaticField label="Class Number" value={selectedTarget.displayName || '-'} />
                  <CreativeInput label="Month" type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
                </div>
                {monthlyAttendanceRegister?.rows?.length ? (
                  <RegisterTable titleLine={monthlyAttendanceRegister.schoolName} subtitleLine={`Class Number: ${monthlyAttendanceRegister.classNumberLabel} | Teacher: ${monthlyAttendanceRegister.teacherLabel} | Month: ${monthlyAttendanceRegister.monthLabel}`} note={!monthlyAttendanceRegister.savedMarkCount ? selectedTeacher ? 'Is selected teacher filter ke liye saved P/A marks nahi mile. All teachers option se bhi check karein.' : 'Is class/month ke liye saved P/A marks nahi mile.' : ''} nameHeader="Student Name" rows={monthlyAttendanceRegister.rows} dayColumns={monthlyAttendanceRegister.dayColumns} holidayColumnMap={monthlyAttendanceRegister.holidayColumnMap} />
                ) : null}
                {!monthlyAttendanceRegister?.rows?.length ? (
                  <EmptyState icon={ClipboardCheck} title={classMonthQuery.isLoading || classStudentsQuery.isLoading ? 'Loading attendance register' : 'No attendance register available'} description="Is class aur selected month ke liye koi saved attendance data available nahi hai." />
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
                          <th className="px-6 py-4">Employee ID</th>
                          <th className="px-6 py-4 text-center">Present</th>
                          <th className="px-6 py-4 text-center">Absent</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {filteredTeacherRows.map((teacher) => {
                          const teacherKey = String(teacher.id);
                          return (
                            <tr key={teacher.id} className="transition hover:bg-emerald-50/50">
                              <td className="px-6 py-5 text-sm font-black text-slate-950">{teacher.name}</td>
                              <td className="px-6 py-5 text-sm font-semibold text-slate-600">{teacher.employeeId || '-'}</td>
                              <td className="px-6 py-5 text-center">
                                <StatusButton active={teacherAttendanceMap[teacherKey] === 'Present'} label="Present" tone="present" onClick={() => setTeacherAttendanceMap((current) => ({ ...current, [teacherKey]: 'Present' }))} />
                              </td>
                              <td className="px-6 py-5 text-center">
                                <StatusButton active={teacherAttendanceMap[teacherKey] === 'Absent'} label="Absent" tone="absent" onClick={() => setTeacherAttendanceMap((current) => ({ ...current, [teacherKey]: 'Absent' }))} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState icon={Users} title={teacherOptionsQuery.isLoading ? 'Loading teachers' : 'No teachers available'} description="Add teacher records first, then the teacher attendance sheet will appear here." />
                )}
                <PrimaryButton type="submit" icon={ClipboardCheck} label="Save Teacher Attendance" disabled={!teacherOptions.length || teacherOptions.some((teacher) => !teacherAttendanceMap[String(teacher.id)]) || saveTeacherAttendanceMutation.isPending} />
              </form>
            </section>

            <section className="rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <FormTitle title="Saved Teacher Attendance Register" description="Monthly P/A register for saved teacher attendance records." />
                <div className="w-full lg:max-w-sm">
                  <CreativeInput label="Month" type="month" value={teacherAttendanceMonth} onChange={(e) => setTeacherAttendanceMonth(e.target.value)} />
                </div>
              </div>
              {teacherMonthlyRegister?.rows?.length ? (
                <RegisterTable titleLine={teacherMonthlyRegister.schoolName} subtitleLine={`Teacher Attendance | Month: ${teacherMonthlyRegister.monthLabel}`} note={!teacherMonthlyRegister.savedMarkCount ? 'Is month me saved teacher P/A marks nahi mile.' : ''} nameHeader="Teacher Name" rows={teacherMonthlyRegister.rows} dayColumns={teacherMonthlyRegister.dayColumns} holidayColumnMap={teacherMonthlyRegister.holidayColumnMap} maxVisibleDayColumns={15} />
              ) : (
                <EmptyState icon={ClipboardCheck} title={teacherMonthQuery.isLoading ? 'Loading teacher attendance register' : 'No teacher attendance register available'} description="Save one teacher attendance sheet and the monthly register will appear here." />
              )}
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
};

const RegisterTable = ({ titleLine, subtitleLine, note = '', nameHeader, secondaryHeader = '', rows, dayColumns, holidayColumnMap, maxVisibleDayColumns = 0 }) => (
  <div className="mt-8 max-w-full overflow-hidden rounded-[1.8rem] border border-slate-200">
    <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
      <p className="text-center text-lg font-black tracking-tight text-slate-950">{titleLine}</p>
      <p className="mt-2 text-center text-sm font-semibold text-slate-600">{subtitleLine}</p>
      {note ? <p className="mt-3 text-center text-xs font-bold text-amber-700">{note}</p> : null}
    </div>
    <div className="block max-w-full overflow-x-auto pb-3 [scrollbar-color:#94a3b8_#e2e8f0] [scrollbar-width:thin]" style={maxVisibleDayColumns ? { width: '100%', maxWidth: `${256 + (maxVisibleDayColumns * 56)}px` } : undefined}>
      <table className="min-w-max border-collapse text-center">
        <thead>
          <tr className="bg-slate-950 text-white">
            <th className="sticky left-0 z-30 min-w-56 border-b border-r border-slate-800 bg-slate-950 px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.2em] shadow-[8px_0_18px_-14px_rgba(15,23,42,0.75)]">{nameHeader}</th>
            {secondaryHeader ? <th className="min-w-32 border-b border-l border-slate-800 px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.2em]">{secondaryHeader}</th> : null}
            {dayColumns.map((dayNumber) => <th key={`day-${dayNumber}`} className="min-w-14 border-b border-l border-slate-800 px-3 py-3 text-[11px] font-black uppercase tracking-[0.18em]">{dayNumber}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`days-${row.id}`} className="odd:bg-white even:bg-slate-50">
              <td className="sticky left-0 z-20 min-w-64 border-b border-r border-slate-200 bg-inherit px-4 py-3 text-left shadow-[8px_0_18px_-14px_rgba(15,23,42,0.5)]">
                <div className="text-sm font-black text-slate-950">{row.name}</div>
                {row.employeeId ? <div className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">ID: {row.employeeId}</div> : null}
              </td>
              {secondaryHeader ? <td className="min-w-32 border-b border-l border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-600">{row.employeeId || '-'}</td> : null}
              {row.days.map((value, index) => {
                const dayNumber = dayColumns[index];
                const holidayLabel = holidayColumnMap?.get(dayNumber);
                if (holidayLabel && rowIndex > 0) return null;
                if (holidayLabel) {
                  return (
                    <td key={`${row.id}-day-${dayNumber}-holiday`} rowSpan={rows.length} className="min-w-14 border-b border-l border-slate-200 bg-amber-50 px-1 py-3 align-middle">
                      <div className="mx-auto flex min-h-full items-center justify-center">
                        <span className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-700 [writing-mode:vertical-rl] [text-orientation:mixed]">{holidayLabel}</span>
                      </div>
                    </td>
                  );
                }
                return <td key={`${row.id}-day-${dayNumber}`} className={`min-w-14 border-b border-l border-slate-200 px-3 py-3 text-sm font-black ${value === 'P' ? 'text-emerald-700' : value === 'A' ? 'text-rose-700' : 'text-slate-300'}`}>{value || '-'}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
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
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-12 py-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100" />
  </div>
);

const CreativeInput = ({ label, ...props }) => (
  <div className="space-y-2.5">
    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
    <input className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 read-only:bg-slate-100 read-only:text-slate-600 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100" {...props} />
  </div>
);

const CreativeSelect = ({ label, options, renderOptionLabel, ...props }) => (
  <div className="space-y-2.5">
    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
    <div className="relative">
      <select className="w-full appearance-none rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-3.5 pr-11 text-sm font-semibold text-slate-900 outline-none transition disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100" {...props}>
        {options.map((option) => <option key={option || 'empty-option'} value={option}>{renderOptionLabel ? renderOptionLabel(option) : option || 'Select'}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
    </div>
  </div>
);

const StaticField = ({ label, value }) => (
  <div className="space-y-2.5">
    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
    <div className="rounded-2xl border-2 border-slate-200 bg-slate-100 px-5 py-3.5 text-sm font-semibold text-slate-700">{value}</div>
  </div>
);

const StatusButton = ({ active, label, tone, onClick }) => (
  <button type="button" onClick={onClick} className={`min-w-28 rounded-2xl px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] transition ${tone === 'present' ? active ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' : 'border border-slate-200 bg-slate-50 text-slate-500 hover:border-emerald-300 hover:text-emerald-700' : active ? 'bg-rose-600 text-white shadow-lg shadow-rose-100' : 'border border-slate-200 bg-slate-50 text-slate-500 hover:border-rose-300 hover:text-rose-700'}`}>
    {label}
  </button>
);

const PrimaryButton = ({ type, icon, label, disabled = false }) => (
  <button type={type} disabled={disabled} className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] transition ${disabled ? 'cursor-not-allowed bg-slate-200 text-slate-400' : 'bg-slate-950 text-white hover:bg-emerald-600'}`}>
    {React.createElement(icon, { size: 15 })}
    {label}
  </button>
);

const EmptyState = ({ icon, title, description }) => (
  <div className="mt-8 rounded-4xl border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center">
    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-white text-slate-300 shadow-sm">{React.createElement(icon, { size: 34 })}</div>
    <h4 className="mt-6 font-serif text-3xl font-black italic tracking-tight text-slate-950">{title}</h4>
    <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-500">{description}</p>
  </div>
);

const buildTargetKey = (target) => target ? `${target.classId}:${target.sectionId ?? 'none'}` : '';
const buildAssignedClassLabel = (target) => target?.sectionName ? `${target.className} / ${target.sectionName}` : target?.className || '';

const getMonthRange = (monthKey) => {
  if (!/^\d{4}-\d{2}$/.test(monthKey || '')) return { from: '', to: '' };
  const [year, month] = monthKey.split('-').map(Number);
  return { from: formatMonthDateKey(year, month, 1), to: formatMonthDateKey(year, month, new Date(year, month, 0).getDate()) };
};

const buildVisibleDayColumns = (year, monthNumber) => {
  const today = new Date();
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === monthNumber;
  return Array.from({ length: isCurrentMonth ? today.getDate() : daysInMonth }, (_, index) => index + 1);
};

const buildHolidayColumnMap = (dayColumns, year, monthNumber, holidays, classLabel, type, savedDayNumbers = new Set()) => {
  const holidayColumnMap = new Map();
  dayColumns.forEach((dayNumber) => {
    if (savedDayNumbers.has(dayNumber)) return;

    const dayDateValue = formatMonthDateKey(year, monthNumber, dayNumber);
    const matchingHoliday = holidays.find((holiday) => {
      if (String(holiday.holidayDate || '') !== dayDateValue) return false;
      if (type === 'teacher') return holiday.audience === 'All' || holiday.audience === 'Teachers';
      return holidayAppliesToStudentClass(holiday, classLabel);
    });
    if (matchingHoliday?.title) {
      holidayColumnMap.set(dayNumber, matchingHoliday.title);
      return;
    }
    const dayDate = new Date(year, monthNumber - 1, dayNumber);
    if (dayDate.toLocaleDateString('en-US', { weekday: 'long' }) === 'Sunday') holidayColumnMap.set(dayNumber, 'Sunday');
  });
  return holidayColumnMap;
};

const toRegisterStatus = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'present') return 'P';
  if (normalized === 'absent') return 'A';
  return '';
};

const formatMonthDateKey = (year, month, day) => `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const formatMonthKey = (monthKey) => {
  if (!/^\d{4}-\d{2}$/.test(monthKey || '')) return 'Month Pending';
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

const compareClassNames = (a, b) => {
  const left = getClassSortValue(a);
  const right = getClassSortValue(b);
  return left.rank - right.rank || left.section.localeCompare(right.section) || String(a).localeCompare(String(b));
};

const getClassSortValue = (className) => {
  const normalized = String(className || '').toLowerCase();
  const section = String(className || '').split('-')[1]?.trim() || '';
  const classMatch = normalized.match(/class\s*(\d+)/);
  if (normalized.includes('nursery')) return { rank: 0, section };
  if (normalized.includes('lkg')) return { rank: 1, section };
  if (normalized.includes('ukg')) return { rank: 2, section };
  if (classMatch) return { rank: 2 + Number(classMatch[1]), section };
  return { rank: 1000, section };
};

export default AttendanceManagement;
