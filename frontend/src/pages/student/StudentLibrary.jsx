import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  BookmarkCheck,
  CalendarClock,
  Library,
  Search,
  X,
} from 'lucide-react';
import { libraryApi, studentApi } from '../../utils/api';
import { getFacilityAccessState } from '../../utils/facilityUtils';

const today = new Date().toISOString().split('T')[0];

const StudentLibrary = () => {
  const navigate = useNavigate();
  const [session] = useState(() => JSON.parse(localStorage.getItem('active_session')) || null);
  const [activeSection, setActiveSection] = useState('home');
  const [bookSearch, setBookSearch] = useState('');
  const [issueSearch, setIssueSearch] = useState('');
  const [student, setStudent] = useState(null);
  const [books, setBooks] = useState([]);
  const [issues, setIssues] = useState([]);
  const [loadError, setLoadError] = useState('');

  const libraryAccess = getFacilityAccessState(student, 'library');

  const availableBooks = useMemo(() => {
    const query = bookSearch.trim().toLowerCase();
    return books
      .map((book) => ({ ...book, inStock: Math.max(Number(book.availableQuantity) || 0, 0) }))
      .filter((book) => book.inStock > 0)
      .filter((book) => {
        if (!query) return true;
        return (
          String(book.isbn || '').toLowerCase().includes(query) ||
          String(book.title || '').toLowerCase().includes(query) ||
          String(book.author || '').toLowerCase().includes(query) ||
          String(book.shelfLocation || '').toLowerCase().includes(query)
        );
      })
      .sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));
  }, [bookSearch, books, issues]);

  const myBorrowedBooks = useMemo(() => {
    if (!student) return [];
    const query = issueSearch.trim().toLowerCase();
    return issues
      .filter((issue) => String(issue.borrowerId) === String(student.id))
      .map((issue) => {
        const status = getIssueStatus(issue);
        const computedFine = calculateFine(issue);
        return {
          ...issue,
          bookTitle: issue.bookTitle || 'Unknown book',
          bookAuthor: books.find((entry) => entry.id === issue.bookId)?.author || 'Author not available',
          shelfLocation: books.find((entry) => entry.id === issue.bookId)?.shelfLocation || 'Shelf not available',
          status,
          computedFine,
        };
      })
      .filter((issue) => {
        if (!query) return true;
        return (
          issue.bookTitle.toLowerCase().includes(query) ||
          String(issue.issueDate || '').toLowerCase().includes(query) ||
          String(issue.dueDate || '').toLowerCase().includes(query) ||
          String(issue.status || '').toLowerCase().includes(query)
        );
      })
      .sort((a, b) => new Date(b.issueDate || 0).getTime() - new Date(a.issueDate || 0).getTime());
  }, [books, issueSearch, issues, student]);

  useEffect(() => {
    if (!session || session.role !== 'student') {
      navigate('/login');
      return;
    }

    const loadLibraryData = async () => {
      try {
        const [studentResponse, bookResponse, issueResponse] = await Promise.all([
          studentApi.getById(session.studentId),
          libraryApi.getBooks(),
          libraryApi.getIssues(),
        ]);
        setStudent(studentResponse);
        setBooks(bookResponse);
        setIssues(issueResponse);
        setLoadError('');
      } catch (error) {
        setStudent(null);
        setBooks([]);
        setIssues([]);
        setLoadError(error.message || 'Unable to load library data.');
      }
    };

    loadLibraryData();
  }, [navigate, session]);

  if (!session || session.role !== 'student') return null;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f5fbf7_0%,#eefaf0_32%,#f8fafc_100%)] text-slate-900">
      <div className="border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => activeSection === 'home' ? navigate('/student') : setActiveSection('home')}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 transition hover:border-emerald-300 hover:text-emerald-700"
            >
              <ArrowLeft size={14} />
              {activeSection === 'home' ? 'Back' : 'Back To Cards'}
            </button>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-emerald-600">Student Library</p>
              <h1 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">My Library Desk</h1>
            </div>
          </div>
          {activeSection !== 'home' ? (
            <button
              onClick={() => setActiveSection('home')}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-[11px] font-black uppercase tracking-[0.22em] text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700"
            >
              <X size={14} />
              Close Section
            </button>
          ) : null}
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-10 lg:py-10">
        {loadError ? (
          <div className="mb-6 rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
            {loadError}
          </div>
        ) : null}
        {!libraryAccess.active ? (
          <section className="rounded-4xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-[0_20px_60px_-35px_rgba(15,23,42,0.2)]">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-50 text-slate-300">
              <Library size={34} />
            </div>
            <h3 className="mt-6 font-serif text-3xl font-black italic tracking-tight text-slate-950">Library facility not active</h3>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-500">
              {libraryAccess.requested
                ? `Library has been requested, but its current status is ${libraryAccess.status}. Book browse and issue access will start after activation.`
                : 'This student does not have library facility enabled yet, so books, issue history, and library billing stay locked.'}
            </p>
          </section>
        ) : activeSection === 'home' && (
          <section className="grid gap-5 md:grid-cols-2">
            <LibraryCard
              icon={BookOpen}
              title="Available Books"
              description="See all books currently available in the library with title, author, shelf, and available copies."
              meta={`${availableBooks.length} book${availableBooks.length === 1 ? '' : 's'} available`}
              onClick={() => setActiveSection('books')}
            />
            <LibraryCard
              icon={BookmarkCheck}
              title="My Borrowed Books"
              description="Review the books you picked from the library, when they were issued, due dates, status, and fines."
              meta={`${myBorrowedBooks.length} issue record${myBorrowedBooks.length === 1 ? '' : 's'}`}
              onClick={() => setActiveSection('issues')}
            />
          </section>
        )}

        {libraryAccess.active && activeSection === 'books' && (
          <section className="mt-8 rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">Available Books</h2>
                <p className="mt-2 text-sm leading-7 text-slate-500">
                  These books are currently available in the library catalog.
                </p>
              </div>
              <SearchInput value={bookSearch} onChange={setBookSearch} placeholder="Search title, author, shelf..." />
            </div>

            {availableBooks.length ? (
              <div className="mt-8 grid gap-4">
                {availableBooks.map((book) => (
                  <article
                    key={book.id}
                    className="rounded-[1.8rem] border border-slate-200 bg-slate-50 p-5"
                  >
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-700 shadow-sm">
                          <BookOpen size={20} />
                        </div>
                        <div>
                          <h3 className="text-xl font-black tracking-tight text-slate-950">{book.title || 'Untitled Book'}</h3>
                          <p className="mt-2 text-sm font-semibold text-emerald-700">{book.author || 'Author pending'}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <InfoPill label="ISBN" value={book.isbn || 'Not added'} />
                        <InfoPill label="Shelf" value={book.shelfLocation || 'Not added'} />
                        <InfoPill label="Format" value={book.format || 'Physical'} />
                        <InfoPill label="Available Copies" value={String(book.inStock)} />
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState icon={Library} title="No available books" description="No books are currently available in the library matching this search." />
            )}
          </section>
        )}

        {libraryAccess.active && activeSection === 'issues' && (
          <section className="mt-8 rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">My Borrowed Books</h2>
                <p className="mt-2 text-sm leading-7 text-slate-500">
                  These are the library books issued under your own student record.
                </p>
              </div>
              <SearchInput value={issueSearch} onChange={setIssueSearch} placeholder="Search book, date, status..." />
            </div>

            {myBorrowedBooks.length ? (
              <div className="mt-8 grid gap-5">
                {myBorrowedBooks.map((issue) => (
                  <article key={issue.id} className="rounded-[1.8rem] border border-slate-200 bg-slate-50 p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${getStatusBadgeClass(issue.status, true)}`}>
                            {issue.status === 'Overdue' ? <AlertCircle size={20} /> : <CalendarClock size={20} />}
                          </div>
                          <div>
                            <h3 className="text-xl font-black tracking-tight text-slate-950">{issue.bookTitle}</h3>
                            <p className="text-sm font-semibold text-emerald-700">{issue.bookAuthor}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Chip text={`Issue ${issue.issueDate || '-'}`} />
                          <Chip text={`Due ${issue.dueDate || '-'}`} />
                          <Chip text={`Return ${issue.returnDate || 'Pending'}`} />
                          <Chip text={`Fine Rs ${issue.computedFine}`} />
                          <Chip text={`Damage Rs ${Number(issue.damageCharges) || 0}`} />
                        </div>
                      </div>

                      <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${getStatusBadgeClass(issue.status)}`}>
                        {issue.status}
                      </span>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                      <InfoPill label="Shelf" value={issue.shelfLocation} />
                      <InfoPill label="Fine / Day" value={`Rs ${Number(issue.finePerDay) || 0}`} />
                      <InfoPill label="Borrower" value={student?.enrollmentNo || student?.systemId || 'Student'} />
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState icon={BookmarkCheck} title="No borrowed books yet" description="No library issue records are linked to this student yet." />
            )}
          </section>
        )}
      </main>
    </div>
  );
};

const getIssueStatus = (issue) => {
  if (issue.returnDate) return 'Returned';
  if (!issue.dueDate) return 'Issued';
  return new Date(issue.dueDate) < new Date(today) ? 'Overdue' : 'Issued';
};

const calculateFine = (issue) => {
  if (!issue.dueDate) return Number(issue.damageCharges) || 0;
  const endDate = issue.returnDate || today;
  const diffDays = Math.max(Math.ceil((new Date(endDate) - new Date(issue.dueDate)) / (1000 * 60 * 60 * 24)), 0);
  return diffDays * (Number(issue.finePerDay) || 0) + (Number(issue.damageCharges) || 0);
};

const getStatusBadgeClass = (status, filled = false) => {
  if (status === 'Overdue') {
    return filled ? 'bg-rose-100 text-rose-700' : 'border border-rose-200 bg-rose-50 text-rose-700';
  }
  if (status === 'Returned') {
    return filled ? 'bg-emerald-100 text-emerald-700' : 'border border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  return filled ? 'bg-amber-100 text-amber-700' : 'border border-amber-200 bg-amber-50 text-amber-700';
};

const LibraryCard = ({ icon: Icon, title, description, meta, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex min-h-52 flex-col justify-between rounded-4xl border border-slate-200/80 bg-white p-6 text-left shadow-[0_20px_60px_-38px_rgba(15,23,42,0.45)] transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-[0_26px_70px_-42px_rgba(6,95,70,0.65)] lg:p-8"
  >
    <div>
      <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-700 transition group-hover:bg-emerald-600 group-hover:text-white">
        <Icon size={24} />
      </div>
      <h3 className="mt-7 font-serif text-3xl font-black italic tracking-tight text-slate-950">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-slate-500">{description}</p>
    </div>
    <span className="mt-6 text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700">{meta}</span>
  </button>
);

const SearchInput = ({ value, onChange, placeholder }) => (
  <div className="relative min-w-65">
    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-12 py-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
    />
  </div>
);

const InfoPill = ({ label, value }) => (
  <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
    <p className="mt-2 text-sm font-bold text-slate-800">{value}</p>
  </div>
);

const Chip = ({ text }) => (
  <div className="inline-flex items-center rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">
    {text}
  </div>
);

const EmptyState = ({ icon: Icon, title, description }) => (
  <div className="mt-8 rounded-4xl border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center">
    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-white text-slate-300 shadow-sm">
      <Icon size={34} />
    </div>
    <h4 className="mt-6 font-serif text-3xl font-black italic tracking-tight text-slate-950">{title}</h4>
    <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-500">{description}</p>
  </div>
);

export default StudentLibrary;
