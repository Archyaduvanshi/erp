import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Download,
  Eye,
  FileText,
  ScrollText,
  Search,
  Upload,
  UserRound,
  X,
} from 'lucide-react';
import { examApi, teacherApi, timetableApi, uploadApi } from '../../utils/api';

const TeacherExaminations = () => {
  const navigate = useNavigate();
  const [session] = useState(() => JSON.parse(localStorage.getItem('active_session')) || null);
  const [activeSection, setActiveSection] = useState('home');
  const [selectedQuestionPaperClass, setSelectedQuestionPaperClass] = useState('');
  const [dateSheetSearch, setDateSheetSearch] = useState('');
  const [questionSearch, setQuestionSearch] = useState('');
  const [previewRecord, setPreviewRecord] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [classTimetables, setClassTimetables] = useState([]);
  const [dateSheets, setDateSheets] = useState([]);
  const [questionPapers, setQuestionPapers] = useState([]);
  const [questionPaperDrafts, setQuestionPaperDrafts] = useState({});
  const [loadError, setLoadError] = useState('');

  const teacher = useMemo(() => {
    if (!session || session.role !== 'teacher') return null;
    return teachers.find((entry) => String(entry.id) === String(session.teacherId)) || null;
  }, [session, teachers]);

  const teacherName = teacher
    ? `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim() || teacher.teacherSystemId || 'Teacher'
    : 'Teacher';
  const assignedClasses = useMemo(() => {
    return deriveTeacherClassesFromTimetables(classTimetables, teacher);
  }, [classTimetables, teacher]);

  const teacherSubjectsByClass = useMemo(() => {
    return deriveTeacherSubjectsByClass(classTimetables, teacher);
  }, [classTimetables, teacher]);

  const filteredDateSheets = useMemo(() => {
    const query = dateSheetSearch.trim().toLowerCase();
    return dateSheets
      .filter((record) => {
        if (!query) return true;
        return (
          String(record.className || '').toLowerCase().includes(query)
          || String(record.examType || '').toLowerCase().includes(query)
          || String(record.fileName || '').toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        const classCompare = compareClassNames(a.className || '', b.className || '');
        if (classCompare !== 0) return classCompare;
        const examCompare = String(a.examType || '').localeCompare(String(b.examType || ''));
        if (examCompare !== 0) return examCompare;
        return String(a.fileName || '').localeCompare(String(b.fileName || ''));
      });
  }, [dateSheetSearch, dateSheets]);

  const availableQuestionPaperTitles = useMemo(() => {
    const titles = [
      ...dateSheets.map((record) => record.examType),
      ...questionPapers.map((record) => record.examTitle),
    ].filter(Boolean);

    return [...new Set(titles)].sort((a, b) => String(a).localeCompare(String(b)));
  }, [dateSheets, questionPapers]);

  const activeQuestionPaperClass = useMemo(() => {
    if (!assignedClasses.length) return '';
    return selectedQuestionPaperClass && assignedClasses.includes(selectedQuestionPaperClass)
      ? selectedQuestionPaperClass
      : assignedClasses[0];
  }, [assignedClasses, selectedQuestionPaperClass]);

  const selectedQuestionClassSubjects = useMemo(() => {
    return teacherSubjectsByClass[activeQuestionPaperClass] || [];
  }, [activeQuestionPaperClass, teacherSubjectsByClass]);

  const filteredQuestionPapers = useMemo(() => {
    const query = questionSearch.trim().toLowerCase();
    return questionPapers
      .filter((record) => {
        const allowedSubjects = teacherSubjectsByClass[record.className] || [];
        const classMatch = assignedClasses.includes(record.className);
        const subjectMatch = allowedSubjects.some((subjectName) => normalizeTeacherText(subjectName) === normalizeTeacherText(record.subjectName));
        return classMatch && subjectMatch;
      })
      .filter((record) => {
        if (!query) return true;
        return (
          record.examTitle?.toLowerCase().includes(query) ||
          record.className?.toLowerCase().includes(query) ||
          record.subjectName?.toLowerCase().includes(query) ||
          record.fileName?.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        const examCompare = String(a.examTitle || '').localeCompare(String(b.examTitle || ''));
        if (examCompare !== 0) return examCompare;
        return compareClassNames(a.className || '', b.className || '');
      });
  }, [assignedClasses, questionPapers, questionSearch, teacherSubjectsByClass]);

  const questionPaperHistory = useMemo(() => {
    if (!activeQuestionPaperClass) return [];
    const allowedSubjects = teacherSubjectsByClass[activeQuestionPaperClass] || [];

    const classHistory = questionPapers
      .filter((record) => record.className === activeQuestionPaperClass)
      .filter((record) => allowedSubjects.some((subjectName) => normalizeTeacherText(subjectName) === normalizeTeacherText(record.subjectName)))
      .sort((a, b) => {
        const examCompare = String(a.examTitle || '').localeCompare(String(b.examTitle || ''));
        if (examCompare !== 0) return examCompare;
        const subjectCompare = String(a.subjectName || '').localeCompare(String(b.subjectName || ''));
        if (subjectCompare !== 0) return subjectCompare;
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });

    const groupedHistory = classHistory.reduce((accumulator, record) => {
      const examTitle = String(record.examTitle || 'Exam Type Pending').trim() || 'Exam Type Pending';
      if (!accumulator[examTitle]) {
        accumulator[examTitle] = [];
      }
      accumulator[examTitle].push(record);
      return accumulator;
    }, {});

    return Object.entries(groupedHistory).map(([examTitle, records]) => ({
      examTitle,
      records,
    }));
  }, [activeQuestionPaperClass, questionPapers, teacherSubjectsByClass]);

  useEffect(() => {
    if (!session || session.role !== 'teacher') {
      navigate('/login');
    }
  }, [navigate, session]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [teacherResponse, timetableResponse, dateSheetResponse, questionPaperResponse] = await Promise.all([
          teacherApi.getAll(),
          timetableApi.getClassTimetables(),
          examApi.getDateSheets(),
          examApi.getQuestionPapers(),
        ]);
        setTeachers(teacherResponse);
        setClassTimetables(timetableResponse);
        setDateSheets(dateSheetResponse);
        setQuestionPapers(questionPaperResponse);
        setLoadError('');
      } catch (error) {
        setTeachers([]);
        setClassTimetables([]);
        setDateSheets([]);
        setQuestionPapers([]);
        setLoadError(error.message || 'Unable to load examination data.');
      }
    };

    if (session?.role === 'teacher') {
      loadData();
    }
  }, [session]);

  const refreshExamRecords = async () => {
    const [dateSheetResponse, questionPaperResponse] = await Promise.all([
      examApi.getDateSheets(),
      examApi.getQuestionPapers(),
    ]);
    setDateSheets(dateSheetResponse);
    setQuestionPapers(questionPaperResponse);
  };

  const handleQuestionPaperBrowse = async (className, subjectName, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const uploadedFile = await uploadApi.uploadFile(file, '/erp/examinations/question-papers');
      setQuestionPaperDrafts((current) => ({
        ...current,
        [buildQuestionDraftKey(className)]: {
          ...(current[buildQuestionDraftKey(className)] || {}),
          className,
          subjectName: subjectName || current[buildQuestionDraftKey(className)]?.subjectName || '',
          uploadedBy: teacherName,
          fileName: uploadedFile.name || file.name,
          fileData: uploadedFile.url,
          fileType: file.type || uploadedFile.fileType || 'application/octet-stream',
        },
      }));
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Unable to upload question paper to ImageKit.');
    }
  };

  const handleQuestionDraftChange = (className, subjectName, value) => {
    setQuestionPaperDrafts((current) => ({
      ...current,
      [buildQuestionDraftKey(className)]: {
        ...(current[buildQuestionDraftKey(className)] || {}),
        className,
        subjectName: subjectName || current[buildQuestionDraftKey(className)]?.subjectName || '',
        uploadedBy: teacherName,
        examTitle: value,
      },
    }));
  };

  const handleQuestionPaperSave = async (className) => {
    const draft = questionPaperDrafts[buildQuestionDraftKey(className)];
    const subjectName = draft?.subjectName?.trim();
    if (!draft?.fileData || !draft?.examTitle?.trim() || !className || !subjectName) return;

    try {
      await examApi.saveQuestionPaper({
        ...draft,
        examTitle: draft.examTitle.trim(),
        className: className.trim(),
        subjectName: subjectName.trim(),
        uploadedBy: teacherName,
      });

      setQuestionPaperDrafts((current) => ({
        ...current,
        [buildQuestionDraftKey(className)]: {
          className,
          subjectName: '',
          uploadedBy: teacherName,
          examTitle: '',
          fileName: '',
          fileData: '',
          fileType: '',
        },
      }));
      await refreshExamRecords();
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Unable to save question paper.');
    }
  };

  const handleDateSheetImageDownload = async (record) => {
    try {
      await downloadDateSheetAsImage(record);
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Unable to download date sheet as image.');
    }
  };

  if (!session || session.role !== 'teacher') return null;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef7ff_46%,#f8fafc_100%)] text-slate-900">
      <div className="border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => activeSection === 'home' ? navigate('/teacher') : setActiveSection('home')}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 transition hover:border-indigo-300 hover:text-indigo-700"
            >
              <ArrowLeft size={14} />
              {activeSection === 'home' ? 'Back' : 'Back To Cards'}
            </button>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-indigo-600">Teacher Examinations</p>
              <h1 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">Exam Desk For Teachers</h1>
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

        {activeSection === 'home' ? (
          <section className="mt-8 grid gap-5 md:grid-cols-2">
            <ActionCard
              icon={CalendarDays}
              title="Date Sheets"
              text="Open the class-wise examination date sheets uploaded by the college and browse every class in order."
              onClick={() => setActiveSection('datesheet')}
            />
            <ActionCard
              icon={ScrollText}
              title="Question Papers"
              text="View previous question papers and upload the next paper for subjects currently assigned to you."
              onClick={() => setActiveSection('questionpaper')}
            />
          </section>
        ) : null}

        {activeSection === 'datesheet' ? (
          <div className="mt-8">
            <Panel
              title="College Date Sheets"
              description="Sirf college ke uploaded ya generated date sheets yahan visible hain. Teacher yahan se koi change nahi kar sakta."
            >
              <div className="mt-6">
                <SearchInput value={dateSheetSearch} onChange={setDateSheetSearch} placeholder="Search class, exam type, file..." />
              </div>

              {filteredDateSheets.length > 0 ? (
                <div className="mt-6 grid gap-5">
                  {filteredDateSheets.map((record) => (
                    <RecordCard key={record.id} icon={CalendarDays} title={record.examType || 'Exam type pending'} subtitle={record.className || 'Class pending'}>
                      <InfoPill icon={FileText} text={record.fileName || 'File missing'} />
                      <button
                        type="button"
                        onClick={() => setPreviewRecord(record)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700"
                      >
                        <Eye size={14} />
                        Open Sheet
                      </button>
                    </RecordCard>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={CalendarDays}
                  title="No date sheet uploaded currently"
                  description="Abhi college ne koi date sheet upload ya generate nahi ki hai."
                />
              )}
            </Panel>
          </div>
        ) : null}

        {activeSection === 'questionpaper' ? (
          <div className="mt-8 space-y-8">
            <div className="grid gap-8 xl:grid-cols-[0.76fr_1.24fr]">
              <Panel
                title="My Teaching Classes"
                description="Click a class to open the subjects assigned to you. Previous uploads stay visible even if another teacher uploaded them."
              >
                {assignedClasses.length > 0 ? (
                  <div className="mt-6 grid gap-3">
                    {assignedClasses.map((className, index) => {
                      const isActive = activeQuestionPaperClass === className;
                      const paperCount = filteredQuestionPapers.filter((record) => record.className === className).length;

                      return (
                        <button
                          key={className}
                          type="button"
                          onClick={() => setSelectedQuestionPaperClass(className)}
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
                            <h4 className="mt-1 text-lg font-black tracking-tight">{className}</h4>
                          </div>
                          <div className="shrink-0 rounded-2xl bg-white px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 shadow-sm">
                            {paperCount} Paper{paperCount === 1 ? '' : 's'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState
                    icon={ScrollText}
                    title="No teaching classes found"
                    description="Assign classes to this teacher first, then the class-wise question paper upload view will appear here."
                  />
                )}
              </Panel>

              <Panel
                title={activeQuestionPaperClass ? `${activeQuestionPaperClass} Subjects` : 'Class Subjects'}
                description="Class choose karne ke baad exam type bharo, us class ka apna subject select karo, aur question paper upload karo."
              >
                <div className="mt-6">
                  <SearchInput value={questionSearch} onChange={setQuestionSearch} placeholder="Search exam title, class, subject..." />
                </div>
                {activeQuestionPaperClass && selectedQuestionClassSubjects.length > 0 ? (
                  <div className="mt-8 grid gap-5">
                    <article className="rounded-[1.8rem] border border-slate-200 bg-slate-50 p-5">
                      {(() => {
                        const draftKey = buildQuestionDraftKey(activeQuestionPaperClass);
                        const draft = questionPaperDrafts[draftKey] || {
                          subjectName: '',
                          examTitle: '',
                          fileName: '',
                          fileData: '',
                        };
                        const classPapers = filteredQuestionPapers.filter((record) => {
                          const query = questionSearch.trim().toLowerCase();
                          const matchesClass = record.className === activeQuestionPaperClass;
                          const matchesSubject = !draft.subjectName || record.subjectName === draft.subjectName;

                          if (!matchesClass || !matchesSubject) return false;
                          if (!query) return true;

                          return (
                            record.examTitle?.toLowerCase().includes(query) ||
                            record.className?.toLowerCase().includes(query) ||
                            record.subjectName?.toLowerCase().includes(query) ||
                            record.fileName?.toLowerCase().includes(query)
                          );
                        });

                        return (
                          <div className="flex flex-col gap-5">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                              <div>
                                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-indigo-700">Selected Class</p>
                                <h4 className="mt-1 text-xl font-black tracking-tight text-slate-950">{activeQuestionPaperClass}</h4>
                                <p className="mt-2 text-sm font-semibold text-slate-500">Teacher: {teacherName}</p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <InfoPill icon={UserRound} text={teacherName} />
                                <InfoPill icon={ScrollText} text={`${classPapers.length} Uploaded`} />
                              </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              <CreativeInput
                                list="teacher-exam-title-options"
                                label="Exam Type"
                                value={draft.examTitle || ''}
                                onChange={(e) => handleQuestionDraftChange(activeQuestionPaperClass, draft.subjectName || '', e.target.value)}
                                placeholder="Mid Term / Unit Test / Final Exam"
                              />
                              <CreativeSelect
                                label="Subject You Teach"
                                value={draft.subjectName || ''}
                                onChange={(e) => setQuestionPaperDrafts((current) => ({
                                  ...current,
                                  [draftKey]: {
                                    ...(current[draftKey] || {}),
                                    className: activeQuestionPaperClass,
                                    subjectName: e.target.value,
                                    uploadedBy: teacherName,
                                  },
                                }))}
                                options={['', ...selectedQuestionClassSubjects]}
                                renderOptionLabel={(option) => (option ? option : 'Select Subject')}
                              />
                            </div>

                            <FileUploadField
                              label="Question Paper File"
                              fileName={draft.fileName}
                              onBrowse={(e) => handleQuestionPaperBrowse(activeQuestionPaperClass, draft.subjectName || '', e)}
                            />

                            <div className="flex flex-wrap gap-3">
                              <button
                                type="button"
                                onClick={() => handleQuestionPaperSave(activeQuestionPaperClass)}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-white transition hover:bg-indigo-700"
                              >
                                <Upload size={16} />
                                Upload Question Paper
                              </button>
                              <div className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-500">
                                {draft.fileName || 'No file selected'}
                              </div>
                            </div>

                            {classPapers.length > 0 ? (
                              <div className="grid gap-3 border-t border-slate-200 pt-4">
                                {classPapers.map((record) => (
                                  <RecordCard key={record.id} icon={ScrollText} title={record.examTitle || 'Exam title pending'} subtitle={record.fileName || 'File missing'}>
                                    <InfoPill icon={FileText} text={record.subjectName || 'Subject pending'} />
                                    <InfoPill icon={UserRound} text={record.uploadedBy || 'Uploader pending'} />
                                    <button
                                      type="button"
                                      onClick={() => setPreviewRecord(record)}
                                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700"
                                    >
                                      <Upload size={14} />
                                      Open File
                                    </button>
                                  </RecordCard>
                                ))}
                              </div>
                            ) : (
                              <div className="rounded-[1.4rem] border border-dashed border-slate-300 bg-white px-5 py-8 text-center">
                                <p className="text-sm font-semibold text-slate-500">No paper uploaded yet for this class or selected subject.</p>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </article>
                  </div>
                ) : (
                  <EmptyState
                    icon={ScrollText}
                    title="No subjects available"
                    description="Is class ke timetable me is teacher ke subjects nahi mile. Pehle timetable me subject-teacher mapping save kijiye."
                  />
                )}
                <datalist id="teacher-exam-title-options">
                  {availableQuestionPaperTitles.map((examTitle) => (
                    <option key={examTitle} value={examTitle} />
                  ))}
                </datalist>
              </Panel>
            </div>

            <Panel
              title={activeQuestionPaperClass ? `${activeQuestionPaperClass} Upload History` : 'Question Paper Upload History'}
              description="Yeh history class aur subject ke hisab se college ka saved question-paper data dikhati hai, uploader teacher koi bhi ho."
            >
              {activeQuestionPaperClass ? (
                questionPaperHistory.length > 0 ? (
                  <div className="mt-4 grid gap-4">
                    {questionPaperHistory.map((group) => (
                      <div key={group.examTitle} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-indigo-700">Exam Type</p>
                            <h6 className="mt-1 text-base font-black tracking-tight text-slate-950">{group.examTitle}</h6>
                          </div>
                          <div className="rounded-2xl bg-white px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-600 shadow-sm">
                            {group.records.length} Paper{group.records.length === 1 ? '' : 's'}
                          </div>
                        </div>

                        <div className="mt-4 overflow-x-auto">
                          <table className="min-w-full text-left text-sm text-slate-700">
                            <thead>
                              <tr className="border-b border-slate-200 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                                <th className="px-3 py-3">Class</th>
                                <th className="px-3 py-3">Subject</th>
                                <th className="px-3 py-3">Uploaded Paper</th>
                                <th className="px-3 py-3">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.records.map((record) => (
                                <tr key={record.id} className="border-b border-slate-100 last:border-b-0">
                                  <td className="px-3 py-3 font-semibold text-slate-900">{record.className || 'Class pending'}</td>
                                  <td className="px-3 py-3 font-semibold text-slate-900">{record.subjectName || 'Subject pending'}</td>
                                  <td className="px-3 py-3">{record.fileName || 'File missing'}</td>
                                  <td className="px-3 py-3">
                                    <button
                                      type="button"
                                      onClick={() => setPreviewRecord(record)}
                                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700"
                                    >
                                      <Upload size={14} />
                                      Open File
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-[1.4rem] border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
                    <p className="text-sm font-semibold text-slate-500">Is class-subject me abhi koi saved question paper history nahi hai.</p>
                  </div>
                )
              ) : (
                <div className="mt-4 rounded-[1.4rem] border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
                  <p className="text-sm font-semibold text-slate-500">Upload history dekhne ke liye pehle apni teaching class select kijiye.</p>
                </div>
              )}
            </Panel>
          </div>
        ) : null}
      </main>

      {previewRecord ? (
        <FilePreviewModal
          record={previewRecord}
          onClose={() => setPreviewRecord(null)}
          onDownloadImage={handleDateSheetImageDownload}
        />
      ) : null}
    </div>
  );
};

const deriveTeacherClassesFromTimetables = (classTimetables, teacher) => {
  if (!teacher) return [];

  const teacherKeys = buildTeacherIdentityKeys(teacher);
  const classSet = new Set();

  classTimetables.forEach((record) => {
    const template = readTeacherTimetableTemplate(record);
    const hasTeacherSlot = template?.rows?.some((row) =>
      (row.slots || []).some((slot) => slotMatchesTeacher(slot, teacherKeys)),
    );

    if (hasTeacherSlot && record.className) {
      classSet.add(record.className);
    }
  });

  return [...classSet].sort(compareClassNames);
};

const deriveTeacherSubjectsByClass = (classTimetables, teacher) => {
  if (!teacher) return {};

  const teacherKeys = buildTeacherIdentityKeys(teacher);
  return classTimetables.reduce((accumulator, record) => {
    const template = readTeacherTimetableTemplate(record);
    if (!record?.className || !template?.rows?.length) return accumulator;

    const subjectSet = new Set();
    template.rows.forEach((row) => {
      (row.slots || []).forEach((slot) => {
        if (!slotMatchesTeacher(slot, teacherKeys)) return;
        const subjectName = String(slot?.subjectName || '').trim();
        if (subjectName) {
          subjectSet.add(subjectName);
        }
      });
    });

    if (subjectSet.size) {
      accumulator[record.className] = [...subjectSet].sort((left, right) => left.localeCompare(right));
    }

    return accumulator;
  }, {});
};

const readTeacherTimetableTemplate = (record) => {
  if (record?.templateData?.rows?.length) {
    return record.templateData;
  }

  if (record?.fileType === 'text/html' && typeof window !== 'undefined') {
    return parseTeacherTimetableFromHtmlDataUri(record.fileData, record.className);
  }

  return null;
};

const parseTeacherTimetableFromHtmlDataUri = (dataUri, className) => {
  const html = decodeTeacherTimetableHtml(dataUri);
  if (!html) return null;

  const parser = new DOMParser();
  const documentNode = parser.parseFromString(html, 'text/html');
  const table = documentNode.querySelector('table');
  if (!table) return null;

  const rows = Array.from(table.querySelectorAll('tr'));
  if (rows.length < 3) return null;

  const headerCells = Array.from(rows[1].querySelectorAll('th'));
  const lecturePlan = headerCells
    .slice(1)
    .map((cell) => {
      const text = cell.textContent?.replace(/\s+/g, ' ').trim() || '';
      const lectureMatch = text.match(/Lecture\s+(\d+)/i);
      if (!lectureMatch) return null;
      return { lectureNumber: Number(lectureMatch[1]) };
    })
    .filter(Boolean);

  const routineRows = rows
    .slice(2)
    .map((rowNode) => {
      const cells = Array.from(rowNode.querySelectorAll('td'));
      if (!cells.length) return null;

      const slotCells = cells.filter((cell, index) => index !== 0 && !/Lunch/i.test(cell.textContent || ''));
      return {
        slots: lecturePlan.map((_, slotIndex) => {
          const slotText = slotCells[slotIndex]?.textContent?.replace(/\s+/g, ' ').trim() || '';
          return {
            subjectName: extractTeacherSlotValue(slotText, 'S'),
            teacherName: extractTeacherSlotValue(slotText, 'T'),
          };
        }),
      };
    })
    .filter(Boolean);

  if (!lecturePlan.length || !routineRows.length) return null;

  return { className, lecturePlan, rows: routineRows };
};

const decodeTeacherTimetableHtml = (dataUri) => {
  if (!dataUri || typeof dataUri !== 'string') return '';
  const prefix = 'data:text/html;charset=utf-8,';
  if (!dataUri.startsWith(prefix)) return '';

  try {
    return decodeURIComponent(dataUri.slice(prefix.length));
  } catch {
    return '';
  }
};

const extractTeacherSlotValue = (slotText, key) => {
  const expression = new RegExp(`${key}:\\s*(.*?)(?=\\s+[A-Z]:|$)`, 'i');
  return slotText.match(expression)?.[1]?.trim() || '';
};

const buildTeacherIdentityKeys = (teacher) => {
  const fullName = `${teacher?.firstName || ''} ${teacher?.lastName || ''}`.trim();
  return [
    fullName,
    teacher?.teacherSystemId,
    teacher?.employeeId,
    fullName && teacher?.teacherSystemId ? `${fullName} (${teacher.teacherSystemId})` : '',
    fullName && teacher?.employeeId ? `${fullName} (${teacher.employeeId})` : '',
  ]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean);
};

const slotMatchesTeacher = (slot, teacherKeys) => {
  const teacherValue = String(slot?.teacherName || '').trim().toLowerCase();
  return Boolean(teacherValue) && teacherKeys.some((key) => key === teacherValue);
};

const compareClassNames = (a, b) => {
  const left = getClassSortValue(a);
  const right = getClassSortValue(b);
  return left.rank - right.rank || left.section.localeCompare(right.section) || a.localeCompare(b);
};

const getClassSortValue = (className) => {
  const normalized = String(className || '').toLowerCase();
  const section = String(className || '').split('/')[1]?.trim() || '';

  if (normalized.includes('nursery')) return { rank: 0, section };
  if (normalized.includes('lkg')) return { rank: 1, section };
  if (normalized.includes('ukg')) return { rank: 2, section };

  const classMatch = normalized.match(/class\s*(\d+)/);
  if (classMatch) {
    return { rank: 2 + Number(classMatch[1]), section };
  }

  return { rank: 1000, section };
};

const isImageFile = (record) => {
  return record.fileType?.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(record.fileName || '');
};

const isPdfFile = (record) => {
  return record.fileType === 'application/pdf' || /\.pdf$/i.test(record.fileName || '');
};

const isHtmlDateSheetFile = (record) => {
  return record.fileType === 'text/html'
    || record.fileType === 'application/vnd.ms-excel'
    || /\.(html?|xls)$/i.test(record.fileName || '');
};

const isPreviewableFile = (record) => {
  return Boolean(record?.fileData) && (isImageFile(record) || isPdfFile(record) || isHtmlDateSheetFile(record));
};

const canDownloadDateSheetAsImage = (record) => Boolean(record?.fileData) && (isImageFile(record) || isHtmlDateSheetFile(record));

const buildQuestionDraftKey = (className) => String(className || '');

const decodeDateSheetHtml = (dataUri) => {
  if (!dataUri || typeof dataUri !== 'string') return '';

  const supportedPrefixes = [
    'data:text/html;charset=utf-8,',
    'data:application/vnd.ms-excel;charset=utf-8,',
  ];

  const matchingPrefix = supportedPrefixes.find((prefix) => dataUri.startsWith(prefix));
  if (!matchingPrefix) return '';

  try {
    return decodeURIComponent(dataUri.slice(matchingPrefix.length));
  } catch (error) {
    return '';
  }
};

const getDateSheetHtmlMarkup = (record) => {
  const html = decodeDateSheetHtml(record?.fileData);
  if (!html || typeof window === 'undefined') return '';

  const parser = new DOMParser();
  const documentNode = parser.parseFromString(html, 'text/html');
  const table = documentNode.querySelector('table');
  if (table) {
    return table.outerHTML;
  }

  return documentNode.body?.innerHTML || '';
};

const buildImageDownloadName = (fileName) => {
  const safeBase = String(fileName || 'datesheet')
    .replace(/\.[^.]+$/, '')
    .replace(/[^\w-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return `${safeBase || 'datesheet'}.png`;
};

const triggerBrowserDownload = (href, fileName) => {
  const link = document.createElement('a');
  link.href = href;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const downloadMarkupAsImage = async (markup, fileName) => {
  if (!markup || typeof window === 'undefined') {
    throw new Error('Date sheet image could not be prepared.');
  }

  const wrappedMarkup = `
    <div xmlns="http://www.w3.org/1999/xhtml" style="display:inline-block;padding:24px;background:#ffffff;">
      ${markup}
    </div>
  `;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900">
      <foreignObject width="100%" height="100%">${wrappedMarkup}</foreignObject>
    </svg>
  `;

  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const objectUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await new Promise((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error('Unable to render date sheet image.'));
      nextImage.src = objectUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = image.width || 1600;
    canvas.height = image.height || 900;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Image download is not supported in this browser.');
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);
    triggerBrowserDownload(canvas.toDataURL('image/png'), fileName);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const downloadDateSheetAsImage = async (record) => {
  if (!record?.fileData || typeof window === 'undefined') {
    throw new Error('Date sheet image is not available.');
  }

  if (isImageFile(record)) {
    triggerBrowserDownload(record.fileData, buildImageDownloadName(record.fileName));
    return;
  }

  if (isHtmlDateSheetFile(record)) {
    const markup = getDateSheetHtmlMarkup(record);
    if (!markup) {
      throw new Error('This generated date sheet could not be converted to image.');
    }
    await downloadMarkupAsImage(markup, buildImageDownloadName(record.fileName));
    return;
  }

  throw new Error('Only image-based or generated table date sheets can be downloaded as image.');
};

const ActionCard = ({ icon, title, text, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex min-h-56 flex-col justify-between rounded-4xl border border-slate-200/80 bg-white p-6 text-left shadow-[0_20px_60px_-38px_rgba(15,23,42,0.45)] transition hover:-translate-y-1 hover:border-indigo-300 lg:p-8"
  >
    <div>
      <div className="flex items-start justify-between gap-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-indigo-100 text-indigo-700 transition group-hover:bg-indigo-600 group-hover:text-white">
          {React.createElement(icon, { size: 24 })}
        </div>
        <ArrowRight className="text-slate-300 transition group-hover:text-indigo-700" size={20} />
      </div>
      <h3 className="mt-7 font-serif text-3xl font-black italic tracking-tight text-slate-950">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-slate-500">{text}</p>
    </div>
    <span className="mt-6 text-[11px] font-black uppercase tracking-[0.22em] text-indigo-700">Open Page</span>
  </button>
);

const Panel = ({ title, description, children }) => (
  <section className="mt-8 rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
    <h3 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">{title}</h3>
    <p className="mt-2 text-sm leading-7 text-slate-500">{description}</p>
    {children}
  </section>
);

const RecordCard = ({ icon, title, subtitle, children }) => (
  <article className="rounded-[1.8rem] border border-slate-200 bg-slate-50 p-5">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
          {React.createElement(icon, { size: 20 })}
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

const SearchInput = ({ value, onChange, placeholder }) => (
  <div className="relative">
    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-12 py-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
    />
  </div>
);

const CreativeInput = ({ label, list, ...props }) => (
  <label className="block">
    <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</span>
    <input
      list={list}
      {...props}
      className="mt-2 w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
    />
  </label>
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

const StaticField = ({ label, value }) => (
  <div>
    <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</span>
    <div className="mt-2 rounded-2xl border-2 border-slate-200 bg-slate-100 px-4 py-3.5 text-sm font-semibold text-slate-700">
      {value || 'Not available'}
    </div>
  </div>
);

const FileUploadField = ({ label, fileName, onBrowse }) => (
  <label className="flex cursor-pointer flex-col rounded-[1.8rem] border-2 border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-center transition hover:border-indigo-300 hover:bg-white">
    <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</span>
    <span className="mt-3 text-sm font-semibold text-slate-700">{fileName || 'Choose PDF, image, or document file'}</span>
    <span className="mt-2 text-xs font-semibold text-slate-400">Click here to browse a question paper file</span>
    <input type="file" className="hidden" onChange={onBrowse} />
  </label>
);

const InfoPill = ({ icon, text }) => (
  <div className="inline-flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">
    {React.createElement(icon, { size: 15, className: 'text-indigo-700' })}
    <span>{text}</span>
  </div>
);

const EmptyState = ({ icon, title, description }) => (
  <div className="mt-8 rounded-4xl border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center">
    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-white text-slate-300 shadow-sm">
      {React.createElement(icon, { size: 34 })}
    </div>
    <h4 className="mt-6 font-serif text-3xl font-black italic tracking-tight text-slate-950">{title}</h4>
    <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-500">{description}</p>
  </div>
);

const FilePreviewModal = ({ record, onClose, onDownloadImage }) => {
  const canPreview = isPreviewableFile(record);
  const htmlMarkup = isHtmlDateSheetFile(record) ? getDateSheetHtmlMarkup(record) : '';
  const canDownloadAsImage = canDownloadDateSheetAsImage(record);

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-4xl bg-white shadow-[0_30px_90px_-35px_rgba(15,23,42,0.75)]">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-7">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-indigo-700">{record.className || record.examTitle || 'Examination File'}</p>
            <h3 className="mt-1 truncate font-serif text-2xl font-black italic tracking-tight text-slate-950">{record.fileName || 'Uploaded file'}</h3>
          </div>
          <div className="flex items-center gap-2">
            {canDownloadAsImage ? (
              <button
                type="button"
                onClick={() => onDownloadImage(record)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white transition hover:bg-indigo-600"
                title="Download as image"
              >
                <Download size={18} />
              </button>
            ) : null}
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
          {canPreview ? (
            <div className="min-h-[65vh] overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white">
              {isImageFile(record) ? (
                <img src={record.fileData} alt={record.fileName || 'Uploaded file'} className="mx-auto max-h-[72vh] w-auto max-w-full object-contain" />
              ) : isHtmlDateSheetFile(record) ? (
                <div className="overflow-auto p-4" dangerouslySetInnerHTML={{ __html: htmlMarkup }} />
              ) : (
                <iframe title={record.fileName || 'Uploaded file'} src={record.fileData} className="h-[72vh] w-full bg-white" />
              )}
            </div>
          ) : (
            <div className="flex min-h-[55vh] flex-col items-center justify-center rounded-[1.6rem] border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-100 text-indigo-700">
                <FileText size={34} />
              </div>
              <h4 className="mt-6 font-serif text-3xl font-black italic tracking-tight text-slate-950">Preview not available</h4>
              <p className="mt-3 max-w-md text-sm leading-7 text-slate-500">
                This file type cannot be previewed here. Teachers can only view college-uploaded date sheets and download image-ready sheets.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeacherExaminations;
