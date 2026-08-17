package com.erp.backend.settings.controller;

import com.erp.backend.settings.dto.CollegeSettingsResponse;
import com.erp.backend.settings.dto.FeatureAccessPayload;
import com.erp.backend.settings.dto.FeatureAccessResponse;
import com.erp.backend.settings.dto.FeatureLoginRequest;
import com.erp.backend.settings.dto.FeatureLoginResponse;
import com.erp.backend.settings.dto.NotificationsPayload;
import com.erp.backend.settings.dto.PreferencesPayload;
import com.erp.backend.settings.service.CollegeSettingsService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
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
    public CollegeSettingsResponse getSettings(@RequestHeader("X-Institute-Id") Long instituteId) {
        return collegeSettingsService.getSettings(instituteId);
    }

    @PostMapping("/preferences")
    public CollegeSettingsResponse savePreferences(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @RequestBody PreferencesPayload request
    ) {
        return collegeSettingsService.savePreferences(instituteId, request);
    }

    @PostMapping("/notifications")
    public CollegeSettingsResponse saveNotifications(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @RequestBody NotificationsPayload request
    ) {
        return collegeSettingsService.saveNotifications(instituteId, request);
    }

    @PostMapping("/feature-access")
    public FeatureAccessResponse saveFeatureAccess(
            @RequestHeader("X-Institute-Id") Long instituteId,
            @Valid @RequestBody FeatureAccessPayload request
    ) {
        return collegeSettingsService.saveFeatureAccess(instituteId, request);
    }

    @PostMapping("/feature-login")
    public FeatureLoginResponse loginFeature(@Valid @RequestBody FeatureLoginRequest request) {
        return collegeSettingsService.loginFeature(request);
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resetSettings(@RequestHeader("X-Institute-Id") Long instituteId) {
        collegeSettingsService.resetSettings(instituteId);
    }
}
