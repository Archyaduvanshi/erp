import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { db } from '../../utils/db';

const today = new Date().toISOString().split('T')[0];

const initialHolidayForm = {
  title: '',
  holidayDate: today,
  holidayType: 'Public Holiday',
  notes: '',
};

const HolidayManagement = () => {
  const navigate = useNavigate();
  const [session] = useState(() => JSON.parse(localStorage.getItem('active_session')) || null);
  const [collegeId] = useState(() => localStorage.getItem('current_college_id'));
  const [holidays, setHolidays] = useState(() => db.getAll('holiday_calendar'));
  const [holidayForm, setHolidayForm] = useState(initialHolidayForm);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!session || session.role !== 'admin' || !collegeId) {
      navigate('/login');
      return;
    }

    refreshData();
  }, [collegeId, navigate, session]);

  const refreshData = () => {
    setHolidays(db.getAll('holiday_calendar'));
  };

  const filteredHolidays = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return [...holidays]
      .filter((holiday) => {
        if (!query) return true;
        return (
          String(holiday.title || '').toLowerCase().includes(query) ||
          String(holiday.holidayType || '').toLowerCase().includes(query) ||
          String(holiday.notes || '').toLowerCase().includes(query) ||
          String(holiday.holidayDate || '').toLowerCase().includes(query)
        );
      })
      .sort((a, b) => new Date(a.holidayDate).getTime() - new Date(b.holidayDate).getTime());
  }, [holidays, searchTerm]);

  const upcomingHolidays = filteredHolidays.filter((holiday) => holiday.holidayDate >= today);
  const pastHolidays = filteredHolidays.filter((holiday) => holiday.holidayDate < today);
  const nextHoliday = upcomingHolidays[0] || null;

  const handleSaveHoliday = (e) => {
    e.preventDefault();

    const title = holidayForm.title.trim();
    const holidayDate = holidayForm.holidayDate;
    const notes = holidayForm.notes.trim();

    if (!title || !holidayDate) return;

    db.save('holiday_calendar', {
      title,
      holidayDate,
      holidayType: holidayForm.holidayType,
      notes,
    });

    setHolidayForm({
      ...initialHolidayForm,
      holidayDate,
    });
    refreshData();
  };

  const handleDeleteHoliday = (holidayId) => {
    if (!window.confirm('Delete this holiday entry?')) return;
    db.replaceAll(
      'holiday_calendar',
      db.getAll('holiday_calendar').filter((holiday) => String(holiday.id) !== String(holidayId)),
    );
    refreshData();
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
                <h3 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">Add Holiday</h3>
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

              <div className="grid gap-4 md:grid-cols-2">
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
              </div>

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
              >
                <Plus size={16} />
                Save Holiday
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
                              onClick={() => handleDeleteHoliday(holiday.id)}
                              className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-black text-rose-700 transition hover:bg-rose-100"
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

export default HolidayManagement;
