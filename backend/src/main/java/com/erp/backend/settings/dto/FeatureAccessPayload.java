package com.erp.backend.settings.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record FeatureAccessPayload(
        @NotBlank(message = "Feature is required")
        String feature,

        @Pattern(
                regexp = "^$|(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{8,}$",
                message = "Password must be at least 8 characters with uppercase, lowercase, number, and symbol."
        )
        String password,

        Long teacherId,

        @Pattern(regexp = "^(read|read_write)$", message = "Operation must be read or read_write")
        String operation,

        boolean enabled
) {
}
