import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Banknote,
  Briefcase,
  CalendarDays,
  Download,
  FileBadge2,
  GraduationCap,
  IdCard,
  Mail,
  MapPin,
  Phone,
  Shield,
  UserRound,
  ExternalLink,
} from 'lucide-react';
import { teacherApi } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { formatSalary, normalizeTeacherSalary } from '../../utils/salaryUtils';
import { downloadQrCode, useQrCodeDataUrl } from '../../utils/qrCode';

const TeacherProfile = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [teacher, setTeacher] = useState(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);

  useEffect(() => {
    if (!session || session.role !== 'teacher') {
      return;
    }

    if (!session.teacherId) {
      return;
    }

    const loadTeacher = async () => {
      try {
        const response = await teacherApi.getById(session.teacherId);
        setTeacher(normalizeTeacherSalary(response));
      } catch {}
    };

    loadTeacher();
  }, [session]);

  const teacherName = teacher
    ? `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim() || teacher.employeeId || 'Teacher'
    : 'Teacher';
  const qrImage = useQrCodeDataUrl(teacher?.qrCodeData);

  useEffect(() => {
    if (!session || session.role !== 'teacher') {
      navigate('/login');
    }
  }, [navigate, session]);

  if (!session || session.role !== 'teacher') return null;

  const selectedDocument = (teacher?.documents || []).find((document) => document.id === selectedDocumentId) || null;

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16 font-sans text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-6 py-5 md:px-12 lg:px-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/teacher')}
              className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700"
            >
              <ArrowLeft size={16} />
              Dashboard
            </button>
            <div className="rounded-lg bg-emerald-600 p-1.5 shadow-sm">
              <GraduationCap size={20} className="text-white" />
            </div>
            <span className="hidden font-black uppercase italic tracking-tighter text-emerald-800 sm:block sm:text-xl">VidyantraErp</span>
          </div>

          <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-700">
            Teacher Profile
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-screen-2xl px-6 pt-12 md:px-12 lg:px-20">
        <section>
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-emerald-700">My Profile</p>
              <h1 className="mt-3 font-serif text-3xl font-black italic tracking-tight text-slate-950 md:text-4xl">
                {teacherName}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">
                View the profile details created by your college administration for your teacher account.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Employee ID" value={teacher?.employeeId || 'Pending'} icon={Briefcase} />
            <StatCard label="Start Date" value={teacher?.joiningDate || 'Not added'} icon={CalendarDays} />
            <StatCard label="Specialization" value={teacher?.specialization || 'Not assigned'} icon={Shield} />
          </div>
        </section>

        <section className="mt-10 grid gap-8 lg:grid-cols-2">
          <InfoPanel
            title="Personal Details"
            description="Your basic account and contact details available in the teacher portal."
          >
            <InfoRow icon={UserRound} label="Full Name" value={teacherName} />
            <InfoRow icon={Mail} label="Personal Email" value={teacher?.personalEmail || 'Not added'} />
            <InfoRow icon={Phone} label="Mobile Number" value={teacher?.mobileNumber || 'Not added'} />
            <InfoRow icon={MapPin} label="Address" value={teacher?.address || 'Not added'} />
            <InfoRow icon={Briefcase} label="Employee ID" value={teacher?.employeeId || 'Pending'} />
          </InfoPanel>

          <InfoPanel
            title="Work Details"
            description="Academic and employment information assigned to your teacher profile."
          >
            <InfoRow icon={Shield} label="Specialization" value={teacher?.specialization || 'Not assigned'} />
            <InfoRow icon={Briefcase} label="Contract Type" value={teacher?.contractType || 'Not added'} />
            <InfoRow icon={Banknote} label="Monthly Salary" value={formatSalary(teacher?.salary)} />
            <InfoRow icon={CalendarDays} label="Teaching Start Date" value={teacher?.joiningDate || 'Not added'} />
            <InfoRow icon={CalendarDays} label="Experience" value={teacher?.experienceYears ? `${teacher.experienceYears} years` : 'Not added'} />
            <InfoRow icon={CalendarDays} label="Leave Balance" value={teacher?.leaveBalance || 'Not added'} />
          </InfoPanel>
        </section>

        <section className="mt-8 grid gap-8 lg:grid-cols-2">
          <InfoPanel
            title="Documents"
            description="Documents and identity records added by the college while creating your profile."
          >
            {teacher?.documents?.length ? (
              <div className="grid gap-3">
                {teacher.documents.map((document) => (
                  <div
                    key={document.id}
                    className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4"
                  >
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">
                      {document.documentType || 'Document'}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-700">
                      {document.fileName || document.fileUploadPath || 'File not available'}
                    </p>
                    {document.fileData ? (
                      <button
                        type="button"
                        onClick={() => setSelectedDocumentId((current) => (current === document.id ? null : document.id))}
                        className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-emerald-100 px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-emerald-800 transition hover:bg-emerald-200"
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
            description="Reference values generated for login and profile administration."
          >
            <QrCodeCard
              qrImage={qrImage}
              onDownload={qrImage ? () => downloadQrCode(teacher?.qrCodeData, teacherName) : null}
            />
            <InfoRow icon={Shield} label="Status" value={teacher?.status || 'Active'} />
            <InfoRow icon={IdCard} label="Card Expiry Date" value={teacher?.cardExpiryDate || 'Not added'} />
            <InfoRow
              icon={CalendarDays}
              label="Created On"
              value={teacher?.createdAt ? new Date(teacher.createdAt).toLocaleDateString() : 'Not available'}
            />
          </InfoPanel>
        </section>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, icon }) => (
  <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.35)]">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">{label}</p>
        <p className="mt-3 text-lg font-black tracking-tight text-slate-900">{value}</p>
      </div>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
        {React.createElement(icon, { size: 20 })}
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

const InfoRow = ({ icon, label, value }) => (
  <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-700 shadow-sm">
        {React.createElement(icon, { size: 18 })}
      </div>
      <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</span>
    </div>
    <span className="text-right text-sm font-black text-slate-800">{value}</span>
  </div>
);

const QrCodeCard = ({ qrImage, onDownload }) => (
  <div className="rounded-[1.8rem] border border-slate-200 bg-slate-50 px-4 py-5">
    <div className="mb-4 flex items-center justify-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-700 shadow-sm">
        <FileBadge2 size={18} />
      </div>
      <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">QR Code</span>
    </div>

    <div className="flex flex-col items-center gap-4 md:flex-row md:items-start md:justify-center">
      {qrImage ? (
        <img
          src={qrImage}
          alt="Teacher QR code"
          className="h-52 w-52 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm"
        />
      ) : (
        <div className="w-full rounded-3xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm font-semibold text-slate-500 md:w-auto md:min-w-[13rem]">
          QR code not generated
        </div>
      )}

      {onDownload ? (
        <button
          type="button"
          onClick={onDownload}
          className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-700"
        >
          <Download size={16} />
          Download
        </button>
      ) : null}
    </div>
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
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">Document Preview</p>
      <p className="mt-2 text-sm font-semibold text-slate-700">
        {document.fileName || document.fileUploadPath || document.documentType || 'Selected document'}
      </p>
    </div>

    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
      {isImageFile(document) ? (
        <img
          src={document.fileData}
          alt={document.fileName || 'Teacher document'}
          className="mx-auto max-h-[72vh] w-auto max-w-full object-contain"
        />
      ) : (
        <iframe
          title={document.fileName || 'Teacher document'}
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

export default TeacherProfile;
