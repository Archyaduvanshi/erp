package com.erp.backend.auth;

import java.time.Duration;
import java.util.Arrays;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class AuthCookieSupport {
    private final boolean secureCookies;
    private final long refreshDays;

    public AuthCookieSupport(
            @Value("${app.auth.secure-cookies:false}") boolean secureCookies,
            @Value("${app.auth.refresh-token-days:14}") long refreshDays
    ) {
        this.secureCookies = secureCookies;
        this.refreshDays = refreshDays;
    }

    public void setRefreshCookie(HttpServletResponse response, String refreshToken) {
        response.addHeader(HttpHeaders.SET_COOKIE, AuthService.REFRESH_COOKIE + "=" + refreshToken
                + "; Path=/api"
                + "; HttpOnly"
                + "; SameSite=Strict"
                + secureFlag()
                + "; Max-Age=" + Duration.ofDays(refreshDays).toSeconds());
    }

    public void clearRefreshCookie(HttpServletResponse response) {
        response.addHeader(HttpHeaders.SET_COOKIE, AuthService.REFRESH_COOKIE
                + "=; Path=/api; HttpOnly; SameSite=Strict" + secureFlag() + "; Max-Age=0");
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

    private String secureFlag() {
        return secureCookies ? "; Secure" : "";
    }
}
