import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Copy,
  Library,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { academicSessionApi, classSubjectApi, curriculumApi, subjectApi } from '../../utils/api';

const subjectTypes = ['CORE', 'ELECTIVE', 'OPTIONAL', 'ACTIVITY'];
const statuses = ['ACTIVE', 'INACTIVE', 'ARCHIVED'];
const languages = ['English', 'Hindi', 'Bilingual'];

const initialSubjectForm = {
  subjectId: '',
  subjectName: '',
  subjectCode: '',
  subjectType: 'CORE',
  displayOrder: 0,
  status: 'ACTIVE',
  notes: '',
};

const initialBookForm = {
  bookTitle: '',
  publisher: '',
  language: 'English',
  isbn: '',
  edition: '',
  primaryBook: true,
  status: 'ACTIVE',
  notes: '',
};

const CourseSubjectManagement = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [selectedClass, setSelectedClass] = useState(null);
  const [classSearch, setClassSearch] = useState('');
  const [subjectSearch, setSubjectSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [expandedSubjectId, setExpandedSubjectId] = useState(null);
  const [subjectFormOpen, setSubjectFormOpen] = useState(false);
  const [subjectForm, setSubjectForm] = useState(initialSubjectForm);
  const [bookFormSubjectId, setBookFormSubjectId] = useState(null);
  const [bookForm, setBookForm] = useState(initialBookForm);
  const [loadError, setLoadError] = useState('');

  const sessionsQuery = useQuery({
    queryKey: ['academic-sessions'],
    queryFn: academicSessionApi.getAll,
    staleTime: 15 * 60 * 1000,
  });

  const sessions = sessionsQuery.data || [];
  const activeSession = sessions.find((session) => String(session.id) === String(selectedSessionId))
    || sessions.find((session) => session.current)
    || sessions[0];
  const academicSessionId = activeSession?.id || '';

  const classSummaryQuery = useQuery({
    queryKey: ['curriculum-classes', academicSessionId],
    queryFn: () => curriculumApi.getClassSummaries(academicSessionId),
    enabled: Boolean(academicSessionId),
    staleTime: 10 * 60 * 1000,
  });

  const subjectMasterQuery = useQuery({
    queryKey: ['subject-master'],
    queryFn: subjectApi.getAll,
    staleTime: 15 * 60 * 1000,
  });

  const classSubjectsQuery = useQuery({
    queryKey: ['class-subjects', selectedClass?.classId, academicSessionId],
    queryFn: () => classSubjectApi.getByClass(selectedClass.classId, academicSessionId),
    enabled: Boolean(selectedClass?.classId && academicSessionId),
    staleTime: 10 * 60 * 1000,
  });

  const booksQuery = useQuery({
    queryKey: ['class-subject-books', expandedSubjectId],
    queryFn: () => classSubjectApi.getBooks(expandedSubjectId),
    enabled: Boolean(expandedSubjectId),
    staleTime: 10 * 60 * 1000,
  });

  const visibleClasses = useMemo(() => {
    const query = classSearch.trim().toLowerCase();
    return (classSummaryQuery.data || []).filter((row) => !query || String(row.className || '').toLowerCase().includes(query));
  }, [classSummaryQuery.data, classSearch]);

  const visibleSubjects = useMemo(() => {
    const query = subjectSearch.trim().toLowerCase();
    return (classSubjectsQuery.data || []).filter((row) => {
      const matchesSearch = !query
        || String(row.subjectName || '').toLowerCase().includes(query)
        || String(row.subjectCode || '').toLowerCase().includes(query);
      return matchesSearch
        && (!typeFilter || row.subjectType === typeFilter)
        && (!statusFilter || row.status === statusFilter);
    });
  }, [classSubjectsQuery.data, statusFilter, subjectSearch, typeFilter]);

  const addSubjectMutation = useMutation({
    mutationFn: (payload) => classSubjectApi.create(payload),
    onSuccess: async () => {
      setSubjectForm(initialSubjectForm);
      setSubjectFormOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['class-subjects', selectedClass?.classId, academicSessionId] }),
        queryClient.invalidateQueries({ queryKey: ['curriculum-classes', academicSessionId] }),
        queryClient.invalidateQueries({ queryKey: ['subject-master'] }),
      ]);
      setLoadError('');
    },
    onError: (error) => setLoadError(error.message || 'Unable to save subject.'),
  });

  const archiveSubjectMutation = useMutation({
    mutationFn: (classSubjectId) => classSubjectApi.archive(classSubjectId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['class-subjects', selectedClass?.classId, academicSessionId] }),
        queryClient.invalidateQueries({ queryKey: ['curriculum-classes', academicSessionId] }),
      ]);
    },
    onError: (error) => setLoadError(error.message || 'Unable to archive subject.'),
  });

  const saveBookMutation = useMutation({
    mutationFn: ({ classSubjectId, payload }) => classSubjectApi.createBook(classSubjectId, payload),
    onSuccess: async (_, variables) => {
      setBookForm(initialBookForm);
      setBookFormSubjectId(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['class-subject-books', variables.classSubjectId] }),
        queryClient.invalidateQueries({ queryKey: ['class-subjects', selectedClass?.classId, academicSessionId] }),
        queryClient.invalidateQueries({ queryKey: ['curriculum-classes', academicSessionId] }),
      ]);
    },
    onError: (error) => setLoadError(error.message || 'Unable to save book.'),
  });

  const deleteBookMutation = useMutation({
    mutationFn: ({ classSubjectId, bookId }) => classSubjectApi.deleteBook(classSubjectId, bookId),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['class-subject-books', variables.classSubjectId] }),
        queryClient.invalidateQueries({ queryKey: ['class-subjects', selectedClass?.classId, academicSessionId] }),
        queryClient.invalidateQueries({ queryKey: ['curriculum-classes', academicSessionId] }),
      ]);
    },
    onError: (error) => setLoadError(error.message || 'Unable to delete book.'),
  });

  const copyMutation = useMutation({
    mutationFn: (payload) => curriculumApi.copy(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['class-subjects', selectedClass?.classId, academicSessionId] }),
        queryClient.invalidateQueries({ queryKey: ['curriculum-classes', academicSessionId] }),
      ]);
    },
    onError: (error) => setLoadError(error.message || 'Unable to copy curriculum.'),
  });

  const handleSessionChange = (sessionId) => {
    setSelectedSessionId(sessionId);
    setSelectedClass(null);
    setExpandedSubjectId(null);
  };

  const handleSubjectSubmit = (event) => {
    event.preventDefault();
    if (!selectedClass || !academicSessionId) return;
    addSubjectMutation.mutate({
      academicSessionId,
      classId: selectedClass.classId,
      subjectId: subjectForm.subjectId ? Number(subjectForm.subjectId) : null,
      subjectName: subjectForm.subjectId ? null : subjectForm.subjectName,
      subjectCode: subjectForm.subjectCode,
      subjectType: subjectForm.subjectType,
      displayOrder: Number(subjectForm.displayOrder) || 0,
      status: subjectForm.status,
      notes: subjectForm.notes,
    });
  };

  const handleBookSubmit = (event, classSubjectId) => {
    event.preventDefault();
    saveBookMutation.mutate({ classSubjectId, payload: bookForm });
  };

  const copyFromPreviousSession = () => {
    if (!selectedClass || sessions.length < 2) return;
    const source = sessions.find((session) => String(session.id) !== String(academicSessionId));
    if (!source) return;
    copyMutation.mutate({
      sourceAcademicSessionId: source.id,
      targetAcademicSessionId: academicSessionId,
      classId: selectedClass.classId,
      copySubjects: true,
      copyBooks: true,
    });
  };

  const selectedSubjectBooks = booksQuery.data || [];
  const subjectMaster = subjectMasterQuery.data || [];
  const error = loadError || sessionsQuery.error?.message || classSummaryQuery.error?.message || classSubjectsQuery.error?.message || booksQuery.error?.message || '';

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f4f7fb_0%,#eef4ff_55%,#f9fbff_100%)] text-slate-900 selection:bg-cyan-500 selection:text-slate-950">
      <header className="border-b border-slate-200/70 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => selectedClass ? setSelectedClass(null) : navigate('/college')} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 transition hover:border-cyan-300 hover:text-cyan-700">
              <ArrowLeft size={15} />
              {selectedClass ? 'Classes' : 'Back'}
            </button>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-cyan-600">Course & Subject Management</p>
              <h1 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">{selectedClass ? selectedClass.className : 'Curriculum Studio'}</h1>
            </div>
          </div>
          <select value={String(academicSessionId || '')} onChange={(event) => handleSessionChange(event.target.value)} className="rounded-full border border-slate-200 bg-white px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-600 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100">
            {sessions.map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}
          </select>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-10 lg:py-10">
        {error ? <div className="mb-6 rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">{error}</div> : null}

        {!selectedClass ? (
          <section className="rounded-4xl border border-slate-200/80 bg-white p-5 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-6">
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">Class Directory</h3>
                <p className="mt-1 text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
                  {visibleClasses.length} classes | curriculum summary
                </p>
              </div>
              <div className="w-full max-w-md">
                <SearchInput value={classSearch} onChange={setClassSearch} placeholder="Search class..." />
              </div>
            </div>
            {classSummaryQuery.isLoading ? (
              <SkeletonGrid />
            ) : visibleClasses.length ? (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {visibleClasses.map((classItem) => (
                  <button key={classItem.classId} type="button" onClick={() => { setSelectedClass(classItem); setExpandedSubjectId(null); setSubjectSearch(''); }} className="group rounded-[1.9rem] border border-slate-200/80 bg-slate-50 p-6 text-left shadow-[0_16px_40px_-28px_rgba(15,23,42,0.35)] transition hover:-translate-y-1 hover:border-cyan-200 hover:bg-white hover:shadow-[0_24px_50px_-28px_rgba(6,182,212,0.35)]">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-serif text-2xl font-black italic tracking-tight text-slate-950">{classItem.className}</p>
                        <p className="mt-2 text-[11px] font-black uppercase tracking-[0.18em] text-cyan-700">{classItem.subjectCount || 0} Subjects | {classItem.bookCount || 0} Books</p>
                      </div>
                      <span className="rounded-2xl bg-white p-3 text-slate-400 shadow-sm transition group-hover:bg-cyan-50 group-hover:text-cyan-700">
                        <ChevronRight className="h-5 w-5" />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState title="No classes configured" action="Add class data once, then subjects can exist even before students are enrolled." />
            )}
          </section>
        ) : (
          <section className="rounded-4xl border border-slate-200/80 bg-white p-5 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-6">
            <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-600">Academic Session: {activeSession?.name || '-'}</p>
                <h2 className="mt-1 font-serif text-2xl font-black italic tracking-tight text-slate-950">{selectedClass.className} Subjects</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={copyFromPreviousSession} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-600 transition hover:border-cyan-300 hover:text-cyan-700"><Copy size={15} /> Copy Previous</button>
                <button type="button" onClick={() => setSubjectFormOpen(true)} className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-white shadow-lg shadow-slate-300 transition hover:bg-cyan-600"><Plus size={15} /> Add Subject</button>
              </div>
            </div>

            <div className="mb-6 grid gap-3 lg:grid-cols-[1fr_180px_180px]">
              <SearchInput value={subjectSearch} onChange={setSubjectSearch} placeholder="Search subject..." />
              <SelectBare value={typeFilter} onChange={setTypeFilter}><option value="">All Types</option>{subjectTypes.map((type) => <option key={type} value={type}>{type}</option>)}</SelectBare>
              <SelectBare value={statusFilter} onChange={setStatusFilter}><option value="">All Status</option>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</SelectBare>
            </div>

            {subjectFormOpen ? <SubjectForm form={subjectForm} setForm={setSubjectForm} subjectMaster={subjectMaster} onClose={() => setSubjectFormOpen(false)} onSubmit={handleSubjectSubmit} saving={addSubjectMutation.isPending} /> : null}

            {classSubjectsQuery.isLoading ? (
              <div className="space-y-3">{[1, 2, 3].map((item) => <div key={item} className="h-20 animate-pulse rounded-[1.5rem] bg-slate-100" />)}</div>
            ) : visibleSubjects.length ? (
              <SubjectTable
                subjects={visibleSubjects}
                expandedSubjectId={expandedSubjectId}
                setExpandedSubjectId={setExpandedSubjectId}
                books={selectedSubjectBooks}
                booksLoading={booksQuery.isLoading}
                bookFormSubjectId={bookFormSubjectId}
                setBookFormSubjectId={setBookFormSubjectId}
                bookForm={bookForm}
                setBookForm={setBookForm}
                onBookSubmit={handleBookSubmit}
                onBookDelete={(classSubjectId, bookId) => deleteBookMutation.mutate({ classSubjectId, bookId })}
                onArchive={(classSubjectId) => archiveSubjectMutation.mutate(classSubjectId)}
                savingBook={saveBookMutation.isPending}
              />
            ) : (
              <EmptyState title={`No subjects configured for ${selectedClass.className}`} action="Add a subject or copy from previous session." />
            )}
          </section>
        )}
      </main>
    </div>
  );
};

const SubjectTable = ({ subjects, expandedSubjectId, setExpandedSubjectId, books, booksLoading, bookFormSubjectId, setBookFormSubjectId, bookForm, setBookForm, onBookSubmit, onBookDelete, onArchive, savingBook }) => (
  <div className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_16px_45px_-32px_rgba(15,23,42,0.35)]">
    <table className="w-full min-w-[760px] text-left">
      <thead className="border-b border-slate-200 bg-slate-50">
        <tr>{['Subject', 'Code', 'Type', 'Books', 'Status', 'Action'].map((heading) => <th key={heading} className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">{heading}</th>)}</tr>
      </thead>
      <tbody className="divide-y divide-slate-200 bg-white">
        {subjects.map((subject) => (
          <React.Fragment key={subject.classSubjectId}>
            <tr className="transition hover:bg-cyan-50/60">
              <td className="px-6 py-5">
                <button type="button" onClick={() => setExpandedSubjectId(expandedSubjectId === subject.classSubjectId ? null : subject.classSubjectId)} className="inline-flex items-center gap-3 text-left">
                  <span className="rounded-xl bg-slate-100 p-2 text-slate-500">
                    {expandedSubjectId === subject.classSubjectId ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </span>
                  <span className="text-sm font-black text-slate-950">{subject.subjectName}</span>
                </button>
                {subject.notes ? <p className="mt-1 text-xs font-semibold text-slate-500">{subject.notes}</p> : null}
              </td>
              <td className="px-6 py-5 text-sm font-black text-slate-700">{subject.subjectCode}</td>
              <td className="px-6 py-5"><span className="rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-700">{subject.subjectType}</span></td>
              <td className="px-6 py-5 text-sm font-black text-slate-700">{subject.bookCount || 0}</td>
              <td className="px-6 py-5"><span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">{subject.status}</span></td>
              <td className="px-6 py-5"><button type="button" onClick={() => onArchive(subject.classSubjectId)} className="rounded-2xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600" title="Archive subject"><Trash2 size={15} /></button></td>
            </tr>
            {expandedSubjectId === subject.classSubjectId ? (
              <tr>
                <td colSpan={6} className="bg-slate-50/80 px-6 py-5">
                  <BookPanel
                    books={books}
                    loading={booksLoading}
                    formOpen={bookFormSubjectId === subject.classSubjectId}
                    form={bookForm}
                    setForm={setBookForm}
                    onOpenForm={() => setBookFormSubjectId(subject.classSubjectId)}
                    onCloseForm={() => setBookFormSubjectId(null)}
                    onSubmit={(event) => onBookSubmit(event, subject.classSubjectId)}
                    onDelete={(bookId) => onBookDelete(subject.classSubjectId, bookId)}
                    saving={savingBook}
                  />
                </td>
              </tr>
            ) : null}
          </React.Fragment>
        ))}
      </tbody>
    </table>
  </div>
);

const SubjectForm = ({ form, setForm, subjectMaster, onClose, onSubmit, saving }) => (
  <form onSubmit={onSubmit} className="mb-6 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_16px_45px_-32px_rgba(15,23,42,0.35)]">
    <div className="mb-4 flex items-center justify-between">
      <h3 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">Add Subject</h3>
      <button type="button" onClick={onClose} className="rounded-2xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-rose-600"><X size={16} /></button>
    </div>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <Select label="Subject Master" value={form.subjectId} onChange={(value) => setForm({ ...form, subjectId: value, subjectName: '', subjectCode: '' })}>
        <option value="">Create New Subject</option>
        {subjectMaster.map((subject) => <option key={subject.id} value={subject.id}>{subject.name} ({subject.code})</option>)}
      </Select>
      {!form.subjectId ? (
        <>
          <Input label="Subject" value={form.subjectName} onChange={(value) => setForm({ ...form, subjectName: value.toUpperCase() })} required />
          <Input label="Subject Code" value={form.subjectCode} onChange={(value) => setForm({ ...form, subjectCode: value.toUpperCase() })} />
        </>
      ) : null}
      <Select label="Type" value={form.subjectType} onChange={(value) => setForm({ ...form, subjectType: value })}>{subjectTypes.map((type) => <option key={type} value={type}>{type}</option>)}</Select>
      <Input label="Display Order" type="number" value={form.displayOrder} onChange={(value) => setForm({ ...form, displayOrder: value })} />
      <Select label="Status" value={form.status} onChange={(value) => setForm({ ...form, status: value })}>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</Select>
      <div className="md:col-span-2 xl:col-span-4"><Input label="Notes" value={form.notes} onChange={(value) => setForm({ ...form, notes: value })} /></div>
    </div>
    <div className="mt-5 flex justify-end"><button disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-white shadow-lg shadow-slate-300 transition hover:bg-cyan-600 disabled:opacity-50"><Save size={15} /> Save Subject</button></div>
  </form>
);

const BookPanel = ({ books, loading, formOpen, form, setForm, onOpenForm, onCloseForm, onSubmit, onDelete, saving }) => (
  <div>
    <div className="mb-3 flex items-center justify-between">
      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Books</p>
      <button type="button" onClick={onOpenForm} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600 transition hover:border-cyan-300 hover:text-cyan-700"><Plus size={14} /> Add Book</button>
    </div>
    {loading ? <div className="h-16 animate-pulse rounded-[1.4rem] bg-white" /> : books.length ? (
      <div className="grid gap-3 md:grid-cols-2">
        {books.map((book) => (
          <div key={book.id} className="rounded-[1.4rem] border border-slate-200 bg-white p-5 shadow-[0_14px_35px_-28px_rgba(15,23,42,0.45)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-black text-slate-950">{book.bookTitle || book.subjectName}</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">{book.publisher} | {book.language} {book.primaryBook ? '| Primary' : ''}</p>
              </div>
              <button type="button" onClick={() => onDelete(book.id)} className="rounded-2xl p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
      </div>
    ) : <EmptyState title="No books added" action="Add the primary or reference book for this subject." compact />}
    {formOpen ? (
      <form onSubmit={onSubmit} className="mt-4 rounded-[1.6rem] border border-slate-200 bg-white p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Input label="Book Title" value={form.bookTitle} onChange={(value) => setForm({ ...form, bookTitle: value })} required />
          <Input label="Publisher" value={form.publisher} onChange={(value) => setForm({ ...form, publisher: value })} required />
          <Select label="Language" value={form.language} onChange={(value) => setForm({ ...form, language: value })}>{languages.map((language) => <option key={language} value={language}>{language}</option>)}</Select>
          <Input label="Edition" value={form.edition} onChange={(value) => setForm({ ...form, edition: value })} />
          <Input label="ISBN" value={form.isbn} onChange={(value) => setForm({ ...form, isbn: value })} />
          <Select label="Status" value={form.status} onChange={(value) => setForm({ ...form, status: value })}>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</Select>
          <label className="flex items-center gap-3 rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700"><input type="checkbox" checked={form.primaryBook} onChange={(event) => setForm({ ...form, primaryBook: event.target.checked })} />Primary Book</label>
          <Input label="Notes" value={form.notes} onChange={(value) => setForm({ ...form, notes: value })} />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCloseForm} className="rounded-full border border-slate-200 bg-white px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-600">Cancel</button>
          <button disabled={saving} className="rounded-full bg-slate-950 px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-white shadow-lg shadow-slate-300 transition hover:bg-cyan-600 disabled:opacity-50">Save Book</button>
        </div>
      </form>
    ) : null}
  </div>
);

const SearchInput = ({ value, onChange, placeholder }) => (
  <div className="relative">
    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 py-3.5 pl-12 pr-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100" />
  </div>
);

const Input = ({ label, value, onChange, type = 'text', required = false }) => (
  <label className="block">
    <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-slate-700">{label}</span>
    <input type={type} value={value} required={required} onChange={(event) => onChange(event.target.value)} className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-3.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100" />
  </label>
);

const Select = ({ label, value, onChange, children }) => (
  <label className="block">
    <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-slate-700">{label}</span>
    <SelectBare value={value} onChange={onChange}>{children}</SelectBare>
  </label>
);

const SelectBare = ({ value, onChange, children }) => (
  <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-3.5 text-sm font-black text-slate-700 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100">{children}</select>
);

const EmptyState = ({ title, action, compact = false }) => (
  <div className={`rounded-[1.8rem] border border-dashed border-slate-300 bg-slate-50 text-center ${compact ? 'p-5' : 'px-6 py-14'}`}>
    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-slate-300 shadow-sm">
      <Library size={30} />
    </div>
    <p className="mt-5 font-serif text-2xl font-black italic tracking-tight text-slate-950">{title}</p>
    <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-slate-500">{action}</p>
  </div>
);

const SkeletonGrid = () => (
  <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
    {[1, 2, 3, 4, 5, 6].map((item) => <div key={item} className="h-40 animate-pulse rounded-[1.9rem] border border-slate-200 bg-slate-100" />)}
  </div>
);

export default CourseSubjectManagement;
