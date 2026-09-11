package com.erp.backend.platform.auth;

import java.time.Duration;
import java.util.Arrays;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class PlatformAuthCookieSupport {
    public static final String COOKIE_NAME = "erp_platform_refresh";
    private final boolean secure;
    private final String sameSite;
    private final long refreshDays;

    public PlatformAuthCookieSupport(
            @Value("${app.auth.secure-cookies:false}") boolean secure,
            @Value("${app.auth.same-site:Strict}") String sameSite,
            @Value("${app.platform.auth.refresh-token-days:7}") long refreshDays
    ) {
        this.secure = secure;
        this.sameSite = sameSite;
        this.refreshDays = refreshDays;
    }

    public void set(HttpServletResponse response, String value) {
        response.addHeader(HttpHeaders.SET_COOKIE, cookie(value, Duration.ofDays(refreshDays)).toString());
    }

    public void clear(HttpServletResponse response) {
        response.addHeader(HttpHeaders.SET_COOKIE, cookie("", Duration.ZERO).toString());
    }

    public String read(HttpServletRequest request) {
        if (request.getCookies() == null) return null;
        return Arrays.stream(request.getCookies())
                .filter(cookie -> COOKIE_NAME.equals(cookie.getName()))
                .map(Cookie::getValue)
                .filter(StringUtils::hasText)
                .findFirst().orElse(null);
    }

    private ResponseCookie cookie(String value, Duration age) {
        return ResponseCookie.from(COOKIE_NAME, value)
                .path("/api/platform")
                .httpOnly(true)
                .secure(secure)
                .sameSite(sameSite)
                .maxAge(age)
                .build();
    }
}
