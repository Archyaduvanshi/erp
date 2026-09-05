package com.erp.backend.curriculum.controller;

import com.erp.backend.curriculum.dto.ClassCreatePayload;
import com.erp.backend.curriculum.dto.ClassResponse;
import com.erp.backend.curriculum.service.CurriculumService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/classes")
public class SchoolClassController {

    private final CurriculumService curriculumService;

    public SchoolClassController(CurriculumService curriculumService) {
        this.curriculumService = curriculumService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ClassResponse createClass(
            @AuthenticationPrincipal(expression = "instituteId") Long instituteId,
            @Valid @RequestBody ClassCreatePayload request
    ) {
        return curriculumService.createClass(instituteId, request);
    }
}
