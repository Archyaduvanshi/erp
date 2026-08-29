package com.erp.backend.auth.dto;

public record AuthTokenPair(
        String accessToken,
        String refreshToken
) {
}
