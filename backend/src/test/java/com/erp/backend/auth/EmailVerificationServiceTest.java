package com.erp.backend.auth;

import org.junit.jupiter.api.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.context.request.*;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.*;

class EmailVerificationServiceTest {
    JdbcTemplate jdbc = mock(JdbcTemplate.class);
    BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(4);
    OtpEmailDeliveryService mail = mock(OtpEmailDeliveryService.class);
    EmailVerificationService service = new EmailVerificationService(jdbc, encoder, mail, mock(RateLimiterService.class));
    @AfterEach void cleanup() { RequestContextHolder.resetRequestAttributes(); }

    Map<String,Object> challenge(int attempts, LocalDateTime expiry) {
        Map<String,Object> row = new HashMap<>();
        row.put("otp_hash", encoder.encode("123456")); row.put("attempts", attempts);
        row.put("expires_at", Timestamp.valueOf(expiry));
        row.put("expired", expiry.isBefore(LocalDateTime.now()));
        return row;
    }

    @Test void rejectsMissingVerificationAtSave() {
        assertThrows(IllegalArgumentException.class, () -> service.require("student@example.com", "STUDENT"));
        verifyNoInteractions(jdbc);
    }

    @Test void proofConsumptionIsBoundToEmailPurposeAndUnusedState() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Email-Verification", "random-secret-proof");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
        String sql = "update email_verifications set consumed_at=current_timestamp where proof_hash=? and email=? and purpose=? and verified_at is not null and consumed_at is null and expires_at > current_timestamp";
        when(jdbc.update(sql, AuthService.hash("random-secret-proof"), "student@example.com", "STUDENT")).thenReturn(1, 0);
        service.require(" STUDENT@EXAMPLE.COM ", "STUDENT");
        assertThrows(IllegalArgumentException.class, () -> service.require("student@example.com", "STUDENT"));
        assertThrows(IllegalArgumentException.class, () -> service.require("other@example.com", "STUDENT"));
        assertThrows(IllegalArgumentException.class, () -> service.require("student@example.com", "PASSWORD_RESET"));
    }

    @Test void wrongOtpIncrementsAttemptCounter() {
        when(jdbc.queryForList(anyString(), eq("id"))).thenReturn(List.of(challenge(0, LocalDateTime.now().plusMinutes(5))));
        assertThrows(IllegalArgumentException.class, () -> service.verify("id", "999999", "ip"));
        verify(jdbc).update("update email_verifications set attempts=attempts+1 where id=?", "id");
    }

    @Test void expiredAndExhaustedAndAlreadyVerifiedCodesCannotIssueProof() {
        var used = challenge(0, LocalDateTime.now().plusMinutes(5)); used.put("verified_at", Timestamp.valueOf(LocalDateTime.now()));
        for (var row : List.of(challenge(0, LocalDateTime.now().minusMinutes(1)), challenge(5, LocalDateTime.now().plusMinutes(5)), used)) {
            when(jdbc.queryForList(anyString(), eq("id"))).thenReturn(List.of(row));
            assertThrows(IllegalArgumentException.class, () -> service.verify("id", "123456", "ip"));
        }
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }

    @Test void correctOtpReturnsRandomProofAndStoresOnlyItsHash() {
        when(jdbc.queryForList(anyString(), eq("id"))).thenReturn(List.of(challenge(0, LocalDateTime.now().plusMinutes(5))));
        String proof = (String)service.verify("id", "123456", "ip").get("proof");
        assertEquals(43, proof.length());
        verify(jdbc).update(eq("update email_verifications set proof_hash=?, verified_at=current_timestamp, expires_at=current_timestamp + interval '30 minutes' where id=?"), eq(AuthService.hash(proof)), eq("id"));
    }

    @Test void resendCooldownPreventsEmailDelivery() {
        when(jdbc.queryForObject(anyString(), eq(Long.class), eq("test@example.com"))).thenReturn(1L);
        assertThrows(IllegalArgumentException.class, () -> service.send("test@example.com", "COLLEGE", "ip"));
        verifyNoInteractions(mail);
    }
}
