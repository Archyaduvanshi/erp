package com.erp.backend.auth;

import com.erp.backend.auth.entity.UserAccount;
import com.erp.backend.auth.repository.*;
import com.erp.backend.institute.repository.InstituteRepository;
import com.erp.backend.student.repository.StudentRepository;
import com.erp.backend.teacher.repository.TeacherRepository;
import com.erp.backend.settings.repository.FeatureAccessRepository;
import com.erp.backend.platform.service.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.junit.jupiter.api.Test;
import java.util.Map;
import java.util.Optional;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

class FirstLoginPasswordOtpTest {
    final UserAccountRepository accounts = mock(UserAccountRepository.class);
    final PasswordEncoder encoder = mock(PasswordEncoder.class);
    final EmailVerificationService otp = mock(EmailVerificationService.class);
    final PasswordResetDeliveryService delivery = mock(PasswordResetDeliveryService.class);
    final AuthService service = new AuthService(accounts, mock(AuthSessionRepository.class),
            mock(PasswordResetTokenRepository.class), mock(InstituteRepository.class), mock(TeacherRepository.class),
            mock(StudentRepository.class), mock(FeatureAccessRepository.class), encoder,
            mock(JwtTokenService.class), mock(RateLimiterService.class), delivery,
            mock(EntitlementService.class), mock(PlanLimitService.class), otp, 14L, false);
    final AuthPrincipal principal = new AuthPrincipal(8L, 4L, "STUDENT", null, 2L, "student", true);

    UserAccount account(String role) {
        var account = new UserAccount();
        account.setId(8L); account.setRole(role); account.setPasswordHash("old-hash"); account.setMustChangePassword(true);
        when(accounts.findByIdForUpdate(8L)).thenReturn(Optional.of(account));
        when(encoder.matches("Old@1234", "old-hash")).thenReturn(true);
        when(delivery.emailFor(account)).thenReturn("registered@example.com");
        return account;
    }

    @Test void sendingOtpDoesNotChangePasswordAndUsesAccountEmail() {
        var account = account("STUDENT");
        when(otp.send("registered@example.com", "PASSWORD_CHANGE", "ip"))
                .thenReturn(Map.of("challengeId", "one", "resendAfter", 60));
        var result = service.sendPasswordChangeOtp(principal, "Old@1234", "New@1234", "New@1234", "ip");
        assertEquals("r***@example.com", result.get("maskedEmail"));
        assertEquals("old-hash", account.getPasswordHash());
        assertTrue(account.isMustChangePassword());
        verify(accounts, never()).save(any());
    }

    @Test void incorrectCurrentPasswordDoesNotSendOtp() {
        account("TEACHER");
        assertThrows(RuntimeException.class, () -> service.sendPasswordChangeOtp(principal, "wrong", "New@1234", "New@1234", "ip"));
        verifyNoInteractions(otp);
    }

    @Test void missingOrInvalidProofCannotChangeStudentOrTeacherPassword() {
        for (String role : new String[] { "STUDENT", "TEACHER" }) {
            var account = account(role);
            doThrow(new IllegalArgumentException("Verify email")).when(otp).require("registered@example.com", "PASSWORD_CHANGE");
            assertThrows(IllegalArgumentException.class, () -> service.changePassword(principal, "Old@1234", "New@1234", "New@1234"));
            assertEquals("old-hash", account.getPasswordHash());
            assertTrue(account.isMustChangePassword());
        }
        verify(accounts, never()).save(any());
    }

    @Test void verifiedProofIsRequiredBeforeSavingNewPassword() {
        var account = account("TEACHER");
        when(encoder.encode("New@1234")).thenReturn("new-hash");
        service.changePassword(principal, "Old@1234", "New@1234", "New@1234");
        var order = inOrder(otp, encoder, accounts);
        order.verify(otp).require("registered@example.com", "PASSWORD_CHANGE");
        order.verify(encoder).encode("New@1234");
        order.verify(accounts).save(account);
        assertEquals("new-hash", account.getPasswordHash());
        assertFalse(account.isMustChangePassword());
    }
}
