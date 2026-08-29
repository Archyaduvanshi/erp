package com.erp.backend.library.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.erp.backend.exception.ResourceNotFoundException;
import com.erp.backend.fee.service.FeeService;
import com.erp.backend.institute.entity.Institute;
import com.erp.backend.institute.repository.InstituteRepository;
import com.erp.backend.library.dto.LibraryBookPayload;
import com.erp.backend.library.dto.LibraryBookResponse;
import com.erp.backend.library.dto.LibraryIssuePayload;
import com.erp.backend.library.dto.LibraryIssueResponse;
import com.erp.backend.library.dto.LibraryMembershipPayload;
import com.erp.backend.library.dto.LibraryMembershipResponse;
import com.erp.backend.library.dto.LibraryReturnPayload;
import com.erp.backend.library.dto.LibraryStudentSearchResponse;
import com.erp.backend.library.entity.LibraryBook;
import com.erp.backend.library.entity.LibraryIssue;
import com.erp.backend.library.entity.LibraryMembership;
import com.erp.backend.library.repository.LibraryBookRepository;
import com.erp.backend.library.repository.LibraryIssueRepository;
import com.erp.backend.library.repository.LibraryMembershipRepository;
import com.erp.backend.student.entity.Student;
import com.erp.backend.student.repository.StudentRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class LibraryService {

    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final String STATUS_ARCHIVED = "ARCHIVED";
    private static final String ISSUE_ISSUED = "ISSUED";
    private static final String ISSUE_RETURNED = "RETURNED";
    private static final String ISSUE_VOIDED = "VOIDED";
    private static final int DEFAULT_LOAN_DAYS = 14;
    private static final int MAX_BOOKS_PER_STUDENT = 3;
    private static final BigDecimal FINE_PER_DAY = BigDecimal.ZERO;

    private final InstituteRepository instituteRepository;
    private final StudentRepository studentRepository;
    private final LibraryBookRepository libraryBookRepository;
    private final LibraryIssueRepository libraryIssueRepository;
    private final LibraryMembershipRepository libraryMembershipRepository;
    private final EntityManager entityManager;
    private final FeeService feeService;

    public LibraryService(
            InstituteRepository instituteRepository,
            StudentRepository studentRepository,
            LibraryBookRepository libraryBookRepository,
            LibraryIssueRepository libraryIssueRepository,
            LibraryMembershipRepository libraryMembershipRepository,
            EntityManager entityManager,
            FeeService feeService
    ) {
        this.instituteRepository = instituteRepository;
        this.studentRepository = studentRepository;
        this.libraryBookRepository = libraryBookRepository;
        this.libraryIssueRepository = libraryIssueRepository;
        this.libraryMembershipRepository = libraryMembershipRepository;
        this.entityManager = entityManager;
        this.feeService = feeService;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getOverview(Long instituteId) {
        return single("""
                select coalesce(count(b.id), 0) as totalTitles,
                       coalesce(sum(coalesce(b.total_copies, b.available_quantity, 0)), 0) as totalCopies,
                       coalesce(sum(coalesce(b.available_copies, b.available_quantity, 0)), 0) as availableCopies,
                       coalesce(sum(greatest(coalesce(b.total_copies, b.available_quantity, 0) - coalesce(b.available_copies, b.available_quantity, 0), 0)), 0) as issuedCopies,
                       coalesce((select count(*) from library_issues i where i.institute_id = :instituteId and coalesce(i.status, case when i.return_date is null then 'ISSUED' else 'RETURNED' end) = 'ISSUED' and i.due_date < current_date), 0) as overdueIssues,
                       coalesce((select count(distinct borrower_id) from library_issues i where i.institute_id = :instituteId and coalesce(i.status, case when i.return_date is null then 'ISSUED' else 'RETURNED' end) = 'ISSUED'), 0) as activeBorrowers,
                       coalesce((select sum(greatest(current_date - i.due_date, 0) * coalesce(i.fine_per_day, 0) + coalesce(i.damage_charges, 0)) from library_issues i where i.institute_id = :instituteId and coalesce(i.status, case when i.return_date is null then 'ISSUED' else 'RETURNED' end) = 'ISSUED'), 0) as outstandingFine
                from library_books b
                where b.institute_id = :instituteId
                  and coalesce(b.status, 'ACTIVE') <> 'ARCHIVED'
                """, params("instituteId", instituteId),
                "totalTitles", "totalCopies", "availableCopies", "issuedCopies", "overdueIssues", "activeBorrowers", "outstandingFine");
    }

    @Transactional(readOnly = true)
    public List<LibraryBookResponse> getBooks(Long instituteId) {
        return getBooks(instituteId, "", "", "", STATUS_ACTIVE, Pageable.ofSize(100)).getContent();
    }

    @Transactional(readOnly = true)
    public Page<LibraryBookResponse> getBooks(Long instituteId, String search, String format, String availability, String status, Pageable pageable) {
        String normalizedStatus = filter(status);
        if (!StringUtils.hasText(normalizedStatus)) {
            normalizedStatus = STATUS_ACTIVE;
        }
        return libraryBookRepository.searchBooks(
                        instituteId,
                        filter(search),
                        normalizeAll(format, "All Formats"),
                        normalizeAll(availability, "All Availability"),
                        normalizedStatus,
                        safePageable(pageable)
                )
                .map(this::toBookResponse);
    }

    @Transactional
    public LibraryBookResponse saveBook(Long instituteId, LibraryBookPayload request) {
        Institute institute = validateInstitute(instituteId);
        String normalizedIsbn = normalizeIsbn(request.isbn());
        if (libraryBookRepository.existsByInstituteIdAndNormalizedIsbnIgnoreCaseAndStatusNot(instituteId, normalizedIsbn, STATUS_ARCHIVED)) {
            throw new IllegalArgumentException("Library book already exists with ISBN: " + request.isbn());
        }
        LibraryBook book = new LibraryBook();
        book.setInstitute(institute);
        applyBookPayload(book, request);
        return toBookResponse(libraryBookRepository.save(book));
    }

    @Transactional
    public void deleteBook(Long instituteId, Long bookId) {
        LibraryBook book = findBookForUpdate(instituteId, bookId);
        if (libraryIssueRepository.existsByInstituteIdAndBookIdAndStatus(instituteId, bookId, ISSUE_ISSUED)) {
            throw new IllegalArgumentException("Return all active issues before archiving this book.");
        }
        if (libraryIssueRepository.existsByInstituteIdAndBookId(instituteId, bookId)) {
            book.setStatus(STATUS_ARCHIVED);
            libraryBookRepository.save(book);
            return;
        }
        libraryBookRepository.delete(book);
    }

    @Transactional(readOnly = true)
    public List<LibraryIssueResponse> getIssues(Long instituteId) {
        return getIssues(instituteId, "", "", null, null, null, null, null, Pageable.ofSize(100)).getContent();
    }

    @Transactional(readOnly = true)
    public Page<LibraryIssueResponse> getIssues(Long instituteId, String search, String status, Long studentId, Long classId, Long bookId, LocalDate dateFrom, LocalDate dateTo, Pageable pageable) {
        return issuePage("""
                from library_issues i
                join library_books b on b.id = i.book_id and b.institute_id = i.institute_id
                join students s on s.id = i.borrower_id and s.institute_id = i.institute_id
                left join school_classes c on c.id = :classId
                where i.institute_id = :instituteId
                  and (:studentId is null or i.borrower_id = :studentId)
                  and (:bookId is null or i.book_id = :bookId)
                  and (:classId is null or lower(coalesce(s.assigned_class, s.class_name, '')) = lower(coalesce(c.name, '')))
                  and (:dateFrom is null or i.issue_date >= :dateFrom)
                  and (:dateTo is null or i.issue_date <= :dateTo)
                  and (:status = '' or (:status = 'OVERDUE' and coalesce(i.status, case when i.return_date is null then 'ISSUED' else 'RETURNED' end) = 'ISSUED' and i.due_date < current_date) or coalesce(i.status, case when i.return_date is null then 'ISSUED' else 'RETURNED' end) = :status)
                  and (:search = '' or lower(concat(coalesce(b.title, ''), ' ', coalesce(b.isbn, ''), ' ', coalesce(s.first_name, ''), ' ', coalesce(s.last_name, ''), ' ', coalesce(s.name, ''), ' ', coalesce(s.enrollment_no, ''), ' ', coalesce(s.assigned_class, s.class_name, ''))) like lower(concat('%', :search, '%')))
                """, params("instituteId", instituteId, "search", filter(search), "status", normalizeStatus(status), "studentId", studentId, "classId", classId, "bookId", bookId, "dateFrom", dateFrom, "dateTo", dateTo), pageable);
    }

    @Transactional
    public LibraryIssueResponse saveIssue(Long instituteId, LibraryIssuePayload request, Long issuedByAccountId) {
        LibraryBook book = findBookForUpdate(instituteId, request.bookId());
        Student borrower = findStudent(instituteId, request.borrowerId());
        validateCanBorrow(instituteId, borrower, book);

        LocalDate issueDate = parseOptionalDate(request.issueDate(), LocalDate.now());
        LocalDate dueDate = issueDate.plusDays(DEFAULT_LOAN_DAYS);
        int available = currentAvailable(book);
        if (available < 1) {
            throw new IllegalArgumentException("BOOK_NOT_AVAILABLE");
        }

        LibraryIssue issue = new LibraryIssue();
        issue.setInstitute(book.getInstitute());
        issue.setBook(book);
        issue.setBorrower(borrower);
        issue.setIssueDate(issueDate);
        issue.setDueDate(dueDate);
        issue.setReturnDate(null);
        issue.setStatus(ISSUE_ISSUED);
        issue.setFinePerDay(FINE_PER_DAY);
        issue.setDamageCharges(parseAmount(request.damageCharges()));
        issue.setIssuedByAccountId(issuedByAccountId);
        book.setAvailableCopies(available - 1);
        book.setAvailableQuantity(available - 1);
        libraryBookRepository.save(book);
        return toIssueResponse(libraryIssueRepository.save(issue));
    }

    @Transactional
    public void deleteIssue(Long instituteId, Long issueId, Long accountId) {
        LibraryIssue issue = findIssueForUpdate(instituteId, issueId);
        if (ISSUE_VOIDED.equalsIgnoreCase(defaultValue(issue.getStatus(), ""))) {
            return;
        }
        if (isActiveIssue(issue)) {
            LibraryBook book = findBookForUpdate(instituteId, issue.getBook().getId());
            restoreStock(book);
        }
        issue.setStatus(ISSUE_VOIDED);
        issue.setVoidedAt(LocalDateTime.now());
        issue.setVoidedByAccountId(accountId);
        issue.setVoidReason("Voided from library circulation desk.");
        libraryIssueRepository.save(issue);
    }

    @Transactional
    public LibraryIssueResponse markReturned(Long instituteId, Long issueId, LibraryReturnPayload request, Long accountId) {
        LibraryIssue issue = findIssueForUpdate(instituteId, issueId);
        if (!isActiveIssue(issue)) {
            return toIssueResponse(issue);
        }
        LibraryBook book = findBookForUpdate(instituteId, issue.getBook().getId());
        issue.setReturnDate(LocalDate.now());
        issue.setReturnedAt(LocalDateTime.now());
        issue.setReturnedByAccountId(accountId);
        issue.setStatus(ISSUE_RETURNED);
        if (request != null && StringUtils.hasText(request.damageCharges())) {
            issue.setDamageCharges(parseAmount(request.damageCharges()));
        }
        restoreStock(book);
        return toIssueResponse(libraryIssueRepository.save(issue));
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getStudentSummary(Long instituteId, Long studentId) {
        Student student = findStudent(instituteId, studentId);
        Map<String, Object> summary = single("""
                select coalesce((select count(*) from library_books where institute_id = :instituteId and coalesce(status, 'ACTIVE') = 'ACTIVE' and coalesce(available_copies, available_quantity, 0) > 0), 0) as availableBookCount,
                       coalesce((select count(*) from library_issues where institute_id = :instituteId and borrower_id = :studentId and coalesce(status, case when return_date is null then 'ISSUED' else 'RETURNED' end) = 'ISSUED'), 0) as currentlyBorrowed,
                       coalesce((select count(*) from library_issues where institute_id = :instituteId and borrower_id = :studentId and coalesce(status, case when return_date is null then 'ISSUED' else 'RETURNED' end) = 'ISSUED' and due_date < current_date), 0) as overdueCount,
                       coalesce((select sum(greatest(current_date - due_date, 0) * coalesce(fine_per_day, 0) + coalesce(damage_charges, 0)) from library_issues where institute_id = :instituteId and borrower_id = :studentId and coalesce(status, case when return_date is null then 'ISSUED' else 'RETURNED' end) = 'ISSUED'), 0) as totalOutstandingFine
                """, params("instituteId", instituteId, "studentId", studentId),
                "availableBookCount", "currentlyBorrowed", "overdueCount", "totalOutstandingFine");
        summary.put("libraryFacilityActive", isLibraryActive(student));
        summary.put("libraryFacilityStatus", defaultValue(student.getLibraryStatus(), "inactive"));
        summary.put("maxBooksAllowed", MAX_BOOKS_PER_STUDENT);
        return summary;
    }

    @Transactional(readOnly = true)
    public Page<LibraryBookResponse> getStudentBooks(Long instituteId, Long studentId, String search, String format, Pageable pageable) {
        Student student = findStudent(instituteId, studentId);
        if (!isLibraryActive(student)) {
            return Page.empty(safePageable(pageable));
        }
        return getBooks(instituteId, search, format, "available", STATUS_ACTIVE, pageable);
    }

    @Transactional(readOnly = true)
    public Page<LibraryIssueResponse> getStudentIssues(Long instituteId, Long studentId, String status, Pageable pageable) {
        findStudent(instituteId, studentId);
        return getIssues(instituteId, "", status, studentId, null, null, null, null, pageable);
    }

    @Transactional(readOnly = true)
    public Page<LibraryStudentSearchResponse> searchStudents(Long instituteId, String search, String className, String section, Pageable pageable) {
        Pageable safe = safePageable(pageable);
        Map<String, Object> params = params("instituteId", instituteId, "search", filter(search), "className", filter(className), "section", filter(section), "limit", safe.getPageSize(), "offset", safe.getOffset());
        List<LibraryStudentSearchResponse> content = rows("""
                select s.id,
                       coalesce(nullif(trim(concat(coalesce(s.first_name, ''), ' ', coalesce(s.last_name, ''))), ''), coalesce(s.name, s.enrollment_no, 'Student')) as name,
                       s.enrollment_no,
                       s.roll_no,
                       coalesce(s.assigned_class, s.class_name, 'Not Added') as class_name,
                       coalesce(s.section, 'Not Added') as section_name,
                       coalesce(s.library_status, case when lower(coalesce(s.library_opt_in, 'no')) in ('yes', 'true') then 'requested' else 'not_requested' end) as library_status
                from students s
                where s.institute_id = :instituteId
                  and lower(coalesce(s.status, 'active')) <> 'archived'
                  and (:className = '' or lower(coalesce(s.assigned_class, s.class_name, '')) = lower(:className))
                  and (:section = '' or lower(coalesce(s.section, '')) = lower(:section))
                  and (:search = '' or lower(concat(coalesce(s.first_name, ''), ' ', coalesce(s.last_name, ''), ' ', coalesce(s.name, ''), ' ', coalesce(s.enrollment_no, ''), ' ', coalesce(s.roll_no, ''), ' ', coalesce(s.mobile, ''))) like lower(concat('%', :search, '%')))
                order by s.first_name asc, s.last_name asc, s.enrollment_no asc
                limit :limit offset :offset
                """, params).stream()
                .map(row -> new LibraryStudentSearchResponse(number(row[0]), text(row[1]), text(row[2]), text(row[3]), text(row[4]), text(row[5]), text(row[6])))
                .toList();
        long total = ((Number) scalar("""
                select count(*)
                from students s
                where s.institute_id = :instituteId
                  and lower(coalesce(s.status, 'active')) <> 'archived'
                  and (:className = '' or lower(coalesce(s.assigned_class, s.class_name, '')) = lower(:className))
                  and (:section = '' or lower(coalesce(s.section, '')) = lower(:section))
                  and (:search = '' or lower(concat(coalesce(s.first_name, ''), ' ', coalesce(s.last_name, ''), ' ', coalesce(s.name, ''), ' ', coalesce(s.enrollment_no, ''), ' ', coalesce(s.roll_no, ''), ' ', coalesce(s.mobile, ''))) like lower(concat('%', :search, '%')))
                """, params)).longValue();
        return new PageImpl<>(content, safe, total);
    }

    public List<LibraryMembershipResponse> getMemberships(Long instituteId) {
        return libraryMembershipRepository.findByInstituteIdAndStatus(instituteId, "active")
                .stream()
                .map(this::toMembershipResponse)
                .toList();
    }

    @Transactional
    public LibraryMembershipResponse createMembership(Long instituteId, LibraryMembershipPayload request) {
        Institute institute = validateInstitute(instituteId);
        Student student = findStudent(instituteId, request.studentId());
        libraryMembershipRepository.findByInstituteIdAndStudentIdAndStatus(instituteId, student.getId(), "active")
                .ifPresent(existing -> {
                    throw new IllegalArgumentException("Student already has an active library membership.");
                });
        LibraryMembership membership = new LibraryMembership();
        membership.setStudent(student);
        membership.setInstitute(institute);
        membership.setMembershipType(request.membershipType());
        membership.setMonthlyCharge(request.monthlyCharge());
        membership.setStatus("active");
        membership.setEnrollmentMonth(YearMonth.now().toString());
        membership.setEnrollmentYear(String.valueOf(YearMonth.now().getYear()));
        membership.setRemarks(request.remarks());
        LibraryMembership savedMembership = libraryMembershipRepository.save(membership);
        student.setLibraryOptIn("yes");
        student.setLibraryStatus("active");
        student.setLibraryMonthlyCharge(request.monthlyCharge() == null ? null : request.monthlyCharge().toPlainString());
        studentRepository.save(student);
        feeService.synchronizeChargesForStudent(instituteId, student.getId());
        return toMembershipResponse(savedMembership);
    }

    public LibraryMembershipResponse getMembershipByStudent(Long instituteId, Long studentId) {
        Student student = findStudent(instituteId, studentId);
        LibraryMembership membership = libraryMembershipRepository.findByInstituteIdAndStudentId(instituteId, student.getId())
                .orElseThrow(() -> new ResourceNotFoundException("No library membership found for student with id: " + studentId));
        return toMembershipResponse(membership);
    }

    @Transactional
    public LibraryMembershipResponse updateMembershipStatus(Long instituteId, Long membershipId, String status) {
        LibraryMembership membership = libraryMembershipRepository.findByInstituteIdAndId(instituteId, membershipId)
                .orElseThrow(() -> new ResourceNotFoundException("Library membership not found with id: " + membershipId));
        membership.setStatus(status);
        LibraryMembership savedMembership = libraryMembershipRepository.save(membership);
        Student student = membership.getStudent();
        if ("active".equalsIgnoreCase(status)) {
            student.setLibraryOptIn("yes");
            student.setLibraryStatus("active");
            student.setLibraryMonthlyCharge(membership.getMonthlyCharge() == null ? null : membership.getMonthlyCharge().toPlainString());
            studentRepository.save(student);
            feeService.synchronizeChargesForStudent(instituteId, student.getId());
        } else if (student != null) {
            student.setLibraryStatus(status);
            studentRepository.save(student);
        }
        return toMembershipResponse(savedMembership);
    }

    private Page<LibraryIssueResponse> issuePage(String fromWhere, Map<String, Object> params, Pageable pageable) {
        Pageable safe = safePageable(pageable);
        Map<String, Object> pagedParams = new LinkedHashMap<>(params);
        pagedParams.put("limit", safe.getPageSize());
        pagedParams.put("offset", safe.getOffset());
        List<LibraryIssueResponse> content = rows("""
                select i.id,
                       b.id as book_id,
                       b.title as book_title,
                       b.isbn,
                       s.id as borrower_id,
                       coalesce(nullif(trim(concat(coalesce(s.first_name, ''), ' ', coalesce(s.last_name, ''))), ''), coalesce(s.name, s.enrollment_no, 'Student')) as borrower_name,
                       s.enrollment_no,
                       coalesce(s.assigned_class, s.class_name, 'Not Added') as class_name,
                       coalesce(s.section, 'Not Added') as section_name,
                       i.issue_date,
                       i.due_date,
                       i.return_date,
                       case when coalesce(i.status, case when i.return_date is null then 'ISSUED' else 'RETURNED' end) = 'ISSUED' and i.due_date < current_date then 'OVERDUE' else coalesce(i.status, case when i.return_date is null then 'ISSUED' else 'RETURNED' end) end as live_status,
                       greatest(coalesce(coalesce(i.return_date, current_date) - i.due_date, 0), 0) as overdue_days,
                       coalesce(i.fine_per_day, 0) as fine_per_day,
                       greatest(coalesce(coalesce(i.return_date, current_date) - i.due_date, 0), 0) * coalesce(i.fine_per_day, 0) as late_fine,
                       coalesce(i.damage_charges, 0) as damage_charges,
                       greatest(coalesce(coalesce(i.return_date, current_date) - i.due_date, 0), 0) * coalesce(i.fine_per_day, 0) + coalesce(i.damage_charges, 0) as total_fine,
                       b.author,
                       b.shelf_location,
                       i.created_at,
                       i.updated_at
                %s
                order by i.issue_date desc, i.created_at desc
                limit :limit offset :offset
                """.formatted(fromWhere), pagedParams).stream().map(this::issueResponse).toList();
        long total = ((Number) scalar("select count(*) " + fromWhere, params)).longValue();
        return new PageImpl<>(content, safe, total);
    }

    private LibraryIssueResponse issueResponse(Object[] row) {
        return new LibraryIssueResponse(
                number(row[0]),
                number(row[1]),
                text(row[2]),
                text(row[3]),
                number(row[4]),
                text(row[5]),
                text(row[6]),
                text(row[7]),
                text(row[8]),
                text(row[9]),
                text(row[10]),
                text(row[11]),
                text(row[12]),
                ((Number) row[13]).longValue(),
                money(row[14]),
                money(row[15]),
                money(row[16]),
                money(row[17]),
                text(row[18]),
                text(row[19]),
                (LocalDateTime) row[20],
                (LocalDateTime) row[21]
        );
    }

    private Institute validateInstitute(Long instituteId) {
        return instituteRepository.findById(instituteId)
                .orElseThrow(() -> new ResourceNotFoundException("Institute not found with id: " + instituteId));
    }

    private Student findStudent(Long instituteId, Long studentId) {
        return studentRepository.findByInstituteIdAndId(instituteId, studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Student not found with id: " + studentId));
    }

    private LibraryBook findBookForUpdate(Long instituteId, Long bookId) {
        return libraryBookRepository.findByInstituteIdAndIdForUpdate(instituteId, bookId)
                .orElseThrow(() -> new ResourceNotFoundException("Library book not found with id: " + bookId));
    }

    private LibraryIssue findIssueForUpdate(Long instituteId, Long issueId) {
        return libraryIssueRepository.findByInstituteIdAndIdForUpdate(instituteId, issueId)
                .orElseThrow(() -> new ResourceNotFoundException("Library issue not found with id: " + issueId));
    }

    private void applyBookPayload(LibraryBook book, LibraryBookPayload request) {
        int totalCopies = request.totalCopies() == null ? request.availableQuantity() : request.totalCopies();
        int availableCopies = Math.min(request.availableQuantity(), totalCopies);
        book.setIsbn(request.isbn().trim().toUpperCase());
        book.setNormalizedIsbn(normalizeIsbn(request.isbn()));
        book.setTitle(request.title().trim().toUpperCase());
        book.setAuthor(request.author().trim().toUpperCase());
        book.setFormat(request.format().trim());
        book.setShelfLocation(request.shelfLocation().trim().toUpperCase());
        book.setTotalCopies(Math.max(totalCopies, 1));
        book.setAvailableCopies(Math.max(availableCopies, 0));
        book.setAvailableQuantity(Math.max(availableCopies, 0));
        book.setStatus(STATUS_ACTIVE);
    }

    private LibraryBookResponse toBookResponse(LibraryBook book) {
        int total = currentTotal(book);
        int available = currentAvailable(book);
        return new LibraryBookResponse(
                book.getId(),
                book.getIsbn(),
                book.getTitle(),
                book.getAuthor(),
                book.getFormat(),
                book.getShelfLocation(),
                available,
                total,
                available,
                Math.max(total - available, 0),
                defaultValue(book.getStatus(), STATUS_ACTIVE),
                book.getCreatedAt(),
                book.getUpdatedAt()
        );
    }

    private LibraryIssueResponse toIssueResponse(LibraryIssue issue) {
        Student borrower = issue.getBorrower();
        LibraryBook book = issue.getBook();
        String liveStatus = liveStatus(issue);
        long overdueDays = overdueDays(issue);
        BigDecimal lateFine = issue.getFinePerDay() == null ? BigDecimal.ZERO : issue.getFinePerDay().multiply(BigDecimal.valueOf(overdueDays));
        BigDecimal damage = issue.getDamageCharges() == null ? BigDecimal.ZERO : issue.getDamageCharges();
        return new LibraryIssueResponse(
                issue.getId(),
                book.getId(),
                book.getTitle(),
                book.getIsbn(),
                borrower.getId(),
                buildStudentName(borrower),
                borrower.getEnrollmentNo(),
                firstNonBlank(borrower.getAssignedClass(), borrower.getClassName()),
                borrower.getSection(),
                text(issue.getIssueDate()),
                text(issue.getDueDate()),
                text(issue.getReturnDate()),
                liveStatus,
                overdueDays,
                money(issue.getFinePerDay()),
                money(lateFine),
                money(damage),
                money(lateFine.add(damage)),
                book.getAuthor(),
                book.getShelfLocation(),
                issue.getCreatedAt(),
                issue.getUpdatedAt()
        );
    }

    private void validateCanBorrow(Long instituteId, Student student, LibraryBook book) {
        if (!STATUS_ACTIVE.equalsIgnoreCase(defaultValue(book.getStatus(), STATUS_ACTIVE))) {
            throw new IllegalArgumentException("BOOK_NOT_AVAILABLE");
        }
        if (!isLibraryActive(student)) {
            throw new IllegalArgumentException("LIBRARY_FACILITY_INACTIVE");
        }
        if (libraryIssueRepository.countByInstituteIdAndBorrowerIdAndStatus(instituteId, student.getId(), ISSUE_ISSUED) >= MAX_BOOKS_PER_STUDENT) {
            throw new IllegalArgumentException("LIBRARY_BORROW_LIMIT_REACHED");
        }
        if (libraryIssueRepository.existsByInstituteIdAndBorrowerIdAndStatusAndDueDateBefore(instituteId, student.getId(), ISSUE_ISSUED, LocalDate.now())) {
            throw new IllegalArgumentException("LIBRARY_OVERDUE_BLOCK");
        }
        if (libraryIssueRepository.existsByInstituteIdAndBorrowerIdAndBookIdAndStatus(instituteId, student.getId(), book.getId(), ISSUE_ISSUED)) {
            throw new IllegalArgumentException("BOOK_ALREADY_ISSUED_TO_STUDENT");
        }
    }

    private void restoreStock(LibraryBook book) {
        int total = currentTotal(book);
        int available = Math.min(currentAvailable(book) + 1, total);
        book.setAvailableCopies(available);
        book.setAvailableQuantity(available);
        libraryBookRepository.save(book);
    }

    private boolean isActiveIssue(LibraryIssue issue) {
        return ISSUE_ISSUED.equalsIgnoreCase(defaultValue(issue.getStatus(), issue.getReturnDate() == null ? ISSUE_ISSUED : ISSUE_RETURNED));
    }

    private boolean isLibraryActive(Student student) {
        boolean requested = "yes".equalsIgnoreCase(defaultValue(student.getLibraryOptIn(), "")) || "true".equalsIgnoreCase(defaultValue(student.getLibraryOptIn(), ""));
        return requested && "active".equalsIgnoreCase(defaultValue(student.getLibraryStatus(), ""));
    }

    private String liveStatus(LibraryIssue issue) {
        String status = defaultValue(issue.getStatus(), issue.getReturnDate() == null ? ISSUE_ISSUED : ISSUE_RETURNED);
        if (ISSUE_ISSUED.equalsIgnoreCase(status) && issue.getDueDate() != null && issue.getDueDate().isBefore(LocalDate.now())) {
            return "OVERDUE";
        }
        return status;
    }

    private long overdueDays(LibraryIssue issue) {
        if (issue.getDueDate() == null) return 0;
        LocalDate end = issue.getReturnDate() == null ? LocalDate.now() : issue.getReturnDate();
        return Math.max(ChronoUnit.DAYS.between(issue.getDueDate(), end), 0);
    }

    private LocalDate parseOptionalDate(String value, LocalDate fallback) {
        return StringUtils.hasText(value) ? LocalDate.parse(value.trim()) : fallback;
    }

    private BigDecimal parseAmount(String value) {
        if (!StringUtils.hasText(value)) {
            return BigDecimal.ZERO;
        }
        try {
            BigDecimal amount = new BigDecimal(value.trim());
            if (amount.compareTo(BigDecimal.ZERO) < 0) {
                throw new IllegalArgumentException("Amount cannot be negative.");
            }
            return amount;
        } catch (NumberFormatException exception) {
            throw new IllegalArgumentException("Amount must be a valid number.");
        }
    }

    private int currentTotal(LibraryBook book) {
        Integer totalCopies = book.getTotalCopies();
        return totalCopies == null ? Math.max(book.getAvailableQuantity() == null ? 0 : book.getAvailableQuantity(), 0) : Math.max(totalCopies, 0);
    }

    private int currentAvailable(LibraryBook book) {
        Integer availableCopies = book.getAvailableCopies();
        return Math.max(availableCopies == null ? (book.getAvailableQuantity() == null ? 0 : book.getAvailableQuantity()) : availableCopies, 0);
    }

    private LibraryMembershipResponse toMembershipResponse(LibraryMembership membership) {
        return new LibraryMembershipResponse(
                membership.getId(),
                membership.getStudent().getId(),
                membership.getInstitute().getId(),
                membership.getMembershipType(),
                membership.getStatus(),
                membership.getMonthlyCharge(),
                membership.getLibraryCardNumber(),
                membership.getEnrollmentMonth(),
                membership.getEnrollmentYear(),
                membership.getRemarks(),
                membership.getCreatedAt(),
                membership.getUpdatedAt()
        );
    }

    private Map<String, Object> single(String sql, Map<String, Object> params, String... columns) {
        Object result = nativeQuery(sql, params).getSingleResult();
        Object[] values = result instanceof Object[] row ? row : new Object[]{result};
        Map<String, Object> mapped = new LinkedHashMap<>();
        for (int index = 0; index < columns.length; index++) {
            mapped.put(columns[index], index < values.length ? values[index] : null);
        }
        return mapped;
    }

    private Object scalar(String sql, Map<String, Object> params) {
        return nativeQuery(sql, params).getSingleResult();
    }

    @SuppressWarnings("unchecked")
    private List<Object[]> rows(String sql, Map<String, Object> params) {
        return nativeQuery(sql, params).getResultList();
    }

    private Query nativeQuery(String sql, Map<String, Object> params) {
        Query query = entityManager.createNativeQuery(sql);
        params.forEach(query::setParameter);
        return query;
    }

    private Map<String, Object> params(Object... pairs) {
        Map<String, Object> params = new LinkedHashMap<>();
        for (int index = 0; index < pairs.length; index += 2) {
            params.put(String.valueOf(pairs[index]), pairs[index + 1]);
        }
        return params;
    }

    private Pageable safePageable(Pageable pageable) {
        return pageable == null || pageable.isUnpaged() ? Pageable.ofSize(25) : pageable;
    }

    private String normalizeAll(String value, String allLabel) {
        String filtered = filter(value);
        return allLabel.equalsIgnoreCase(filtered) || filtered.toLowerCase().startsWith("all ") ? "" : filtered;
    }

    private String normalizeStatus(String value) {
        String filtered = normalizeAll(value, "All Records");
        return filtered.replace(' ', '_').toUpperCase();
    }

    private String filter(String value) {
        return StringUtils.hasText(value) ? value.trim() : "";
    }

    private String normalizeIsbn(String isbn) {
        return defaultValue(isbn, "").replaceAll("[^A-Za-z0-9]", "").toUpperCase();
    }

    private String buildStudentName(Student student) {
        String name = String.join(" ", defaultValue(student.getFirstName(), ""), defaultValue(student.getLastName(), "")).trim();
        return StringUtils.hasText(name) ? name : firstNonBlank(student.getName(), student.getEnrollmentNo());
    }

    private String defaultValue(String value, String fallback) {
        return StringUtils.hasText(value) ? value.trim() : fallback;
    }

    private String firstNonBlank(String primary, String fallback) {
        return StringUtils.hasText(primary) ? primary.trim() : (StringUtils.hasText(fallback) ? fallback.trim() : null);
    }

    private Long number(Object value) {
        return value == null ? null : ((Number) value).longValue();
    }

    private String text(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private String money(Object value) {
        if (value == null) return "0";
        if (value instanceof BigDecimal decimal) return decimal.stripTrailingZeros().toPlainString();
        return String.valueOf(value);
    }
}
