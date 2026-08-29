package com.erp.backend.settings.dto;

import java.time.LocalDateTime;
import java.util.List;

public record CollegeSettingsResponse(
        String instituteName,
        PreferencesPayload preferences,
        NotificationsPayload notifications,
        List<FeatureAccessResponse> featureAccess,
        LocalDateTime updatedAt
) {
}
