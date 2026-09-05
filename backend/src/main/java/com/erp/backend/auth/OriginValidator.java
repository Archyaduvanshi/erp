package com.erp.backend.auth;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.util.PatternMatchUtils;
import org.springframework.web.server.ResponseStatusException;

@Component
public class OriginValidator {
    private final Set<String> trustedOrigins;
    private final Set<String> trustedOriginPatterns;

    public OriginValidator(
            @Value("${app.cors.allowed-origins:}") String allowedOrigins,
            @Value("${app.cors.allowed-origin-patterns:}") String allowedOriginPatterns
    ) {
        this.trustedOrigins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(StringUtils::hasText)
                .collect(Collectors.toUnmodifiableSet());
        this.trustedOriginPatterns = Arrays.stream(allowedOriginPatterns.split(","))
                .map(String::trim)
                .filter(StringUtils::hasText)
                .collect(Collectors.toUnmodifiableSet());
    }

    public void validateBrowserOrigin(HttpServletRequest request) {
        String origin = request.getHeader("Origin");
        if (!StringUtils.hasText(origin)) {
            return;
        }
        if (!trustedOrigins.contains(origin) && trustedOriginPatterns.stream().noneMatch(pattern -> PatternMatchUtils.simpleMatch(pattern, origin))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Untrusted request origin.");
        }
    }
}
