package com.erp.backend.publicsite;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@Service
public class PublicRateLimitService {
    private final JdbcTemplate jdbc;
    public PublicRateLimitService(JdbcTemplate jdbc) { this.jdbc=jdbc; }

    @Transactional(propagation=Propagation.REQUIRES_NEW, noRollbackFor=ResponseStatusException.class)
    public void check(String scope, String key, int max, Duration window) {
        long seconds = window.toSeconds();
        long start = Instant.now().getEpochSecond() / seconds * seconds;
        // A one-way key avoids storing raw contact/IP identifiers in the throttle table.
        String bucket = scope + ":" + hash(key == null ? "unknown" : key);
        Integer attempts = jdbc.queryForObject("""
                insert into public_request_limits(bucket_key,window_start,attempts,expires_at)
                values (?,?,1,to_timestamp(?))
                on conflict(bucket_key,window_start) do update
                set attempts=least(public_request_limits.attempts+1,1000000)
                returning attempts
                """, Integer.class, bucket, start, start + seconds * 2);
        if (attempts != null && attempts > max) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                "Too many requests. Please wait before trying again.");
    }

    private static String hash(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
}
