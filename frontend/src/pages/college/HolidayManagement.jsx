import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { academicSessionApi, curriculumApi, holidayApi } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

const today = getLocalDateKey();
const isCollegeModuleSession = (session) => session?.role === 'admin' || session?.role === 'feature';

const initialHolidayForm = {
  title: '',
  holidayDate: today,
  holidayType: 'Public Holiday',
  audience: 'All',
  targetClassIds: [],
  notes: '',
};

const HolidayManagement = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const collegeId = session?.id || '';
  const [holidayForm, setHolidayForm] = useState(initialHolidayForm);
  const [editingHolidayId, setEditingHolidayId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadError, setLoadError] = useState('');
  const sessionsQuery = useQuery({
    queryKey: ['academic-sessions', collegeId],
    queryFn: () => academicSessionApi.getAll(),
    enabled: isCollegeModuleSession(session) && Boolean(collegeId),
    staleTime: 15 * 60 * 1000,
  });
  const currentAcademicSession = useMemo(() => {
    const sessions = sessionsQuery.data || [];
    return sessions.find((item) => item.current) || sessions[0] || null;
  }, [sessionsQuery.data]);
  const holidayRange = useMemo(() => getHolidayRange(currentAcademicSession, today), [currentAcademicSession]);
  const academicSessionId = currentAcademicSession?.id || null;
  const holidayQueryKey = useMemo(() => ['holidays', collegeId, holidayRange.from, holidayRange.to], [collegeId, holidayRange.from, holidayRange.to]);
  const classOptionsQueryKey = useMemo(() => ['holiday-class-options', collegeId, academicSessionId], [collegeId, academicSessionId]);

  const holidaysQuery = useQuery({
    queryKey: holidayQueryKey,
    queryFn: () => holidayApi.getAll(holidayRange),
    enabled: isCollegeModuleSession(session) && Boolean(collegeId) && !sessionsQuery.isLoading,
    staleTime: 10 * 60 * 1000,
  });

  const classOptionsQuery = useQuery({
    queryKey: classOptionsQueryKey,
    queryFn: () => curriculumApi.getClassSummaries(academicSessionId),
    enabled: isCollegeModuleSession(session) && Boolean(collegeId),
    staleTime: 15 * 60 * 1000,
  });

  const holidays = holidaysQuery.data || [];
  const classOptions = useMemo(() => {
    return (classOptionsQuery.data || [])
      .filter((schoolClass) => String(schoolClass.status || '').toUpperCase() !== 'ARCHIVED')
      .map((schoolClass) => ({
        id: schoolClass.classId,
        name: schoolClass.className,
      }))
      .filter((schoolClass) => schoolClass.id && schoolClass.name)
      .sort((first, second) => first.name.localeCompare(second.name));
  }, [classOptionsQuery.data]);

  useEffect(() => {
    if (!isCollegeModuleSession(session) || !collegeId) {
      navigate('/login');
    }
  }, [collegeId, navigate, session]);

  const saveHolidayMutation = useMutation({
    mutationFn: ({ id, payload }) => (id ? holidayApi.update(id, payload) : holidayApi.create(payload)),
    onSuccess: (savedHoliday, variables) => {
      queryClient.setQueryData(holidayQueryKey, (current = []) => {
        if (variables.id) {
          return current.map((holiday) => holiday.id === variables.id ? savedHoliday : holiday);
        }
        return [savedHoliday, ...current];
      });
      setHolidayForm({
        ...initialHolidayForm,
        holidayDate: savedHoliday.holidayDate || holidayForm.holidayDate,
      });
      setEditingHolidayId(null);
      setLoadError('');
    },
    onError: (error) => {
      setLoadError(error.message || 'Unable to save holiday.');
    },
  });

  const deleteHolidayMutation = useMutation({
    mutationFn: (holidayId) => holidayApi.delete(holidayId),
    onSuccess: (_, holidayId) => {
      queryClient.setQueryData(holidayQueryKey, (current = []) => current.filter((holiday) => holiday.id !== holidayId));
      if (editingHolidayId === holidayId) {
        setEditingHolidayId(null);
        setHolidayForm(initialHolidayForm);
      }
      setLoadError('');
    },
    onError: (error) => {
      setLoadError(error.message || 'Unable to delete holiday.');
    },
  });

  const filteredHolidays = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return [...holidays]
      .filter((holiday) => {
        if (!query) return true;
        return (
          String(holiday.title || '').toLowerCase().includes(query) ||
          String(holiday.holidayType || '').toLowerCase().includes(query) ||
          String(holiday.audience || '').toLowerCase().includes(query) ||
          String(holiday.notes || '').toLowerCase().includes(query) ||
          String(holiday.holidayDate || '').toLowerCase().includes(query) ||
          getHolidayClassLabel(holiday).toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        const dateA = getHolidaySortTime(a);
        const dateB = getHolidaySortTime(b);
        if (dateA !== dateB) return dateB - dateA;
        return Number(b.id || 0) - Number(a.id || 0);
      });
  }, [holidays, searchTerm]);

  const upcomingHolidays = useMemo(() => holidays.filter((holiday) => holiday.holidayDate >= today), [holidays]);
  const pastHolidays = useMemo(() => holidays.filter((holiday) => holiday.holidayDate < today), [holidays]);
  const nextHoliday = useMemo(() => (
    [...upcomingHolidays]
      .sort((a, b) => new Date(`${a.holidayDate}T00:00:00`).getTime() - new Date(`${b.holidayDate}T00:00:00`).getTime())
      [0] || null
  ), [upcomingHolidays]);

  const handleSaveHoliday = async (e) => {
    e.preventDefault();

    const title = holidayForm.title.trim();
    const holidayDate = holidayForm.holidayDate;
    const notes = holidayForm.notes.trim();

    if (!title || !holidayDate) return;

    saveHolidayMutation.mutate({
      id: editingHolidayId,
      payload: {
        title,
        holidayDate,
        holidayType: holidayForm.holidayType,
        audience: holidayForm.audience,
        targetClassIds: holidayForm.audience === 'Students' ? holidayForm.targetClassIds : [],
        notes,
      },
    });
  };

  const handleDeleteHoliday = async (holidayId) => {
    if (!window.confirm('Delete this holiday entry?')) return;
    deleteHolidayMutation.mutate(holidayId);
  };

  const handleEditHoliday = (holiday) => {
    const legacyTargetIds = Array.isArray(holiday.targetClassIds) && holiday.targetClassIds.length
      ? holiday.targetClassIds
      : resolveLegacyTargetClassIds(holiday.targetClasses, classOptions);
    setEditingHolidayId(holiday.id);
    setHolidayForm({
      title: holiday.title || '',
      holidayDate: holiday.holidayDate || today,
      holidayType: holiday.holidayType || 'Public Holiday',
      audience: holiday.audience || 'All',
      targetClassIds: legacyTargetIds,
      notes: holiday.notes || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAudienceChange = (audience) => {
    setHolidayForm((current) => ({
      ...current,
      audience,
      targetClassIds: [],
    }));
  };

  const handleTargetClassToggle = (classId) => {
    setHolidayForm((current) => {
      if (classId === 'All') {
        return {
          ...current,
          targetClassIds: [],
        };
      }

      const currentClasses = current.targetClassIds || [];
      const isSelected = currentClasses.includes(classId);
      const nextClasses = isSelected
        ? currentClasses.filter((value) => value !== classId)
        : [...currentClasses, classId];

      return {
        ...current,
        targetClassIds: nextClasses,
      };
    });
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fff7ed_0%,#fffbeb_46%,#ffffff_100%)] pb-16 text-slate-900">
      <div className="border-b border-orange-100 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/college')}
              className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 transition hover:border-orange-300 hover:text-orange-700"
            >
              <ArrowLeft size={14} />
              Dashboard
            </button>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-orange-600">Holiday Management</p>
              <h1 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">College Holiday Calendar</h1>
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
        {sessionsQuery.isError || holidaysQuery.isError || classOptionsQuery.isError ? (
          <div className="mb-6 rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
            {sessionsQuery.error?.message || holidaysQuery.error?.message || classOptionsQuery.error?.message || 'Unable to load holidays.'}
          </div>
        ) : null}
        <section className="overflow-hidden rounded-4xl border border-orange-200/70 bg-[linear-gradient(140deg,#9a3412_0%,#ea580c_52%,#fb923c_100%)] text-white shadow-[0_30px_80px_-40px_rgba(154,52,18,0.85)]">
          <div className="grid gap-8 px-7 py-8 lg:grid-cols-[1.3fr_1fr] lg:px-10 lg:py-10">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.32em] text-orange-100">Academic Calendar</p>
              <h2 className="mt-3 max-w-3xl font-serif text-4xl font-black italic leading-none tracking-tight">
                Add the exact days when your college remains closed and keep the holiday list ready for students and staff.
              </h2>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-orange-50/90">
                Save public holidays, festival breaks, exam leave days, or emergency closure dates in one place for this college account.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              <HolidayStat label="Total Holidays" value={String(holidays.length)} icon={ClipboardList} />
              <HolidayStat label="Upcoming Days" value={String(upcomingHolidays.length)} icon={CalendarDays} />
              <HolidayStat
                label="Next Holiday"
                value={nextHoliday ? formatShortDate(nextHoliday.holidayDate) : 'None'}
                icon={CheckCircle2}
              />
            </div>
          </div>
        </section>

        <div className="mt-8 space-y-8">
          <section className="rounded-4xl border border-orange-200/70 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(234,88,12,0.35)]">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-orange-100 p-3 text-orange-700">
                <Plus size={20} />
              </div>
              <div>
                <h3 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">
                  {editingHolidayId ? 'Update Holiday' : 'Add Holiday'}
                </h3>
                <p className="text-sm font-semibold text-slate-500">Choose the day on which the holiday occurs.</p>
              </div>
            </div>

            <form onSubmit={handleSaveHoliday} className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                  Holiday Name
                </label>
                <input
                  value={holidayForm.title}
                  onChange={(e) => setHolidayForm((current) => ({ ...current, title: e.target.value }))}
                  placeholder="Example: Diwali Break"
                  className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-100"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                    Holiday Date
                  </label>
                  <input
                    type="date"
                    value={holidayForm.holidayDate}
                    onChange={(e) => setHolidayForm((current) => ({ ...current, holidayDate: e.target.value }))}
                    className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                    Type
                  </label>
                  <select
                    value={holidayForm.holidayType}
                    onChange={(e) => setHolidayForm((current) => ({ ...current, holidayType: e.target.value }))}
                    className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-100"
                  >
                    <option>Public Holiday</option>
                    <option>Festival Holiday</option>
                    <option>Semester Break</option>
                    <option>Exam Leave</option>
                    <option>Emergency Closure</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                    Send Notice To
                  </label>
                  <select
                    value={holidayForm.audience}
                    onChange={(e) => handleAudienceChange(e.target.value)}
                    className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-100"
                  >
                    <option>All</option>
                    <option>Students</option>
                    <option>Teachers</option>
                  </select>
                </div>
              </div>

              {holidayForm.audience === 'Students' ? (
                <div>
                  <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                    Class Name
                  </label>
                  <div className="grid gap-3 rounded-2xl border-2 border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-900 focus-within:border-orange-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-orange-100 md:grid-cols-2 lg:grid-cols-3">
                    <ClassCheckOption
                      label="All"
                      checked={!holidayForm.targetClassIds.length}
                      onChange={() => handleTargetClassToggle('All')}
                    />
                    {classOptions.map((schoolClass) => (
                      <ClassCheckOption
                        key={schoolClass.id}
                        label={schoolClass.name}
                        checked={holidayForm.targetClassIds.includes(schoolClass.id)}
                        onChange={() => handleTargetClassToggle(schoolClass.id)}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              <div>
                <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                  Notes
                </label>
                <textarea
                  rows="4"
                  value={holidayForm.notes}
                  onChange={(e) => setHolidayForm((current) => ({ ...current, notes: e.target.value }))}
                  placeholder="Optional details like campus closure, event name, or special instructions."
                  className="w-full rounded-3xl border-2 border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-100"
                />
              </div>

              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-2xl bg-orange-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-orange-200 transition hover:bg-orange-700"
                disabled={saveHolidayMutation.isPending}
              >
                <Plus size={16} />
                {editingHolidayId ? 'Update Holiday' : 'Save Holiday'}
              </button>
            </form>
          </section>

          <section className="rounded-4xl border border-orange-200/70 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(234,88,12,0.35)]">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">Holiday Register</h3>
                <p className="text-sm font-semibold text-slate-500">{filteredHolidays.length} holiday record(s) found</p>
              </div>

              <div className="relative min-w-0 md:min-w-80">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by holiday, type, date..."
                  className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-12 py-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-100"
                />
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200">
              {filteredHolidays.length === 0 ? (
                <div className="border border-dashed border-orange-200 bg-orange-50/70 px-5 py-10 text-center text-sm font-semibold text-orange-700">
                  No holidays added yet for this college.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse bg-white">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="border-b border-r border-slate-200 px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                          S.No
                        </th>
                        <th className="border-b border-r border-slate-200 px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                          Holiday Name
                        </th>
                        <th className="border-b border-r border-slate-200 px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                          Date
                        </th>
                        <th className="border-b border-r border-slate-200 px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                          Type
                        </th>
                        <th className="border-b border-r border-slate-200 px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                          Notice Sent To
                        </th>
                        <th className="border-b border-r border-slate-200 px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                          Classes
                        </th>
                        <th className="border-b border-r border-slate-200 px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                          Status
                        </th>
                        <th className="border-b border-r border-slate-200 px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                          Notes
                        </th>
                        <th className="border-b border-slate-200 px-4 py-3 text-center text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHolidays.map((holiday, index) => (
                        <tr key={holiday.id} className="align-top odd:bg-white even:bg-slate-50/80">
                          <td className="border-b border-r border-slate-200 px-4 py-3 text-sm font-bold text-slate-600">
                            {index + 1}
                          </td>
                          <td className="border-b border-r border-slate-200 px-4 py-3 text-sm font-black text-slate-900">
                            {holiday.title}
                          </td>
                          <td className="border-b border-r border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600">
                            <div>{formatShortDate(holiday.holidayDate)}</div>
                            <div className="mt-1 text-xs font-medium text-slate-400">
                              {formatLongDate(holiday.holidayDate)}
                            </div>
                          </td>
                          <td className="border-b border-r border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600">
                            {holiday.holidayType || 'Holiday'}
                          </td>
                          <td className="border-b border-r border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600">
                            {holiday.audience || 'All'}
                          </td>
                          <td className="border-b border-r border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600">
                            {getHolidayClassLabel(holiday)}
                          </td>
                          <td className="border-b border-r border-slate-200 px-4 py-3">
                            <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                              holiday.holidayDate >= today ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                            }`}>
                              {holiday.holidayDate >= today ? 'Upcoming' : 'Completed'}
                            </span>
                          </td>
                          <td className="border-b border-r border-slate-200 px-4 py-3 text-sm leading-6 text-slate-500">
                            {holiday.notes || '-'}
                          </td>
                          <td className="border-b border-slate-200 px-4 py-3 text-center">
                            <button
                              onClick={() => handleEditHoliday(holiday)}
                              className="mr-2 inline-flex items-center justify-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-black text-orange-700 transition hover:bg-orange-100"
                            >
                              <Pencil size={15} />
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteHoliday(holiday.id)}
                              className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-black text-rose-700 transition hover:bg-rose-100"
                              disabled={deleteHolidayMutation.isPending}
                            >
                              <Trash2 size={15} />
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {pastHolidays.length > 0 ? (
              <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                {pastHolidays.length} past holiday record(s) are also included in this register.
              </p>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
};

const HolidayStat = ({ label, value, icon: Icon }) => (
  <div className="rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-orange-100">{label}</p>
        <p className="mt-2 text-2xl font-black tracking-tight text-white">{value}</p>
      </div>
      <div className="rounded-2xl bg-white/10 p-3 text-white">
        <Icon size={20} />
      </div>
    </div>
  </div>
);

const ClassCheckOption = ({ label, checked, onChange }) => (
  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 transition hover:border-orange-200 hover:bg-orange-50">
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="h-4 w-4 rounded border-slate-300 text-orange-600 accent-orange-600 focus:ring-orange-500"
    />
    <span className="text-sm font-bold text-slate-700">{label}</span>
  </label>
);

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getHolidayRange(academicSession, fallbackDateValue) {
  if (academicSession?.startDate && academicSession?.endDate) {
    return {
      from: academicSession.startDate,
      to: academicSession.endDate,
    };
  }

  return getFallbackAcademicYearRange(fallbackDateValue);
}

function getFallbackAcademicYearRange(dateValue) {
  const date = new Date(`${dateValue}T00:00:00`);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const startYear = month >= 4 ? year : year - 1;
  return {
    from: `${startYear}-04-01`,
    to: `${startYear + 1}-03-31`,
  };
}

function formatLongDate(value) {
  if (!value) return 'Date not available';
  const parsedDate = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) return value;
  return parsedDate.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatShortDate(value) {
  if (!value) return 'None';
  const parsedDate = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) return value;
  return parsedDate.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}

function getHolidayClassLabel(holiday) {
  if (holiday.audience !== 'Students') return 'All';
  if (Array.isArray(holiday.targetClassTargets) && holiday.targetClassTargets.length) {
    return holiday.targetClassTargets.map((target) => target.className).join(', ');
  }
  if (Array.isArray(holiday.targetClasses) && holiday.targetClasses.length) {
    return holiday.targetClasses.join(', ');
  }
  if (holiday.targetClasses) return String(holiday.targetClasses);
  return 'All';
}

function resolveLegacyTargetClassIds(targetClasses, classOptions) {
  if (!Array.isArray(targetClasses) || !targetClasses.length) return [];
  const classIdByName = new Map(classOptions.map((schoolClass) => [String(schoolClass.name || '').toLowerCase(), schoolClass.id]));
  return targetClasses
    .filter((className) => String(className || '').toLowerCase() !== 'all')
    .map((className) => classIdByName.get(String(className || '').toLowerCase()))
    .filter(Boolean);
}

function getHolidaySortTime(holiday) {
  const dateValue = holiday.updatedAt || holiday.createdAt || holiday.holidayDate || 0;
  const parsedTime = new Date(dateValue).getTime();
  return Number.isNaN(parsedTime) ? 0 : parsedTime;
}

export default HolidayManagement;
