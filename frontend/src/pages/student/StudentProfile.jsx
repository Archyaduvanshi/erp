import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bus,
  CalendarDays,
  Download,
  FileBadge2,
  GraduationCap,
  HeartPulse,
  Home,
  IdCard,
  Library,
  Mail,
  Phone,
  Shield,
  UserRound,
  Users,
  ExternalLink,
} from 'lucide-react';
import { studentApi } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

function createQrImageUrl(value) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=512x512&margin=16&data=${encodeURIComponent(value || 'student')}`;
}

async function downloadQrCode(qrCodeData, studentName) {
  const qrUrl = createQrImageUrl(qrCodeData);
  const response = await fetch(qrUrl);
  if (!response.ok) {
    throw new Error('Unable to download QR code.');
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `${(studentName || 'student').replace(/\s+/g, '-').toLowerCase()}-qr.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}

const StudentProfile = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [student, setStudent] = useState(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);

  useEffect(() => {
    if (!session || session.role !== 'student') {
      return;
    }

    if (!session.studentId) {
      return;
    }

    const loadStudent = async () => {
      try {
        const response = await studentApi.getById(session.studentId);
        setStudent(response);
      } catch {}
    };

    loadStudent();
  }, [session]);

  const studentName = student
    ? `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.enrollmentNo || 'Student'
    : 'Student';
  const qrImage = student?.qrCodeData ? createQrImageUrl(student.qrCodeData) : '';
  const selectedDocument = (student?.documents || []).find((document) => document.id === selectedDocumentId) || null;

  useEffect(() => {
    if (!session || session.role !== 'student') {
      navigate('/login');
    }
  }, [navigate, session]);

  if (!session || session.role !== 'student') return null;

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16 font-sans text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-6 py-5 md:px-12 lg:px-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/student')}
              className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-cyan-300 hover:text-cyan-700"
            >
              <ArrowLeft size={16} />
              Dashboard
            </button>
            <div className="rounded-lg bg-cyan-600 p-1.5 shadow-sm">
              <GraduationCap size={20} className="text-white" />
            </div>
            <span className="hidden font-black uppercase italic tracking-tighter text-cyan-800 sm:block sm:text-xl">VidyantraErp</span>
          </div>

          <span className="rounded-full bg-cyan-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-cyan-700">
            Student Profile
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-screen-2xl px-6 pt-12 md:px-12 lg:px-20">
        <section className="overflow-hidden rounded-[2.5rem] bg-[linear-gradient(145deg,#082f49_0%,#0e7490_52%,#164e63_100%)] px-8 py-8 text-white shadow-[0_30px_80px_-40px_rgba(8,47,73,0.85)] md:px-12 md:py-10">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-cyan-200">My Profile</p>
              <h1 className="mt-4 font-serif text-4xl font-black italic tracking-tight">
                {studentName}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-cyan-50/85">
                View the profile details saved by your institution for your student account.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard label="Enrollment No" value={student?.enrollmentNo || 'Pending'} icon={IdCard} />
              <StatCard label="Enrollment No" value={student?.enrollmentNo || 'Pending'} icon={FileBadge2} />
              <StatCard label="Assigned Class" value={student?.assignedClass || 'Not assigned'} icon={CalendarDays} />
              <StatCard label="Status" value={student?.status || 'Pending'} icon={Shield} />
            </div>
          </div>
        </section>

        <section className="mt-10 grid gap-8 lg:grid-cols-2">
          <InfoPanel
            title="Personal Details"
            description="Your basic identity and contact details available in the student portal."
          >
            <InfoRow icon={UserRound} label="Full Name" value={studentName} />
            <InfoRow icon={Mail} label="Email Address" value={student?.email || 'Not added'} />
            <InfoRow icon={Phone} label="Mobile Number" value={student?.mobile || 'Not added'} />
            <InfoRow icon={CalendarDays} label="Date Of Birth" value={student?.dob || 'Not added'} />
            <InfoRow icon={HeartPulse} label="Blood Group" value={student?.bloodGroup || 'Not added'} />
            <InfoRow icon={UserRound} label="Gender" value={student?.gender || 'Not added'} />
          </InfoPanel>

          <InfoPanel
            title="Academic Details"
            description="Admission and class information currently linked to your profile."
          >
            <InfoRow icon={GraduationCap} label="Assigned Class" value={student?.assignedClass || 'Not assigned'} />
            <InfoRow icon={FileBadge2} label="Enrollment Number" value={student?.enrollmentNo || 'Pending'} />
            <InfoRow icon={CalendarDays} label="Registration Date" value={student?.regDate || 'Not added'} />
            <InfoRow icon={CalendarDays} label="Admission Date" value={student?.admissionDate || 'Not added'} />
            <InfoRow icon={Shield} label="Admission Category" value={student?.admissionCategory || student?.category || 'General'} />
            <InfoRow icon={GraduationCap} label="Previous School" value={student?.prevSchool || 'Not added'} />
          </InfoPanel>
        </section>

        <section className="mt-8 grid gap-8 lg:grid-cols-2">
          <InfoPanel
            title="Father Details"
            description="Parent references provided at the time of admission."
          >
            <InfoRow icon={Users} label="Father Name" value={student?.guardianName || 'Not added'} />
            <InfoRow icon={Phone} label="Father Phone" value={student?.guardianPhone || 'Not added'} />
            <InfoRow icon={Home} label="Address" value={student?.address || 'Not added'} />
          </InfoPanel>

          <InfoPanel
            title="Facilities"
            description="Facility preferences and status assigned to your student account."
          >
            <InfoRow icon={Bus} label="Transport" value={formatFacilityStatus(student?.transportOptIn, student?.transportStatus)} />
            <InfoRow icon={Home} label="Hostel" value={formatFacilityStatus(student?.hostelOptIn, student?.hostelStatus)} />
            <InfoRow icon={Library} label="Library" value={formatLibraryFacilityStatus(student)} />
            <InfoRow icon={Shield} label="Verification Status" value={student?.status || 'Pending'} />
            <InfoRow
              icon={CalendarDays}
              label="Created On"
              value={student?.createdAt ? new Date(student.createdAt).toLocaleDateString() : 'Not available'}
            />
          </InfoPanel>
        </section>

        <section className="mt-8 grid gap-8 lg:grid-cols-[1fr_0.8fr]">
          <InfoPanel
            title="Documents"
            description="Documents uploaded while creating your student profile."
          >
            {student?.documents?.length ? (
              <div className="grid gap-3">
                {student.documents.map((document) => (
                  <div
                    key={document.id}
                    className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4"
                  >
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-700">
                      {document.documentType || 'Document'}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-700">
                      {document.fileName || document.fileUploadPath || 'File not available'}
                    </p>
                    {document.fileData ? (
                      <button
                        type="button"
                        onClick={() => setSelectedDocumentId((current) => (current === document.id ? null : document.id))}
                        className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-cyan-100 px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-cyan-800 transition hover:bg-cyan-200"
                      >
                        <ExternalLink size={14} />
                        {selectedDocumentId === document.id ? 'Hide File' : 'View File'}
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState text="No documents are linked to this profile yet." />
            )}

            {selectedDocument?.fileData ? (
              <DocumentPreview document={selectedDocument} />
            ) : null}
          </InfoPanel>

          <InfoPanel
            title="Portal Identity"
            description="Reference values used for login and profile administration."
          >
            {qrImage ? (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-5">
                <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                  <div className="rounded-3xl bg-white p-4 shadow-sm">
                    <img
                      src={qrImage}
                      alt={`${studentName} QR code`}
                      className="h-40 w-40 rounded-2xl object-contain"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await downloadQrCode(student?.qrCodeData, studentName);
                    }}
                    className="inline-flex items-center gap-2 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-cyan-800 transition hover:border-cyan-300 hover:bg-cyan-100"
                  >
                    <Download size={15} />
                    Download QR
                  </button>
                </div>
              </div>
            ) : null}
            <InfoRow icon={Shield} label="Profile Status" value={student?.status || 'Pending'} />
            <InfoRow icon={CalendarDays} label="Card Expiry Date" value={student?.cardExpiryDate || 'Not added'} />
          </InfoPanel>
        </section>
      </div>
    </div>
  );
};

const formatFacilityStatus = (requested, status) => {
  if (!(requested === 'yes' || requested === true)) return 'Not requested';
  return status || 'Requested';
};

const formatLibraryFacilityStatus = (student) => {
  if (!(student?.libraryOptIn === 'yes' || student?.libraryOptIn === true)) return 'Not requested';
  return student?.libraryStatus || 'Requested';
};

const StatCard = ({ label, value, icon: Icon }) => (
  <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-50/80">{label}</p>
        <p className="mt-3 text-lg font-black tracking-tight text-white">{value}</p>
      </div>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-200/10 text-cyan-50">
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
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-cyan-700 shadow-sm">
        <Icon size={18} />
      </div>
      <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</span>
    </div>
    <span className="text-right text-sm font-black text-slate-800">{value}</span>
  </div>
);

const EmptyState = ({ text }) => (
  <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-500">
    {text}
  </div>
);

const DocumentPreview = ({ document }) => (
  <div className="rounded-[1.8rem] border border-slate-200 bg-slate-50 p-4">
    <div className="mb-4">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-700">Document Preview</p>
      <p className="mt-2 text-sm font-semibold text-slate-700">
        {document.fileName || document.fileUploadPath || document.documentType || 'Selected document'}
      </p>
    </div>

    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
      {isImageFile(document) ? (
        <img
          src={document.fileData}
          alt={document.fileName || 'Student document'}
          className="mx-auto max-h-[72vh] w-auto max-w-full object-contain"
        />
      ) : (
        <iframe
          title={document.fileName || 'Student document'}
          src={document.fileData}
          className="h-[72vh] w-full bg-white"
        />
      )}
    </div>
  </div>
);

const isImageFile = (document) => {
  const fileType = String(document?.fileType || '').toLowerCase();
  const fileName = String(document?.fileName || document?.fileUploadPath || '').toLowerCase();
  const fileData = String(document?.fileData || '').toLowerCase();

  return (
    fileType.startsWith('image/') ||
    /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(fileName) ||
    fileData.startsWith('data:image/')
  );
};

export default StudentProfile;
