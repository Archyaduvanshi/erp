package com.erp.backend.settings.dto;

import java.time.LocalDateTime;

public record FeatureAccessResponse(
        String feature,
        Long teacherId,
        String teacherName,
        String employeeId,
        String operation,
        boolean enabled,
        boolean passwordSet,
        LocalDateTime updatedAt
) {
}
