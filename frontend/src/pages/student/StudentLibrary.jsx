import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  BookmarkCheck,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Library,
  Search,
  X,
} from 'lucide-react';
import { libraryApi } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

const StudentLibrary = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [activeSection, setActiveSection] = useState('home');
  const [bookSearch, setBookSearch] = useState('');
  const [issueStatus, setIssueStatus] = useState('All Records');
  const [bookPage, setBookPage] = useState(0);
  const [issuePage, setIssuePage] = useState(0);
  const debouncedBookSearch = useDebouncedValue(bookSearch);

  useEffect(() => {
    if (!session || session.role !== 'student') {
      navigate('/login');
    }
  }, [navigate, session]);

  const summaryQuery = useQuery({
    queryKey: ['library', 'student-me-summary'],
    queryFn: () => libraryApi.getMySummary(),
    enabled: session?.role === 'student',
    staleTime: 60 * 1000,
  });

  const booksQuery = useQuery({
    queryKey: ['library', 'student-me-books', { page: bookPage, search: debouncedBookSearch }],
    queryFn: () => libraryApi.getMyBooks({ page: bookPage, size: 20, search: debouncedBookSearch }),
    enabled: session?.role === 'student' && activeSection === 'books' && summaryQuery.data?.libraryFacilityActive,
    placeholderData: keepPreviousData,
  });

  const issuesQuery = useQuery({
    queryKey: ['library', 'student-me-issues', { page: issuePage, status: issueStatus }],
    queryFn: () => libraryApi.getMyIssues({ page: issuePage, size: 20, status: issueStatus }),
    enabled: session?.role === 'student' && activeSection === 'issues' && summaryQuery.data?.libraryFacilityActive,
    placeholderData: keepPreviousData,
  });

  const summary = summaryQuery.data || {};
  const libraryActive = Boolean(summary.libraryFacilityActive);
  const books = booksQuery.data?.content || [];
  const issues = issuesQuery.data?.content || [];
  const loadError = summaryQuery.error?.message || booksQuery.error?.message || issuesQuery.error?.message || '';

  if (!session || session.role !== 'student') return null;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f5fbf7_0%,#eefaf0_32%,#f8fafc_100%)] text-slate-900">
      <div className="border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <div className="flex items-center gap-4">
            <button onClick={() => activeSection === 'home' ? navigate('/student') : setActiveSection('home')} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 transition hover:border-emerald-300 hover:text-emerald-700">
              <ArrowLeft size={14} />
              {activeSection === 'home' ? 'Back' : 'Back To Cards'}
            </button>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-emerald-600">Student Library</p>
              <h1 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">My Library Desk</h1>
            </div>
          </div>
          {activeSection !== 'home' ? (
            <button onClick={() => setActiveSection('home')} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-[11px] font-black uppercase tracking-[0.22em] text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700">
              <X size={14} />
              Close Section
            </button>
          ) : null}
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-10 lg:py-10">
        {loadError ? <div className="mb-6 rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">{loadError}</div> : null}
        {!libraryActive ? (
          <section className="rounded-4xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-[0_20px_60px_-35px_rgba(15,23,42,0.2)]">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-50 text-slate-300"><Library size={34} /></div>
            <h3 className="mt-6 font-serif text-3xl font-black italic tracking-tight text-slate-950">Library facility not active</h3>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-500">
              Library current status is {summary.libraryFacilityStatus || 'inactive'}. Book browse and issue access will start after activation.
            </p>
          </section>
        ) : activeSection === 'home' && (
          <section className="grid gap-5 md:grid-cols-2">
            <LibraryCard icon={BookOpen} title="Available Books" description="See all books currently available in the library with title, author, shelf, and available copies." meta={`${summary.availableBookCount || 0} book${Number(summary.availableBookCount) === 1 ? '' : 's'} available`} onClick={() => setActiveSection('books')} />
            <LibraryCard icon={BookmarkCheck} title="My Borrowed Books" description="Review the books you picked from the library, when they were issued, due dates, status, and fines." meta={`${summary.currentlyBorrowed || 0} active | ${summary.overdueCount || 0} overdue`} onClick={() => setActiveSection('issues')} />
          </section>
        )}

        {libraryActive && activeSection === 'books' && (
          <section className="mt-8 rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div><h2 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">Available Books</h2><p className="mt-2 text-sm leading-7 text-slate-500">These books are currently available in the library catalog.</p></div>
              <SearchInput value={bookSearch} onChange={(value) => { setBookSearch(value); setBookPage(0); }} placeholder="Search title, author, shelf..." />
            </div>
            {books.length ? (
              <div className="mt-8 grid gap-4">
                {books.map((book) => (
                  <article key={book.id} className="rounded-[1.8rem] border border-slate-200 bg-slate-50 p-5">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-700 shadow-sm"><BookOpen size={20} /></div>
                        <div><h3 className="text-xl font-black tracking-tight text-slate-950">{book.title || 'Untitled Book'}</h3><p className="mt-2 text-sm font-semibold text-emerald-700">{book.author || 'Author pending'}</p></div>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <InfoPill label="ISBN" value={book.isbn || 'Not added'} />
                        <InfoPill label="Shelf" value={book.shelfLocation || 'Not added'} />
                        <InfoPill label="Format" value={book.format || 'Physical'} />
                        <InfoPill label="Available Copies" value={String(book.availableCopies ?? book.availableQuantity ?? 0)} />
                      </div>
                    </div>
                  </article>
                ))}
                <Pager page={bookPage} setPage={setBookPage} pageData={booksQuery.data} />
              </div>
            ) : <EmptyState icon={Library} title="No available books" description="No books are currently available in the library matching this search." />}
          </section>
        )}

        {libraryActive && activeSection === 'issues' && (
          <section className="mt-8 rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div><h2 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">My Borrowed Books</h2><p className="mt-2 text-sm leading-7 text-slate-500">These are the library books issued under your own student record.</p></div>
              <select value={issueStatus} onChange={(e) => { setIssueStatus(e.target.value); setIssuePage(0); }} className="rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-3.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100">
                {['All Records', 'Issued', 'Overdue', 'Returned'].map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
            {issues.length ? (
              <div className="mt-8 grid gap-5">
                {issues.map((issue) => (
                  <article key={issue.id} className="rounded-[1.8rem] border border-slate-200 bg-slate-50 p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${getStatusBadgeClass(displayStatus(issue.status), true)}`}>{issue.status === 'OVERDUE' ? <AlertCircle size={20} /> : <CalendarClock size={20} />}</div>
                          <div><h3 className="text-xl font-black tracking-tight text-slate-950">{issue.bookTitle}</h3><p className="text-sm font-semibold text-emerald-700">{issue.bookAuthor || 'Author not available'}</p></div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Chip text={`Issue ${issue.issueDate || '-'}`} />
                          <Chip text={`Due ${issue.dueDate || '-'}`} />
                          <Chip text={`Return ${issue.returnDate || 'Pending'}`} />
                          <Chip text={`Fine Rs ${Number(issue.totalFine) || 0}`} />
                          <Chip text={`Damage Rs ${Number(issue.damageCharges) || 0}`} />
                        </div>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${getStatusBadgeClass(displayStatus(issue.status))}`}>{displayStatus(issue.status)}</span>
                    </div>
                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                      <InfoPill label="Shelf" value={issue.shelfLocation || 'Shelf not available'} />
                      <InfoPill label="Fine / Day" value={`Rs ${Number(issue.finePerDay) || 0}`} />
                      <InfoPill label="Borrower" value={issue.borrowerMeta || 'Student'} />
                    </div>
                  </article>
                ))}
                <Pager page={issuePage} setPage={setIssuePage} pageData={issuesQuery.data} />
              </div>
            ) : <EmptyState icon={BookmarkCheck} title="No borrowed books yet" description="No library issue records are linked to this student yet." />}
          </section>
        )}
      </main>
    </div>
  );
};

const getStatusBadgeClass = (status, filled = false) => {
  if (status === 'Overdue') return filled ? 'bg-rose-100 text-rose-700' : 'border border-rose-200 bg-rose-50 text-rose-700';
  if (status === 'Returned') return filled ? 'bg-emerald-100 text-emerald-700' : 'border border-emerald-200 bg-emerald-50 text-emerald-700';
  return filled ? 'bg-amber-100 text-amber-700' : 'border border-amber-200 bg-amber-50 text-amber-700';
};

const displayStatus = (status) => String(status || 'Issued').toLowerCase().replace(/(^|_)([a-z])/g, (_, space, letter) => `${space ? ' ' : ''}${letter.toUpperCase()}`);

const Pager = ({ page, setPage, pageData }) => {
  const totalPages = Math.max(pageData?.totalPages || 1, 1);
  return (
    <div className="flex items-center justify-end gap-2 text-sm font-bold text-slate-600">
      Page {page + 1} of {totalPages}
      <button type="button" onClick={() => setPage((value) => Math.max(0, value - 1))} className="rounded-md border border-slate-200 p-2 disabled:opacity-40" disabled={page <= 0}><ChevronLeft className="h-4 w-4" /></button>
      <button type="button" onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))} className="rounded-md border border-slate-200 p-2 disabled:opacity-40" disabled={page >= totalPages - 1}><ChevronRight className="h-4 w-4" /></button>
    </div>
  );
};

const LibraryCard = ({ icon: Icon, title, description, meta, onClick }) => (
  <button type="button" onClick={onClick} className="group flex min-h-52 flex-col justify-between rounded-4xl border border-slate-200/80 bg-white p-6 text-left shadow-[0_20px_60px_-38px_rgba(15,23,42,0.45)] transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-[0_26px_70px_-42px_rgba(6,95,70,0.65)] lg:p-8">
    <div><div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-700 transition group-hover:bg-emerald-600 group-hover:text-white"><Icon size={24} /></div><h3 className="mt-7 font-serif text-3xl font-black italic tracking-tight text-slate-950">{title}</h3><p className="mt-3 text-sm leading-7 text-slate-500">{description}</p></div>
    <span className="mt-6 text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700">{meta}</span>
  </button>
);

const SearchInput = ({ value, onChange, placeholder }) => (
  <div className="relative min-w-65">
    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-12 py-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100" />
  </div>
);

const InfoPill = ({ label, value }) => (
  <div className="rounded-2xl bg-white px-4 py-3 shadow-sm"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p><p className="mt-2 text-sm font-bold text-slate-800">{value}</p></div>
);

const Chip = ({ text }) => <div className="inline-flex items-center rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">{text}</div>;

const EmptyState = ({ icon: Icon, title, description }) => (
  <div className="mt-8 rounded-4xl border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center">
    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-white text-slate-300 shadow-sm"><Icon size={34} /></div>
    <h4 className="mt-6 font-serif text-3xl font-black italic tracking-tight text-slate-950">{title}</h4>
    <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-500">{description}</p>
  </div>
);

function useDebouncedValue(value, delay = 350) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timeoutId);
  }, [value, delay]);
  return debouncedValue;
}

export default StudentLibrary;
