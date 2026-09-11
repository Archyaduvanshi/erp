package com.erp.backend.platform.auth.dto;

import jakarta.validation.constraints.NotBlank;

public final class PlatformAuthDtos {
    private PlatformAuthDtos() {}

    public record LoginRequest(@NotBlank String username, @NotBlank String password) {}

    public record SessionResponse(
            Long accountId,
            String username,
            String displayName,
            String role,
            String accessToken
    ) {}

    public record TokenPair(String accessToken, String refreshToken) {}
}
