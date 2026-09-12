package com.erp.backend.auth;

import java.security.SecureRandom;
import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.*;

@Service
public class EmailVerificationService {
    private final JdbcTemplate jdbc;
    private final PasswordEncoder encoder;
    private final OtpEmailDeliveryService mail;
    private final RateLimiterService limiter;
    private final SecureRandom random = new SecureRandom();
    private static final Set<String> PURPOSES = Set.of("COLLEGE", "STUDENT", "TEACHER", "PASSWORD_RESET");

    public EmailVerificationService(JdbcTemplate jdbc, PasswordEncoder encoder, OtpEmailDeliveryService mail, RateLimiterService limiter) {
        this.jdbc = jdbc; this.encoder = encoder; this.mail = mail; this.limiter = limiter;
    }

    public static String normalize(String email) { return email == null ? "" : email.trim().toLowerCase(Locale.ROOT); }

    @Transactional
    public Map<String, Object> send(String email, String purpose, String ip) {
        email = normalize(email);
        if (email.length() > 254 || !email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+")) throw new IllegalArgumentException("Enter a valid email address.");
        if (!PURPOSES.contains(purpose)) throw new IllegalArgumentException("Invalid verification purpose.");
        limiter.check("email-otp-ip", ip, 20, Duration.ofHours(1));
        // Serialize sends per email across instances; limits survive restarts.
        jdbc.queryForList("select pg_advisory_xact_lock(hashtext(?))", "email-otp:" + email);
        Long recent = jdbc.queryForObject("select count(*) from email_verifications where email=? and created_at > current_timestamp - interval '60 seconds'", Long.class, email);
        Long hourly = jdbc.queryForObject("select count(*) from email_verifications where email=? and created_at > current_timestamp - interval '1 hour'", Long.class, email);
        if (recent > 0 || hourly >= 5) throw new IllegalArgumentException("Please wait before requesting another OTP (60 seconds between sends, 5 per hour).");
        String id = UUID.randomUUID().toString();
        String otp = String.format(Locale.ROOT, "%06d", random.nextInt(1000000));
        jdbc.update("update email_verifications set consumed_at=current_timestamp where email=? and purpose=? and consumed_at is null", email, purpose);
        jdbc.update("insert into email_verifications(id,email,purpose,otp_hash,expires_at) values (?,?,?,?,current_timestamp + interval '5 minutes')", id, email, purpose, encoder.encode(otp));
        mail.send(email, "Your email verification code", "Your verification code is " + otp + ".\nIt expires in 5 minutes. Do not share this code.\nIf you did not request this, ignore this email.");
        return Map.of("challengeId", id, "expiresIn", 300, "resendAfter", 60);
    }

    @Transactional(noRollbackFor = IllegalArgumentException.class)
    public Map<String, Object> verify(String id, String otp, String ip) {
        limiter.check("email-otp-verify", ip, 40, Duration.ofMinutes(10));
        var rows = jdbc.queryForList("select *, (expires_at <= current_timestamp) as expired from email_verifications where id=? for update", id);
        if (rows.isEmpty()) throw new IllegalArgumentException("Invalid or expired OTP. Send a new code.");
        var row = rows.get(0);
        if (row.get("consumed_at") != null || row.get("verified_at") != null || ((Number)row.get("attempts")).intValue() >= 5
                || !Boolean.FALSE.equals(row.get("expired")))
            throw new IllegalArgumentException("Invalid or expired OTP. Send a new code.");
        jdbc.update("update email_verifications set attempts=attempts+1 where id=?", id);
        if (otp == null || !otp.matches("[0-9]{6}") || !encoder.matches(otp, (String)row.get("otp_hash")))
            throw new IllegalArgumentException("Incorrect OTP. Maximum 5 attempts allowed.");
        byte[] bytes = new byte[32]; random.nextBytes(bytes);
        String proof = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        jdbc.update("update email_verifications set proof_hash=?, verified_at=current_timestamp, expires_at=current_timestamp + interval '30 minutes' where id=?", AuthService.hash(proof), id);
        return Map.of("proof", proof, "expiresIn", 1800);
    }

    // Called inside the business transaction: failed saves roll back proof consumption.
    @Transactional
    public void require(String email, String purpose) {
        email = normalize(email);
        var attrs = RequestContextHolder.getRequestAttributes();
        String header = attrs instanceof ServletRequestAttributes a ? a.getRequest().getHeader("X-Email-Verification") : null;
        if (header != null && header.length() <= 4096) {
            for (String proof : header.split(",")) {
                if (proof.isBlank()) continue;
                int updated = jdbc.update("update email_verifications set consumed_at=current_timestamp where proof_hash=? and email=? and purpose=? and verified_at is not null and consumed_at is null and expires_at > current_timestamp", AuthService.hash(proof.trim()), email, purpose);
                if (updated == 1) return;
            }
        }
        throw new IllegalArgumentException("Verify this email with OTP before saving. Verification may have expired; send a new OTP.");
    }
}
