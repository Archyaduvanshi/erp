package com.erp.backend.examination.controller;

import java.util.List;

import com.erp.backend.examination.dto.ExamAdmitCardPayload;
import com.erp.backend.examination.dto.ExamAdmitCardResponse;
import com.erp.backend.examination.dto.ExamDateSheetPayload;
import com.erp.backend.examination.dto.ExamDateSheetResponse;
import com.erp.backend.examination.dto.ExamQuestionPaperPayload;
import com.erp.backend.examination.dto.ExamQuestionPaperResponse;
import com.erp.backend.examination.service.ExaminationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
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
@RequestMapping("/api/examinations")
public class ExaminationController {
    private final ExaminationService examinationService;

    public ExaminationController(ExaminationService examinationService) {
        this.examinationService = examinationService;
    }

    @GetMapping("/date-sheets")
    public List<ExamDateSheetResponse> getDateSheets(@RequestHeader("X-Institute-Id") Long instituteId) {
        return examinationService.getDateSheets(instituteId);
    }

    @PostMapping(value = "/date-sheets", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ExamDateSheetResponse saveDateSheet(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @Valid @RequestBody ExamDateSheetPayload request
    ) {
        return examinationService.saveDateSheet(instituteId, request);
    }

    @DeleteMapping("/date-sheets/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteDateSheet(@RequestHeader("X-Institute-Id") Long instituteId, @PathVariable Long id) {
        examinationService.deleteDateSheet(instituteId, id);
    }

    @GetMapping("/question-papers")
    public List<ExamQuestionPaperResponse> getQuestionPapers(@RequestHeader("X-Institute-Id") Long instituteId) {
        return examinationService.getQuestionPapers(instituteId);
    }

    @PostMapping(value = "/question-papers", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ExamQuestionPaperResponse saveQuestionPaper(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @Valid @RequestBody ExamQuestionPaperPayload request
    ) {
        return examinationService.saveQuestionPaper(instituteId, request);
    }

    @DeleteMapping("/question-papers/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteQuestionPaper(@RequestHeader("X-Institute-Id") Long instituteId, @PathVariable Long id) {
        examinationService.deleteQuestionPaper(instituteId, id);
    }

    @GetMapping("/admit-cards")
    public List<ExamAdmitCardResponse> getAdmitCards(@RequestHeader("X-Institute-Id") Long instituteId) {
        return examinationService.getAdmitCards(instituteId);
    }

    @PostMapping(value = "/admit-cards", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ExamAdmitCardResponse saveAdmitCard(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @Valid @RequestBody ExamAdmitCardPayload request
    ) {
        return examinationService.saveAdmitCard(instituteId, request);
    }

    @DeleteMapping("/admit-cards/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAdmitCard(@RequestHeader("X-Institute-Id") Long instituteId, @PathVariable Long id) {
        examinationService.deleteAdmitCard(instituteId, id);
    }
}
