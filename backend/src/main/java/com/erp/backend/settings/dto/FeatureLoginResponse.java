package com.erp.backend.settings.dto;

public record FeatureLoginResponse(
        Long id,
        String username,
        String instituteName,
        String type,
        String role,
        String featureRole,
        String logo
) {
}
