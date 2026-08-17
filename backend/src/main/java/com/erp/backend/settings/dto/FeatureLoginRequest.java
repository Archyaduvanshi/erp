package com.erp.backend.settings.dto;

import jakarta.validation.constraints.NotBlank;

public record FeatureLoginRequest(
        @NotBlank(message = "Institution username is required")
        String username,

        @NotBlank(message = "Feature is required")
        String feature,

        @NotBlank(message = "Password is required")
        String password
) {
}
