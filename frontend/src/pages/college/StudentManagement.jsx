import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  MapPin,
  Phone,
  Plus,
  QrCode,
  Search,
  Download,
  Eye,
  EyeOff,
  Save,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { studentApi, uploadApi } from '../../utils/api';

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
  guardianName: '',
  motherName: '',
  guardianPhone: '',
  prevSchool: '',
  category: '',
  admissionDate: '',
  enrollmentNo: '',
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
  libraryMonthlyCharge: '0',
  studentPortalPassword: '',
  documentType: '',
  otherDocumentName: '',
  fileUploadPath: '',
  documents: [],
  qrCodeData: '',
  cardExpiryDate: '',
  photoUrl: '',
};

const CATEGORY_OPTIONS = ['Select', 'Gen', 'OBC', 'SC', 'ST', 'EWS', 'Minority'];
const ADMISSION_CATEGORY_OPTIONS = ['Select', 'Regular', 'Lateral Entry', 'Transfer', 'Scholarship'];
const SECTION_OPTIONS = ['Select', 'A', 'B', 'C', 'D'];

const StudentManagement = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('list');
  const [currentStep, setCurrentStep] = useState(1);
  const [students, setStudents] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [formData, setFormData] = useState(initialFormData);
  const [generatedStudent, setGeneratedStudent] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [detailFormData, setDetailFormData] = useState(initialFormData);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingStudent, setIsUpdatingStudent] = useState(false);
  const [formError, setFormError] = useState('');
  const [pendingDocument, setPendingDocument] = useState(null);
  const [pendingDetailDocument, setPendingDetailDocument] = useState(null);
  const [pendingPhotoFile, setPendingPhotoFile] = useState(null);
  const [pendingDetailPhotoFile, setPendingDetailPhotoFile] = useState(null);

  useEffect(() => {
    const loadStudents = async () => {
      try {
        const apiStudents = await studentApi.getAll();
        setStudents(apiStudents);
        setLoadError('');
      } catch (error) {
        setStudents([]);
        setLoadError(error.message || 'Unable to load students from the server.');
      }
    };

    loadStudents();
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const draftEnrollmentNo = 'Auto-generated from institute short name and admission number';
  const draftAssignedClass = [formData.className, formData.section].filter(Boolean).join(' / ');
  const draftSystemId = formData.enrollmentNo ? `EDU-${formData.enrollmentNo}` : 'EDU-AUTO-ID';
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
    setFormData((current) => ({
      ...current,
      photoUrl: URL.createObjectURL(file),
    }));
  };

  const handleSave = () => {
    if (!formData.photoUrl) {
      setFormError('Student photo upload is required before confirmation.');
      return;
    }

    setFormError('');
    setIsConfirmModalOpen(true);
  };

  const handleConfirmSave = async () => {
    setIsSaving(true);

    try {
      const pendingFormData = prepareStudentFormDataForSave(formData);
      const studentId = `EDU-${Math.floor(1000 + Math.random() * 9000)}`;
      const resolvedAssignedClass = draftAssignedClass || pendingFormData.assignedClass || '';
      const resolvedPortalPassword = pendingFormData.studentPortalPassword.trim() || buildDefaultPortalPassword(pendingFormData);
      const resolvedQrCodeData = buildStudentQrPayload({
        ...pendingFormData,
        assignedClass: resolvedAssignedClass,
        studentPortalPassword: resolvedPortalPassword,
        registrationDate: today,
        admissionDate: today,
        systemId: studentId,
      });
      const newStudent = {
        ...pendingFormData,
        className: pendingFormData.className,
        section: pendingFormData.section,
        assignedClass: resolvedAssignedClass,
        transportStatus: pendingFormData.transportOptIn === 'yes' ? pendingFormData.transportStatus : 'inactive',
        hostelStatus: pendingFormData.hostelOptIn === 'yes' ? pendingFormData.hostelStatus : 'inactive',
        libraryStatus: pendingFormData.libraryOptIn === 'yes' ? pendingFormData.libraryStatus : 'inactive',
        libraryMonthlyCharge: pendingFormData.libraryOptIn === 'yes' ? pendingFormData.libraryMonthlyCharge : '0',
        facilities: {
          transport: {
            requested: pendingFormData.transportOptIn === 'yes',
            active: pendingFormData.transportOptIn === 'yes' && pendingFormData.transportStatus === 'active',
            status: pendingFormData.transportOptIn === 'yes' ? pendingFormData.transportStatus : 'inactive',
          },
          hostel: {
            requested: pendingFormData.hostelOptIn === 'yes',
            active: pendingFormData.hostelOptIn === 'yes' && pendingFormData.hostelStatus === 'active',
            status: pendingFormData.hostelOptIn === 'yes' ? pendingFormData.hostelStatus : 'inactive',
          },
          library: {
            requested: pendingFormData.libraryOptIn === 'yes',
            active: pendingFormData.libraryOptIn === 'yes' && pendingFormData.libraryStatus === 'active',
            status: pendingFormData.libraryOptIn === 'yes' ? pendingFormData.libraryStatus : 'inactive',
            monthlyCharge: pendingFormData.libraryOptIn === 'yes' ? pendingFormData.libraryMonthlyCharge : '0',
          },
        },
        systemId: studentId,
        qrCodeData: resolvedQrCodeData,
        studentPortalPassword: resolvedPortalPassword,
        status: 'Verified',
      };
      const savedStudent = await studentApi.create(newStudent);
      const savedQrCodeData = buildStudentQrPayload({
        ...newStudent,
        enrollmentNo: savedStudent.enrollmentNo,
        systemId: savedStudent.systemId,
      });
      const qrReadyStudent = await studentApi.update(savedStudent.id, {
        ...newStudent,
        enrollmentNo: savedStudent.enrollmentNo,
        systemId: savedStudent.systemId,
        qrCodeData: savedQrCodeData,
      });
      const uploadedFormData = await uploadStudentAssets({
        ...newStudent,
        enrollmentNo: qrReadyStudent.enrollmentNo,
        systemId: qrReadyStudent.systemId,
        qrCodeData: qrReadyStudent.qrCodeData,
        documents: formData.documents,
      }, pendingPhotoFile);
      const finalizedStudent = await studentApi.update(qrReadyStudent.id, {
        ...newStudent,
        ...uploadedFormData,
        enrollmentNo: qrReadyStudent.enrollmentNo,
        systemId: qrReadyStudent.systemId,
        qrCodeData: qrReadyStudent.qrCodeData,
      });
      const updatedStudents = [finalizedStudent, ...students];
      setStudents(updatedStudents);
      setGeneratedStudent(finalizedStudent);
      setFormData(initialFormData);
      setPendingPhotoFile(null);
      setCurrentStep(1);
      setIsConfirmModalOpen(false);
      setLoadError('');
      setFormError('');
    } catch (error) {
      setLoadError(error.message || 'Unable to save the student record.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (studentId) => {
    const shouldDelete = window.confirm('Delete this student record?');
    if (!shouldDelete) return;

    try {
      await studentApi.delete(studentId);
      const updated = students.filter((student) => student.id !== studentId);
      setStudents(updated);
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Unable to delete the student record.');
    }
  };

  const updateStudentFacilities = async (studentId, updates) => {
    try {
      const updatedStudent = await studentApi.updateFacilities(studentId, updates);
      const updated = students.map((student) => (student.id === studentId ? updatedStudent : student));
      setStudents(updated);
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Unable to update student facilities.');
    }
  };

  const handleOpenStudent = async (studentId) => {
    try {
      const student = await studentApi.getById(studentId);
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
    setDetailFormData((current) => ({
      ...current,
      photoUrl: URL.createObjectURL(file),
    }));
    setLoadError('');
  };

  const handleUpdateStudent = async () => {
    if (!selectedStudent) return;
    if (!detailFormData.photoUrl) {
      setLoadError('Student photo is required to update the profile.');
      return;
    }

    setIsUpdatingStudent(true);
    try {
      const pendingDetailFormData = prepareStudentFormDataForSave(detailFormData);
      const resolvedAssignedClass = [pendingDetailFormData.className, pendingDetailFormData.section].filter(Boolean).join(' / ') || pendingDetailFormData.assignedClass || '';
      const resolvedPortalPassword = pendingDetailFormData.studentPortalPassword.trim() || buildDefaultPortalPassword(pendingDetailFormData);
      const resolvedQrCodeData = buildStudentQrPayload({
        ...pendingDetailFormData,
        assignedClass: resolvedAssignedClass,
        studentPortalPassword: resolvedPortalPassword,
        registrationDate: pendingDetailFormData.regDate,
        admissionDate: pendingDetailFormData.admissionDate,
        systemId: selectedStudent.systemId,
      });

      const payload = {
        ...pendingDetailFormData,
        assignedClass: resolvedAssignedClass,
        transportStatus: pendingDetailFormData.transportOptIn === 'yes' ? pendingDetailFormData.transportStatus : 'inactive',
        hostelStatus: pendingDetailFormData.hostelOptIn === 'yes' ? pendingDetailFormData.hostelStatus : 'inactive',
        libraryStatus: pendingDetailFormData.libraryOptIn === 'yes' ? pendingDetailFormData.libraryStatus : 'inactive',
        libraryMonthlyCharge: pendingDetailFormData.libraryOptIn === 'yes' ? pendingDetailFormData.libraryMonthlyCharge : '0',
        studentPortalPassword: resolvedPortalPassword,
        qrCodeData: resolvedQrCodeData,
        status: selectedStudent.status || 'Verified',
        regDate: pendingDetailFormData.regDate || today,
        admissionDate: pendingDetailFormData.admissionDate || today,
        enrollmentNo: selectedStudent.enrollmentNo,
        cardExpiryDate: pendingDetailFormData.cardExpiryDate,
      };
      const updatedStudent = await studentApi.update(selectedStudent.id, payload);
      const uploadedDetailFormData = await uploadStudentAssets({
        ...payload,
        documents: detailFormData.documents,
      }, pendingDetailPhotoFile);
      const finalizedStudent = await studentApi.update(updatedStudent.id, {
        ...payload,
        ...uploadedDetailFormData,
        enrollmentNo: updatedStudent.enrollmentNo,
        systemId: updatedStudent.systemId,
      });
      const updatedStudents = students.map((student) => (student.id === finalizedStudent.id ? finalizedStudent : student));
      setStudents(updatedStudents);
      setSelectedStudent(finalizedStudent);
      setDetailFormData(mapStudentToFormData(finalizedStudent));
      setPendingDetailPhotoFile(null);
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Unable to update the student record.');
    } finally {
      setIsUpdatingStudent(false);
    }
  };

  const classSummaries = Array.from(
    students.reduce((classMap, student) => {
      const className = getStudentClassLabel(student);
      const current = classMap.get(className) || { name: className, count: 0, verified: 0 };
      classMap.set(className, {
        ...current,
        count: current.count + 1,
        verified: current.verified + (student.status === 'Verified' ? 1 : 0),
      });
      return classMap;
    }, new Map()).values()
  ).sort((firstClass, secondClass) => firstClass.name.localeCompare(secondClass.name));

  const filteredStudents = students.filter((student) => {
    const studentClass = getStudentClassLabel(student);
    const matchesClass = selectedClass && studentClass === selectedClass;
    const fullName = `${student.firstName} ${student.lastName}`.toLowerCase();
    const searchValue = searchTerm.toLowerCase();
    const matchesSearch =
      !searchValue ||
      fullName.includes(searchValue) ||
      student.email?.toLowerCase().includes(searchValue) ||
      student.systemId?.toLowerCase().includes(searchValue) ||
      studentClass.toLowerCase().includes(searchValue);
    return matchesClass && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f4f7fb_0%,#eef4ff_55%,#f9fbff_100%)] text-slate-900 selection:bg-cyan-500 selection:text-slate-950">
      <div className="border-b border-slate-200/70 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/college')}
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
            filteredStudents={filteredStudents}
            viewMode={viewMode}
            setViewMode={setViewMode}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            onSelectClass={(className) => {
              setSelectedClass(className);
              setSearchTerm('');
            }}
            onBackToClasses={() => {
              setSelectedClass('');
              setSearchTerm('');
            }}
            onCreate={() => setActiveTab('add')}
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
              onBack={() => {
                setSelectedStudent(null);
                setDetailFormData(initialFormData);
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
              setCurrentStep={setCurrentStep}
              formData={formData}
              setFormData={setFormData}
              handleSave={handleSave}
              draftSystemId={draftSystemId}
              draftAssignedClass={draftAssignedClass}
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
    </div>
  );
};

const DirectoryView = ({
  students,
  classSummaries,
  selectedClass,
  filteredStudents,
  viewMode,
  setViewMode,
  searchTerm,
  setSearchTerm,
  onSelectClass,
  onBackToClasses,
  onCreate,
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
                {classSummaries.length} classes | {students.length} student records
              </p>
            </div>

            <button
              onClick={onCreate}
              className="inline-flex items-center gap-2 self-start rounded-full bg-slate-950 px-5 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-white transition hover:bg-cyan-600 lg:self-auto"
            >
              <Plus size={14} />
              Add Student
            </button>
          </div>

          {classSummaries.length > 0 ? (
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
              <button
                onClick={onCreate}
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-white transition hover:bg-cyan-600"
              >
                <Plus size={14} />
                Create Student
              </button>
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
            {filteredStudents.length} records visible
          </p>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative min-w-65">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search name, email, ID, class..."
              className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-12 py-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
            />
          </div>

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

      {filteredStudents.length > 0 ? (
        viewMode === 'grid' ? (
          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredStudents.map((student) => (
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
                  <th className="px-6 py-4">Facilities</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredStudents.map((student) => (
                  <tr key={student.id} onClick={() => onOpenStudent(student.id)} className="cursor-pointer transition hover:bg-cyan-50/60">
                    <td className="px-6 py-5">
                      <p className="text-sm font-black text-slate-950">{student.firstName} {student.lastName}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {student.enrollmentNo} | Roll {student.rollNo || 'Pending'}
                      </p>
                    </td>
                    <td className="px-6 py-5 text-sm font-semibold text-slate-600">{student.email || student.mobile || 'Not provided'}</td>
                    <td className="px-6 py-5 text-sm font-semibold text-slate-700">{getStudentClassLabel(student)}</td>
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
          <button
            onClick={onCreate}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-white transition hover:bg-cyan-600"
          >
            <Plus size={14} />
            Create Student
          </button>
        </div>
      )}
    </section>
  </div>
  );
};

const EnrollmentWizard = ({
  currentStep,
  setCurrentStep,
  formData,
  setFormData,
  handleSave,
  draftSystemId,
  draftAssignedClass,
  handleDocumentAdd,
  handleDocumentRemove,
  handleDocumentBrowse,
  handlePhotoBrowse,
  formError,
}) => {
  const today = new Date().toISOString().split('T')[0];
  const draftEnrollmentNo = 'Auto-generated from institute short name and admission number';

  return (
  <div className="grid items-start gap-8 xl:grid-cols-[0.78fr_1.22fr]">
    <aside className="space-y-6 xl:sticky xl:top-8">
      <section className="rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)]">
        <p className="text-[11px] font-black uppercase tracking-[0.3em] text-cyan-600">Enrollment Steps</p>
        <div className="mt-6 space-y-5">
          <TimelineStep step={1} current={currentStep} title="Registration" desc="Basic student record" />
          <TimelineStep step={2} current={currentStep} title="Profile" desc="History and guardian details" />
          <TimelineStep step={3} current={currentStep} title="Admission" desc="Class, category, enrollment" />
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
            <PreviewRow icon={IdCard} value={draftSystemId} />
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
            <CreativeInput label="First Name" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} placeholder="Legal first name" />
            <CreativeInput label="Last Name" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} placeholder="Legal surname" />
            <CreativeInput label="Personal Email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="student@email.com" />
            <CreativeInput label="Mobile Number" value={formData.mobile} onChange={(e) => setFormData({ ...formData, mobile: e.target.value })} placeholder="+91 98XXX XXXXX" />
            <CreativeInput label="Date of Birth" type="date" value={formData.dob} onChange={(e) => setFormData({ ...formData, dob: e.target.value })} />
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
          <FormHeader eyebrow="Step 02" title="Profile management" desc="Maintain personal history, category information, guardian details, and permanent address." />
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <CreativeInput label="Guardian Name" value={formData.guardianName} onChange={(e) => setFormData({ ...formData, guardianName: e.target.value })} placeholder="Parent or guardian" />
            <CreativeInput label="Mother Name" value={formData.motherName} onChange={(e) => setFormData({ ...formData, motherName: e.target.value })} placeholder="Mother full name" />
            <CreativeInput label="Guardian Phone" value={formData.guardianPhone} onChange={(e) => setFormData({ ...formData, guardianPhone: e.target.value })} placeholder="+91 98XXX XXXXX" />
            <CreativeInput label="Blood Group (Optional)" value={formData.bloodGroup} onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })} placeholder="A+, O-, AB+" />
            <CreativeSelect label="Category" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} options={CATEGORY_OPTIONS} />
            <CreativeInput label="Previous School History (Optional)" value={formData.prevSchool} onChange={(e) => setFormData({ ...formData, prevSchool: e.target.value })} placeholder="Last school or college" />
            <div className="md:col-span-2">
              <CreativeTextarea label="Permanent Address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder="House number, street, area, city" />
            </div>
          </div>
          <WizardButtons label="Continue to Admission" onNext={() => setCurrentStep(3)} onBack={() => setCurrentStep(1)} />
        </div>
      )}

      {currentStep === 3 && (
        <div>
          <FormHeader eyebrow="Step 03" title="Admission management" desc="Track the student transition from applicant to enrolled student with institutional assignment data." />
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <CreativeInput label="Admission Date" type="date" value={today} readOnly />
            <CreativeInput label="Enrollment Number" value={draftEnrollmentNo} readOnly />
            <CreativeInput label="Class" value={formData.className} onChange={(e) => setFormData({ ...formData, className: e.target.value, assignedClass: [e.target.value, formData.section].filter(Boolean).join(' / ') })} placeholder="B.Tech CSE" />
            <CreativeSelect label="Section" value={formData.section} onChange={(e) => setFormData({ ...formData, section: e.target.value === 'Select' ? '' : e.target.value, assignedClass: [formData.className, e.target.value === 'Select' ? '' : e.target.value].filter(Boolean).join(' / ') })} options={SECTION_OPTIONS} />
            <CreativeSelect label="Admission Category" value={formData.admissionCategory} onChange={(e) => setFormData({ ...formData, admissionCategory: e.target.value })} options={ADMISSION_CATEGORY_OPTIONS} />
            <CreativeSelect
              label="Transport Facility At Admission"
              value={formData.transportOptIn}
              onChange={(e) => setFormData({
                ...formData,
                transportOptIn: e.target.value,
                transportStatus: e.target.value === 'yes' ? formData.transportStatus : 'inactive',
              })}
              options={['Select', 'yes', 'no']}
            />
              <CreativeSelect
                label="Hostel Facility At Admission"
                value={formData.hostelOptIn}
                onChange={(e) => setFormData({
                  ...formData,
                  hostelOptIn: e.target.value,
                  hostelStatus: e.target.value === 'yes' ? formData.hostelStatus : 'inactive',
                })}
                options={['Select', 'yes', 'no']}
              />
              <CreativeSelect
                label="Library Facility At Admission"
                value={formData.libraryOptIn}
                onChange={(e) => setFormData({
                  ...formData,
                  libraryOptIn: e.target.value,
                  libraryStatus: e.target.value === 'yes' ? formData.libraryStatus : 'inactive',
                  libraryMonthlyCharge: e.target.value === 'yes' ? formData.libraryMonthlyCharge : '0',
                })}
                options={['Select', 'yes', 'no']}
              />
              {formData.transportOptIn === 'yes' && (
                <CreativeSelect
                  label="Transport Status"
                value={formData.transportStatus}
                onChange={(e) => setFormData({ ...formData, transportStatus: e.target.value })}
                options={['active', 'inactive']}
              />
            )}
              {formData.hostelOptIn === 'yes' && (
                <CreativeSelect
                  label="Hostel Status"
                  value={formData.hostelStatus}
                  onChange={(e) => setFormData({ ...formData, hostelStatus: e.target.value })}
                  options={['active', 'inactive']}
                />
              )}
              {formData.libraryOptIn === 'yes' && (
                <>
                  <CreativeSelect
                    label="Library Status"
                    value={formData.libraryStatus}
                    onChange={(e) => setFormData({ ...formData, libraryStatus: e.target.value })}
                    options={['active', 'inactive']}
                  />
                  <CreativeInput
                    label="Library Monthly Charge"
                    type="number"
                    min="0"
                    value={formData.libraryMonthlyCharge}
                    onChange={(e) => setFormData({ ...formData, libraryMonthlyCharge: e.target.value })}
                    placeholder="500"
                  />
                </>
              )}
            <div className="md:col-span-2">
              <CreativeInput
                label="Student Portal Password"
                type="password"
                value={formData.studentPortalPassword}
                onChange={(e) => setFormData({ ...formData, studentPortalPassword: e.target.value })}
                placeholder="Optional. Default: guardian phone first 6 digits + birth year"
              />
            </div>
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
            <DocumentUploadField label="File Upload" value={formData.fileUploadPath} onBrowse={handleDocumentBrowse} />
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
            onNext={() => {
              if (formData.documents.length > 0) setCurrentStep(5);
            }}
            onBack={() => setCurrentStep(3)}
            isDisabled={formData.documents.length === 0}
          />
        </div>
      )}

      {currentStep === 5 && (
        <div>
          <FormHeader eyebrow="Step 05" title="Student ID generation" desc="Upload the student photo, review the full form, and confirm to generate the QR code with all student details." />
          <div className="mt-8 grid gap-5">
            <DocumentUploadField label="Student Photo Upload" value={formData.photoUrl ? 'Photo selected' : ''} onBrowse={handlePhotoBrowse} />
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
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">Student ID Card</p>
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
                  <PreviewRow icon={IdCard} value={draftSystemId} />
                  <PreviewRow icon={Mail} value={formData.email || 'Email not added'} />
                  <PreviewRow icon={Phone} value={formData.guardianPhone || 'Guardian phone not added'} />
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
              <ReviewLine label="Guardian" value={formData.guardianName || '-'} />
              <ReviewLine label="Mother Name" value={formData.motherName || '-'} />
              <ReviewLine label="Blood Group" value={formData.bloodGroup || '-'} />
              <ReviewLine label="Category" value={formData.category || 'Select'} />
              <ReviewLine label="Previous School" value={formData.prevSchool || '-'} />
            </ReviewCard>

            <ReviewCard title="Admission">
              <ReviewLine label="Class" value={formData.className || '-'} />
              <ReviewLine label="Section" value={formData.section || '-'} />
              <ReviewLine label="Enrollment" value={draftEnrollmentNo} />
              <ReviewLine label="Admission Date" value={today} />
              <ReviewLine label="Admission Category" value={formData.admissionCategory || 'Select'} />
              <ReviewLine label="Transport" value={formData.transportOptIn === 'yes' ? `Requested | ${formData.transportStatus}` : 'Not requested'} />
              <ReviewLine label="Hostel" value={formData.hostelOptIn === 'yes' ? `Requested | ${formData.hostelStatus}` : 'Not requested'} />
              <ReviewLine label="Library" value={formData.libraryOptIn === 'yes' ? `Requested | ${formData.libraryStatus} | Rs ${formData.libraryMonthlyCharge}/month` : 'Not requested'} />
              <ReviewLine
                label="Portal Password"
                value={formData.studentPortalPassword || buildDefaultPortalPassword(formData)}
              />
            </ReviewCard>

            <ReviewCard title="Documents & ID">
              <ReviewLine label="Total Documents" value={String(formData.documents.length)} />
              <ReviewLine label="Latest Document" value={formData.documents[formData.documents.length - 1]?.documentType || '-'} />
              <ReviewLine label="Latest File" value={formData.documents[formData.documents.length - 1]?.fileUploadPath || '-'} />
              <ReviewLine label="System ID" value={draftSystemId} />
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

const StudentCard = ({ student, onDelete, onFacilityToggle, onOpen }) => (
  <article onClick={() => onOpen(student.id)} className="group cursor-pointer overflow-hidden rounded-[1.9rem] border border-slate-200/80 bg-white p-6 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.35)] transition hover:-translate-y-1 hover:shadow-[0_24px_50px_-28px_rgba(6,182,212,0.35)]">
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#cffafe_0%,#dbeafe_100%)] text-lg font-black uppercase text-slate-900">
          {(student.firstName?.[0] || 'N') + (student.lastName?.[0] || 'S')}
        </div>
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
      <PreviewRow icon={MapPin} value={student.address || 'Address not available'} light />
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
            meta={student.libraryOptIn === 'yes' || student.libraryOptIn === true ? `Rs ${student.libraryMonthlyCharge || '0'}/month` : 'Not requested yet'}
            onToggle={(e) => {
              e.stopPropagation();
              onFacilityToggle(student.id, {
                libraryOptIn: 'yes',
                libraryStatus: student.libraryStatus === 'active' ? 'inactive' : 'active',
                libraryMonthlyCharge: student.libraryMonthlyCharge || '0',
              });
            }}
          />
        </div>
      </div>

    <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">System ID</p>
        <p className="mt-1 text-sm font-semibold text-slate-700">{student.systemId}</p>
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

const CreativeInput = ({ label, ...props }) => (
  <div className="space-y-2.5">
    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
    <input
      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
      {...props}
    />
  </div>
);

const CreativeSelect = ({ label, options, ...props }) => (
  <div className="space-y-2.5">
    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
    <select
      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-3.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
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
    <label className="flex w-full cursor-pointer items-center justify-between gap-4 rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-700 transition hover:border-cyan-300 hover:bg-white">
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

const CreativeTextarea = ({ label, ...props }) => (
  <div className="space-y-2.5">
    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
    <textarea
      className="min-h-32 w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
      {...props}
    />
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
      <div>Library: {libraryRequested ? `${student.libraryStatus || 'inactive'} | Rs ${student.libraryMonthlyCharge || '0'}/month` : 'not requested'}</div>
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

function buildDefaultPortalPassword(formData) {
  const guardianDigits = String(formData.guardianPhone || '').replace(/\D/g, '');
  const firstSix = guardianDigits.slice(0, 6).padEnd(6, '0');
  const year = formData.dob ? String(formData.dob).slice(0, 4) : '0000';
  return `${firstSix}${year}`;
}

function getStudentClassLabel(student) {
  return student.assignedClass || [student.className, student.section].filter(Boolean).join(' / ') || 'Unassigned';
}

function buildStudentQrPayload(student) {
  const fullName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Student';
  const documentSummary = (student.documents || [])
    .map((document) => document.documentType || document.fileName || document.fileUploadPath)
    .filter(Boolean)
    .join(', ');

  return [
    'ERP STUDENT PROFILE',
    `Name: ${fullName}`,
    `Student ID: ${student.systemId || 'N/A'}`,
    `Enrollment No: ${student.enrollmentNo || 'N/A'}`,
    `Class: ${student.assignedClass || student.className || 'N/A'}`,
    `Section: ${student.section || 'N/A'}`,
    `DOB: ${student.dob || 'N/A'}`,
    `Gender: ${student.gender || 'N/A'}`,
    `Mobile: ${student.mobile || 'N/A'}`,
    `Email: ${student.email || 'N/A'}`,
    `Guardian: ${student.guardianName || 'N/A'}`,
    `Guardian Phone: ${student.guardianPhone || 'N/A'}`,
    `Blood Group: ${student.bloodGroup || 'N/A'}`,
    `Admission Date: ${student.admissionDate || 'N/A'}`,
    `Documents: ${documentSummary || 'N/A'}`,
  ].join('\n');
}

function createQrImageUrl(value) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=512x512&margin=16&data=${encodeURIComponent(value || 'student')}`;
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
    guardianName: student.guardianName || '',
    motherName: student.motherName || '',
    guardianPhone: student.guardianPhone || '',
    prevSchool: student.prevSchool || '',
    category: student.category || '',
    admissionDate: student.admissionDate || '',
    enrollmentNo: student.enrollmentNo || '',
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
    libraryMonthlyCharge: student.libraryMonthlyCharge || '0',
    studentPortalPassword: student.studentPortalPassword || '',
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
  return {
    ...formData,
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

function StudentDetailView({
  student,
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
  const qrImage = createQrImageUrl(student.qrCodeData);
  const fullName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Student';
  const [showPortalPassword, setShowPortalPassword] = useState(false);

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
              <ReviewLine label="System ID" value={student.systemId || '-'} />
              <ReviewLine label="Enrollment" value={student.enrollmentNo || '-'} />
              <ReviewLine label="Roll No" value={student.rollNo || '-'} />
              <ReviewLine label="Status" value={student.status || 'Verified'} />
            </ReviewCard>

            <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Editable Details</p>
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <CreativeInput label="First Name" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} />
                <CreativeInput label="Last Name" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} />
                <CreativeInput label="Date of Birth" type="date" value={formData.dob} onChange={(e) => setFormData({ ...formData, dob: e.target.value })} />
                <CreativeSelect label="Gender" value={formData.gender} onChange={(e) => setFormData({ ...formData, gender: e.target.value })} options={['Male', 'Female', 'Other']} />
                <CreativeInput label="Email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                <CreativeInput label="Mobile" value={formData.mobile} onChange={(e) => setFormData({ ...formData, mobile: e.target.value })} />
                <CreativeInput label="Guardian Name" value={formData.guardianName} onChange={(e) => setFormData({ ...formData, guardianName: e.target.value })} />
                <CreativeInput label="Mother Name" value={formData.motherName} onChange={(e) => setFormData({ ...formData, motherName: e.target.value })} />
                <CreativeInput label="Guardian Phone" value={formData.guardianPhone} onChange={(e) => setFormData({ ...formData, guardianPhone: e.target.value })} />
                <CreativeInput label="Blood Group" value={formData.bloodGroup} onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })} />
                <CreativeSelect label="Category" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} options={CATEGORY_OPTIONS} />
                <CreativeInput label="Previous School" value={formData.prevSchool} onChange={(e) => setFormData({ ...formData, prevSchool: e.target.value })} />
                <CreativeInput label="Registration Date" type="date" value={formData.regDate} onChange={(e) => setFormData({ ...formData, regDate: e.target.value })} />
                <CreativeInput label="Admission Date" type="date" value={formData.admissionDate} onChange={(e) => setFormData({ ...formData, admissionDate: e.target.value })} />
                <CreativeInput label="Class" value={formData.className} onChange={(e) => setFormData({ ...formData, className: e.target.value, assignedClass: [e.target.value, formData.section].filter(Boolean).join(' / ') })} />
                <CreativeSelect label="Section" value={formData.section} onChange={(e) => setFormData({ ...formData, section: e.target.value, assignedClass: [formData.className, e.target.value].filter(Boolean).join(' / ') })} options={SECTION_OPTIONS.filter((option) => option !== 'Select')} />
                <CreativeSelect label="Admission Category" value={formData.admissionCategory} onChange={(e) => setFormData({ ...formData, admissionCategory: e.target.value })} options={ADMISSION_CATEGORY_OPTIONS} />
                <div className="space-y-2.5">
                  <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">Portal Password</label>
                  <div className="relative">
                    <input
                      type={showPortalPassword ? 'text' : 'password'}
                      value={formData.studentPortalPassword}
                      onChange={(e) => setFormData({ ...formData, studentPortalPassword: e.target.value })}
                      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-3.5 pr-14 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
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
                <CreativeSelect label="Transport Requested" value={formData.transportOptIn} onChange={(e) => setFormData({ ...formData, transportOptIn: e.target.value, transportStatus: e.target.value === 'yes' ? formData.transportStatus : 'inactive' })} options={['yes', 'no']} />
                <CreativeSelect label="Transport Status" value={formData.transportStatus} onChange={(e) => setFormData({ ...formData, transportStatus: e.target.value })} options={['active', 'inactive']} />
                <CreativeSelect label="Hostel Requested" value={formData.hostelOptIn} onChange={(e) => setFormData({ ...formData, hostelOptIn: e.target.value, hostelStatus: e.target.value === 'yes' ? formData.hostelStatus : 'inactive' })} options={['yes', 'no']} />
                <CreativeSelect label="Hostel Status" value={formData.hostelStatus} onChange={(e) => setFormData({ ...formData, hostelStatus: e.target.value })} options={['active', 'inactive']} />
                <CreativeSelect label="Library Requested" value={formData.libraryOptIn} onChange={(e) => setFormData({ ...formData, libraryOptIn: e.target.value, libraryStatus: e.target.value === 'yes' ? formData.libraryStatus : 'inactive', libraryMonthlyCharge: e.target.value === 'yes' ? formData.libraryMonthlyCharge : '0' })} options={['yes', 'no']} />
                <CreativeSelect label="Library Status" value={formData.libraryStatus} onChange={(e) => setFormData({ ...formData, libraryStatus: e.target.value })} options={['active', 'inactive']} />
                <CreativeInput label="Library Monthly Charge" type="number" min="0" value={formData.libraryMonthlyCharge} onChange={(e) => setFormData({ ...formData, libraryMonthlyCharge: e.target.value })} />
                <div className="md:col-span-2">
                  <CreativeTextarea label="Address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
                </div>
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
              <ReviewLine label="Guardian" value={formData.guardianName || '-'} />
              <ReviewLine label="Documents" value={String(formData.documents.length)} />
            </ReviewCard>
          </div>
        </div>
      </section>
    </div>
  );
}

function GeneratedStudentView({ student, onClose }) {
  const qrImage = createQrImageUrl(student.qrCodeData);

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
            <ReviewLine label="Portal Password" value={student.studentPortalPassword || '-'} />
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
