package com.erp.backend.auth;

import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
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
    private static final List<String> BUILT_IN_TRUSTED_ORIGINS = List.of(
            "https://erpfrontend-kohl.vercel.app"
    );
    private final Set<String> trustedOrigins;
    private final Set<String> trustedOriginPatterns;

    public OriginValidator(
            @Value("${app.cors.allowed-origins:}") String allowedOrigins,
            @Value("${app.cors.allowed-origin-patterns:}") String allowedOriginPatterns
    ) {
        Set<String> origins = new LinkedHashSet<>(BUILT_IN_TRUSTED_ORIGINS);
        origins.addAll(Arrays.stream(allowedOrigins.split(","))
                .map(this::normalizeCorsValue)
                .filter(StringUtils::hasText)
                .collect(Collectors.toCollection(LinkedHashSet::new)));
        this.trustedOrigins = Set.copyOf(origins);
        this.trustedOriginPatterns = Arrays.stream(allowedOriginPatterns.split(","))
                .map(this::normalizeCorsValue)
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

    private String normalizeCorsValue(String value) {
        String normalized = value == null ? "" : value.trim();
        if ((normalized.startsWith("\"") && normalized.endsWith("\""))
                || (normalized.startsWith("'") && normalized.endsWith("'"))) {
            normalized = normalized.substring(1, normalized.length() - 1).trim();
        }
        while (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized;
    }
}
