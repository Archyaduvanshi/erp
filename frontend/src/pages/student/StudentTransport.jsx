import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bus,
  CalendarDays,
  Clock3,
  MapPin,
  Route,
} from 'lucide-react';
import { holidayApi, studentApi, transportApi } from '../../utils/api';
import { getFacilityAccessState } from '../../utils/facilityUtils';
import { holidayAppliesToStudentClass } from '../../utils/noticeUtils';

const StudentTransport = () => {
  const navigate = useNavigate();
  const [session] = useState(() => JSON.parse(localStorage.getItem('active_session')) || null);
  const [student, setStudent] = useState(null);
  const [transportRecords, setTransportRecords] = useState([]);
  const [transportAttendanceRecords, setTransportAttendanceRecords] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!session || session.role !== 'student') {
      navigate('/login');
      return;
    }

    const loadTransportWorkspace = async () => {
      try {
        const [studentResponse, assignmentResponse, driverResponse, attendanceResponse, holidayResponse] = await Promise.all([
          studentApi.getById(session.studentId),
          transportApi.getAssignments(),
          transportApi.getDrivers(),
          transportApi.getAttendance(),
          holidayApi.getAll(),
        ]);
        setStudent(studentResponse);
        setTransportRecords(assignmentResponse);
        setDrivers(driverResponse);
        setTransportAttendanceRecords(attendanceResponse);
        setHolidays(holidayResponse.filter((holiday) => holidayAppliesToStudentClass(
          holiday,
          studentResponse.assignedClass || studentResponse.className,
        )));
        setLoadError('');
      } catch (error) {
        setHolidays([]);
        setLoadError(error.message || 'Unable to load student transport details.');
      }
    };

    loadTransportWorkspace();
  }, [navigate, session]);

  const studentName = student
    ? `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.enrollmentNo || student.systemId || 'Student'
    : 'Student';

  const transportAssignment = useMemo(() => {
    if (!student) return null;
    const studentKeys = [String(student.id), String(student.systemId || ''), String(student.enrollmentNo || '')];
    return transportRecords.find((record) =>
      studentKeys.includes(String(record.studentId || '')) ||
      String(record.studentName || '').trim().toLowerCase() === studentName.toLowerCase(),
    ) || null;
  }, [student, studentName, transportRecords]);

  const assignedDriver = useMemo(() => {
    if (!transportAssignment?.assignedDriverId) return null;
    return drivers.find((driver) => String(driver.id) === String(transportAssignment.assignedDriverId)) || null;
  }, [drivers, transportAssignment]);

  const driverPhone = transportAssignment?.driverPhone || assignedDriver?.driverPhone || 'Not added';
  const pickupPoints = assignedDriver?.pickupPoints || 'Not added';
  const vehicleType = assignedDriver?.vehicleType || 'Not added';
  const transportAccess = getFacilityAccessState(student, 'transport');
  const studentTransportAttendance = useMemo(() => {
    if (!student) return [];

    const studentKeys = [
      String(student.id || ''),
      String(student.systemId || ''),
      String(student.enrollmentNo || ''),
    ].filter(Boolean);
    const normalizedStudentName = studentName.trim().toLowerCase();

    return transportAttendanceRecords
      .filter((record) => {
        const recordStudentId = String(record.studentId || '');
        const recordRollNo = String(record.rollNo || '');
        const recordName = String(record.studentName || '').trim().toLowerCase();

        return (
          studentKeys.includes(recordStudentId) ||
          studentKeys.includes(recordRollNo) ||
          recordName === normalizedStudentName
        );
      })
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  }, [student, studentName, transportAttendanceRecords]);

  const transportMonthOptions = useMemo(() => {
    const monthSet = new Set(studentTransportAttendance
      .map((record) => String(record.date || '').slice(0, 7))
      .filter(Boolean));
    monthSet.add(new Date().toISOString().slice(0, 7));
    return [...monthSet].sort((left, right) => right.localeCompare(left));
  }, [studentTransportAttendance]);

  useEffect(() => {
    if (!transportMonthOptions.length) return;
    if (!transportMonthOptions.includes(selectedMonth)) {
      setSelectedMonth(transportMonthOptions[0]);
    }
  }, [selectedMonth, transportMonthOptions]);

  const monthlyTransportRegister = useMemo(() => {
    if (!student) return null;
    if (!studentTransportAttendance.length) return null;

    const monthValue = selectedMonth || transportMonthOptions[0];
    if (!monthValue) return null;

    const [yearValue, monthValueIndex] = monthValue.split('-').map(Number);
    if (!yearValue || !monthValueIndex) return null;

    const selectedYear = yearValue;
    const selectedMonthIndex = monthValueIndex - 1;
    const recordsForMonth = studentTransportAttendance.filter((record) => {
      const recordDate = new Date(`${record.date || ''}T00:00:00`);
      return recordDate.getFullYear() === selectedYear && recordDate.getMonth() === selectedMonthIndex;
    });

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
    recordsForMonth.forEach((record) => {
      const recordDate = new Date(`${record.date || ''}T00:00:00`);
      const dayNumber = recordDate.getDate();
      if (dayNumber > visibleDayCount || holidayColumnMap.has(dayNumber)) return;
      dailyStatusMap.set(dayNumber, record.status === 'Present' ? 'P' : 'A');
    });

    return {
      studentName,
      className: transportAssignment?.className || student?.assignedClass || '-',
      routeName: transportAssignment?.routeName || assignedDriver?.routeName || '-',
      busNumber: transportAssignment?.busNumber || assignedDriver?.busNumber || '-',
      monthLabel: new Date(selectedYear, selectedMonthIndex, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
      dayColumns,
      holidayColumnMap,
      days: dayColumns.map((dayNumber) => dailyStatusMap.get(dayNumber) || ''),
    };
  }, [assignedDriver?.busNumber, assignedDriver?.routeName, holidays, selectedMonth, student, student?.assignedClass, studentName, studentTransportAttendance, transportAssignment?.busNumber, transportAssignment?.className, transportAssignment?.routeName, transportMonthOptions]);

  if (!session || session.role !== 'student') return null;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#ecfeff_45%,#f8fafc_100%)] text-slate-900">
      <div className="border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/student')}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 transition hover:border-sky-300 hover:text-sky-700"
            >
              <ArrowLeft size={14} />
              Back
            </button>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-sky-600">Student Transport</p>
              <h1 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">My Transport Details</h1>
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
        {transportAccess.active && transportAssignment ? (
          <div className="grid gap-8">
            <section className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-600">Route Summary</p>
              <h2 className="mt-3 font-serif text-3xl font-black italic tracking-tight text-slate-950">
                {transportAssignment.routeName || 'Route not assigned'}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                This transport record is mapped only to the logged-in student and shows the assigned route, bus, pickup stop, and driver contact.
              </p>

              <div className="mt-8 grid gap-4 md:grid-cols-2">
                <FeatureCard icon={Bus} label="Bus Number" value={transportAssignment.busNumber || 'Not assigned'} />
                <FeatureCard icon={MapPin} label="Pickup Stop" value={transportAssignment.pickupStop || 'Not added'} />
                <FeatureCard icon={Route} label="Route Name" value={transportAssignment.routeName || 'Not assigned'} />
                <FeatureCard icon={Clock3} label="Vehicle Type" value={vehicleType} />
              </div>
              </div>

              <div className="rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-600">Contact Details</p>
              <h2 className="mt-3 font-serif text-3xl font-black italic tracking-tight text-slate-950">
                Driver And Student Info
              </h2>
              <div className="mt-8 grid gap-4">
                <InfoRow label="Student" value={transportAssignment.studentName || studentName} />
                <InfoRow label="Class" value={transportAssignment.className || student?.assignedClass || 'Not assigned'} />
                <InfoRow label="Driver Name" value={transportAssignment.driverName || assignedDriver?.driverName || 'Not assigned'} />
                <InfoRow label="Driver Mobile" value={driverPhone} />
                <InfoRow label="Pickup Points" value={pickupPoints} />
              </div>
              </div>
            </section>

            <section className="rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-600">Saved Transport Attendance</p>
              <h2 className="mt-3 font-serif text-3xl font-black italic tracking-tight text-slate-950">
                Student Attendance Register
              </h2>

              {monthlyTransportRegister ? (
                <div className="mt-8 overflow-hidden rounded-[1.8rem] border border-slate-200">
                  <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-lg font-black tracking-tight text-slate-950">{monthlyTransportRegister.studentName}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-600">
                          Month: {monthlyTransportRegister.monthLabel}
                        </p>
                      </div>
                      <label className="space-y-2">
                        <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Select Month</span>
                        <input
                          type="month"
                          value={selectedMonth}
                          min={transportMonthOptions[transportMonthOptions.length - 1] || undefined}
                          max={transportMonthOptions[0] || undefined}
                          onChange={(e) => setSelectedMonth(e.target.value)}
                          className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                        />
                      </label>
                    </div>
                  </div>
                  <div className="mx-auto w-full max-w-6xl overflow-x-auto">
                    <table className="w-max min-w-full border-collapse text-center">
                      <thead>
                        <tr className="bg-slate-950 text-white">
                          <th className="sticky left-0 z-10 min-w-64 border-b border-r border-slate-800 bg-slate-950 px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.2em]">
                            Student
                          </th>
                          {monthlyTransportRegister.dayColumns.map((dayNumber) => (
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
                            {monthlyTransportRegister.studentName}
                          </td>
                          {monthlyTransportRegister.days.map((value, index) => {
                            const dayNumber = monthlyTransportRegister.dayColumns[index];
                            const holidayLabel = monthlyTransportRegister.holidayColumnMap.get(dayNumber);

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
                <div className="mt-8 rounded-[1.8rem] border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-slate-300 shadow-sm">
                    <CalendarDays size={28} />
                  </div>
                  <h3 className="mt-5 font-serif text-2xl font-black italic tracking-tight text-slate-950">No saved transport attendance yet</h3>
                  <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-500">
                    Once the institution saves transport attendance for this student, it will appear here in table format.
                  </p>
                </div>
              )}
            </section>
          </div>
        ) : (
          <section className="mt-8 rounded-4xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-[0_20px_60px_-35px_rgba(15,23,42,0.2)]">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-50 text-slate-300">
              <Bus size={34} />
            </div>
            <h3 className="mt-6 font-serif text-3xl font-black italic tracking-tight text-slate-950">No transport assignment yet</h3>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-500">
              {transportAccess.requested
                ? `Transport facility is ${transportAccess.status} for this student. Once it is active and the institution assigns a route, bus, and pickup stop, it will appear here.`
                : 'No transport facility is requested for this student yet. The college can enable it later from the student data and then assign a route.'}
            </p>
          </section>
        )}
      </main>
    </div>
  );
};

const formatMonthDateKey = (year, month, day) => {
  const monthValue = String(month).padStart(2, '0');
  const dayValue = String(day).padStart(2, '0');
  return `${year}-${monthValue}-${dayValue}`;
};

const FeatureCard = ({ icon: Icon, label, value }) => (
  <div className="rounded-[1.8rem] border border-slate-200 bg-slate-50 p-5">
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-sky-700 shadow-sm">
      <Icon size={20} />
    </div>
    <p className="mt-4 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
    <p className="mt-2 text-base font-black tracking-tight text-slate-950">{value}</p>
  </div>
);

const InfoRow = ({ label, value }) => (
  <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
    <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</span>
    <span className="text-right text-sm font-black text-slate-900">{value}</span>
  </div>
);

export default StudentTransport;
