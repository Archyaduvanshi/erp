import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, GraduationCap, Search } from 'lucide-react';
import { resultApi } from '../../utils/api';

const ResultManagement = () => {
  const navigate = useNavigate();
  const [session] = useState(() => JSON.parse(localStorage.getItem('active_session')) || null);
  const [classes, setClasses] = useState([]);
  const [classStudents, setClassStudents] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [studentResult, setStudentResult] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!session || !['admin', 'feature'].includes(session.role)) {
      navigate('/login');
      return;
    }

    const loadClasses = async () => {
      try {
        setClasses(await resultApi.getClasses());
        setLoadError('');
      } catch (error) {
        setClasses([]);
        setLoadError(error.message || 'Unable to load result data from database.');
      }
    };

    loadClasses();
  }, [navigate, session]);

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
      recordMap: new Map((studentResult.cells || []).map((cell) => [buildResultCellKey(cell.subjectName, cell.examKey), cell])),
      examSummaries: new Map((studentResult.summaries || []).map((summary) => [summary.examKey, summary])),
    };
  }, [studentResult]);

  const openClass = async (className) => {
    setSelectedClass(className);
    setSelectedStudentId('');
    setStudentResult(null);
    setSearchTerm('');
    try {
      setClassStudents(await resultApi.getClassStudents(className));
      setLoadError('');
    } catch (error) {
      setClassStudents([]);
      setLoadError(error.message || 'Unable to fetch class students from database.');
    }
  };

  const openStudent = async (studentId) => {
    setSelectedStudentId(String(studentId));
    try {
      setStudentResult(await resultApi.getStudentResult(selectedClass, studentId));
      setLoadError('');
    } catch (error) {
      setStudentResult(null);
      setLoadError(error.message || 'Unable to fetch student result from database.');
    }
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
                setStudentResult(null);
                return;
              }
              if (selectedClass) {
                setSelectedClass('');
                setClassStudents([]);
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
            {loadError}
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
            <div className="mb-5 max-w-md">
              <SearchBox value={searchTerm} onChange={setSearchTerm} />
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
                        <tr key={subjectName} className="hover:bg-fuchsia-50/50">
                          <td className="sticky left-0 z-10 bg-white px-4 py-4 font-black text-slate-950">
                            {subjectName}
                          </td>
                          {resultTable.exams.map((exam) => {
                            const record = resultTable.recordMap.get(buildResultCellKey(subjectName, exam.key));
                            return (
                              <td key={`${subjectName}-${exam.key}`} className="px-4 py-4">
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

const buildResultCellKey = (subjectName, examKey) => `${subjectName}__${examKey}`;

export default ResultManagement;
