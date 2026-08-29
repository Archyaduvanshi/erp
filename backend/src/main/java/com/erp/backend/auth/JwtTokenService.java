package com.erp.backend.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class JwtTokenService {
    private static final Base64.Encoder URL_ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder URL_DECODER = Base64.getUrlDecoder();
    private final ObjectMapper objectMapper;
    private final byte[] secret;
    private final long accessTokenSeconds;

    public JwtTokenService(
            ObjectMapper objectMapper,
            @Value("${app.auth.jwt-secret:}") String configuredSecret,
            @Value("${app.auth.access-token-seconds:900}") long accessTokenSeconds
    ) {
        this.objectMapper = objectMapper;
        if (!StringUtils.hasText(configuredSecret) || configuredSecret.trim().length() < 32) {
            throw new IllegalStateException("APP_AUTH_JWT_SECRET must be configured with at least 32 characters.");
        }
        String secretValue = configuredSecret.trim();
        this.secret = secretValue.getBytes(StandardCharsets.UTF_8);
        this.accessTokenSeconds = accessTokenSeconds;
    }

    public String createAccessToken(AuthPrincipal principal) {
        try {
            Map<String, Object> header = Map.of("alg", "HS256", "typ", "JWT");
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("sub", principal.accountId());
            payload.put("instituteId", principal.instituteId());
            payload.put("role", principal.role());
            payload.put("teacherId", principal.teacherId());
            payload.put("studentId", principal.studentId());
            payload.put("username", principal.username());
            payload.put("mustChangePassword", principal.mustChangePassword());
            payload.put("exp", Instant.now().plusSeconds(accessTokenSeconds).getEpochSecond());

            String unsigned = encodeJson(header) + "." + encodeJson(payload);
            return unsigned + "." + sign(unsigned);
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to create access token.", exception);
        }
    }

    public AuthPrincipal parse(String token) {
        try {
            String[] parts = token.split("\\.");
            if (parts.length != 3) {
                throw new IllegalArgumentException("Invalid token.");
            }
            String unsigned = parts[0] + "." + parts[1];
            if (!constantTimeEquals(sign(unsigned), parts[2])) {
                throw new IllegalArgumentException("Invalid token signature.");
            }
            Map<String, Object> payload = objectMapper.readValue(URL_DECODER.decode(parts[1]), new TypeReference<>() {
            });
            long exp = longValue(payload.get("exp"));
            if (Instant.now().getEpochSecond() >= exp) {
                throw new IllegalArgumentException("Token expired.");
            }
            return new AuthPrincipal(
                    longValue(payload.get("sub")),
                    longValue(payload.get("instituteId")),
                    String.valueOf(payload.get("role")),
                    nullableLong(payload.get("teacherId")),
                    nullableLong(payload.get("studentId")),
                    String.valueOf(payload.getOrDefault("username", "account")),
                    Boolean.parseBoolean(String.valueOf(payload.getOrDefault("mustChangePassword", false)))
            );
        } catch (Exception exception) {
            throw new IllegalArgumentException("Invalid access token.", exception);
        }
    }

    private String encodeJson(Map<String, Object> value) throws Exception {
        return URL_ENCODER.encodeToString(objectMapper.writeValueAsBytes(value));
    }

    private String sign(String value) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret, "HmacSHA256"));
        return URL_ENCODER.encodeToString(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
    }

    private boolean constantTimeEquals(String expected, String actual) {
        return MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.US_ASCII),
                actual.getBytes(StandardCharsets.US_ASCII)
        );
    }

    private long longValue(Object value) {
        if (value instanceof Number number) return number.longValue();
        return Long.parseLong(String.valueOf(value));
    }

    private Long nullableLong(Object value) {
        if (value == null) return null;
        if (value instanceof Number number) return number.longValue();
        String text = String.valueOf(value);
        return "null".equals(text) || text.isBlank() ? null : Long.parseLong(text);
    }
}
