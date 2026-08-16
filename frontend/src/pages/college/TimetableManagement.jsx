import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Clock3,
  Download,
  DoorOpen,
  FileText,
  GraduationCap,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { db } from '../../utils/db';
import { courseBookApi, feeApi, studentApi, teacherApi, timetableApi } from '../../utils/api';

const initialExamSlotForm = {
  examTitle: '',
  className: '',
  subjectName: '',
  examDate: '',
  dayOfWeek: 'Monday',
  timeFrom: '',
  timeTo: '',
  roomId: '',
  invigilatorName: '',
  examDuration: '',
  studentSeatingRange: '',
};

const initialTemplateForm = {
  schoolName: '',
  lectureCount: '8',
  firstLectureStart: '08:00',
  lectureLength: '45',
  lunchLength: '30',
};

const TimetableManagement = () => {
  const navigate = useNavigate();
  const [session] = useState(() => JSON.parse(localStorage.getItem('active_session')) || null);
  const [activePage, setActivePage] = useState('home');
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [courseBooks, setCourseBooks] = useState([]);
  const [schoolClasses, setSchoolClasses] = useState([]);
  const [classTimetables, setClassTimetables] = useState([]);
  const [examSlots, setExamSlots] = useState(() => db.getAll('timetable_exam_slots'));
  const [selectedClass, setSelectedClass] = useState('');
  const [examSlotForm, setExamSlotForm] = useState(initialExamSlotForm);
  const [classSearch, setClassSearch] = useState('');
  const [examSearch, setExamSearch] = useState('');
  const [previewRecord, setPreviewRecord] = useState(null);
  const [classTimetableAction, setClassTimetableAction] = useState('');
  const [savedTemplateDrafts, setSavedTemplateDrafts] = useState([]);
  const [templateForm, setTemplateForm] = useState(() => ({
    ...initialTemplateForm,
    schoolName: session?.instituteName || '',
  }));
  const [generatedTemplateDraft, setGeneratedTemplateDraft] = useState(null);
  const [loadError, setLoadError] = useState('');

  const refreshTimetables = async () => {
    const [nextClassTimetables, nextDrafts] = await Promise.all([
      timetableApi.getClassTimetables(),
      timetableApi.getTemplateDrafts(),
    ]);
    setClassTimetables(nextClassTimetables);
    setExamSlots(db.getAll('timetable_exam_slots'));
    setSavedTemplateDrafts(nextDrafts);
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const [studentResponse, teacherResponse, courseBookResponse, schoolClassResponse, timetableResponse, draftResponse] = await Promise.all([
          studentApi.getAll(),
          teacherApi.getAll(),
          courseBookApi.getAll(),
          feeApi.getClasses(),
          timetableApi.getClassTimetables(),
          timetableApi.getTemplateDrafts(),
        ]);

        setStudents(studentResponse);
        setTeachers(teacherResponse);
        setCourseBooks(courseBookResponse);
        setSchoolClasses(schoolClassResponse);
        setClassTimetables(timetableResponse);
        setSavedTemplateDrafts(draftResponse);
        setExamSlots(db.getAll('timetable_exam_slots'));
        setLoadError('');
      } catch (error) {
        setStudents([]);
        setTeachers([]);
        setCourseBooks([]);
        setSchoolClasses([]);
        setClassTimetables([]);
        setSavedTemplateDrafts([]);
        setExamSlots(db.getAll('timetable_exam_slots'));
        setLoadError(error.message || 'Unable to load timetable data from the server.');
      }
    };

    loadData();
  }, []);

  const teacherSession = useMemo(() => {
    if (!session || session.role !== 'teacher') return null;
    return teachers.find((teacher) => String(teacher.id) === String(session.teacherId)) || null;
  }, [session, teachers]);

  const teacherName = teacherSession
    ? `${teacherSession.firstName || ''} ${teacherSession.lastName || ''}`.trim() || teacherSession.teacherSystemId || 'Teacher'
    : '';

  const teacherClassOptions = useMemo(() => {
    return deriveTeacherClassesFromTimetables(classTimetables, teacherSession);
  }, [classTimetables, teacherSession]);

  const studentClassOptions = useMemo(() => {
    return [
      ...new Set(
        [
          ...schoolClasses,
          ...students.flatMap((student) => buildStudentTimetableClassCandidates(student)),
          ...classTimetables.map((record) => record.className),
          ...savedTemplateDrafts.map((record) => record.className),
        ],
      ),
    ].map((value) => String(value || '').trim()).filter(Boolean).sort(compareClassNames);
  }, [classTimetables, savedTemplateDrafts, schoolClasses, students]);

  const classOptions = useMemo(() => {
    return teacherSession ? teacherClassOptions : studentClassOptions;
  }, [studentClassOptions, teacherClassOptions, teacherSession]);

  const filteredClassOptions = useMemo(() => {
    const query = classSearch.trim().toLowerCase();
    return classOptions.filter((className) => {
      if (!query) return true;
      return className.toLowerCase().includes(query);
    });
  }, [classOptions, classSearch]);

  const teacherOptions = useMemo(() => {
    return teachers
      .map((teacher) => {
        const displayName = formatTimetableText(`${teacher.firstName || ''} ${teacher.lastName || ''}`) || 'Unnamed Teacher';
        const teacherCode = String(teacher.teacherSystemId || teacher.employeeId || '').trim();
        const teacherLabel = teacherCode ? `${displayName} (${teacherCode})` : displayName;
        return {
          value: teacherLabel,
          label: teacherLabel,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [teachers]);

  const selectedClassTeacherOptions = useMemo(() => {
    return teacherOptions;
  }, [teacherOptions]);

  const selectedClassSubjectOptions = useMemo(() => {
    const baseClassName = normalizeTimetableClassLabel(selectedClass);
    if (!baseClassName) return [];

    return [...new Set(
      courseBooks
        .filter((record) => normalizeTimetableClassLabel(record.className) === baseClassName)
        .map((record) => formatTimetableText(record.subjectName))
        .filter(Boolean),
    )].sort((left, right) => left.localeCompare(right));
  }, [courseBooks, selectedClass]);

  const selectedClassRecord = useMemo(() => {
    return classTimetables.find((record) => record.className === selectedClass);
  }, [classTimetables, selectedClass]);

  const selectedTemplateDraftRecord = useMemo(() => {
    return savedTemplateDrafts.find((record) => record.className === selectedClass) || null;
  }, [savedTemplateDrafts, selectedClass]);

  const visibleClassTimetables = useMemo(() => {
    if (!teacherSession) return classTimetables;
    return classTimetables.filter((record) => {
      if (!teacherClassOptions.includes(record.className)) return false;
      return Boolean(readTeacherTimetableTemplate(record));
    });
  }, [classTimetables, teacherClassOptions, teacherSession]);

  const selectedTeacherClassRecord = useMemo(() => {
    if (!teacherSession) return null;
    return visibleClassTimetables.find((record) => record.className === selectedClass) || null;
  }, [selectedClass, teacherSession, visibleClassTimetables]);

  const selectedClassEditableTemplate = useMemo(() => {
    return readTeacherTimetableTemplate(selectedClassRecord);
  }, [selectedClassRecord]);

  const isSelectedClassEditableTimetable = Boolean(selectedClassEditableTemplate);

  const filteredExamSlots = useMemo(() => {
    const query = examSearch.trim().toLowerCase();
    return examSlots
      .filter((slot) => {
        if (!teacherSession) return true;
        return teacherClassOptions.includes(slot.className) || slot.invigilatorName === teacherName;
      })
      .filter((slot) => {
        if (!query) return true;
        return (
          slot.examTitle?.toLowerCase().includes(query) ||
          slot.className?.toLowerCase().includes(query) ||
          slot.subjectName?.toLowerCase().includes(query) ||
          slot.invigilatorName?.toLowerCase().includes(query) ||
          slot.roomId?.toLowerCase().includes(query) ||
          slot.studentSeatingRange?.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => new Date(a.examDate || 0) - new Date(b.examDate || 0) || sortByDayAndTime(a, b));
  }, [examSearch, examSlots, teacherClassOptions, teacherName, teacherSession]);

  const totalClassSlots = visibleClassTimetables.length;
  const teacherCoverage = classOptions.length;
  const roomCoverage = new Set(filteredExamSlots.map((slot) => slot.roomId).filter(Boolean)).size;
  const examCount = filteredExamSlots.length;

  const handleSaveExamSlot = (e) => {
    e.preventDefault();
    const payload = {
      ...examSlotForm,
      examTitle: examSlotForm.examTitle.trim(),
      className: examSlotForm.className.trim(),
      subjectName: examSlotForm.subjectName.trim(),
      roomId: examSlotForm.roomId.trim(),
      invigilatorName: examSlotForm.invigilatorName.trim(),
      examDuration: examSlotForm.examDuration.trim(),
      studentSeatingRange: examSlotForm.studentSeatingRange.trim(),
    };
    if (!payload.examTitle || !payload.className || !payload.subjectName || !payload.examDate || !payload.timeFrom || !payload.timeTo || !payload.roomId || !payload.invigilatorName) return;
    if (payload.timeTo <= payload.timeFrom) return;
    db.save('timetable_exam_slots', payload);
    setExamSlotForm(initialExamSlotForm);
    refreshTimetables();
  };

  const handleDelete = async (module, id, message) => {
    if (!window.confirm(message)) return;
    try {
      if (module === 'timetable_class_slots') {
        await timetableApi.deleteClassTimetable(id);
      } else if (module === 'timetable_template_drafts') {
        await timetableApi.deleteTemplateDraft(id);
      } else {
        replaceModuleRecords(module, db.getAll(module).filter((record) => record.id !== id));
      }
      if (previewRecord?.id === id) setPreviewRecord(null);
      await refreshTimetables();
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Unable to delete the timetable record.');
    }
  };

  const handleGenerateTemplate = () => {
    if (!selectedClass) return;
    if (selectedClassRecord) {
      setLoadError('Is class ka timetable already saved hai. Naya timetable banane se pehle purana delete karein.');
      return;
    }

    const lectureCount = Math.max(1, Number(templateForm.lectureCount) || 0);
    const lectureLength = Math.max(1, Number(templateForm.lectureLength) || 0);
    const lunchLength = Math.max(0, Number(templateForm.lunchLength) || 0);
    const schoolName = templateForm.schoolName.trim() || session?.instituteName || 'School Timetable';
    const lecturePlan = buildLecturePlan(templateForm.firstLectureStart, lectureCount, lectureLength, lunchLength);
    setGeneratedTemplateDraft({
      className: selectedClass,
      schoolName,
      lecturePlan,
      lectureCount,
      firstLectureStart: templateForm.firstLectureStart,
      lectureLength,
      lunchLength,
      rows: classTemplateDays.map((day) => ({
        day,
        slots: lecturePlan.map(() => ({ subjectName: '', teacherName: '' })),
      })),
    });
    setActivePage('template-editor');
  };

  const handleEditSavedTimetable = () => {
    if (!selectedClass || !selectedClassEditableTemplate) return;

    setGeneratedTemplateDraft({
      ...selectedClassEditableTemplate,
      className: selectedClass,
      schoolName: selectedClassEditableTemplate.schoolName || session?.instituteName || 'School Timetable',
      lectureCount: selectedClassEditableTemplate.lectureCount || String(selectedClassEditableTemplate.lecturePlan?.length || ''),
      firstLectureStart: selectedClassEditableTemplate.firstLectureStart || selectedClassEditableTemplate.lecturePlan?.[0]?.timeFrom || '08:00',
      lectureLength: selectedClassEditableTemplate.lectureLength || calculateLectureLength(selectedClassEditableTemplate.lecturePlan),
      lunchLength: selectedClassEditableTemplate.lunchLength ?? 30,
    });
    setClassTimetableAction('');
    setActivePage('template-editor');
    setLoadError('');
  };

  const handleDraftCellChange = (dayIndex, slotIndex, field, value) => {
    setGeneratedTemplateDraft((current) => {
      if (!current) return current;

      return {
        ...current,
        rows: current.rows.map((row, currentDayIndex) => (
          currentDayIndex !== dayIndex
            ? row
            : {
                ...row,
                slots: row.slots.map((slot, currentSlotIndex) => (
                  currentSlotIndex !== slotIndex ? slot : { ...slot, [field]: value }
                )),
              }
        )),
      };
    });
  };

  const handleSaveGeneratedTemplate = async () => {
      if (!generatedTemplateDraft || !selectedClass) return;

      const normalizedTemplateDraft = normalizeGeneratedTemplateDraft(generatedTemplateDraft);
      const missingSubjects = findUnusedTimetableSubjects(normalizedTemplateDraft, selectedClassSubjectOptions);
      if (missingSubjects.length) {
        const shouldContinue = window.confirm(
          `The following subjects have not been scheduled anywhere in this timetable: ${missingSubjects.join(', ')}. Please review the timetable to ensure complete subject coverage before final submission.\n\nDo you want to continue saving this timetable?`,
        );
        if (!shouldContinue) return;
      }
      const now = new Date().toISOString();
      const payload = {
        className: selectedClass,
        fileName: buildTimetableTemplateFileName(selectedClass),
        fileData: buildTimetableTemplateDataUri(normalizedTemplateDraft),
        fileType: 'text/html',
        uploadedAt: now,
        templateData: normalizedTemplateDraft,
        templateMeta: {
          schoolName: normalizedTemplateDraft.schoolName,
          lectureCount: normalizedTemplateDraft.lectureCount,
          firstLectureStart: normalizedTemplateDraft.firstLectureStart,
          lectureLength: normalizedTemplateDraft.lectureLength,
          lunchLength: normalizedTemplateDraft.lunchLength,
        },
      };
    try {
      await timetableApi.saveClassTimetable(payload);
      if (selectedTemplateDraftRecord?.id) {
        await timetableApi.deleteTemplateDraft(selectedTemplateDraftRecord.id);
      }
      await refreshTimetables();
      setGeneratedTemplateDraft(null);
      setClassTimetableAction('');
      setActivePage('class');
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Unable to save the timetable template.');
    }
  };

  const handleSaveTemplateDraft = async () => {
    if (!generatedTemplateDraft || !selectedClass) return;
    const payload = {
      className: selectedClass,
      draftData: normalizeGeneratedTemplateDraft(generatedTemplateDraft),
    };
    try {
      await timetableApi.saveTemplateDraft(payload);
      await refreshTimetables();
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Unable to save the timetable draft.');
    }
  };

  const handleOpenSavedDraft = () => {
    if (!selectedTemplateDraftRecord?.draftData) return;
    setGeneratedTemplateDraft(selectedTemplateDraftRecord.draftData);
    setActivePage('template-editor');
  };

  const handleCancelTemplateEditor = () => {
    setGeneratedTemplateDraft(null);
    setActivePage('class');
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7fbff_0%,#effaf5_36%,#f8fafc_100%)] text-slate-900">
      <div className="border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(session?.role === 'teacher' ? '/teacher' : '/college')}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 transition hover:border-emerald-300 hover:text-emerald-700"
            >
              <ArrowLeft size={14} />
              Back
            </button>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-emerald-600">Timetable Management</p>
              <h1 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">Time And Resource Planner</h1>
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
        <section className="overflow-hidden rounded-4xl bg-[linear-gradient(145deg,#0f766e_0%,#047857_48%,#111827_100%)] px-7 py-8 text-white shadow-[0_30px_80px_-40px_rgba(6,78,59,0.8)] lg:px-10 lg:py-10">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-emerald-200">Schedule Operations</p>
              <h2 className="mt-4 max-w-3xl font-serif text-4xl font-black italic leading-none tracking-tight">
                Visualize class periods, teacher allocation, rooms, and exam schedules.
              </h2>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-emerald-50/80">
                {teacherSession
                  ? `Only timetable records for ${teacherName || 'this teacher'} and assigned teaching classes are shown here.`
                  : 'Build weekly teaching slots with substitution coverage, then prepare exam timetables with invigilators, duration, and seating range.'}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <MetricCard label="Saved Plans" value={totalClassSlots} icon={FileText} />
              <MetricCard label="Classes Listed" value={teacherCoverage} icon={UserRound} />
              <MetricCard label="Rooms Used" value={roomCoverage} icon={DoorOpen} />
              <MetricCard label="Exam Slots" value={examCount} icon={ShieldCheck} />
            </div>
          </div>
        </section>

        {activePage === 'home' ? (
          <section className="mt-8 grid gap-5 md:grid-cols-2">
            <ActionCard
              icon={CalendarClock}
              title="Class & Teacher Timetable"
              text={teacherSession
                ? 'Open the timetable files for the classes you teach.'
                : 'Open class and section-wise timetables, generate new schedules, and manage saved plans.'}
              onClick={() => setActivePage('class')}
            />
            <ActionCard
              icon={ShieldCheck}
              title="Exam Timetable"
              text={teacherSession
                ? 'Review exam timetable entries connected to your teaching classes or invigilation duty.'
                : 'Create assessment schedules with invigilator, duration, and seating range.'}
              onClick={() => setActivePage('exam')}
            />
          </section>
        ) : (
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-700">Timetable Page</p>
              <h2 className="mt-2 font-serif text-3xl font-black italic tracking-tight text-slate-950">
                {activePage === 'class' ? 'Class And Teacher Timetable' : activePage === 'template-editor' ? 'Edit Timetable Template' : 'Exam Timetable'}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setActivePage(activePage === 'template-editor' ? 'class' : 'home')}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700"
            >
              <ArrowLeft size={15} />
              {activePage === 'template-editor' ? 'Back To Timetable' : 'Back To Cards'}
            </button>
          </div>
        )}

        {activePage === 'class' ? (
          <TwoColumnPage
            left={
              <Panel
                title={teacherSession ? 'Teaching Classes' : 'School Classes'}
                description={teacherSession
                  ? 'Select one of your teaching classes to view its timetable.'
                  : 'Select any class and section to generate or manage its timetable.'}
              >
                <div className="mt-6">
                  <SearchInput value={classSearch} onChange={setClassSearch} placeholder="Search class..." />
                </div>
                <div className="mt-6 grid gap-3">
                  {filteredClassOptions.map((className) => {
                    const record = classTimetables.find((entry) => entry.className === className);
                    return (
                      <button
                        key={className}
                        type="button"
                        onClick={() => {
                          setSelectedClass(className);
                          setClassTimetableAction('');
                          setGeneratedTemplateDraft(null);
                        }}
                        className={`flex items-center justify-between gap-4 rounded-[1.4rem] border p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50/60 ${
                          selectedClass === className ? 'border-emerald-400 bg-emerald-50 ring-4 ring-emerald-100' : 'border-slate-200 bg-slate-50'
                        }`}
                      >
                        <div className="min-w-0">
                          <h4 className="truncate text-base font-black text-slate-950">{className}</h4>
                          <p className="mt-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                            {record ? 'Timetable Saved' : 'No Timetable Saved'}
                          </p>
                        </div>
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${record ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-slate-300'}`}>
                          {record ? <FileText size={18} /> : <CalendarClock size={18} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Panel>
            }
            right={
              <Panel
                title={selectedClass || 'Select A Class'}
                description={
                  teacherSession
                    ? 'Only generated or structured timetable records are visible for your teaching class.'
                    : 'Ek class ke liye ek hi timetable save hoga. Naya timetable banane se pehle purana delete karna hoga.'
                }
              >
                {!selectedClass ? (
                  <div className="mt-8 rounded-4xl border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center">
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-white text-slate-300 shadow-sm">
                      <CalendarClock size={34} />
                    </div>
                    <h4 className="mt-6 font-serif text-3xl font-black italic tracking-tight text-slate-950">Choose a class</h4>
                    <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-500">Click a class from the school class list to generate or manage its timetable.</p>
                  </div>
                ) : teacherSession ? (
                  selectedTeacherClassRecord ? (
                    <div className="mt-8 rounded-[1.8rem] border border-slate-200 bg-slate-50 p-5">
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                        <button
                          type="button"
                          onClick={() => setPreviewRecord(selectedTeacherClassRecord)}
                          className="flex min-w-0 flex-1 items-center gap-4 rounded-[1.4rem] p-2 text-left transition hover:bg-white"
                        >
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-700">
                            <FileText size={24} />
                          </div>
                          <div className="min-w-0">
                            <h4 className="truncate text-lg font-black tracking-tight text-slate-950">{selectedTeacherClassRecord.fileName || 'Saved timetable'}</h4>
                            <p className="mt-1 text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">
                              Saved {formatSavedDate(selectedTeacherClassRecord.uploadedAt || selectedTeacherClassRecord.createdAt)}
                            </p>
                            <p className="mt-2 text-xs font-bold text-slate-500">Click to open your generated timetable</p>
                          </div>
                        </button>
                        <div className="flex flex-wrap items-center gap-2">
                          <InfoPill icon={Clock3} text={formatSavedTime(selectedTeacherClassRecord.uploadedAt || selectedTeacherClassRecord.createdAt)} />
                          <InfoPill icon={FileText} text="Structured timetable" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-8 rounded-4xl border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center">
                      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-white text-slate-300 shadow-sm">
                        <CalendarClock size={34} />
                      </div>
                      <h4 className="mt-6 font-serif text-3xl font-black italic tracking-tight text-slate-950">No teacher timetable available</h4>
                      <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-500">Teacher side par tabhi timetable dikhega jab lecture, subject, aur teacher-wise structured data available ho.</p>
                    </div>
                  )
                ) : (
                  <div className="mt-8 space-y-6">
                    <div className="rounded-[1.8rem] border border-slate-200 bg-slate-50 p-5">
                      {selectedClassRecord ? (
                        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                          <button
                            type="button"
                            onClick={() => setPreviewRecord(selectedClassRecord)}
                            className="flex min-w-0 flex-1 items-center gap-4 rounded-[1.4rem] p-2 text-left transition hover:bg-white"
                          >
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-700">
                              <FileText size={24} />
                            </div>
                            <div className="min-w-0">
                              <h4 className="truncate text-lg font-black tracking-tight text-slate-950">{selectedClassRecord.fileName || 'Saved timetable'}</h4>
                              <p className="mt-1 text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">
                                Saved {formatSavedDate(selectedClassRecord.uploadedAt || selectedClassRecord.createdAt)}
                              </p>
                              <p className="mt-2 text-xs font-bold text-slate-500">Click to open saved timetable</p>
                            </div>
                          </button>
                        <div className="flex flex-wrap items-center gap-2">
                          <InfoPill icon={Clock3} text={formatSavedTime(selectedClassRecord.uploadedAt || selectedClassRecord.createdAt)} />
                          <InfoPill icon={FileText} text="Saved timetable" />
                          {isSelectedClassEditableTimetable ? (
                            <button
                              type="button"
                              onClick={handleEditSavedTimetable}
                              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-white transition hover:bg-emerald-700"
                            >
                              <FileText size={15} />
                              Edit
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => handleDelete('timetable_class_slots', selectedClassRecord.id, 'Delete this saved timetable?')}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="py-8 text-center">
                          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-slate-300 shadow-sm">
                            <CalendarClock size={28} />
                          </div>
                          <h4 className="mt-5 font-serif text-2xl font-black italic tracking-tight text-slate-950">No timetable saved</h4>
                          <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-slate-500">Generate a timetable for this class to make it available here.</p>
                        </div>
                        )}
                      </div>
                    {selectedClassRecord ? (
                      <div className="rounded-[1.8rem] border border-amber-200 bg-amber-50 px-5 py-4">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-700">Single Timetable Rule</p>
                        <p className="mt-2 text-sm leading-7 text-slate-700">
                          Is class ke liye ek timetable already saved hai. Agar naya timetable banana hai to pehle existing timetable delete karna hoga.
                        </p>
                      </div>
                    ) : null}

                    <div className="grid gap-4">
                          <button
                            type="button"
                            onClick={() => setClassTimetableAction('generate')}
                            className={`rounded-[1.8rem] border p-6 text-left transition ${
                              classTimetableAction === 'generate'
                                ? 'border-emerald-400 bg-emerald-50 ring-4 ring-emerald-100'
                                : 'border-slate-200 bg-white hover:border-emerald-300'
                            }`}
                          >
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                              <FileText size={22} />
                            </div>
                            <h4 className="mt-4 font-serif text-2xl font-black italic tracking-tight text-slate-950">Generate Excel Timetable</h4>
                            <p className="mt-2 text-sm leading-7 text-slate-500">
                              Create a class timetable template from lecture count, start time, lecture length, and lunch break.
                            </p>
                          </button>
                    </div>

                    {classTimetableAction === 'generate' ? (
                      <div className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm">
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700">Excel Template Generator</p>
                          <h4 className="mt-2 font-serif text-2xl font-black italic tracking-tight text-slate-950">Generate class timetable template</h4>
                          <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-500">
                            First row me school name hoga. Second row me har lecture number aur uska timing hoga. Rows Monday se Saturday rahengi, aur har lecture slot ke andar Subject aur Teacher ke liye jagah rahegi. First 4 lectures ke baad lunch automatically add hoga.
                          </p>
                        </div>

                        <div className="mt-6 grid gap-4 md:grid-cols-2">
                          <InputField
                            label="School Name"
                            value={templateForm.schoolName}
                            onChange={(e) => setTemplateForm({ ...templateForm, schoolName: e.target.value })}
                            placeholder="Enter school name"
                          />
                          <InputField
                            label="Total Lectures"
                            type="number"
                            min="1"
                            max="12"
                            value={templateForm.lectureCount}
                            onChange={(e) => setTemplateForm({ ...templateForm, lectureCount: e.target.value })}
                            placeholder="8"
                          />
                          <InputField
                            label="First Lecture Start"
                            type="time"
                            value={templateForm.firstLectureStart}
                            onChange={(e) => setTemplateForm({ ...templateForm, firstLectureStart: e.target.value })}
                          />
                          <InputField
                            label="Lecture Length (Minutes)"
                            type="number"
                            min="1"
                            value={templateForm.lectureLength}
                            onChange={(e) => setTemplateForm({ ...templateForm, lectureLength: e.target.value })}
                            placeholder="45"
                          />
                          <div className="md:col-span-2">
                            <InputField
                              label="Lunch Length After 4th Lecture (Minutes)"
                              type="number"
                              min="0"
                              value={templateForm.lunchLength}
                              onChange={(e) => setTemplateForm({ ...templateForm, lunchLength: e.target.value })}
                              placeholder="30"
                            />
                          </div>
                        </div>

                        <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center">
                          <button
                            type="button"
                            onClick={handleGenerateTemplate}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-white transition hover:bg-emerald-600"
                          >
                            <FileText size={15} />
                            Generate Excel Template
                          </button>
                          <p className="text-sm font-semibold text-slate-500">
                            Generate karne ke baad template website ke andar edit hoga. Final timetable ready hone par hi save karein.
                          </p>
                        </div>
                        {selectedTemplateDraftRecord ? (
                          <div className="mt-6 flex flex-col gap-3 rounded-[1.6rem] border border-emerald-200 bg-emerald-50 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">Saved Draft Available</p>
                              <p className="mt-1 text-sm font-semibold text-slate-600">
                                Aapne is class ke liye draft save kiya hua hai. Usse dubara open karke continue kar sakte hain.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={handleOpenSavedDraft}
                              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700 transition hover:bg-emerald-100"
                            >
                              <FileText size={15} />
                              Open Saved Draft
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )}
              </Panel>
            }
          />
        ) : null}

        {activePage === 'template-editor' ? (
          <section className="mt-8">
            <Panel
              title={generatedTemplateDraft ? `${generatedTemplateDraft.className} Template Editor` : 'Template Editor'}
              description="Edit subject and teacher name for every lecture cell. Final save will move the completed template into the timetable records, while save draft keeps your work separate until it is ready."
            >
              {generatedTemplateDraft ? (
                <>
                  <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700">Separate Editor Page</p>
                      <h4 className="mt-2 font-serif text-3xl font-black italic tracking-tight text-slate-950">
                        {generatedTemplateDraft.schoolName}
                      </h4>
                      <p className="mt-2 text-sm font-semibold text-slate-500">
                        {generatedTemplateDraft.className} | Lecture count {generatedTemplateDraft.lectureCount} | Lunch after lecture 4
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={handleSaveGeneratedTemplate}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-white transition hover:bg-emerald-700"
                      >
                        <FileText size={15} />
                        Final Save
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveTemplateDraft}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-white transition hover:bg-slate-800"
                      >
                        <Download size={15} />
                        Save Draft
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelTemplateEditor}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <X size={15} />
                        Cancel
                      </button>
                    </div>
                  </div>

                  <div className="mt-6 overflow-x-auto rounded-[1.4rem] border border-slate-200 bg-white">
                    <table className="min-w-full border-collapse">
                      <thead>
                        <tr>
                          <th
                            colSpan={1 + buildTimetableDisplayColumns(generatedTemplateDraft.lecturePlan).length}
                            className="border border-slate-300 bg-emerald-700 px-3 py-3 text-center text-base font-black text-white"
                          >
                            {generatedTemplateDraft.schoolName}
                          </th>
                        </tr>
                        <tr>
                          <th className="border border-slate-300 bg-slate-950 px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-white">
                            Day
                          </th>
                          {buildTimetableDisplayColumns(generatedTemplateDraft.lecturePlan).map((column) => (
                            <th
                              key={`editor-column-${column.key}`}
                              className={`border border-slate-300 px-3 py-2 text-center text-xs font-black ${
                                column.type === 'lunch' ? 'bg-amber-100 text-amber-950' : 'bg-emerald-50 text-slate-950'
                              }`}
                            >
                              {column.type === 'lunch' ? (
                                <div>
                                  <div>Lunch</div>
                                  <div className="mt-1 text-[11px] font-semibold text-amber-800">{column.timeLabel}</div>
                                </div>
                              ) : (
                                <div>
                                  <div>Lecture {column.lecture.lectureNumber}</div>
                                  <div className="mt-1 text-[11px] font-semibold text-slate-600">
                                    {column.lecture.timeFrom} - {column.lecture.timeTo}
                                  </div>
                                </div>
                              )}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {generatedTemplateDraft.rows.map((row, dayIndex) => (
                          <tr key={`editor-${row.day}`}>
                            <td className="border border-slate-300 bg-slate-50 px-3 py-3 align-top text-xs font-black text-slate-950">
                              {row.day}
                            </td>
                            {buildTimetableDisplayColumns(generatedTemplateDraft.lecturePlan).map((column) => {
                              if (column.type === 'lunch') {
                                if (dayIndex !== 0) return null;
                                return (
                                  <td
                                    key={`${row.day}-lunch`}
                                    rowSpan={generatedTemplateDraft.rows.length}
                                    className="border border-slate-300 bg-amber-50 px-3 py-2 align-middle text-center"
                                  >
                                    <div className="flex min-h-full min-w-18 items-center justify-center rounded-xl border border-amber-200 bg-amber-100/70 px-2 py-6">
                                      <div
                                        className="text-sm font-black uppercase tracking-[0.18em] text-amber-900"
                                        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                                      >
                                        Lunch
                                      </div>
                                    </div>
                                  </td>
                                );
                              }

                              const slot = row.slots[column.lectureIndex] || { subjectName: '', teacherName: '' };
                              return (
                                <td key={`${row.day}-editor-${column.lectureIndex}`} className="border border-slate-300 px-2 py-2 align-top">
                                  <div className="min-w-37.5 space-y-2">
                                    <CompactTemplateField
                                      prefix="S"
                                      value={slot.subjectName}
                                      onChange={(e) => handleDraftCellChange(dayIndex, column.lectureIndex, 'subjectName', e.target.value)}
                                      placeholder="Subject"
                                      suggestions={selectedClassSubjectOptions}
                                      datalistId={`subject-options-${slugifyTimetableValue(selectedClass || generatedTemplateDraft.className)}`}
                                    />
                                    <CompactTemplateSelect
                                      prefix="T"
                                      value={slot.teacherName}
                                      onChange={(e) => handleDraftCellChange(dayIndex, column.lectureIndex, 'teacherName', e.target.value)}
                                      options={selectedClassTeacherOptions}
                                    />
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="mt-8 rounded-4xl border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-white text-slate-300 shadow-sm">
                    <FileText size={34} />
                  </div>
                  <h4 className="mt-6 font-serif text-3xl font-black italic tracking-tight text-slate-950">No draft open</h4>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-500">
                    Pehle class page se template generate karein ya saved draft open karein.
                  </p>
                </div>
              )}
            </Panel>
          </section>
        ) : null}

        {activePage === 'exam' ? (
          <TwoColumnPage
            left={
              teacherSession ? (
                <Panel
                  title="Teacher Exam View"
                  description="Only exam timetable records connected to your classes or invigilation duty are listed on the right."
                >
                  <div className="mt-8 rounded-[1.8rem] border border-emerald-200 bg-emerald-50 p-6">
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700">Teacher Access</p>
                    <h4 className="mt-3 font-serif text-2xl font-black italic tracking-tight text-slate-950">Exam timetable is read-only here.</h4>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      You can review only the exam schedule for your teaching classes and any invigilation duties assigned to you.
                    </p>
                  </div>
                </Panel>
              ) : (
                <Panel title="Create Exam Slot" description="Plan assessment periods with invigilator, duration, seating range, room, and time.">
                  <form className="mt-8 grid gap-5 md:grid-cols-2" onSubmit={handleSaveExamSlot}>
                    <InputField label="Exam Title" value={examSlotForm.examTitle} onChange={(e) => setExamSlotForm({ ...examSlotForm, examTitle: e.target.value })} placeholder="Mid Term Examination" />
                    <SelectField label="Class" value={examSlotForm.className} onChange={(e) => setExamSlotForm({ ...examSlotForm, className: e.target.value })} options={['', ...classOptions]} />
                    <InputField label="Subject" value={examSlotForm.subjectName} onChange={(e) => setExamSlotForm({ ...examSlotForm, subjectName: e.target.value })} placeholder="Science" />
                    <InputField label="Exam Date" type="date" value={examSlotForm.examDate} onChange={(e) => setExamSlotForm({ ...examSlotForm, examDate: e.target.value })} />
                    <SelectField label="Day Of Week" value={examSlotForm.dayOfWeek} onChange={(e) => setExamSlotForm({ ...examSlotForm, dayOfWeek: e.target.value })} options={weekDays} />
                    <InputField label="Room ID" value={examSlotForm.roomId} onChange={(e) => setExamSlotForm({ ...examSlotForm, roomId: e.target.value })} placeholder="Exam Hall A" />
                    <InputField label="Time From" type="time" value={examSlotForm.timeFrom} onChange={(e) => setExamSlotForm({ ...examSlotForm, timeFrom: e.target.value })} />
                    <InputField label="Time To" type="time" value={examSlotForm.timeTo} onChange={(e) => setExamSlotForm({ ...examSlotForm, timeTo: e.target.value })} />
                    <InputField label="Invigilator Name" value={examSlotForm.invigilatorName} onChange={(e) => setExamSlotForm({ ...examSlotForm, invigilatorName: e.target.value })} placeholder="Neha Agarwal" />
                    <InputField label="Exam Duration" value={examSlotForm.examDuration} onChange={(e) => setExamSlotForm({ ...examSlotForm, examDuration: e.target.value })} placeholder="3 Hours" />
                    <div className="md:col-span-2">
                      <InputField label="Student Seating Range" value={examSlotForm.studentSeatingRange} onChange={(e) => setExamSlotForm({ ...examSlotForm, studentSeatingRange: e.target.value })} placeholder="Roll 001-045" />
                    </div>
                    <div className="md:col-span-2">
                      <PrimaryButton type="submit" icon={ShieldCheck} label="Save Exam Timetable Slot" />
                    </div>
                  </form>
                </Panel>
              )
            }
            right={
              <Panel
                title="Exam Timetable"
                description={teacherSession
                  ? 'Search your class-wise exam timetable and invigilation entries.'
                  : 'Search by exam, class, subject, invigilator, room, or seating range.'}
              >
                <div className="mt-6">
                  <SearchInput value={examSearch} onChange={setExamSearch} placeholder="Search exam timetable..." />
                </div>
                <div className="mt-6 grid gap-4">
                  {filteredExamSlots.map((slot) => (
                    <RecordCard key={slot.id} icon={ShieldCheck} title={`${slot.examTitle} | ${slot.examDate}`} subtitle={`${slot.className} | ${slot.subjectName} | ${slot.timeFrom} - ${slot.timeTo}`}>
                      <InfoPill icon={UserRound} text={slot.invigilatorName} />
                      <InfoPill icon={Clock3} text={slot.examDuration || `${slot.timeFrom}-${slot.timeTo}`} />
                      <InfoPill icon={GraduationCap} text={slot.studentSeatingRange || 'Seating pending'} />
                      <InfoPill icon={DoorOpen} text={slot.roomId} />
                      {!teacherSession ? (
                        <button onClick={() => handleDelete('timetable_exam_slots', slot.id, 'Delete this exam timetable slot?')} className="ml-auto text-slate-400 transition hover:text-rose-600">
                          <Trash2 size={18} />
                        </button>
                      ) : null}
                    </RecordCard>
                  ))}
                </div>
              </Panel>
            }
          />
        ) : null}
      </main>

      {previewRecord ? <FilePreviewModal record={previewRecord} onClose={() => setPreviewRecord(null)} /> : null}
    </div>
  );
};

const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const dayOrder = weekDays.reduce((map, day, index) => ({ ...map, [day]: index }), {});
const classTemplateDays = weekDays.slice(0, 6);

const buildTimetableTemplateFileName = (className) => {
  const slug = slugifyTimetableValue(className || 'class-timetable');
  return `${slug || 'class-timetable'}-template.xls`;
};

const normalizeTimetableClassLabel = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  const [baseClass] = normalized.split('/');
  return baseClass.trim();
};

const buildStudentTimetableClassCandidates = (student) => {
  if (!student || typeof student !== 'object') return [];

  const className = String(student.className || '').trim();
  const section = String(student.section || '').trim();
  const assignedClass = String(student.assignedClass || '').trim();
  const combinedClass = [className, section].filter(Boolean).join(' / ');

  if (assignedClass || combinedClass) {
    return [assignedClass, combinedClass].filter(Boolean);
  }

  return [className].filter(Boolean);
};

const slugifyTimetableValue = (value) => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const buildLecturePlan = (startTime, lectureCount, lectureLength, lunchLength) => {
  let currentMinutes = parseTimeToMinutes(startTime || '08:00');

  return Array.from({ length: lectureCount }, (_, index) => {
    const lectureNumber = index + 1;
    const timeFrom = formatMinutesToTime(currentMinutes);
    const timeTo = formatMinutesToTime(currentMinutes + lectureLength);
    currentMinutes += lectureLength;

    if (lectureNumber === 4 && lunchLength > 0 && lectureNumber < lectureCount) {
      currentMinutes += lunchLength;
    }

    return {
      lectureNumber,
      timeFrom,
      timeTo,
    };
  });
};

const buildTimetableDisplayColumns = (lecturePlan = []) => {
  const columns = [];

  lecturePlan.forEach((lecture, index) => {
    columns.push({
      key: `lecture-${lecture.lectureNumber}`,
      type: 'lecture',
      lecture,
      lectureIndex: index,
    });

    if (lecture.lectureNumber === 4 && index < lecturePlan.length - 1) {
      columns.push({
        key: 'lunch-after-4',
        type: 'lunch',
        timeLabel: `${lecture.timeTo} onwards`,
      });
    }
  });

  return columns;
};

const parseTimeToMinutes = (value) => {
  const [hour = '8', minute = '0'] = String(value || '08:00').split(':');
  return (Number(hour) * 60) + Number(minute);
};

const formatMinutesToTime = (totalMinutes) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const calculateLectureLength = (lecturePlan = []) => {
  const firstLecture = lecturePlan[0];
  if (!firstLecture?.timeFrom || !firstLecture?.timeTo) {
    return 45;
  }

  return Math.max(1, parseTimeToMinutes(firstLecture.timeTo) - parseTimeToMinutes(firstLecture.timeFrom));
};

const normalizeGeneratedTemplateDraft = (draft) => {
  if (!draft) return draft;

  return {
    ...draft,
    schoolName: formatTimetableText(draft.schoolName),
    className: formatTimetableText(draft.className),
    rows: (draft.rows || []).map((row) => ({
      ...row,
      slots: (row.slots || []).map((slot) => ({
        ...slot,
        subjectName: formatTimetableText(slot.subjectName),
        teacherName: formatTeacherStoredValue(slot.teacherName),
      })),
    })),
  };
};

const findUnusedTimetableSubjects = (draft, availableSubjects = []) => {
  const normalizedAvailableSubjects = [...new Set(
    availableSubjects
      .map((subjectName) => formatTimetableText(subjectName))
      .filter(Boolean),
  )];

  if (!normalizedAvailableSubjects.length) return [];

  const usedSubjects = new Set(
    (draft?.rows || [])
      .flatMap((row) => row.slots || [])
      .map((slot) => formatTimetableText(slot.subjectName))
      .filter(Boolean),
  );

  return normalizedAvailableSubjects.filter((subjectName) => !usedSubjects.has(subjectName));
};

const formatTeacherStoredValue = (value) => {
  const normalized = String(value || '').trim().replace(/\s+/g, ' ');
  if (!normalized) return '';

  const idMatch = normalized.match(/\(([^)]*)\)\s*$/);
  const teacherId = idMatch?.[1]?.trim() || '';
  const teacherName = normalized.replace(/\s*\([^)]*\)\s*$/, '');
  const formattedName = formatTimetableText(teacherName);

  return teacherId ? `${formattedName} (${teacherId})` : formattedName;
};

const formatTimetableText = (value) => {
  const normalized = String(value || '').trim().replace(/\s+/g, ' ');
  if (!normalized) return '';

  return normalized
    .toLowerCase()
    .split(' ')
    .map((word) => word ? `${word[0].toUpperCase()}${word.slice(1)}` : '')
    .join(' ');
};

const buildTimetableTemplateDataUri = ({ schoolName, className, lecturePlan, rows = [] }) => {
  const displayColumns = buildTimetableDisplayColumns(lecturePlan);
  const lectureHeaderCells = displayColumns.map((column) => {
    if (column.type === 'lunch') {
      return `
      <th style="border:1px solid #0f172a;background:#fde68a;padding:8px 6px;font-size:11px;font-weight:700;text-align:center;">
        Lunch<br />
        <span style="font-size:10px;font-weight:600;">${column.timeLabel}</span>
      </th>`;
    }

    return `
      <th style="border:1px solid #0f172a;background:#d1fae5;padding:8px 6px;font-size:11px;font-weight:700;text-align:center;">
        Lecture ${column.lecture.lectureNumber}<br />
        <span style="font-size:10px;font-weight:600;">${column.lecture.timeFrom} - ${column.lecture.timeTo}</span>
      </th>`;
  }).join('');

  const tableRows = classTemplateDays.map((day, dayIndex) => `
      <tr>
        <td style="border:1px solid #0f172a;background:#f8fafc;padding:8px 6px;font-size:11px;font-weight:700;">${day}</td>
        ${displayColumns.map((column) => {
          if (column.type === 'lunch') {
            if (dayIndex !== 0) return '';
            return `
          <td rowspan="${classTemplateDays.length}" style="border:1px solid #0f172a;background:#fef3c7;padding:7px 6px;vertical-align:middle;min-width:72px;text-align:center;font-size:11px;font-weight:700;color:#78350f;">
            <div style="display:flex;align-items:center;justify-content:center;min-height:100%;padding:8px 0;">
              <span style="writing-mode:vertical-rl;transform:rotate(180deg);letter-spacing:0.18em;text-transform:uppercase;">Lunch</span>
            </div>
          </td>`;
          }

          const slot = rows[dayIndex]?.slots?.[column.lectureIndex] || { subjectName: '', teacherName: '' };
          return `
          <td style="border:1px solid #0f172a;padding:7px 6px;vertical-align:top;min-width:130px;height:52px;">
            <div style="margin:0 0 6px 0;font-size:11px;color:#0f172a;"><strong>S:</strong> ${escapeTemplateHtml(slot.subjectName)}</div>
            <div style="font-size:11px;color:#0f172a;"><strong>T:</strong> ${escapeTemplateHtml(slot.teacherName)}</div>
          </td>`;
        }).join('')}
      </tr>`).join('');

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head>
        <meta charset="UTF-8" />
        <meta name="ProgId" content="Excel.Sheet" />
      </head>
      <body>
        <table border="0" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-family:Arial,sans-serif;min-width:${110 + (displayColumns.length * 136)}px;">
          <tr>
            <th colspan="${1 + displayColumns.length}" style="border:1px solid #0f172a;background:#0f766e;color:#ffffff;padding:10px 8px;font-size:16px;font-weight:700;text-align:center;">
              ${escapeTemplateHtml(schoolName)}
            </th>
          </tr>
          <tr>
            <th style="border:1px solid #0f172a;background:#0f172a;color:#ffffff;padding:9px 6px;font-size:11px;font-weight:700;text-align:center;">Day</th>
            ${lectureHeaderCells}
          </tr>
          ${tableRows}
        </table>
        <p style="margin-top:10px;font-size:10px;color:#64748b;">Class ${escapeTemplateHtml(className)}</p>
      </body>
    </html>`;

  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
};

const escapeTemplateHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const replaceModuleRecords = (module, records) => {
  const tenantId = db.getTenantId();
  if (!tenantId) return;
  localStorage.setItem(`${tenantId}_${module}`, JSON.stringify(records));
};

const sortByDayAndTime = (a, b) => {
  return (dayOrder[a.dayOfWeek] ?? 99) - (dayOrder[b.dayOfWeek] ?? 99) || String(a.timeFrom || '').localeCompare(String(b.timeFrom || ''));
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

const readTeacherTimetableTemplate = (record) => {
  if (record?.templateData?.rows?.length && record?.templateData?.lecturePlan?.length) {
    return record.templateData;
  }

  if (record?.fileType === 'text/html' && typeof window !== 'undefined') {
    return parseTemplateFromHtmlDataUri(record.fileData, record.className);
  }

  return null;
};

const parseTemplateFromHtmlDataUri = (dataUri, className) => {
  const html = decodeTimetableHtml(dataUri);
  if (!html) return null;

  const parser = new DOMParser();
  const documentNode = parser.parseFromString(html, 'text/html');
  const table = documentNode.querySelector('table');
  if (!table) return null;

  const rows = Array.from(table.querySelectorAll('tr'));
  if (rows.length < 3) return null;

  const headerCells = Array.from(rows[1].querySelectorAll('th'));
  const lecturePlan = headerCells.slice(1)
    .map((cell) => {
      const text = cell.textContent?.replace(/\s+/g, ' ').trim() || '';
      const lectureMatch = text.match(/Lecture\s+(\d+)/i);
      if (!lectureMatch) return null;
      const timeMatch = text.match(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
      return {
        lectureNumber: Number(lectureMatch[1]),
        timeFrom: timeMatch?.[1] || '',
        timeTo: timeMatch?.[2] || '',
      };
    })
    .filter(Boolean);

  const routineRows = rows.slice(2)
    .map((rowNode) => {
      const cells = Array.from(rowNode.querySelectorAll('td'));
      if (!cells.length) return null;

      const day = cells[0]?.textContent?.trim();
      if (!day) return null;

      const slotCells = cells.filter((cell, index) => {
        if (index === 0) return false;
        return !/Lunch/i.test(cell.textContent || '');
      });

      return {
        day,
        slots: lecturePlan.map((_, slotIndex) => {
          const slotCell = slotCells[slotIndex];
          const slotText = slotCell?.textContent?.replace(/\s+/g, ' ').trim() || '';
          return {
            subjectName: extractSlotValue(slotText, 'S'),
            teacherName: extractSlotValue(slotText, 'T'),
          };
        }),
      };
    })
    .filter(Boolean);

  if (!lecturePlan.length || !routineRows.length) return null;

  return {
    className,
    lecturePlan,
    rows: routineRows,
  };
};

const decodeTimetableHtml = (dataUri) => {
  if (!dataUri || typeof dataUri !== 'string') return '';
  const prefix = 'data:text/html;charset=utf-8,';
  if (!dataUri.startsWith(prefix)) return '';

  try {
    return decodeURIComponent(dataUri.slice(prefix.length));
  } catch {
    return '';
  }
};

const extractSlotValue = (slotText, key) => {
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
  const normalized = className.toLowerCase();
  const section = className.split('/')[1]?.trim() || '';

  if (normalized.includes('nursery')) return { rank: 0, section };
  if (normalized.includes('lkg')) return { rank: 1, section };
  if (normalized.includes('ukg')) return { rank: 2, section };

  const classMatch = normalized.match(/class\s*(\d+)/);
  if (classMatch) {
    return { rank: 2 + Number(classMatch[1]), section };
  }

  return { rank: 1000, section };
};

const formatSavedDate = (value) => {
  if (!value) return 'date pending';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatSavedTime = (value) => {
  if (!value) return 'Time pending';
  return new Date(value).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const isImageFile = (record) => {
  return record.fileType?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(record.fileName || '');
};

const isPdfFile = (record) => {
  return record.fileType === 'application/pdf' || /\.pdf$/i.test(record.fileName || '');
};

const isHtmlFile = (record) => {
  return record.fileType === 'text/html' || /\.(html?)$/i.test(record.fileName || '');
};

const isPreviewableFile = (record) => {
  return Boolean(record.fileData) && (isImageFile(record) || isPdfFile(record) || isHtmlFile(record));
};

const MetricCard = ({ label, value, icon }) => (
  <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-50/80">{label}</p>
        <p className="mt-3 text-3xl font-black tracking-tight text-white">{value}</p>
      </div>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-200/20 bg-emerald-200/10 text-emerald-50">
        {React.createElement(icon, { size: 20 })}
      </div>
    </div>
  </div>
);

const ActionCard = ({ icon, title, text, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex min-h-56 flex-col justify-between rounded-4xl border border-slate-200/80 bg-white p-6 text-left shadow-[0_20px_60px_-38px_rgba(15,23,42,0.45)] transition hover:-translate-y-1 hover:border-emerald-300 lg:p-8"
  >
    <div>
      <div className="flex items-start justify-between gap-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-700 transition group-hover:bg-emerald-600 group-hover:text-white">
          {React.createElement(icon, { size: 24 })}
        </div>
        <ArrowRight className="text-slate-300 transition group-hover:text-emerald-700" size={20} />
      </div>
      <h3 className="mt-7 font-serif text-3xl font-black italic tracking-tight text-slate-950">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-slate-500">{text}</p>
    </div>
    <span className="mt-6 text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700">Open Page</span>
  </button>
);

const TwoColumnPage = ({ left, right }) => (
  <div className="mt-8 grid gap-8 xl:grid-cols-[0.95fr_1.05fr]">
    {left}
    {right}
  </div>
);

const Panel = ({ title, description, children }) => (
  <section className="rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
    <h3 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">{title}</h3>
    <p className="mt-2 text-sm leading-7 text-slate-500">{description}</p>
    {children}
  </section>
);

const RecordCard = ({ icon, title, subtitle, children }) => (
  <article className="rounded-[1.8rem] border border-slate-200 bg-slate-50 p-5">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
          {React.createElement(icon, { size: 20 })}
        </div>
        <div className="min-w-0">
          <h4 className="truncate text-lg font-black tracking-tight text-slate-950">{title}</h4>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">{subtitle}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  </article>
);

const FilePreviewModal = ({ record, onClose }) => {
  const canPreview = isPreviewableFile(record);

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-4xl bg-white shadow-[0_30px_90px_-35px_rgba(15,23,42,0.75)]">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-7">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700">{record.className}</p>
            <h3 className="mt-1 truncate font-serif text-2xl font-black italic tracking-tight text-slate-950">{record.fileName || 'Saved timetable'}</h3>
            <p className="mt-1 text-xs font-bold text-slate-500">
              Saved {formatSavedDate(record.uploadedAt || record.createdAt)} at {formatSavedTime(record.uploadedAt || record.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {record.fileData ? (
              <a
                href={record.fileData}
                download={record.fileName || 'class-timetable'}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white transition hover:bg-emerald-600"
                title="Download"
              >
                <Download size={18} />
              </a>
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
                <img src={record.fileData} alt={record.fileName || 'Saved timetable'} className="mx-auto max-h-[72vh] w-auto max-w-full object-contain" />
              ) : (
                <iframe title={record.fileName || 'Saved timetable'} src={record.fileData} className="h-[72vh] w-full bg-white" />
              )}
            </div>
          ) : (
            <div className="flex min-h-[55vh] flex-col items-center justify-center rounded-[1.6rem] border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-700">
                <FileText size={34} />
              </div>
              <h4 className="mt-6 font-serif text-3xl font-black italic tracking-tight text-slate-950">Preview not available</h4>
              <p className="mt-3 max-w-md text-sm leading-7 text-slate-500">
                This file type may not render inside the browser. Use download to open the saved timetable file.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const InputField = ({ label, ...props }) => (
  <div className="space-y-2.5">
    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
    <input
      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
      {...props}
    />
  </div>
);

const SelectField = ({ label, options, renderOptionLabel, ...props }) => (
  <div className="space-y-2.5">
    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
    <select
      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-3.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
      {...props}
    >
      {options.map((option) => (
        <option key={option || 'empty-option'} value={option}>
          {renderOptionLabel ? renderOptionLabel(option) : option || 'Select'}
        </option>
      ))}
    </select>
  </div>
);

const CompactTemplateField = ({ prefix, suggestions = [], datalistId, ...props }) => (
  <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2">
    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-emerald-100 px-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
      {prefix}
    </span>
    {suggestions.length ? (
      <select
        className="w-full bg-transparent text-xs font-semibold text-slate-900 outline-none"
        {...props}
      >
        <option value="">Select</option>
        {suggestions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    ) : (
      <input
        className="w-full bg-transparent text-xs font-semibold text-slate-900 outline-none placeholder:text-slate-400"
        {...props}
      />
    )}
  </label>
);

const CompactTemplateSelect = ({ prefix, options, ...props }) => (
  <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2">
    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-emerald-100 px-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
      {prefix}
    </span>
    <select
      className="w-full bg-transparent text-xs font-semibold text-slate-900 outline-none"
      {...props}
    >
      <option value="">Select teacher</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
);

const SearchInput = ({ value, onChange, placeholder }) => (
  <div className="relative">
    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-12 py-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
    />
  </div>
);

const PrimaryButton = ({ type, icon, label }) => (
  <button
    type={type}
    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-white transition hover:bg-emerald-600"
  >
    {React.createElement(icon, { size: 15 })}
    {label}
  </button>
);

const InfoPill = ({ icon, text }) => (
  <div className="inline-flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">
    {React.createElement(icon, { size: 15, className: 'text-emerald-700' })}
    <span>{text}</span>
  </div>
);

export default TimetableManagement;
