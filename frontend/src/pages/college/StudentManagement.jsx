import React, { useEffect, useMemo, useState } from 'react';
import EmailOtpField from '../../components/EmailOtpField';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  FileText,
  IdCard,
  LayoutGrid,
  List,
  Mail,
  Phone,
  Plus,
  QrCode,
  Search,
  Download,
  Save,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { academicSessionApi, curriculumApi, settingsApi, studentApi, uploadApi } from '../../utils/api';
import QRScannerButton from '../../components/scanner/QRScannerButton';
import { downloadQrCode, useQrCodeDataUrl } from '../../utils/qrCode';

const initialFormData = {
  firstName: '',
  lastName: '',
  dob: '',
  gender: 'Male',
  email: '',
  mobile: '',
  regDate: '',
  bloodGroup: '',
  address: '',
  city: '',
  pincode: '',
  state: '',
  guardianFirstName: '',
  guardianLastName: '',
  guardianName: '',
  motherFirstName: '',
  motherLastName: '',
  motherName: '',
  guardianPhone: '',
  prevSchool: '',
  category: '',
  admissionDate: '',
  academicYear: '',
  classId: '',
  sectionId: '',
  className: '',
  section: '',
  assignedClass: '',
  admissionCategory: '',
  transportOptIn: 'no',
  hostelOptIn: 'no',
  libraryOptIn: 'no',
  transportStatus: 'inactive',
  hostelStatus: 'inactive',
  libraryStatus: 'inactive',
  documentType: '',
  otherDocumentName: '',
  fileUploadPath: '',
  documents: [],
  qrCodeData: '',
  cardExpiryDate: '',
  photoUrl: '',
};

const CATEGORY_OPTIONS = ['Select', 'GEN', 'OBC', 'SC', 'ST', 'EWS', 'MINORITY'];
const ADMISSION_CATEGORY_OPTIONS = ['Select', 'REGULAR', 'LATERAL ENTRY', 'TRANSFER', 'SCHOLARSHIP'];
const SECTION_OPTIONS = ['Select', 'A', 'B', 'C', 'D'];
const BLOOD_GROUP_OPTIONS = ['Select', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const UPPERCASE_STUDENT_FIELDS = new Set([
  'firstName',
  'lastName',
  'bloodGroup',
  'address',
  'city',
  'state',
  'guardianFirstName',
  'guardianLastName',
  'guardianName',
  'motherFirstName',
  'motherLastName',
  'motherName',
  'prevSchool',
  'category',
  'className',
  'section',
  'assignedClass',
  'admissionCategory',
  'academicYear',
  'documentType',
  'otherDocumentName',
]);

const StudentManagement = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('list');
  const [currentStep, setCurrentStep] = useState(1);
  const [currentAcademicYear, setCurrentAcademicYear] = useState(getDefaultAcademicYear());
  const [loadError, setLoadError] = useState('');
  const [viewMode, setViewMode] = useState('table');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [statusFilter, setStatusFilter] = useState('');
  const [sortValue, setSortValue] = useState('createdAt,desc');
  const [formData, setFormData] = useState(initialFormData);
  const [generatedStudent, setGeneratedStudent] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [detailFormData, setDetailFormData] = useState(initialFormData);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingStudent, setIsUpdatingStudent] = useState(false);
  const [pendingDeleteStudent, setPendingDeleteStudent] = useState(null);
  const [isDeletingStudent, setIsDeletingStudent] = useState(false);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
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

  const academicYearQuery = useQuery({
    queryKey: ['college-academic-year'],
    queryFn: () => settingsApi.getAcademicYear(),
    staleTime: 15 * 60 * 1000,
  });

  const academicSessionsQuery = useQuery({
    queryKey: ['student-form-academic-sessions'],
    queryFn: academicSessionApi.getAll,
    staleTime: 15 * 60 * 1000,
  });

  const activeAcademicSession = useMemo(() => (
    (academicSessionsQuery.data || []).find((session) => session.current) || (academicSessionsQuery.data || [])[0] || null
  ), [academicSessionsQuery.data]);
  const activeAcademicSessionId = activeAcademicSession?.id || '';

  const classOptionsQuery = useQuery({
    queryKey: ['curriculum', 'class-options', activeAcademicSessionId],
    queryFn: () => curriculumApi.getClassOptions(activeAcademicSessionId),
    enabled: Boolean(activeAcademicSessionId),
    staleTime: 60_000,
  });

  const sectionOptionsQuery = useQuery({
    queryKey: ['curriculum', 'section-options', activeAcademicSessionId, formData.classId],
    queryFn: () => curriculumApi.getSectionOptions(formData.classId),
    enabled: Boolean(activeAcademicSessionId && formData.classId && activeTab === 'add'),
    staleTime: 30_000,
  });

  const detailSectionOptionsQuery = useQuery({
    queryKey: ['curriculum', 'section-options', activeAcademicSessionId, detailFormData.classId],
    queryFn: () => curriculumApi.getSectionOptions(detailFormData.classId),
    enabled: Boolean(activeAcademicSessionId && detailFormData.classId && activeTab === 'detail'),
    staleTime: 30_000,
  });

  const classSummaryQuery = useQuery({
    queryKey: ['student-class-summary'],
    queryFn: () => studentApi.getClassSummary(),
    staleTime: 30000,
  });

  const studentsQuery = useQuery({
    queryKey: ['students', {
      page,
      size: pageSize,
      assignedClass: selectedClass,
      search: debouncedSearchTerm,
      status: statusFilter,
      sort: sortValue,
    }],
    queryFn: () => studentApi.getPage({
      page,
      size: pageSize,
      assignedClass: selectedClass,
      search: debouncedSearchTerm,
      status: statusFilter,
      sort: sortValue,
    }),
    enabled: Boolean(selectedClass),
    staleTime: 30000,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (academicYearQuery.data?.academicYear) {
      setCurrentAcademicYear(String(academicYearQuery.data.academicYear).toUpperCase());
    }
  }, [academicYearQuery.data]);

  useEffect(() => {
    const error = academicYearQuery.error || academicSessionsQuery.error || classOptionsQuery.error || sectionOptionsQuery.error || detailSectionOptionsQuery.error || classSummaryQuery.error || studentsQuery.error;
    setLoadError(error?.message || '');
  }, [academicYearQuery.error, academicSessionsQuery.error, classOptionsQuery.error, sectionOptionsQuery.error, detailSectionOptionsQuery.error, classSummaryQuery.error, studentsQuery.error]);

  const classSummaries = useMemo(() => (
    (classSummaryQuery.data || []).map((summary) => ({
      name: summary.assignedClass || 'Unassigned',
      count: summary.totalStudents || 0,
      verified: summary.verifiedStudents || 0,
    }))
  ), [classSummaryQuery.data]);

  const studentPage = studentsQuery.data || { content: [], page: 0, size: pageSize, totalElements: 0, totalPages: 0 };
  const students = studentPage.content || [];

  const today = new Date().toISOString().split('T')[0];
  const draftAssignedClass = [formData.className, formData.section].filter(Boolean).join(' / ');
  const draftEnrollmentNo = 'SCHOOLSTU AUTO NUMBER';

  const refreshStudentQueries = async ({ studentId } = {}) => {
    if (studentId) {
      await queryClient.invalidateQueries({ queryKey: ['student', studentId] });
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['student-class-summary'] }),
      queryClient.invalidateQueries({ queryKey: ['students'] }),
      queryClient.invalidateQueries({ queryKey: ['curriculum', 'class-options'] }),
      queryClient.invalidateQueries({ queryKey: ['curriculum', 'section-options'] }),
      queryClient.invalidateQueries({ queryKey: ['curriculum-classes'] }),
    ]);
  };

  const updateFormField = (field, value) => {
    setFormData((current) => ({ ...current, [field]: normalizeStudentFieldValue(field, value) }));
    setFieldErrors((current) => ({ ...current, [field]: '' }));
    setFormError('');
  };

  const updateDetailField = (field, value) => {
    setDetailFormData((current) => ({ ...current, [field]: normalizeStudentFieldValue(field, value) }));
    setFieldErrors((current) => ({ ...current, [field]: '' }));
    setLoadError('');
  };

  const handleWizardStepChange = (targetStep) => {
    if (targetStep <= currentStep) {
      setFieldErrors({});
      setFormError('');
      setCurrentStep(targetStep);
      return;
    }

    const validationErrors = validateStudentStep(currentStep, formData);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setFormError('Please fix the highlighted fields.');
      return;
    }

    setFieldErrors({});
    setFormError('');
    setCurrentStep(targetStep);
  };
  const handleDocumentAdd = () => {
    const resolvedDocumentType = formData.documentType === 'Other' ? formData.otherDocumentName.trim() : formData.documentType;
    if (!resolvedDocumentType || !pendingDocument?.rawFile) return;

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
    setFieldErrors((current) => ({ ...current, photoUrl: '' }));
    setFormData((current) => ({
      ...current,
      photoUrl: URL.createObjectURL(file),
    }));
  };

  const handleSave = () => {
    const validationErrors = validateStudentForm(formData, { requireDocuments: true });
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setFormError('Please fix the highlighted fields.');
      return;
    }

    if (!formData.photoUrl) {
      setFieldErrors((current) => ({ ...current, photoUrl: 'Student photo upload is required.' }));
      setFormError('Student photo upload is required before confirmation.');
      return;
    }

    setFormError('');
    setFieldErrors({});
    setIsConfirmModalOpen(true);
  };

  const handleConfirmSave = async () => {
    setIsSaving(true);

    try {
      const pendingFormData = prepareStudentFormDataForSave(formData);
      if (!pendingPhotoFile) {
        setFieldErrors((current) => ({ ...current, photoUrl: 'Student photo upload is required.' }));
        setFormError('Student photo upload is required before confirmation.');
        setIsConfirmModalOpen(false);
        return;
      }

      const uploadedFormData = await uploadStudentAssets({
        ...pendingFormData,
        documents: formData.documents,
      }, pendingPhotoFile);
      const resolvedAssignedClass = draftAssignedClass || uploadedFormData.assignedClass || '';
      const newStudent = {
        ...uploadedFormData,
        className: uploadedFormData.className,
        section: uploadedFormData.section,
        assignedClass: resolvedAssignedClass,
        academicYear: uploadedFormData.academicYear || currentAcademicYear,
        transportStatus: uploadedFormData.transportOptIn === 'yes' ? 'active' : 'inactive',
        hostelStatus: uploadedFormData.hostelOptIn === 'yes' ? 'active' : 'inactive',
        libraryStatus: uploadedFormData.libraryOptIn === 'yes' ? 'active' : 'inactive',
        facilities: {
          transport: {
            requested: uploadedFormData.transportOptIn === 'yes',
            active: uploadedFormData.transportOptIn === 'yes',
            status: uploadedFormData.transportOptIn === 'yes' ? 'active' : 'inactive',
          },
          hostel: {
            requested: uploadedFormData.hostelOptIn === 'yes',
            active: uploadedFormData.hostelOptIn === 'yes',
            status: uploadedFormData.hostelOptIn === 'yes' ? 'active' : 'inactive',
          },
          library: {
            requested: uploadedFormData.libraryOptIn === 'yes',
            active: uploadedFormData.libraryOptIn === 'yes',
            status: uploadedFormData.libraryOptIn === 'yes' ? 'active' : 'inactive',
          },
        },
        status: 'Verified',
      };
      const savedStudent = await studentApi.create(newStudent);
      await refreshStudentQueries({ studentId: savedStudent.id });
      setGeneratedStudent(savedStudent);
      setFormData(initialFormData);
      setPendingPhotoFile(null);
      setCurrentStep(1);
      setIsConfirmModalOpen(false);
      setLoadError('');
      setFormError('');
    } catch (error) {
      setLoadError(error.message || 'Unable to save the student record.');
      setFieldErrors(error.fieldErrors || {});
    } finally {
      setIsSaving(false);
    }
  };

  const handleNavbarBack = () => {
    if (pendingDeleteStudent || isSaving || isDeletingStudent) {
      return;
    }

    if (activeTab === 'detail' && selectedStudent) {
      setSelectedStudent(null);
      setDetailFormData(initialFormData);
      setFieldErrors({});
      setActiveTab('list');
      return;
    }

    if (activeTab !== 'list') {
      setActiveTab('list');
      setGeneratedStudent(null);
      setCurrentStep(1);
      setFormError('');
      setFieldErrors({});
      return;
    }

    if (selectedClass) {
      setSelectedClass('');
      setSearchTerm('');
      setDebouncedSearchTerm('');
      setPage(0);
      setViewMode('table');
      return;
    }

    navigate('/college');
  };

  const handleDelete = (studentId) => {
    const student = students.find((record) => record.id === studentId);
    setPendingDeleteStudent(student || { id: studentId });
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteStudent?.id) return;

    setIsDeletingStudent(true);
    try {
      await studentApi.delete(pendingDeleteStudent.id);
      await refreshStudentQueries({ studentId: pendingDeleteStudent.id });
      if (selectedStudent?.id === pendingDeleteStudent.id) {
        setSelectedStudent(null);
        setDetailFormData(initialFormData);
        setActiveTab('list');
      }
      setPendingDeleteStudent(null);
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Unable to delete the student record.');
    } finally {
      setIsDeletingStudent(false);
    }
  };

  const updateStudentFacilities = async (studentId, updates) => {
    try {
      const updatedStudent = await studentApi.updateFacilities(studentId, updates);
      queryClient.setQueryData(['student', studentId], updatedStudent);
      await queryClient.invalidateQueries({ queryKey: ['students'] });
      await queryClient.invalidateQueries({ queryKey: ['student-class-summary'] });
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Unable to update student facilities.');
    }
  };

  const handleOpenStudent = async (studentId) => {
    try {
      const student = await queryClient.fetchQuery({
        queryKey: ['student', studentId],
        queryFn: () => studentApi.getById(studentId),
        staleTime: 30000,
      });
      setSelectedStudent(student);
      setDetailFormData(mapStudentToFormData(student));
      setPendingDetailDocument(null);
      setActiveTab('detail');
      setLoadError('');
      setFormError('');
    } catch (error) {
      setLoadError(error.message || 'Unable to open the student profile.');
    }
  };

  const handleDetailDocumentAdd = () => {
    const resolvedDocumentType = detailFormData.documentType === 'Other'
      ? detailFormData.otherDocumentName.trim()
      : detailFormData.documentType;
    if (!resolvedDocumentType || !(pendingDetailDocument?.fileData || pendingDetailDocument?.rawFile)) return;

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
    setFieldErrors((current) => ({ ...current, photoUrl: '' }));
    setDetailFormData((current) => ({
      ...current,
      photoUrl: URL.createObjectURL(file),
    }));
    setLoadError('');
  };

  const handleUpdateStudent = async () => {
    if (!selectedStudent) return;

    const validationErrors = validateStudentForm(detailFormData);
    if (!detailFormData.photoUrl) {
      validationErrors.photoUrl = 'Student photo upload is required.';
    }

    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setLoadError('Please fix the highlighted fields.');
      return;
    }

    setIsUpdatingStudent(true);
    try {
      const pendingDetailFormData = prepareStudentFormDataForSave(detailFormData);
      const resolvedAssignedClass = [pendingDetailFormData.className, pendingDetailFormData.section].filter(Boolean).join(' / ') || pendingDetailFormData.assignedClass || '';
      const uploadedDetailFormData = await uploadStudentAssets({
        ...pendingDetailFormData,
        documents: detailFormData.documents,
      }, pendingDetailPhotoFile);

      const payload = {
        ...pendingDetailFormData,
        ...uploadedDetailFormData,
        assignedClass: resolvedAssignedClass,
        academicYear: pendingDetailFormData.academicYear || selectedStudent.academicYear || currentAcademicYear,
        transportStatus: pendingDetailFormData.transportOptIn === 'yes' ? (pendingDetailFormData.transportStatus || 'active') : 'inactive',
        hostelStatus: pendingDetailFormData.hostelOptIn === 'yes' ? (pendingDetailFormData.hostelStatus || 'active') : 'inactive',
        libraryStatus: pendingDetailFormData.libraryOptIn === 'yes' ? (pendingDetailFormData.libraryStatus || 'active') : 'inactive',
        status: selectedStudent.status || 'Verified',
        regDate: pendingDetailFormData.regDate || today,
        admissionDate: pendingDetailFormData.admissionDate || today,
        enrollmentNo: selectedStudent.enrollmentNo,
        cardExpiryDate: pendingDetailFormData.cardExpiryDate,
      };
      const updatedStudent = await studentApi.update(selectedStudent.id, payload);
      queryClient.setQueryData(['student', updatedStudent.id], updatedStudent);
      await refreshStudentQueries({ studentId: updatedStudent.id, previousClass: selectedStudent.assignedClass, nextClass: updatedStudent.assignedClass });
      setSelectedStudent(updatedStudent);
      setDetailFormData(mapStudentToFormData(updatedStudent));
      setPendingDetailPhotoFile(null);
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Unable to update the student record.');
      setFieldErrors(error.fieldErrors || {});
    } finally {
      setIsUpdatingStudent(false);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f4f7fb_0%,#eef4ff_55%,#f9fbff_100%)] text-slate-900 selection:bg-cyan-500 selection:text-slate-950">
      <div className="border-b border-slate-200/70 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <div className="flex items-center gap-4">
            <button
              onClick={handleNavbarBack}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 transition hover:border-cyan-300 hover:text-cyan-700"
            >
              <ArrowLeft size={14} />
              Back
            </button>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-cyan-600">Student Management</p>
              <h1 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">Enrollment Studio</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
          {activeTab === 'list' ? <QRScannerButton feature="student-management" onResolved={(identity) => handleOpenStudent(identity.id)} /> : null}
          <button
            onClick={() => {
              setActiveTab(activeTab === 'list' ? 'add' : 'list');
              setCurrentStep(1);
              setGeneratedStudent(null);
              setSelectedStudent(null);
              setSelectedClass('');
              setSearchTerm('');
              setDetailFormData(initialFormData);
              setPendingDocument(null);
              setPendingDetailDocument(null);
              setPendingPhotoFile(null);
              setPendingDetailPhotoFile(null);
              setFormError('');
            }}
            className={`inline-flex items-center gap-2 rounded-full px-5 py-3 text-[11px] font-black uppercase tracking-[0.22em] transition ${
              activeTab === 'list'
                ? 'bg-slate-950 text-white shadow-lg shadow-slate-300 hover:bg-cyan-600'
                : 'border border-slate-200 bg-white text-slate-600 hover:border-rose-200 hover:text-rose-600'
            }`}
          >
            {activeTab === 'list' ? <Plus size={14} /> : <X size={14} />}
            {activeTab === 'list' ? 'Add Student' : 'Close Form'}
          </button>
          </div>
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
            students={students}
            classSummaries={classSummaries}
            selectedClass={selectedClass}
            studentPage={studentPage}
            isClassSummaryLoading={classSummaryQuery.isLoading}
            isStudentsLoading={studentsQuery.isLoading || studentsQuery.isFetching}
            viewMode={viewMode}
            setViewMode={setViewMode}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            page={page}
            setPage={setPage}
            pageSize={pageSize}
            setPageSize={(nextSize) => {
              setPageSize(nextSize);
              setPage(0);
            }}
            statusFilter={statusFilter}
            setStatusFilter={(nextStatus) => {
              setStatusFilter(nextStatus);
              setPage(0);
            }}
            sortValue={sortValue}
            setSortValue={(nextSort) => {
              setSortValue(nextSort);
              setPage(0);
            }}
            onSelectClass={(className) => {
              setSelectedClass(className);
              setSearchTerm('');
              setDebouncedSearchTerm('');
              setPage(0);
              setViewMode('table');
            }}
            onBackToClasses={() => {
              setSelectedClass('');
              setSearchTerm('');
              setDebouncedSearchTerm('');
              setPage(0);
              setViewMode('table');
            }}
            onDelete={handleDelete}
            onFacilityToggle={updateStudentFacilities}
            onOpenStudent={handleOpenStudent}
          />
        ) : (
          activeTab === 'detail' && selectedStudent ? (
            <StudentDetailView
              student={selectedStudent}
              formData={detailFormData}
              setFormData={setDetailFormData}
              updateFormField={updateDetailField}
              clearFieldError={(field) => setFieldErrors((current) => ({ ...current, [field]: '' }))}
              fieldErrors={fieldErrors}
              currentAcademicYear={currentAcademicYear}
              classOptions={classOptionsQuery.data || []}
              sectionOptions={detailSectionOptionsQuery.data || []}
              onBack={() => {
                setSelectedStudent(null);
                setDetailFormData(initialFormData);
                setFieldErrors({});
                setActiveTab('list');
              }}
              onSave={handleUpdateStudent}
              isSaving={isUpdatingStudent}
              onDocumentAdd={handleDetailDocumentAdd}
              onDocumentRemove={handleDetailDocumentRemove}
              onDocumentBrowse={handleDetailDocumentBrowse}
              onPhotoBrowse={handleDetailPhotoBrowse}
            />
          ) : generatedStudent ? (
            <GeneratedStudentView
              student={generatedStudent}
              onClose={() => {
                setGeneratedStudent(null);
                setFormData(initialFormData);
                setActiveTab('list');
                setCurrentStep(1);
              }}
            />
          ) : (
            <EnrollmentWizard
              currentStep={currentStep}
              setCurrentStep={handleWizardStepChange}
              formData={formData}
              setFormData={setFormData}
              updateFormField={updateFormField}
              clearFieldError={(field) => setFieldErrors((current) => ({ ...current, [field]: '' }))}
              fieldErrors={fieldErrors}
              handleSave={handleSave}
              draftEnrollmentNo={draftEnrollmentNo}
              draftAssignedClass={draftAssignedClass}
              currentAcademicYear={currentAcademicYear}
              classOptions={classOptionsQuery.data || []}
              sectionOptions={sectionOptionsQuery.data || []}
              sectionsLoading={sectionOptionsQuery.isLoading || sectionOptionsQuery.isFetching}
              handleDocumentAdd={handleDocumentAdd}
              handleDocumentRemove={handleDocumentRemove}
              handleDocumentBrowse={handleDocumentBrowse}
              handlePhotoBrowse={handlePhotoBrowse}
              formError={formError}
            />
          )
        )}
      </div>
      <ConfirmationModal
        open={isConfirmModalOpen}
        studentName={`${formData.firstName || ''} ${formData.lastName || ''}`.trim() || 'this student'}
        studentClass={draftAssignedClass || formData.className || 'Class pending'}
        onCancel={() => {
          if (!isSaving) {
            setIsConfirmModalOpen(false);
          }
        }}
        onConfirm={handleConfirmSave}
        isSaving={isSaving}
      />
      <DeleteStudentModal
        open={Boolean(pendingDeleteStudent)}
        student={pendingDeleteStudent}
        onCancel={() => {
          if (!isDeletingStudent) {
            setPendingDeleteStudent(null);
          }
        }}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeletingStudent}
      />
    </div>
  );
};

const DirectoryView = ({
  students,
  classSummaries,
  selectedClass,
  studentPage,
  isClassSummaryLoading,
  isStudentsLoading,
  viewMode,
  setViewMode,
  searchTerm,
  setSearchTerm,
  page,
  setPage,
  pageSize,
  setPageSize,
  statusFilter,
  setStatusFilter,
  sortValue,
  setSortValue,
  onSelectClass,
  onBackToClasses,
  onDelete,
  onFacilityToggle,
  onOpenStudent,
}) => {
  if (!selectedClass) {
    return (
      <div className="space-y-8">
        <section className="rounded-4xl border border-slate-200/80 bg-white p-5 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">Class Directory</h3>
              <p className="mt-1 text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
                {classSummaries.length} classes | summary loaded from database
              </p>
            </div>

          </div>

          {isClassSummaryLoading ? (
            <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <div key={item} className="h-52 animate-pulse rounded-[1.9rem] border border-slate-200 bg-slate-100" />
              ))}
            </div>
          ) : classSummaries.length > 0 ? (
            <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {classSummaries.map((classItem) => (
                <button
                  key={classItem.name}
                  onClick={() => onSelectClass(classItem.name)}
                  className="group rounded-[1.9rem] border border-slate-200/80 bg-slate-50 p-6 text-left shadow-[0_16px_40px_-30px_rgba(15,23,42,0.35)] transition hover:-translate-y-1 hover:border-cyan-200 hover:bg-white hover:shadow-[0_24px_50px_-30px_rgba(6,182,212,0.35)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#cffafe_0%,#dbeafe_100%)] text-slate-900">
                      <Users size={24} />
                    </div>
                    <ArrowRight className="mt-3 text-slate-300 transition group-hover:translate-x-1 group-hover:text-cyan-600" size={18} />
                  </div>
                  <h4 className="mt-6 font-serif text-2xl font-black italic tracking-tight text-slate-950">{classItem.name}</h4>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-700">
                      {classItem.count} students
                    </span>
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                      {classItem.verified} verified
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-4xl border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-white text-slate-300 shadow-sm">
                <Users size={34} />
              </div>
              <h4 className="mt-6 font-serif text-3xl font-black italic tracking-tight text-slate-950">No classes found</h4>
              <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-500">
                Add a student record with class details to start building the class directory.
              </p>
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
  <div className="space-y-8">
    <section className="rounded-4xl border border-slate-200/80 bg-white p-5 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <button
            onClick={onBackToClasses}
            className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 transition hover:border-cyan-300 hover:text-cyan-700"
          >
            <ArrowLeft size={14} />
            Classes
          </button>
          <h3 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">{selectedClass} Students</h3>
          <p className="mt-1 text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
            {studentPage.totalElements || 0} records in this result
          </p>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative min-w-65">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search name, email, ID, phone..."
              className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-12 py-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-black text-slate-700 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
          >
            <option value="">All Status</option>
            <option value="Verified">Verified</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>

          <select
            value={sortValue}
            onChange={(e) => setSortValue(e.target.value)}
            className="rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-black text-slate-700 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
          >
            <option value="createdAt,desc">Newest Admission</option>
            <option value="createdAt,asc">Oldest Admission</option>
            <option value="name,asc">Name A-Z</option>
            <option value="name,desc">Name Z-A</option>
            <option value="rollNo,asc">Roll Number</option>
            <option value="enrollmentNo,asc">Enrollment Number</option>
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

      {isStudentsLoading && students.length === 0 ? (
        <StudentRowsSkeleton viewMode={viewMode} />
      ) : students.length > 0 ? (
        viewMode === 'grid' ? (
          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {students.map((student) => (
              <StudentCard key={student.id} student={student} onDelete={onDelete} onFacilityToggle={onFacilityToggle} onOpen={onOpenStudent} />
            ))}
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-[1.75rem] border border-slate-200">
            <table className="w-full text-left">
              <thead className="bg-slate-950 text-white">
                <tr className="text-[11px] font-black uppercase tracking-[0.24em]">
                  <th className="px-6 py-4">Student</th>
                  <th className="px-6 py-4">Contact</th>
                  <th className="px-6 py-4">Class / Section</th>
                  <th className="px-6 py-4">Academic Year</th>
                  <th className="px-6 py-4">Facilities</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {students.map((student) => (
                  <tr key={student.id} onClick={() => onOpenStudent(student.id)} className="cursor-pointer transition hover:bg-cyan-50/60">
                    <td className="px-6 py-5">
                      <p className="text-sm font-black text-slate-950">{student.firstName} {student.lastName}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {student.enrollmentNo} | Roll {student.rollNo || 'Pending'}
                      </p>
                    </td>
                    <td className="px-6 py-5 text-sm font-semibold text-slate-600">{student.email || student.mobile || 'Not provided'}</td>
                    <td className="px-6 py-5 text-sm font-semibold text-slate-700">{getStudentClassLabel(student)}</td>
                    <td className="px-6 py-5 text-sm font-black text-slate-700">{student.academicYear || '-'}</td>
                    <td className="px-6 py-5"><FacilitySummary student={student} compact /></td>
                    <td className="px-6 py-5">
                      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                        {student.status || 'Verified'}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(student.id);
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
          <h4 className="mt-6 font-serif text-3xl font-black italic tracking-tight text-slate-950">No matching student records</h4>
          <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-500">
            Clear the search, change the course filter, or create the first student entry for this institution.
          </p>
        </div>
      )}
      {selectedClass ? (
        <div className="mt-5 flex flex-col gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Rows</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 outline-none"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPage(Math.max(page - 1, 0))}
              disabled={page <= 0 || isStudentsLoading}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              Page {(studentPage.page || 0) + 1} of {Math.max(studentPage.totalPages || 1, 1)}
            </span>
            <button
              type="button"
              onClick={() => setPage(page + 1)}
              disabled={page + 1 >= (studentPage.totalPages || 1) || isStudentsLoading}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </section>
  </div>
  );
};

const EnrollmentWizard = ({
  currentStep,
  setCurrentStep,
  formData,
  setFormData,
  updateFormField,
  clearFieldError,
  fieldErrors,
  handleSave,
  draftEnrollmentNo,
  draftAssignedClass,
  currentAcademicYear,
  classOptions,
  sectionOptions,
  sectionsLoading,
  handleDocumentAdd,
  handleDocumentRemove,
  handleDocumentBrowse,
  handlePhotoBrowse,
  formError,
}) => {
  const today = new Date().toISOString().split('T')[0];
  return (
  <div className="grid items-start gap-8 xl:grid-cols-[0.78fr_1.22fr]">
    <aside className="space-y-6 xl:sticky xl:top-8">
      <section className="rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)]">
        <p className="text-[11px] font-black uppercase tracking-[0.3em] text-cyan-600">Enrollment Steps</p>
        <div className="mt-6 space-y-5">
          <TimelineStep step={1} current={currentStep} title="Registration" desc="Basic student record" />
          <TimelineStep step={2} current={currentStep} title="Profile" desc="History and father details" />
          <TimelineStep step={3} current={currentStep} title="Admission" desc="Class, category, facilities" />
          <TimelineStep step={4} current={currentStep} title="Documents" desc="Student locker and uploads" />
          <TimelineStep step={5} current={currentStep} title="ID Generation" desc="Auto ID card and QR" />
        </div>
      </section>

      <section className="overflow-hidden rounded-4xl bg-[linear-gradient(145deg,#082f49_0%,#0f172a_58%,#020617_100%)] p-6 text-white shadow-[0_30px_80px_-40px_rgba(8,47,73,0.8)]">
        <p className="text-[11px] font-black uppercase tracking-[0.28em] text-cyan-300">Live Preview</p>
        <div className="mt-6 rounded-[1.6rem] border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
          <div className="flex items-start justify-between">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-lg font-black uppercase text-cyan-100">
              {(formData.firstName?.[0] || 'N') + (formData.lastName?.[0] || 'S')}
            </div>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200">
              Draft
            </span>
          </div>
          <h3 className="mt-8 font-serif text-3xl font-black italic tracking-tight">
            {formData.firstName || 'New'} {formData.lastName || 'Student'}
          </h3>
          <p className="mt-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-300">
            {draftAssignedClass || 'Class / section pending'}
          </p>
          <div className="mt-8 space-y-3 text-sm text-slate-300">
            <PreviewRow icon={Mail} value={formData.email || 'Email not added'} />
            <PreviewRow icon={Phone} value={formData.mobile || 'Mobile not added'} />
            <PreviewRow icon={IdCard} value={draftEnrollmentNo} />
            <PreviewRow icon={FileText} value={`${formData.documents.length} document(s) added`} />
            <PreviewRow icon={QrCode} value="QR will appear only after final confirmation" />
          </div>
        </div>
      </section>
    </aside>

    <section className="rounded-[2.25rem] border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
      {currentStep === 1 && (
        <div>
          <FormHeader eyebrow="Step 01" title="Student registration" desc="Capture the basic information that creates the student record inside the ERP." />
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <CreativeInput label="First Name" value={formData.firstName} onChange={(e) => updateFormField('firstName', e.target.value)} placeholder="Legal first name" error={fieldErrors.firstName} />
            <CreativeInput label="Last Name" value={formData.lastName} onChange={(e) => updateFormField('lastName', e.target.value)} placeholder="Legal surname" error={fieldErrors.lastName} />
            <EmailOtpField email={formData.email} purpose="STUDENT">{(endAction) => <CreativeInput label="Personal Email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="student@email.com" endAction={endAction} />}</EmailOtpField>
            <CreativeInput label="Mobile Number" value={formData.mobile} onChange={(e) => updateFormField('mobile', e.target.value)} placeholder="9876543210" inputMode="numeric" error={fieldErrors.mobile} />
            <CreativeInput label="Date of Birth" type="date" value={formData.dob} onChange={(e) => updateFormField('dob', e.target.value)} error={fieldErrors.dob} />
            <CreativeInput label="Registration Date" type="date" value={today} readOnly />
            <div className="space-y-3">
              <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">Gender</label>
              <div className="grid grid-cols-3 gap-3">
                {['Male', 'Female', 'Other'].map((gender) => (
                  <button
                    key={gender}
                    type="button"
                    onClick={() => setFormData({ ...formData, gender })}
                    className={`rounded-2xl border-2 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] transition ${
                      formData.gender === gender
                        ? 'border-cyan-500 bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-100'
                        : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-cyan-300 hover:bg-white'
                    }`}
                  >
                    {gender}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <WizardButtons label="Continue to Profile" onNext={() => setCurrentStep(2)} />
        </div>
      )}

      {currentStep === 2 && (
        <div>
          <FormHeader eyebrow="Step 02" title="Profile management" desc="Maintain personal history, category information, father details, and permanent address." />
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <CreativeInput label="Father First Name" value={formData.guardianFirstName} onChange={(e) => updateFormField('guardianFirstName', e.target.value)} placeholder="Father first name" error={fieldErrors.guardianFirstName} />
            <CreativeInput label="Father Last Name (Optional)" value={formData.guardianLastName} onChange={(e) => updateFormField('guardianLastName', e.target.value)} placeholder="Father surname" error={fieldErrors.guardianLastName} />
            <CreativeInput label="Mother First Name" value={formData.motherFirstName} onChange={(e) => updateFormField('motherFirstName', e.target.value)} placeholder="Mother first name" error={fieldErrors.motherFirstName} />
            <CreativeInput label="Mother Last Name (Optional)" value={formData.motherLastName} onChange={(e) => updateFormField('motherLastName', e.target.value)} placeholder="Mother surname" error={fieldErrors.motherLastName} />
            <CreativeInput label="Father Mobile" value={formData.guardianPhone} onChange={(e) => updateFormField('guardianPhone', e.target.value)} placeholder="9876543210" inputMode="numeric" error={fieldErrors.guardianPhone} />
            <CreativeSelect label="Blood Group (Optional)" value={formData.bloodGroup} onChange={(e) => updateFormField('bloodGroup', e.target.value)} options={BLOOD_GROUP_OPTIONS} error={fieldErrors.bloodGroup} />
            <CreativeSelect label="Category" value={formData.category} onChange={(e) => updateFormField('category', e.target.value)} options={CATEGORY_OPTIONS} error={fieldErrors.category} />
            <CreativeInput label="Previous School History (Optional)" value={formData.prevSchool} onChange={(e) => updateFormField('prevSchool', e.target.value)} placeholder="Last school or college" />
            <div className="md:col-span-2">
              <CreativeTextarea label="Permanent Address" value={formData.address} onChange={(e) => updateFormField('address', e.target.value)} placeholder="House number, street, area" error={fieldErrors.address} />
            </div>
            <CreativeInput label="City" value={formData.city} onChange={(e) => updateFormField('city', e.target.value)} placeholder="City" error={fieldErrors.city} />
            <CreativeInput label="Pincode" value={formData.pincode} onChange={(e) => updateFormField('pincode', e.target.value)} placeholder="201301" inputMode="numeric" error={fieldErrors.pincode} />
            <CreativeInput label="State" value={formData.state} onChange={(e) => updateFormField('state', e.target.value)} placeholder="State" error={fieldErrors.state} />
          </div>
          <WizardButtons label="Continue to Admission" onNext={() => setCurrentStep(3)} onBack={() => setCurrentStep(1)} />
        </div>
      )}

      {currentStep === 3 && (
        <div>
          <FormHeader eyebrow="Step 03" title="Admission management" desc="Track the student transition from applicant to enrolled student with institutional assignment data." />
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <CurriculumClassSelect
              label="Class"
              value={formData.classId}
              classes={classOptions}
              error={fieldErrors.className || fieldErrors.classId}
              onChange={(classId) => {
                const selected = classOptions.find((item) => String(item.id) === String(classId));
                const className = selected?.name || '';
                setFormData({ ...formData, classId, sectionId: '', className, section: '', assignedClass: className });
                clearFieldError('className');
                clearFieldError('classId');
              }}
            />
            <CurriculumSectionSelect
              label="Section"
              value={formData.sectionId}
              sections={sectionOptions}
              loading={sectionsLoading}
              error={fieldErrors.section || fieldErrors.sectionId}
              disabled={!formData.classId}
              onChange={(sectionId) => {
                const selected = sectionOptions.find((item) => String(item.sectionId) === String(sectionId));
                const section = selected?.name || '';
                setFormData({ ...formData, sectionId, section, assignedClass: [formData.className, section].filter(Boolean).join(' / ') });
                clearFieldError('section');
                clearFieldError('sectionId');
              }}
            />
            <CreativeSelect label="Admission Category" value={formData.admissionCategory} onChange={(e) => updateFormField('admissionCategory', e.target.value)} options={ADMISSION_CATEGORY_OPTIONS} error={fieldErrors.admissionCategory} />
            <CreativeInput label="Academic Year" value={formData.academicYear || currentAcademicYear} onChange={(e) => updateFormField('academicYear', e.target.value)} placeholder={currentAcademicYear} />
            <CreativeSelect
              label="Transport Facility At Admission"
              value={formData.transportOptIn}
              onChange={(e) => setFormData({
                ...formData,
                transportOptIn: e.target.value,
                transportStatus: e.target.value === 'yes' ? 'active' : 'inactive',
              })}
              options={['Select', 'yes', 'no']}
              error={fieldErrors.transportOptIn}
            />
              <CreativeSelect
                label="Hostel Facility At Admission"
                value={formData.hostelOptIn}
                onChange={(e) => setFormData({
                  ...formData,
                  hostelOptIn: e.target.value,
                  hostelStatus: e.target.value === 'yes' ? 'active' : 'inactive',
                })}
                options={['Select', 'yes', 'no']}
                error={fieldErrors.hostelOptIn}
              />
              <CreativeSelect
                label="Library Facility At Admission"
                value={formData.libraryOptIn}
                onChange={(e) => setFormData({
                  ...formData,
                  libraryOptIn: e.target.value,
                  libraryStatus: e.target.value === 'yes' ? 'active' : 'inactive',
                })}
                options={['Select', 'yes', 'no']}
                error={fieldErrors.libraryOptIn}
              />
          </div>
          <WizardButtons label="Continue to Documents" onNext={() => setCurrentStep(4)} onBack={() => setCurrentStep(2)} />
        </div>
      )}

      {currentStep === 4 && (
        <div>
          <FormHeader eyebrow="Step 04" title="Student documents" desc="Add documents one by one, submit each into the student locker, and continue after the required files are listed below." />
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <CreativeSelect
              label="Document Type"
              value={formData.documentType}
              onChange={(e) => setFormData({ ...formData, documentType: e.target.value })}
              options={['Select', 'Aadhar', 'TC', 'Marksheet', 'Other']}
            />
            {formData.documentType === 'Other' && (
              <CreativeInput
                label="Document Name"
                value={formData.otherDocumentName}
                onChange={(e) => setFormData({ ...formData, otherDocumentName: e.target.value })}
                placeholder="Enter document name"
              />
            )}
            <DocumentUploadField label="File Upload" value={formData.fileUploadPath} onBrowse={handleDocumentBrowse} error={fieldErrors.documents} />
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleDocumentAdd}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.18em] text-white transition hover:bg-cyan-600"
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
              <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-700">
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
                      Ready for student record
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
            onNext={() => setCurrentStep(5)}
            onBack={() => setCurrentStep(3)}
          />
        </div>
      )}

      {currentStep === 5 && (
        <div>
          <FormHeader eyebrow="Step 05" title="Enrollment number generation" desc="Upload the student photo, review the full form, and confirm to generate the QR code with all student details." />
          <div className="mt-8 grid gap-5">
            <DocumentUploadField label="Student Photo Upload" value={formData.photoUrl ? 'Photo selected' : ''} onBrowse={handlePhotoBrowse} error={fieldErrors.photoUrl} />
          </div>

          {formError ? (
            <div className="mt-4 rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
              {formError}
            </div>
          ) : null}

          <div className="mt-8 rounded-4xl border border-slate-200 bg-[linear-gradient(135deg,#ecfeff_0%,#f8fafc_100%)] p-6 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-700">Final Student Review</p>
            <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[1.6rem] bg-slate-950 p-6 text-white">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">Enrollment Card</p>
                    <h3 className="mt-3 font-serif text-3xl font-black italic">
                      {formData.firstName || 'New'} {formData.lastName || 'Student'}
                    </h3>
                    <p className="mt-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-300">
                      {draftAssignedClass || 'Class / section pending'}
                    </p>
                  </div>
                  {formData.photoUrl ? (
                    <img src={formData.photoUrl} alt="Student" className="h-16 w-16 rounded-2xl border border-white/10 object-cover" />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-lg font-black uppercase text-cyan-100">
                      {(formData.firstName?.[0] || 'N') + (formData.lastName?.[0] || 'S')}
                    </div>
                  )}
                </div>
                <div className="mt-8 grid gap-3 text-sm text-slate-300">
                  <PreviewRow icon={IdCard} value={draftEnrollmentNo} />
                  <PreviewRow icon={Mail} value={formData.email || 'Email not added'} />
                  <PreviewRow icon={Phone} value={formData.guardianPhone || 'Father phone not added'} />
                  <PreviewRow icon={Calendar} value={today} />
                </div>
              </div>

              <div className="rounded-[1.6rem] border border-slate-200 bg-white p-6 text-center">
                <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-3xl bg-slate-950 text-cyan-300">
                  <QrCode size={58} />
                </div>
                <p className="mt-5 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">QR Generates After Confirmation</p>
                <p className="mt-3 text-sm font-semibold text-slate-800">Student data will be encoded and saved on submit.</p>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <ReviewCard title="Registration">
              <ReviewLine label="Name" value={`${formData.firstName || '-'} ${formData.lastName || ''}`.trim()} />
              <ReviewLine label="Gender" value={formData.gender || '-'} />
              <ReviewLine label="Email" value={formData.email || '-'} />
              <ReviewLine label="Mobile" value={formData.mobile || '-'} />
              <ReviewLine label="Registration Date" value={today} />
            </ReviewCard>

            <ReviewCard title="Profile">
              <ReviewLine label="Father" value={combineNameParts(formData.guardianFirstName, formData.guardianLastName) || '-'} />
              <ReviewLine label="Mother Name" value={combineNameParts(formData.motherFirstName, formData.motherLastName) || '-'} />
              <ReviewLine label="Blood Group" value={formData.bloodGroup || '-'} />
              <ReviewLine label="Category" value={formData.category || 'Select'} />
              <ReviewLine label="Previous School" value={formData.prevSchool || '-'} />
            </ReviewCard>

            <ReviewCard title="Admission">
              <ReviewLine label="Class" value={formData.className || '-'} />
              <ReviewLine label="Section" value={formData.section || '-'} />
              <ReviewLine label="Admission Category" value={formData.admissionCategory || 'Select'} />
              <ReviewLine label="Academic Year" value={formData.academicYear || currentAcademicYear} />
              <ReviewLine label="Transport" value={formData.transportOptIn === 'yes' ? `Requested | ${formData.transportStatus}` : 'Not requested'} />
              <ReviewLine label="Hostel" value={formData.hostelOptIn === 'yes' ? `Requested | ${formData.hostelStatus}` : 'Not requested'} />
              <ReviewLine label="Library" value={formData.libraryOptIn === 'yes' ? `Requested | ${formData.libraryStatus}` : 'Not requested'} />
            </ReviewCard>

            <ReviewCard title="Documents & ID">
              <ReviewLine label="Total Documents" value={String(formData.documents.length)} />
              <ReviewLine label="Latest Document" value={formData.documents[formData.documents.length - 1]?.documentType || '-'} />
              <ReviewLine label="Latest File" value={formData.documents[formData.documents.length - 1]?.fileUploadPath || '-'} />
              <ReviewLine label="Enrollment No" value={draftEnrollmentNo} />
              <ReviewLine label="Photo" value={formData.photoUrl ? 'Uploaded' : 'Not uploaded'} />
            </ReviewCard>
          </div>

          <WizardButtons
            label="Confirm And Save Student"
            onNext={handleSave}
            onBack={() => setCurrentStep(4)}
            isFinal
            isDisabled={!formData.photoUrl}
          />
        </div>
      )}
    </section>
  </div>
  );
};

const StudentRowsSkeleton = ({ viewMode }) => (
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

const StudentCard = ({ student, onDelete, onFacilityToggle, onOpen }) => (
  <article onClick={() => onOpen(student.id)} className="group cursor-pointer overflow-hidden rounded-[1.9rem] border border-slate-200/80 bg-white p-6 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.35)] transition hover:-translate-y-1 hover:shadow-[0_24px_50px_-28px_rgba(6,182,212,0.35)]">
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-4">
        {student.photoUrl ? (
          <img src={buildImageKitThumbnail(student.photoUrl, 48)} alt={`${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Student'} loading="lazy" className="h-14 w-14 rounded-2xl object-cover" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#cffafe_0%,#dbeafe_100%)] text-lg font-black uppercase text-slate-900">
            {(student.firstName?.[0] || 'N') + (student.lastName?.[0] || 'S')}
          </div>
        )}
        <div>
          <h4 className="text-lg font-black tracking-tight text-slate-950">{student.firstName} {student.lastName}</h4>
          <p className="mt-1 text-[11px] font-black uppercase tracking-[0.18em] text-cyan-700">{student.assignedClass || [student.className, student.section].filter(Boolean).join(' / ') || 'Unassigned'}</p>
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(student.id);
        }}
        className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
      >
        <Trash2 size={16} />
      </button>
    </div>

    <div className="mt-6 grid gap-3 text-sm text-slate-600">
      <PreviewRow icon={Mail} value={student.email || 'No email added'} light />
      <PreviewRow icon={Phone} value={student.mobile || 'No phone added'} light />
      <PreviewRow icon={IdCard} value={student.enrollmentNo || 'Enrollment pending'} light />
    </div>

    <div className="mt-6 rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Facilities</p>
      <div className="mt-3">
        <FacilitySummary student={student} />
      </div>
        <div className="mt-4 space-y-3">
          <FacilityToggleRow
            label="Transport"
            requested={student.transportOptIn === 'yes' || student.transportOptIn === true}
            status={student.transportStatus || 'inactive'}
          onToggle={(e) => {
            e.stopPropagation();
            onFacilityToggle(student.id, {
              transportOptIn: 'yes',
              transportStatus: student.transportStatus === 'active' ? 'inactive' : 'active',
            });
          }}
        />
          <FacilityToggleRow
            label="Hostel"
            requested={student.hostelOptIn === 'yes' || student.hostelOptIn === true}
            status={student.hostelStatus || 'inactive'}
            onToggle={(e) => {
            e.stopPropagation();
            onFacilityToggle(student.id, {
              hostelOptIn: 'yes',
              hostelStatus: student.hostelStatus === 'active' ? 'inactive' : 'active',
              });
            }}
          />
          <FacilityToggleRow
            label="Library"
            requested={student.libraryOptIn === 'yes' || student.libraryOptIn === true}
            status={student.libraryStatus || 'inactive'}
            meta={student.libraryOptIn === 'yes' || student.libraryOptIn === true ? 'Handled in fees management' : 'Not requested yet'}
            onToggle={(e) => {
              e.stopPropagation();
              onFacilityToggle(student.id, {
                libraryOptIn: 'yes',
                libraryStatus: student.libraryStatus === 'active' ? 'inactive' : 'active',
              });
            }}
          />
        </div>
      </div>

    <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Enrollment No</p>
        <p className="mt-1 text-sm font-semibold text-slate-700">{student.enrollmentNo}</p>
      </div>
      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
        {student.status || 'Verified'}
      </span>
    </div>
  </article>
);

const TimelineStep = ({ step, current, title, desc }) => (
  <div className={`flex gap-4 transition ${current >= step ? 'opacity-100' : 'opacity-45'}`}>
    <div
      className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border-2 text-sm font-black transition ${
        current === step
          ? 'border-cyan-500 bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-100'
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
    <p className="text-[11px] font-black uppercase tracking-[0.3em] text-cyan-600">{eyebrow}</p>
    <h2 className="mt-3 font-serif text-4xl font-black italic leading-none tracking-tight text-slate-950">{title}</h2>
    <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-500">{desc}</p>
  </div>
);

const CreativeInput = ({ label, error, endAction, ...props }) => (
  <div className="space-y-2.5">
    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
    <div className="relative">
    <input
      className={`w-full rounded-2xl border-2 bg-slate-50 px-5 py-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-4 ${error ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100' : 'border-slate-200 focus:border-cyan-500 focus:ring-cyan-100'}`}
      style={endAction ? { paddingRight: '8.5rem' } : undefined}
      {...props}
    />
    {endAction}
    </div>
    {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
  </div>
);

const CreativeSelect = ({ label, options, error, ...props }) => (
  <div className="space-y-2.5">
    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
    <select
      className={`w-full rounded-2xl border-2 bg-slate-50 px-5 py-3.5 text-sm font-semibold text-slate-900 outline-none transition focus:bg-white focus:ring-4 ${error ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100' : 'border-slate-200 focus:border-cyan-500 focus:ring-cyan-100'}`}
      {...props}
    >
      {options.map((option) => (
        <option key={option} value={option === 'Select' ? '' : option}>
          {option}
        </option>
      ))}
    </select>
    {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
  </div>
);

const CurriculumClassSelect = ({ label, value, classes, error, onChange }) => (
  <div className="space-y-2.5">
    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
    <select
      value={value || ''}
      onChange={(event) => onChange(event.target.value)}
      className={`w-full rounded-2xl border-2 bg-slate-50 px-5 py-3.5 text-sm font-semibold text-slate-900 outline-none transition focus:bg-white focus:ring-4 ${error ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100' : 'border-slate-200 focus:border-cyan-500 focus:ring-cyan-100'}`}
    >
      <option value="">Select</option>
      {(classes || []).map((option) => (
        <option key={option.id} value={option.id}>{option.name}</option>
      ))}
    </select>
    {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
  </div>
);

const CurriculumSectionSelect = ({ label, value, sections, loading, error, disabled, allowCurrentFullSectionName, onChange }) => (
  <div className="space-y-2.5">
    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
    <select
      value={value || ''}
      disabled={disabled || loading}
      onChange={(event) => onChange(event.target.value)}
      className={`w-full rounded-2xl border-2 bg-slate-50 px-5 py-3.5 text-sm font-semibold text-slate-900 outline-none transition focus:bg-white focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60 ${error ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100' : 'border-slate-200 focus:border-cyan-500 focus:ring-cyan-100'}`}
    >
      <option value="">{loading ? 'Loading...' : 'Select'}</option>
      {(sections || []).map((section) => {
        const isCurrent = allowCurrentFullSectionName && String(section.name || '').toUpperCase() === String(allowCurrentFullSectionName || '').toUpperCase();
        const isFull = Boolean(section.full) && !isCurrent;
        return (
          <option key={section.sectionId} value={section.sectionId} disabled={isFull || section.status === 'INACTIVE'}>
            {section.name} - {isFull ? `Full (${section.studentCount || 0}/${section.capacity || 30})` : `${section.studentCount || 0}/${section.capacity || 30}`}
          </option>
        );
      })}
    </select>
    {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
  </div>
);

const DocumentUploadField = ({ label, value, onBrowse, error }) => (
  <div className="space-y-2.5 md:col-span-2">
    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
    <label className={`flex w-full cursor-pointer items-center justify-between gap-4 rounded-2xl border-2 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-700 transition hover:bg-white ${error ? 'border-rose-400 hover:border-rose-500' : 'border-slate-200 hover:border-cyan-300'}`}>
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
    {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
  </div>
);

const CreativeTextarea = ({ label, error, ...props }) => (
  <div className="space-y-2.5">
    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
    <textarea
      className={`min-h-32 w-full rounded-2xl border-2 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-4 ${error ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100' : 'border-slate-200 focus:border-cyan-500 focus:ring-cyan-100'}`}
      {...props}
    />
    {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
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
          : isFinal
            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100 hover:bg-emerald-700'
            : 'bg-slate-950 text-white shadow-lg shadow-slate-300 hover:bg-cyan-600'
      }`}
    >
      {label}
      <ArrowRight size={14} />
    </button>
  </div>
);

const PreviewRow = ({ icon: Icon, value, light = false }) => (
  <div className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${light ? 'bg-slate-50 text-slate-600' : 'bg-white/5 text-slate-200'}`}>
    <Icon size={15} className={light ? 'text-cyan-700' : 'text-cyan-300'} />
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

const FacilitySummary = ({ student, compact = false }) => {
  const transportRequested = student.transportOptIn === 'yes' || student.transportOptIn === true;
  const hostelRequested = student.hostelOptIn === 'yes' || student.hostelOptIn === true;
  const libraryRequested = student.libraryOptIn === 'yes' || student.libraryOptIn === true;
  const classes = compact ? 'space-y-1 text-xs font-bold text-slate-600' : 'space-y-1 text-sm font-semibold text-slate-700';

  return (
    <div className={classes}>
      <div>Transport: {transportRequested ? (student.transportStatus || 'inactive') : 'not requested'}</div>
      <div>Hostel: {hostelRequested ? (student.hostelStatus || 'inactive') : 'not requested'}</div>
      <div>Library: {libraryRequested ? (student.libraryStatus || 'inactive') : 'not requested'}</div>
    </div>
  );
};

const FacilityToggleRow = ({ label, requested, status, meta, onToggle }) => (
  <div className="flex items-center justify-between gap-3">
    <div>
      <p className="text-sm font-black text-slate-900">{label}</p>
      <p className="text-xs font-semibold text-slate-500">{requested ? `Requested | ${status}${meta ? ` | ${meta}` : ''}` : 'Not requested yet'}</p>
    </div>
    <button
      type="button"
      onClick={onToggle}
      className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] transition ${status === 'active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
    >
      {status === 'active' ? 'Deactivate' : 'Activate'}
    </button>
  </div>
);

export default StudentManagement;

function normalizeStudentFieldValue(field, value) {
  const rawValue = String(value ?? '');

  if (field === 'mobile' || field === 'guardianPhone') {
    return rawValue.replace(/\D/g, '').slice(0, 10);
  }

  if (field === 'pincode') {
    return rawValue.replace(/\D/g, '').slice(0, 6);
  }

  if (UPPERCASE_STUDENT_FIELDS.has(field)) {
    return rawValue.toUpperCase();
  }

  return value;
}

function validateStudentForm(formData, options = {}) {
  const errors = {
    ...validateStudentStep(1, formData),
    ...validateStudentStep(2, formData),
    ...validateStudentStep(3, formData),
  };

  if (options.requireDocuments && (!formData.documents || formData.documents.length === 0)) {
    errors.documents = 'At least one student document is required.';
  }

  return errors;
}

function validateStudentStep(step, formData) {
  const errors = {};

  if (step === 1) {
    if (!String(formData.firstName || '').trim()) {
      errors.firstName = 'First name is required.';
    }

    if (!String(formData.dob || '').trim()) {
      errors.dob = 'Date of birth is required.';
    }

    if (!String(formData.mobile || '').trim()) {
      errors.mobile = 'Student mobile number is required.';
    }
  }

  if (formData.mobile && !/^\d{10}$/.test(formData.mobile)) {
    errors.mobile = 'Student mobile number must be exactly 10 digits.';
  }

  if (step === 2) {
    if (!String(formData.guardianFirstName || '').trim()) {
      errors.guardianFirstName = 'Father first name is required.';
    }

    if (!String(formData.motherFirstName || '').trim()) {
      errors.motherFirstName = 'Mother first name is required.';
    }

    if (!String(formData.guardianPhone || '').trim()) {
      errors.guardianPhone = 'Father mobile number is required.';
    }

    if (!String(formData.category || '').trim()) {
      errors.category = 'Category is required.';
    }

    if (!String(formData.address || '').trim()) {
      errors.address = 'Permanent address is required.';
    }

    if (!String(formData.city || '').trim()) {
      errors.city = 'City is required.';
    }

    if (!String(formData.pincode || '').trim()) {
      errors.pincode = 'Pincode is required.';
    }

    if (!String(formData.state || '').trim()) {
      errors.state = 'State is required.';
    }
  }

  if (formData.guardianPhone && !/^\d{10}$/.test(formData.guardianPhone)) {
    errors.guardianPhone = 'Father mobile number must be exactly 10 digits.';
  }

  if (formData.pincode && !/^\d{6}$/.test(formData.pincode)) {
    errors.pincode = 'Pincode must be exactly 6 digits.';
  }

  if (step === 3) {
    if (!String(formData.className || '').trim()) {
      errors.className = 'Class is required.';
    }

    if (!String(formData.section || '').trim()) {
      errors.section = 'Section is required.';
    }

    if (!String(formData.admissionCategory || '').trim()) {
      errors.admissionCategory = 'Admission category is required.';
    }

    if (!String(formData.transportOptIn || '').trim()) {
      errors.transportOptIn = 'Select transport facility option.';
    }

    if (!String(formData.hostelOptIn || '').trim()) {
      errors.hostelOptIn = 'Select hostel facility option.';
    }

    if (!String(formData.libraryOptIn || '').trim()) {
      errors.libraryOptIn = 'Select library facility option.';
    }
  }

  if (step === 4 && (!formData.documents || formData.documents.length === 0)) {
    errors.documents = 'At least one student document is required.';
  }

  return errors;
}

function combineNameParts(firstName, lastName) {
  return [firstName, lastName].map((value) => String(value || '').trim()).filter(Boolean).join(' ');
}

function splitNameParts(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' '),
  };
}

function getStudentClassLabel(student) {
  return student.assignedClass || [student.className, student.section].filter(Boolean).join(' / ') || 'Unassigned';
}

function buildImageKitThumbnail(url, size = 48) {
  if (!url) {
    return url;
  }

  const transformation = `tr=w-${size},h-${size},c-at_max`;
  return url.includes('?') ? `${url}&${transformation}` : `${url}?${transformation}`;
}

function mapStudentToFormData(student) {
  return {
    ...initialFormData,
    firstName: student.firstName || '',
    lastName: student.lastName || '',
    dob: student.dob || '',
    gender: student.gender || 'Male',
    email: student.email || '',
    mobile: student.mobile || '',
    regDate: student.regDate || '',
    bloodGroup: student.bloodGroup || '',
    address: student.address || '',
    city: student.city || '',
    pincode: student.pincode || '',
    state: student.state || '',
    guardianName: student.guardianName || '',
    guardianFirstName: splitNameParts(student.guardianName).firstName,
    guardianLastName: splitNameParts(student.guardianName).lastName,
    motherName: student.motherName || '',
    motherFirstName: splitNameParts(student.motherName).firstName,
    motherLastName: splitNameParts(student.motherName).lastName,
    guardianPhone: student.guardianPhone || '',
    prevSchool: student.prevSchool || '',
    category: student.category || '',
    admissionDate: student.admissionDate || '',
    academicYear: student.academicYear || '',
    classId: student.classId || '',
    sectionId: student.sectionId || '',
    className: student.className || '',
    section: student.section || '',
    assignedClass: student.assignedClass || '',
    admissionCategory: student.admissionCategory || '',
    transportOptIn: student.transportOptIn || 'no',
    hostelOptIn: student.hostelOptIn || 'no',
    libraryOptIn: student.libraryOptIn || 'no',
    transportStatus: student.transportStatus || 'inactive',
    hostelStatus: student.hostelStatus || 'inactive',
    libraryStatus: student.libraryStatus || 'inactive',
    documentType: student.documentType || '',
    otherDocumentName: student.otherDocumentName || '',
    fileUploadPath: '',
    documents: (student.documents || []).map((document) => normalizeStoredDocument(document)),
    qrCodeData: student.qrCodeData || '',
    cardExpiryDate: student.cardExpiryDate || '',
    photoUrl: student.photoUrl || '',
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

async function uploadStudentAssets(formData, pendingPhotoFile) {
  const uploadedPhoto = pendingPhotoFile
    ? await uploadApi.uploadFile(pendingPhotoFile, '/erp/students/photos')
    : null;
  const uploadedDocuments = await Promise.all(
    (formData.documents || []).map((document) => uploadStudentDocument(document))
  );

  return {
    ...formData,
    photoUrl: uploadedPhoto?.url || formData.photoUrl,
    fileUploadPath: '',
    documents: uploadedDocuments,
  };
}

function prepareStudentFormDataForSave(formData) {
  const guardianName = combineNameParts(formData.guardianFirstName, formData.guardianLastName) || formData.guardianName;
  const motherName = combineNameParts(formData.motherFirstName, formData.motherLastName) || formData.motherName;

  return {
    ...formData,
    guardianName,
    motherName,
    documents: (formData.documents || []).map((document) => stripPendingFile(document)),
    fileUploadPath: '',
  };
}

async function uploadStudentDocument(document) {
  if (!document?.rawFile) {
    return stripPendingFile(document);
  }

  const uploadedFile = await uploadApi.uploadFile(document.rawFile, '/erp/students/documents');
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

function resolveCurrentAcademicYear(preferences = {}) {
  if (preferences.academicYear) return String(preferences.academicYear).toUpperCase();

  const startMonth = monthNameToNumber(preferences.academicYearStartMonth || 'April');
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const startYear = currentMonth >= startMonth ? now.getFullYear() : now.getFullYear() - 1;
  return `${startYear}-${startYear + 1}`;
}

function getDefaultAcademicYear() {
  return resolveCurrentAcademicYear({ academicYearStartMonth: 'April' });
}

function monthNameToNumber(monthName) {
  const index = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ].findIndex((month) => month.toLowerCase() === String(monthName || '').toLowerCase());

  return index >= 0 ? index + 1 : 4;
}

function StudentDetailView({
  student,
  formData,
  setFormData,
  updateFormField,
  clearFieldError,
  fieldErrors,
  currentAcademicYear,
  classOptions,
  sectionOptions,
  onBack,
  onSave,
  isSaving,
  onDocumentAdd,
  onDocumentRemove,
  onDocumentBrowse,
  onPhotoBrowse,
}) {
  const qrImage = useQrCodeDataUrl(student.qrCodeData);
  const fullName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Student';

  return (
    <div className="space-y-8">
      <section className="rounded-[2.25rem] border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-cyan-600">Student Profile</p>
            <h2 className="mt-3 font-serif text-4xl font-black italic tracking-tight text-slate-950">{fullName}</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-500">
              View every saved detail, update the student record, and download the QR code that is already linked to this profile.
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
                await downloadQrCode(student.qrCodeData, fullName);
              }}
              className="inline-flex items-center gap-2 rounded-2xl border-2 border-cyan-200 bg-cyan-50 px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-cyan-800 transition hover:border-cyan-300 hover:bg-cyan-100"
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
              <ReviewLine label="Enrollment No" value={student.enrollmentNo || '-'} />
              <ReviewLine label="Roll No" value={student.rollNo || '-'} />
              <ReviewLine label="Status" value={student.status || 'Verified'} />
            </ReviewCard>

            <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Editable Details</p>
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <CreativeInput label="First Name" value={formData.firstName} onChange={(e) => updateFormField('firstName', e.target.value)} error={fieldErrors.firstName} />
                <CreativeInput label="Last Name" value={formData.lastName} onChange={(e) => updateFormField('lastName', e.target.value)} error={fieldErrors.lastName} />
                <CreativeInput label="Date of Birth" type="date" value={formData.dob} onChange={(e) => updateFormField('dob', e.target.value)} error={fieldErrors.dob} />
                <CreativeSelect label="Gender" value={formData.gender} onChange={(e) => setFormData({ ...formData, gender: e.target.value })} options={['Male', 'Female', 'Other']} />
                <EmailOtpField email={formData.email} purpose="STUDENT" disabled={!(String(formData.email || '').trim().toLowerCase() !== String(student.email || '').trim().toLowerCase())}>{(endAction) => <CreativeInput label="Email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} endAction={endAction} />}</EmailOtpField>
                <CreativeInput label="Mobile" value={formData.mobile} onChange={(e) => updateFormField('mobile', e.target.value)} inputMode="numeric" error={fieldErrors.mobile} />
                <CreativeInput label="Father First Name" value={formData.guardianFirstName} onChange={(e) => updateFormField('guardianFirstName', e.target.value)} error={fieldErrors.guardianFirstName} />
                <CreativeInput label="Father Last Name (Optional)" value={formData.guardianLastName} onChange={(e) => updateFormField('guardianLastName', e.target.value)} error={fieldErrors.guardianLastName} />
                <CreativeInput label="Mother First Name" value={formData.motherFirstName} onChange={(e) => updateFormField('motherFirstName', e.target.value)} error={fieldErrors.motherFirstName} />
                <CreativeInput label="Mother Last Name (Optional)" value={formData.motherLastName} onChange={(e) => updateFormField('motherLastName', e.target.value)} error={fieldErrors.motherLastName} />
                <CreativeInput label="Father Phone" value={formData.guardianPhone} onChange={(e) => updateFormField('guardianPhone', e.target.value)} inputMode="numeric" error={fieldErrors.guardianPhone} />
                <CreativeSelect label="Blood Group (Optional)" value={formData.bloodGroup} onChange={(e) => updateFormField('bloodGroup', e.target.value)} options={BLOOD_GROUP_OPTIONS} />
                <CreativeSelect label="Category" value={formData.category} onChange={(e) => updateFormField('category', e.target.value)} options={CATEGORY_OPTIONS} error={fieldErrors.category} />
                <CreativeInput label="Previous School" value={formData.prevSchool} onChange={(e) => updateFormField('prevSchool', e.target.value)} />
                <CreativeInput label="Registration Date" type="date" value={formData.regDate} onChange={(e) => setFormData({ ...formData, regDate: e.target.value })} />
                <CurriculumClassSelect
                  label="Class"
                  value={formData.classId}
                  classes={classOptions}
                  error={fieldErrors.className || fieldErrors.classId}
                  onChange={(classId) => {
                    const selected = classOptions.find((item) => String(item.id) === String(classId));
                    const className = selected?.name || '';
                    setFormData({ ...formData, classId, sectionId: '', className, section: '', assignedClass: className });
                    clearFieldError('className');
                    clearFieldError('classId');
                  }}
                />
                <CurriculumSectionSelect
                  label="Section"
                  value={formData.sectionId}
                  sections={sectionOptions}
                  error={fieldErrors.section || fieldErrors.sectionId}
                  disabled={!formData.classId}
                  allowCurrentFullSectionName={student.section}
                  onChange={(sectionId) => {
                    const selected = sectionOptions.find((item) => String(item.sectionId) === String(sectionId));
                    const section = selected?.name || '';
                    setFormData({ ...formData, sectionId, section, assignedClass: [formData.className, section].filter(Boolean).join(' / ') });
                    clearFieldError('section');
                    clearFieldError('sectionId');
                  }}
                />
                <CreativeSelect label="Admission Category" value={formData.admissionCategory} onChange={(e) => updateFormField('admissionCategory', e.target.value)} options={ADMISSION_CATEGORY_OPTIONS} error={fieldErrors.admissionCategory} />
                <CreativeInput label="Academic Year" value={formData.academicYear || currentAcademicYear} onChange={(e) => updateFormField('academicYear', e.target.value)} />
                <CreativeSelect label="Transport Requested" value={formData.transportOptIn} onChange={(e) => setFormData({ ...formData, transportOptIn: e.target.value, transportStatus: e.target.value === 'yes' ? formData.transportStatus : 'inactive' })} options={['yes', 'no']} />
                <CreativeSelect label="Transport Status" value={formData.transportStatus} onChange={(e) => setFormData({ ...formData, transportStatus: e.target.value })} options={['active', 'inactive']} />
                <CreativeSelect label="Hostel Requested" value={formData.hostelOptIn} onChange={(e) => setFormData({ ...formData, hostelOptIn: e.target.value, hostelStatus: e.target.value === 'yes' ? formData.hostelStatus : 'inactive' })} options={['yes', 'no']} />
                <CreativeSelect label="Hostel Status" value={formData.hostelStatus} onChange={(e) => setFormData({ ...formData, hostelStatus: e.target.value })} options={['active', 'inactive']} />
                <CreativeSelect label="Library Requested" value={formData.libraryOptIn} onChange={(e) => setFormData({ ...formData, libraryOptIn: e.target.value, libraryStatus: e.target.value === 'yes' ? formData.libraryStatus : 'inactive' })} options={['yes', 'no']} />
                <CreativeSelect label="Library Status" value={formData.libraryStatus} onChange={(e) => setFormData({ ...formData, libraryStatus: e.target.value })} options={['active', 'inactive']} />
                <div className="md:col-span-2">
                  <CreativeTextarea label="Permanent Address" value={formData.address} onChange={(e) => updateFormField('address', e.target.value)} error={fieldErrors.address} />
                </div>
                <CreativeInput label="City" value={formData.city} onChange={(e) => updateFormField('city', e.target.value)} error={fieldErrors.city} />
                <CreativeInput label="Pincode" value={formData.pincode} onChange={(e) => updateFormField('pincode', e.target.value)} inputMode="numeric" error={fieldErrors.pincode} />
                <CreativeInput label="State" value={formData.state} onChange={(e) => updateFormField('state', e.target.value)} error={fieldErrors.state} />
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Documents And Photo</p>
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <CreativeSelect label="Document Type" value={formData.documentType} onChange={(e) => setFormData({ ...formData, documentType: e.target.value })} options={['Select', 'Aadhar', 'TC', 'Marksheet', 'Other']} />
                {formData.documentType === 'Other' ? (
                  <CreativeInput label="Document Name" value={formData.otherDocumentName} onChange={(e) => setFormData({ ...formData, otherDocumentName: e.target.value })} />
                ) : <div />}
                <DocumentUploadField label="Attach Document" value={formData.fileUploadPath} onBrowse={onDocumentBrowse} />
              </div>
              <div className="mt-4 flex justify-end">
                <button type="button" onClick={onDocumentAdd} className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-white transition hover:bg-cyan-600">
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
                            className="rounded-xl px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-700 transition hover:bg-cyan-50"
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
                <DocumentUploadField label="Student Photo" value={formData.photoUrl ? 'Photo selected' : ''} onBrowse={onPhotoBrowse} />
              </div>
            </div>
          </div>

          <div className="space-y-6 xl:sticky xl:top-8">
            <div className="rounded-[1.75rem] border border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#ecfeff_100%)] p-6 text-center">
              {formData.photoUrl ? (
                <img src={formData.photoUrl} alt={fullName} className="mx-auto h-28 w-28 rounded-3xl border border-slate-200 object-cover shadow-sm" />
              ) : (
                <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-3xl border border-slate-200 bg-white text-2xl font-black uppercase text-cyan-700 shadow-sm">
                  {(formData.firstName?.[0] || 'N') + (formData.lastName?.[0] || 'S')}
                </div>
              )}
              <img src={qrImage} alt="Saved student QR code" className="mx-auto mt-6 h-72 w-72 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm" />
              <p className="mt-4 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">{student.enrollmentNo} | Roll {student.rollNo || '-'}</p>
              <p className="mt-3 text-sm font-semibold text-slate-700">This QR is linked with the saved record and can be downloaded anytime.</p>
            </div>

            <ReviewCard title="Saved Snapshot">
              <ReviewLine label="Assigned Class" value={formData.assignedClass || [formData.className, formData.section].filter(Boolean).join(' / ') || '-'} />
              <ReviewLine label="Email" value={formData.email || '-'} />
              <ReviewLine label="Mobile" value={formData.mobile || '-'} />
              <ReviewLine label="Father" value={formData.guardianName || '-'} />
              <ReviewLine label="Documents" value={String(formData.documents.length)} />
            </ReviewCard>
          </div>
        </div>
      </section>
    </div>
  );
}

function GeneratedStudentView({ student, onClose }) {
  const qrImage = useQrCodeDataUrl(student.qrCodeData);

  return (
    <div className="rounded-[2.25rem] border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
      <FormHeader eyebrow="Saved" title="Student QR generated" desc="The student record is saved and the QR payload is stored in the database." />
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[1.8rem] border border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#ecfeff_100%)] p-6 text-center">
          <img src={qrImage} alt="Student QR" className="mx-auto h-72 w-72 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm" />
          <p className="mt-4 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">{student.enrollmentNo} | Roll {student.rollNo}</p>
          <p className="mt-3 text-sm font-semibold text-slate-700">Form data has been cleared. Scan this QR to access the saved student payload.</p>
        </div>
        <div className="space-y-4">
          <ReviewCard title="Student Summary">
            <ReviewLine label="Name" value={`${student.firstName || ''} ${student.lastName || ''}`.trim() || '-'} />
            <ReviewLine label="Class" value={student.className || '-'} />
            <ReviewLine label="Section" value={student.section || '-'} />
            <ReviewLine label="Assigned" value={student.assignedClass || '-'} />
          </ReviewCard>
          <button onClick={onClose} className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-white transition hover:bg-cyan-600">
            Back To Student List
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmationModal({ open, studentName, studentClass, onCancel, onConfirm, isSaving }) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-md">
      <div className="w-full max-w-lg rounded-4xl border border-white/30 bg-white/92 p-7 shadow-[0_30px_90px_-30px_rgba(15,23,42,0.5)]">
        <p className="text-[11px] font-black uppercase tracking-[0.28em] text-cyan-700">Final Confirmation</p>
        <h3 className="mt-3 font-serif text-3xl font-black italic tracking-tight text-slate-950">Generate student QR and lock this admission?</h3>
        <p className="mt-4 text-sm leading-7 text-slate-600">
          This will save <span className="font-black text-slate-900">{studentName}</span> for <span className="font-black text-slate-900">{studentClass}</span>, clear the form from the screen, and show the final QR code only after confirmation.
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
            {isSaving ? 'Saving Student...' : 'Yes, Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteStudentModal({ open, student, onCancel, onConfirm, isDeleting }) {
  if (!open) {
    return null;
  }

  const studentName = `${student?.firstName || ''} ${student?.lastName || ''}`.trim() || 'this student';
  const classLabel = getStudentClassLabel(student || {});

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-md">
      <div className="w-full max-w-md rounded-4xl border border-white/30 bg-white/95 p-7 text-center shadow-[0_30px_90px_-30px_rgba(15,23,42,0.55)]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
          <Trash2 size={24} />
        </div>
        <p className="mt-5 text-[11px] font-black uppercase tracking-[0.28em] text-rose-600">Delete Student</p>
        <h3 className="mt-3 font-serif text-3xl font-black italic tracking-tight text-slate-950">Are you sure?</h3>
        <p className="mt-4 text-sm leading-7 text-slate-600">
          This will permanently delete <span className="font-black text-slate-900">{studentName}</span>
          {classLabel !== 'Unassigned' ? <span> from <span className="font-black text-slate-900">{classLabel}</span></span> : null}.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="inline-flex flex-1 items-center justify-center rounded-2xl border-2 border-slate-200 bg-white px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="inline-flex flex-1 items-center justify-center rounded-2xl bg-rose-600 px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-300"
          >
            {isDeleting ? 'Deleting...' : 'Yes, Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
