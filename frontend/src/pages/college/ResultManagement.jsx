import React, { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, GraduationCap, Search } from 'lucide-react';
import { academicSessionApi, resultApi } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

const ResultManagement = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedExamId, setSelectedExamId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!session || !['admin', 'feature'].includes(session.role)) {
      navigate('/login');
    }
  }, [navigate, session]);

  const sessionsQuery = useQuery({
    queryKey: ['results', 'academic-sessions'],
    queryFn: academicSessionApi.getAll,
    enabled: ['admin', 'feature'].includes(session?.role),
  });

  const currentAcademicSession = useMemo(() => (
    (sessionsQuery.data || []).find((entry) => entry.current) || (sessionsQuery.data || [])[0] || null
  ), [sessionsQuery.data]);

  const classesQuery = useQuery({
    queryKey: ['results', 'classes', currentAcademicSession?.id],
    queryFn: () => resultApi.getClasses({ academicSessionId: currentAcademicSession?.id }),
    enabled: ['admin', 'feature'].includes(session?.role) && Boolean(currentAcademicSession?.id),
  });

  const classStudentsQuery = useQuery({
    queryKey: ['results', 'students', currentAcademicSession?.id, selectedClass, selectedExamId],
    queryFn: () => resultApi.getClassStudents(selectedClass, {
      academicSessionId: currentAcademicSession?.id,
      examId: selectedExamId || undefined,
    }),
    enabled: ['admin', 'feature'].includes(session?.role) && Boolean(currentAcademicSession?.id && selectedClass),
    placeholderData: keepPreviousData,
  });

  const classExamsQuery = useQuery({
    queryKey: ['results', 'exams', currentAcademicSession?.id, selectedClass],
    queryFn: () => resultApi.getClassExams(selectedClass, { academicSessionId: currentAcademicSession?.id }),
    enabled: ['admin', 'feature'].includes(session?.role) && Boolean(currentAcademicSession?.id && selectedClass),
    placeholderData: keepPreviousData,
  });

  const studentResultQuery = useQuery({
    queryKey: ['results', 'student', currentAcademicSession?.id, selectedClass, selectedStudentId, selectedExamId],
    queryFn: () => resultApi.getStudentResult(selectedClass, selectedStudentId, {
      academicSessionId: currentAcademicSession?.id,
      examId: selectedExamId || undefined,
    }),
    enabled: ['admin', 'feature'].includes(session?.role) && Boolean(currentAcademicSession?.id && selectedClass && selectedStudentId),
  });

  const publishMutation = useMutation({
    mutationFn: () => resultApi.publish({
      className: selectedClass,
      academicSessionId: currentAcademicSession?.id,
      examId: selectedExamId,
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['results'] }),
  });

  const reopenMutation = useMutation({
    mutationFn: (reason) => resultApi.reopen({
      className: selectedClass,
      academicSessionId: currentAcademicSession?.id,
      examId: selectedExamId,
      reason,
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['results'] }),
  });

  const classes = classesQuery.data || [];
  const classStudents = classStudentsQuery.data || [];
  const classExams = classExamsQuery.data || [];
  const studentResult = studentResultQuery.data || null;
  const loadError = [
    sessionsQuery.error,
    classesQuery.error,
    classStudentsQuery.error,
    classExamsQuery.error,
    studentResultQuery.error,
    publishMutation.error,
    reopenMutation.error,
  ].find(Boolean);

  const visibleStudents = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return classStudents.filter((student) => (
      !query ||
      String(student.name || '').toLowerCase().includes(query) ||
      String(student.rollNo || '').toLowerCase().includes(query)
    ));
  }, [classStudents, searchTerm]);

  const selectedStudent = studentResult?.student || classStudents.find((student) => String(student.id) === String(selectedStudentId));

  const resultTable = useMemo(() => {
    if (!studentResult) {
      return { exams: [], subjects: [], recordMap: new Map(), examSummaries: new Map() };
    }

    return {
      exams: studentResult.exams || [],
      subjects: studentResult.subjects || [],
      recordMap: new Map((studentResult.cells || []).map((cell) => [buildResultCellKey(cell.subjectId, cell.subjectName, cell.examId, cell.examKey), cell])),
      examSummaries: new Map((studentResult.summaries || []).map((summary) => [summary.examKey, summary])),
    };
  }, [studentResult]);

  const openClass = (className) => {
    setSelectedClass(className);
    setSelectedStudentId('');
    setSelectedExamId('');
    setSearchTerm('');
  };

  const openStudent = (studentId) => {
    setSelectedStudentId(String(studentId));
  };

  if (!session || !['admin', 'feature'].includes(session.role)) return null;

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-12 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-screen-2xl items-center gap-3 px-6 py-4 md:px-10">
          <button
            type="button"
          onClick={() => {
              if (selectedStudentId) {
                setSelectedStudentId('');
                return;
              }
              if (selectedClass) {
                setSelectedClass('');
                setSelectedExamId('');
                setSearchTerm('');
                return;
              }
              navigate('/college');
            }}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 transition hover:border-fuchsia-300 hover:text-fuchsia-700"
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-fuchsia-700">Result</p>
            <h1 className="truncate text-2xl font-black tracking-tight text-slate-950">Student Result Register</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-screen-2xl px-6 py-8 md:px-10">
        {loadError ? (
          <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {loadError.message || 'Unable to load result data from database.'}
          </div>
        ) : null}

        {!selectedClass ? (
          <Panel title="Select Class" description="Result classes database se fetch hoti hain. Class select karke students dekho.">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {classes.map((entry) => (
                <button
                  key={entry.className}
                  type="button"
                  onClick={() => openClass(entry.className)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:border-fuchsia-300 hover:bg-white hover:shadow-sm"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-fuchsia-100 text-fuchsia-700">
                    <GraduationCap size={20} />
                  </div>
                  <h3 className="mt-4 text-xl font-black tracking-tight text-slate-950">{entry.className}</h3>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <MiniStat label="Students" value={entry.studentCount} />
                    <MiniStat label="Results" value={entry.resultCount} />
                    <MiniStat label="Subjects" value={entry.subjectCount} />
                  </div>
                </button>
              ))}
            </div>
            {!classes.length ? <EmptyState text="No classes found. Teacher marks upload hone ke baad result classes yahan show hongi." /> : null}
          </Panel>
        ) : null}

        {selectedClass && !selectedStudentId ? (
          <Panel title={`${selectedClass} Students`} description="Students aur unka result status database se fetch hota hai.">
            <div className="mb-5 grid gap-3 md:grid-cols-[minmax(220px,1fr)_260px_auto_auto]">
              <SearchBox value={searchTerm} onChange={setSearchTerm} />
              <select
                value={selectedExamId}
                onChange={(event) => setSelectedExamId(event.target.value)}
                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-fuchsia-500 focus:bg-white"
              >
                <option value="">All exams</option>
                {classExams.map((exam) => (
                  <option key={exam.examId || exam.key} value={exam.examId || ''}>
                    {exam.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => publishMutation.mutate()}
                disabled={!selectedExamId || publishMutation.isPending}
                className="h-11 rounded-xl bg-slate-950 px-4 text-[11px] font-black uppercase tracking-[0.14em] text-white transition hover:bg-fuchsia-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Publish
              </button>
              <button
                type="button"
                onClick={() => {
                  const reason = window.prompt('Reopen reason');
                  if (reason?.trim()) {
                    reopenMutation.mutate(reason.trim());
                  }
                }}
                disabled={!selectedExamId || reopenMutation.isPending}
                className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-[11px] font-black uppercase tracking-[0.14em] text-slate-600 transition hover:border-fuchsia-300 hover:text-fuchsia-700 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                Reopen
              </button>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              {visibleStudents.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-[760px] w-full divide-y divide-slate-200 text-left text-sm">
                    <thead className="bg-slate-100">
                      <tr>
                        {['Student Name', 'Roll No', 'Class', 'Subjects', 'Status', 'Action'].map((heading) => (
                          <th key={heading} className="px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{heading}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {visibleStudents.map((student) => (
                        <tr key={student.id} className="hover:bg-fuchsia-50/50">
                          <td className="px-4 py-4 font-black text-slate-950">{student.name}</td>
                          <td className="px-4 py-4 text-slate-700">{student.rollNo}</td>
                          <td className="px-4 py-4 text-slate-700">{student.className}</td>
                          <td className="px-4 py-4 text-slate-700">{student.subjectCount}</td>
                          <td className="px-4 py-4">
                            <StatusPill status={student.status} />
                          </td>
                          <td className="px-4 py-4">
                            <button
                              type="button"
                              onClick={() => openStudent(student.id)}
                              className="rounded-lg bg-slate-950 px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-white transition hover:bg-fuchsia-700"
                            >
                              View Result
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState text="No students found for this class." />
              )}
            </div>
          </Panel>
        ) : null}

        {selectedStudentId ? (
          <Panel title={`${selectedStudent?.name || 'Student'} Result`} description={`${selectedStudent?.className || selectedClass} | Roll No: ${selectedStudent?.rollNo || '-'}`}>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              {resultTable.subjects.length && resultTable.exams.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[920px] divide-y divide-slate-200 text-left text-sm">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="sticky left-0 z-10 min-w-52 bg-slate-100 px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                          Subject
                        </th>
                        {resultTable.exams.map((exam) => (
                          <th key={exam.key} className="min-w-44 px-4 py-3">
                            <span className="block text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{exam.title}</span>
                            <span className="mt-1 block text-xs font-bold normal-case tracking-normal text-slate-700">
                              {exam.maxMarksLabel}{exam.examDate ? ` | ${exam.examDate}` : ''}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {resultTable.subjects.map((subjectName) => (
                        <tr key={subjectName.subjectId || subjectName.name} className="hover:bg-fuchsia-50/50">
                          <td className="sticky left-0 z-10 bg-white px-4 py-4 font-black text-slate-950">
                            {subjectName.name || subjectName}
                          </td>
                          {resultTable.exams.map((exam) => {
                            const record = resultTable.recordMap.get(buildResultCellKey(subjectName.subjectId, subjectName.name || subjectName, exam.examId, exam.key));
                            return (
                              <td key={`${subjectName.subjectId || subjectName.name || subjectName}-${exam.key}`} className="px-4 py-4">
                                {record ? <MarksCell record={record} /> : <span className="text-xs font-bold text-slate-400">Pending</span>}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      <SummaryRow label="Total Obtained Marks" exams={resultTable.exams} summaries={resultTable.examSummaries} renderValue={(summary) => summary.totalObtainedMarks} />
                      <SummaryRow label="Total Marks" exams={resultTable.exams} summaries={resultTable.examSummaries} renderValue={(summary) => summary.totalMarks} />
                      <SummaryRow label="Percentage" exams={resultTable.exams} summaries={resultTable.examSummaries} renderValue={(summary) => Number(summary.totalMarks) > 0 ? `${summary.percentage}%` : '-'} />
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState text="No marks uploaded for this student yet." />
              )}
            </div>
          </Panel>
        ) : null}
      </main>
    </div>
  );
};

const Panel = ({ title, description, children }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <h2 className="text-xl font-black tracking-tight text-slate-950">{title}</h2>
    <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
    <div className="mt-6">{children}</div>
  </section>
);

const MiniStat = ({ label, value }) => (
  <div className="rounded-xl bg-white px-3 py-2">
    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
    <p className="mt-1 truncate text-sm font-black text-slate-900">{value}</p>
  </div>
);

const SearchBox = ({ value, onChange }) => (
  <div className="relative">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Search student or roll no..."
      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-10 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-fuchsia-500 focus:bg-white"
    />
  </div>
);

const StatusPill = ({ status }) => {
  const normalizedStatus = String(status || 'Pending');
  const isPass = normalizedStatus.toLowerCase() === 'pass';
  const isFail = normalizedStatus.toLowerCase() === 'fail';

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
      isPass ? 'bg-emerald-100 text-emerald-700' : isFail ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'
    }`}>
      {normalizedStatus}
    </span>
  );
};

const MarksCell = ({ record }) => (
  <span className="font-black text-slate-950">{record.marksObtained}</span>
);

const SummaryRow = ({ label, exams, summaries, renderValue }) => (
  <tr className="border-t-2 border-slate-200 bg-slate-50">
    <td className="sticky left-0 z-10 bg-slate-50 px-4 py-4 text-[11px] font-black uppercase tracking-[0.16em] text-slate-600">
      {label}
    </td>
    {exams.map((exam) => {
      const summary = summaries.get(exam.key) || { totalObtainedMarks: 0, totalMarks: 0, percentage: 0 };
      return (
        <td key={`${label}-${exam.key}`} className="px-4 py-4 font-black text-slate-950">
          {renderValue(summary)}
        </td>
      );
    })}
  </tr>
);

const EmptyState = ({ text }) => (
  <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm font-semibold text-slate-500">
    {text}
  </div>
);

const buildResultCellKey = (subjectId, subjectName, examId, examKey) => `${subjectId || subjectName}__${examId || examKey}`;

export default ResultManagement;
