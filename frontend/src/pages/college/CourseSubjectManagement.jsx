import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BookCopy,
  BookOpen,
  ChevronRight,
  Pencil,
  Library,
  Plus,
  Save,
  ScrollText,
  Search,
  Tag,
  Trash2,
  X,
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
  language: '',
};

const languageOptions = ['', 'ENGLISH', 'HINDI', 'BILINGUAL'];

const normalizeClassLabel = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  const [baseClass] = normalized.split('/');
  return baseClass.trim();
};

const toUpperValue = (value) => String(value || '').trim().toUpperCase();

const CourseSubjectManagement = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [bookMappings, setBookMappings] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [subjectForm, setSubjectForm] = useState(initialSubjectForm);
  const [bookEntry, setBookEntry] = useState(initialBookEntry);
  const [pendingBooks, setPendingBooks] = useState([]);
  const [editingBookId, setEditingBookId] = useState(null);
  const [editBookForm, setEditBookForm] = useState(initialBookEntry);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
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

  const openClassDesk = (className) => {
    setSelectedClass(className);
    setSubjectForm((current) => ({
      ...initialSubjectForm,
      academicYear: current.academicYear || '2026-27',
      className,
    }));
    setBookEntry(initialBookEntry);
    setPendingBooks([]);
    setEditingBookId(null);
    setEditBookForm(initialBookEntry);
    setDeleteTarget(null);
    setSubjectSearch('');
  };

  const handleAddBook = () => {
    const nextBook = {
      id: Date.now() + pendingBooks.length,
      subjectName: toUpperValue(bookEntry.subjectName),
      publisher: toUpperValue(bookEntry.publisher),
      language: toUpperValue(bookEntry.language),
    };

    if (!nextBook.subjectName || !nextBook.publisher || !nextBook.language) return;

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

  const handleEdit = (record) => {
    setEditingBookId(record.id);
    setEditBookForm({
      subjectName: toUpperValue(record.subjectName),
      publisher: toUpperValue(record.publisher),
      language: toUpperValue(record.language),
      academicYear: toUpperValue(record.academicYear || subjectForm.academicYear || '2026-27'),
      notes: toUpperValue(record.notes),
    });
  };

  const handleCancelEdit = () => {
    setEditingBookId(null);
    setEditBookForm(initialBookEntry);
  };

  const handleUpdate = async (record) => {
    const payload = {
      className: selectedClass,
      subjectName: toUpperValue(editBookForm.subjectName),
      publisher: toUpperValue(editBookForm.publisher),
      language: toUpperValue(editBookForm.language),
      academicYear: toUpperValue(editBookForm.academicYear) || '2026-27',
      notes: toUpperValue(editBookForm.notes),
    };

    if (!payload.subjectName || !payload.publisher || !payload.language) {
      setLoadError('Subject name, publisher, and language are required before updating.');
      return;
    }

    try {
      await courseBookApi.update(record.id, payload);
      setEditingBookId(null);
      setEditBookForm(initialBookEntry);
      await refreshData();
    } catch (error) {
      setLoadError(error.message || 'Unable to update this subject book entry.');
    }
  };

  const handleDeleteRequest = (record) => {
    setDeleteTarget(record);
  };

  const handleCancelDelete = () => {
    if (isDeleting) return;
    setDeleteTarget(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await courseBookApi.delete(deleteTarget.id);
      if (editingBookId === deleteTarget.id) {
        setEditingBookId(null);
        setEditBookForm(initialBookEntry);
      }
      setDeleteTarget(null);
      await refreshData();
    } catch (error) {
      setLoadError(error.message || 'Unable to delete this subject entry.');
    } finally {
      setIsDeleting(false);
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

        {!selectedClass ? (
          <section className="rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
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
                      className="group rounded-4xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-6 text-left shadow-[0_16px_40px_-28px_rgba(15,23,42,0.35)] transition hover:-translate-y-1 hover:border-amber-300"
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
          <div className="space-y-8">
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
                    onChange={(e) => setSubjectForm({ ...subjectForm, className: selectedClass, notes: e.target.value.toUpperCase() })}
                    placeholder="WRITE OPTIONAL NOTE FOR THIS CLASS BOOK LIST"
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
                      onChange={(e) => setBookEntry({ ...bookEntry, subjectName: e.target.value.toUpperCase() })}
                      placeholder="WRITE SUBJECT NAME"
                    />
                    <CreativeInput
                      label="Publisher Name"
                      value={bookEntry.publisher}
                      onChange={(e) => setBookEntry({ ...bookEntry, publisher: e.target.value.toUpperCase() })}
                      placeholder="WRITE PUBLISHER NAME"
                    />
                    <CreativeSelect
                      label="Language"
                      value={bookEntry.language}
                      onChange={(e) => setBookEntry({ ...bookEntry, language: e.target.value })}
                      options={languageOptions}
                      renderOptionLabel={(value) => value || 'SELECT'}
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
                  title={`Saved Books For ${selectedClass}`}
                  description="Saved subject books yahan table me manage karo. Edit, save, cancel, aur delete actions available hain."
                />
                <SearchInput value={subjectSearch} onChange={setSubjectSearch} placeholder="Search subject, book, publisher..." />
              </div>

              {filteredClassMappings.length ? (
                <div className="mt-8 overflow-x-auto rounded-[1.4rem] border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-left">
                    <thead className="bg-slate-50">
                      <tr>
                        <TableHeader>Subject</TableHeader>
                        <TableHeader>Publisher</TableHeader>
                        <TableHeader>Language</TableHeader>
                        <TableHeader>Academic Year</TableHeader>
                        <TableHeader>Notes</TableHeader>
                        <TableHeader align="right">Actions</TableHeader>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {filteredClassMappings.map((record) => {
                        const isEditing = editingBookId === record.id;

                        return (
                          <tr key={record.id} className="align-top">
                            <TableCell>
                              {isEditing ? (
                                <InlineInput value={editBookForm.subjectName} onChange={(e) => setEditBookForm({ ...editBookForm, subjectName: e.target.value.toUpperCase() })} />
                              ) : (
                                <span className="font-black text-slate-950">{toUpperValue(record.subjectName) || 'SUBJECT NOT ADDED'}</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {isEditing ? (
                                <InlineInput value={editBookForm.publisher} onChange={(e) => setEditBookForm({ ...editBookForm, publisher: e.target.value.toUpperCase() })} />
                              ) : (
                                toUpperValue(record.publisher) || 'PUBLISHER PENDING'
                              )}
                            </TableCell>
                            <TableCell>
                              {isEditing ? (
                                <InlineSelect
                                  value={editBookForm.language}
                                  onChange={(e) => setEditBookForm({ ...editBookForm, language: e.target.value })}
                                  options={languageOptions}
                                  renderOptionLabel={(value) => value || 'SELECT'}
                                />
                              ) : (
                                toUpperValue(record.language) || 'LANGUAGE PENDING'
                              )}
                            </TableCell>
                            <TableCell>
                              {isEditing ? (
                                <InlineInput value={editBookForm.academicYear} onChange={(e) => setEditBookForm({ ...editBookForm, academicYear: e.target.value.toUpperCase() })} />
                              ) : (
                                toUpperValue(record.academicYear) || '2026-27'
                              )}
                            </TableCell>
                            <TableCell>
                              {isEditing ? (
                                <InlineInput value={editBookForm.notes} onChange={(e) => setEditBookForm({ ...editBookForm, notes: e.target.value.toUpperCase() })} placeholder="WRITE OPTIONAL NOTES" />
                              ) : (
                                toUpperValue(record.notes) || '-'
                              )}
                            </TableCell>
                            <TableCell align="right">
                              <div className="flex justify-end gap-2">
                                {isEditing ? (
                                  <>
                                    <IconButton label="Save" icon={Save} tone="emerald" onClick={() => handleUpdate(record)} />
                                    <IconButton label="Cancel" icon={X} onClick={handleCancelEdit} />
                                  </>
                                ) : (
                                  <>
                                    <IconButton label="Edit" icon={Pencil} tone="amber" onClick={() => handleEdit(record)} />
                                    <IconButton label="Delete" icon={Trash2} tone="rose" onClick={() => handleDeleteRequest(record)} />
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
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
      <DeleteBookModal
        open={Boolean(deleteTarget)}
        record={deleteTarget}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
};

const TableHeader = ({ children, align = 'left' }) => (
  <th className={`px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 ${align === 'right' ? 'text-right' : 'text-left'}`}>
    {children}
  </th>
);

const TableCell = ({ children, align = 'left' }) => (
  <td className={`px-4 py-4 text-sm font-semibold text-slate-700 ${align === 'right' ? 'text-right' : 'text-left'}`}>
    {children}
  </td>
);

const InlineInput = (props) => (
  <input
    className="w-full min-w-36 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-100"
    {...props}
  />
);

const InlineSelect = ({ options, renderOptionLabel, ...props }) => (
  <select
    className="w-full min-w-32 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-100"
    {...props}
  >
    {options.map((option) => (
      <option key={option || 'empty-option'} value={option}>
        {renderOptionLabel ? renderOptionLabel(option) : option}
      </option>
    ))}
  </select>
);

const IconButton = ({ label, icon: Icon, tone = 'slate', onClick }) => {
  const toneClass = {
    amber: 'text-amber-700 hover:bg-amber-50',
    emerald: 'text-emerald-700 hover:bg-emerald-50',
    rose: 'text-rose-600 hover:bg-rose-50',
    slate: 'text-slate-500 hover:bg-slate-100',
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition ${toneClass}`}
    >
      <Icon size={16} />
    </button>
  );
};

const DeleteBookModal = ({ open, record, onCancel, onConfirm, isDeleting }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-md">
      <div className="w-full max-w-lg rounded-4xl border border-white/30 bg-white/95 p-7 shadow-[0_30px_90px_-30px_rgba(15,23,42,0.5)]">
        <p className="text-[11px] font-black uppercase tracking-[0.28em] text-rose-600">Delete Confirmation</p>
        <h3 className="mt-3 font-serif text-3xl font-black italic tracking-tight text-slate-950">Delete this saved book?</h3>
        <p className="mt-4 text-sm leading-7 text-slate-600">
          This will remove <span className="font-black text-slate-900">{toUpperValue(record?.subjectName) || 'THIS SUBJECT'}</span>
          {record?.publisher ? (
            <> by <span className="font-black text-slate-900">{toUpperValue(record.publisher)}</span></>
          ) : null}
          {' '}from the saved books table.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="inline-flex flex-1 items-center justify-center rounded-2xl border-2 border-slate-200 bg-white px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="inline-flex flex-1 items-center justify-center rounded-2xl bg-rose-600 px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-300"
          >
            {isDeleting ? 'Deleting...' : 'Yes, Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};

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
