import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Clock3,
  DoorOpen,
  Search,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { db } from '../../utils/db';
import { teacherApi, timetableApi } from '../../utils/api';

const TeacherTimetable = () => {
  const navigate = useNavigate();
  const [session] = useState(() => JSON.parse(localStorage.getItem('active_session')) || null);
  const [activePage, setActivePage] = useState('home');
  const [selectedDay, setSelectedDay] = useState('Monday');
  const [examSearch, setExamSearch] = useState('');
  const [teachers, setTeachers] = useState([]);
  const [classTimetables, setClassTimetables] = useState([]);
  const [examSlots] = useState(() => db.getAll('timetable_exam_slots'));
  const [loadError, setLoadError] = useState('');

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

  const weeklyRoutine = useMemo(() => {
    return buildTeacherWeeklyRoutine(classTimetables, assignedClasses, teacher);
  }, [assignedClasses, classTimetables, teacher]);

  const daysWithClasses = useMemo(() => {
    return weekDays.filter((day) => weeklyRoutine.some((entry) => entry.dayOfWeek === day));
  }, [weeklyRoutine]);

  const activeDay = daysWithClasses.includes(selectedDay) ? selectedDay : daysWithClasses[0] || 'Monday';

  const selectedDayClasses = useMemo(() => {
    return weeklyRoutine.filter((entry) => entry.dayOfWeek === activeDay);
  }, [activeDay, weeklyRoutine]);

  const filteredExamSlots = useMemo(() => {
    const query = examSearch.trim().toLowerCase();
    return examSlots
      .filter((slot) => assignedClasses.includes(slot.className) || slot.invigilatorName === teacherName)
      .filter((slot) => {
        if (!query) return true;
        return (
          slot.examTitle?.toLowerCase().includes(query) ||
          slot.className?.toLowerCase().includes(query) ||
          slot.subjectName?.toLowerCase().includes(query) ||
          slot.invigilatorName?.toLowerCase().includes(query) ||
          slot.roomId?.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => new Date(a.examDate || 0) - new Date(b.examDate || 0) || sortByDayAndTime(a, b));
  }, [assignedClasses, examSearch, examSlots, teacherName]);

  useEffect(() => {
    if (!session || session.role !== 'teacher') {
      navigate('/login');
    }
  }, [navigate, session]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [teacherResponse, timetableResponse] = await Promise.all([
          teacherApi.getAll(),
          timetableApi.getClassTimetables(),
        ]);
        setTeachers(teacherResponse);
        setClassTimetables(timetableResponse);
        setLoadError('');
      } catch (error) {
        setTeachers([]);
        setClassTimetables([]);
        setLoadError(error.message || 'Unable to load teacher timetable data.');
      }
    };

    if (session?.role === 'teacher') {
      loadData();
    }
  }, [session]);

  if (!session || session.role !== 'teacher') return null;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eefbf4_44%,#f8fafc_100%)] text-slate-900">
      <div className="border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => activePage === 'home' ? navigate('/teacher') : setActivePage('home')}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 transition hover:border-emerald-300 hover:text-emerald-700"
            >
              <ArrowLeft size={14} />
              {activePage === 'home' ? 'Back' : 'Back To Cards'}
            </button>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-emerald-600">Teacher Timetable</p>
              <h1 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">Weekly Teaching Planner</h1>
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
        {activePage === 'home' ? (
          <section className="grid gap-5 md:grid-cols-2">
            <ActionCard
              icon={CalendarClock}
              title="Class & Teacher Timetable"
              text="Open your weekly class routine and see which class you attend on each day and period."
              onClick={() => setActivePage('class')}
            />
            <ActionCard
              icon={ShieldCheck}
              title="Examination Timetable"
              text="Review only the examination timetable entries connected to your classes or invigilation duty."
              onClick={() => setActivePage('exam')}
            />
          </section>
        ) : null}

        {activePage === 'class' ? (
          <div className="mt-8">
            <Panel title="Weekly Class Routine" description="Choose a day to see all classes you need to attend, period-wise, including start time, end time, subject, and room.">
              {daysWithClasses.length > 0 ? (
                <>
                  <div className="mt-6 flex flex-wrap gap-3">
                    {daysWithClasses.map((day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => setSelectedDay(day)}
                        className={`rounded-2xl px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] transition ${
                          activeDay === day
                            ? 'bg-slate-950 text-white'
                            : 'border border-slate-200 bg-slate-50 text-slate-600 hover:border-emerald-300 hover:text-emerald-700'
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>

                  <div className="mt-6 grid gap-4">
                    {selectedDayClasses.map((entry) => (
                      <article key={`${entry.dayOfWeek}-${entry.className}-${entry.periodLabel}`} className="rounded-[1.7rem] border border-slate-200 bg-slate-50 p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">{entry.periodLabel}</p>
                            <h4 className="mt-2 text-xl font-black tracking-tight text-slate-950">{entry.className}</h4>
                            <p className="mt-2 text-sm font-semibold text-slate-500">{entry.subjectName}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <InfoPill icon={Clock3} text={`${entry.timeFrom} - ${entry.timeTo}`} />
                            <InfoPill icon={DoorOpen} text={entry.roomId} />
                            <InfoPill icon={UserRound} text={teacherName} />
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyState
                  icon={CalendarClock}
                  title="No weekly routine available"
                  description="College ke generated class timetable me is teacher ke lectures milte hi weekly routine yahan dikhne lagega."
                />
              )}
            </Panel>
          </div>
        ) : null}

        {activePage === 'exam' ? (
          <div className="mt-8 grid gap-8 xl:grid-cols-[0.82fr_1.18fr]">
            <Panel title="Examination Scope" description="This section only shows exam timetable items tied to your classes or your invigilation name.">
              <div className="mt-6 rounded-[1.8rem] border border-emerald-200 bg-emerald-50 p-5">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700">Teacher Access</p>
                <h4 className="mt-3 font-serif text-2xl font-black italic tracking-tight text-slate-950">Examination timetable is teacher-specific here.</h4>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  You are viewing the teacher route at `/teacher/timetable`, while the all-classes admin timetable remains available at `/college/timetable`.
                </p>
              </div>
            </Panel>

            <Panel title="Examination Timetable" description="Search by exam, class, subject, invigilator, or room within your own timetable scope.">
              <div className="mt-6">
                <SearchInput value={examSearch} onChange={setExamSearch} placeholder="Search exam timetable..." />
              </div>

              {filteredExamSlots.length > 0 ? (
                <div className="mt-6 grid gap-4">
                  {filteredExamSlots.map((slot) => (
                    <RecordCard
                      key={slot.id}
                      icon={ShieldCheck}
                      title={`${slot.examTitle} | ${slot.examDate}`}
                      subtitle={`${slot.className} | ${slot.subjectName} | ${slot.timeFrom} - ${slot.timeTo}`}
                    >
                      <InfoPill icon={UserRound} text={slot.invigilatorName} />
                      <InfoPill icon={Clock3} text={slot.examDuration || `${slot.timeFrom}-${slot.timeTo}`} />
                      <InfoPill icon={DoorOpen} text={slot.roomId || 'Room pending'} />
                    </RecordCard>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={ShieldCheck}
                  title="No examination timetable found"
                  description="No examination entries are currently linked to your classes or invigilation duty."
                />
              )}
            </Panel>
          </div>
        ) : null}
      </main>
    </div>
  );
};

const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const dayOrder = weekDays.reduce((map, day, index) => ({ ...map, [day]: index }), {});

const buildTeacherWeeklyRoutine = (classTimetables, assignedClasses, teacher) => {
  if (!teacher) return [];

  const timetableEntries = buildTeacherWeeklyRoutineFromTimetables(classTimetables, teacher, assignedClasses);
  return timetableEntries.sort(sortByDayAndTime);
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

const buildTeacherWeeklyRoutineFromTimetables = (classTimetables, teacher, assignedClasses) => {
  const teacherKeys = buildTeacherIdentityKeys(teacher);

  return classTimetables
    .filter((record) => assignedClasses.includes(record.className))
    .flatMap((record) => {
      const template = readTimetableTemplate(record);
      if (!template?.rows?.length || !template?.lecturePlan?.length) return [];

      return template.rows.flatMap((row) => {
        if (!weekDays.includes(row.day)) return [];

        return (row.slots || []).flatMap((slot, slotIndex) => {
          if (!slotMatchesTeacher(slot, teacherKeys)) return [];
          const lecture = template.lecturePlan[slotIndex];
          if (!lecture) return [];

          return [{
            dayOfWeek: row.day,
            className: record.className || template.className || 'Class',
            subjectName: slot.subjectName || teacher.specialization || 'Teaching Session',
            periodLabel: `Lecture ${lecture.lectureNumber}`,
            timeFrom: lecture.timeFrom || '',
            timeTo: lecture.timeTo || '',
            roomId: buildRoomLabel(record.className || template.className || ''),
          }];
        });
      });
    });
};

const buildTeacherIdentityKeys = (teacher) => {
  if (!teacher) return [];

  const fullName = `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim();
  return [
    fullName,
    teacher.teacherSystemId,
    teacher.employeeId,
    fullName && teacher.teacherSystemId ? `${fullName} (${teacher.teacherSystemId})` : '',
    fullName && teacher.employeeId ? `${fullName} (${teacher.employeeId})` : '',
  ]
    .map(normalizeTeacherValue)
    .filter(Boolean);
};

const slotMatchesTeacher = (slot, teacherKeys) => {
  const teacherValue = normalizeTeacherValue(slot?.teacherName);
  if (!teacherValue || !teacherKeys.length) return false;
  return teacherKeys.some((key) => teacherValue === key);
};

const normalizeTeacherValue = (value) => String(value || '').trim().toLowerCase();

const readTimetableTemplate = (record) => {
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
      if (!weekDays.includes(day)) return null;

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

const buildRoomLabel = (className) => {
  if (!className) return 'Room pending';
  const section = className.split('/')[1]?.trim();
  if (section) return `Room ${section}`;
  return `${className} Hall`;
};

const sortByDayAndTime = (a, b) => {
  return (dayOrder[a.dayOfWeek] ?? 99) - (dayOrder[b.dayOfWeek] ?? 99) || String(a.timeFrom || '').localeCompare(String(b.timeFrom || ''));
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

const ActionCard = ({ icon, title, text, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex min-h-56 flex-col justify-between rounded-4xl border border-slate-200/80 bg-white p-6 text-left shadow-[0_20px_60px_-38px_rgba(15,23,42,0.45)] transition hover:-translate-y-1 hover:border-emerald-300 lg:p-8"
  >
    <div>
      <div className="flex items-start justify-between gap-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-700 transition group-hover:bg-emerald-600 group-hover:text-white">
          {React.createElement(icon, { size: 24 })}
        </div>
        <ArrowRight className="text-slate-300 transition group-hover:text-emerald-700" size={20} />
      </div>
      <h3 className="mt-7 font-serif text-3xl font-black italic tracking-tight text-slate-950">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-slate-500">{text}</p>
    </div>
    <span className="mt-6 text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700">Open Page</span>
  </button>
);

const Panel = ({ title, description, children }) => (
  <section className="rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
    <h3 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">{title}</h3>
    <p className="mt-2 text-sm leading-7 text-slate-500">{description}</p>
    {children}
  </section>
);

const RecordCard = ({ icon, title, subtitle, children }) => (
  <article className="rounded-[1.8rem] border border-slate-200 bg-slate-50 p-5">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
          {React.createElement(icon, { size: 20 })}
        </div>
        <div className="min-w-0">
          <h4 className="truncate text-lg font-black tracking-tight text-slate-950">{title}</h4>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">{subtitle}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  </article>
);

const SearchInput = ({ value, onChange, placeholder }) => (
  <div className="relative">
    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-12 py-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
    />
  </div>
);

const InfoPill = ({ icon, text }) => (
  <div className="inline-flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">
    {React.createElement(icon, { size: 15, className: 'text-emerald-700' })}
    <span>{text}</span>
  </div>
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

export default TeacherTimetable;
