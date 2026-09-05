package com.erp.backend.curriculum.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;

import java.util.List;

import com.erp.backend.curriculum.dto.ClassOptionResponse;
import com.erp.backend.curriculum.dto.ClassCreatePayload;
import com.erp.backend.curriculum.dto.ClassResponse;
import com.erp.backend.curriculum.dto.ClassSubjectResponse;
import com.erp.backend.curriculum.dto.CopyCurriculumRequest;
import com.erp.backend.curriculum.dto.CurriculumClassSummaryResponse;
import com.erp.backend.curriculum.dto.SectionCreatePayload;
import com.erp.backend.curriculum.dto.SectionOccupancyResponse;
import com.erp.backend.curriculum.service.CurriculumService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/curriculum")
public class CurriculumController {

    private final CurriculumService curriculumService;

    public CurriculumController(CurriculumService curriculumService) {
        this.curriculumService = curriculumService;
    }

    @GetMapping("/classes")
    public List<CurriculumClassSummaryResponse> getClassSummaries(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam(required = false) Long academicSessionId
    ) {
        return curriculumService.getClassSummaries(instituteId, academicSessionId);
    }

    @GetMapping("/classes/summary")
    public List<CurriculumClassSummaryResponse> getClassSummaryRows(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam(required = false) Long academicSessionId
    ) {
        return curriculumService.getClassSummaryRows(instituteId, academicSessionId);
    }

    @GetMapping("/classes/options")
    public List<ClassOptionResponse> getClassOptions(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @RequestParam(required = false) Long academicSessionId
    ) {
        return curriculumService.getClassOptions(instituteId, academicSessionId);
    }

    @GetMapping("/classes/{classId}/sections/options")
    public List<SectionOccupancyResponse> getSectionOptions(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long classId
    ) {
        return curriculumService.getSectionOptions(instituteId, classId);
    }

    @PostMapping("/classes")
    @org.springframework.web.bind.annotation.ResponseStatus(HttpStatus.CREATED)
    public ClassResponse createClass(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @Valid @RequestBody ClassCreatePayload request
    ) {
        return curriculumService.createClass(instituteId, request);
    }

    @PostMapping("/classes/{classId}/sections")
    @org.springframework.web.bind.annotation.ResponseStatus(HttpStatus.CREATED)
    public SectionOccupancyResponse createSection(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long classId,
            @Valid @RequestBody SectionCreatePayload request
    ) {
        return curriculumService.createSection(instituteId, classId, request);
    }

    @PutMapping("/classes/{classId}/sections/{sectionId}")
    public SectionOccupancyResponse updateSection(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @PathVariable Long classId,
            @PathVariable Long sectionId,
            @Valid @RequestBody SectionCreatePayload request
    ) {
        return curriculumService.updateSection(instituteId, classId, sectionId, request);
    }

    @PostMapping("/copy")
    public List<ClassSubjectResponse> copyCurriculum(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @Valid @RequestBody CopyCurriculumRequest request
    ) {
        return curriculumService.copyCurriculum(instituteId, request);
    }
}
