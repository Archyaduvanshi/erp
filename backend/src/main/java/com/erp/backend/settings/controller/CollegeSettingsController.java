package com.erp.backend.settings.controller;

import java.util.List;

import com.erp.backend.auth.AuthPrincipal;
import com.erp.backend.settings.dto.AcademicYearResponse;
import com.erp.backend.settings.dto.CollegeSettingsResponse;
import com.erp.backend.settings.dto.FeatureAccessPayload;
import com.erp.backend.settings.dto.FeatureAccessResponse;
import com.erp.backend.settings.dto.FeatureLoginRequest;
import com.erp.backend.settings.dto.FeatureLoginResponse;
import com.erp.backend.settings.dto.NotificationsPayload;
import com.erp.backend.settings.dto.PreferencesPayload;
import com.erp.backend.settings.dto.UnifiedLoginRequest;
import com.erp.backend.settings.dto.UnifiedLoginResponse;
import com.erp.backend.settings.service.CollegeSettingsService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/settings")
public class CollegeSettingsController {

    private final CollegeSettingsService collegeSettingsService;

    public CollegeSettingsController(CollegeSettingsService collegeSettingsService) {
        this.collegeSettingsService = collegeSettingsService;
    }

    @GetMapping
    public CollegeSettingsResponse getSettings(@AuthenticationPrincipal AuthPrincipal principal) {
        return collegeSettingsService.getSettings(principal.instituteId());
    }

    @GetMapping("/academic-year")
    public AcademicYearResponse getAcademicYear(@AuthenticationPrincipal AuthPrincipal principal) {
        return collegeSettingsService.getAcademicYear(principal.instituteId());
    }

    @PostMapping("/preferences")
    public CollegeSettingsResponse savePreferences(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestBody PreferencesPayload request
    ) {
        return collegeSettingsService.savePreferences(principal.instituteId(), request);
    }

    @PostMapping("/notifications")
    public CollegeSettingsResponse saveNotifications(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestBody NotificationsPayload request
    ) {
        return collegeSettingsService.saveNotifications(principal.instituteId(), request);
    }

    @PostMapping("/feature-access")
    public FeatureAccessResponse saveFeatureAccess(
            @AuthenticationPrincipal AuthPrincipal principal,
            @Valid @RequestBody FeatureAccessPayload request
    ) {
        return collegeSettingsService.saveFeatureAccess(principal.instituteId(), request);
    }

    @PostMapping("/feature-login")
    public FeatureLoginResponse loginFeature(@Valid @RequestBody FeatureLoginRequest request) {
        return collegeSettingsService.loginFeature(request);
    }

    @PostMapping("/login")
    public UnifiedLoginResponse loginUnified(@Valid @RequestBody UnifiedLoginRequest request, HttpServletRequest servletRequest, HttpServletResponse response) {
        return collegeSettingsService.loginUnified(request, servletRequest, response);
    }

    @GetMapping("/teachers/{teacherId}/feature-access")
    public List<FeatureAccessResponse> getTeacherFeatureAccess(
            @AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable Long teacherId
    ) {
        return collegeSettingsService.getTeacherFeatureAccess(principal.instituteId(), teacherId);
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resetSettings(@AuthenticationPrincipal AuthPrincipal principal) {
        collegeSettingsService.resetSettings(principal.instituteId());
    }
}
