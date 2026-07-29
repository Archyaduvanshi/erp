import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BookCopy,
  BookOpen,
  ChevronRight,
  Library,
  Plus,
  ScrollText,
  Search,
  Tag,
  Trash2,
} from 'lucide-react';
import { courseBookApi, studentApi } from '../../utils/api';

const initialSubjectForm = {
  className: '',
  academicYear: '2026-27',
  notes: '',
};

const initialBookEntry = {
  subjectName: '',
  publisher: '',
  language: 'English',
};

const normalizeClassLabel = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  const [baseClass] = normalized.split('/');
  return baseClass.trim();
};

const CourseSubjectManagement = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [bookMappings, setBookMappings] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [subjectForm, setSubjectForm] = useState(initialSubjectForm);
  const [bookEntry, setBookEntry] = useState(initialBookEntry);
  const [pendingBooks, setPendingBooks] = useState([]);
  const [classSearch, setClassSearch] = useState('');
  const [subjectSearch, setSubjectSearch] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = async () => {
    try {
      const [studentResponse, courseBookResponse] = await Promise.all([
        studentApi.getAll(),
        courseBookApi.getAll(),
      ]);
      setStudents(studentResponse);
      setBookMappings(courseBookResponse);
      setLoadError('');
    } catch (error) {
      setStudents([]);
      setBookMappings([]);
      setLoadError(error.message || 'Unable to load course and subject data.');
    }
  };

  const availableClasses = useMemo(() => {
    const classes = [
      ...new Set(
        students
          .map((student) => normalizeClassLabel(student.assignedClass || student.className))
          .filter(Boolean),
      ),
    ];

    return classes.sort((a, b) => a.localeCompare(b));
  }, [students]);

  const filteredClasses = useMemo(() => {
    const query = classSearch.trim().toLowerCase();
    return availableClasses.filter((className) => (
      !query || className.toLowerCase().includes(query)
    ));
  }, [availableClasses, classSearch]);

  const classMappings = useMemo(() => (
    bookMappings.filter((record) => normalizeClassLabel(record.className) === selectedClass)
  ), [bookMappings, selectedClass]);

  const filteredClassMappings = useMemo(() => {
    const query = subjectSearch.trim().toLowerCase();
    return classMappings.filter((record) => {
      if (!query) return true;
      return (
        String(record.subjectName || '').toLowerCase().includes(query) ||
        String(record.publisher || '').toLowerCase().includes(query) ||
        String(record.language || '').toLowerCase().includes(query)
      );
    });
  }, [classMappings, subjectSearch]);

  const groupedSubjectMappings = useMemo(() => (
    filteredClassMappings.reduce((groups, record) => {
      const key = record.subjectName || 'Unnamed Subject';
      if (!groups[key]) groups[key] = [];
      groups[key].push(record);
      return groups;
    }, {})
  ), [filteredClassMappings]);

  const totalSubjects = useMemo(() => (
    new Set(bookMappings.map((record) => `${normalizeClassLabel(record.className)}-${record.subjectName || ''}`)).size
  ), [bookMappings]);

  const totalBooks = bookMappings.length;

  const openClassDesk = (className) => {
    setSelectedClass(className);
    setSubjectForm((current) => ({
      ...initialSubjectForm,
      academicYear: current.academicYear || '2026-27',
      className,
    }));
    setBookEntry(initialBookEntry);
    setPendingBooks([]);
    setSubjectSearch('');
  };

  const handleAddBook = () => {
    const nextBook = {
      id: Date.now() + pendingBooks.length,
      subjectName: bookEntry.subjectName.trim(),
      publisher: bookEntry.publisher.trim(),
      language: bookEntry.language.trim(),
    };

    if (!nextBook.subjectName || !nextBook.publisher) return;

    setPendingBooks((current) => [...current, nextBook]);
    setBookEntry(initialBookEntry);
  };

  const handleRemovePendingBook = (bookId) => {
    setPendingBooks((current) => current.filter((book) => book.id !== bookId));
  };

  const handleSaveSubjectBooks = (e) => {
    e.preventDefault();
    if (!selectedClass || pendingBooks.length === 0) return;
    Promise.all(
      pendingBooks.map((book) => courseBookApi.create({
        className: selectedClass,
        subjectName: book.subjectName,
        academicYear: subjectForm.academicYear.trim() || '2026-27',
        notes: subjectForm.notes.trim(),
        publisher: book.publisher,
        language: book.language,
      })),
    )
      .then(async () => {
        setSubjectForm({
          ...initialSubjectForm,
          className: selectedClass,
        });
        setBookEntry(initialBookEntry);
        setPendingBooks([]);
        await refreshData();
      })
      .catch((error) => {
        setLoadError(error.message || 'Unable to save class subject entries.');
      });
  };

  const handleDelete = async (recordId) => {
    if (!window.confirm('Delete this subject book entry?')) return;
    try {
      await courseBookApi.delete(recordId);
      await refreshData();
    } catch (error) {
      setLoadError(error.message || 'Unable to delete this subject entry.');
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fffdf7_0%,#fff7ed_45%,#f8fafc_100%)] text-slate-900">
      <div className="border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => selectedClass ? setSelectedClass('') : navigate('/college')}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 transition hover:border-amber-300 hover:text-amber-700"
            >
              <ArrowLeft size={14} />
              {selectedClass ? 'Back To Classes' : 'Back'}
            </button>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-amber-600">Course And Subject</p>
              <h1 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">Class Subject Register</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10 lg:py-10">
        {loadError ? (
          <div className="mb-6 rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
            {loadError}
          </div>
        ) : null}

        <section className="overflow-hidden rounded-4xl bg-[linear-gradient(145deg,#78350f_0%,#451a03_55%,#0f172a_100%)] px-7 py-8 text-white shadow-[0_30px_80px_-40px_rgba(120,53,15,0.8)] lg:px-10 lg:py-10">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-amber-200">Curriculum Register</p>
              <h2 className="mt-4 max-w-3xl font-serif text-4xl font-black italic leading-none tracking-tight">
                Ek class ke sabhi sections ke liye ek hi subject set rakho, aur har class ke liye alag subject books define karo.
              </h2>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-amber-50/80">
                Yahan class list section-wise repeat nahi hogi. Class par click karte hi us class ke subjects aur unke multiple books manage honge.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <MetricCard label="Classes" value={availableClasses.length} icon={Tag} />
              <MetricCard label="Subject Sets" value={totalSubjects} icon={ScrollText} />
              <MetricCard label="Books" value={totalBooks} icon={Library} />
              <MetricCard label="Selected Class" value={selectedClass || 'None'} icon={BookOpen} />
            </div>
          </div>
        </section>

        {!selectedClass ? (
          <section className="mt-8 rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">Choose Class</h3>
                <p className="mt-2 text-sm leading-7 text-slate-500">
                  Sirf class number ya course name dikh raha hai, section nahi. Ek class ke sabhi sections same subjects share karenge.
                </p>
              </div>
              <SearchInput value={classSearch} onChange={setClassSearch} placeholder="Search class..." />
            </div>

            {filteredClasses.length ? (
              <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {filteredClasses.map((className) => {
                  const classBookCount = bookMappings.filter((record) => normalizeClassLabel(record.className) === className).length;
                  const classSubjectCount = new Set(
                    bookMappings
                      .filter((record) => normalizeClassLabel(record.className) === className)
                      .map((record) => record.subjectName || ''),
                  ).size;

                  return (
                    <button
                      key={className}
                      type="button"
                      onClick={() => openClassDesk(className)}
                      className="group rounded-[2rem] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-6 text-left shadow-[0_16px_40px_-28px_rgba(15,23,42,0.35)] transition hover:-translate-y-1 hover:border-amber-300"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-amber-100 text-amber-700">
                          <Tag size={24} />
                        </div>
                        <ChevronRight className="text-slate-300 transition group-hover:text-amber-700" size={20} />
                      </div>
                      <h4 className="mt-7 font-serif text-3xl font-black italic tracking-tight text-slate-950">{className}</h4>
                      <div className="mt-5 flex flex-wrap gap-2">
                        <InfoPill icon={ScrollText} text={`${classSubjectCount} subjects`} />
                        <InfoPill icon={Library} text={`${classBookCount} books`} />
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={Tag}
                title="No classes found"
                description="Student records me jo unique classes milengi, wahi yahan show hongi."
              />
            )}
          </section>
        ) : (
          <div className="mt-8 grid gap-8 xl:grid-cols-[0.92fr_1.08fr]">
            <section className="rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
              <FormTitle
                title={`Add Subjects For ${selectedClass}`}
                description="Is class ke liye multiple entries add karo. Har row me subject name, publisher, aur language rahegi."
              />

              <form className="mt-8 grid gap-5 md:grid-cols-2" onSubmit={handleSaveSubjectBooks}>
                <CreativeInput label="Class" value={selectedClass} readOnly />
                <CreativeInput
                  label="Academic Year"
                  value={subjectForm.academicYear}
                  onChange={(e) => setSubjectForm({ ...subjectForm, className: selectedClass, academicYear: e.target.value })}
                  placeholder="2026-27"
                />
                <div className="md:col-span-2">
                  <CreativeTextarea
                    label="Class Notes"
                    value={subjectForm.notes}
                    onChange={(e) => setSubjectForm({ ...subjectForm, className: selectedClass, notes: e.target.value })}
                    placeholder="Optional note for this class book list"
                  />
                </div>

                <div className="md:col-span-2 rounded-[1.8rem] border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-amber-700">Books Under This Class</p>
                      <p className="mt-2 text-sm font-semibold text-slate-600">
                        Ek class ke liye multiple subject entries add kar sakte ho. Har row me subject name, publisher, aur language dalo.
                      </p>
                    </div>
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">
                      {pendingBooks.length} pending
                    </span>
                  </div>

                  <div className="mt-5 grid gap-5 md:grid-cols-3">
                    <CreativeInput
                      label="Subject Name"
                      value={bookEntry.subjectName}
                      onChange={(e) => setBookEntry({ ...bookEntry, subjectName: e.target.value })}
                      placeholder="Mathematics"
                    />
                    <CreativeInput
                      label="Publisher Name"
                      value={bookEntry.publisher}
                      onChange={(e) => setBookEntry({ ...bookEntry, publisher: e.target.value })}
                      placeholder="NCERT"
                    />
                    <CreativeSelect
                      label="Language"
                      value={bookEntry.language}
                      onChange={(e) => setBookEntry({ ...bookEntry, language: e.target.value })}
                      options={['English', 'Hindi', 'Bilingual']}
                    />
                    <div className="md:col-span-3">
                      <button
                        type="button"
                        onClick={handleAddBook}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-amber-800 transition hover:bg-amber-100"
                      >
                        <Plus size={15} />
                        Add Book To Subject
                      </button>
                    </div>
                  </div>

                  {pendingBooks.length ? (
                    <div className="mt-6 grid gap-4">
                      {pendingBooks.map((book) => (
                        <div key={book.id} className="rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-sm">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="flex flex-wrap gap-2">
                              <InfoPill icon={ScrollText} text={book.subjectName} />
                              <InfoPill icon={Library} text={book.publisher} />
                              <InfoPill icon={BookOpen} text={book.language} />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemovePendingBook(book.id)}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-6 rounded-[1.4rem] border border-dashed border-slate-300 bg-white px-5 py-8 text-center text-sm font-medium text-slate-500">
                      No books added yet. Save karne se pehle class ke liye multiple books add karo.
                    </div>
                  )}
                </div>

                <div className="md:col-span-2">
                  <PrimaryButton type="submit" icon={BookCopy} label="Save Class Books" />
                </div>
              </form>
            </section>

            <section className="rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <FormTitle
                  title={`Saved Subjects For ${selectedClass}`}
                  description="Is class ke liye saved subject-wise publisher entries yahan grouped form me milenge."
                />
                <SearchInput value={subjectSearch} onChange={setSubjectSearch} placeholder="Search subject, book, publisher..." />
              </div>

              {filteredClassMappings.length ? (
                <div className="mt-8 space-y-6">
                  {Object.entries(groupedSubjectMappings).map(([subjectName, records]) => (
                    <div key={subjectName}>
                      <div className="mb-4">
                        <h3 className="text-lg font-black tracking-tight text-slate-950">{subjectName}</h3>
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-700">{records.length} book entries</p>
                      </div>

                      <div className="grid gap-5">
                        {records.map((record) => (
                          <article key={record.id} className="rounded-[1.8rem] border border-slate-200 bg-slate-50 p-5">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                              <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                                    <BookOpen size={20} />
                                  </div>
                                  <div>
                                    <h4 className="text-lg font-black tracking-tight text-slate-950">{record.subjectName || 'Subject not added'}</h4>
                                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-700">{record.publisher || 'Publisher not added'}</p>
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <InfoPill icon={Library} text={record.publisher || 'Publisher pending'} />
                                  <InfoPill icon={BookCopy} text={record.language || 'Language pending'} />
                                  <InfoPill icon={ScrollText} text={record.academicYear || 'Year pending'} />
                                </div>
                                {record.notes ? (
                                  <p className="text-sm font-semibold leading-6 text-slate-600">{record.notes}</p>
                                ) : null}
                              </div>

                              <button
                                type="button"
                                onClick={() => handleDelete(record.id)}
                                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Library}
                  title="No subject books yet"
                  description="Is class ke liye pehla subject aur uske books add karo."
                />
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

const MetricCard = ({ label, value, icon: Icon }) => (
  <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-amber-50/80">{label}</p>
        <p className="mt-3 text-4xl font-black tracking-tight text-white">{value}</p>
      </div>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-200/20 bg-amber-200/10 text-amber-50">
        <Icon size={20} />
      </div>
    </div>
  </div>
);

const FormTitle = ({ title, description }) => (
  <div>
    <h3 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">{title}</h3>
    <p className="mt-2 text-sm leading-7 text-slate-500">{description}</p>
  </div>
);

const SearchInput = ({ value, onChange, placeholder }) => (
  <div className="relative min-w-65">
    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-12 py-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-100"
    />
  </div>
);

const CreativeInput = ({ label, ...props }) => (
  <div className="space-y-2.5">
    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
    <input
      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-100"
      {...props}
    />
  </div>
);

const CreativeSelect = ({ label, options, renderOptionLabel, ...props }) => (
  <div className="space-y-2.5">
    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
    <select
      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-3.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-100"
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

const CreativeTextarea = ({ label, ...props }) => (
  <div className="space-y-2.5">
    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
    <textarea
      rows={4}
      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-100"
      {...props}
    />
  </div>
);

const PrimaryButton = ({ type, icon: Icon, label }) => (
  <button
    type={type}
    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-white transition hover:bg-amber-600"
  >
    <Icon size={15} />
    {label}
  </button>
);

const InfoPill = ({ icon: Icon, text }) => (
  <div className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-800 shadow-sm ring-1 ring-slate-100">
    <Icon size={15} className="text-amber-700" />
    <span>{text}</span>
  </div>
);

const EmptyState = ({ icon: Icon, title, description }) => (
  <div className="rounded-4xl border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center">
    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-white text-slate-300 shadow-sm">
      <Icon size={34} />
    </div>
    <h4 className="mt-6 font-serif text-3xl font-black italic tracking-tight text-slate-950">{title}</h4>
    <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-500">{description}</p>
  </div>
);

export default CourseSubjectManagement;
