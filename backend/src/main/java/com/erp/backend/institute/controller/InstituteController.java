package com.erp.backend.institute.controller;

import com.erp.backend.institute.dto.InstituteAuthResponse;
import com.erp.backend.institute.dto.InstituteLoginRequest;
import com.erp.backend.institute.dto.InstituteResponse;
import com.erp.backend.institute.dto.RegisterInstituteRequest;
import com.erp.backend.institute.service.InstituteService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/institutes")
public class InstituteController {

    private final InstituteService instituteService;

    public InstituteController(InstituteService instituteService) {
        this.instituteService = instituteService;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public InstituteAuthResponse registerInstitute(@Valid @RequestBody RegisterInstituteRequest request) {
        return instituteService.registerInstitute(request);
    }

    @PostMapping("/login")
    public InstituteAuthResponse loginInstitute(@Valid @RequestBody InstituteLoginRequest request) {
        return instituteService.loginInstitute(request);
    }

    @GetMapping("/{id}")
    public InstituteResponse getInstituteById(@PathVariable Long id) {
        return instituteService.getInstituteById(id);
    }
}
