package com.erp.backend.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;

public record ForgotPasswordRequest(
        @NotBlank(message = "Username, enrollment ID, or teacher ID is required")
        String username,

        @NotBlank(message = "Registered email is required")
        @Email(message = "Enter a valid email address")
        @Size(max = 254)
        String email
) {
}
