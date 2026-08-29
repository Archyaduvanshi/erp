package com.erp.backend.curriculum.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;

import java.util.List;

import com.erp.backend.curriculum.dto.AcademicSessionResponse;
import com.erp.backend.curriculum.service.CurriculumService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/academic-sessions")
public class AcademicSessionController {

    private final CurriculumService curriculumService;

    public AcademicSessionController(CurriculumService curriculumService) {
        this.curriculumService = curriculumService;
    }

    @GetMapping
    public List<AcademicSessionResponse> getAcademicSessions(@AuthenticationPrincipal(expression = "instituteId") Long instituteId) {
        return curriculumService.getAcademicSessions(instituteId);
    }
}
