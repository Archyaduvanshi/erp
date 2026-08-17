package com.erp.backend.settings.dto;

import jakarta.validation.constraints.NotBlank;

public record ChangeAdminPasswordRequest(
        @NotBlank(message = "Current password is required")
        String currentPassword,

        @NotBlank(message = "New password is required")
        String newPassword,

        @NotBlank(message = "Confirm password is required")
        String confirmPassword
) {
}
