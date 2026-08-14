import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BedDouble,
  Building2,
  CalendarDays,
  GraduationCap,
  Home,
  Phone,
  Shield,
  UserRound,
} from 'lucide-react';
import { hostelApi, studentApi } from '../../utils/api';
import { getFacilityAccessState } from '../../utils/facilityUtils';

const StudentHostel = () => {
  const navigate = useNavigate();
  const [session] = useState(() => JSON.parse(localStorage.getItem('active_session')) || null);
  const [student, setStudent] = useState(null);
  const [residents, setResidents] = useState([]);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!session || session.role !== 'student') {
      navigate('/login');
      return;
    }

    const loadHostelWorkspace = async () => {
      try {
        const [studentResponse, residentResponse] = await Promise.all([
          studentApi.getById(session.studentId),
          hostelApi.getResidents(),
        ]);
        setStudent(studentResponse);
        setResidents(residentResponse);
        setLoadError('');
      } catch (error) {
        setLoadError(error.message || 'Unable to load hostel details.');
      }
    };

    loadHostelWorkspace();
  }, [navigate, session]);

  const studentName = student
    ? `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.enrollmentNo || student.systemId || 'Student'
    : 'Student';

  const hostelAccess = getFacilityAccessState(student, 'hostel');

  const residentRecord = useMemo(() => {
    if (!student) return null;
    const studentKeys = [
      String(student.id || ''),
      String(student.systemId || ''),
      String(student.enrollmentNo || ''),
    ].filter(Boolean);
    const normalizedStudentName = studentName.trim().toLowerCase();

    return residents.find((record) => {
      const recordStudentId = String(record.studentId || '');
      const recordRollNo = String(record.rollNo || '');
      const recordName = String(record.studentName || '').trim().toLowerCase();
      return studentKeys.includes(recordStudentId)
        || studentKeys.includes(recordRollNo)
        || recordName === normalizedStudentName;
    }) || null;
  }, [residents, student, studentName]);

  if (!session || session.role !== 'student') return null;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#ecfdf5_42%,#f8fafc_100%)] text-slate-900">
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
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-emerald-600">Student Hostel</p>
              <h1 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">My Hostel Details</h1>
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

        {hostelAccess.active && residentRecord ? (
          <div className="grid gap-8">
            <section className="overflow-hidden rounded-4xl border border-emerald-200/50 bg-[linear-gradient(135deg,#052e16_0%,#166534_36%,#0f766e_100%)] px-7 py-8 text-white shadow-[0_30px_80px_-40px_rgba(6,78,59,0.85)] lg:px-10 lg:py-10">
              <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.3em] text-emerald-200">Hostel Allocation</p>
                  <h2 className="mt-4 font-serif text-4xl font-black italic leading-none tracking-tight">
                    {residentRecord.hostelName || 'Hostel Assigned'}
                  </h2>
                  <p className="mt-5 max-w-2xl text-sm leading-7 text-emerald-50/85">
                    View your allotted hostel, room, bed, joining date, and emergency contact details in one place.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <MetricCard label="Room Number" value={residentRecord.roomNumber || 'Pending'} icon={Building2} />
                  <MetricCard label="Bed Number" value={residentRecord.bedNumber || 'Auto'} icon={BedDouble} />
                  <MetricCard label="Monthly Charge" value={`Rs ${residentRecord.monthlyCharge || '0'}`} icon={Home} />
                  <MetricCard label="Status" value={residentRecord.status || student?.hostelStatus || 'active'} icon={Shield} />
                </div>
              </div>
            </section>

            <section className="grid gap-8 xl:grid-cols-[1fr_1fr]">
              <InfoPanel
                title="Resident Details"
                description="Hostel resident information currently linked to your student account."
              >
                <InfoRow icon={UserRound} label="Student" value={residentRecord.studentName || studentName} />
                <InfoRow icon={GraduationCap} label="Class" value={residentRecord.className || student?.assignedClass || 'Not assigned'} />
                <InfoRow icon={Home} label="Hostel" value={residentRecord.hostelName || 'Not available'} />
                <InfoRow icon={Building2} label="Room" value={residentRecord.roomNumber || 'Not available'} />
                <InfoRow icon={BedDouble} label="Bed" value={residentRecord.bedNumber || 'Auto'} />
              </InfoPanel>

              <InfoPanel
                title="Stay And Contact"
                description="Check-in date, contacts, and support references for the hostel stay."
              >
                <InfoRow icon={CalendarDays} label="Check In Date" value={residentRecord.checkInDate || 'Not available'} />
                <InfoRow icon={CalendarDays} label="Check Out Date" value={residentRecord.checkOutDate || 'Currently staying'} />
                <InfoRow icon={Phone} label="Father Contact" value={residentRecord.guardianContact || student?.guardianPhone || 'Not added'} />
                <InfoRow icon={Phone} label="Emergency Contact" value={residentRecord.emergencyContact || 'Not added'} />
                <InfoRow icon={Shield} label="Status" value={residentRecord.status || student?.hostelStatus || 'active'} />
              </InfoPanel>
            </section>

            <InfoPanel
              title="Notes"
              description="Any hostel-specific note or special instruction saved by the institution."
            >
              <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5 text-sm font-semibold leading-7 text-slate-600">
                {residentRecord.notes || 'No hostel note has been added for this student yet.'}
              </div>
            </InfoPanel>
          </div>
        ) : (
          <section className="mt-8 rounded-4xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-[0_20px_60px_-35px_rgba(15,23,42,0.2)]">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-50 text-slate-300">
              <Home size={34} />
            </div>
            <h3 className="mt-6 font-serif text-3xl font-black italic tracking-tight text-slate-950">No hostel allotment yet</h3>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-500">
              {hostelAccess.requested
                ? `Hostel facility is ${hostelAccess.status} for this student. Once a room and bed are allotted by the institution, the details will appear here.`
                : 'No hostel facility is requested for this student yet. The institution can enable hostel access and assign a room later.'}
            </p>
          </section>
        )}
      </main>
    </div>
  );
};

const MetricCard = ({ label, value, icon: Icon }) => (
  <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-50/80">{label}</p>
        <p className="mt-3 text-lg font-black tracking-tight text-white">{value}</p>
      </div>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-200/20 bg-emerald-200/10 text-emerald-50">
        <Icon size={20} />
      </div>
    </div>
  </div>
);

const InfoPanel = ({ title, description, children }) => (
  <section className="rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
    <h2 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">{title}</h2>
    <p className="mt-2 text-sm leading-7 text-slate-500">{description}</p>
    <div className="mt-6 grid gap-3">{children}</div>
  </section>
);

const InfoRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-700 shadow-sm">
        <Icon size={18} />
      </div>
      <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</span>
    </div>
    <span className="text-right text-sm font-black text-slate-800">{value}</span>
  </div>
);

export default StudentHostel;
