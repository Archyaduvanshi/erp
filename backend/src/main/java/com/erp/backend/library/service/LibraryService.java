package com.erp.backend.library.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

import com.erp.backend.exception.ResourceNotFoundException;
import com.erp.backend.institute.entity.Institute;
import com.erp.backend.institute.repository.InstituteRepository;
import com.erp.backend.library.dto.LibraryBookPayload;
import com.erp.backend.library.dto.LibraryBookResponse;
import com.erp.backend.library.dto.LibraryIssuePayload;
import com.erp.backend.library.dto.LibraryIssueResponse;
import com.erp.backend.library.dto.LibraryReturnPayload;
import com.erp.backend.library.dto.LibraryMembershipPayload;
import com.erp.backend.library.dto.LibraryMembershipResponse;
import com.erp.backend.library.entity.LibraryBook;
import com.erp.backend.library.entity.LibraryIssue;
import com.erp.backend.library.entity.LibraryMembership;
import com.erp.backend.library.repository.LibraryBookRepository;
import com.erp.backend.library.repository.LibraryIssueRepository;
import com.erp.backend.library.repository.LibraryMembershipRepository;
import com.erp.backend.student.entity.Student;
import com.erp.backend.student.repository.StudentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class LibraryService {

    private final InstituteRepository instituteRepository;
    private final StudentRepository studentRepository;
    private final LibraryBookRepository libraryBookRepository;
    private final LibraryIssueRepository libraryIssueRepository;
    private final LibraryMembershipRepository libraryMembershipRepository;

    public LibraryService(
            InstituteRepository instituteRepository,
            StudentRepository studentRepository,
            LibraryBookRepository libraryBookRepository,
            LibraryIssueRepository libraryIssueRepository,
            LibraryMembershipRepository libraryMembershipRepository
    ) {
        this.instituteRepository = instituteRepository;
        this.studentRepository = studentRepository;
        this.libraryBookRepository = libraryBookRepository;
        this.libraryIssueRepository = libraryIssueRepository;
        this.libraryMembershipRepository = libraryMembershipRepository;
    }

    public List<LibraryBookResponse> getBooks(Long instituteId) {
        validateInstitute(instituteId);
        return libraryBookRepository.findAllByInstituteIdOrderByCreatedAtDesc(instituteId)
                .stream()
                .sorted(Comparator.comparing(LibraryBook::getTitle, Comparator.nullsLast(String::compareToIgnoreCase)))
                .map(this::toBookResponse)
                .toList();
    }

    @Transactional
    public LibraryBookResponse saveBook(Long instituteId, LibraryBookPayload request) {
        Institute institute = validateInstitute(instituteId);
        LibraryBook book = new LibraryBook();
        book.setInstitute(institute);
        applyBookPayload(book, request);
        return toBookResponse(libraryBookRepository.save(book));
    }

    @Transactional
    public void deleteBook(Long instituteId, Long bookId) {
        LibraryBook book = findBook(instituteId, bookId);
        if (libraryIssueRepository.existsByInstituteIdAndBookIdAndReturnDateIsNull(instituteId, bookId)) {
            throw new IllegalArgumentException("Return all active issues before deleting this book.");
        }
        libraryBookRepository.delete(book);
    }

    public List<LibraryIssueResponse> getIssues(Long instituteId) {
        validateInstitute(instituteId);
        return libraryIssueRepository.findAllByInstituteIdOrderByCreatedAtDesc(instituteId)
                .stream()
                .sorted(Comparator.comparing(LibraryIssue::getIssueDate, Comparator.nullsLast(LocalDate::compareTo)).reversed())
                .map(this::toIssueResponse)
                .toList();
    }

    @Transactional
    public LibraryIssueResponse saveIssue(Long instituteId, LibraryIssuePayload request) {
        validateInstitute(instituteId);
        LibraryBook book = findBook(instituteId, request.bookId());
        Student borrower = findStudent(instituteId, request.borrowerId());

        LocalDate issueDate = parseDate(request.issueDate(), "Issue date is required.");
        LocalDate dueDate = parseDate(request.dueDate(), "Due date is required.");
        LocalDate returnDate = parseOptionalDate(request.returnDate());

        if (dueDate.isBefore(issueDate)) {
            throw new IllegalArgumentException("Due date cannot be earlier than issue date.");
        }
        if (returnDate != null && returnDate.isBefore(issueDate)) {
            throw new IllegalArgumentException("Return date cannot be earlier than issue date.");
        }
        if (book.getAvailableQuantity() == null || book.getAvailableQuantity() < 1) {
            throw new IllegalArgumentException("Selected book is currently out of stock.");
        }

        LibraryIssue issue = new LibraryIssue();
        issue.setInstitute(book.getInstitute());
        issue.setBook(book);
        issue.setBorrower(borrower);
        issue.setIssueDate(issueDate);
        issue.setDueDate(dueDate);
        issue.setReturnDate(returnDate);
        issue.setFinePerDay(parseAmount(request.finePerDay()));
        issue.setDamageCharges(parseAmount(request.damageCharges()));

        LibraryIssue savedIssue = libraryIssueRepository.save(issue);
        if (returnDate == null) {
            book.setAvailableQuantity(Math.max((book.getAvailableQuantity() == null ? 0 : book.getAvailableQuantity()) - 1, 0));
            libraryBookRepository.save(book);
        }

        return toIssueResponse(savedIssue);
    }

    @Transactional
    public void deleteIssue(Long instituteId, Long issueId) {
        LibraryIssue issue = findIssue(instituteId, issueId);
        if (issue.getReturnDate() == null) {
            incrementBookStock(issue.getBook());
        }
        libraryIssueRepository.delete(issue);
    }

    @Transactional
    public LibraryIssueResponse markReturned(Long instituteId, Long issueId, LibraryReturnPayload request) {
        LibraryIssue issue = findIssue(instituteId, issueId);
        if (issue.getReturnDate() == null) {
            issue.setReturnDate(LocalDate.now());
            incrementBookStock(issue.getBook());
        }
        if (request != null && StringUtils.hasText(request.damageCharges())) {
            issue.setDamageCharges(parseAmount(request.damageCharges()));
        }
        return toIssueResponse(libraryIssueRepository.save(issue));
    }

    private Institute validateInstitute(Long instituteId) {
        return instituteRepository.findById(instituteId)
                .orElseThrow(() -> new ResourceNotFoundException("Institute not found with id: " + instituteId));
    }

    private Student findStudent(Long instituteId, Long studentId) {
        return studentRepository.findByInstituteIdAndId(instituteId, studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Student not found with id: " + studentId));
    }

    private LibraryBook findBook(Long instituteId, Long bookId) {
        return libraryBookRepository.findByInstituteIdAndId(instituteId, bookId)
                .orElseThrow(() -> new ResourceNotFoundException("Library book not found with id: " + bookId));
    }

    private LibraryIssue findIssue(Long instituteId, Long issueId) {
        return libraryIssueRepository.findByInstituteIdAndId(instituteId, issueId)
                .orElseThrow(() -> new ResourceNotFoundException("Library issue not found with id: " + issueId));
    }

    private void applyBookPayload(LibraryBook book, LibraryBookPayload request) {
        book.setIsbn(request.isbn().trim().toUpperCase());
        book.setTitle(request.title().trim().toUpperCase());
        book.setAuthor(request.author().trim().toUpperCase());
        book.setFormat(request.format().trim());
        book.setShelfLocation(request.shelfLocation().trim().toUpperCase());
        book.setAvailableQuantity(Math.max(request.availableQuantity(), 1));
    }

    private LibraryBookResponse toBookResponse(LibraryBook book) {
        return new LibraryBookResponse(
                book.getId(),
                book.getIsbn(),
                book.getTitle(),
                book.getAuthor(),
                book.getFormat(),
                book.getShelfLocation(),
                book.getAvailableQuantity(),
                book.getCreatedAt(),
                book.getUpdatedAt()
        );
    }

    private LibraryIssueResponse toIssueResponse(LibraryIssue issue) {
        Student borrower = issue.getBorrower();
        return new LibraryIssueResponse(
                issue.getId(),
                issue.getBook().getId(),
                issue.getBook().getTitle(),
                borrower.getId(),
                buildStudentName(borrower),
                firstNonBlank(borrower.getEnrollmentNo(), borrower.getAssignedClass()),
                issue.getIssueDate() == null ? null : issue.getIssueDate().toString(),
                issue.getDueDate() == null ? null : issue.getDueDate().toString(),
                issue.getReturnDate() == null ? null : issue.getReturnDate().toString(),
                issue.getFinePerDay() == null ? "0" : issue.getFinePerDay().toPlainString(),
                issue.getDamageCharges() == null ? "0" : issue.getDamageCharges().toPlainString(),
                issue.getCreatedAt(),
                issue.getUpdatedAt()
        );
    }

    private LocalDate parseDate(String value, String message) {
        if (!StringUtils.hasText(value)) {
            throw new IllegalArgumentException(message);
        }
        return LocalDate.parse(value.trim());
    }

    private LocalDate parseOptionalDate(String value) {
        return StringUtils.hasText(value) ? LocalDate.parse(value.trim()) : null;
    }

    private BigDecimal parseAmount(String value) {
        if (!StringUtils.hasText(value)) {
            return BigDecimal.ZERO;
        }

        try {
            return new BigDecimal(value.trim());
        } catch (NumberFormatException exception) {
            throw new IllegalArgumentException("Amount must be a valid number.");
        }
    }

    private void incrementBookStock(LibraryBook book) {
        int currentQuantity = book.getAvailableQuantity() == null ? 0 : book.getAvailableQuantity();
        book.setAvailableQuantity(currentQuantity + 1);
        libraryBookRepository.save(book);
    }

    private String buildStudentName(Student student) {
        return String.join(" ",
                defaultValue(student.getFirstName(), "").trim(),
                defaultValue(student.getLastName(), "").trim()).trim();
    }

    private String defaultValue(String value, String fallback) {
        return StringUtils.hasText(value) ? value.trim() : fallback;
    }

    private String firstNonBlank(String primary, String fallback) {
        if (StringUtils.hasText(primary)) {
            return primary.trim();
        }
        return StringUtils.hasText(fallback) ? fallback.trim() : null;
    }

    // Library Membership Methods
    
    public List<LibraryMembershipResponse> getMemberships(Long instituteId) {
        validateInstitute(instituteId);
        return libraryMembershipRepository.findByInstituteIdAndStatus(instituteId, "active")
                .stream()
                .map(this::toMembershipResponse)
                .toList();
    }

    public LibraryMembershipResponse createMembership(Long instituteId, LibraryMembershipPayload request) {
        Institute institute = validateInstitute(instituteId);
        Student student = findStudent(instituteId, request.studentId());
        
        // Check if student already has an active membership
        Optional<LibraryMembership> existingMembership = libraryMembershipRepository.findByStudentIdAndStatus(student.getId(), "active");
        if (existingMembership.isPresent()) {
            throw new IllegalArgumentException("Student already has an active library membership.");
        }

        LibraryMembership membership = new LibraryMembership();
        membership.setStudent(student);
        membership.setInstitute(institute);
        membership.setMembershipType(request.membershipType());
        membership.setMonthlyCharge(request.monthlyCharge());
        membership.setStatus("active");
        membership.setRemarks(request.remarks());
        
        return toMembershipResponse(libraryMembershipRepository.save(membership));
    }

    public LibraryMembershipResponse getMembershipByStudent(Long instituteId, Long studentId) {
        validateInstitute(instituteId);
        Student student = findStudent(instituteId, studentId);
        LibraryMembership membership = libraryMembershipRepository.findByStudent(student)
                .orElseThrow(() -> new ResourceNotFoundException("No library membership found for student with id: " + studentId));
        return toMembershipResponse(membership);
    }

    public LibraryMembershipResponse updateMembershipStatus(Long instituteId, Long membershipId, String status) {
        validateInstitute(instituteId);
        LibraryMembership membership = libraryMembershipRepository.findById(membershipId)
                .orElseThrow(() -> new ResourceNotFoundException("Library membership not found with id: " + membershipId));
        membership.setStatus(status);
        return toMembershipResponse(libraryMembershipRepository.save(membership));
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
}
