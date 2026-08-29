package com.erp.backend.student.dto;

import jakarta.validation.constraints.NotBlank;

public record StudentPortalLoginRequest(
        @NotBlank(message = "Enrollment number or mobile number is required") String identifier,
        @NotBlank(message = "Password is required") String password
) {
}
