package com.erp.backend.curriculum.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;

import java.util.List;

import com.erp.backend.curriculum.dto.SubjectResponse;
import com.erp.backend.curriculum.service.CurriculumService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/subjects")
public class SubjectController {

    private final CurriculumService curriculumService;

    public SubjectController(CurriculumService curriculumService) {
        this.curriculumService = curriculumService;
    }

    @GetMapping
    public List<SubjectResponse> getSubjects(@AuthenticationPrincipal(expression = "instituteId") Long instituteId) {
        return curriculumService.getSubjects(instituteId);
    }
}
