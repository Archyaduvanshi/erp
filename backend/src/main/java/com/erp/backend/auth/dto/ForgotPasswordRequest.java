package com.erp.backend.auth.dto;

import jakarta.validation.constraints.NotBlank;

public record ForgotPasswordRequest(
        @NotBlank(message = "Username, enrollment ID, or teacher ID is required")
        String username,

        String institutionCode
) {
}
