package com.erp.backend.result.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;

import java.util.List;

import com.erp.backend.auth.AuthPrincipal;
import com.erp.backend.result.dto.ResultClassResponse;
import com.erp.backend.result.dto.ResultExamColumnResponse;
import com.erp.backend.result.dto.ResultPublicationResponse;
import com.erp.backend.result.dto.ResultStudentResponse;
import com.erp.backend.result.dto.StudentResultResponse;
import com.erp.backend.result.service.ResultService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/results")
public class ResultController {

    private final ResultService resultService;

    public ResultController(ResultService resultService) {
        this.resultService = resultService;
    }

    @GetMapping("/classes")
    public List<ResultClassResponse> getClasses(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam(required = false) Long academicSessionId
    ) {
        return resultService.getClasses(instituteId, academicSessionId);
    }

    @GetMapping("/students")
    public List<ResultStudentResponse> getClassStudents(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam String className,
            @RequestParam(required = false) Long academicSessionId,
            @RequestParam(required = false) Long examId
    ) {
        return resultService.getClassStudents(instituteId, className, academicSessionId, examId);
    }

    @GetMapping("/exams")
    public List<ResultExamColumnResponse> getClassExams(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam String className,
            @RequestParam(required = false) Long academicSessionId,
            @RequestParam(defaultValue = "false") boolean publishedOnly
    ) {
        return resultService.getClassExams(instituteId, className, academicSessionId, publishedOnly);
    }

    @GetMapping("/student")
    public StudentResultResponse getStudentResult(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam String className,
            @RequestParam Long studentId,
            @RequestParam(required = false) Long academicSessionId,
            @RequestParam(required = false) Long examId
    ) {
        return resultService.getStudentResult(instituteId, className, studentId, academicSessionId, examId);
    }

    @GetMapping("/student/me")
    public StudentResultResponse getMyStudentResult(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam(required = false) Long academicSessionId,
            @RequestParam(required = false) Long examId
    ) {
        return resultService.getMyStudentResult(principal.instituteId(), principal.studentId(), academicSessionId, examId);
    }

    @PostMapping("/publish")
    public ResultPublicationResponse publishResult(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam String className,
            @RequestParam Long academicSessionId,
            @RequestParam Long examId
    ) {
        return resultService.publishResult(principal, className, academicSessionId, examId);
    }

    @PostMapping("/reopen")
    public ResultPublicationResponse reopenResult(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam String className,
            @RequestParam Long academicSessionId,
            @RequestParam Long examId,
            @RequestParam(defaultValue = "") String reason
    ) {
        return resultService.reopenResult(principal, className, academicSessionId, examId, reason);
    }
}
