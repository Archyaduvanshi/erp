package com.erp.backend.library.controller;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import com.erp.backend.auth.AuthPrincipal;
import com.erp.backend.library.dto.LibraryBookPayload;
import com.erp.backend.library.dto.LibraryBookResponse;
import com.erp.backend.library.dto.LibraryIssuePayload;
import com.erp.backend.library.dto.LibraryIssueResponse;
import com.erp.backend.library.dto.LibraryReturnPayload;
import com.erp.backend.library.dto.LibraryStudentSearchResponse;
import com.erp.backend.library.service.LibraryService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/library")
public class LibraryController {

    private final LibraryService libraryService;

    public LibraryController(LibraryService libraryService) {
        this.libraryService = libraryService;
    }

    @GetMapping("/overview")
    public Map<String, Object> getOverview(@AuthenticationPrincipal AuthPrincipal principal) {
        return libraryService.getOverview(principal.instituteId());
    }

    @GetMapping("/books")
    public Page<LibraryBookResponse> getBooks(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String format,
            @RequestParam(required = false) String availability,
            @RequestParam(required = false) String status,
            @PageableDefault(size = 25) Pageable pageable
    ) {
        return libraryService.getBooks(principal.instituteId(), search, format, availability, status, pageable);
    }

    @PostMapping("/books")
    @ResponseStatus(HttpStatus.CREATED)
    public LibraryBookResponse saveBook(
            @AuthenticationPrincipal AuthPrincipal principal,
            @Valid @RequestBody LibraryBookPayload request
    ) {
        return libraryService.saveBook(principal.instituteId(), request);
    }

    @DeleteMapping("/books/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteBook(
            @AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable Long id
    ) {
        libraryService.deleteBook(principal.instituteId(), id);
    }

    @GetMapping("/issues")
    public Page<LibraryIssueResponse> getIssues(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long studentId,
            @RequestParam(required = false) Long classId,
            @RequestParam(required = false) Long bookId,
            @RequestParam(required = false) LocalDate dateFrom,
            @RequestParam(required = false) LocalDate dateTo,
            @PageableDefault(size = 25) Pageable pageable
    ) {
        return libraryService.getIssues(principal.instituteId(), search, status, studentId, classId, bookId, dateFrom, dateTo, pageable);
    }

    @PostMapping("/issues")
    @ResponseStatus(HttpStatus.CREATED)
    public LibraryIssueResponse saveIssue(
            @AuthenticationPrincipal AuthPrincipal principal,
            @Valid @RequestBody LibraryIssuePayload request
    ) {
        return libraryService.saveIssue(principal.instituteId(), request, principal.accountId());
    }

    @DeleteMapping("/issues/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteIssue(
            @AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable Long id
    ) {
        libraryService.deleteIssue(principal.instituteId(), id, principal.accountId());
    }

    @PostMapping("/issues/{id}/return")
    public LibraryIssueResponse markReturned(
            @AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable Long id,
            @RequestBody(required = false) LibraryReturnPayload request
    ) {
        return libraryService.markReturned(principal.instituteId(), id, request, principal.accountId());
    }

    @GetMapping("/students/search")
    public Page<LibraryStudentSearchResponse> searchStudents(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String className,
            @RequestParam(required = false) String section,
            @PageableDefault(size = 20) Pageable pageable
    ) {
        return libraryService.searchStudents(principal.instituteId(), search, className, section, pageable);
    }

    @GetMapping("/student/me/summary")
    public Map<String, Object> getMySummary(@AuthenticationPrincipal AuthPrincipal principal) {
        return libraryService.getStudentSummary(principal.instituteId(), principal.studentId());
    }

    @GetMapping("/student/me/books")
    public Page<LibraryBookResponse> getMyBooks(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String format,
            @PageableDefault(size = 20) Pageable pageable
    ) {
        return libraryService.getStudentBooks(principal.instituteId(), principal.studentId(), search, format, pageable);
    }

    @GetMapping("/student/me/issues")
    public Page<LibraryIssueResponse> getMyIssues(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam(required = false) String status,
            @PageableDefault(size = 20) Pageable pageable
    ) {
        return libraryService.getStudentIssues(principal.instituteId(), principal.studentId(), status, pageable);
    }
}
