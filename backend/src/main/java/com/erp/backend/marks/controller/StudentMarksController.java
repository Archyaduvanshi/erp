package com.erp.backend.marks.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;

import java.util.List;

import com.erp.backend.auth.AuthPrincipal;
import com.erp.backend.marks.dto.StudentMarkResponse;
import com.erp.backend.marks.dto.StudentMarksExamRenamePayload;
import com.erp.backend.marks.dto.StudentMarksExamRenameResponse;
import com.erp.backend.marks.dto.StudentMarksRegisterPayload;
import com.erp.backend.marks.service.StudentMarksService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/marks")
public class StudentMarksController {

    private final StudentMarksService studentMarksService;

    public StudentMarksController(StudentMarksService studentMarksService) {
        this.studentMarksService = studentMarksService;
    }

    @GetMapping
    public List<StudentMarkResponse> getMarks(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam(required = false) Long academicSessionId,
            @RequestParam(required = false) Long classId,
            @RequestParam(required = false) String className,
            @RequestParam(required = false) Long subjectId,
            @RequestParam(required = false) String subjectName
    ) {
        return studentMarksService.getMarks(principal, academicSessionId, classId, className, subjectId, subjectName);
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public List<StudentMarkResponse> saveRegister(
            @AuthenticationPrincipal AuthPrincipal principal,
            @Valid @RequestBody StudentMarksRegisterPayload request
    ) {
        return studentMarksService.saveRegister(principal.instituteId(), principal, request);
    }

    @GetMapping("/exam-renames")
    public List<StudentMarksExamRenameResponse> getRenames(@AuthenticationPrincipal(expression = "instituteId") Long instituteId) {
        return studentMarksService.getRenames(instituteId);
    }

    @PostMapping("/exam-renames")
    @ResponseStatus(HttpStatus.CREATED)
    public List<StudentMarksExamRenameResponse> renameExam(
            @AuthenticationPrincipal AuthPrincipal principal,
            @Valid @RequestBody StudentMarksExamRenamePayload request
    ) {
        return studentMarksService.renameExam(principal.instituteId(), principal, request);
    }
}
