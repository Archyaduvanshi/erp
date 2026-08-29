package com.erp.backend.auth.dto;

public record ForgotPasswordResponse(
        String message,
        String resetToken
) {
}
