package com.erp.backend.library.controller;

import java.util.List;

import com.erp.backend.library.dto.LibraryBookPayload;
import com.erp.backend.library.dto.LibraryBookResponse;
import com.erp.backend.library.dto.LibraryIssuePayload;
import com.erp.backend.library.dto.LibraryIssueResponse;
import com.erp.backend.library.dto.LibraryReturnPayload;
import com.erp.backend.library.service.LibraryService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/library")
public class LibraryController {

    private final LibraryService libraryService;

    public LibraryController(LibraryService libraryService) {
        this.libraryService = libraryService;
    }

    @GetMapping("/books")
    public List<LibraryBookResponse> getBooks(@RequestHeader("X-Institute-Id") Long instituteId) {
        return libraryService.getBooks(instituteId);
    }

    @PostMapping("/books")
    @ResponseStatus(HttpStatus.CREATED)
    public LibraryBookResponse saveBook(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @Valid @RequestBody LibraryBookPayload request
    ) {
        return libraryService.saveBook(instituteId, request);
    }

    @DeleteMapping("/books/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteBook(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @PathVariable Long id
    ) {
        libraryService.deleteBook(instituteId, id);
    }

    @GetMapping("/issues")
    public List<LibraryIssueResponse> getIssues(@RequestHeader("X-Institute-Id") Long instituteId) {
        return libraryService.getIssues(instituteId);
    }

    @PostMapping("/issues")
    @ResponseStatus(HttpStatus.CREATED)
    public LibraryIssueResponse saveIssue(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @Valid @RequestBody LibraryIssuePayload request
    ) {
        return libraryService.saveIssue(instituteId, request);
    }

    @DeleteMapping("/issues/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteIssue(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @PathVariable Long id
    ) {
        libraryService.deleteIssue(instituteId, id);
    }

    @PostMapping("/issues/{id}/return")
    public LibraryIssueResponse markReturned(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @PathVariable Long id,
            @RequestBody(required = false) LibraryReturnPayload request
    ) {
        return libraryService.markReturned(instituteId, id, request);
    }
}
