package com.erp.backend.auth;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class RateLimiterService {
    private final Map<String, Bucket> attempts;
    private final int maximumBuckets;

    public RateLimiterService(@Value("${app.auth.rate-limit.max-buckets:10000}") int maximumBuckets) {
        this.maximumBuckets = Math.max(100, maximumBuckets);
        this.attempts = new LinkedHashMap<>(256, 0.75f, true);
    }

    public void check(String scope, String key, int maxAttempts, Duration window) {
        String bucketKey = scope + ":" + (key == null ? "unknown" : key);
        Instant now = Instant.now();
        Instant cutoff = now.minus(window);
        synchronized (attempts) {
            purgeExpired(cutoff);
            Bucket bucket = attempts.computeIfAbsent(bucketKey, ignored -> new Bucket());
            bucket.lastAccessed = now;
            while (!bucket.timestamps.isEmpty() && bucket.timestamps.peekFirst().isBefore(cutoff)) {
                bucket.timestamps.removeFirst();
            }
            if (bucket.timestamps.size() >= maxAttempts) {
                String message = "institute-registration".equals(scope)
                        ? "REGISTRATION_RATE_LIMITED"
                        : "Too many requests. Please try again later.";
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, message);
            }
            bucket.timestamps.addLast(now);
            evictOverflow();
        }
    }

    private void purgeExpired(Instant cutoff) {
        Iterator<Map.Entry<String, Bucket>> iterator = attempts.entrySet().iterator();
        while (iterator.hasNext()) {
            Map.Entry<String, Bucket> entry = iterator.next();
            if (entry.getValue().lastAccessed.isBefore(cutoff)) {
                iterator.remove();
            }
        }
    }

    private void evictOverflow() {
        Iterator<String> iterator = attempts.keySet().iterator();
        while (attempts.size() > maximumBuckets && iterator.hasNext()) {
            iterator.next();
            iterator.remove();
        }
    }

    private static class Bucket {
        private final Deque<Instant> timestamps = new ArrayDeque<>();
        private Instant lastAccessed = Instant.now();
    }
}
