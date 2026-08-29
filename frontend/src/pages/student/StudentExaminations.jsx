import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  Download,
  Eye,
  FileText,
  Search,
  ScrollText,
  Ticket,
  X,
} from 'lucide-react';
import { examApi } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

const StudentExaminations = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [activeSection, setActiveSection] = useState('home');
  const [searchValue, setSearchValue] = useState('');
  const [selectedQuestionExamType, setSelectedQuestionExamType] = useState('');
  const [selectedQuestionSubject, setSelectedQuestionSubject] = useState('');
  const [previewRecord, setPreviewRecord] = useState(null);
  const portalQuery = useQuery({
    queryKey: ['examinations', 'student-me'],
    queryFn: () => examApi.getStudentMe(),
    enabled: session?.role === 'student',
  });

  const student = useMemo(() => {
    if (!portalQuery.data) return null;
    return {
      id: portalQuery.data.studentId,
      assignedClass: portalQuery.data.className,
      name: portalQuery.data.studentName,
    };
  }, [portalQuery.data]);

  const studentName = portalQuery.data?.studentName || 'Student';
  const dateSheets = portalQuery.data?.dateSheets || [];
  const questionPapers = portalQuery.data?.questionPapers || [];
  const admitCards = portalQuery.data?.admitCards || [];
  const loadError = portalQuery.error;

  const classDateSheets = useMemo(() => {
    if (!student?.assignedClass) return [];
    const query = searchValue.trim().toLowerCase();

    return dateSheets
      .filter((record) => doesStudentMatchDateSheet(record, student))
      .filter((record) => {
        if (!query) return true;
        return (
          String(record.examType || '').toLowerCase().includes(query) ||
          String(record.className || '').toLowerCase().includes(query) ||
          String(record.fileName || '').toLowerCase().includes(query)
        );
      })
      .sort((a, b) => String(a.examType || '').localeCompare(String(b.examType || '')));
  }, [dateSheets, searchValue, student]);

  const studentVisibleDateSheets = useMemo(() => (
    classDateSheets.map((record) => buildStudentVisibleDateSheetRecord(record, student))
  ), [classDateSheets, student]);

  const studentAdmitCards = useMemo(() => {
    if (!student) return [];
    const query = searchValue.trim().toLowerCase();
    const studentKeys = [student.enrollmentNo, String(student.id)].filter(Boolean).map(String);

    return admitCards
      .filter((record) => {
        const recordStudentId = String(record.studentId || '');
        const recordRollNo = String(record.rollNo || '');
        const recordName = String(record.studentName || '').trim().toLowerCase();
        return (
          studentKeys.includes(recordStudentId) ||
          studentKeys.includes(recordRollNo) ||
          recordName === studentName.toLowerCase()
        );
      })
      .filter((record) => {
        if (!query) return true;
        return (
          String(record.examTitle || '').toLowerCase().includes(query) ||
          String(record.rollNo || '').toLowerCase().includes(query) ||
          String(record.centerName || '').toLowerCase().includes(query) ||
          String(record.examDate || '').toLowerCase().includes(query)
        );
      })
      .sort((a, b) => new Date(a.examDate || 0).getTime() - new Date(b.examDate || 0).getTime());
  }, [admitCards, searchValue, student, studentName]);

  const classQuestionPapers = useMemo(() => {
    if (!student?.assignedClass) return [];
    const query = searchValue.trim().toLowerCase();

    return questionPapers
      .filter((record) => record.className === student.assignedClass)
      .filter((record) => {
        if (!query) return true;
        return (
          String(record.examTitle || '').toLowerCase().includes(query)
          || String(record.subjectName || '').toLowerCase().includes(query)
          || String(record.fileName || '').toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        const examCompare = String(a.examTitle || '').localeCompare(String(b.examTitle || ''));
        if (examCompare !== 0) return examCompare;
        return String(a.subjectName || '').localeCompare(String(b.subjectName || ''));
      });
  }, [questionPapers, searchValue, student]);

  const questionExamTypes = useMemo(() => (
    [...new Set(classQuestionPapers.map((record) => String(record.examTitle || '').trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b))
  ), [classQuestionPapers]);

  const activeQuestionExamType = useMemo(() => {
    if (!questionExamTypes.length) return '';
    return selectedQuestionExamType && questionExamTypes.includes(selectedQuestionExamType)
      ? selectedQuestionExamType
      : '';
  }, [questionExamTypes, selectedQuestionExamType]);

  const questionSubjects = useMemo(() => (
    [...new Set(
      classQuestionPapers
        .filter((record) => record.examTitle === activeQuestionExamType)
        .map((record) => String(record.subjectName || '').trim())
        .filter(Boolean),
    )].sort((a, b) => a.localeCompare(b))
  ), [activeQuestionExamType, classQuestionPapers]);

  const activeQuestionSubject = useMemo(() => {
    if (!questionSubjects.length) return '';
    return selectedQuestionSubject && questionSubjects.includes(selectedQuestionSubject)
      ? selectedQuestionSubject
      : '';
  }, [questionSubjects, selectedQuestionSubject]);

  const visibleQuestionPapers = useMemo(() => (
    classQuestionPapers
      .filter((record) => !activeQuestionExamType || record.examTitle === activeQuestionExamType)
      .filter((record) => !activeQuestionSubject || record.subjectName === activeQuestionSubject)
  ), [activeQuestionExamType, activeQuestionSubject, classQuestionPapers]);

  useEffect(() => {
    if (!session || session.role !== 'student') {
      navigate('/login');
    }
  }, [navigate, session]);

  const handleDownloadFile = (record, fallbackName) => {
    if (!record?.fileData) return;
    const link = document.createElement('a');
    link.href = record.fileData;
    link.download = record.fileName || fallbackName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePreviewFile = (record) => {
    if (!record?.fileData) return;
    setPreviewRecord(record);
  };

  if (!session || session.role !== 'student') return null;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef7ff_46%,#f8fafc_100%)] text-slate-900">
      <div className="border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => activeSection === 'home' ? navigate('/student') : setActiveSection('home')}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 transition hover:border-indigo-300 hover:text-indigo-700"
            >
              <ArrowLeft size={14} />
              {activeSection === 'home' ? 'Back' : 'Back To Cards'}
            </button>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-indigo-600">Student Examinations</p>
              <h1 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">My Examination Desk</h1>
            </div>
          </div>

          {activeSection !== 'home' ? (
            <button
              onClick={() => setActiveSection('home')}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-[11px] font-black uppercase tracking-[0.22em] text-slate-600 transition hover:border-indigo-300 hover:text-indigo-700"
            >
              <X size={14} />
              Close Section
            </button>
          ) : (
            <div className="hidden rounded-full border border-slate-200 bg-white px-5 py-3 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 md:inline-flex">
              Choose Date Sheet, Question Paper, Or Admit Card
            </div>
          )}
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-10 lg:py-10">
        {loadError ? (
          <div className="mb-6 rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
            {loadError.message || 'Unable to load examination data.'}
          </div>
        ) : null}
        {activeSection === 'home' && (
          <section className="grid gap-6 md:grid-cols-3">
            <EntryCard
              icon={<CalendarDays className="text-indigo-700" size={40} />}
              title="Datesheet"
              description="See only your own class exam datesheets in a read-only list just like the teacher datesheet desk."
              meta={`${classDateSheets.length} datesheet record${classDateSheets.length === 1 ? '' : 's'}`}
              onClick={() => setActiveSection('datesheet')}
            />
            <EntryCard
              icon={<ScrollText className="text-amber-700" size={40} />}
              title="Question Paper"
              description="Choose exam type and subject, then view or download only your own class question papers."
              meta={`${classQuestionPapers.length} question paper record${classQuestionPapers.length === 1 ? '' : 's'}`}
              onClick={() => setActiveSection('questionpaper')}
            />
            <EntryCard
              icon={<Ticket className="text-emerald-700" size={40} />}
              title="Admit Card"
              description="Open the admit cards generated only for this logged-in student."
              meta={`${studentAdmitCards.length} admit card record${studentAdmitCards.length === 1 ? '' : 's'}`}
              onClick={() => setActiveSection('admit')}
            />
          </section>
        )}

        {activeSection === 'datesheet' && (
          <section className="mt-8">
            <Panel
              title="Date Sheet"
              description={`Only the relevant exam date sheets for ${student?.assignedClass || 'this class'} are visible here.`}
            >
              <div className="mt-6">
                <SearchInput value={searchValue} onChange={setSearchValue} placeholder="Search exam type or file..." />
              </div>

              {studentVisibleDateSheets.length ? (
                <div className="mt-6 grid gap-6">
                  {studentVisibleDateSheets.map((record) => (
                    <article key={record.id} className="rounded-[1.8rem] border border-slate-200 bg-slate-50 p-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-indigo-700">
                            {resolveStudentDateSheetClassLabel(record, student)}
                          </p>
                          <h4 className="mt-2 text-xl font-black tracking-tight text-slate-950">{record.examType || 'Exam schedule'}</h4>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <InfoPill icon={FileText} text={record.fileName || 'Datesheet available'} />
                          <button
                            type="button"
                            onClick={() => handleDownloadFile(record, record.fileName || 'date-sheet')}
                            className="inline-flex items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-indigo-700 transition hover:bg-indigo-100"
                          >
                            <Download size={14} />
                            Download
                          </button>
                        </div>
                      </div>

                      {!isPreviewableExamFile(record) ? (
                        <div className="mt-5 rounded-[1.4rem] border border-dashed border-slate-300 bg-white px-5 py-5 text-sm leading-7 text-slate-500">
                          Ye date sheet browser ke andar preview nahi hoti. Isse download karke khola ja sakta hai.
                        </div>
                      ) : (
                        <div className="mt-5 overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white">
                          {String(record.fileType || '').startsWith('image/') ? (
                            <img src={record.fileData} alt={record.fileName || 'Date sheet'} className="mx-auto max-h-[78vh] w-auto max-w-full object-contain" />
                          ) : (
                            <iframe title={record.fileName || 'Date sheet'} src={record.fileData} className="h-[78vh] w-full bg-white" />
                          )}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState title="No datesheet available" description="No exam datesheet is currently saved for this student's class." />
              )}
            </Panel>
          </section>
        )}

        {activeSection === 'questionpaper' && (
          <section className="mt-8 grid gap-8 xl:grid-cols-[0.76fr_1.24fr]">
            <Panel
              title="Exam Type"
              description="Student sirf apni class ke uploaded question papers dekh sakta hai. Pehle exam type select karo."
            >
              <div className="mt-6">
                <SearchInput value={searchValue} onChange={setSearchValue} placeholder="Search exam type, subject, file..." />
              </div>

              {questionExamTypes.length > 0 ? (
                <div className="mt-6 grid gap-3">
                  {questionExamTypes.map((examType, index) => {
                    const isActive = activeQuestionExamType === examType;
                    return (
                      <button
                        key={examType}
                        type="button"
                        onClick={() => setSelectedQuestionExamType(examType)}
                        className={`flex items-center justify-between rounded-[1.6rem] border px-4 py-4 text-left transition ${
                          isActive
                            ? 'border-indigo-300 bg-indigo-50 text-indigo-950'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-indigo-200 hover:bg-white'
                        }`}
                      >
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-indigo-700">
                            {String(index + 1).padStart(2, '0')}
                          </p>
                          <h4 className="mt-1 text-lg font-black tracking-tight">{examType}</h4>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <EmptyState title="No question papers available" description="No uploaded question paper is currently available for this student's class." />
              )}
            </Panel>

            <Panel
              title={activeQuestionExamType ? `${activeQuestionExamType} Question Papers` : 'Question Papers'}
              description="Exam type choose karke subject select karo, phir us subject ka uploaded paper view ya download karo."
            >
              {activeQuestionExamType ? (
                questionSubjects.length ? (
                  <div className="mt-6 space-y-5">
                    <CreativeSelect
                      label="Subject"
                      value={activeQuestionSubject}
                      onChange={(e) => setSelectedQuestionSubject(e.target.value)}
                      options={['', ...questionSubjects]}
                      renderOptionLabel={(value) => value || 'Select subject'}
                    />

                    {visibleQuestionPapers.length ? (
                      <div className="grid gap-4">
                        {visibleQuestionPapers.map((record) => (
                          <RecordCard key={record.id} icon={ScrollText} title={record.subjectName || 'Subject pending'} subtitle={record.examTitle || 'Exam type pending'}>
                            <InfoPill icon={FileText} text={record.fileName || 'File missing'} />
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => handlePreviewFile(record)}
                                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700"
                              >
                                <Eye size={14} />
                                View
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownloadFile(record, `${record.subjectName || 'question-paper'}.pdf`)}
                                className="inline-flex items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-indigo-700 transition hover:bg-indigo-100"
                              >
                                <Download size={14} />
                                Download
                              </button>
                            </div>
                          </RecordCard>
                        ))}
                      </div>
                    ) : (
                      <EmptyState title="No paper found" description="Selected subject ke liye abhi koi question paper available nahi hai." />
                    )}
                  </div>
                ) : (
                  <EmptyState title="No subjects available" description="Is exam type me abhi koi subject question paper available nahi hai." />
                )
              ) : (
                <EmptyState title="Select exam type" description="Pehle exam type choose karo, phir subject aur question papers yahan show honge." />
              )}
            </Panel>
          </section>
        )}

        {activeSection === 'admit' && (
          <section className="mt-8 rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">My Admit Card</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Only admit cards created for {studentName} are shown here.
                </p>
              </div>
              <SearchInput value={searchValue} onChange={setSearchValue} placeholder="Search exam, center, date..." />
            </div>

            {studentAdmitCards.length ? (
              <div className="mt-8 grid gap-4">
                {studentAdmitCards.map((card) => (
                  <article key={card.id} className="rounded-[1.8rem] border border-slate-200 bg-slate-50 p-5">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">{card.examTitle || 'Exam pending'}</p>
                    <h3 className="mt-2 text-xl font-black tracking-tight text-slate-950">{card.className || student?.assignedClass || 'Class pending'}</h3>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <StaticInfoPill label="Roll No" value={card.rollNo || student?.enrollmentNo || '-'} />
                      <StaticInfoPill label="Exam Date" value={card.examDate || 'Not scheduled'} />
                      <StaticInfoPill label="Center" value={card.centerName || 'Not assigned'} />
                      <StaticInfoPill label="Reporting Time" value={card.reportingTime || 'Not added'} />
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="No admit card yet" description="Once the institution generates an admit card for this student, it will appear here." />
            )}
          </section>
        )}

        {previewRecord ? (
          <FilePreviewModal record={previewRecord} onClose={() => setPreviewRecord(null)} onDownload={handleDownloadFile} />
        ) : null}
      </main>
    </div>
  );
};

const Panel = ({ title, description, children }) => (
  <section className="mt-8 rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
    <h3 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">{title}</h3>
    <p className="mt-2 text-sm leading-7 text-slate-500">{description}</p>
    {children}
  </section>
);

const CreativeSelect = ({ label, value, onChange, options, renderOptionLabel }) => (
  <label className="block">
    <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</span>
    <select
      value={value}
      onChange={onChange}
      className="mt-2 w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
    >
      {options.map((option) => (
        <option key={option || 'blank-option'} value={option}>
          {renderOptionLabel ? renderOptionLabel(option) : option}
        </option>
      ))}
    </select>
  </label>
);

const RecordCard = ({ icon: Icon, title, subtitle, children }) => (
  <article className="rounded-[1.8rem] border border-slate-200 bg-slate-50 p-5">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <h4 className="truncate text-lg font-black tracking-tight text-slate-950">{title}</h4>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-indigo-700">{subtitle}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  </article>
);

const InfoPill = ({ icon: Icon, text, label, value }) => {
  if (label) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
        <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">
      <Icon size={15} className="text-indigo-700" />
      <span>{text}</span>
    </div>
  );
};

const FilePreviewModal = ({ record, onClose, onDownload }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm">
    <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-4xl bg-white shadow-[0_30px_90px_-35px_rgba(15,23,42,0.75)]">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-7">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-indigo-700">{record.className || record.examTitle || 'Examination File'}</p>
          <h3 className="mt-1 truncate font-serif text-2xl font-black italic tracking-tight text-slate-950">{record.fileName || record.subjectName || 'Uploaded file'}</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onDownload(record, record.fileName || 'examination-file')}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white transition hover:bg-indigo-600"
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
          {String(record.fileType || '').startsWith('image/') ? (
            <img src={record.fileData} alt={record.fileName || 'Uploaded file'} className="mx-auto max-h-[72vh] w-auto max-w-full object-contain" />
          ) : (
            <iframe title={record.fileName || 'Uploaded file'} src={record.fileData} className="h-[72vh] w-full bg-white" />
          )}
        </div>
      </div>
    </div>
  </div>
);

const EntryCard = ({ icon, title, description, meta, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="rounded-[2rem] border border-slate-200 bg-white p-8 text-left shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] transition hover:-translate-y-2 hover:border-indigo-200 hover:shadow-[0_30px_70px_-40px_rgba(79,70,229,0.35)]"
  >
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50">
      {icon}
    </div>
    <h3 className="mt-6 font-serif text-3xl font-black italic tracking-tight text-slate-950">{title}</h3>
    <p className="mt-3 text-sm leading-7 text-slate-500">{description}</p>
    <p className="mt-5 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{meta}</p>
  </button>
);

const SearchInput = ({ value, onChange, placeholder }) => (
  <div className="relative w-full lg:w-80">
    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-12 py-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
    />
  </div>
);

const StaticInfoPill = ({ label, value }) => (
  <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
    <p className="mt-2 text-sm font-bold text-slate-800">{value}</p>
  </div>
);

const EmptyState = ({ title, description }) => (
  <div className="rounded-4xl border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center">
    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-white text-slate-300 shadow-sm">
      <FileText size={34} />
    </div>
    <h3 className="mt-6 font-serif text-3xl font-black italic tracking-tight text-slate-950">{title}</h3>
    <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-500">{description}</p>
  </div>
);

const doesStudentMatchDateSheet = (record, student) => {
  const assignedClass = normalizeExamClassValue(student?.assignedClass);
  if (!assignedClass) return false;

  const assignedDescriptor = parseExamClassDescriptor(assignedClass);
  const recordClass = normalizeExamClassValue(record?.className);
  const recordDescriptor = parseExamClassDescriptor(recordClass);

  if (record?.classFrom && record?.classTo) {
    return isBaseClassWithinRange(assignedDescriptor.baseClass, record.classFrom, record.classTo);
  }

  if (record?.sectionWise) {
    return recordClass === assignedClass;
  }

  return recordClass === assignedClass || recordDescriptor.baseClass === assignedDescriptor.baseClass;
};

const buildStudentVisibleDateSheetRecord = (record, student) => {
  if (!record) return null;

  if (isGeneratedDateSheetRecord(record)) {
    const filteredHtml = filterGeneratedDateSheetForStudent(record, student);
    if (filteredHtml) {
      return {
        ...record,
        fileType: 'text/html',
        fileData: filteredHtml,
      };
    }
  }

  return record;
};

const resolveStudentDateSheetClassLabel = (record, student) => (
  `Class ${student?.assignedClass || record?.className || 'pending'}`
);

const isGeneratedDateSheetRecord = (record) => {
  const fileType = String(record?.fileType || '').toLowerCase();
  const fileData = String(record?.fileData || '');
  return (
    fileType.includes('application/vnd.ms-excel') ||
    fileType.includes('text/html') ||
    fileData.startsWith('data:application/vnd.ms-excel') ||
    fileData.startsWith('data:text/html')
  );
};

const filterGeneratedDateSheetForStudent = (record, student) => {
  const html = decodeGeneratedDateSheetData(record?.fileData);
  if (!html || typeof window === 'undefined') return '';

  const assignedClass = normalizeExamClassValue(student?.assignedClass);
  if (!assignedClass) return '';

  const assignedDescriptor = parseExamClassDescriptor(assignedClass);
  const parser = new DOMParser();
  const documentNode = parser.parseFromString(html, 'text/html');
  const table = documentNode.querySelector('table');
  if (!table) return '';

  const rows = Array.from(table.querySelectorAll('tr'));
  if (rows.length <= 4) return '';

  const headerRows = rows.slice(0, 4);
  const dataRows = rows.slice(4);
  const matchingRows = dataRows.filter((row) => {
    const firstCell = row.querySelector('td');
    const rowLabel = normalizeExamClassValue(firstCell?.textContent);
    if (!rowLabel) return false;

    if (rowLabel === assignedClass) return true;
    return parseExamClassDescriptor(rowLabel).baseClass === assignedDescriptor.baseClass;
  });

  table.innerHTML = [...headerRows, ...(matchingRows.length ? matchingRows : dataRows)]
    .map((row) => row.outerHTML)
    .join('');

  const footerNote = documentNode.querySelector('p');
  if (footerNote) {
    footerNote.textContent = `Class ${assignedClass}`;
  }

  return `data:text/html;charset=utf-8,${encodeURIComponent(documentNode.documentElement.outerHTML)}`;
};

const decodeGeneratedDateSheetData = (dataUri) => {
  const value = String(dataUri || '');
  const prefixes = [
    'data:application/vnd.ms-excel;charset=utf-8,',
    'data:text/html;charset=utf-8,',
  ];
  const matchedPrefix = prefixes.find((prefix) => value.startsWith(prefix));
  if (!matchedPrefix) return '';

  try {
    return decodeURIComponent(value.slice(matchedPrefix.length));
  } catch {
    return '';
  }
};

const isPreviewableExamFile = (record) => {
  const fileType = String(record?.fileType || '').toLowerCase();
  const fileName = String(record?.fileName || '').toLowerCase();
  return Boolean(record?.fileData) && (
    fileType.startsWith('image/') ||
    fileType === 'application/pdf' ||
    fileType === 'text/html' ||
    /\.(png|jpe?g|gif|webp|svg|pdf|html?)$/i.test(fileName)
  );
};

const normalizeExamClassValue = (value) => String(value || '').trim();

const parseExamClassDescriptor = (value) => {
  const normalized = normalizeExamClassValue(value);
  if (!normalized) return { baseClass: '', section: '' };

  const slashParts = normalized.split('/').map((part) => part.trim()).filter(Boolean);
  if (slashParts.length >= 2) {
    return {
      baseClass: slashParts.slice(0, slashParts.length - 1).join(' / '),
      section: slashParts[slashParts.length - 1],
    };
  }

  return { baseClass: normalized, section: '' };
};

const isBaseClassWithinRange = (baseClass, fromClass, toClass) => {
  const target = getExamClassSortValue(baseClass);
  const start = getExamClassSortValue(fromClass);
  const end = getExamClassSortValue(toClass);
  const minRank = Math.min(start, end);
  const maxRank = Math.max(start, end);
  return target >= minRank && target <= maxRank;
};

const getExamClassSortValue = (className) => {
  const normalized = String(className || '').toLowerCase();
  if (normalized.includes('nursery')) return 0;
  if (normalized.includes('lkg')) return 1;
  if (normalized.includes('ukg')) return 2;

  const classMatch = normalized.match(/class\s*(\d+)/);
  if (classMatch) return 10 + Number(classMatch[1]);

  return 1000;
};

export default StudentExaminations;
