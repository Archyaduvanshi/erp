import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Briefcase,
  CalendarCheck2,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  FileText,
  IdCard,
  LayoutGrid,
  List,
  Mail,
  MapPin,
  Phone,
  Plus,
  QrCode,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { teacherApi, uploadApi } from '../../utils/api';
import { formatSalary } from '../../utils/salaryUtils';

const getToday = () => new Date().toISOString().slice(0, 10);

const createInitialFormData = () => ({
  firstName: '',
  lastName: '',
  personalEmail: '',
  mobileNumber: '',
  employeeId: '',
  address: '',
  specialization: '',
  dob: '',
  experienceYears: '',
  contractType: 'Full Time',
  leaveBalance: '',
  salary: '',
  joiningDate: getToday(),
  teacherPortalPassword: '',
  documentType: '',
  otherDocumentName: '',
  fileUploadPath: '',
  documents: [],
  qrCodeData: '',
  cardExpiryDate: '',
  photoUrl: '',
});

const TeacherManagement = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('list');
  const [currentStep, setCurrentStep] = useState(1);
  const [teachers, setTeachers] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [contractFilter, setContractFilter] = useState('All Contracts');
  const [formData, setFormData] = useState(() => createInitialFormData());
  const [session] = useState(() => JSON.parse(localStorage.getItem('active_session')) || null);
  const [generatedTeacher, setGeneratedTeacher] = useState(null);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [detailFormData, setDetailFormData] = useState(() => createInitialFormData());
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingTeacher, setIsUpdatingTeacher] = useState(false);
  const [formError, setFormError] = useState('');
  const [pendingDocument, setPendingDocument] = useState(null);
  const [pendingDetailDocument, setPendingDetailDocument] = useState(null);

  useEffect(() => {
    const loadTeachers = async () => {
      try {
        const apiTeachers = await teacherApi.getAll();
        setTeachers(apiTeachers);
        setLoadError('');
      } catch (error) {
        setTeachers([]);
        setLoadError(error.message || 'Unable to load teachers from the server.');
      }
    };

    loadTeachers();
  }, []);

  const draftEmployeeId = formData.employeeId || buildDraftEmployeeId(session?.instituteName, teachers.length + 1);
  const draftTeacherId = `TCH-${draftEmployeeId}`;
  const resolvedPortalPassword = formData.teacherPortalPassword || buildDefaultTeacherPortalPassword(formData);

  const handleDocumentAdd = () => {
    const resolvedDocumentType = formData.documentType === 'Other' ? formData.otherDocumentName.trim() : formData.documentType;
    if (!resolvedDocumentType || !pendingDocument?.fileData) return;

    const nextDocument = {
      id: Date.now(),
      documentType: resolvedDocumentType,
      fileUploadPath: pendingDocument.fileName,
      fileName: pendingDocument.fileName,
      fileType: pendingDocument.fileType,
      fileData: pendingDocument.fileData,
      fileSize: pendingDocument.fileSize,
    };

    setFormData({
      ...formData,
      documents: [...formData.documents, nextDocument],
      documentType: '',
      otherDocumentName: '',
      fileUploadPath: '',
    });
    setPendingDocument(null);
  };

  const handleDocumentRemove = (documentId) => {
    setFormData({
      ...formData,
      documents: formData.documents.filter((document) => document.id !== documentId),
    });
  };

  const handleDocumentBrowse = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const uploadedFile = await uploadApi.uploadFile(file, '/erp/teachers/documents');

      setFormData({
        ...formData,
        fileUploadPath: uploadedFile.filePath || file.name,
      });
      setPendingDocument({
        fileName: uploadedFile.name || file.name,
        fileType: file.type || uploadedFile.fileType || 'application/octet-stream',
        fileData: uploadedFile.url,
        fileSize: uploadedFile.size || file.size,
      });
      setFormError('');
    } catch (error) {
      setFormError(error.message || 'Unable to upload document to ImageKit.');
    }
  };

  const handlePhotoBrowse = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const uploadedFile = await uploadApi.uploadFile(file, '/erp/teachers/photos');
      setFormError('');
      setFormData((current) => ({
        ...current,
        photoUrl: uploadedFile.url,
      }));
    } catch (error) {
      setFormError(error.message || 'Unable to upload photo to ImageKit.');
    }
  };

  const handleSave = (e) => {
    e?.preventDefault?.();
    const stepOneValidation = validateTeacherProfileStep(formData);
    const stepTwoValidation = validateTeacherWorkStep(formData);

    if (!stepOneValidation.isValid) {
      setFormError(stepOneValidation.message);
      return;
    }

    if (!stepTwoValidation.isValid) {
      setFormError(stepTwoValidation.message);
      return;
    }

    if (formData.documents.length === 0) {
      setFormError('Add at least one document before saving the teacher record.');
      return;
    }

    if (!formData.photoUrl) {
      setFormError('Teacher photo upload is required before confirmation.');
      return;
    }

    setFormError('');
    setIsConfirmModalOpen(true);
  };

  const handleConfirmSave = async () => {
    setIsSaving(true);

    const resolvedEmployeeId = formData.employeeId || buildDraftEmployeeId(session?.instituteName, teachers.length + 1);
    const resolvedTeacherId = `TCH-${resolvedEmployeeId}`;
    const resolvedPortalPassword = formData.teacherPortalPassword.trim() || buildDefaultTeacherPortalPassword(formData);
    const qrPayload = buildTeacherQrPayload({
      ...formData,
      employeeId: resolvedEmployeeId,
      teacherSystemId: resolvedTeacherId,
      teacherPortalPassword: resolvedPortalPassword,
      joiningDate: formData.joiningDate || getToday(),
    });
    const resolvedQrCodeData = JSON.stringify(qrPayload);

    const newTeacher = {
      ...formData,
      employeeId: resolvedEmployeeId,
      salary: formData.salary ? String(formData.salary) : '',
      joiningDate: formData.joiningDate || getToday(),
      paymentHistory: [],
      teacherPortalPassword: resolvedPortalPassword,
      teacherSystemId: resolvedTeacherId,
      qrCodeData: resolvedQrCodeData,
      status: 'Active',
      attendanceStatus: 'Present',
    };

    try {
      const createdTeacher = await teacherApi.create(newTeacher);
      const savedTeacher = await teacherApi.getById(createdTeacher.id);
      const updatedTeachers = [savedTeacher, ...teachers];
      setTeachers(updatedTeachers);
      setGeneratedTeacher(savedTeacher);
      setFormData(createInitialFormData());
      setCurrentStep(1);
      setIsConfirmModalOpen(false);
      setLoadError('');
      setFormError('');
    } catch (error) {
      setLoadError(error.message || 'Unable to save the teacher record.');
    }
    finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (teacherId) => {
    const shouldDelete = window.confirm('Delete this teacher record?');
    if (!shouldDelete) return;

    try {
      await teacherApi.delete(teacherId);
      const updated = teachers.filter((teacher) => teacher.id !== teacherId);
      setTeachers(updated);
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Unable to delete the teacher record.');
    }
  };

  const handleOpenTeacher = async (teacherId) => {
    try {
      const teacher = await teacherApi.getById(teacherId);
      setSelectedTeacher(teacher);
      setDetailFormData(mapTeacherToFormData(teacher));
      setPendingDetailDocument(null);
      setGeneratedTeacher(null);
      setActiveTab('detail');
      setLoadError('');
      setFormError('');
    } catch (error) {
      setLoadError(error.message || 'Unable to open the teacher profile.');
    }
  };

  const handleDetailDocumentAdd = () => {
    const resolvedDocumentType = detailFormData.documentType === 'Other'
      ? detailFormData.otherDocumentName.trim()
      : detailFormData.documentType;
    if (!resolvedDocumentType || !pendingDetailDocument?.fileData) return;

    setDetailFormData((current) => ({
      ...current,
      documents: [
        ...current.documents,
        {
          id: Date.now(),
          documentType: resolvedDocumentType,
          fileUploadPath: pendingDetailDocument.fileName,
          fileName: pendingDetailDocument.fileName,
          fileType: pendingDetailDocument.fileType,
          fileData: pendingDetailDocument.fileData,
          fileSize: pendingDetailDocument.fileSize,
        },
      ],
      documentType: '',
      otherDocumentName: '',
      fileUploadPath: '',
    }));
    setPendingDetailDocument(null);
  };

  const handleDetailDocumentRemove = (documentId) => {
    setDetailFormData((current) => ({
      ...current,
      documents: current.documents.filter((document) => document.id !== documentId),
    }));
  };

  const handleDetailDocumentBrowse = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const uploadedFile = await uploadApi.uploadFile(file, '/erp/teachers/documents');

      setDetailFormData((current) => ({
        ...current,
        fileUploadPath: uploadedFile.filePath || file.name,
      }));
      setPendingDetailDocument({
        fileName: uploadedFile.name || file.name,
        fileType: file.type || uploadedFile.fileType || 'application/octet-stream',
        fileData: uploadedFile.url,
        fileSize: uploadedFile.size || file.size,
      });
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Unable to upload document to ImageKit.');
    }
  };

  const handleDetailPhotoBrowse = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const uploadedFile = await uploadApi.uploadFile(file, '/erp/teachers/photos');
      setDetailFormData((current) => ({
        ...current,
        photoUrl: uploadedFile.url || current.photoUrl,
      }));
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Unable to upload photo to ImageKit.');
    }
  };

  const handleUpdateTeacher = async () => {
    if (!selectedTeacher) return;
    if (!detailFormData.photoUrl) {
      setLoadError('Teacher photo is required to update the profile.');
      return;
    }

    setIsUpdatingTeacher(true);
    const resolvedPortalPassword = detailFormData.teacherPortalPassword.trim() || buildDefaultTeacherPortalPassword(detailFormData);
    const qrPayload = buildTeacherQrPayload({
      ...detailFormData,
      teacherSystemId: selectedTeacher.teacherSystemId,
      employeeId: selectedTeacher.employeeId,
      teacherPortalPassword: resolvedPortalPassword,
      joiningDate: detailFormData.joiningDate || getToday(),
    });

    const payload = {
      ...detailFormData,
      employeeId: selectedTeacher.employeeId,
      salary: detailFormData.salary ? String(detailFormData.salary) : '',
      joiningDate: detailFormData.joiningDate || getToday(),
      paymentHistory: selectedTeacher.paymentHistory || [],
      teacherPortalPassword: resolvedPortalPassword,
      teacherSystemId: selectedTeacher.teacherSystemId,
      qrCodeData: JSON.stringify(qrPayload),
      status: selectedTeacher.status || 'Active',
      attendanceStatus: selectedTeacher.attendanceStatus || 'Present',
      cardExpiryDate: detailFormData.cardExpiryDate,
    };

    try {
      const updatedTeacher = await teacherApi.update(selectedTeacher.id, payload);
      const refreshedTeacher = await teacherApi.getById(updatedTeacher.id);
      const updatedTeachers = teachers.map((teacher) => (teacher.id === refreshedTeacher.id ? refreshedTeacher : teacher));
      setTeachers(updatedTeachers);
      setSelectedTeacher(refreshedTeacher);
      setDetailFormData(mapTeacherToFormData(refreshedTeacher));
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Unable to update the teacher record.');
    } finally {
      setIsUpdatingTeacher(false);
    }
  };

  const availableContracts = ['All Contracts', ...new Set(teachers.map((teacher) => teacher.contractType).filter(Boolean))];
  const filteredTeachers = teachers.filter((teacher) => {
    const fullName = `${teacher.firstName} ${teacher.lastName}`.toLowerCase();
    const searchValue = searchTerm.toLowerCase();
    const matchesSearch =
      !searchValue ||
      fullName.includes(searchValue) ||
      String(teacher.personalEmail || '').toLowerCase().includes(searchValue) ||
      String(teacher.employeeId || '').toLowerCase().includes(searchValue) ||
      String(teacher.address || '').toLowerCase().includes(searchValue) ||
      String(teacher.specialization || '').toLowerCase().includes(searchValue) ||
      String(teacher.teacherSystemId || '').toLowerCase().includes(searchValue);
    const matchesContract = contractFilter === 'All Contracts' || teacher.contractType === contractFilter;
    return matchesSearch && matchesContract;
  });

  const activeTeachers = teachers.filter((teacher) => teacher.status === 'Active').length;
  const fullTimeTeachers = teachers.filter((teacher) => teacher.contractType === 'Full Time').length;
  const uploadedDocs = teachers.reduce((count, teacher) => count + (teacher.documents || []).length, 0);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f6f8fc_0%,#eef8f5_55%,#fbfcfe_100%)] text-slate-900 selection:bg-emerald-400 selection:text-slate-950">
      <div className="border-b border-slate-200/70 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/college')}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 transition hover:border-emerald-300 hover:text-emerald-700"
            >
              <ArrowLeft size={14} />
              Back
            </button>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-emerald-600">Teacher Management</p>
              <h1 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">Faculty Operations Hub</h1>
            </div>
          </div>

          <button
            onClick={() => {
              setActiveTab(activeTab === 'list' ? 'add' : 'list');
              setCurrentStep(1);
              setFormError('');
              setGeneratedTeacher(null);
              setSelectedTeacher(null);
              setDetailFormData(createInitialFormData());
              setPendingDocument(null);
              setPendingDetailDocument(null);
              if (activeTab !== 'list') {
                setFormData(createInitialFormData());
              }
            }}
            className={`inline-flex items-center gap-2 rounded-full px-5 py-3 text-[11px] font-black uppercase tracking-[0.22em] transition ${
              activeTab === 'list'
                ? 'bg-slate-950 text-white shadow-lg shadow-slate-300 hover:bg-emerald-600'
                : 'border border-slate-200 bg-white text-slate-600 hover:border-rose-200 hover:text-rose-600'
            }`}
          >
            {activeTab === 'list' ? <Plus size={14} /> : <X size={14} />}
            {activeTab === 'list' ? 'Add Teacher' : 'Close Form'}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10 lg:py-10">
        {loadError ? (
          <div className="mb-6 rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
            {loadError}
          </div>
        ) : null}

        {activeTab === 'list' ? (
          <DirectoryView
            teachers={teachers}
            filteredTeachers={filteredTeachers}
            activeTeachers={activeTeachers}
            fullTimeTeachers={fullTimeTeachers}
            uploadedDocs={uploadedDocs}
            viewMode={viewMode}
            setViewMode={setViewMode}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            contractFilter={contractFilter}
            setContractFilter={setContractFilter}
            availableContracts={availableContracts}
            onCreate={() => {
              setGeneratedTeacher(null);
              setSelectedTeacher(null);
              setActiveTab('add');
            }}
            onOpenSalaryDesk={() => navigate('/college/salary')}
            onDelete={handleDelete}
            onOpenTeacher={handleOpenTeacher}
          />
        ) : activeTab === 'detail' && selectedTeacher ? (
          <TeacherDetailView
            teacher={selectedTeacher}
            formData={detailFormData}
            setFormData={setDetailFormData}
            onBack={() => {
              setSelectedTeacher(null);
              setDetailFormData(createInitialFormData());
              setActiveTab('list');
            }}
            onSave={handleUpdateTeacher}
            isSaving={isUpdatingTeacher}
            onDocumentAdd={handleDetailDocumentAdd}
            onDocumentRemove={handleDetailDocumentRemove}
            onDocumentBrowse={handleDetailDocumentBrowse}
            onPhotoBrowse={handleDetailPhotoBrowse}
          />
        ) : generatedTeacher ? (
          <GeneratedTeacherView
            teacher={generatedTeacher}
            onClose={() => {
              setGeneratedTeacher(null);
              setActiveTab('list');
            }}
          />
        ) : (
          <TeacherWizard
            currentStep={currentStep}
            setCurrentStep={setCurrentStep}
            formData={formData}
            setFormData={setFormData}
            handleSave={handleSave}
            formError={formError}
            setFormError={setFormError}
            draftEmployeeId={draftEmployeeId}
            draftTeacherId={draftTeacherId}
            resolvedPortalPassword={resolvedPortalPassword}
            handleDocumentAdd={handleDocumentAdd}
            handleDocumentRemove={handleDocumentRemove}
            handleDocumentBrowse={handleDocumentBrowse}
            handlePhotoBrowse={handlePhotoBrowse}
          />
        )}
      </div>

      <ConfirmationModal
        open={isConfirmModalOpen}
        teacherName={`${formData.firstName || 'New'} ${formData.lastName || 'Teacher'}`.trim()}
        specialization={formData.specialization || 'Faculty profile'}
        onCancel={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmSave}
        isSaving={isSaving}
      />
    </div>
  );
};

const DirectoryView = ({
  teachers,
  filteredTeachers,
  activeTeachers,
  fullTimeTeachers,
  uploadedDocs,
  viewMode,
  setViewMode,
  searchTerm,
  setSearchTerm,
  contractFilter,
  setContractFilter,
  availableContracts,
  onCreate,
  onOpenSalaryDesk,
  onDelete,
  onOpenTeacher,
}) => (
  <div className="space-y-8">
    <section className="overflow-hidden rounded-4xl border border-slate-200/80 bg-slate-950 text-white shadow-[0_30px_80px_-40px_rgba(15,23,42,0.9)]">
      <div className="grid gap-8 px-7 py-8 lg:grid-cols-[1.5fr_0.9fr] lg:px-10 lg:py-10">
        <div className="relative">
          <div className="absolute -left-16 -top-16 h-40 w-40 rounded-full bg-emerald-400/15 blur-3xl" />
          <div className="absolute bottom-0 right-10 h-32 w-32 rounded-full bg-teal-500/10 blur-3xl" />
          <div className="relative">
            <p className="mb-3 text-[11px] font-black uppercase tracking-[0.32em] text-emerald-300">HR Control Center</p>
            <h2 className="max-w-2xl font-serif text-4xl font-black italic leading-none tracking-tight">
              Faculty records, document readiness, and ID generation from one focused workspace.
            </h2>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300">
              Keep teacher profiles current, monitor attendance posture, verify documents, and issue auto-ready ID cards with QR data.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={onCreate}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-5 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-slate-950 transition hover:bg-emerald-300"
              >
                <UserPlus size={14} />
                Add Faculty Record
              </button>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-slate-300">
                <ShieldCheck size={14} />
                {uploadedDocs} documents uploaded
              </div>
              <button
                onClick={onOpenSalaryDesk}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-slate-300 transition hover:border-emerald-300 hover:text-emerald-200"
              >
                <Banknote size={14} />
                Open Salary Desk
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          <StatCard label="Total Faculty" value={teachers.length} tone="emerald" icon={Users} />
          <StatCard label="Active Teachers" value={activeTeachers} tone="cyan" icon={CalendarCheck2} />
          <StatCard label="Full Time" value={fullTimeTeachers} tone="amber" icon={Briefcase} />
        </div>
      </div>
    </section>

    <section className="rounded-4xl border border-slate-200/80 bg-white p-5 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">Faculty Directory</h3>
          <p className="mt-1 text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
            {filteredTeachers.length} of {teachers.length} records visible
          </p>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative min-w-65">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search name, email, employee ID..."
              className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-12 py-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
            />
          </div>

          <select
            value={contractFilter}
            onChange={(e) => setContractFilter(e.target.value)}
            className="rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
          >
            {availableContracts.map((contract) => (
              <option key={contract} value={contract}>
                {contract}
              </option>
            ))}
          </select>

          <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`rounded-xl p-2.5 transition ${viewMode === 'grid' ? 'bg-slate-950 text-white' : 'text-slate-400 hover:bg-white'}`}
            >
              <LayoutGrid size={18} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`rounded-xl p-2.5 transition ${viewMode === 'table' ? 'bg-slate-950 text-white' : 'text-slate-400 hover:bg-white'}`}
            >
              <List size={18} />
            </button>
          </div>
        </div>
      </div>

      {filteredTeachers.length > 0 ? (
        viewMode === 'grid' ? (
          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredTeachers.map((teacher) => (
              <TeacherCard key={teacher.id} teacher={teacher} onDelete={onDelete} onOpen={onOpenTeacher} />
            ))}
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-[1.75rem] border border-slate-200">
            <table className="w-full text-left">
              <thead className="bg-slate-950 text-white">
                <tr className="text-[11px] font-black uppercase tracking-[0.24em]">
                  <th className="px-6 py-4">Teacher</th>
                  <th className="px-6 py-4">Employee ID</th>
                  <th className="px-6 py-4">Specialization</th>
                  <th className="px-6 py-4">Salary</th>
                  <th className="px-6 py-4">Contract</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredTeachers.map((teacher) => (
                  <tr key={teacher.id} onClick={() => onOpenTeacher(teacher.id)} className="cursor-pointer transition hover:bg-emerald-50/60">
                    <td className="px-6 py-5">
                      <p className="text-sm font-black text-slate-950">{teacher.firstName} {teacher.lastName}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{teacher.personalEmail || teacher.mobileNumber || 'Not provided'}</p>
                    </td>
                    <td className="px-6 py-5 text-sm font-semibold text-slate-700">{teacher.employeeId || 'Pending'}</td>
                    <td className="px-6 py-5 text-sm font-semibold text-slate-700">{teacher.specialization || 'Not assigned'}</td>
                    <td className="px-6 py-5 text-sm font-semibold text-slate-700">{formatSalary(teacher.salary)}</td>
                    <td className="px-6 py-5">
                      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                        {teacher.contractType || 'Full Time'}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(teacher.id);
                        }}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="mt-6 rounded-4xl border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-white text-slate-300 shadow-sm">
            <Users size={34} />
          </div>
          <h4 className="mt-6 font-serif text-3xl font-black italic tracking-tight text-slate-950">No faculty records yet</h4>
          <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-500">
            Create the first teacher profile to start attendance, document verification, and automatic ID card generation.
          </p>
          <button
            onClick={onCreate}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-white transition hover:bg-emerald-600"
          >
            <Plus size={14} />
            Create Teacher
          </button>
        </div>
      )}
    </section>
  </div>
);

const TeacherWizard = ({
  currentStep,
  setCurrentStep,
  formData,
  setFormData,
  handleSave,
  formError,
  setFormError,
  draftEmployeeId,
  draftTeacherId,
  resolvedPortalPassword,
  handleDocumentAdd,
  handleDocumentRemove,
  handleDocumentBrowse,
  handlePhotoBrowse,
}) => {
  const stepOneValidation = validateTeacherProfileStep(formData);
  const stepTwoValidation = validateTeacherWorkStep(formData);

  const moveToStepTwo = () => {
    if (!stepOneValidation.isValid) {
      setFormError(stepOneValidation.message);
      return;
    }
    setFormError('');
    setCurrentStep(2);
  };

  const moveToStepThree = () => {
    if (!stepTwoValidation.isValid) {
      setFormError(stepTwoValidation.message);
      return;
    }
    setFormError('');
    setCurrentStep(3);
  };

  const moveToStepFour = () => {
    if (formData.documents.length === 0) {
      setFormError('Add at least one document before going to the ID generation step.');
      return;
    }
    setFormError('');
    setCurrentStep(4);
  };

  return (
  <div className="grid items-start gap-8 xl:grid-cols-[0.78fr_1.22fr]">
    <aside className="space-y-6 xl:sticky xl:top-8">
      <section className="rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)]">
        <p className="text-[11px] font-black uppercase tracking-[0.3em] text-emerald-600">Teacher Module</p>
        <div className="mt-6 space-y-5">
          <TimelineStep step={1} current={currentStep} title="Profiles" desc="Professional identity and records" />
          <TimelineStep step={2} current={currentStep} title="Attendance" desc="Contract and leave posture" />
          <TimelineStep step={3} current={currentStep} title="Documents" desc="Verification and file locker" />
          <TimelineStep step={4} current={currentStep} title="ID Generation" desc="Auto ID card and QR" />
        </div>
      </section>

      <section className="overflow-hidden rounded-4xl bg-[linear-gradient(145deg,#064e3b_0%,#0f172a_58%,#020617_100%)] p-6 text-white shadow-[0_30px_80px_-40px_rgba(6,78,59,0.8)]">
        <p className="text-[11px] font-black uppercase tracking-[0.28em] text-emerald-300">Faculty Snapshot</p>
        <div className="mt-6 rounded-[1.6rem] border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
          <div className="flex items-start justify-between">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-lg font-black uppercase text-emerald-100">
              {(formData.firstName?.[0] || 'T') + (formData.lastName?.[0] || 'R')}
            </div>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200">
              {formData.contractType || 'Full Time'}
            </span>
          </div>
          <h3 className="mt-8 font-serif text-3xl font-black italic tracking-tight">
            {formData.firstName || 'New'} {formData.lastName || 'Teacher'}
          </h3>
          <p className="mt-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-300">
            {formData.specialization || 'Specialization pending'}
          </p>
          <div className="mt-8 space-y-3 text-sm text-slate-300">
            <PreviewRow icon={Briefcase} value={draftEmployeeId} />
            <PreviewRow icon={MapPin} value={formData.address || 'Address not added'} />
            <PreviewRow icon={CalendarCheck2} value={`Leave Balance: ${formData.leaveBalance || '0'} days`} />
            <PreviewRow icon={Banknote} value={`Salary: ${formatSalary(formData.salary)}`} />
            <PreviewRow icon={FileText} value={`${formData.documents.length} document(s) added`} />
            <PreviewRow icon={QrCode} value="QR appears after final confirmation" />
          </div>
        </div>
      </section>
    </aside>

    <section className="rounded-[2.25rem] border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
      {formError ? (
        <div className="mb-6 rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
          {formError}
        </div>
      ) : null}
      {currentStep === 1 && (
        <div>
          <FormHeader
            eyebrow="Step 01"
            title="Teacher profiles"
            desc="Create a faculty record with identity and professional information used by the HR module."
          />
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <CreativeInput label="First Name" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} placeholder="Teacher first name" />
            <CreativeInput label="Last Name" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} placeholder="Teacher last name" />
            <CreativeInput label="Personal Email" type="email" value={formData.personalEmail} onChange={(e) => setFormData({ ...formData, personalEmail: e.target.value })} placeholder="teacher@email.com" />
            <CreativeInput label="Mobile Number" value={formData.mobileNumber} onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })} placeholder="+91 98XXX XXXXX" />
            <CreativeInput label="Date Of Birth" type="date" value={formData.dob} onChange={(e) => setFormData({ ...formData, dob: e.target.value })} />
            <CreativeInput label="Employee ID" value={draftEmployeeId} readOnly placeholder="Auto-generated employee ID" />
            <CreativeTextarea
              label="Address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Enter full residential address"
              className="md:col-span-2"
            />
            <CreativeTextarea
              label="Specialization Subjects"
              value={formData.specialization}
              onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
              placeholder="Mathematics, Physics, English"
              hint="Add multiple subjects separated by commas."
              className="md:col-span-2"
            />
          </div>
          <WizardButtons label="Continue to Attendance" onNext={moveToStepTwo} />
        </div>
      )}

      {currentStep === 2 && (
        <div>
          <FormHeader
            eyebrow="Step 02"
            title="Teacher work and salary posture"
            desc="Store the working profile that helps the institution manage contracts, tenure, leave, and monthly salary from the date the teacher starts teaching."
          />
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <CreativeInput label="Experience Years" type="number" value={formData.experienceYears} onChange={(e) => setFormData({ ...formData, experienceYears: e.target.value })} placeholder="6" />
            <CreativeSelect
              label="Contract Type"
              value={formData.contractType}
              onChange={(e) => setFormData({ ...formData, contractType: e.target.value })}
              options={['Full Time', 'Part Time', 'Visiting', 'Contractual']}
            />
            <CreativeInput label="Leave Balance" type="number" value={formData.leaveBalance} onChange={(e) => setFormData({ ...formData, leaveBalance: e.target.value })} placeholder="12" />
            <CreativeInput label="Monthly Salary" type="number" min="0" value={formData.salary} onChange={(e) => setFormData({ ...formData, salary: e.target.value })} placeholder="35000" />
            <CreativeInput label="Teaching Start Date" type="date" value={formData.joiningDate} onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })} />
            <CreativeInput label="Teacher Portal Password" type="text" value={formData.teacherPortalPassword || resolvedPortalPassword} onChange={(e) => setFormData({ ...formData, teacherPortalPassword: e.target.value })} placeholder="Auto-generated teacher portal password" />
          </div>
          <WizardButtons label="Continue to Documents" onNext={moveToStepThree} onBack={() => {
            setFormError('');
            setCurrentStep(1);
          }} />
        </div>
      )}

      {currentStep === 3 && (
        <div>
          <FormHeader
            eyebrow="Step 03"
            title="Teacher documents"
            desc="Add documents one by one, submit each into the faculty locker, and continue after the required files are listed below."
          />
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <CreativeSelect
              label="Document Type"
              value={formData.documentType}
              onChange={(e) => setFormData({ ...formData, documentType: e.target.value })}
              options={['Select', 'Aadhar', 'Resume', 'Experience Certificate', 'Qualification Certificate', 'Other']}
            />
            {formData.documentType === 'Other' && (
              <CreativeInput
                label="Document Name"
                value={formData.otherDocumentName}
                onChange={(e) => setFormData({ ...formData, otherDocumentName: e.target.value })}
                placeholder="Enter document name"
              />
            )}
            <DocumentUploadField
              label="File Upload"
              value={formData.fileUploadPath}
              onBrowse={handleDocumentBrowse}
            />
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleDocumentAdd}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.18em] text-white transition hover:bg-emerald-600"
            >
              <Plus size={14} />
              Submit Document
            </button>
          </div>

          <div className="mt-8 rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Submitted Documents</p>
                <p className="mt-2 text-sm font-semibold text-slate-700">{formData.documents.length} document(s) added</p>
              </div>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                Multi-document ready
              </span>
            </div>

            {formData.documents.length > 0 ? (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {formData.documents.map((document) => (
                  <div key={document.id} className="rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-slate-950">{document.documentType}</p>
                        <p className="mt-1 break-all text-xs font-semibold text-slate-500">{document.fileUploadPath}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDocumentRemove(document.id)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <div className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-500">
                      Ready for teacher record
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-[1.4rem] border border-dashed border-slate-300 bg-white px-5 py-8 text-center text-sm font-medium text-slate-500">
                No documents submitted yet. Add each required file, then continue to ID generation.
              </div>
            )}
          </div>

          <WizardButtons
            label="Continue to ID Generation"
            onNext={moveToStepFour}
            onBack={() => {
              setFormError('');
              setCurrentStep(2);
            }}
            isDisabled={formData.documents.length === 0}
          />
        </div>
      )}

      {currentStep === 4 && (
        <div>
          <FormHeader
            eyebrow="Step 04"
            title="Automatic ID generation"
            desc="Upload the teacher photo, review the full form, and confirm to generate the QR code with all teacher details."
          />
          <div className="mt-8 grid gap-5">
            <DocumentUploadField label="Teacher Photo Upload" value={formData.photoUrl ? 'Photo selected' : ''} onBrowse={handlePhotoBrowse} />
          </div>

          <div className="mt-8 rounded-4xl border border-slate-200 bg-[linear-gradient(135deg,#ecfdf5_0%,#f8fafc_100%)] p-6 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-700">Final Teacher Review</p>
            <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[1.6rem] bg-slate-950 p-6 text-white">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-300">Faculty ID Card</p>
                    <h3 className="mt-3 font-serif text-3xl font-black italic">
                      {formData.firstName || 'New'} {formData.lastName || 'Teacher'}
                    </h3>
                    <p className="mt-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-300">
                      {formData.specialization || 'Specialization pending'}
                    </p>
                  </div>
                  {formData.photoUrl ? (
                    <img src={formData.photoUrl} alt="Teacher" className="h-16 w-16 rounded-2xl border border-white/10 object-cover" />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-lg font-black uppercase text-emerald-100">
                      {(formData.firstName?.[0] || 'T') + (formData.lastName?.[0] || 'R')}
                    </div>
                  )}
                </div>
                <div className="mt-8 grid gap-3 text-sm text-slate-300">
                  <PreviewRow icon={IdCard} value={draftTeacherId} />
                  <PreviewRow icon={Mail} value={formData.personalEmail || 'Email not added'} />
                  <PreviewRow icon={Phone} value={formData.mobileNumber || 'Mobile not added'} />
                  <PreviewRow icon={CalendarCheck2} value={formData.joiningDate || 'Joining date pending'} />
                </div>
              </div>

              <div className="rounded-[1.6rem] border border-slate-200 bg-white p-6 text-center">
                <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-3xl bg-slate-950 text-emerald-300">
                  <QrCode size={58} />
                </div>
                <p className="mt-5 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">QR Generates After Confirmation</p>
                <p className="mt-3 text-sm font-semibold text-slate-800">Teacher data will be encoded and saved on submit.</p>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <ReviewCard title="Teacher Profile">
              <ReviewLine label="Name" value={`${formData.firstName || '-'} ${formData.lastName || ''}`.trim()} />
              <ReviewLine label="Employee ID" value={draftEmployeeId || '-'} />
              <ReviewLine label="Date Of Birth" value={formData.dob || '-'} />
              <ReviewLine label="Address" value={formData.address || '-'} />
              <ReviewLine label="Specialization" value={formData.specialization || '-'} />
              <ReviewLine label="Experience" value={formData.experienceYears ? `${formData.experienceYears} years` : '-'} />
            </ReviewCard>

            <ReviewCard title="Attendance & Identity">
              <ReviewLine label="Contract" value={formData.contractType || '-'} />
              <ReviewLine label="Leave Balance" value={formData.leaveBalance ? `${formData.leaveBalance} days` : '-'} />
              <ReviewLine label="Monthly Salary" value={formatSalary(formData.salary)} />
              <ReviewLine label="Teaching Start" value={formData.joiningDate || '-'} />
              <ReviewLine label="Teacher ID" value={draftTeacherId} />
              <ReviewLine label="Portal Password" value={resolvedPortalPassword || '-'} />
            </ReviewCard>

            <ReviewCard title="Documents & ID">
              <ReviewLine label="Total Documents" value={String(formData.documents.length)} />
              <ReviewLine label="Latest Document" value={formData.documents[formData.documents.length - 1]?.documentType || '-'} />
              <ReviewLine label="Latest File" value={formData.documents[formData.documents.length - 1]?.fileUploadPath || '-'} />
              <ReviewLine label="Photo" value={formData.photoUrl ? 'Uploaded' : 'Not uploaded'} />
            </ReviewCard>
          </div>

          <WizardButtons label="Save Teacher Record" onNext={handleSave} onBack={() => {
            setFormError('');
            setCurrentStep(3);
          }} isFinal isDisabled={!formData.photoUrl} />
        </div>
      )}
    </section>
  </div>
  );
};

const StatCard = ({ label, value, tone, icon }) => {
  const toneClasses = {
    emerald: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100',
    cyan: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100',
    amber: 'border-amber-400/20 bg-amber-400/10 text-amber-100',
  };

  return (
    <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-300">{label}</p>
          <p className="mt-3 text-4xl font-black tracking-tight text-white">{value}</p>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${toneClasses[tone]}`}>
          {React.createElement(icon, { size: 20 })}
        </div>
      </div>
    </div>
  );
};

const TeacherCard = ({ teacher, onDelete, onOpen }) => (
  <article onClick={() => onOpen(teacher.id)} className="group cursor-pointer overflow-hidden rounded-[1.9rem] border border-slate-200/80 bg-white p-6 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.35)] transition hover:-translate-y-1 hover:shadow-[0_24px_50px_-28px_rgba(16,185,129,0.35)]">
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#d1fae5_0%,#ccfbf1_100%)] text-lg font-black uppercase text-slate-900">
          {(teacher.firstName?.[0] || 'T') + (teacher.lastName?.[0] || 'R')}
        </div>
        <div>
          <h4 className="text-lg font-black tracking-tight text-slate-950">{teacher.firstName} {teacher.lastName}</h4>
          <p className="mt-1 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">{teacher.specialization || 'General Faculty'}</p>
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(teacher.id);
        }}
        className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
      >
        <Trash2 size={16} />
      </button>
    </div>

    <div className="mt-6 grid gap-3 text-sm text-slate-600">
      <PreviewRow icon={Mail} value={teacher.personalEmail || 'No email added'} light />
      <PreviewRow icon={Phone} value={teacher.mobileNumber || 'No phone added'} light />
      <PreviewRow icon={Briefcase} value={teacher.employeeId || 'Employee ID pending'} light />
      <PreviewRow icon={MapPin} value={teacher.address || 'Address not added'} light />
      <PreviewRow icon={Banknote} value={`Salary: ${formatSalary(teacher.salary)}`} light />
      <PreviewRow icon={ShieldCheck} value={`Portal password: ${teacher.teacherPortalPassword || 'Not set'}`} light />
    </div>

    <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Teacher ID</p>
        <p className="mt-1 text-sm font-semibold text-slate-700">{teacher.teacherSystemId || 'Auto pending'}</p>
      </div>
      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
        {teacher.contractType || 'Full Time'}
      </span>
    </div>
  </article>
);

const TimelineStep = ({ step, current, title, desc }) => (
  <div className={`flex gap-4 transition ${current >= step ? 'opacity-100' : 'opacity-45'}`}>
    <div
      className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border-2 text-sm font-black transition ${
        current === step
          ? 'border-emerald-500 bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-100'
          : current > step
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-slate-200 bg-slate-50 text-slate-400'
      }`}
    >
      {current > step ? <CheckCircle2 size={18} /> : step}
    </div>
    <div>
      <p className="text-sm font-black text-slate-950">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-500">{desc}</p>
    </div>
  </div>
);

const FormHeader = ({ eyebrow, title, desc }) => (
  <div>
    <p className="text-[11px] font-black uppercase tracking-[0.3em] text-emerald-600">{eyebrow}</p>
    <h2 className="mt-3 font-serif text-4xl font-black italic leading-none tracking-tight text-slate-950">{title}</h2>
    <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-500">{desc}</p>
  </div>
);

const CreativeInput = ({ label, ...props }) => (
  <div className="space-y-2.5">
    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
    <input
      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
      {...props}
    />
  </div>
);

const CreativeTextarea = ({ label, className = '', hint, ...props }) => (
  <div className={`space-y-2.5 ${className}`.trim()}>
    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
    <textarea
      className="min-h-28 w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
      {...props}
    />
    {hint ? <p className="text-xs font-semibold text-slate-500">{hint}</p> : null}
  </div>
);

const CreativeSelect = ({ label, options, ...props }) => (
  <div className="space-y-2.5">
    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
    <select
      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-3.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
      {...props}
    >
      {options.map((option) => (
        <option key={option} value={option === 'Select' ? '' : option}>
          {option}
        </option>
      ))}
    </select>
  </div>
);

const DocumentUploadField = ({ label, value, onBrowse }) => (
  <div className="space-y-2.5 md:col-span-2">
    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
    <label className="flex w-full cursor-pointer items-center justify-between gap-4 rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-white">
      <div className="min-w-0">
        <p className={`truncate ${value ? 'text-slate-900' : 'text-slate-400'}`}>
          {value || 'Click anywhere in this field to browse and select a file'}
        </p>
      </div>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
        <Upload size={18} />
      </div>
      <input type="file" className="hidden" onChange={onBrowse} />
    </label>
  </div>
);

const WizardButtons = ({ label, onNext, onBack, isFinal, isDisabled = false }) => (
  <div className="mt-10 flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row">
    {onBack && (
      <button
        type="button"
        onClick={onBack}
        className="inline-flex flex-1 items-center justify-center rounded-2xl border-2 border-slate-200 bg-white px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
      >
        Back
      </button>
    )}
    <button
      type="button"
      onClick={onNext}
      disabled={isDisabled}
      className={`inline-flex flex-[1.5] items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] transition ${
        isDisabled
          ? 'cursor-not-allowed bg-slate-200 text-slate-400'
          :
        isFinal
          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100 hover:bg-emerald-700'
          : 'bg-slate-950 text-white shadow-lg shadow-slate-300 hover:bg-emerald-600'
      }`}
    >
      {label}
      <ArrowRight size={14} />
    </button>
  </div>
);

const PreviewRow = ({ icon, value, light = false }) => (
  <div className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${light ? 'bg-slate-50 text-slate-600' : 'bg-white/5 text-slate-200'}`}>
    {React.createElement(icon, { size: 15, className: light ? 'text-emerald-700' : 'text-emerald-300' })}
    <span className="truncate text-sm font-medium">{value}</span>
  </div>
);

const ReviewCard = ({ title, children }) => (
  <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">{title}</p>
    <div className="mt-4 space-y-3">{children}</div>
  </div>
);

const ReviewLine = ({ label, value }) => (
  <div className="flex items-start justify-between gap-4 border-b border-slate-200/80 pb-3 last:border-b-0 last:pb-0">
    <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</span>
    <span className="text-sm font-semibold text-slate-800">{value}</span>
  </div>
);

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function buildInstituteCode(instituteName) {
  const cleanedWords = String(instituteName || '')
    .trim()
    .toUpperCase()
    .split(/\s+/)
    .map((word) => word.replace(/[^A-Z0-9]/g, ''))
    .filter(Boolean);

  if (cleanedWords.length >= 2) {
    return cleanedWords.map((word) => word[0]).join('').slice(0, 6);
  }

  const compact = String(instituteName || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return compact.slice(0, 6) || 'INST';
}

function buildDraftEmployeeId(instituteName, sequence) {
  return `${buildInstituteCode(instituteName)}EMP${String(sequence || 1).padStart(4, '0')}`;
}

function buildDefaultTeacherPortalPassword(formData) {
  const mobileDigits = digitsOnly(formData.mobileNumber);
  const firstSixDigits = mobileDigits.length >= 6
    ? mobileDigits.slice(0, 6)
    : mobileDigits.padEnd(6, '0');
  const birthYear = String(formData.dob || '').slice(0, 4) || '0000';
  return `${firstSixDigits}${birthYear}`;
}

function buildTeacherQrPayload(teacher) {
  return {
    profileType: 'teacher',
    teacherId: teacher.teacherSystemId,
    employeeId: teacher.employeeId,
    fullName: `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim(),
    email: teacher.personalEmail,
    mobile: teacher.mobileNumber,
    dob: teacher.dob,
    specialization: teacher.specialization,
    experienceYears: teacher.experienceYears,
    contractType: teacher.contractType,
    joiningDate: teacher.joiningDate,
    address: teacher.address,
  };
}

function mapTeacherToFormData(teacher) {
  return {
    ...createInitialFormData(),
    firstName: teacher.firstName || '',
    lastName: teacher.lastName || '',
    personalEmail: teacher.personalEmail || '',
    mobileNumber: teacher.mobileNumber || '',
    employeeId: teacher.employeeId || '',
    address: teacher.address || '',
    specialization: teacher.specialization || '',
    dob: teacher.dob || '',
    experienceYears: teacher.experienceYears || '',
    contractType: teacher.contractType || 'Full Time',
    leaveBalance: teacher.leaveBalance || '',
    salary: teacher.salary || '',
    joiningDate: teacher.joiningDate || getToday(),
    teacherPortalPassword: teacher.teacherPortalPassword || '',
    documentType: teacher.documentType || '',
    otherDocumentName: teacher.otherDocumentName || '',
    fileUploadPath: '',
    documents: (teacher.documents || []).map((document) => normalizeStoredDocument(document)),
    qrCodeData: teacher.qrCodeData || '',
    cardExpiryDate: teacher.cardExpiryDate || '',
    photoUrl: teacher.photoUrl || '',
  };
}

function normalizeStoredDocument(document) {
  if (!document) {
    return document;
  }

  return {
    ...document,
    fileName: document.fileName || document.fileUploadPath || '',
    fileUploadPath: document.fileUploadPath || document.fileName || '',
    fileType: document.fileType || '',
    fileData: document.fileData || '',
    fileSize: document.fileSize || 0,
  };
}

function createQrImageUrl(value) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=512x512&margin=16&data=${encodeURIComponent(value || 'teacher')}`;
}

async function downloadQrCode(qrCodeData, teacherName) {
  const qrUrl = createQrImageUrl(qrCodeData);
  const response = await fetch(qrUrl);
  if (!response.ok) {
    throw new Error('Unable to download QR code.');
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `${(teacherName || 'teacher').replace(/\s+/g, '-').toLowerCase()}-qr.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}

function TeacherDetailView({
  teacher,
  formData,
  setFormData,
  onBack,
  onSave,
  isSaving,
  onDocumentAdd,
  onDocumentRemove,
  onDocumentBrowse,
  onPhotoBrowse,
}) {
  const qrImage = createQrImageUrl(teacher.qrCodeData);
  const fullName = `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim() || 'Teacher';
  const [showPortalPassword, setShowPortalPassword] = useState(false);

  return (
    <div className="space-y-8">
      <section className="rounded-[2.25rem] border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-emerald-600">Teacher Profile</p>
            <h2 className="mt-3 font-serif text-4xl font-black italic tracking-tight text-slate-950">{fullName}</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-500">
              View every saved detail, update the teacher record, and download the QR code that is already linked to this profile.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center justify-center rounded-2xl border-2 border-slate-200 bg-white px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Back To Directory
            </button>
            <button
              type="button"
              onClick={async () => {
                await downloadQrCode(teacher.qrCodeData, fullName);
              }}
              className="inline-flex items-center gap-2 rounded-2xl border-2 border-emerald-200 bg-emerald-50 px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100"
            >
              <Download size={14} />
              Download QR
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving}
              className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] transition ${
                isSaving ? 'cursor-not-allowed bg-emerald-300 text-white' : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              <Save size={14} />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <ReviewCard title="Identity">
              <ReviewLine label="Teacher ID" value={teacher.teacherSystemId || '-'} />
              <ReviewLine label="Employee ID" value={teacher.employeeId || '-'} />
              <ReviewLine label="Status" value={teacher.status || 'Active'} />
              <ReviewLine label="Attendance" value={teacher.attendanceStatus || 'Present'} />
            </ReviewCard>

            <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Editable Details</p>
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <CreativeInput label="First Name" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} />
                <CreativeInput label="Last Name" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} />
                <CreativeInput label="Personal Email" type="email" value={formData.personalEmail} onChange={(e) => setFormData({ ...formData, personalEmail: e.target.value })} />
                <CreativeInput label="Mobile Number" value={formData.mobileNumber} onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })} />
                <CreativeInput label="Date Of Birth" type="date" value={formData.dob} onChange={(e) => setFormData({ ...formData, dob: e.target.value })} />
                <CreativeInput label="Experience Years" type="number" value={formData.experienceYears} onChange={(e) => setFormData({ ...formData, experienceYears: e.target.value })} />
                <CreativeSelect label="Contract Type" value={formData.contractType} onChange={(e) => setFormData({ ...formData, contractType: e.target.value })} options={['Full Time', 'Part Time', 'Visiting', 'Contractual']} />
                <CreativeInput label="Leave Balance" type="number" value={formData.leaveBalance} onChange={(e) => setFormData({ ...formData, leaveBalance: e.target.value })} />
                <CreativeInput label="Monthly Salary" type="number" min="0" value={formData.salary} onChange={(e) => setFormData({ ...formData, salary: e.target.value })} />
                <CreativeInput label="Teaching Start Date" type="date" value={formData.joiningDate} onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })} />
                <div className="space-y-2.5 md:col-span-2">
                  <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">Portal Password</label>
                  <div className="relative">
                    <input
                      type={showPortalPassword ? 'text' : 'password'}
                      value={formData.teacherPortalPassword}
                      onChange={(e) => setFormData({ ...formData, teacherPortalPassword: e.target.value })}
                      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-3.5 pr-14 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPortalPassword((current) => !current)}
                      className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
                    >
                      {showPortalPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <CreativeTextarea label="Address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <CreativeTextarea label="Specialization Subjects" value={formData.specialization} onChange={(e) => setFormData({ ...formData, specialization: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Documents And Photo</p>
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <CreativeSelect label="Document Type" value={formData.documentType} onChange={(e) => setFormData({ ...formData, documentType: e.target.value })} options={['Select', 'Aadhar', 'Resume', 'Experience Certificate', 'Qualification Certificate', 'Other']} />
                {formData.documentType === 'Other' ? (
                  <CreativeInput label="Document Name" value={formData.otherDocumentName} onChange={(e) => setFormData({ ...formData, otherDocumentName: e.target.value })} />
                ) : <div />}
                <DocumentUploadField label="Attach Document" value={formData.fileUploadPath} onBrowse={onDocumentBrowse} />
              </div>
              <div className="mt-4 flex justify-end">
                <button type="button" onClick={onDocumentAdd} className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-white transition hover:bg-emerald-600">
                  <Plus size={14} />
                  Add Document
                </button>
              </div>
              {formData.documents.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {formData.documents.map((document) => (
                    <div key={document.id || `${document.documentType}-${document.fileUploadPath}`} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <div>
                        <p className="text-sm font-black text-slate-900">{document.documentType}</p>
                        <p className="text-xs font-semibold text-slate-500">{document.fileUploadPath}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {document.fileData ? (
                          <button
                            type="button"
                            onClick={() => window.location.assign(document.fileData)}
                            className="rounded-xl px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-emerald-700 transition hover:bg-emerald-50"
                          >
                            View
                          </button>
                        ) : null}
                        <button type="button" onClick={() => onDocumentRemove(document.id)} className="rounded-xl p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="mt-5 grid gap-5">
                <DocumentUploadField label="Teacher Photo" value={formData.photoUrl ? 'Photo selected' : ''} onBrowse={onPhotoBrowse} />
              </div>
            </div>
          </div>

          <div className="space-y-6 xl:sticky xl:top-8">
            <div className="rounded-[1.75rem] border border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#ecfdf5_100%)] p-6 text-center">
              {formData.photoUrl ? (
                <img src={formData.photoUrl} alt={fullName} className="mx-auto h-28 w-28 rounded-3xl border border-slate-200 object-cover shadow-sm" />
              ) : (
                <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-3xl border border-slate-200 bg-white text-2xl font-black uppercase text-emerald-700 shadow-sm">
                  {(formData.firstName?.[0] || 'T') + (formData.lastName?.[0] || 'R')}
                </div>
              )}
              <img src={qrImage} alt="Saved teacher QR code" className="mx-auto mt-6 h-72 w-72 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm" />
              <p className="mt-4 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">{teacher.teacherSystemId || teacher.employeeId || '-'}</p>
              <p className="mt-3 text-sm font-semibold text-slate-700">This QR is linked with the saved record and can be downloaded anytime.</p>
            </div>

            <ReviewCard title="Saved Snapshot">
              <ReviewLine label="Email" value={formData.personalEmail || '-'} />
              <ReviewLine label="Mobile" value={formData.mobileNumber || '-'} />
              <ReviewLine label="Specialization" value={formData.specialization || '-'} />
              <ReviewLine label="Contract" value={formData.contractType || '-'} />
              <ReviewLine label="Documents" value={String(formData.documents.length)} />
            </ReviewCard>
          </div>
        </div>
      </section>
    </div>
  );
}

function GeneratedTeacherView({ teacher, onClose }) {
  const qrImage = createQrImageUrl(teacher.qrCodeData);
  const fullName = `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim() || 'Teacher';

  return (
    <div className="rounded-[2.25rem] border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
      <FormHeader eyebrow="Saved" title="Teacher QR generated" desc="The teacher record is saved and the QR payload is stored in the database." />
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[1.8rem] border border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#ecfdf5_100%)] p-6 text-center">
          <img src={qrImage} alt="Teacher QR" className="mx-auto h-72 w-72 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm" />
          <p className="mt-4 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">{teacher.teacherSystemId || teacher.employeeId}</p>
          <p className="mt-3 text-sm font-semibold text-slate-700">Form data has been cleared. Scan this QR to access the saved teacher payload.</p>
        </div>
        <div className="space-y-4">
          <ReviewCard title="Teacher Summary">
            <ReviewLine label="Name" value={fullName} />
            <ReviewLine label="Employee ID" value={teacher.employeeId || '-'} />
            <ReviewLine label="Teacher ID" value={teacher.teacherSystemId || '-'} />
            <ReviewLine label="Specialization" value={teacher.specialization || '-'} />
            <ReviewLine label="Portal Password" value={teacher.teacherPortalPassword || '-'} />
          </ReviewCard>
          <button
            type="button"
            onClick={async () => {
              await downloadQrCode(teacher.qrCodeData, fullName);
            }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-emerald-200 bg-emerald-50 px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100"
          >
            <Download size={14} />
            Download QR
          </button>
          <button onClick={onClose} className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-white transition hover:bg-emerald-600">
            Back To Teacher List
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmationModal({ open, teacherName, specialization, onCancel, onConfirm, isSaving }) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-md">
      <div className="w-full max-w-lg rounded-4xl border border-white/30 bg-white/92 p-7 shadow-[0_30px_90px_-30px_rgba(15,23,42,0.5)]">
        <p className="text-[11px] font-black uppercase tracking-[0.28em] text-emerald-700">Final Confirmation</p>
        <h3 className="mt-3 font-serif text-3xl font-black italic tracking-tight text-slate-950">Generate teacher QR and save this record?</h3>
        <p className="mt-4 text-sm leading-7 text-slate-600">
          This will save <span className="font-black text-slate-900">{teacherName}</span> for <span className="font-black text-slate-900">{specialization}</span>, clear the form from the screen, and show the final QR code only after confirmation.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="inline-flex flex-1 items-center justify-center rounded-2xl border-2 border-slate-200 bg-white px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSaving}
            className="inline-flex flex-1 items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
          >
            {isSaving ? 'Saving Teacher...' : 'Yes, Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

function validateTeacherProfileStep(formData) {
  if (!formData.firstName.trim()) {
    return { isValid: false, message: 'First name is required before moving to the next section.' };
  }
  if (!formData.lastName.trim()) {
    return { isValid: false, message: 'Last name is required before moving to the next section.' };
  }
  if (!digitsOnly(formData.mobileNumber)) {
    return { isValid: false, message: 'Mobile number is required before moving to the next section.' };
  }
  if (!formData.dob) {
    return { isValid: false, message: 'Date of birth is required before moving to the next section.' };
  }
  if (!formData.address.trim()) {
    return { isValid: false, message: 'Address is required before moving to the next section.' };
  }
  if (!formData.specialization.trim()) {
    return { isValid: false, message: 'Enter at least one specialization subject before moving to the next section.' };
  }
  return { isValid: true, message: '' };
}

function validateTeacherWorkStep(formData) {
  if (!formData.contractType.trim()) {
    return { isValid: false, message: 'Contract type is required before moving to the next section.' };
  }
  if (!String(formData.salary || '').trim()) {
    return { isValid: false, message: 'Monthly salary is required before moving to the next section.' };
  }
  if (!formData.joiningDate) {
    return { isValid: false, message: 'Teaching start date is required before moving to the next section.' };
  }
  return { isValid: true, message: '' };
}

export default TeacherManagement;
