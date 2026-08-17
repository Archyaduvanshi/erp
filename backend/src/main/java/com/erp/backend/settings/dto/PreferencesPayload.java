package com.erp.backend.settings.dto;

public record PreferencesPayload(
        String academicYear,
        String workingDays,
        String timezone,
        String language,
        String dateFormat,
        String currency,
        String theme,
        String studentCodePrefix,
        String teacherCodePrefix
) {
}
