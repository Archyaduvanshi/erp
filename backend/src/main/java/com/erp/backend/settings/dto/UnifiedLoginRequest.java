package com.erp.backend.settings.dto;

import jakarta.validation.constraints.NotBlank;

public record UnifiedLoginRequest(
        @NotBlank(message = "Username, enrollment ID, or teacher ID is required")
        String username,

        @NotBlank(message = "Password is required")
        String password,

        String institutionCode
) {
}
