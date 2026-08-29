package com.erp.backend.curriculum.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;

import java.util.List;

import com.erp.backend.curriculum.dto.ClassSubjectResponse;
import com.erp.backend.curriculum.dto.CopyCurriculumRequest;
import com.erp.backend.curriculum.dto.CurriculumClassSummaryResponse;
import com.erp.backend.curriculum.service.CurriculumService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
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

    @PostMapping("/copy")
    public List<ClassSubjectResponse> copyCurriculum(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @Valid @RequestBody CopyCurriculumRequest request
    ) {
        return curriculumService.copyCurriculum(instituteId, request);
    }
}
