package com.erp.backend.auth;

import java.time.Duration;
import java.util.Arrays;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class AuthCookieSupport {
    private final boolean secureCookies;
    private final long refreshDays;
    private final String sameSite;

    public AuthCookieSupport(
            @Value("${app.auth.secure-cookies:false}") boolean secureCookies,
            @Value("${app.auth.refresh-token-days:14}") long refreshDays,
            @Value("${app.auth.same-site:Strict}") String sameSite
    ) {
        this.secureCookies = secureCookies;
        this.refreshDays = refreshDays;
        this.sameSite = normalizeSameSite(sameSite);
    }

    public void setRefreshCookie(HttpServletResponse response, String refreshToken) {
        response.addHeader(HttpHeaders.SET_COOKIE, refreshCookie(refreshToken, Duration.ofDays(refreshDays)).toString());
    }

    public void clearRefreshCookie(HttpServletResponse response) {
        response.addHeader(HttpHeaders.SET_COOKIE, refreshCookie("", Duration.ZERO).toString());
    }

    public String readRefreshCookie(HttpServletRequest request) {
        if (request.getCookies() != null) {
            String cookieValue = Arrays.stream(request.getCookies())
                    .filter(cookie -> AuthService.REFRESH_COOKIE.equals(cookie.getName()))
                    .map(Cookie::getValue)
                    .filter(StringUtils::hasText)
                    .findFirst()
                    .orElse(null);
            if (StringUtils.hasText(cookieValue)) {
                return cookieValue;
            }
        }
        String cookieHeader = request.getHeader("Cookie");
        if (!StringUtils.hasText(cookieHeader)) return null;
        return Arrays.stream(cookieHeader.split(";"))
                .map(String::trim)
                .filter(value -> value.startsWith(AuthService.REFRESH_COOKIE + "="))
                .map(value -> value.substring((AuthService.REFRESH_COOKIE + "=").length()))
                .filter(StringUtils::hasText)
                .findFirst()
                .orElse(null);
    }

    private ResponseCookie refreshCookie(String value, Duration maxAge) {
        return ResponseCookie.from(AuthService.REFRESH_COOKIE, value)
                .path("/api")
                .httpOnly(true)
                .secure(secureCookies)
                .sameSite(sameSite)
                .maxAge(maxAge)
                .build();
    }

    private String normalizeSameSite(String value) {
        String normalized = value == null ? "" : value.trim();
        if ("None".equalsIgnoreCase(normalized)) {
            if (!secureCookies) {
                throw new IllegalArgumentException("SameSite=None refresh cookies require app.auth.secure-cookies=true");
            }
            return "None";
        }
        if ("Lax".equalsIgnoreCase(normalized)) return "Lax";
        if ("Strict".equalsIgnoreCase(normalized)) return "Strict";
        throw new IllegalArgumentException("app.auth.same-site must be Strict, Lax, or None");
    }
}
