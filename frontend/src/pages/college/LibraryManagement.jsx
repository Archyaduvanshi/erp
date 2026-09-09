import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  BookPlus,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  Library,
  Search,
  Trash2,
} from 'lucide-react';
import { libraryApi } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import QRScannerButton from '../../components/scanner/QRScannerButton';

const today = new Date().toISOString().split('T')[0];
const isCollegeModuleSession = (session) => ['admin', 'feature', 'teacher'].includes(session?.role);
const pageSizes = [25, 50, 100];

const initialBookForm = {
  isbn: '',
  title: '',
  author: '',
  format: 'Physical',
  rack: '',
  shelf: '',
  availableQuantity: '1',
};

const initialIssueForm = {
  bookId: '',
  borrowerId: '',
  issueDate: today,
};

const LibraryManagement = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const collegeId = session?.id || '';
  const [bookForm, setBookForm] = useState(initialBookForm);
  const [bookErrors, setBookErrors] = useState({});
  const [issueForm, setIssueForm] = useState(initialIssueForm);
  const [bookSearch, setBookSearch] = useState('');
  const [issueSearch, setIssueSearch] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [formatFilter, setFormatFilter] = useState('All Formats');
  const [issueStatusFilter, setIssueStatusFilter] = useState('All Records');
  const [activeDesk, setActiveDesk] = useState(null);
  const [circulationAction, setCirculationAction] = useState('issue');
  const [returnIssueId, setReturnIssueId] = useState('');
  const [isDamageBook, setIsDamageBook] = useState(false);
  const [returnDamageCharge, setReturnDamageCharge] = useState('');
  const [loadError, setLoadError] = useState('');
  const [bookPage, setBookPage] = useState(0);
  const [issuePage, setIssuePage] = useState(0);
  const [bookPageSize, setBookPageSize] = useState(25);
  const [issuePageSize, setIssuePageSize] = useState(25);
  const debouncedBookSearch = useDebouncedValue(bookSearch);
  const debouncedIssueSearch = useDebouncedValue(issueSearch);
  const debouncedStudentSearch = useDebouncedValue(studentSearch);

  useEffect(() => {
    if (!isCollegeModuleSession(session) || !collegeId) {
      navigate('/login');
    }
  }, [collegeId, navigate, session]);

  const overviewQuery = useQuery({
    queryKey: ['library', 'overview'],
    queryFn: () => libraryApi.getOverview(),
    enabled: isCollegeModuleSession(session) && Boolean(collegeId),
    staleTime: 60 * 1000,
  });

  const booksQuery = useQuery({
    queryKey: ['library', 'books', { page: bookPage, size: bookPageSize, search: debouncedBookSearch, format: formatFilter }],
    queryFn: () => libraryApi.getBooks({
      page: bookPage,
      size: bookPageSize,
      search: debouncedBookSearch,
      format: formatFilter,
      status: 'ACTIVE',
    }),
    enabled: Boolean(activeDesk),
    placeholderData: keepPreviousData,
  });

  const issuesQuery = useQuery({
    queryKey: ['library', 'issues', { page: issuePage, size: issuePageSize, search: debouncedIssueSearch, status: issueStatusFilter }],
    queryFn: () => libraryApi.getIssues({
      page: issuePage,
      size: issuePageSize,
      search: debouncedIssueSearch,
      status: issueStatusFilter,
    }),
    enabled: activeDesk === 'circulation',
    placeholderData: keepPreviousData,
  });

  const studentsQuery = useQuery({
    queryKey: ['library', 'student-search', { search: debouncedStudentSearch }],
    queryFn: () => libraryApi.searchStudents({ page: 0, size: 20, search: debouncedStudentSearch }),
    enabled: activeDesk === 'circulation' && circulationAction === 'issue' && debouncedStudentSearch.trim().length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  });

  const invalidateLibrary = () => {
    queryClient.invalidateQueries({ queryKey: ['library', 'overview'] });
    queryClient.invalidateQueries({ queryKey: ['library', 'books'] });
    queryClient.invalidateQueries({ queryKey: ['library', 'issues'] });
  };

  const handleScannedStudent = (identity) => {
    setActiveDesk('circulation');
    setCirculationAction('issue');
    setStudentSearch(identity.referenceNumber || identity.name || '');
    setIssueSearch(identity.referenceNumber || identity.name || '');
    setIssuePage(0);
    setIssueForm((current) => ({ ...current, borrowerId: String(identity.id) }));
  };

  const saveBookMutation = useMutation({
    mutationFn: libraryApi.saveBook,
    onSuccess: () => {
      setBookForm(initialBookForm);
      setBookErrors({});
      setLoadError('');
      invalidateLibrary();
    },
    onError: (error) => {
      if (error.fieldErrors && Object.keys(error.fieldErrors).length > 0) {
        setBookErrors(mapBookFieldErrors(error.fieldErrors));
      }
      setLoadError(error.message || 'Unable to save the book.');
    },
  });

  const issueMutation = useMutation({
    mutationFn: libraryApi.saveIssue,
    onSuccess: () => {
      setIssueForm(initialIssueForm);
      setStudentSearch('');
      setLoadError('');
      invalidateLibrary();
    },
    onError: (error) => setLoadError(error.message || 'Unable to create the circulation record.'),
  });

  const returnMutation = useMutation({
    mutationFn: ({ id, payload }) => libraryApi.markReturned(id, payload),
    onSuccess: () => {
      setIsDamageBook(false);
      setReturnDamageCharge('');
      setReturnIssueId('');
      setLoadError('');
      invalidateLibrary();
    },
    onError: (error) => setLoadError(error.message || 'Unable to mark this book as returned.'),
  });

  const deleteBookMutation = useMutation({
    mutationFn: libraryApi.deleteBook,
    onSuccess: invalidateLibrary,
    onError: (error) => setLoadError(error.message || 'Unable to archive this book.'),
  });

  const voidIssueMutation = useMutation({
    mutationFn: libraryApi.deleteIssue,
    onSuccess: invalidateLibrary,
    onError: (error) => setLoadError(error.message || 'Unable to void this circulation record.'),
  });

  const books = booksQuery.data?.content || [];
  const issues = issuesQuery.data?.content || [];
  const studentOptions = studentsQuery.data?.content || [];

  const enhancedBooks = useMemo(() => books.map((book) => ({
    ...book,
    activeIssues: Number(book.issuedCopies) || 0,
    inStock: Number(book.availableCopies ?? book.availableQuantity) || 0,
  })), [books]);

  const bookChoices = useMemo(() => enhancedBooks
    .filter((book) => book.inStock > 0)
    .map((book) => ({
      id: book.id,
      label: `${book.title || 'Untitled Book'}${book.author ? ` by ${book.author}` : ''}`,
      stock: book.inStock,
    })), [enhancedBooks]);

  const activeIssueChoices = useMemo(() => issues
    .filter((issue) => ['ISSUED', 'OVERDUE'].includes(issue.status))
    .map((issue) => ({
      id: issue.id,
      label: `${issue.bookTitle} | ${issue.borrowerName || 'Borrower pending'}`,
      subtitle: `${issue.borrowerClass || 'Class pending'} | Issue ${issue.issueDate || '-'}`,
    })), [issues]);

  const selectedReturnIssue = useMemo(() => (
    issues.find((issue) => String(issue.id) === String(returnIssueId)) || null
  ), [issues, returnIssueId]);

  const handleSaveBook = (e) => {
    e.preventDefault();
    const validationErrors = validateBookForm(bookForm);
    if (Object.keys(validationErrors).length > 0) {
      setBookErrors(validationErrors);
      return;
    }
    saveBookMutation.mutate({
      isbn: bookForm.isbn.trim(),
      title: bookForm.title.trim(),
      author: bookForm.author.trim(),
      format: bookForm.format,
      rack: bookForm.rack.trim(),
      shelf: bookForm.shelf.trim(),
      shelfLocation: formatShelfLocation(bookForm.rack, bookForm.shelf),
      availableQuantity: Math.max(Number(bookForm.availableQuantity) || 0, 0),
      totalCopies: Math.max(Number(bookForm.availableQuantity) || 0, 0),
    });
  };

  const updateBookField = (field, value) => {
    const nextValue = field === 'availableQuantity' || field === 'format' ? value : toUpperInput(value);
    setBookForm((current) => ({ ...current, [field]: nextValue }));
    setBookErrors((current) => {
      if (!current[field]) return current;
      const { [field]: removed, ...rest } = current;
      return rest;
    });
  };

  const handleSaveIssue = (e) => {
    e.preventDefault();
    if (!issueForm.bookId || !issueForm.borrowerId) return;
    issueMutation.mutate({
      bookId: Number(issueForm.bookId),
      borrowerId: Number(issueForm.borrowerId),
      issueDate: issueForm.issueDate,
    });
  };

  const handleReturnBook = (e) => {
    e.preventDefault();
    if (!returnIssueId) return;
    returnMutation.mutate({
      id: returnIssueId,
      payload: { damageCharges: isDamageBook ? String(Number(returnDamageCharge) || 0) : '0' },
    });
  };

  const handleDeleteBook = (bookId) => {
    if (!window.confirm('Archive this book if it has history, or delete it if unused?')) return;
    deleteBookMutation.mutate(bookId);
  };

  const handleDeleteIssue = (issueId) => {
    if (!window.confirm('Void this circulation record?')) return;
    voidIssueMutation.mutate(issueId);
  };

  const handleBack = () => {
    if (activeDesk) {
      setActiveDesk(null);
      return;
    }
    navigate('/college');
  };

  if (!isCollegeModuleSession(session) || !collegeId) return null;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f5fbf7_0%,#eefaf0_32%,#f8fafc_100%)] text-slate-900">
      <div className="border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <div className="flex items-center gap-4">
            <button onClick={handleBack} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 transition hover:border-emerald-300 hover:text-emerald-700">
              <ArrowLeft size={14} />
              Back
            </button>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-emerald-600">Library Management</p>
              <h1 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">Stacks And Circulation Desk</h1>
            </div>
          </div>
          <QRScannerButton feature="library" onResolved={handleScannedStudent} />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10 lg:py-10">
        {loadError || overviewQuery.error || booksQuery.error || issuesQuery.error ? (
          <div className="mb-6 rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
            {loadError || overviewQuery.error?.message || booksQuery.error?.message || issuesQuery.error?.message}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-4">
          <LibraryMetric label="Titles" value={overviewQuery.data?.totalTitles || 0} />
          <LibraryMetric label="Available" value={overviewQuery.data?.availableCopies || 0} />
          <LibraryMetric label="Issued" value={overviewQuery.data?.issuedCopies || 0} />
          <LibraryMetric label="Overdue" value={overviewQuery.data?.overdueIssues || 0} />
        </section>

        {!activeDesk ? (
          <section className="mt-8 grid gap-5 md:grid-cols-2">
            <LibraryActionCard icon={BookPlus} title="Add Book" description="Add new titles, ISBN, author, rack, shelf, and available quantity to the library catalog." onClick={() => setActiveDesk('books')} />
            <LibraryActionCard icon={BookmarkCheck} title="Issue, Return And Fine" description="Issue books to students, mark returns, and review due dates with calculated fine amounts." onClick={() => setActiveDesk('circulation')} />
          </section>
        ) : (
          <div className="mt-8">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-700">{activeDesk === 'books' ? 'Add Book Page' : 'Issue Return Fine Page'}</p>
            <h2 className="mt-2 font-serif text-3xl font-black italic tracking-tight text-slate-950">{activeDesk === 'books' ? 'Book Catalog Entry' : 'Circulation And Fine Desk'}</h2>
          </div>
        )}

        {activeDesk ? (
          <div className="mt-8 space-y-8">
            <div className={`${activeDesk === 'books' ? '' : 'hidden'} space-y-8`}>
              <section className="rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
                <FormTitle title="Book Management" description="Catalog physical and digital library assets with the basic details staff needs during shelving, search, and issue." />
                <form className="mt-8 grid gap-5 md:grid-cols-2" onSubmit={handleSaveBook}>
                  <CreativeInput label="ISBN" value={bookForm.isbn} onChange={(e) => updateBookField('isbn', e.target.value)} placeholder="Enter ISBN or accession code" error={bookErrors.isbn} />
                  <CreativeInput label="Book Title" value={bookForm.title} onChange={(e) => updateBookField('title', e.target.value)} placeholder="Enter book title" error={bookErrors.title} />
                  <CreativeInput label="Author" value={bookForm.author} onChange={(e) => updateBookField('author', e.target.value)} placeholder="Enter author name" error={bookErrors.author} />
                  <CreativeSelect label="Asset Format" value={bookForm.format} onChange={(e) => updateBookField('format', e.target.value)} options={['Physical', 'Digital']} error={bookErrors.format} />
                  <CreativeInput label="Rack" value={bookForm.rack} onChange={(e) => updateBookField('rack', e.target.value)} placeholder="Enter rack name or number" error={bookErrors.rack} />
                  <CreativeInput label="Shelf" value={bookForm.shelf} onChange={(e) => updateBookField('shelf', e.target.value)} placeholder="Enter shelf name or number" error={bookErrors.shelf} />
                  <CreativeInput label="Total Copies" type="number" min="1" value={bookForm.availableQuantity} onChange={(e) => updateBookField('availableQuantity', e.target.value)} placeholder="Enter total copies" error={bookErrors.availableQuantity} />
                  <div className="md:col-span-2"><PrimaryButton type="submit" icon={BookPlus} label={saveBookMutation.isPending ? 'Saving Book...' : 'Save Book To Catalog'} /></div>
                </form>
              </section>

              <CatalogTable
                books={enhancedBooks}
                bookSearch={bookSearch}
                setBookSearch={(value) => { setBookSearch(value); setBookPage(0); }}
                formatFilter={formatFilter}
                setFormatFilter={(value) => { setFormatFilter(value); setBookPage(0); }}
                onDelete={handleDeleteBook}
                page={bookPage}
                setPage={setBookPage}
                pageSize={bookPageSize}
                setPageSize={setBookPageSize}
                pageData={booksQuery.data}
              />
            </div>

            <div className={`${activeDesk === 'circulation' ? '' : 'hidden'} space-y-8`}>
              <section className="rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
                <FormTitle title="Issue, Return And Fines" description="Issue aur return ko alag actions me handle karo. Ek time par sirf ek hi library action active rahega." />
                <div className="mt-8 flex flex-wrap gap-3">
                  <DeskToggle active={circulationAction === 'issue'} onClick={() => setCirculationAction('issue')} label="Issue Book" />
                  <DeskToggle active={circulationAction === 'return'} onClick={() => setCirculationAction('return')} label="Return Book" />
                </div>

                {circulationAction === 'issue' ? (
                  <form className="mt-8 grid gap-5 md:grid-cols-2" onSubmit={handleSaveIssue}>
                    <CreativeSelect label="Book" value={issueForm.bookId} onChange={(e) => setIssueForm({ ...issueForm, bookId: e.target.value })} options={['', ...bookChoices.map((book) => String(book.id))]} renderOptionLabel={(value) => {
                      if (!value) return 'Select book';
                      const match = bookChoices.find((book) => String(book.id) === value);
                      return match ? `${match.label} | Stock ${match.stock}` : 'Select book';
                    }} />
                    <SearchInput value={studentSearch} onChange={(value) => { setStudentSearch(value); setIssueForm({ ...issueForm, borrowerId: '' }); }} placeholder="Search student name, enrollment, mobile..." />
                    <CreativeSelect label="Borrower" value={issueForm.borrowerId} onChange={(e) => setIssueForm({ ...issueForm, borrowerId: e.target.value })} options={['', ...studentOptions.map((student) => String(student.studentId))]} renderOptionLabel={(value) => {
                      if (!value) return debouncedStudentSearch.trim().length < 2 ? 'Type 2 letters to search' : 'Select borrower';
                      const match = studentOptions.find((student) => String(student.studentId) === value);
                      return match ? `${match.name} | ${match.enrollmentNo || 'Student'} | ${match.className || '-'}` : 'Select borrower';
                    }} />
                    <CreativeInput label="Issue Date" type="date" value={issueForm.issueDate} onChange={(e) => setIssueForm({ ...issueForm, issueDate: e.target.value })} />
                    <div className="md:col-span-2"><PrimaryButton type="submit" icon={BookmarkCheck} label={issueMutation.isPending ? 'Issuing Book...' : 'Issue Book Now'} /></div>
                  </form>
                ) : (
                  <ReturnForm
                    returnIssueId={returnIssueId}
                    setReturnIssueId={setReturnIssueId}
                    activeIssueChoices={activeIssueChoices}
                    selectedReturnIssue={selectedReturnIssue}
                    isDamageBook={isDamageBook}
                    setIsDamageBook={setIsDamageBook}
                    returnDamageCharge={returnDamageCharge}
                    setReturnDamageCharge={setReturnDamageCharge}
                    onSubmit={handleReturnBook}
                    pending={returnMutation.isPending}
                  />
                )}
              </section>

              <IssueTable
                issues={issues}
                issueSearch={issueSearch}
                setIssueSearch={(value) => { setIssueSearch(value); setIssuePage(0); }}
                issueStatusFilter={issueStatusFilter}
                setIssueStatusFilter={(value) => { setIssueStatusFilter(value); setIssuePage(0); }}
                onVoid={handleDeleteIssue}
                page={issuePage}
                setPage={setIssuePage}
                pageSize={issuePageSize}
                setPageSize={setIssuePageSize}
                pageData={issuesQuery.data}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

const LibraryMetric = ({ label, value }) => (
  <div className="rounded-4xl border border-slate-200/80 bg-white p-5 shadow-[0_20px_60px_-38px_rgba(15,23,42,0.35)]">
    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-700">{label}</p>
    <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">{value}</p>
  </div>
);

const CatalogTable = ({ books, bookSearch, setBookSearch, formatFilter, setFormatFilter, onDelete, page, setPage, pageSize, setPageSize, pageData }) => (
  <section className="rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <FormTitle title="Catalog Register" description="Search by title, ISBN, author, rack, or shelf to find what the library currently holds." />
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <SearchInput value={bookSearch} onChange={setBookSearch} placeholder="Search title, ISBN, author, rack, shelf..." />
        <CreativeSelect label="Format" value={formatFilter} onChange={(e) => setFormatFilter(e.target.value)} options={['All Formats', 'Physical', 'Digital']} />
      </div>
    </div>
    {books.length > 0 ? (
      <div className="mt-8 overflow-hidden rounded-[1.8rem] border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left">
            <thead><tr className="bg-slate-950 text-white">{['S.No.', 'Title', 'Author', 'ISBN', 'Format', 'Rack', 'Shelf', 'Available', 'Active Loans', 'Action'].map((heading) => <th key={heading} className="border-b border-l border-slate-800 px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em]">{heading}</th>)}</tr></thead>
            <tbody>
              {books.map((book, index) => (
                <tr key={book.id} className="odd:bg-white even:bg-slate-50">
                  <td className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600">{page * pageSize + index + 1}</td>
                  <td className="border-b border-l border-slate-200 px-4 py-3 text-sm font-black text-slate-950">{book.title}</td>
                  <td className="border-b border-l border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">{book.author}</td>
                  <td className="border-b border-l border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">{book.isbn}</td>
                  <td className="border-b border-l border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">{book.format}</td>
                  <td className="border-b border-l border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">{getBookRack(book)}</td>
                  <td className="border-b border-l border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">{getBookShelf(book)}</td>
                  <td className="border-b border-l border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">{book.inStock}</td>
                  <td className="border-b border-l border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">{book.activeIssues}</td>
                  <td className="border-b border-l border-slate-200 px-4 py-3"><IconButton onClick={() => onDelete(book.id)} icon={Trash2} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager page={page} setPage={setPage} pageSize={pageSize} setPageSize={setPageSize} pageData={pageData} />
      </div>
    ) : <EmptyState icon={Library} title="No books in the catalog" description="Add the first library title with ISBN, location, and stock so issuing can begin." />}
  </section>
);

const IssueTable = ({ issues, issueSearch, setIssueSearch, issueStatusFilter, setIssueStatusFilter, onVoid, page, setPage, pageSize, setPageSize, pageData }) => (
  <section className="rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <FormTitle title="Circulation Ledger" description="See open loans, overdue returns, and the calculated fine amount for each borrowing record." />
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <SearchInput value={issueSearch} onChange={setIssueSearch} placeholder="Search borrower, book, date..." />
        <CreativeSelect label="Status" value={issueStatusFilter} onChange={(e) => setIssueStatusFilter(e.target.value)} options={['All Records', 'Issued', 'Overdue', 'Returned', 'Voided']} />
      </div>
    </div>
    {issues.length > 0 ? (
      <div className="mt-8 overflow-hidden rounded-[1.8rem] border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left">
            <thead><tr className="bg-slate-950 text-white">{['S.No.', 'Enrollment', 'Student', 'Class', 'Book', 'Issue Date', 'Return Date', 'Fine', 'Status', 'Action'].map((heading) => <th key={heading} className="border-b border-l border-slate-800 px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em]">{heading}</th>)}</tr></thead>
            <tbody>
              {issues.map((issue, index) => (
                <tr key={issue.id} className="odd:bg-white even:bg-slate-50">
                  <td className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600">{page * pageSize + index + 1}</td>
                  <td className="border-b border-l border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">{issue.borrowerMeta || '-'}</td>
                  <td className="border-b border-l border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">{issue.borrowerName || '-'}</td>
                  <td className="border-b border-l border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">{issue.borrowerClass || '-'}</td>
                  <td className="border-b border-l border-slate-200 px-4 py-3 text-sm font-black text-slate-950">{issue.bookTitle}</td>
                  <td className="border-b border-l border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">{issue.issueDate || '-'}</td>
                  <td className="border-b border-l border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">{issue.returnDate || 'Pending'}</td>
                  <td className="border-b border-l border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">Rs {Number(issue.totalFine) || 0}</td>
                  <td className="border-b border-l border-slate-200 px-4 py-3"><span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${getStatusBadgeClass(displayStatus(issue.status))}`}>{displayStatus(issue.status)}</span></td>
                  <td className="border-b border-l border-slate-200 px-4 py-3"><IconButton onClick={() => onVoid(issue.id)} icon={Trash2} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager page={page} setPage={setPage} pageSize={pageSize} setPageSize={setPageSize} pageData={pageData} />
      </div>
    ) : <EmptyState icon={BookmarkCheck} title="No circulation records yet" description="Create the first issue entry to track due dates, returns, and automatic fine amounts." />}
  </section>
);

const ReturnForm = ({ returnIssueId, setReturnIssueId, activeIssueChoices, selectedReturnIssue, isDamageBook, setIsDamageBook, returnDamageCharge, setReturnDamageCharge, onSubmit, pending }) => (
  <form className="mt-8 grid gap-5 md:grid-cols-2" onSubmit={onSubmit}>
    <div className="md:col-span-2">
      <CreativeSelect label="Active Issue Record" value={returnIssueId} onChange={(e) => setReturnIssueId(e.target.value)} options={['', ...activeIssueChoices.map((issue) => String(issue.id))]} renderOptionLabel={(value) => {
        if (!value) return activeIssueChoices.length ? 'Select issued book' : 'No active issue found';
        const match = activeIssueChoices.find((issue) => String(issue.id) === value);
        return match ? `${match.label} | ${match.subtitle}` : 'Select issued book';
      }} />
    </div>
    <ReadOnlyLibraryField label="Borrower" value={selectedReturnIssue?.borrowerName || 'Select an active issue record'} />
    <ReadOnlyLibraryField label="Book" value={selectedReturnIssue?.bookTitle || 'Select an active issue record'} />
    <ReadOnlyLibraryField label="Issue Date" value={selectedReturnIssue?.issueDate || '-'} />
    <ReadOnlyLibraryField label="Due Date" value={selectedReturnIssue?.dueDate || selectedReturnIssue?.issueDate || '-'} />
    <div className="md:col-span-2 rounded-[1.6rem] border border-slate-200 bg-slate-50 p-4">
      <label className="inline-flex items-center gap-3 text-sm font-semibold text-slate-800">
        <input type="checkbox" checked={isDamageBook} onChange={(e) => { setIsDamageBook(e.target.checked); if (!e.target.checked) setReturnDamageCharge(''); }} className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
        Tick if the returned book is damaged
      </label>
      <p className="mt-2 text-xs font-semibold text-slate-500">Damage charge library issue record me save hoga aur monthly fee cycle adjustment ke liye use kiya ja sakta hai.</p>
    </div>
    {isDamageBook ? <div className="md:col-span-2"><CreativeInput label="Damage Charge" type="number" min="0" value={returnDamageCharge} onChange={(e) => setReturnDamageCharge(e.target.value)} placeholder="250" /></div> : null}
    <div className="md:col-span-2"><PrimaryButton type="submit" icon={BookmarkCheck} label={pending ? 'Returning Book...' : 'Return Selected Book'} /></div>
  </form>
);

const Pager = ({ page, setPage, pageSize, setPageSize, pageData }) => {
  const totalPages = Math.max(pageData?.totalPages || 1, 1);
  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
      <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }} className="h-9 w-32 rounded-md border border-slate-200 bg-white px-2 text-sm font-bold">
        {pageSizes.map((size) => <option key={size} value={size}>{size} rows</option>)}
      </select>
      <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
        Page {page + 1} of {totalPages}
        <button type="button" onClick={() => setPage((value) => Math.max(0, value - 1))} className="rounded-md border border-slate-200 p-2 disabled:opacity-40" disabled={page <= 0}><ChevronLeft className="h-4 w-4" /></button>
        <button type="button" onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))} className="rounded-md border border-slate-200 p-2 disabled:opacity-40" disabled={page >= totalPages - 1}><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
};

const DeskToggle = ({ active, onClick, label }) => (
  <button type="button" onClick={onClick} className={`rounded-2xl px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] transition ${active ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-slate-50 text-slate-600 hover:border-emerald-300 hover:text-emerald-700'}`}>{label}</button>
);

const IconButton = ({ onClick, icon: Icon }) => (
  <button onClick={onClick} className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"><Icon size={16} /></button>
);

const getStatusBadgeClass = (status, filled = false) => {
  if (status === 'Overdue') return filled ? 'bg-rose-100 text-rose-700' : 'border border-rose-200 bg-rose-50 text-rose-700';
  if (status === 'Returned') return filled ? 'bg-emerald-100 text-emerald-700' : 'border border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'Voided') return filled ? 'bg-slate-100 text-slate-700' : 'border border-slate-200 bg-slate-50 text-slate-700';
  return filled ? 'bg-amber-100 text-amber-700' : 'border border-amber-200 bg-amber-50 text-amber-700';
};

const displayStatus = (status) => String(status || 'Issued').toLowerCase().replace(/(^|_)([a-z])/g, (_, space, letter) => `${space ? ' ' : ''}${letter.toUpperCase()}`);

const LibraryActionCard = ({ icon: Icon, title, description, onClick }) => (
  <button type="button" onClick={onClick} className="group flex min-h-52 flex-col justify-between rounded-4xl border border-slate-200/80 bg-white p-6 text-left shadow-[0_20px_60px_-38px_rgba(15,23,42,0.45)] transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-[0_26px_70px_-42px_rgba(6,95,70,0.65)] lg:p-8">
    <div>
      <div className="flex items-start justify-between gap-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-700 transition group-hover:bg-emerald-600 group-hover:text-white"><Icon size={24} /></div>
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition group-hover:border-emerald-200 group-hover:text-emerald-700"><ArrowRight size={18} /></div>
      </div>
      <h3 className="mt-7 font-serif text-3xl font-black italic tracking-tight text-slate-950">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-slate-500">{description}</p>
    </div>
    <span className="mt-6 text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700">Open Page</span>
  </button>
);

const FormTitle = ({ title, description }) => (
  <div><h3 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">{title}</h3><p className="mt-2 text-sm leading-7 text-slate-500">{description}</p></div>
);

const SearchInput = ({ value, onChange, placeholder }) => (
  <div className="relative min-w-65">
    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-12 py-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100" />
  </div>
);

const CreativeInput = ({ label, error, ...props }) => (
  <div className="space-y-2.5">
    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
    <input className={`w-full rounded-2xl border-2 bg-slate-50 px-5 py-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:bg-white ${error ? 'border-rose-300 focus:border-rose-500 focus:ring-4 focus:ring-rose-100' : 'border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100'}`} {...props} />
    {error ? <p className="text-xs font-bold text-rose-600">{error}</p> : null}
  </div>
);

const CreativeSelect = ({ label, options, renderOptionLabel, error, ...props }) => (
  <div className="space-y-2.5">
    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
    <select className={`w-full rounded-2xl border-2 bg-slate-50 px-5 py-3.5 text-sm font-semibold text-slate-900 outline-none transition focus:bg-white ${error ? 'border-rose-300 focus:border-rose-500 focus:ring-4 focus:ring-rose-100' : 'border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100'}`} {...props}>
      {options.map((option) => <option key={option || 'empty-option'} value={option}>{renderOptionLabel ? renderOptionLabel(option) : option || 'Select'}</option>)}
    </select>
    {error ? <p className="text-xs font-bold text-rose-600">{error}</p> : null}
  </div>
);

const PrimaryButton = ({ type, icon: Icon, label }) => (
  <button type={type} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-white transition hover:bg-emerald-600"><Icon size={15} />{label}</button>
);

const EmptyState = ({ icon: Icon, title, description }) => (
  <div className="mt-8 rounded-4xl border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center">
    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-white text-slate-300 shadow-sm"><Icon size={34} /></div>
    <h4 className="mt-6 font-serif text-3xl font-black italic tracking-tight text-slate-950">{title}</h4>
    <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-500">{description}</p>
  </div>
);

const ReadOnlyLibraryField = ({ label, value }) => (
  <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50 p-4"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</p><p className="mt-2 text-sm font-semibold text-slate-900">{value}</p></div>
);

function useDebouncedValue(value, delay = 350) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timeoutId);
  }, [value, delay]);
  return debouncedValue;
}

function validateBookForm(form) {
  const errors = {};
  const isbn = String(form.isbn || '').trim();
  const title = String(form.title || '').trim();
  const author = String(form.author || '').trim();
  const rack = String(form.rack || '').trim();
  const shelf = String(form.shelf || '').trim();
  const availableQuantity = Number(form.availableQuantity);
  if (!isbn) errors.isbn = 'ISBN or accession code is required.';
  else if (!/^[A-Z0-9-]{3,24}$/.test(isbn)) errors.isbn = 'Use 3-24 uppercase letters, numbers, or hyphens only.';
  if (!title) errors.title = 'Book title is required.';
  else if (title.length < 2) errors.title = 'Book title must contain at least 2 characters.';
  if (!author) errors.author = 'Author name is required.';
  else if (!/^[A-Z .'-]{2,80}$/.test(author)) errors.author = 'Author name can contain letters, spaces, dots, hyphens, or apostrophes.';
  if (!form.format) errors.format = 'Select asset format.';
  if (!rack) errors.rack = 'Rack name or number is required.';
  if (!shelf) errors.shelf = 'Shelf name or number is required.';
  if (!Number.isInteger(availableQuantity) || availableQuantity < 1) errors.availableQuantity = 'Total copies must be at least 1.';
  return errors;
}

function mapBookFieldErrors(fieldErrors = {}) {
  const errors = { ...fieldErrors };
  if (errors.shelfLocation && !errors.rack && !errors.shelf) {
    errors.rack = errors.shelfLocation;
    errors.shelf = errors.shelfLocation;
  }
  return errors;
}

function toUpperInput(value) {
  return String(value || '').toUpperCase();
}

function formatShelfLocation(rack, shelf) {
  const rackText = String(rack || '').trim();
  const shelfText = String(shelf || '').trim();
  if (!rackText && !shelfText) return '';
  if (!rackText) return shelfText;
  if (!shelfText) return rackText;
  return `${rackText} / ${shelfText}`;
}

function getBookRack(book) {
  if (book?.rack) return String(book.rack);
  const [rackPart = ''] = String(book?.shelfLocation || '').split('/');
  return rackPart.trim() || '-';
}

function getBookShelf(book) {
  if (book?.shelf) return String(book.shelf);
  const [, shelfPart = ''] = String(book?.shelfLocation || '').split('/');
  return shelfPart.trim() || '-';
}

export default LibraryManagement;
