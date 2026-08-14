import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ClipboardPenLine,
  GraduationCap,
  PencilLine,
  Save,
  Search,
  Users,
  X,
} from 'lucide-react';
import { examApi, marksApi, studentApi, teacherApi, timetableApi } from '../../utils/api';

const FALLBACK_EXAM_TYPES = ['Class Test 1', 'Class Test 2', 'Unit Test 1', 'Half Yearly', 'Annual Exam'];

const TeacherMarks = () => {
  const navigate = useNavigate();
  const [session] = useState(() => JSON.parse(localStorage.getItem('active_session')) || null);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [classTimetables, setClassTimetables] = useState([]);
  const [dateSheets, setDateSheets] = useState([]);
  const [marksRecords, setMarksRecords] = useState([]);
  const [examRenames, setExamRenames] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [marksMap, setMarksMap] = useState({});
  const [maxMarksMap, setMaxMarksMap] = useState({});
  const [classSearch, setClassSearch] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [manualExamTitle, setManualExamTitle] = useState('');
  const [extraExamColumns, setExtraExamColumns] = useState([]);
  const [renameDraft, setRenameDraft] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    if (!session || session.role !== 'teacher') {
      navigate('/login');
    }
  }, [navigate, session]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [teacherResponse, studentResponse, timetableResponse, dateSheetResponse, marksResponse, renameResponse] = await Promise.all([
          teacherApi.getAll(),
          studentApi.getAll(),
          timetableApi.getClassTimetables(),
          examApi.getDateSheets(),
          marksApi.getAll(),
          marksApi.getExamRenames(),
        ]);
        setTeachers(teacherResponse);
        setStudents(studentResponse);
        setClassTimetables(timetableResponse);
        setDateSheets(dateSheetResponse);
        setMarksRecords(marksResponse);
        setExamRenames(renameResponse);
        setLoadError('');
      } catch (error) {
        setTeachers([]);
        setStudents([]);
        setClassTimetables([]);
        setDateSheets([]);
        setLoadError(error.message || 'Unable to load teacher marks data.');
      }
    };

    if (session?.role === 'teacher') {
      loadData();
    }
  }, [session]);

  const teacher = useMemo(() => {
    if (!session || session.role !== 'teacher') return null;
    return teachers.find((entry) => String(entry.id) === String(session.teacherId)) || null;
  }, [session, teachers]);

  const teacherName = teacher
    ? `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim() || teacher.teacherSystemId || 'Teacher'
    : 'Teacher';

  const teacherSubjectsByClass = useMemo(() => (
    deriveTeacherSubjectsByClass(classTimetables, teacher)
  ), [classTimetables, teacher]);

  const teachingClasses = useMemo(() => {
    const classes = Object.keys(teacherSubjectsByClass);
    return classes.filter((className) => students.some((student) => student.assignedClass === className));
  }, [students, teacherSubjectsByClass]);

  const filteredClasses = useMemo(() => {
    const query = classSearch.trim().toLowerCase();
    return teachingClasses.filter((className) => !query || className.toLowerCase().includes(query));
  }, [classSearch, teachingClasses]);

  const selectedSubjects = useMemo(() => (
    teacherSubjectsByClass[selectedClass] || []
  ), [selectedClass, teacherSubjectsByClass]);

  const selectedClassAllStudents = useMemo(() => (
    students
      .filter((student) => student.assignedClass === selectedClass)
      .sort((a, b) => getStudentName(a).localeCompare(getStudentName(b)))
  ), [selectedClass, students]);

  const visibleStudents = useMemo(() => {
    const query = studentSearch.trim().toLowerCase();
    return selectedClassAllStudents.filter((student) => {
      if (!query) return true;
      return getStudentName(student).toLowerCase().includes(query) || getStudentRollNo(student).toLowerCase().includes(query);
    });
  }, [selectedClassAllStudents, studentSearch]);

  const examColumns = useMemo(() => (
    buildExamColumns({
      selectedClass,
      selectedSubject,
      dateSheets,
      examSlots: [],
      marksRecords,
      extraExamColumns,
      examRenames,
    })
  ), [dateSheets, examRenames, extraExamColumns, marksRecords, selectedClass, selectedSubject]);

  const savedMarksForSubject = useMemo(() => (
    marksRecords
      .filter((record) => record.className === selectedClass)
      .filter((record) => record.subjectName === selectedSubject)
  ), [marksRecords, selectedClass, selectedSubject]);

  useEffect(() => {
    if (!selectedClass || !selectedSubject || !examColumns.length) {
      setMarksMap({});
      setMaxMarksMap({});
      return;
    }

    const nextMarks = {};
    const nextMaxMarks = {};
    examColumns.forEach((column) => {
      const existingMaxRecord = savedMarksForSubject.find((record) => record.examTitle === column.examTitle && record.maxMarks);
      nextMaxMarks[column.examTitle] = existingMaxRecord?.maxMarks ? String(existingMaxRecord.maxMarks) : '';
      selectedClassAllStudents.forEach((student) => {
        const savedRecord = savedMarksForSubject.find((record) => (
          record.examTitle === column.examTitle && String(record.studentId) === String(student.id)
        ));
        nextMarks[buildMarksCellKey(column.examTitle, student.id)] = savedRecord?.marksObtained ?? '';
      });
    });
    setMaxMarksMap(nextMaxMarks);
    setMarksMap(nextMarks);
  }, [examColumns, savedMarksForSubject, selectedClass, selectedClassAllStudents, selectedSubject]);

  const openClass = (className) => {
    setSelectedClass(className);
    setSelectedSubject('');
    setStudentSearch('');
    setManualExamTitle('');
    setExtraExamColumns([]);
    setSaveMessage('');
    setMarksMap({});
    setMaxMarksMap({});
  };

  const openSubject = (subjectName) => {
    setSelectedSubject(subjectName);
    setStudentSearch('');
    setManualExamTitle('');
    setExtraExamColumns([]);
    setSaveMessage('');
    setMarksMap({});
    setMaxMarksMap({});
  };

  const handleAddManualExam = () => {
    const examTitle = manualExamTitle.trim();
    if (!examTitle || examColumns.some((column) => normalizeKey(column.examTitle) === normalizeKey(examTitle))) return;
    setExtraExamColumns((current) => [...current, { examTitle, source: 'manual' }]);
    setManualExamTitle('');
  };

  const handleMarksChange = (examTitle, studentId, value) => {
    if (value && !/^\d{0,3}(\.\d{0,2})?$/.test(value)) return;
    setMarksMap((current) => ({
      ...current,
      [buildMarksCellKey(examTitle, studentId)]: value,
    }));
  };

  const handleMaxMarksChange = (examTitle, value) => {
    if (value && !/^\d{0,3}(\.\d{0,2})?$/.test(value)) return;
    setMaxMarksMap((current) => ({
      ...current,
      [examTitle]: value,
    }));
  };

  const handleOpenRenameModal = (examTitle) => {
    setRenameDraft({
      oldExamTitle: examTitle,
      nextExamTitle: examTitle,
    });
  };

  const handleRenameExamColumn = async (event) => {
    event.preventDefault();
    const oldExamTitle = renameDraft?.oldExamTitle || '';
    const nextExamTitle = renameDraft?.nextExamTitle?.trim() || '';
    if (!nextExamTitle || normalizeKey(nextExamTitle) === normalizeKey(oldExamTitle)) return;
    if (examColumns.some((column) => normalizeKey(column.examTitle) === normalizeKey(nextExamTitle))) return;

    const nextMarksMap = {};
    Object.entries(marksMap).forEach(([key, value]) => {
      const oldPrefix = `${normalizeKey(oldExamTitle)}-`;
      if (key.startsWith(oldPrefix)) {
        nextMarksMap[key.replace(oldPrefix, `${normalizeKey(nextExamTitle)}-`)] = value;
        return;
      }
      nextMarksMap[key] = value;
    });

    setMarksMap(nextMarksMap);
    setMaxMarksMap((current) => {
      const nextMaxMarksMap = { ...current, [nextExamTitle]: current[oldExamTitle] || '' };
      delete nextMaxMarksMap[oldExamTitle];
      return nextMaxMarksMap;
    });
    setExtraExamColumns((current) => current.map((column) => (
      normalizeKey(column.examTitle) === normalizeKey(oldExamTitle)
        ? { ...column, examTitle: nextExamTitle }
        : column
    )));

    try {
      const renameResponse = await marksApi.renameExam({
        className: selectedClass,
        subjectName: selectedSubject,
        oldTitle: oldExamTitle,
        newTitle: nextExamTitle,
      });
      const marksResponse = await marksApi.getAll();
      setExamRenames(renameResponse);
      setMarksRecords(marksResponse);
      setRenameDraft(null);
      setLoadError('');
      setSaveMessage(`${oldExamTitle} column ka naam ${nextExamTitle} ho gaya.`);
    } catch (error) {
      setLoadError(error.message || 'Unable to rename exam column in database.');
    }
  };

  const handleSaveMarks = async (event) => {
    event.preventDefault();
    if (!selectedClass || !selectedSubject || !examColumns.length || !selectedClassAllStudents.length) return;

    const hasInvalidEntry = examColumns.some((column) => {
      const maxMarks = Number(maxMarksMap[column.examTitle]);
      if (!maxMarks || maxMarks <= 0) return true;
      return selectedClassAllStudents.some((student) => {
        const value = marksMap[buildMarksCellKey(column.examTitle, student.id)];
        const numericValue = Number(value);
        return value === '' || value === undefined || Number.isNaN(numericValue) || numericValue < 0 || numericValue > maxMarks;
      });
    });
    if (hasInvalidEntry) return;

    try {
      await marksApi.saveRegister({
        className: selectedClass,
        subjectName: selectedSubject,
        uploadedBy: teacherName,
        exams: examColumns.map((column) => ({
          examTitle: column.examTitle,
          examDate: column.examDate || '',
          maxMarks: Number(maxMarksMap[column.examTitle]),
          entries: selectedClassAllStudents.map((student) => ({
            studentId: student.id,
            studentName: getStudentName(student),
            rollNo: getStudentRollNo(student),
            marksObtained: Number(marksMap[buildMarksCellKey(column.examTitle, student.id)]),
          })),
        })),
      });
      const marksResponse = await marksApi.getAll();
      setMarksRecords(marksResponse);
      setLoadError('');
      setSaveMessage(`${selectedClass} ${selectedSubject} ki marks register sheet database me save ho gayi.`);
    } catch (error) {
      setLoadError(error.message || 'Unable to save marks register in database.');
    }
  };

  if (!session || session.role !== 'teacher') return null;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#fff7ed_44%,#f8fafc_100%)] text-slate-900">
      <div className="border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => {
                if (selectedSubject) {
                  setSelectedSubject('');
                  setSaveMessage('');
                  return;
                }
                if (selectedClass) {
                  setSelectedClass('');
                  setSaveMessage('');
                  return;
                }
                navigate('/teacher');
              }}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 transition hover:border-amber-300 hover:text-amber-700"
            >
              <ArrowLeft size={14} />
              {selectedSubject ? 'Back To Subjects' : selectedClass ? 'Back To Classes' : 'Back'}
            </button>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-amber-600">Teacher Marks</p>
              <h1 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">
                {selectedSubject ? `${selectedSubject} Marks Register` : selectedClass ? `${selectedClass} Subjects` : 'Marks Register'}
              </h1>
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

        {saveMessage ? (
          <div className="mb-6 rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700">
            {saveMessage}
          </div>
        ) : null}

        {!selectedClass ? (
          <Panel title="My Teaching Classes" description="Teacher jis class me padhata hai, sirf wahi classes yahan show hoti hain.">
            <div className="mt-6">
              <SearchInput value={classSearch} onChange={setClassSearch} placeholder="Search class..." />
            </div>
            {filteredClasses.length > 0 ? (
              <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {filteredClasses.map((className) => {
                  const studentCount = students.filter((student) => student.assignedClass === className).length;
                  const subjectCount = teacherSubjectsByClass[className]?.length || 0;
                  return (
                    <button
                      key={className}
                      type="button"
                      onClick={() => openClass(className)}
                      className="rounded-[1.8rem] border border-slate-200 bg-slate-50 p-6 text-left transition hover:-translate-y-1 hover:border-amber-200 hover:bg-white hover:shadow-[0_18px_40px_-28px_rgba(245,158,11,0.35)]"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                        <GraduationCap size={20} />
                      </div>
                      <h3 className="mt-5 text-xl font-black tracking-tight text-slate-950">{className}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        {studentCount} students | {subjectCount} subject{subjectCount === 1 ? '' : 's'}
                      </p>
                      <span className="mt-5 inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">
                        Open subjects
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={BookOpen}
                title="No teaching classes found"
                description="Timetable chart me is teacher ke naam se subject assign hote hi marks upload list show hogi."
              />
            )}
          </Panel>
        ) : null}

        {selectedClass && !selectedSubject ? (
          <Panel title={`${selectedClass} Subjects`} description="Is class me jo subjects aap padhate hain, unme se ek subject select karein.">
            {selectedSubjects.length > 0 ? (
              <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {selectedSubjects.map((subjectName) => {
                  const savedCount = marksRecords.filter((record) => (
                    record.className === selectedClass && record.subjectName === subjectName
                  )).length;
                  return (
                    <button
                      key={subjectName}
                      type="button"
                      onClick={() => openSubject(subjectName)}
                      className="rounded-[1.8rem] border border-slate-200 bg-slate-50 p-6 text-left transition hover:-translate-y-1 hover:border-amber-200 hover:bg-white hover:shadow-[0_18px_40px_-28px_rgba(245,158,11,0.35)]"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                        <ClipboardPenLine size={20} />
                      </div>
                      <h3 className="mt-5 text-xl font-black tracking-tight text-slate-950">{subjectName}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-500">{savedCount} saved mark rows available.</p>
                      <span className="mt-5 inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">
                        Open register
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={ClipboardPenLine}
                title="No subject found"
                description="Is class ke timetable me teacher ke naam se subject assign nahi mila."
              />
            )}
          </Panel>
        ) : null}

        {selectedClass && selectedSubject ? (
          <Panel title={`${selectedClass} | ${selectedSubject}`} description="Date sheet/exam timetable ke exam names columns ban kar yahan aate hain. Max marks ek baar column me bharein, phir students ke marks enter karein.">
            <form className="mt-8 space-y-8" onSubmit={handleSaveMarks}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-3">
                  <InfoPill icon={Users} text={`${selectedClassAllStudents.length} Students`} />
                  <InfoPill icon={CheckCircle2} text={`${examColumns.length} Exam Columns`} />
                  <InfoPill icon={ClipboardPenLine} text={`${savedMarksForSubject.length} Saved Rows`} />
                </div>
                <SearchInput value={studentSearch} onChange={setStudentSearch} placeholder="Search student or roll no..." />
              </div>

              <div className="grid gap-4 rounded-[1.8rem] border border-amber-200 bg-amber-50 p-5 lg:grid-cols-[1fr_auto]">
                <InputField
                  label="Add Exam Column"
                  value={manualExamTitle}
                  onChange={(event) => setManualExamTitle(event.target.value)}
                  placeholder={FALLBACK_EXAM_TYPES[0]}
                  list="teacher-marks-default-exams"
                />
                <datalist id="teacher-marks-default-exams">
                  {FALLBACK_EXAM_TYPES.map((examTitle) => (
                    <option key={examTitle} value={examTitle} />
                  ))}
                </datalist>
                <button
                  type="button"
                  onClick={handleAddManualExam}
                  className="self-end rounded-2xl bg-slate-950 px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-white transition hover:bg-amber-600"
                >
                  Add Column
                </button>
              </div>

              {examColumns.length > 0 && visibleStudents.length > 0 ? (
                <div className="overflow-hidden rounded-[1.8rem] border border-slate-200">
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left">
                      <thead className="bg-slate-950 text-white">
                        <tr className="text-[11px] font-black uppercase tracking-[0.18em]">
                          <th className="sticky left-0 z-20 min-w-64 border-r border-slate-800 bg-slate-950 px-6 py-4">Student Name</th>
                          <th className="min-w-44 border-r border-slate-800 px-6 py-4">Roll No</th>
                          {examColumns.map((column) => (
                            <th key={column.examTitle} className="min-w-52 border-r border-slate-800 px-4 py-4 align-top">
                              <div className="space-y-3">
                                <div>
                                  <div className="flex items-start gap-2">
                                    <p className="min-w-0 flex-1 text-sm font-black normal-case tracking-normal text-white">{column.examTitle}</p>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenRenameModal(column.examTitle)}
                                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-white transition hover:border-amber-300 hover:text-amber-200"
                                      title="Rename exam"
                                    >
                                      <PencilLine size={14} />
                                    </button>
                                  </div>
                                  <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-amber-200">
                                    {column.source === 'datesheet' ? 'Date Sheet' : column.source === 'exam-timetable' ? 'Exam Timetable' : 'Marks Register'}
                                  </p>
                                </div>
                                <input
                                  value={maxMarksMap[column.examTitle] ?? ''}
                                  onChange={(event) => handleMaxMarksChange(column.examTitle, event.target.value)}
                                  inputMode="decimal"
                                  placeholder="Max marks"
                                  className="w-full rounded-xl border border-slate-700 bg-white px-3 py-2 text-xs font-black text-slate-950 outline-none focus:border-amber-300 focus:ring-4 focus:ring-amber-300/20"
                                />
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {visibleStudents.map((student, rowIndex) => (
                          <tr key={student.id} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className={`sticky left-0 z-10 border-r border-slate-200 px-6 py-5 text-sm font-black text-slate-950 ${rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                              {getStudentName(student)}
                            </td>
                            <td className="border-r border-slate-200 px-6 py-5 text-sm font-semibold text-slate-600">{getStudentRollNo(student)}</td>
                            {examColumns.map((column) => {
                              const value = marksMap[buildMarksCellKey(column.examTitle, student.id)] ?? '';
                              const maxMarks = Number(maxMarksMap[column.examTitle] || 0);
                              const numericValue = Number(value);
                              const hasValue = value !== '' && !Number.isNaN(numericValue);
                              const isInvalid = hasValue && (numericValue < 0 || numericValue > maxMarks);

                              return (
                                <td key={`${column.examTitle}-${student.id}`} className="border-r border-slate-200 px-4 py-5">
                                  <input
                                    value={value}
                                    onChange={(event) => handleMarksChange(column.examTitle, student.id, event.target.value)}
                                    inputMode="decimal"
                                    placeholder="0"
                                    className={`w-28 rounded-2xl border-2 px-4 py-2.5 text-sm font-black text-slate-900 outline-none transition ${
                                      isInvalid
                                        ? 'border-rose-300 bg-rose-50 focus:ring-4 focus:ring-rose-100'
                                        : 'border-slate-200 bg-slate-50 focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-100'
                                    }`}
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={ClipboardPenLine}
                  title={examColumns.length ? 'No students found' : 'No exam column found'}
                  description={examColumns.length ? 'Search ke hisab se koi student match nahi hua.' : 'Date sheet me exam name aate hi column auto add hoga. Abhi manual exam column bhi add kar sakte hain.'}
                />
              )}

              <PrimaryButton
                type="submit"
                icon={Save}
                label="Save Marks Register"
                disabled={!canSaveMarksRegister(examColumns, selectedClassAllStudents, marksMap, maxMarksMap)}
              />
            </form>
          </Panel>
        ) : null}
      </main>

      {renameDraft ? (
        <RenameExamModal
          value={renameDraft.nextExamTitle}
          onChange={(value) => setRenameDraft((current) => ({ ...current, nextExamTitle: value }))}
          onClose={() => setRenameDraft(null)}
          onSubmit={handleRenameExamColumn}
          duplicateName={examColumns.some((column) => (
            normalizeKey(column.examTitle) === normalizeKey(renameDraft.nextExamTitle) &&
            normalizeKey(column.examTitle) !== normalizeKey(renameDraft.oldExamTitle)
          ))}
        />
      ) : null}
    </div>
  );
};

const buildExamColumns = ({ selectedClass, selectedSubject, dateSheets, examSlots, marksRecords, extraExamColumns, examRenames }) => {
  if (!selectedClass || !selectedSubject) return [];
  const renameTitle = (examTitle) => getRenamedExamTitle(examTitle, selectedClass, selectedSubject, examRenames);

  const columnMap = new Map();
  dateSheets.forEach((record) => {
    if (record.className === selectedClass) {
      addExamColumn(columnMap, renameTitle(record.examType), { source: 'datesheet', examDate: record.examDate || record.createdAt || '' });
    }
  });

  examSlots.forEach((record) => {
    if (record.className === selectedClass && record.subjectName === selectedSubject) {
      addExamColumn(columnMap, renameTitle(record.examTitle), { source: 'exam-timetable', examDate: record.examDate || '' });
    }
  });

  marksRecords.forEach((record) => {
    if (record.className === selectedClass && record.subjectName === selectedSubject) {
      addExamColumn(columnMap, record.examTitle, { source: 'marks-register', examDate: record.examDate || '' });
    }
  });

  extraExamColumns.forEach((record) => {
    addExamColumn(columnMap, record.examTitle, { source: 'manual', examDate: '' });
  });

  return [...columnMap.values()].sort((left, right) => {
    const leftTime = Date.parse(left.examDate || '');
    const rightTime = Date.parse(right.examDate || '');
    if (!Number.isNaN(leftTime) && !Number.isNaN(rightTime) && leftTime !== rightTime) return leftTime - rightTime;
    return left.examTitle.localeCompare(right.examTitle);
  });
};

const addExamColumn = (columnMap, examTitle, details) => {
  const cleanTitle = String(examTitle || '').trim();
  if (!cleanTitle) return;
  const key = normalizeKey(cleanTitle);
  const existing = columnMap.get(key);
  columnMap.set(key, {
    examTitle: cleanTitle,
    source: existing?.source || details.source,
    examDate: existing?.examDate || details.examDate || '',
  });
};

const getRenamedExamTitle = (examTitle, selectedClass, selectedSubject, examRenames) => {
  const matchingRename = examRenames.find((record) => (
    record.className === selectedClass &&
    record.subjectName === selectedSubject &&
    normalizeKey(record.oldTitle) === normalizeKey(examTitle)
  ));
  return matchingRename?.newTitle || examTitle;
};

const canSaveMarksRegister = (examColumns, students, marksMap, maxMarksMap) => {
  if (!examColumns.length || !students.length) return false;

  return examColumns.every((column) => {
    const maxMarks = Number(maxMarksMap[column.examTitle]);
    if (!maxMarks || maxMarks <= 0) return false;
    return students.every((student) => {
      const value = marksMap[buildMarksCellKey(column.examTitle, student.id)];
      const numericValue = Number(value);
      return value !== '' && value !== undefined && !Number.isNaN(numericValue) && numericValue >= 0 && numericValue <= maxMarks;
    });
  });
};

const deriveTeacherSubjectsByClass = (classTimetables, teacher) => {
  if (!teacher) return {};

  const teacherKeys = buildTeacherIdentityKeys(teacher);
  const subjectsByClass = {};

  classTimetables.forEach((record) => {
    const template = readTeacherTimetableTemplate(record);
    if (!record?.className || !template?.rows?.length) return;

    const subjectSet = subjectsByClass[record.className] || new Set();
    template.rows.forEach((row) => {
      (row.slots || []).forEach((slot) => {
        if (!slotMatchesTeacher(slot, teacherKeys)) return;
        addCleanValue(subjectSet, slot?.subjectName);
      });
    });

    if (subjectSet.size) {
      subjectsByClass[record.className] = subjectSet;
    }
  });

  return Object.entries(subjectsByClass)
    .sort(([leftClass], [rightClass]) => compareClassNames(leftClass, rightClass))
    .reduce((accumulator, [className, subjectSet]) => {
      accumulator[className] = [...subjectSet].sort((left, right) => left.localeCompare(right));
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

  const lecturePlan = Array.from(rows[1].querySelectorAll('th')).slice(1)
    .map((cell) => {
      const text = cell.textContent?.replace(/\s+/g, ' ').trim() || '';
      const lectureMatch = text.match(/Lecture\s+(\d+)/i);
      return lectureMatch ? { lectureNumber: Number(lectureMatch[1]) } : null;
    })
    .filter(Boolean);

  const routineRows = rows.slice(2)
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

const getStudentName = (student) => (
  `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Unnamed student'
);

const getStudentRollNo = (student) => (
  String(student.rollNo || student.enrollmentNo || student.systemId || student.id || '-')
);

const addCleanValue = (targetSet, value) => {
  const cleanValue = String(value || '').trim();
  if (cleanValue) {
    targetSet.add(cleanValue);
  }
};

const buildMarksCellKey = (examTitle, studentId) => `${normalizeKey(examTitle)}-${studentId}`;

const normalizeKey = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');

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

const Panel = ({ title, description, children }) => (
  <section className="mt-8 rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
    <h3 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">{title}</h3>
    <p className="mt-2 text-sm leading-7 text-slate-500">{description}</p>
    {children}
  </section>
);

const SearchInput = ({ value, onChange, placeholder }) => (
  <div className="relative min-w-65">
    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-12 py-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-100"
    />
  </div>
);

const InputField = ({ label, ...props }) => (
  <label className="block">
    <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</span>
    <input
      className="mt-2 w-full rounded-2xl border-2 border-slate-200 bg-white px-5 py-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
      {...props}
    />
  </label>
);

const InfoPill = ({ icon, text }) => (
  <div className="inline-flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">
    {React.createElement(icon, { size: 15, className: 'text-amber-700' })}
    <span>{text}</span>
  </div>
);

const PrimaryButton = ({ type, icon, label, disabled = false }) => (
  <button
    type={type}
    disabled={disabled}
    className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] transition ${
      disabled ? 'cursor-not-allowed bg-slate-200 text-slate-400' : 'bg-slate-950 text-white hover:bg-amber-600'
    }`}
  >
    {React.createElement(icon, { size: 15 })}
    {label}
  </button>
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

const RenameExamModal = ({ value, onChange, onClose, onSubmit, duplicateName }) => (
  <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-sm">
    <form
      onSubmit={onSubmit}
      className="w-full max-w-md rounded-4xl border border-slate-200 bg-white p-6 shadow-[0_30px_90px_-35px_rgba(15,23,42,0.75)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-amber-600">Rename Exam</p>
          <h3 className="mt-2 font-serif text-2xl font-black italic tracking-tight text-slate-950">Update column name</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
          title="Close"
        >
          <X size={18} />
        </button>
      </div>

      <label className="mt-7 block">
        <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">Exam Name</span>
        <input
          autoFocus
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="mt-2 w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-3.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-100"
        />
      </label>

      {duplicateName ? (
        <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">
          Is naam ka exam column pehle se available hai.
        </p>
      ) : null}

      <div className="mt-7 flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex flex-1 items-center justify-center rounded-2xl border border-slate-200 px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!value.trim() || duplicateName}
          className={`inline-flex flex-1 items-center justify-center rounded-2xl px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] transition ${
            !value.trim() || duplicateName ? 'cursor-not-allowed bg-slate-200 text-slate-400' : 'bg-slate-950 text-white hover:bg-amber-600'
          }`}
        >
          Save
        </button>
      </div>
    </form>
  </div>
);

export default TeacherMarks;
