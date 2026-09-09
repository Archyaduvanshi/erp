package com.erp.backend.scanner.controller;

import com.erp.backend.auth.AuthPrincipal;
import com.erp.backend.scanner.dto.QrRegenerateResponse;
import com.erp.backend.scanner.dto.ScanResolveRequest;
import com.erp.backend.scanner.dto.ScanResolveResponse;
import com.erp.backend.scanner.service.ScannerService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/scanner")
public class ScannerController {
    private final ScannerService scannerService;

    public ScannerController(ScannerService scannerService) {
        this.scannerService = scannerService;
    }

    @PostMapping("/resolve")
    public ScanResolveResponse resolve(
            @AuthenticationPrincipal AuthPrincipal principal,
            @Valid @RequestBody ScanResolveRequest request
    ) {
        return scannerService.resolve(principal, request);
    }

    @PostMapping("/students/{studentId}/regenerate")
    public QrRegenerateResponse regenerateStudent(
            @AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable Long studentId
    ) {
        return scannerService.regenerateStudent(principal, studentId);
    }

    @PostMapping("/teachers/{teacherId}/regenerate")
    public QrRegenerateResponse regenerateTeacher(
            @AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable Long teacherId
    ) {
        return scannerService.regenerateTeacher(principal, teacherId);
    }
}
