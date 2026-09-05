package com.erp.backend.curriculum.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;

import java.util.List;

import com.erp.backend.course.dto.CourseBookResponse;
import com.erp.backend.curriculum.dto.ClassSubjectBulkPayload;
import com.erp.backend.curriculum.dto.ClassSubjectPayload;
import com.erp.backend.curriculum.dto.ClassSubjectResponse;
import com.erp.backend.curriculum.dto.CourseBookResourcePayload;
import com.erp.backend.curriculum.service.CurriculumService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ClassSubjectController {

    private final CurriculumService curriculumService;

    public ClassSubjectController(CurriculumService curriculumService) {
        this.curriculumService = curriculumService;
    }

    @GetMapping("/api/classes/{classId}/subjects")
    public List<ClassSubjectResponse> getClassSubjects(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long classId,
            @RequestParam(required = false) Long academicSessionId
    ) {
        return curriculumService.getClassSubjects(instituteId, classId, academicSessionId);
    }

    @PostMapping("/api/class-subjects")
    @ResponseStatus(HttpStatus.CREATED)
    public ClassSubjectResponse saveClassSubject(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @Valid @RequestBody ClassSubjectPayload request
    ) {
        return curriculumService.saveClassSubject(instituteId, request);
    }

    @PostMapping("/api/class-subjects/bulk")
    @ResponseStatus(HttpStatus.CREATED)
    public List<ClassSubjectResponse> saveClassSubjectsBulk(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @Valid @RequestBody ClassSubjectBulkPayload request
    ) {
        return curriculumService.saveClassSubjectsBulk(instituteId, request);
    }

    @DeleteMapping("/api/class-subjects/{classSubjectId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void archiveClassSubject(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long classSubjectId
    ) {
        curriculumService.archiveClassSubject(instituteId, classSubjectId);
    }

    @GetMapping("/api/class-subjects/{classSubjectId}/books")
    public List<CourseBookResponse> getBooks(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long classSubjectId
    ) {
        return curriculumService.getBooks(instituteId, classSubjectId);
    }

    @PostMapping("/api/class-subjects/{classSubjectId}/books")
    @ResponseStatus(HttpStatus.CREATED)
    public CourseBookResponse saveBook(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long classSubjectId,
            @Valid @RequestBody CourseBookResourcePayload request
    ) {
        return curriculumService.saveBook(instituteId, classSubjectId, request);
    }

    @PutMapping("/api/class-subjects/{classSubjectId}/books/{bookId}")
    public CourseBookResponse updateBook(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long classSubjectId,
            @PathVariable Long bookId,
            @Valid @RequestBody CourseBookResourcePayload request
    ) {
        return curriculumService.updateBook(instituteId, classSubjectId, bookId, request);
    }

    @DeleteMapping("/api/class-subjects/{classSubjectId}/books/{bookId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteBook(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long classSubjectId,
            @PathVariable Long bookId
    ) {
        curriculumService.deleteBook(instituteId, classSubjectId, bookId);
    }
}
