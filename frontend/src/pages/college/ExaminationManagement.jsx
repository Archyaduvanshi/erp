import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Download,
  Eye,
  FileText,
  Printer,
  ScrollText,
  Search,
  Ticket,
  Trash2,
  X,
} from 'lucide-react';
import { courseBookApi, examApi, studentApi, teacherApi } from '../../utils/api';

const initialDateSheetForm = {
  className: '',
  classFrom: '',
  classTo: '',
  sectionWise: false,
  examType: '',
  shiftsPerDay: '',
  shiftStartTimes: [''],
  shiftDurationHours: '',
  shiftDurationUnit: '',
  shiftStartMeridians: [''],
  examStartDate: '',
  examEndDate: '',
  fileName: '',
  fileData: '',
  fileType: '',
};

const initialAdmitCardForm = {
  examTitle: '',
  studentId: '',
  rollNo: '',
  className: '',
  centerName: '',
  reportingTime: '',
  examDate: '',
};

function FieldError({ text }) {
  return text ? <p className="text-xs font-semibold text-rose-600">{text}</p> : null;
}

const ExaminationManagement = () => {
  const navigate = useNavigate();
  const [session] = useState(() => JSON.parse(localStorage.getItem('active_session')) || null);
  const [activeSection, setActiveSection] = useState('home');
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [courseBooks, setCourseBooks] = useState([]);
  const [dateSheets, setDateSheets] = useState([]);
  const [questionPapers, setQuestionPapers] = useState([]);
  const [admitCards, setAdmitCards] = useState([]);
  const [dateSheetForm, setDateSheetForm] = useState(initialDateSheetForm);
  const [admitCardForm, setAdmitCardForm] = useState(initialAdmitCardForm);
  const [dateSheetSearch, setDateSheetSearch] = useState('');
  const [questionSearch, setQuestionSearch] = useState('');
  const [selectedQuestionPaperClass, setSelectedQuestionPaperClass] = useState('');
  const [selectedQuestionPaperExamType, setSelectedQuestionPaperExamType] = useState('');
  const [selectedQuestionPaperSubject, setSelectedQuestionPaperSubject] = useState('');
  const [admitSearch, setAdmitSearch] = useState('');
  const [loadError, setLoadError] = useState('');
  const [dateSheetFieldErrors, setDateSheetFieldErrors] = useState({});
  const [admitCardFieldErrors, setAdmitCardFieldErrors] = useState({});
  const [templatePreview, setTemplatePreview] = useState(null);
  const [questionPaperPreview, setQuestionPaperPreview] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      await refreshData();
    };

    loadData();
  }, []);

  const refreshData = async () => {
    try {
      const [studentResponse, teacherResponse, courseBookResponse, dateSheetResponse, questionPaperResponse, admitCardResponse] = await Promise.all([
        studentApi.getAll(),
        teacherApi.getAll(),
        courseBookApi.getAll(),
        examApi.getDateSheets(),
        examApi.getQuestionPapers(),
        examApi.getAdmitCards(),
      ]);
      setStudents(studentResponse);
      setTeachers(teacherResponse);
      setCourseBooks(courseBookResponse);
      setDateSheets(dateSheetResponse);
      setQuestionPapers(questionPaperResponse);
      setAdmitCards(admitCardResponse);
      setLoadError('');
    } catch (error) {
      setStudents([]);
      setTeachers([]);
      setCourseBooks([]);
      setDateSheets([]);
      setQuestionPapers([]);
      setAdmitCards([]);
      setLoadError(error.message || 'Unable to load examination records.');
    }
  };

  const availableClasses = useMemo(() => {
    const classes = [
      ...students.map((student) => normalizeClassValue(student.assignedClass || student.className)),
      ...teachers.map((teacher) => normalizeClassValue(teacher.assignedClass || teacher.className)),
      ...dateSheets.map((record) => normalizeClassValue(record.className)),
      ...questionPapers.map((record) => normalizeClassValue(record.className)),
      ...admitCards.map((record) => normalizeClassValue(record.className)),
    ];

    const uniqueClasses = [...new Set(classes.filter(Boolean))];
    return uniqueClasses.length
      ? uniqueClasses.sort((a, b) => a.localeCompare(b))
      : fallbackExamClasses;
  }, [admitCards, dateSheets, questionPapers, students, teachers]);

  const availableBaseClasses = useMemo(() => (
    [...new Set(availableClasses.map((className) => parseClassDescriptor(className).baseClass).filter(Boolean))]
  ), [availableClasses]);

  const subjectsByClass = useMemo(() => {
    return courseBooks.reduce((accumulator, record) => {
      const className = normalizeClassValue(record.className);
      const subjectName = formatExamFormText(record.subjectName).trim();
      if (!className || !subjectName) return accumulator;

      const exactKeys = [
        className,
        normalizeExamClassLabel(className),
        parseClassDescriptor(className).baseClass,
      ].filter(Boolean);

      exactKeys.forEach((key) => {
        const normalizedKey = normalizeExamClassLabel(key);
        if (!normalizedKey) return;
        if (!accumulator[normalizedKey]) accumulator[normalizedKey] = new Set();
        accumulator[normalizedKey].add(subjectName);
      });

      return accumulator;
    }, {});
  }, [courseBooks]);

  const availableExamTitles = useMemo(() => {
    const examTitles = [
      ...dateSheets.map((record) => record.examType),
      ...questionPapers.map((record) => record.examTitle),
      ...admitCards.map((record) => record.examTitle),
    ].filter(Boolean);
    return [...new Set(examTitles)].sort((a, b) => a.localeCompare(b));
  }, [admitCards, dateSheets, questionPapers]);

  const filteredDateSheets = useMemo(() => {
    const query = dateSheetSearch.trim().toLowerCase();
    return dateSheets.filter((record) => {
      if (!query) return true;
      return (
        record.className?.toLowerCase().includes(query) ||
        record.examType?.toLowerCase().includes(query) ||
        record.fileName?.toLowerCase().includes(query)
      );
    });
  }, [dateSheetSearch, dateSheets]);

  const filteredQuestionPapers = useMemo(() => {
    const query = questionSearch.trim().toLowerCase();
    return questionPapers.filter((record) => {
      if (!query) return true;
      return (
        record.examTitle?.toLowerCase().includes(query) ||
        record.className?.toLowerCase().includes(query) ||
        record.subjectName?.toLowerCase().includes(query) ||
        record.uploadedBy?.toLowerCase().includes(query) ||
        record.fileName?.toLowerCase().includes(query)
      );
    });
  }, [questionPapers, questionSearch]);

  const questionPaperClasses = useMemo(() => (
    [...new Set(filteredQuestionPapers.map((record) => normalizeClassValue(record.className)).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b))
  ), [filteredQuestionPapers]);

  const activeQuestionPaperClass = useMemo(() => {
    if (!questionPaperClasses.length) return '';
    return selectedQuestionPaperClass && questionPaperClasses.includes(selectedQuestionPaperClass)
      ? selectedQuestionPaperClass
      : questionPaperClasses[0];
  }, [questionPaperClasses, selectedQuestionPaperClass]);

  const questionPaperExamTypes = useMemo(() => (
    [...new Set(
      filteredQuestionPapers
        .filter((record) => record.className === activeQuestionPaperClass)
        .map((record) => String(record.examTitle || '').trim())
        .filter(Boolean),
    )].sort((a, b) => a.localeCompare(b))
  ), [activeQuestionPaperClass, filteredQuestionPapers]);

  const activeQuestionPaperExamType = useMemo(() => {
    if (!questionPaperExamTypes.length) return '';
    return selectedQuestionPaperExamType && questionPaperExamTypes.includes(selectedQuestionPaperExamType)
      ? selectedQuestionPaperExamType
      : '';
  }, [questionPaperExamTypes, selectedQuestionPaperExamType]);

  const questionPaperSubjects = useMemo(() => (
    [...new Set(
      filteredQuestionPapers
        .filter((record) => record.className === activeQuestionPaperClass)
        .filter((record) => record.examTitle === activeQuestionPaperExamType)
        .map((record) => String(record.subjectName || '').trim())
        .filter(Boolean),
    )].sort((a, b) => a.localeCompare(b))
  ), [activeQuestionPaperClass, activeQuestionPaperExamType, filteredQuestionPapers]);

  const activeQuestionPaperSubject = useMemo(() => {
    if (!questionPaperSubjects.length) return '';
    return selectedQuestionPaperSubject && questionPaperSubjects.includes(selectedQuestionPaperSubject)
      ? selectedQuestionPaperSubject
      : questionPaperSubjects[0];
  }, [questionPaperSubjects, selectedQuestionPaperSubject]);

  const visibleQuestionPapers = useMemo(() => (
    filteredQuestionPapers
      .filter((record) => record.className === activeQuestionPaperClass)
      .filter((record) => record.examTitle === activeQuestionPaperExamType)
      .filter((record) => !activeQuestionPaperSubject || record.subjectName === activeQuestionPaperSubject)
      .sort((a, b) => String(a.subjectName || '').localeCompare(String(b.subjectName || '')))
  ), [activeQuestionPaperClass, activeQuestionPaperExamType, activeQuestionPaperSubject, filteredQuestionPapers]);

  const filteredAdmitCards = useMemo(() => {
    const query = admitSearch.trim().toLowerCase();
    return admitCards.filter((record) => {
      if (!query) return true;
      return (
        record.examTitle?.toLowerCase().includes(query) ||
        record.studentName?.toLowerCase().includes(query) ||
        record.rollNo?.toLowerCase().includes(query) ||
        record.className?.toLowerCase().includes(query) ||
        record.centerName?.toLowerCase().includes(query)
      );
    });
  }, [admitCards, admitSearch]);

  const dateSheetMap = useMemo(() => (
    filteredDateSheets.reduce((accumulator, record) => {
      accumulator[record.className] = record;
      return accumulator;
    }, {})
  ), [filteredDateSheets]);

  const saveDateSheetRecord = async (payload) => {
    await examApi.saveDateSheet(payload);
  };

  const handleGenerateDateSheetTemplate = async () => {
    const validationErrors = validateDateSheetForm(dateSheetForm);
    if (Object.keys(validationErrors).length) {
      setDateSheetFieldErrors(validationErrors);
      setLoadError('');
      return;
    }

    const rangeLabel = buildClassRangeLabel(dateSheetForm.classFrom, dateSheetForm.classTo);
    const shiftCount = Math.max(Number(dateSheetForm.shiftsPerDay) || 1, 1);
    const normalizedShiftStartTimes = normalizeShiftStartTimes(dateSheetForm.shiftStartTimes, shiftCount);
    const normalizedShiftStartMeridians = normalizeShiftStartMeridians(
      dateSheetForm.shiftStartMeridians,
      normalizedShiftStartTimes,
      shiftCount,
    );
    const classColumns = buildDateSheetClassColumns({
      allClasses: availableClasses,
      baseClassOptions: availableBaseClasses,
      classFrom: dateSheetForm.classFrom,
      classTo: dateSheetForm.classTo,
      sectionWise: dateSheetForm.sectionWise,
    });
    const examDateColumns = buildExamDateColumns(dateSheetForm.examStartDate, dateSheetForm.examEndDate);
    const subjectGrid = buildInitialExamSubjectGrid(classColumns, examDateColumns, shiftCount);

    const schoolName = String(session?.instituteName || 'School Name').trim() || 'School Name';
    const previewPayload = {
      schoolName,
      className: rangeLabel,
      classFrom: dateSheetForm.classFrom,
      classTo: dateSheetForm.classTo,
      sectionWise: dateSheetForm.sectionWise,
      classColumns,
      examType: formatExamFormText(dateSheetForm.examType).trim(),
      shiftsPerDay: String(shiftCount),
      shiftStartTimes: normalizedShiftStartTimes.map((timeValue, index) => (
        convertTimeToMeridian(timeValue, normalizedShiftStartMeridians[index])
      )),
      shiftStartMeridians: normalizedShiftStartMeridians,
      shiftDurationHours: dateSheetForm.shiftDurationHours,
      shiftDurationUnit: dateSheetForm.shiftDurationUnit,
      examStartDate: dateSheetForm.examStartDate,
      examEndDate: dateSheetForm.examEndDate,
      subjectGrid,
    };

    setTemplatePreview(previewPayload);
    setActiveSection('datesheet-preview');
    setDateSheetFieldErrors({});
    setLoadError('');
  };

  const handleCloseTemplatePreview = () => {
    setActiveSection('datesheet');
    setTemplatePreview(null);
  };

  const handleTemplateSubjectChange = (className, dateValue, shiftIndex, subjectName) => {
    setTemplatePreview((current) => {
      if (!current) return current;
      const cellKey = buildExamSubjectCellKey(className, dateValue, shiftIndex);
      return {
        ...current,
        subjectGrid: {
          ...(current.subjectGrid || {}),
          [cellKey]: subjectName,
        },
      };
    });
  };

  const handleSaveTemplatePreview = async () => {
    if (!templatePreview) return;

    const fileName = buildDateSheetTemplateFileName(templatePreview.className, templatePreview.examType);
    const fileData = buildDateSheetTemplateDataUri(templatePreview);

    try {
      await saveDateSheetRecord({
        className: templatePreview.className,
        classFrom: templatePreview.classFrom,
        classTo: templatePreview.classTo,
        sectionWise: templatePreview.sectionWise,
        examType: templatePreview.examType,
        shiftsPerDay: templatePreview.shiftsPerDay,
        shiftStartTimes: templatePreview.shiftStartTimes,
        shiftStartMeridians: templatePreview.shiftStartMeridians,
        shiftDurationHours: templatePreview.shiftDurationHours,
        shiftDurationUnit: templatePreview.shiftDurationUnit,
        examStartDate: templatePreview.examStartDate,
        examEndDate: templatePreview.examEndDate,
        fileName,
        fileData,
        fileType: 'application/vnd.ms-excel',
      });

      const link = document.createElement('a');
      link.href = fileData;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setDateSheetForm(initialDateSheetForm);
      setTemplatePreview(null);
      setActiveSection('datesheet');
      await refreshData();
      setLoadError('');
    } catch (error) {
      setDateSheetFieldErrors(error.fieldErrors || {});
      setLoadError(error.message || 'Unable to save generated date sheet template.');
    }
  };

  const handleStudentSelect = (studentId) => {
    const selectedStudent = students.find((student) => String(student.id) === studentId);
    if (!selectedStudent) {
      setAdmitCardForm((current) => ({
        ...current,
        studentId,
        rollNo: '',
        className: '',
      }));
      return;
    }

    setAdmitCardForm((current) => ({
      ...current,
      studentId,
      rollNo: formatExamFormText(selectedStudent.rollNo || selectedStudent.enrollmentNo || selectedStudent.systemId || ''),
      className: formatExamFormText(selectedStudent.assignedClass || ''),
    }));
  };

  const handleAdmitCardSave = async (e) => {
    e.preventDefault();
    const validationErrors = validateAdmitCardForm(admitCardForm);
    if (Object.keys(validationErrors).length) {
      setAdmitCardFieldErrors(validationErrors);
      setLoadError('');
      return;
    }

    const selectedStudent = students.find((student) => String(student.id) === admitCardForm.studentId);
    if (!selectedStudent) {
      setAdmitCardFieldErrors({ studentId: 'Please select a valid student.' });
      return;
    }

    try {
      await examApi.saveAdmitCard({
        ...admitCardForm,
        examTitle: formatExamFormText(admitCardForm.examTitle).trim(),
        studentId: selectedStudent.systemId || String(selectedStudent.id),
        studentName: `${selectedStudent.firstName || ''} ${selectedStudent.lastName || ''}`.trim(),
        rollNo: selectedStudent.rollNo || selectedStudent.enrollmentNo || selectedStudent.systemId || admitCardForm.rollNo,
        className: selectedStudent.assignedClass || admitCardForm.className,
        centerName: formatExamFormText(admitCardForm.centerName).trim(),
        reportingTime: admitCardForm.reportingTime.trim(),
        examDate: admitCardForm.examDate,
      });
      setAdmitCardForm(initialAdmitCardForm);
      setAdmitCardFieldErrors({});
      await refreshData();
      setLoadError('');
    } catch (error) {
      setAdmitCardFieldErrors(error.fieldErrors || {});
      setLoadError(error.message || 'Unable to save admit card.');
    }
  };

  const handleDelete = async (module, recordId, message) => {
    if (!window.confirm(message)) return;

    try {
      if (module === 'exam_datesheets') {
        await examApi.deleteDateSheet(recordId);
      } else if (module === 'exam_question_papers') {
        await examApi.deleteQuestionPaper(recordId);
      } else if (module === 'exam_admit_cards') {
        await examApi.deleteAdmitCard(recordId);
      }
      await refreshData();
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Unable to delete examination record.');
    }
  };

  const handleDownloadPaper = (paper) => {
    if (!paper.fileData) return;
    const link = document.createElement('a');
    link.href = paper.fileData;
    link.download = paper.fileName || `${paper.subjectName || 'question-paper'}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintPaper = (paper) => {
    if (!paper.fileData) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head><title>${paper.fileName || 'Question Paper'}</title></head>
        <body style="margin:0">
          <iframe src="${paper.fileData}" style="width:100%;height:100vh;border:none;"></iframe>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  const handleViewPaper = (paper) => {
    if (!paper.fileData) return;
    setQuestionPaperPreview(paper);
  };

  const handlePrintAdmitCard = (card) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head><title>Admit Card</title></head>
        <body style="font-family: Arial, sans-serif; padding: 32px;">
          <h1>${card.examTitle}</h1>
          <h2>Admit Card</h2>
          <p><strong>Student:</strong> ${card.studentName}</p>
          <p><strong>Roll No:</strong> ${card.rollNo}</p>
          <p><strong>Class:</strong> ${card.className}</p>
          <p><strong>Exam Date:</strong> ${card.examDate}</p>
          <p><strong>Reporting Time:</strong> ${card.reportingTime}</p>
          <p><strong>Center:</strong> ${card.centerName}</p>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  const quickStats = [
    { label: 'Date Sheets', value: dateSheets.length, icon: CalendarDays, tone: 'from-sky-500 to-cyan-500' },
    { label: 'Question Papers', value: questionPapers.length, icon: ScrollText, tone: 'from-amber-500 to-orange-500' },
    { label: 'Admit Cards', value: admitCards.length, icon: Ticket, tone: 'from-emerald-500 to-teal-500' },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_left,#e0f2fe_0%,#f8fafc_28%,#fff7ed_60%,#f8fafc_100%)] text-slate-900">
      <div className="border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-3 py-3 sm:px-5 lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => navigate('/college')}
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-600 transition hover:border-sky-300 hover:text-sky-700"
            >
              <ArrowLeft size={14} />
              Back
            </button>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-700 sm:text-[11px]">Examination Management</p>
              <h1 className="truncate font-serif text-lg font-black italic tracking-tight text-slate-950 sm:text-xl">
                Exam Operations Desk
              </h1>
            </div>
          </div>


        </div>
      </div>

      <div className="mx-auto max-w-5xl px-3 py-4 sm:px-5 sm:py-6 lg:px-6 lg:py-8">
        {loadError ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {loadError}
          </div>
        ) : null}

        <div className="mt-6">
          {activeSection === 'home' ? (
            <ExamHome
              onOpenDateSheet={() => setActiveSection('datesheet')}
              onOpenQuestionPaper={() => setActiveSection('questionpaper')}
              onOpenAdmitCard={() => setActiveSection('admitcard')}
            />
          ) : null}

          {activeSection === 'datesheet' ? (
            <DateSheetSection
              form={dateSheetForm}
              setForm={setDateSheetForm}
              fieldErrors={dateSheetFieldErrors}
              setFieldErrors={setDateSheetFieldErrors}
              baseClassOptions={availableBaseClasses}
              dateSheetMap={dateSheetMap}
              searchValue={dateSheetSearch}
              onSearch={setDateSheetSearch}
              onGenerateTemplate={handleGenerateDateSheetTemplate}
              onDelete={(recordId) => handleDelete('exam_datesheets', recordId, 'Delete this exam date sheet entry?')}
            />
          ) : null}

          {activeSection === 'datesheet-preview' && templatePreview ? (
            <DateSheetTemplatePreview
              preview={templatePreview}
              subjectsByClass={subjectsByClass}
              onBack={handleCloseTemplatePreview}
              onSubjectChange={handleTemplateSubjectChange}
              onSave={handleSaveTemplatePreview}
            />
          ) : null}

          {activeSection === 'questionpaper' ? (
            <QuestionPaperSection
              classes={questionPaperClasses}
              examTypes={questionPaperExamTypes}
              subjects={questionPaperSubjects}
              records={visibleQuestionPapers}
              activeClass={activeQuestionPaperClass}
              activeExamType={activeQuestionPaperExamType}
              activeSubject={activeQuestionPaperSubject}
              searchValue={questionSearch}
              onSearch={setQuestionSearch}
              onSelectClass={setSelectedQuestionPaperClass}
              onSelectExamType={setSelectedQuestionPaperExamType}
              onSelectSubject={setSelectedQuestionPaperSubject}
              onView={handleViewPaper}
              onDownload={handleDownloadPaper}
            />
          ) : null}

          {activeSection === 'admitcard' ? (
            <AdmitCardSection
              form={admitCardForm}
              setForm={setAdmitCardForm}
              fieldErrors={admitCardFieldErrors}
              setFieldErrors={setAdmitCardFieldErrors}
              students={students}
              examTitles={availableExamTitles}
              records={filteredAdmitCards}
              searchValue={admitSearch}
              onSearch={setAdmitSearch}
              onStudentSelect={handleStudentSelect}
              onSave={handleAdmitCardSave}
              onDelete={(recordId) => handleDelete('exam_admit_cards', recordId, 'Delete this admit card record?')}
              onPrint={handlePrintAdmitCard}
            />
          ) : null}
        </div>

        {questionPaperPreview ? (
          <QuestionPaperPreviewModal
            paper={questionPaperPreview}
            onClose={() => setQuestionPaperPreview(null)}
            onDownload={handleDownloadPaper}
          />
        ) : null}
      </div>
    </div>
  );
};

const HeroPanel = ({ activeSection, quickStats }) => (
  <section className="overflow-hidden rounded-[1.6rem] border border-white/60 bg-[linear-gradient(145deg,#082f49_0%,#0f172a_52%,#172554_100%)] px-4 py-5 text-white shadow-[0_28px_70px_-45px_rgba(8,47,73,0.9)] sm:px-5 sm:py-6 lg:px-6">
    <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-4">
        <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-sky-100">
          Central Control
        </div>
        <div>
          <h2 className="max-w-3xl font-serif text-2xl font-black italic leading-tight tracking-tight sm:text-3xl">
            Keep date sheets, teacher papers, and admit cards in one responsive exam workspace.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-sky-50/80">
            Switch sections instantly, review saved records, and manage printable exam documents without jumping across multiple pages.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-sky-100/90">
          <HeroTag text={activeSection === 'home' ? 'Overview open' : `${sectionLabelMap[activeSection]} active`} />
          <HeroTag text="No horizontal scroll layout" />
          <HeroTag text="Responsive records and forms" />
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
        {quickStats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>
    </div>
  </section>
);

const ExamHome = ({ onOpenDateSheet, onOpenQuestionPaper, onOpenAdmitCard }) => (
  <section className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
    <LaunchCard
      icon={CalendarDays}
      title="Exam Date Sheet"
      description="Generate fresh Excel-style date sheet templates for each exam cycle."
      onClick={onOpenDateSheet}
    />
    <LaunchCard
      icon={ScrollText}
      title="Question Papers"
      description="View saved question papers and keep download and print actions in one place."
      onClick={onOpenQuestionPaper}
    />
    <LaunchCard
      icon={Ticket}
      title="Admit Cards"
      description="Generate, store, and print admit cards from saved student records with clean details."
      onClick={onOpenAdmitCard}
    />
  </section>
);

const DateSheetSection = ({
  form,
  setForm,
  fieldErrors,
  setFieldErrors,
  baseClassOptions,
  dateSheetMap,
  searchValue,
  onSearch,
  onGenerateTemplate,
  onDelete,
}) => {
  const updateField = (field, value) => {
    setForm({ ...form, [field]: value });
    setFieldErrors((current) => ({ ...current, [field]: '' }));
  };

  const filteredRecords = Object.values(dateSheetMap).filter((record) => {
    const query = searchValue.trim().toLowerCase();
    if (!query) return true;
    return (
      String(record.className || '').toLowerCase().includes(query)
      || String(record.examType || '').toLowerCase().includes(query)
      || String(record.fileName || '').toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      <Panel>
        <PanelHeader
          title="Date Sheet Workspace"
          description="Class range, exam type, date range, aur shifts fill karke Excel-style date sheet generate karo."
        />

        <div className="mt-6 space-y-5">
          <div className="grid gap-4 rounded-[1.75rem] border border-slate-200 bg-slate-50 p-4 sm:p-5 md:grid-cols-2">
              <CreativeSelect
                label="Class Range From"
                value={form.classFrom}
                onChange={(e) => updateField('classFrom', e.target.value)}
                options={['', ...baseClassOptions]}
                renderOptionLabel={(value) => value || 'Select start class'}
                error={fieldErrors.classFrom}
              />
              <CreativeSelect
                label="Class Range To"
                value={form.classTo}
                onChange={(e) => updateField('classTo', e.target.value)}
                options={['', ...baseClassOptions]}
                renderOptionLabel={(value) => value || 'Select end class'}
                error={fieldErrors.classTo}
              />
              <label className="flex items-center gap-3 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3.5 md:col-span-2">
                <input
                  type="checkbox"
                  checked={Boolean(form.sectionWise)}
                  onChange={(e) => setForm({ ...form, sectionWise: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <div>
                  <p className="text-sm font-bold text-slate-900">Section Wise</p>
                  <p className="text-xs text-slate-500">
                    On karne par har class ke sab sections alag column me aayenge. Off rahega to class ka ek combined column banega.
                  </p>
                </div>
              </label>
              <CreativeInput
                label="Exam Type"
                value={form.examType}
                onChange={(e) => updateField('examType', e.target.value)}
                placeholder="Mid Term / Unit Test / Annual"
                error={fieldErrors.examType}
              />
              <CreativeSelect
                label="Shift In A Day"
                value={form.shiftsPerDay}
                onChange={(e) => {
                  setForm((current) => ({
                    ...current,
                    shiftsPerDay: e.target.value,
                    shiftStartTimes: normalizeShiftStartTimes(current.shiftStartTimes, e.target.value),
                    shiftStartMeridians: normalizeShiftStartMeridians(
                      current.shiftStartMeridians,
                      current.shiftStartTimes,
                      e.target.value,
                    ),
                  }));
                  setFieldErrors((current) => ({ ...current, shiftsPerDay: '', shiftStartTimes: '', shiftStartMeridians: '' }));
                }}
                options={['', '1', '2', '3', '4']}
                renderOptionLabel={(value) => value || 'Select shifts'}
                error={fieldErrors.shiftsPerDay}
              />
              <div className="space-y-2.5">
                <label className="text-xs font-black uppercase tracking-[0.16em] text-slate-700">Length Of Shift</label>
                <div className={`relative flex items-center rounded-2xl border-2 bg-white outline-none transition focus-within:ring-4 ${
                  fieldErrors.shiftDurationHours || fieldErrors.shiftDurationUnit
                    ? 'border-rose-300 focus-within:border-rose-500 focus-within:ring-rose-100'
                    : 'border-slate-200 focus-within:border-sky-500 focus-within:ring-sky-100'
                }`}>
                  <input
                    type="number"
                    min="1"
                    step={form.shiftDurationUnit === 'minutes' ? '1' : '0.5'}
                    value={form.shiftDurationHours}
                    onChange={(e) => {
                      setForm({ ...form, shiftDurationHours: e.target.value });
                      setFieldErrors((current) => ({ ...current, shiftDurationHours: '' }));
                    }}
                    placeholder="Write shift length"
                    className="w-full bg-transparent px-4 py-3.5 text-sm font-semibold text-slate-900 outline-none"
                  />
                  <select
                    value={form.shiftDurationUnit}
                    onChange={(e) => {
                      setForm({ ...form, shiftDurationUnit: e.target.value });
                      setFieldErrors((current) => ({ ...current, shiftDurationUnit: '' }));
                    }}
                    className="border-l-2 border-slate-200 bg-transparent px-4 py-3.5 text-[11px] font-black uppercase tracking-[0.12em] text-slate-700 outline-none cursor-pointer"
                  >
                    <option value="">Unit</option>
                    <option value="hours">Hours</option>
                    <option value="minutes">Minutes</option>
                  </select>
                </div>
                <FieldError text={fieldErrors.shiftDurationHours || fieldErrors.shiftDurationUnit} />
              </div>
              <CreativeInput
                label="Exam Starting Date"
                type="date"
                value={form.examStartDate}
                onChange={(e) => updateField('examStartDate', e.target.value)}
                error={fieldErrors.examStartDate}
              />
              <CreativeInput
                label="Exam Ending Date"
                type="date"
                value={form.examEndDate}
                onChange={(e) => updateField('examEndDate', e.target.value)}
                error={fieldErrors.examEndDate}
              />
              {Array.from({ length: Math.max(Number(form.shiftsPerDay) || 1, 1) }).map((_, index) => {
                const startTime = form.shiftStartTimes?.[index] || '';
                const meridian = form.shiftStartMeridians?.[index] || '';
                const displayHour = getTimeHour12Value(startTime);
                const displayMinute = getTimeMinuteValue(startTime);
                const endTime = calculateShiftEndTime(startTime, form.shiftDurationHours, form.shiftDurationUnit);
                const hasShiftTimeError = Boolean(fieldErrors.shiftStartTimes || fieldErrors.shiftStartMeridians);
                return (
                  <div key={`shift-start-${index}`} className="space-y-2.5">
                    <label className="text-xs font-black uppercase tracking-[0.16em] text-slate-700">
                      {`Shift ${index + 1} Starting Time`}
                    </label>
                    <div className={`relative flex items-center rounded-2xl border-2 bg-white outline-none transition focus-within:ring-4 ${
                      hasShiftTimeError
                        ? 'border-rose-300 focus-within:border-rose-500 focus-within:ring-rose-100'
                        : 'border-slate-200 focus-within:border-sky-500 focus-within:ring-sky-100'
                    }`}>
                      <div className="flex flex-1 items-center px-4 py-3.5">
                        <span className="mr-3 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">Time</span>
                        <div className="flex items-center gap-2">
                          <select
                            value={displayHour}
                            onChange={(e) => setForm((current) => {
                              const currentTimes = normalizeShiftStartTimes(current.shiftStartTimes, current.shiftsPerDay);
                              const currentMeridians = normalizeShiftStartMeridians(
                                current.shiftStartMeridians,
                                current.shiftStartTimes,
                                current.shiftsPerDay,
                              );
                              return {
                                ...current,
                                shiftStartTimes: currentTimes.map((entry, entryIndex) => (
                                  entryIndex === index
                                    ? buildTimeFromTwelveHourParts(e.target.value, getTimeMinuteValue(entry), currentMeridians[index])
                                    : entry
                                )),
                              };
                            })}
                            onFocus={() => setFieldErrors((current) => ({ ...current, shiftStartTimes: '' }))}
                            className="min-w-[72px] bg-transparent text-sm font-semibold text-slate-900 outline-none cursor-pointer"
                          >
                            <option value="">Hour</option>
                            {twelveHourOptions.map((hourValue) => (
                              <option key={hourValue} value={hourValue}>{hourValue}</option>
                            ))}
                          </select>
                          <span className="text-sm font-black text-slate-400">:</span>
                          <select
                            value={displayMinute}
                            onChange={(e) => setForm((current) => {
                              const currentTimes = normalizeShiftStartTimes(current.shiftStartTimes, current.shiftsPerDay);
                              const currentMeridians = normalizeShiftStartMeridians(
                                current.shiftStartMeridians,
                                current.shiftStartTimes,
                                current.shiftsPerDay,
                              );
                              return {
                                ...current,
                                shiftStartTimes: currentTimes.map((entry, entryIndex) => (
                                  entryIndex === index
                                    ? buildTimeFromTwelveHourParts(getTimeHour12Value(entry), e.target.value, currentMeridians[index])
                                    : entry
                                )),
                              };
                            })}
                            onFocus={() => setFieldErrors((current) => ({ ...current, shiftStartTimes: '' }))}
                            className="min-w-[72px] bg-transparent text-sm font-semibold text-slate-900 outline-none cursor-pointer"
                          >
                            <option value="">Min</option>
                            {minuteOptions.map((minuteValue) => (
                              <option key={minuteValue} value={minuteValue}>{minuteValue}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <select
                        value={meridian}
                        onChange={(e) => setForm((current) => ({
                          ...current,
                          shiftStartTimes: normalizeShiftStartTimes(
                            current.shiftStartTimes,
                            current.shiftsPerDay,
                          ).map((entry, entryIndex) => (
                            entryIndex === index ? convertTimeToMeridian(entry, e.target.value) : entry
                          )),
                          shiftStartMeridians: normalizeShiftStartMeridians(
                            current.shiftStartMeridians,
                            current.shiftStartTimes,
                            current.shiftsPerDay,
                          ).map((entry, entryIndex) => (
                            entryIndex === index ? e.target.value : entry
                          )),
                        }))}
                        onFocus={() => setFieldErrors((current) => ({ ...current, shiftStartMeridians: '' }))}
                        className="border-l-2 border-slate-200 bg-transparent px-4 py-3.5 text-[11px] font-black uppercase tracking-[0.12em] text-slate-700 outline-none cursor-pointer"
                      >
                        <option value="">AM/PM</option>
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                    </div>
                    <p className="text-xs font-semibold text-slate-500">
                      {endTime ? `Ending time: ${formatTimeToTwelveHour(endTime)}` : 'Ending time will auto-calculate from shift length.'}
                    </p>
                    {index === 0 ? <FieldError text={fieldErrors.shiftStartTimes || fieldErrors.shiftStartMeridians} /> : null}
                  </div>
                );
              })}
              <div className="md:col-span-2 rounded-2xl border border-dashed border-sky-200 bg-white px-5 py-4 text-sm leading-7 text-slate-600">
                Template me class range, exam type, number of shifts, har shift ka start time, aur shift length ke basis par auto ending time show hoga.
              </div>
              <div className="md:col-span-2">
                <PrimaryButton type="button" icon={Download} label="Generate Excel Template" onClick={onGenerateTemplate} />
              </div>
            </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Saved Date Sheets"
          description="Excel generated date sheet records yahan show honge."
          action={<SearchInput value={searchValue} onChange={onSearch} placeholder="Search class, exam, file..." />}
        />

        {filteredRecords.length ? (
          <div className="mt-6 grid gap-4">
            {filteredRecords.map((record) => (
              <RecordCard
                key={record.id}
                icon={FileText}
                tone="bg-sky-100 text-sky-700"
                title={record.className || 'Class pending'}
                subtitle={record.examType || 'Exam pending'}
                pills={[
                  { icon: FileText, text: record.fileName || 'Saved file' },
                  { icon: CalendarDays, text: record.examStartDate && record.examEndDate ? `${record.examStartDate} to ${record.examEndDate}` : 'Date range pending' },
                  { icon: Download, text: record.shiftsPerDay ? `${record.shiftsPerDay} shift(s) | ${formatShiftDurationLabel(record.shiftDurationHours, record.shiftDurationUnit)}` : 'Shift count pending' },
                ]}
                actions={<IconButton icon={Trash2} onClick={() => onDelete(record.id)} danger />}
              />
            ))}
          </div>
        ) : (
          <EmptyState icon={CalendarDays} title="No saved date sheets yet" description="Generate Excel date sheet karte hi records yahan show hone lagenge." />
        )}
      </Panel>
    </div>
  );
};

const DateSheetTemplatePreview = ({ preview, subjectsByClass, onBack, onSubjectChange, onSave }) => {
  const dateColumns = buildExamDateColumns(preview.examStartDate, preview.examEndDate);
  const shiftColumns = buildShiftColumns(preview.shiftStartTimes, preview.shiftDurationHours, preview.shiftDurationUnit);
  const totalColumns = 1 + dateColumns.reduce((sum, current) => sum + Math.max(shiftColumns.length, 1), 0);

  return (
    <div className="space-y-6">
      <Panel>
        <PanelHeader
          title="Generated Template Preview"
          description="Yeh naya preview page aapke Excel layout ko table form me dikhata hai. Upar school name, uske neeche exam type, aur phir date-wise merged shift columns show ho rahe hain."
          action={(
            <div className="flex flex-wrap gap-2">
              <ActionButton icon={ArrowLeft} label="Back To Form" onClick={onBack} />
              <PrimaryButton type="button" icon={Download} label="Save And Download Excel" onClick={onSave} />
            </div>
          )}
        />

        <div className="-mx-4 mt-6 overflow-x-auto rounded-[1.4rem] border border-slate-200 bg-white px-2 shadow-sm sm:-mx-6 lg:-mx-12 xl:-mx-20">
          <table className="min-w-[1600px] table-fixed border-separate border-spacing-0 text-xs text-slate-800">
            <tbody>
              <tr>
                <th colSpan={totalColumns} className="rounded-t-[1.25rem] border border-emerald-700 bg-emerald-700 px-4 py-4 text-center text-lg font-black uppercase tracking-normal text-white">
                  {preview.schoolName}
                </th>
              </tr>
              <tr>
                <th colSpan={totalColumns} className="border border-slate-300 bg-slate-950 px-4 py-2.5 text-center text-sm font-black uppercase tracking-normal text-white">
                  {preview.examType}
                </th>
              </tr>
              <tr>
                <th rowSpan={2} className="w-28 border border-slate-300 bg-slate-950 px-3 py-3 text-center text-xs font-black uppercase tracking-[0.12em] text-white">
                  Class
                </th>
                {dateColumns.map((dateValue) => (
                  <th
                    key={dateValue}
                    colSpan={Math.max(shiftColumns.length, 1)}
                    className="border border-slate-300 bg-emerald-50 px-1 py-1.5 text-center text-[10px] font-black uppercase tracking-normal text-slate-950"
                  >
                    {formatTemplateDate(dateValue)}
                  </th>
                ))}
              </tr>
              <tr>
                {dateColumns.flatMap((dateValue) => (
                  (shiftColumns.length ? shiftColumns : [{ label: 'Shift', value: '' }]).map((shift, shiftIndex) => (
                    <th
                      key={`${dateValue}-${shift.label}-${shiftIndex}`}
                      className="w-24 border border-slate-300 bg-emerald-100 px-1 py-1.5 text-center text-[9px] font-black uppercase tracking-normal text-slate-950"
                    >
                      <span className="block">{shift.label}</span>
                      <span className="mt-0.5 block truncate text-[10px] font-bold normal-case tracking-normal text-slate-600">
                        {shift.value || 'Timing pending'}
                      </span>
                    </th>
                  ))
                ))}
              </tr>
              {preview.classColumns.map((className) => (
                <tr key={className}>
                  <td className="border border-slate-300 bg-slate-50 px-3 py-3 text-xs font-black text-slate-950">
                    {className}
                  </td>
                  {dateColumns.flatMap((dateValue) => {
                    const classSubjects = getSubjectsForExamClass(subjectsByClass, className);
                    return (shiftColumns.length ? shiftColumns : [{ label: 'Shift', value: '' }]).map((shift, shiftIndex) => {
                      const cellKey = buildExamSubjectCellKey(className, dateValue, shiftIndex);
                      return (
                        <td
                          key={`${className}-${dateValue}-${shift.label}-${shiftIndex}`}
                          className="h-14 border border-slate-200 bg-white px-1.5 py-1.5"
                        >
                          <div className="flex h-9 min-w-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-1.5 shadow-[0_6px_16px_-14px_rgba(15,23,42,0.65)] focus-within:border-emerald-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-100">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-[10px] font-black text-emerald-700">
                              S
                            </span>
                            <select
                              value={preview.subjectGrid?.[cellKey] || ''}
                              onChange={(event) => onSubjectChange(className, dateValue, shiftIndex, event.target.value)}
                              className="min-w-0 flex-1 bg-transparent text-[10px] font-bold uppercase text-slate-900 outline-none"
                            >
                              <option value="">SUBJECT</option>
                              {classSubjects.map((subjectName) => (
                                <option key={`${cellKey}-${subjectName}`} value={subjectName}>{subjectName}</option>
                              ))}
                            </select>
                          </div>
                        </td>
                      );
                    });
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </Panel>
    </div>
  );
};

const QuestionPaperSection = ({
  classes,
  examTypes,
  subjects,
  records,
  activeClass,
  activeExamType,
  activeSubject,
  searchValue,
  onSearch,
  onSelectClass,
  onSelectExamType,
  onSelectSubject,
  onView,
  onDownload,
}) => (
  <div className="space-y-6">
    <Panel>
      <PanelHeader
        title="Question Paper Review Desk"
        description="Left side me classes show hongi. Right side me selected class ke exam types aur subject dropdown ke through question papers view ya download kar sakte ho."
        action={<SearchInput value={searchValue} onChange={onSearch} placeholder="Search class, exam type, subject, teacher..." />}
      />
    </Panel>

    <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <Panel>
        <PanelHeader
          title="School Classes"
          description="Yahan school ki saari classes visible hain. Kisi class par click karte hi right side me us class ke exam types aur subjects khul jayenge."
        />

        {classes.length ? (
          <div className="mt-6 grid gap-3">
            {classes.map((className, index) => (
              <button
                key={className}
                type="button"
                onClick={() => onSelectClass(className)}
                className={`group flex items-center justify-between rounded-[1.6rem] border px-4 py-4 text-left transition ${
                  activeClass === className
                    ? 'border-sky-300 bg-[linear-gradient(135deg,#eff6ff_0%,#f0f9ff_100%)] text-sky-950 shadow-[0_18px_40px_-35px_rgba(14,165,233,0.55)]'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-sky-200 hover:bg-white'
                }`}
              >
                <div className="min-w-0">
                  <p className={`text-[11px] font-black uppercase tracking-[0.18em] ${activeClass === className ? 'text-sky-700' : 'text-slate-400 group-hover:text-sky-700'}`}>
                    {String(index + 1).padStart(2, '0')}
                  </p>
                  <h4 className="mt-1 truncate text-lg font-black tracking-tight">{className}</h4>
                </div>
                <ArrowRight size={18} className={activeClass === className ? 'text-sky-700' : 'text-slate-300 group-hover:text-sky-600'} />
              </button>
            ))}
          </div>
        ) : (
          <EmptyState icon={ScrollText} title="No classes found" description="Question paper records aane ke baad school classes yahan visible hongi." />
        )}
      </Panel>

      <Panel>
        <PanelHeader
          title={activeClass ? `${activeClass} Question Papers` : 'Question Papers'}
          description="Selected class ke exam types yahin show hote hain. Exam type select karne par subject dropdown open hota hai aur selected subject ke paper ke saamne View aur Download buttons milte hain."
        />

        {activeClass ? (
          examTypes.length ? (
            <div className="mt-6 space-y-5">
              <CreativeSelect
                label="Exam Type"
                value={activeExamType}
                onChange={(e) => onSelectExamType(e.target.value)}
                options={['', ...examTypes]}
                renderOptionLabel={(value) => value || 'Select exam type'}
              />

              {activeExamType ? (
                subjects.length ? (
                  <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-4 sm:p-5">
                    <div>
                      <CreativeSelect
                        label="Subjects"
                        value={activeSubject}
                        onChange={(e) => onSelectSubject(e.target.value)}
                        options={['', ...subjects]}
                        renderOptionLabel={(value) => value || 'Select subject'}
                      />
                    </div>

                    {records.length ? (
                      <div className="mt-5 grid gap-4">
                        {records.map((record) => (
                          <RecordCard
                            key={record.id}
                            icon={ScrollText}
                            tone="bg-amber-100 text-amber-700"
                            title={record.subjectName || 'Subject pending'}
                            subtitle={record.examTitle || 'Exam type pending'}
                            pills={[
                              { icon: FileText, text: record.className || 'Class pending' },
                              { icon: FileText, text: record.uploadedBy || 'Teacher not added' },
                              { icon: ScrollText, text: record.fileName || 'File missing' },
                            ]}
                            actions={(
                              <div className="flex flex-wrap gap-2">
                                <ActionButton icon={Eye} label="View" onClick={() => onView(record)} />
                                <ActionButton icon={Download} label="Download" onClick={() => onDownload(record)} />
                              </div>
                            )}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="mt-5">
                        <EmptyState icon={ScrollText} title="No paper found" description="Selected subject ke liye abhi koi question paper available nahi hai." />
                      </div>
                    )}
                  </div>
                ) : (
                  <EmptyState icon={ScrollText} title="No subjects found" description="Is selected exam type me abhi koi subject question paper available nahi hai." />
                )
              ) : (
                <EmptyState icon={ScrollText} title="Select an exam type" description="Class select karne ke baad exam type choose karo, phir yahan subject dropdown open hoga." />
              )}
            </div>
          ) : (
            <EmptyState icon={CalendarDays} title="No exam types found" description="Is class ke liye abhi koi exam type question paper records me available nahi hai." />
          )
        ) : (
          <EmptyState icon={CalendarDays} title="Select a class" description="Pehle class choose karo, phir us class ke exam types aur subjects yahan dikhenge." />
        )}
      </Panel>
    </div>
  </div>
);

const QuestionPaperPreviewModal = ({ paper, onClose, onDownload }) => (
  <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm">
    <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[1.8rem] bg-white shadow-[0_30px_90px_-35px_rgba(15,23,42,0.75)]">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-7">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-sky-700">{paper.className || paper.examTitle || 'Question Paper'}</p>
          <h3 className="mt-1 truncate font-serif text-2xl font-black italic tracking-tight text-slate-950">{paper.subjectName || paper.fileName || 'Preview'}</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onDownload(paper)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white transition hover:bg-sky-600"
            title="Download"
          >
            <Download size={18} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-4 lg:p-6">
        <div className="min-h-[65vh] overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white">
          {String(paper.fileType || '').startsWith('image/') ? (
            <img src={paper.fileData} alt={paper.fileName || 'Question Paper'} className="mx-auto max-h-[72vh] w-auto max-w-full object-contain" />
          ) : (
            <iframe title={paper.fileName || 'Question Paper'} src={paper.fileData} className="h-[72vh] w-full bg-white" />
          )}
        </div>
      </div>
    </div>
  </div>
);

const AdmitCardSection = ({ form, setForm, fieldErrors, setFieldErrors, students, examTitles, records, searchValue, onSearch, onStudentSelect, onSave, onDelete, onPrint }) => {
  const updateField = (field, value) => {
    setForm({ ...form, [field]: value });
    setFieldErrors((current) => ({ ...current, [field]: '' }));
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
      <Panel>
        <PanelHeader
          title="Generate Admit Card"
          description="Student select karke exam details save karo. Print-ready admit card record right panel me aa jayega."
        />
        <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={onSave}>
          <CreativeInput
            list="admit-exam-options"
            label="Exam Title"
            value={form.examTitle}
            onChange={(e) => updateField('examTitle', e.target.value)}
            placeholder="Annual Examination"
            error={fieldErrors.examTitle}
          />
          <CreativeSelect
            label="Student"
            value={form.studentId}
            onChange={(e) => {
              onStudentSelect(e.target.value);
              setFieldErrors((current) => ({ ...current, studentId: '', rollNo: '', className: '' }));
            }}
            options={['', ...students.map((student) => String(student.id))]}
            renderOptionLabel={(value) => {
              if (!value) return 'Select student';
              const student = students.find((record) => String(record.id) === value);
              return student ? `${student.firstName || ''} ${student.lastName || ''}`.trim() : value;
            }}
            error={fieldErrors.studentId}
          />
          <CreativeInput label="Roll No" value={form.rollNo} onChange={(e) => updateField('rollNo', e.target.value)} placeholder="Auto from student" error={fieldErrors.rollNo} />
          <CreativeInput label="Class / Section" value={form.className} onChange={(e) => updateField('className', e.target.value)} placeholder="Auto from student" error={fieldErrors.className} />
          <CreativeInput label="Exam Date" type="date" value={form.examDate} onChange={(e) => updateField('examDate', e.target.value)} error={fieldErrors.examDate} />
          <CreativeInput label="Reporting Time" type="time" value={form.reportingTime} onChange={(e) => updateField('reportingTime', e.target.value)} error={fieldErrors.reportingTime} />
          <div className="md:col-span-2">
            <CreativeInput label="Exam Center / Venue" value={form.centerName} onChange={(e) => updateField('centerName', e.target.value)} placeholder="Main Examination Hall" error={fieldErrors.centerName} />
          </div>
          <div className="md:col-span-2">
            <PrimaryButton type="submit" icon={Ticket} label="Save Admit Card" />
          </div>
        </form>
      <datalist id="admit-exam-options">
        {examTitles.map((examTitle) => (
          <option key={examTitle} value={examTitle} />
        ))}
      </datalist>
    </Panel>

    <Panel>
      <PanelHeader
        title="Saved Admit Cards"
        description="Review records and print final student admit cards."
        action={<SearchInput value={searchValue} onChange={onSearch} placeholder="Search exam, student, roll no..." />}
      />

      {records.length ? (
        <div className="mt-6 grid gap-4">
          {records.map((record) => (
            <RecordCard
              key={record.id}
              icon={Ticket}
              tone="bg-emerald-100 text-emerald-700"
              title={record.studentName || 'Student pending'}
              subtitle={record.examTitle || 'Exam title pending'}
              pills={[
                { icon: FileText, text: record.className || 'Class pending' },
                { icon: Ticket, text: record.rollNo || 'Roll no pending' },
                { icon: CalendarDays, text: record.examDate || 'Date pending' },
                { icon: ScrollText, text: `${record.reportingTime || '--'} | ${record.centerName || 'Center pending'}` },
              ]}
              actions={(
                <div className="flex flex-wrap gap-2">
                  <ActionButton icon={Printer} label="Print" onClick={() => onPrint(record)} />
                  <IconButton icon={Trash2} onClick={() => onDelete(record.id)} danger />
                </div>
              )}
            />
          ))}
        </div>
      ) : (
        <EmptyState icon={Ticket} title="No admit cards yet" description="First admit card save karte hi printable records yahan show hone lagenge." />
      )}
      </Panel>
    </div>
  );
};

const SectionTabs = ({ activeSection, onChange }) => {
  const tabs = [
    { key: 'home', label: 'Overview' },
    { key: 'datesheet', label: 'Date Sheet' },
    { key: 'questionpaper', label: 'Question Papers' },
    { key: 'admitcard', label: 'Admit Cards' },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={`rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] transition sm:px-4 sm:text-[11px] sm:tracking-[0.14em] ${
            activeSection === tab.key
              ? 'bg-slate-950 text-white'
              : 'border border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:text-sky-700'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};

const Panel = ({ children }) => (
  <section className="rounded-[1.5rem] border border-slate-200/80 bg-white p-3.5 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.45)] sm:p-4.5 lg:p-5">
    {children}
  </section>
);

const PanelHeader = ({ title, description, action }) => (
  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
    <div className="min-w-0">
      <h3 className="font-serif text-xl font-black italic tracking-tight text-slate-950 sm:text-2xl">{title}</h3>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
    </div>
    {action ? <div className="w-full lg:w-auto">{action}</div> : null}
  </div>
);

const LaunchCard = ({ icon: Icon, eyebrow, title, description, buttonLabel, accent, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex min-h-52 flex-col justify-between rounded-4xl border border-slate-200/80 bg-white p-6 text-left shadow-[0_20px_60px_-38px_rgba(15,23,42,0.45)] transition hover:-translate-y-1 hover:border-sky-300 hover:shadow-[0_26px_70px_-42px_rgba(30,144,255,0.35)] lg:p-8"
  >
    <div>
      <div className="flex items-start justify-between gap-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-sky-100 text-sky-700 transition group-hover:bg-sky-600 group-hover:text-white">
          <Icon size={24} />
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition group-hover:border-sky-200 group-hover:text-sky-700">
          <ArrowRight size={18} />
        </div>
      </div>
      <h3 className="mt-7 font-serif text-3xl font-black italic tracking-tight text-slate-950">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-slate-500">{description}</p>
    </div>
    <span className="mt-6 text-[11px] font-black uppercase tracking-[0.22em] text-sky-700">
      Open Desk
    </span>
  </button>
);

const StatCard = ({ label, value, icon: Icon, tone }) => (
  <div className="rounded-[1.3rem] border border-white/10 bg-white/8 p-3 backdrop-blur-sm">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-sky-50/80">{label}</p>
        <p className="mt-1.5 text-2xl font-black tracking-tight text-white sm:text-3xl">{value}</p>
      </div>
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${tone} text-white sm:h-10 sm:w-10`}>
        <Icon size={16} />
      </div>
    </div>
  </div>
);

const HeroTag = ({ text }) => (
  <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1">{text}</span>
);

const SoftNotice = ({ title, description }) => (
  <div className="rounded-[1.5rem] border border-sky-100 bg-sky-50 px-4 py-4">
    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-sky-700">{title}</p>
    <p className="mt-2 text-sm leading-7 text-slate-600">{description}</p>
  </div>
);

const RecordBanner = ({ icon: Icon, title, subtitle, note, actions }) => (
  <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-4 sm:p-5">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-sky-100 text-sky-700">
          <Icon size={22} />
        </div>
        <div className="min-w-0">
          <h4 className="truncate text-lg font-black tracking-tight text-slate-950">{title}</h4>
          <p className="mt-1 text-[11px] font-black uppercase tracking-[0.16em] text-sky-700">{subtitle}</p>
          <p className="mt-2 text-xs font-bold text-slate-500">{note}</p>
        </div>
      </div>
      {actions}
    </div>
  </div>
);

const RecordCard = ({ icon: Icon, tone, title, subtitle, pills, actions }) => (
  <article className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-4 sm:p-5">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tone}`}>
            <Icon size={20} />
          </div>
          <div className="min-w-0">
            <h4 className="text-lg font-black tracking-tight text-slate-950">{title}</h4>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{subtitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {pills.map((pill) => (
            <InfoPill key={`${pill.text}-${pill.icon.displayName || pill.text}`} icon={pill.icon} text={pill.text} />
          ))}
        </div>
      </div>
      {actions}
    </div>
  </article>
);

const SearchInput = ({ value, onChange, placeholder }) => (
  <div className="relative w-full min-w-0 sm:max-w-sm">
    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-12 py-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-100"
    />
  </div>
);

const CreativeInput = ({ label, onChange, type = 'text', className = '', error = '', ...props }) => {
  const shouldUppercase = !['date', 'time', 'number'].includes(type);
  const handleChange = (event) => {
    if (!onChange) return;
    if (shouldUppercase) {
      event.target.value = formatExamFormText(event.target.value);
    }
    onChange(event);
  };

  return (
    <div className="space-y-2.5">
      <label className="text-xs font-black uppercase tracking-[0.16em] text-slate-700">{label}</label>
      <input
        type={type}
        onChange={handleChange}
        className={`w-full rounded-2xl border-2 bg-white px-4 py-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-4 ${
          error ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-100' : 'border-slate-200 focus:border-sky-500 focus:ring-sky-100'
        } ${shouldUppercase ? 'uppercase' : ''} ${className}`}
        {...props}
      />
      <FieldError text={error} />
    </div>
  );
};

const CreativeSelect = ({ label, options, renderOptionLabel, className = '', error = '', ...props }) => (
  <div className="space-y-2.5">
    <label className="text-xs font-black uppercase tracking-[0.16em] text-slate-700">{label}</label>
    <select
      className={`w-full rounded-2xl border-2 bg-white px-4 py-3.5 text-sm font-semibold uppercase text-slate-900 outline-none transition focus:ring-4 ${
        error ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-100' : 'border-slate-200 focus:border-sky-500 focus:ring-sky-100'
      } ${className}`}
      {...props}
    >
      {options.map((option) => (
        <option key={option || 'empty-option'} value={option}>
          {formatExamFormText(renderOptionLabel ? renderOptionLabel(option) : option || 'Select')}
        </option>
      ))}
    </select>
    <FieldError text={error} />
  </div>
);

const PrimaryButton = ({ type = 'button', icon: Icon, label, onClick }) => (
  <button
    type={type}
    onClick={onClick}
    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.18em] text-white transition hover:bg-sky-700"
  >
    <Icon size={15} />
    {label}
  </button>
);

const InfoPill = ({ icon: Icon, text }) => (
  <div className="inline-flex max-w-full items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">
    <Icon size={15} className="shrink-0 text-sky-700" />
    <span className="truncate">{text}</span>
  </div>
);

const ActionButton = ({ icon: Icon, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.16em] text-slate-700 transition hover:border-sky-300 hover:text-sky-700"
  >
    <Icon size={14} />
    {label}
  </button>
);

const IconButton = ({ icon: Icon, onClick, danger = false }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl transition ${
      danger ? 'text-slate-400 hover:bg-rose-50 hover:text-rose-600' : 'text-slate-500 hover:bg-slate-100'
    }`}
  >
    <Icon size={18} />
  </button>
);

const EmptyState = ({ icon: Icon, title, description }) => (
  <div className="mt-6 rounded-[1.8rem] border border-dashed border-slate-300 bg-slate-50 px-4 py-12 text-center sm:px-6 sm:py-14">
    <div className="mx-auto flex h-18 w-18 items-center justify-center rounded-3xl bg-white text-slate-300 shadow-sm">
      <Icon size={32} />
    </div>
    <h4 className="mt-5 font-serif text-2xl font-black italic tracking-tight text-slate-950">{title}</h4>
    <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-500">{description}</p>
  </div>
);

const normalizeClassValue = (value) => String(value || '').trim();

const formatExamFormText = (value) => String(value || '').toUpperCase();

const normalizeExamClassLabel = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/\s*\/\s*/g, '/')
  .replace(/\s+/g, ' ');

const getSubjectsForExamClass = (subjectsByClass, className) => {
  const descriptor = parseClassDescriptor(className);
  const keys = [
    className,
    descriptor.baseClass,
    normalizeExamClassLabel(className),
    normalizeExamClassLabel(descriptor.baseClass),
  ].filter(Boolean);

  const subjects = new Set();
  keys.forEach((key) => {
    const classSubjects = subjectsByClass?.[normalizeExamClassLabel(key)];
    if (!classSubjects) return;
    classSubjects.forEach((subjectName) => subjects.add(subjectName));
  });

  return [...subjects].sort((left, right) => left.localeCompare(right));
};

const buildExamSubjectCellKey = (className, dateValue, shiftIndex) => (
  `${normalizeExamClassLabel(className)}__${dateValue}__${shiftIndex}`
);

const buildInitialExamSubjectGrid = (classColumns, dateColumns, shiftCount) => {
  const subjectGrid = {};
  classColumns.forEach((className) => {
    dateColumns.forEach((dateValue) => {
      Array.from({ length: Math.max(Number(shiftCount) || 1, 1) }).forEach((_, shiftIndex) => {
        subjectGrid[buildExamSubjectCellKey(className, dateValue, shiftIndex)] = '';
      });
    });
  });
  return subjectGrid;
};

const validateDateSheetForm = (form) => {
  const errors = {};
  if (!form.classFrom) errors.classFrom = 'Please select start class.';
  if (!form.classTo) errors.classTo = 'Please select end class.';
  if (!String(form.examType || '').trim()) errors.examType = 'Please enter exam type.';
  if (!form.shiftsPerDay) errors.shiftsPerDay = 'Please select shifts in a day.';
  if (!form.shiftDurationHours) {
    errors.shiftDurationHours = 'Please enter shift length.';
  } else if (Number(form.shiftDurationHours) <= 0) {
    errors.shiftDurationHours = 'Shift length must be greater than 0.';
  }
  if (!form.shiftDurationUnit) errors.shiftDurationUnit = 'Please select shift unit.';
  if (!form.examStartDate) errors.examStartDate = 'Please select exam starting date.';
  if (!form.examEndDate) errors.examEndDate = 'Please select exam ending date.';
  if (form.examStartDate && form.examEndDate && new Date(form.examEndDate) < new Date(form.examStartDate)) {
    errors.examEndDate = 'Ending date cannot be before starting date.';
  }

  const shiftCount = Math.max(Number(form.shiftsPerDay) || 1, 1);
  const shiftStartTimes = normalizeShiftStartTimes(form.shiftStartTimes, shiftCount);
  const shiftStartMeridians = normalizeShiftStartMeridians(form.shiftStartMeridians, shiftStartTimes, shiftCount);
  if (shiftStartTimes.some((timeValue) => !timeValue)) {
    errors.shiftStartTimes = 'Please select starting time for every shift.';
  }
  if (shiftStartMeridians.some((meridianValue) => !meridianValue)) {
    errors.shiftStartMeridians = 'Please select AM/PM for every shift.';
  }

  return errors;
};

const validateAdmitCardForm = (form) => {
  const errors = {};
  if (!String(form.examTitle || '').trim()) errors.examTitle = 'Please enter exam title.';
  if (!form.studentId) errors.studentId = 'Please select student.';
  if (!String(form.rollNo || '').trim()) errors.rollNo = 'Roll number is required.';
  if (!String(form.className || '').trim()) errors.className = 'Class / section is required.';
  if (!form.examDate) errors.examDate = 'Please select exam date.';
  if (!form.reportingTime) errors.reportingTime = 'Please select reporting time.';
  if (!String(form.centerName || '').trim()) errors.centerName = 'Please enter exam center.';
  return errors;
};

const sectionLabelMap = {
  home: 'Overview',
  datesheet: 'Date Sheet',
  'datesheet-preview': 'Template Preview',
  questionpaper: 'Question Papers',
  admitcard: 'Admit Cards',
};

const fallbackExamClasses = [
  'LKG / A',
  'Class 5 / B',
  'Class 8 / A',
  'Class 8 / C',
  'Class 10 / A',
  'Class 12 / Science',
  'BCA Semester 1',
  'B.Tech CSE / A',
  'B.Com / A',
];

const buildDateSheetTemplateFileName = (className, examType) => {
  const safeClass = String(className || 'class').replace(/[^\w-]+/g, '-');
  const safeExam = String(examType || 'exam').replace(/[^\w-]+/g, '-');
  return `${safeClass}-${safeExam}-date-sheet.xls`;
};

const buildDateSheetTemplateDataUri = ({
  schoolName,
  className,
  classFrom,
  classTo,
  sectionWise,
  classColumns,
  examType,
  shiftsPerDay,
  shiftStartTimes,
  shiftDurationHours,
  shiftDurationUnit,
  examStartDate,
  examEndDate,
  subjectGrid = {},
}) => {
  const shiftColumns = buildShiftColumns(shiftStartTimes, shiftDurationHours, shiftDurationUnit);
  const dateColumns = buildExamDateColumns(examStartDate, examEndDate);
  const visibleShiftColumns = shiftColumns.length ? shiftColumns : [{ label: 'Shift', value: '' }];
  const totalColumns = 1 + dateColumns.length * visibleShiftColumns.length;
  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head>
        <meta charset="UTF-8" />
        <meta name="ProgId" content="Excel.Sheet" />
      </head>
      <body>
        <table border="0" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-family:Arial,sans-serif;min-width:1400px;">
          <tr>
            <th colspan="${totalColumns}" style="border:1px solid #0f172a;background:#0f766e;color:#ffffff;padding:12px 8px;font-size:18px;font-weight:700;text-align:center;text-transform:uppercase;">
              ${escapeTemplateValue(schoolName)}
            </th>
          </tr>
          <tr>
            <th colspan="${totalColumns}" style="border:1px solid #0f172a;background:#0f172a;color:#ffffff;padding:10px 8px;font-size:14px;font-weight:700;text-align:center;text-transform:uppercase;">
              ${escapeTemplateValue(examType)}
            </th>
          </tr>
          <tr>
            <th rowspan="2" style="border:1px solid #0f172a;background:#0f172a;color:#ffffff;padding:10px 8px;font-size:12px;font-weight:700;">Class</th>
            ${dateColumns.map((dateValue) => `
              <th colspan="${visibleShiftColumns.length}" style="border:1px solid #0f172a;background:#d1fae5;padding:10px 8px;font-size:12px;font-weight:700;text-align:center;">
                ${escapeTemplateValue(formatTemplateDate(dateValue))}
              </th>
            `).join('')}
          </tr>
          <tr>
            ${dateColumns.flatMap(() => visibleShiftColumns.map((column) => `
              <th style="border:1px solid #0f172a;background:#ecfdf5;padding:10px 8px;font-size:11px;font-weight:700;text-align:center;">
                ${escapeTemplateValue(column.label)}${column.value ? `<div style="margin-top:4px;font-size:10px;font-weight:600;">${escapeTemplateValue(column.value)}</div>` : ''}
              </th>
            `)).join('')}
          </tr>
          ${classColumns.map((column) => `
            <tr>
              <td style="border:1px solid #0f172a;padding:10px 8px;font-size:12px;font-weight:700;background:#f8fafc;">${escapeTemplateValue(column)}</td>
              ${dateColumns.flatMap((dateValue) => visibleShiftColumns.map((_, shiftIndex) => {
                const subjectName = subjectGrid[buildExamSubjectCellKey(column, dateValue, shiftIndex)] || '';
                return `<td style="border:1px solid #0f172a;padding:16px 12px;font-size:12px;height:52px;text-align:center;">${escapeTemplateValue(subjectName)}</td>`;
              })).join('')}
            </tr>
          `).join('')}
        </table>
      </body>
    </html>
  `;

  return `data:application/vnd.ms-excel;charset=utf-8,${encodeURIComponent(html)}`;
};

const escapeTemplateValue = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const buildClassRangeLabel = (classFrom, classTo) => `${classFrom} To ${classTo}`;

const parseClassDescriptor = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return { baseClass: '', section: '' };
  }
  const slashParts = normalized.split('/').map((part) => part.trim()).filter(Boolean);
  if (slashParts.length >= 2) {
    return {
      baseClass: slashParts.slice(0, slashParts.length - 1).join(' / '),
      section: slashParts[slashParts.length - 1],
    };
  }
  return { baseClass: normalized, section: '' };
};

const buildDateSheetClassColumns = ({ allClasses, baseClassOptions, classFrom, classTo, sectionWise }) => {
  const fromIndex = baseClassOptions.indexOf(classFrom);
  const toIndex = baseClassOptions.indexOf(classTo);
  if (fromIndex === -1 || toIndex === -1) return [];

  const [startIndex, endIndex] = fromIndex <= toIndex ? [fromIndex, toIndex] : [toIndex, fromIndex];
  const selectedBaseClasses = baseClassOptions.slice(startIndex, endIndex + 1);

  if (!sectionWise) {
    return selectedBaseClasses;
  }

  return selectedBaseClasses.flatMap((baseClass) => {
    const matchingSections = [...new Set(
      allClasses
        .map(parseClassDescriptor)
        .filter((entry) => entry.baseClass === baseClass)
        .map((entry) => entry.section)
        .filter(Boolean),
    )];

    return matchingSections.length
      ? matchingSections.map((section) => `${baseClass} / ${section}`)
      : [baseClass];
  });
};

const normalizeShiftStartTimes = (shiftStartTimes, shiftCountValue) => {
  const shiftCount = Math.max(Number(shiftCountValue) || 1, 1);
  const current = Array.isArray(shiftStartTimes) ? shiftStartTimes : [];
  return Array.from({ length: shiftCount }, (_, index) => current[index] || '');
};

const normalizeShiftStartMeridians = (shiftStartMeridians, shiftStartTimes, shiftCountValue) => {
  const shiftCount = Math.max(Number(shiftCountValue) || 1, 1);
  const currentMeridians = Array.isArray(shiftStartMeridians) ? shiftStartMeridians : [];
  const currentTimes = Array.isArray(shiftStartTimes) ? shiftStartTimes : [];
  return Array.from({ length: shiftCount }, (_, index) => currentMeridians[index] || (currentTimes[index] ? getTimeMeridian(currentTimes[index]) : ''));
};

const twelveHourOptions = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'));
const minuteOptions = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));

const getTimeHour12Value = (timeValue) => {
  const [hours] = String(timeValue || '').split(':').map(Number);
  if (Number.isNaN(hours)) return '';
  const normalizedHours = hours % 12 || 12;
  return String(normalizedHours).padStart(2, '0');
};

const getTimeMinuteValue = (timeValue) => {
  const [, minutes] = String(timeValue || '').split(':').map(Number);
  if (Number.isNaN(minutes)) return '';
  return String(minutes).padStart(2, '0');
};

const buildTimeFromTwelveHourParts = (hourValue, minuteValue, meridian = '') => {
  const normalizedHour = Number(hourValue);
  const normalizedMinute = minuteValue === '' ? 0 : Number(minuteValue);

  if (!hourValue || Number.isNaN(normalizedHour) || Number.isNaN(normalizedMinute)) {
    return '';
  }

  let hours = normalizedHour % 12;
  if (meridian === 'PM') {
    hours += 12;
  }

  return `${String(hours).padStart(2, '0')}:${String(normalizedMinute).padStart(2, '0')}`;
};

const calculateShiftEndTime = (startTime, shiftDurationHours, shiftDurationUnit = '') => {
  if (!startTime || !shiftDurationHours || !shiftDurationUnit) return '';
  const [hours, minutes] = String(startTime).split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return '';
  const durationMinutes = resolveShiftDurationMinutes(shiftDurationHours, shiftDurationUnit);
  if (Number.isNaN(durationMinutes)) return '';
  const totalMinutes = (hours * 60) + minutes + durationMinutes;
  const endHours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const endMinutes = totalMinutes % 60;
  return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
};

const buildShiftColumns = (shiftStartTimes, shiftDurationHours, shiftDurationUnit = '') => (
  normalizeShiftStartTimes(shiftStartTimes, shiftStartTimes?.length || 1).map((startTime, index) => {
    const endTime = calculateShiftEndTime(startTime, shiftDurationHours, shiftDurationUnit);
    return {
      label: `Shift ${index + 1}`,
      value: startTime ? `${formatTimeToTwelveHour(startTime)}${endTime ? ` - ${formatTimeToTwelveHour(endTime)}` : ''}` : '',
    };
  })
);

const resolveShiftDurationMinutes = (shiftDurationValue, shiftDurationUnit = '') => {
  const numericValue = Number(shiftDurationValue);
  if (Number.isNaN(numericValue) || !shiftDurationUnit) return Number.NaN;
  return shiftDurationUnit === 'minutes'
    ? Math.round(numericValue)
    : Math.round(numericValue * 60);
};

const formatShiftDurationLabel = (shiftDurationValue, shiftDurationUnit = '') => {
  if (!shiftDurationValue || !shiftDurationUnit) return 'Duration pending';
  return `${shiftDurationValue} ${shiftDurationUnit === 'minutes' ? 'minute(s)' : 'hour(s)'}`;
};

const getTimeMeridian = (timeValue) => {
  const [hours] = String(timeValue || '').split(':').map(Number);
  if (Number.isNaN(hours)) return 'AM';
  return hours >= 12 ? 'PM' : 'AM';
};

const convertTimeToMeridian = (timeValue, meridian) => {
  if (!timeValue || !meridian) return timeValue || '';
  const [hoursValue, minutesValue] = String(timeValue).split(':');
  let hours = Number(hoursValue);
  const minutes = Number(minutesValue);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return timeValue || '';
  }

  if (meridian === 'AM' && hours >= 12) {
    hours -= 12;
  }

  if (meridian === 'PM' && hours < 12) {
    hours += 12;
  }

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const formatTimeToTwelveHour = (timeValue) => {
  const [hours, minutes] = String(timeValue || '').split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return '';

  const hourValue = hours % 12 || 12;
  const meridian = hours >= 12 ? 'PM' : 'AM';
  return `${String(hourValue).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${meridian}`;
};

const buildExamDateColumns = (startDate, endDate) => {
  if (!startDate || !endDate) return [];

  const dates = [];
  const current = new Date(`${startDate}T00:00:00`);
  const finalDate = new Date(`${endDate}T00:00:00`);

  if (Number.isNaN(current.getTime()) || Number.isNaN(finalDate.getTime())) {
    return [];
  }

  while (current <= finalDate) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }

  return dates;
};

const formatTemplateDate = (value) => {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export default ExaminationManagement;
