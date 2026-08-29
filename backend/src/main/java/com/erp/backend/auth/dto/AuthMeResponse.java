package com.erp.backend.auth.dto;

import java.util.List;

import com.erp.backend.settings.dto.FeatureAccessResponse;

public record AuthMeResponse(
        Long accountId,
        String role,
        Long instituteId,
        Long teacherId,
        Long studentId,
        String username,
        String name,
        boolean mustChangePassword,
        List<FeatureAccessResponse> permissions,
        String accessToken
) {
}
