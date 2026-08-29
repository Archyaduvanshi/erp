package com.erp.backend.examination.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;

import java.util.List;

import com.erp.backend.auth.AuthPrincipal;
import com.erp.backend.examination.dto.ExamAdmitCardPayload;
import com.erp.backend.examination.dto.ExamAdmitCardBulkPayload;
import com.erp.backend.examination.dto.ExamAdmitCardResponse;
import com.erp.backend.examination.dto.ExamDateSheetPayload;
import com.erp.backend.examination.dto.ExamDateSheetResponse;
import com.erp.backend.examination.dto.ExamOptionResponse;
import com.erp.backend.examination.dto.ExamOverviewResponse;
import com.erp.backend.examination.dto.ExamQuestionPaperPayload;
import com.erp.backend.examination.dto.ExamQuestionPaperResponse;
import com.erp.backend.examination.dto.StudentExamPortalResponse;
import com.erp.backend.examination.dto.TeacherExamPortalResponse;
import com.erp.backend.examination.service.ExaminationService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
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
@RequestMapping("/api/examinations")
public class ExaminationController {
    private final ExaminationService examinationService;

    public ExaminationController(ExaminationService examinationService) {
        this.examinationService = examinationService;
    }

    @GetMapping("/overview")
    public ExamOverviewResponse getOverview(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam(required = false) Long academicSessionId
    ) {
        return examinationService.getOverview(instituteId, academicSessionId);
    }

    @GetMapping("/options")
    public ExamOptionResponse getOptions(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam(required = false) Long academicSessionId
    ) {
        return examinationService.getOptions(instituteId, academicSessionId);
    }

    @GetMapping("/date-sheets")
    public Page<ExamDateSheetResponse> getDateSheets(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam(required = false) Long academicSessionId,
            @RequestParam(required = false) Long examId,
            @RequestParam(required = false) Long classId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search,
            @PageableDefault(size = 25) Pageable pageable
    ) {
        return examinationService.getDateSheets(instituteId, academicSessionId, examId, classId, status, search, pageable);
    }

    @PostMapping(value = "/date-sheets", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ExamDateSheetResponse saveDateSheet(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @Valid @RequestBody ExamDateSheetPayload request
    ) {
        return examinationService.saveDateSheet(instituteId, request);
    }

    @DeleteMapping("/date-sheets/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteDateSheet(@AuthenticationPrincipal(expression = "instituteId") Long instituteId, @PathVariable Long id) {
        examinationService.deleteDateSheet(instituteId, id);
    }

    @GetMapping("/question-papers")
    public Page<ExamQuestionPaperResponse> getQuestionPapers(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam(required = false) Long academicSessionId,
            @RequestParam(required = false) Long examId,
            @RequestParam(required = false) Long classId,
            @RequestParam(required = false) Long subjectId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search,
            @PageableDefault(size = 25) Pageable pageable
    ) {
        return examinationService.getQuestionPapers(instituteId, academicSessionId, examId, classId, subjectId, status, search, pageable);
    }

    @PostMapping(value = "/question-papers", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ExamQuestionPaperResponse saveQuestionPaper(
            @AuthenticationPrincipal AuthPrincipal principal,
            @Valid @RequestBody ExamQuestionPaperPayload request
    ) {
        return examinationService.saveQuestionPaper(principal, request);
    }

    @DeleteMapping("/question-papers/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteQuestionPaper(@AuthenticationPrincipal(expression = "instituteId") Long instituteId, @PathVariable Long id) {
        examinationService.deleteQuestionPaper(instituteId, id);
    }

    @GetMapping("/admit-cards")
    public Page<ExamAdmitCardResponse> getAdmitCards(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam(required = false) Long academicSessionId,
            @RequestParam(required = false) Long examId,
            @RequestParam(required = false) Long classId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search,
            @PageableDefault(size = 25) Pageable pageable
    ) {
        return examinationService.getAdmitCards(instituteId, academicSessionId, examId, classId, status, search, pageable);
    }

    @PostMapping(value = "/admit-cards", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ExamAdmitCardResponse saveAdmitCard(
            @AuthenticationPrincipal AuthPrincipal principal,
            @Valid @RequestBody ExamAdmitCardPayload request
    ) {
        return examinationService.saveAdmitCard(principal.instituteId(), principal.accountId(), request);
    }

    @PostMapping(value = "/admit-cards/bulk", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public List<ExamAdmitCardResponse> generateAdmitCards(
            @AuthenticationPrincipal AuthPrincipal principal,
            @Valid @RequestBody ExamAdmitCardBulkPayload request
    ) {
        return examinationService.generateAdmitCards(principal.instituteId(), principal.accountId(), request);
    }

    @DeleteMapping("/admit-cards/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAdmitCard(@AuthenticationPrincipal(expression = "instituteId") Long instituteId, @PathVariable Long id) {
        examinationService.deleteAdmitCard(instituteId, id);
    }

    @GetMapping("/student/me")
    public StudentExamPortalResponse getStudentPortal(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam(required = false) Long academicSessionId
    ) {
        return examinationService.getStudentPortal(principal, academicSessionId);
    }

    @GetMapping("/teacher/me")
    public TeacherExamPortalResponse getTeacherPortal(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam(required = false) Long academicSessionId
    ) {
        return examinationService.getTeacherPortal(principal, academicSessionId);
    }
}
