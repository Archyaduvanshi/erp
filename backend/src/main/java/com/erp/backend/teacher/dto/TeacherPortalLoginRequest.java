package com.erp.backend.teacher.dto;

import jakarta.validation.constraints.NotBlank;

public record TeacherPortalLoginRequest(
        @NotBlank(message = "Teacher ID, employee ID, or mobile number is required") String identifier,
        @NotBlank(message = "Password is required") String password
) {
}
