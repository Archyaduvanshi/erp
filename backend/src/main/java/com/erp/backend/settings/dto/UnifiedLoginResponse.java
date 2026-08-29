package com.erp.backend.settings.dto;

import java.util.List;

public record UnifiedLoginResponse(
        Long id,
        String username,
        String instituteName,
        String type,
        String role,
        String logo,
        String accessToken,
        Long teacherId,
        String employeeId,
        String teacherName,
        Long studentId,
        String enrollmentNo,
        String studentName,
        boolean mustChangePassword,
        List<FeatureAccessResponse> assignedFeatures
) {
}
