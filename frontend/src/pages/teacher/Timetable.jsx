import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarClock,
  Clock3,
  UserRound,
} from 'lucide-react';
import { timetableApi } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

const TeacherTimetable = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [selectedDay, setSelectedDay] = useState('Monday');
  const [weeklyRoutine, setWeeklyRoutine] = useState([]);
  const [loadError, setLoadError] = useState('');

  const teacherName = session?.teacherName || 'Teacher';

  const assignedClasses = useMemo(() => {
    return [...new Set(weeklyRoutine.map((entry) => entry.className).filter(Boolean))].sort(compareClassNames);
  }, [weeklyRoutine]);

  const daysWithClasses = useMemo(() => {
    return weekDays.filter((day) => weeklyRoutine.some((entry) => entry.dayOfWeek === day));
  }, [weeklyRoutine]);

  const activeDay = daysWithClasses.includes(selectedDay) ? selectedDay : daysWithClasses[0] || 'Monday';

  const selectedDayClasses = useMemo(() => {
    return weeklyRoutine.filter((entry) => entry.dayOfWeek === activeDay);
  }, [activeDay, weeklyRoutine]);

  useEffect(() => {
    if (!session || session.role !== 'teacher') {
      navigate('/login');
    }
  }, [navigate, session]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const timetableResponse = await timetableApi.getMyTeacherTimetable();
        setWeeklyRoutine(buildTeacherWeeklyRoutineFromPeriods(timetableResponse?.week || []));
        setLoadError('');
      } catch (error) {
        setWeeklyRoutine([]);
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
              onClick={() => navigate('/teacher')}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 transition hover:border-emerald-300 hover:text-emerald-700"
            >
              <ArrowLeft size={14} />
              Back
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
      </main>
    </div>
  );
};

const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const dayOrder = weekDays.reduce((map, day, index) => ({ ...map, [day]: index }), {});

const buildTeacherWeeklyRoutineFromPeriods = (periods = []) => {
  return periods
    .map((period) => {
      const className = period.sectionName ? `${period.className} / ${period.sectionName}` : period.className;
      return {
        dayOfWeek: toDisplayDay(period.dayOfWeek),
        className: className || 'Class',
        subjectName: period.subjectName || 'Teaching Session',
        periodLabel: `Lecture ${period.periodNumber || '-'}`,
        timeFrom: period.startTime || '',
        timeTo: period.endTime || '',
      };
    })
    .filter((entry) => weekDays.includes(entry.dayOfWeek))
    .sort(sortByDayAndTime);
};

const toDisplayDay = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized ? `${normalized[0].toUpperCase()}${normalized.slice(1)}` : '';
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

const Panel = ({ title, description, children }) => (
  <section className="rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
    <h3 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">{title}</h3>
    <p className="mt-2 text-sm leading-7 text-slate-500">{description}</p>
    {children}
  </section>
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
