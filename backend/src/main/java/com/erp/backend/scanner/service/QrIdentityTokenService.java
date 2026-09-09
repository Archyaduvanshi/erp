package com.erp.backend.scanner.service;

import java.util.Locale;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class QrIdentityTokenService {
    private static final Pattern PAYLOAD_PATTERN = Pattern.compile(
            "^VIDYANTRA:(STUDENT|TEACHER):([a-fA-F0-9]{32})$"
    );

    public String generate(EntityType entityType) {
        String token = UUID.randomUUID().toString().replace("-", "");
        return "VIDYANTRA:" + entityType.name() + ":" + token;
    }

    public ParsedQr parse(String qrData) {
        String value = StringUtils.hasText(qrData) ? qrData.trim() : "";
        Matcher matcher = PAYLOAD_PATTERN.matcher(value);
        if (!matcher.matches()) {
            throw new IllegalArgumentException("QR could not be verified.");
        }
        return new ParsedQr(
                EntityType.valueOf(matcher.group(1).toUpperCase(Locale.ROOT)),
                value
        );
    }

    public enum EntityType {
        STUDENT,
        TEACHER
    }

    public record ParsedQr(EntityType entityType, String payload) {
    }
}
