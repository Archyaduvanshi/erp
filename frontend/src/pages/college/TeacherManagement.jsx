import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Briefcase,
  CalendarCheck2,
  CheckCircle2,
  Download,
  FileText,
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
  Users,
  X,
} from 'lucide-react';
import { teacherApi, uploadApi } from '../../utils/api';
import { formatSalary } from '../../utils/salaryUtils';
import { useAuth } from '../../context/AuthContext';

const getToday = () => new Date().toISOString().slice(0, 10);

const createInitialFormData = () => ({
  firstName: '',
  lastName: '',
  personalEmail: '',
  mobileNumber: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  specialization: '',
  dob: '',
  experienceYears: '',
  contractType: '',
  leaveBalance: '',
  salary: '',
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
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('list');
  const [currentStep, setCurrentStep] = useState(1);
  const [loadError, setLoadError] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [contractFilter, setContractFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [specializationFilter, setSpecializationFilter] = useState('');
  const [sortValue, setSortValue] = useState('createdAt,desc');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [formData, setFormData] = useState(() => createInitialFormData());
  const { session } = useAuth();
  const [generatedTeacher, setGeneratedTeacher] = useState(null);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [detailFormData, setDetailFormData] = useState(() => createInitialFormData());
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingTeacher, setIsUpdatingTeacher] = useState(false);
  const [formError, setFormError] = useState('');
  const [pendingDocument, setPendingDocument] = useState(null);
  const [pendingDetailDocument, setPendingDetailDocument] = useState(null);
  const [pendingPhotoFile, setPendingPhotoFile] = useState(null);
  const [pendingDetailPhotoFile, setPendingDetailPhotoFile] = useState(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
      setPage(0);
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [searchTerm]);

  const teachersQuery = useQuery({
    queryKey: ['teachers', {
      page,
      size: pageSize,
      search: debouncedSearchTerm,
      status: statusFilter,
      specialization: specializationFilter,
      contractType: contractFilter,
      sort: sortValue,
    }],
    queryFn: () => teacherApi.getPage({
      page,
      size: pageSize,
      search: debouncedSearchTerm,
      status: statusFilter,
      specialization: specializationFilter,
      contractType: contractFilter,
      sort: sortValue,
    }),
    staleTime: 30000,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    setLoadError(teachersQuery.error?.message || '');
  }, [teachersQuery.error]);

  const teacherPage = teachersQuery.data || { content: [], page: 0, size: pageSize, totalElements: 0, totalPages: 0 };
  const teachers = teacherPage.content || [];

  const draftEmployeeId = formData.employeeId || buildDraftEmployeeId(session?.instituteName, (teacherPage.totalElements || 0) + 1);
  const refreshTeacherQueries = async ({ teacherId } = {}) => {
    if (teacherId) {
      await queryClient.invalidateQueries({ queryKey: ['teacher', teacherId] });
    }
    await queryClient.invalidateQueries({ queryKey: ['teachers'] });
  };

  const handlePageBack = () => {
    setFormError('');
    setLoadError('');

    if (activeTab === 'add') {
      if (currentStep > 1) {
        setCurrentStep((step) => step - 1);
        return;
      }
      setActiveTab('list');
      return;
    }

    if (activeTab === 'detail' || generatedTeacher) {
      setSelectedTeacher(null);
      setGeneratedTeacher(null);
      setDetailFormData(createInitialFormData());
      setActiveTab('list');
      return;
    }

    navigate('/college');
  };

  const handleDocumentAdd = () => {
    const resolvedDocumentType = formData.documentType === 'Other' ? formData.otherDocumentName.trim() : formData.documentType;
    if (!resolvedDocumentType) {
      setFormError('Select or enter a document type before submitting the document.');
      return;
    }
    if (!pendingDocument?.rawFile) {
      setFormError('Browse and select a document file before submitting the document.');
      return;
    }

    const nextDocument = {
      id: Date.now(),
      documentType: resolvedDocumentType,
      fileUploadPath: pendingDocument.fileName,
      fileName: pendingDocument.fileName,
      fileType: pendingDocument.fileType,
      fileData: '',
      fileSize: pendingDocument.fileSize,
      rawFile: pendingDocument.rawFile,
    };

    setFormData({
      ...formData,
      documents: [...formData.documents, nextDocument],
      documentType: '',
      otherDocumentName: '',
      fileUploadPath: '',
    });
    setPendingDocument(null);
    setFormError('');
  };

  const handleDocumentRemove = (documentId) => {
    setFormData({
      ...formData,
      documents: formData.documents.filter((document) => document.id !== documentId),
    });
  };

  const handleDocumentBrowse = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFormData({
      ...formData,
      fileUploadPath: file.name,
    });
    setPendingDocument({
      fileName: file.name,
      fileType: file.type || 'application/octet-stream',
      fileData: '',
      fileSize: file.size,
      rawFile: file,
    });
    setFormError('');
  };

  const handlePhotoBrowse = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPendingPhotoFile(file);
    setFormError('');
    setFormData((current) => ({
      ...current,
      photoUrl: URL.createObjectURL(file),
    }));
  };

  const handleSave = (e) => {
    e?.preventDefault?.();
    const stepOneValidation = validateTeacherProfileStep(formData, []);
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

    try {
      const pendingFormData = prepareTeacherFormDataForSave(formData);
      const uploadedFormData = await uploadTeacherAssets({
        ...pendingFormData,
        documents: formData.documents,
      }, pendingPhotoFile);

      const newTeacher = {
        ...pendingFormData,
        ...uploadedFormData,
        employeeId: '',
        salary: pendingFormData.salary ? String(pendingFormData.salary) : '',
        paymentHistory: [],
        status: 'Active',
        attendanceStatus: 'Present',
      };
      const createdTeacher = await teacherApi.create(newTeacher);
      await refreshTeacherQueries({ teacherId: createdTeacher.id });
      setGeneratedTeacher(createdTeacher);
      setFormData(createInitialFormData());
      setPendingPhotoFile(null);
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
      await refreshTeacherQueries({ teacherId });
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Unable to delete the teacher record.');
    }
  };

  const handleOpenTeacher = async (teacherId) => {
    try {
      const teacher = await queryClient.fetchQuery({
        queryKey: ['teacher', teacherId],
        queryFn: () => teacherApi.getById(teacherId),
        staleTime: 30000,
      });
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
    if (!resolvedDocumentType) {
      setLoadError('Select or enter a document type before submitting the document.');
      return;
    }
    if (!(pendingDetailDocument?.fileData || pendingDetailDocument?.rawFile)) {
      setLoadError('Browse and select a document file before submitting the document.');
      return;
    }

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
          rawFile: pendingDetailDocument.rawFile,
        },
      ],
      documentType: '',
      otherDocumentName: '',
      fileUploadPath: '',
    }));
    setPendingDetailDocument(null);
    setLoadError('');
  };

  const handleDetailDocumentRemove = (documentId) => {
    setDetailFormData((current) => ({
      ...current,
      documents: current.documents.filter((document) => document.id !== documentId),
    }));
  };

  const handleDetailDocumentBrowse = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setDetailFormData((current) => ({
      ...current,
      fileUploadPath: file.name,
    }));
    setPendingDetailDocument({
      fileName: file.name,
      fileType: file.type || 'application/octet-stream',
      fileData: '',
      fileSize: file.size,
      rawFile: file,
    });
    setLoadError('');
  };

  const handleDetailPhotoBrowse = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPendingDetailPhotoFile(file);
    setDetailFormData((current) => ({
      ...current,
      photoUrl: URL.createObjectURL(file),
    }));
    setLoadError('');
  };

  const handleUpdateTeacher = async () => {
    if (!selectedTeacher) return;
    const profileValidation = validateTeacherProfileStep(detailFormData, [], selectedTeacher.id);
    const workValidation = validateTeacherWorkStep(detailFormData);

    if (!profileValidation.isValid) {
      setLoadError(profileValidation.message);
      return;
    }

    if (!workValidation.isValid) {
      setLoadError(workValidation.message);
      return;
    }

    if (!detailFormData.photoUrl) {
      setLoadError('Teacher photo is required to update the profile.');
      return;
    }

    setIsUpdatingTeacher(true);
    try {
      const pendingDetailFormData = prepareTeacherFormDataForSave(detailFormData);
      const uploadedDetailFormData = await uploadTeacherAssets({
        ...pendingDetailFormData,
        documents: detailFormData.documents,
      }, pendingDetailPhotoFile);

      const payload = {
        ...pendingDetailFormData,
        ...uploadedDetailFormData,
        employeeId: selectedTeacher.employeeId,
        salary: pendingDetailFormData.salary ? String(pendingDetailFormData.salary) : '',
        joiningDate: selectedTeacher.joiningDate || getToday(),
        paymentHistory: selectedTeacher.paymentHistory || [],
        status: selectedTeacher.status || 'Active',
        attendanceStatus: selectedTeacher.attendanceStatus || 'Present',
        cardExpiryDate: pendingDetailFormData.cardExpiryDate,
      };
      const updatedTeacher = await teacherApi.update(selectedTeacher.id, payload);
      queryClient.setQueryData(['teacher', updatedTeacher.id], updatedTeacher);
      await refreshTeacherQueries({ teacherId: updatedTeacher.id });
      setSelectedTeacher(updatedTeacher);
      setDetailFormData(mapTeacherToFormData(updatedTeacher));
      setPendingDetailPhotoFile(null);
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Unable to update the teacher record.');
    } finally {
      setIsUpdatingTeacher(false);
    }
  };

  const activeTeachers = teachers.filter((teacher) => String(teacher.status || '').toLowerCase() === 'active').length;
  const fullTimeTeachers = teachers.filter((teacher) => String(teacher.contractType || '').toUpperCase() === 'FULL TIME').length;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f6f8fc_0%,#eef8f5_55%,#fbfcfe_100%)] text-slate-900 selection:bg-emerald-400 selection:text-slate-950">
      <div className="border-b border-slate-200/70 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <div className="flex items-center gap-4">
            <button
              onClick={handlePageBack}
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
              setPendingPhotoFile(null);
              setPendingDetailPhotoFile(null);
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
            teacherPage={teacherPage}
            isLoading={teachersQuery.isLoading || teachersQuery.isFetching}
            activeTeachers={activeTeachers}
            fullTimeTeachers={fullTimeTeachers}
            viewMode={viewMode}
            setViewMode={setViewMode}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            contractFilter={contractFilter}
            setContractFilter={(value) => {
              setContractFilter(value);
              setPage(0);
            }}
            statusFilter={statusFilter}
            setStatusFilter={(value) => {
              setStatusFilter(value);
              setPage(0);
            }}
            specializationFilter={specializationFilter}
            setSpecializationFilter={(value) => {
              setSpecializationFilter(value);
              setPage(0);
            }}
            sortValue={sortValue}
            setSortValue={(value) => {
              setSortValue(value);
              setPage(0);
            }}
            page={page}
            setPage={setPage}
            pageSize={pageSize}
            setPageSize={(value) => {
              setPageSize(value);
              setPage(0);
            }}
            onCreate={() => {
              setGeneratedTeacher(null);
              setSelectedTeacher(null);
              setActiveTab('add');
            }}
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
            teachers={[]}
            handleSave={handleSave}
            formError={formError}
            setFormError={setFormError}
            draftEmployeeId={draftEmployeeId}
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
  teacherPage,
  isLoading,
  activeTeachers,
  fullTimeTeachers,
  viewMode,
  setViewMode,
  searchTerm,
  setSearchTerm,
  contractFilter,
  setContractFilter,
  statusFilter,
  setStatusFilter,
  specializationFilter,
  setSpecializationFilter,
  sortValue,
  setSortValue,
  page,
  setPage,
  pageSize,
  setPageSize,
  onCreate,
  onDelete,
  onOpenTeacher,
}) => (
  <div className="space-y-8">
    <section className="grid gap-4 sm:grid-cols-3">
      <StatCard label="Total Faculty" value={teachers.length} tone="emerald" icon={Users} />
      <StatCard label="Active Teachers" value={activeTeachers} tone="cyan" icon={CalendarCheck2} />
      <StatCard label="Full Time" value={fullTimeTeachers} tone="amber" icon={Briefcase} />
    </section>

    <section className="rounded-4xl border border-slate-200/80 bg-white p-5 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">Faculty Directory</h3>
          <p className="mt-1 text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
            {teacherPage.totalElements || 0} records found
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
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
          >
            <option value="">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="On Leave">On Leave</option>
          </select>

          <select
            value={contractFilter}
            onChange={(e) => setContractFilter(e.target.value)}
            className="rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
          >
            <option value="">All Contracts</option>
            <option value="FULL TIME">Full Time</option>
            <option value="PART TIME">Part Time</option>
            <option value="VISITING">Visiting</option>
            <option value="CONTRACTUAL">Contractual</option>
          </select>

          <input
            value={specializationFilter}
            onChange={(e) => setSpecializationFilter(e.target.value)}
            placeholder="Subject / specialization"
            className="w-52 rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
          />

          <select
            value={sortValue}
            onChange={(e) => setSortValue(e.target.value)}
            className="rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
          >
            <option value="createdAt,desc">Newest Added</option>
            <option value="createdAt,asc">Oldest Added</option>
            <option value="name,asc">Name A-Z</option>
            <option value="name,desc">Name Z-A</option>
            <option value="employeeId,asc">Employee ID</option>
            <option value="joiningDate,desc">Joining Date</option>
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

      {isLoading && teachers.length === 0 ? (
        <TeacherRowsSkeleton viewMode={viewMode} />
      ) : teachers.length > 0 ? (
        viewMode === 'grid' ? (
          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {teachers.map((teacher) => (
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
                  <th className="px-6 py-4">Contract</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {teachers.map((teacher) => (
                  <tr key={teacher.id} onClick={() => onOpenTeacher(teacher.id)} className="cursor-pointer transition hover:bg-emerald-50/60">
                    <td className="px-6 py-5">
                      <p className="text-sm font-black text-slate-950">{teacher.firstName} {teacher.lastName}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{teacher.personalEmail || teacher.mobileNumber || 'Not provided'}</p>
                    </td>
                    <td className="px-6 py-5 text-sm font-semibold text-slate-700">{teacher.employeeId || 'Pending'}</td>
                    <td className="px-6 py-5 text-sm font-semibold text-slate-700">{teacher.specialization || 'Not assigned'}</td>
                    <td className="px-6 py-5">
                      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                        {teacher.contractType || 'FULL TIME'}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-sm font-black text-slate-700">{teacher.status || 'Active'}</td>
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
            {searchTerm || statusFilter || contractFilter || specializationFilter
              ? 'No teachers match these filters. Clear filters or adjust your search.'
              : 'Create the first teacher profile to start attendance, document verification, and automatic ID card generation.'}
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
      <div className="mt-5 flex flex-col gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Rows</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 outline-none"
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPage(Math.max(page - 1, 0))}
            disabled={page <= 0 || isLoading}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
            Page {(teacherPage.page || 0) + 1} of {Math.max(teacherPage.totalPages || 1, 1)}
          </span>
          <button
            type="button"
            onClick={() => setPage(page + 1)}
            disabled={page + 1 >= (teacherPage.totalPages || 1) || isLoading}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  </div>
);

const TeacherWizard = ({
  currentStep,
  setCurrentStep,
  formData,
  setFormData,
  teachers,
  handleSave,
  formError,
  setFormError,
  draftEmployeeId,
  handleDocumentAdd,
  handleDocumentRemove,
  handleDocumentBrowse,
  handlePhotoBrowse,
}) => {
  const stepOneValidation = validateTeacherProfileStep(formData, teachers);
  const stepTwoValidation = validateTeacherWorkStep(formData);
  const updateUpperField = (field) => (e) => {
    setFormData({ ...formData, [field]: e.target.value.toUpperCase() });
  };
  const updateDigitsField = (field, maxLength) => (e) => {
    setFormData({ ...formData, [field]: digitsOnly(e.target.value).slice(0, maxLength) });
  };

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
              {formData.contractType || 'CONTRACT PENDING'}
            </span>
          </div>
          <h3 className="mt-8 font-serif text-3xl font-black italic tracking-tight">
            {formData.firstName || 'NEW'} {formData.lastName || 'TEACHER'}
          </h3>
          <p className="mt-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-300">
            {formData.specialization || 'SPECIALIZATION PENDING'}
          </p>
          <div className="mt-8 space-y-3 text-sm text-slate-300">
            <PreviewRow icon={Briefcase} value={draftEmployeeId} />
            <PreviewRow icon={MapPin} value={[formData.address, formData.city, formData.state, formData.pincode].filter(Boolean).join(', ') || 'ADDRESS NOT ADDED'} />
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
            <CreativeInput label="First Name" value={formData.firstName} onChange={updateUpperField('firstName')} placeholder="ENTER TEACHER FIRST NAME" />
            <CreativeInput label="Last Name (Optional)" value={formData.lastName} onChange={updateUpperField('lastName')} placeholder="ENTER TEACHER LAST NAME IF AVAILABLE" />
            <CreativeInput label="Personal Email" type="email" value={formData.personalEmail} onChange={(e) => setFormData({ ...formData, personalEmail: e.target.value.trim().toUpperCase() })} placeholder="ENTER UNIQUE EMAIL ADDRESS" />
            <CreativeInput label="Mobile Number" value={formData.mobileNumber} onChange={updateDigitsField('mobileNumber', 10)} placeholder="ENTER 10 DIGIT MOBILE NUMBER" inputMode="numeric" maxLength={10} />
            <CreativeInput label="Date Of Birth" type="date" value={formData.dob} onChange={(e) => setFormData({ ...formData, dob: e.target.value })} />
            <CreativeInput
              label="Address"
              value={formData.address}
              onChange={updateUpperField('address')}
              placeholder="ENTER HOUSE, STREET OR LOCAL AREA"
            />
            <CreativeInput label="City" value={formData.city} onChange={updateUpperField('city')} placeholder="ENTER CITY" />
            <CreativeInput label="State" value={formData.state} onChange={updateUpperField('state')} placeholder="ENTER STATE" />
            <CreativeInput label="Pincode" value={formData.pincode} onChange={updateDigitsField('pincode', 6)} placeholder="ENTER PINCODE" inputMode="numeric" maxLength={6} />
            <CreativeTextarea
              label="Specialization Subjects"
              value={formData.specialization}
              onChange={updateUpperField('specialization')}
              placeholder="ENTER SUBJECTS SEPARATED BY COMMA"
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
            <CreativeInput label="Experience Years" value={formData.experienceYears} onChange={updateDigitsField('experienceYears', 2)} placeholder="ENTER EXPERIENCE IN YEARS" inputMode="numeric" maxLength={2} />
            <CreativeSelect
              label="Contract Type"
              value={formData.contractType}
              onChange={(e) => setFormData({ ...formData, contractType: e.target.value })}
              options={['Select', 'FULL TIME', 'PART TIME', 'VISITING', 'CONTRACTUAL']}
            />
            <CreativeInput label="Leave Balance" type="number" value={formData.leaveBalance} onChange={(e) => setFormData({ ...formData, leaveBalance: e.target.value })} placeholder="ENTER LEAVE BALANCE" min="0" />
            <CreativeInput label="Monthly Salary" type="number" min="0" value={formData.salary} onChange={(e) => setFormData({ ...formData, salary: e.target.value })} placeholder="ENTER MONTHLY SALARY" />
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
                onChange={updateUpperField('otherDocumentName')}
                placeholder="ENTER DOCUMENT NAME"
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
                  <PreviewRow icon={Briefcase} value={draftEmployeeId} />
                  <PreviewRow icon={Mail} value={formData.personalEmail || 'Email not added'} />
                  <PreviewRow icon={Phone} value={formData.mobileNumber || 'Mobile not added'} />
                  <PreviewRow icon={CalendarCheck2} value="JOINING DATE WILL BE SAVED AUTOMATICALLY" />
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
              <ReviewLine label="Date Of Birth" value={formData.dob || '-'} />
              <ReviewLine label="Address" value={formData.address || '-'} />
              <ReviewLine label="City" value={formData.city || '-'} />
              <ReviewLine label="State" value={formData.state || '-'} />
              <ReviewLine label="Pincode" value={formData.pincode || '-'} />
              <ReviewLine label="Specialization" value={formData.specialization || '-'} />
              <ReviewLine label="Experience" value={formData.experienceYears ? `${formData.experienceYears} years` : '-'} />
            </ReviewCard>

            <ReviewCard title="Attendance & Identity">
              <ReviewLine label="Contract" value={formData.contractType || '-'} />
              <ReviewLine label="Leave Balance" value={formData.leaveBalance ? `${formData.leaveBalance} days` : '-'} />
              <ReviewLine label="Monthly Salary" value={formatSalary(formData.salary)} />
              <ReviewLine label="Joining Date" value="Auto saved on create" />
              <ReviewLine label="Employee ID" value={draftEmployeeId} />
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

const TeacherRowsSkeleton = ({ viewMode }) => (
  viewMode === 'grid' ? (
    <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((item) => (
        <div key={item} className="h-72 animate-pulse rounded-[1.9rem] border border-slate-200 bg-slate-100" />
      ))}
    </div>
  ) : (
    <div className="mt-6 overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white">
      {[1, 2, 3, 4, 5].map((item) => (
        <div key={item} className="flex animate-pulse items-center gap-4 border-b border-slate-100 px-6 py-5 last:border-0">
          <div className="h-10 w-10 rounded-xl bg-slate-100" />
          <div className="h-4 flex-1 rounded bg-slate-100" />
          <div className="h-4 w-32 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  )
);

const TeacherCard = ({ teacher, onDelete, onOpen }) => (
  <article onClick={() => onOpen(teacher.id)} className="group cursor-pointer overflow-hidden rounded-[1.9rem] border border-slate-200/80 bg-white p-6 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.35)] transition hover:-translate-y-1 hover:shadow-[0_24px_50px_-28px_rgba(16,185,129,0.35)]">
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-4">
        {teacher.photoUrl ? (
          <img src={buildImageKitThumbnail(teacher.photoUrl, 48)} alt={teacher.fullName || `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim() || 'Teacher'} loading="lazy" className="h-14 w-14 rounded-2xl object-cover" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#d1fae5_0%,#ccfbf1_100%)] text-lg font-black uppercase text-slate-900">
            {(teacher.firstName?.[0] || 'T') + (teacher.lastName?.[0] || 'R')}
          </div>
        )}
        <div>
          <h4 className="text-lg font-black tracking-tight text-slate-950">{teacher.fullName || `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim()}</h4>
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
      <PreviewRow icon={ShieldCheck} value={`Status: ${teacher.status || 'Active'}`} light />
    </div>

    <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Employee ID</p>
        <p className="mt-1 text-sm font-semibold text-slate-700">{teacher.employeeId || 'Auto pending'}</p>
      </div>
      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
        {teacher.contractType || 'FULL TIME'}
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
      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-3.5 text-sm font-semibold uppercase text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
      {...props}
    />
  </div>
);

const CreativeTextarea = ({ label, className = '', hint, ...props }) => (
  <div className={`space-y-2.5 ${className}`.trim()}>
    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
    <textarea
      className="min-h-20 w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-3.5 text-sm font-semibold uppercase text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
      {...props}
    />
    {hint ? <p className="text-xs font-semibold text-slate-500">{hint}</p> : null}
  </div>
);

const CreativeSelect = ({ label, options, ...props }) => (
  <div className="space-y-2.5">
    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
    <select
      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-3.5 text-sm font-semibold uppercase text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
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

function mapTeacherToFormData(teacher) {
  return {
    ...createInitialFormData(),
    firstName: teacher.firstName || '',
    lastName: teacher.lastName || '',
    personalEmail: teacher.personalEmail || '',
    mobileNumber: teacher.mobileNumber || '',
    employeeId: teacher.employeeId || '',
    address: teacher.address || '',
    city: teacher.city || '',
    state: teacher.state || '',
    pincode: teacher.pincode || '',
    specialization: teacher.specialization || '',
    dob: teacher.dob || '',
    experienceYears: teacher.experienceYears || '',
    contractType: teacher.contractType || '',
    leaveBalance: teacher.leaveBalance || '',
    salary: teacher.salary || '',
    joiningDate: teacher.joiningDate || '',
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

async function uploadTeacherAssets(formData, pendingPhotoFile) {
  const uploadedPhoto = pendingPhotoFile
    ? await uploadApi.uploadFile(pendingPhotoFile, '/erp/teachers/photos')
    : null;
  const uploadedDocuments = await Promise.all(
    (formData.documents || []).map((document) => uploadTeacherDocument(document))
  );

  return {
    ...formData,
    photoUrl: uploadedPhoto?.url || formData.photoUrl,
    fileUploadPath: '',
    documents: uploadedDocuments,
  };
}

function prepareTeacherFormDataForSave(formData) {
  return {
    ...formData,
    firstName: normalizeUpper(formData.firstName),
    lastName: normalizeUpper(formData.lastName),
    personalEmail: normalizeUpper(formData.personalEmail),
    mobileNumber: digitsOnly(formData.mobileNumber),
    address: normalizeUpper(formData.address),
    city: normalizeUpper(formData.city),
    state: normalizeUpper(formData.state),
    pincode: digitsOnly(formData.pincode),
    specialization: normalizeUpper(formData.specialization),
    experienceYears: digitsOnly(formData.experienceYears),
    contractType: normalizeUpper(formData.contractType),
    otherDocumentName: normalizeUpper(formData.otherDocumentName),
    documents: (formData.documents || []).map((document) => stripPendingFile(document)),
    fileUploadPath: '',
  };
}

function normalizeUpper(value) {
  return String(value || '').trim().toUpperCase();
}

async function uploadTeacherDocument(document) {
  if (!document?.rawFile) {
    return stripPendingFile(document);
  }

  const uploadedFile = await uploadApi.uploadFile(document.rawFile, '/erp/teachers/documents');
  return {
    ...stripPendingFile(document),
    fileUploadPath: uploadedFile.filePath || document.fileUploadPath || document.fileName,
    fileName: uploadedFile.name || document.fileName,
    fileType: document.fileType || uploadedFile.fileType || 'application/octet-stream',
    fileData: uploadedFile.url,
    fileSize: uploadedFile.size || document.fileSize || 0,
  };
}

function stripPendingFile(document) {
  if (!document) {
    return document;
  }

  const { rawFile, ...cleanDocument } = document;
  return cleanDocument;
}

function createQrImageUrl(value) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=512x512&margin=16&data=${encodeURIComponent(value || 'teacher')}`;
}

function buildImageKitThumbnail(url, size = 48) {
  if (!url) {
    return url;
  }

  const transformation = `tr=w-${size},h-${size},c-at_max`;
  return url.includes('?') ? `${url}&${transformation}` : `${url}?${transformation}`;
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
  const updateUpperField = (field) => (e) => {
    setFormData({ ...formData, [field]: e.target.value.toUpperCase() });
  };
  const updateDigitsField = (field, maxLength) => (e) => {
    setFormData({ ...formData, [field]: digitsOnly(e.target.value).slice(0, maxLength) });
  };

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
              <ReviewLine label="Employee ID" value={teacher.employeeId || '-'} />
              <ReviewLine label="Status" value={teacher.status || 'Active'} />
              <ReviewLine label="Attendance" value={teacher.attendanceStatus || 'Present'} />
            </ReviewCard>

            <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Editable Details</p>
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <CreativeInput label="First Name" value={formData.firstName} onChange={updateUpperField('firstName')} placeholder="ENTER TEACHER FIRST NAME" />
                <CreativeInput label="Last Name (Optional)" value={formData.lastName} onChange={updateUpperField('lastName')} placeholder="ENTER TEACHER LAST NAME IF AVAILABLE" />
                <CreativeInput label="Personal Email" type="email" value={formData.personalEmail} onChange={(e) => setFormData({ ...formData, personalEmail: e.target.value.trim().toUpperCase() })} placeholder="ENTER UNIQUE EMAIL ADDRESS" />
                <CreativeInput label="Mobile Number" value={formData.mobileNumber} onChange={updateDigitsField('mobileNumber', 10)} placeholder="ENTER 10 DIGIT MOBILE NUMBER" inputMode="numeric" maxLength={10} />
                <CreativeInput label="Date Of Birth" type="date" value={formData.dob} onChange={(e) => setFormData({ ...formData, dob: e.target.value })} />
                <CreativeInput label="Experience Years" value={formData.experienceYears} onChange={updateDigitsField('experienceYears', 2)} placeholder="ENTER EXPERIENCE IN YEARS" inputMode="numeric" maxLength={2} />
                <CreativeSelect label="Contract Type" value={formData.contractType} onChange={(e) => setFormData({ ...formData, contractType: e.target.value })} options={['Select', 'FULL TIME', 'PART TIME', 'VISITING', 'CONTRACTUAL']} />
                <CreativeInput label="Leave Balance" type="number" value={formData.leaveBalance} onChange={(e) => setFormData({ ...formData, leaveBalance: e.target.value })} placeholder="ENTER LEAVE BALANCE" min="0" />
                <CreativeInput label="Monthly Salary" type="number" min="0" value={formData.salary} onChange={(e) => setFormData({ ...formData, salary: e.target.value })} placeholder="ENTER MONTHLY SALARY" />
                <div className="md:col-span-2">
                  <CreativeInput label="Address" value={formData.address} onChange={updateUpperField('address')} placeholder="ENTER HOUSE, STREET OR LOCAL AREA" />
                </div>
                <CreativeInput label="City" value={formData.city} onChange={updateUpperField('city')} placeholder="ENTER CITY" />
                <CreativeInput label="State" value={formData.state} onChange={updateUpperField('state')} placeholder="ENTER STATE" />
                <div className="md:col-span-2">
                  <CreativeInput label="Pincode" value={formData.pincode} onChange={updateDigitsField('pincode', 6)} placeholder="ENTER PINCODE" inputMode="numeric" maxLength={6} />
                </div>
                <div className="md:col-span-2">
                  <CreativeTextarea label="Specialization Subjects" value={formData.specialization} onChange={updateUpperField('specialization')} placeholder="ENTER SUBJECTS SEPARATED BY COMMA" />
                </div>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Documents And Photo</p>
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <CreativeSelect label="Document Type" value={formData.documentType} onChange={(e) => setFormData({ ...formData, documentType: e.target.value })} options={['Select', 'Aadhar', 'Resume', 'Experience Certificate', 'Qualification Certificate', 'Other']} />
                {formData.documentType === 'Other' ? (
                  <CreativeInput label="Document Name" value={formData.otherDocumentName} onChange={updateUpperField('otherDocumentName')} placeholder="ENTER DOCUMENT NAME" />
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
              <p className="mt-4 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">{teacher.employeeId || '-'}</p>
              <p className="mt-3 text-sm font-semibold text-slate-700">This QR is linked with the saved record and can be downloaded anytime.</p>
            </div>

            <ReviewCard title="Saved Snapshot">
              <ReviewLine label="Email" value={formData.personalEmail || '-'} />
              <ReviewLine label="Mobile" value={formData.mobileNumber || '-'} />
              <ReviewLine label="City" value={formData.city || '-'} />
              <ReviewLine label="State" value={formData.state || '-'} />
              <ReviewLine label="Pincode" value={formData.pincode || '-'} />
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
          <p className="mt-4 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">{teacher.employeeId}</p>
          <p className="mt-3 text-sm font-semibold text-slate-700">Form data has been cleared. Scan this QR to access the saved teacher payload.</p>
        </div>
        <div className="space-y-4">
          <ReviewCard title="Teacher Summary">
            <ReviewLine label="Name" value={fullName} />
            <ReviewLine label="Employee ID" value={teacher.employeeId || '-'} />
            <ReviewLine label="Specialization" value={teacher.specialization || '-'} />
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

function validateTeacherProfileStep(formData, teachers = [], currentTeacherId = null) {
  if (!formData.firstName.trim()) {
    return { isValid: false, message: 'First name is required before moving to the next section.' };
  }

  const emailValue = String(formData.personalEmail || '').trim();
  if (!emailValue) {
    return { isValid: false, message: 'Personal email is required before moving to the next section.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
    return { isValid: false, message: 'Enter a valid email address before moving to the next section.' };
  }
  if (teachers.some((teacher) => teacher.id !== currentTeacherId && String(teacher.personalEmail || '').toLowerCase() === emailValue.toLowerCase())) {
    return { isValid: false, message: 'This email is already used by another teacher.' };
  }

  const mobileDigits = digitsOnly(formData.mobileNumber);
  if (!mobileDigits) {
    return { isValid: false, message: 'Mobile number is required before moving to the next section.' };
  }
  if (mobileDigits.length !== 10) {
    return { isValid: false, message: 'Mobile number must be exactly 10 digits.' };
  }
  if (teachers.some((teacher) => teacher.id !== currentTeacherId && digitsOnly(teacher.mobileNumber) === mobileDigits)) {
    return { isValid: false, message: 'This mobile number is already used by another teacher.' };
  }
  if (!formData.dob) {
    return { isValid: false, message: 'Date of birth is required before moving to the next section.' };
  }
  if (!formData.address.trim()) {
    return { isValid: false, message: 'Address is required before moving to the next section.' };
  }
  if (!formData.city.trim()) {
    return { isValid: false, message: 'City is required before moving to the next section.' };
  }
  if (!formData.state.trim()) {
    return { isValid: false, message: 'State is required before moving to the next section.' };
  }
  if (!digitsOnly(formData.pincode)) {
    return { isValid: false, message: 'Pincode is required before moving to the next section.' };
  }
  if (digitsOnly(formData.pincode).length !== 6) {
    return { isValid: false, message: 'Pincode must be exactly 6 digits.' };
  }
  if (!formData.specialization.trim()) {
    return { isValid: false, message: 'Enter at least one specialization subject before moving to the next section.' };
  }
  return { isValid: true, message: '' };
}

function validateTeacherWorkStep(formData) {
  const experienceDigits = digitsOnly(formData.experienceYears);
  if (!experienceDigits) {
    return { isValid: false, message: 'Experience years is required before moving to the next section.' };
  }
  if (!/^\d{1,2}$/.test(experienceDigits)) {
    return { isValid: false, message: 'Experience years must be a one or two digit number.' };
  }
  if (!formData.contractType.trim()) {
    return { isValid: false, message: 'Contract type is required before moving to the next section.' };
  }
  if (!String(formData.salary || '').trim()) {
    return { isValid: false, message: 'Monthly salary is required before moving to the next section.' };
  }
  return { isValid: true, message: '' };
}

export default TeacherManagement;
