package com.erp.backend.auth;

import com.erp.backend.auth.entity.UserAccount;
import com.erp.backend.auth.entity.PasswordResetToken;
import com.erp.backend.auth.repository.*;
import com.erp.backend.institute.repository.InstituteRepository;
import com.erp.backend.student.repository.StudentRepository;
import com.erp.backend.teacher.repository.TeacherRepository;
import com.erp.backend.settings.repository.FeatureAccessRepository;
import com.erp.backend.platform.service.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

class RecoveryWithoutCodeTest {
    final UserAccountRepository accounts = mock(UserAccountRepository.class);
    final PasswordResetTokenRepository tokens = mock(PasswordResetTokenRepository.class);
    final EmailVerificationService otp = mock(EmailVerificationService.class);
    final PasswordResetDeliveryService delivery = mock(PasswordResetDeliveryService.class);
    final AuthService service = new AuthService(accounts, mock(AuthSessionRepository.class), tokens,
            mock(InstituteRepository.class), mock(TeacherRepository.class), mock(StudentRepository.class),
            mock(FeatureAccessRepository.class), mock(PasswordEncoder.class), mock(JwtTokenService.class),
            mock(RateLimiterService.class), delivery, mock(EntitlementService.class), mock(PlanLimitService.class), otp, 14L, false);

    @Test void matchesEmailWhenInstitutesShareAnIdentifier() {
        var target = new UserAccount();
        var other = new UserAccount();
        when(accounts.findAllByNormalizedLoginIdentifier("stu01")).thenReturn(List.of(target, other));
        when(delivery.emailFor(target)).thenReturn("Student@Example.com");
        when(delivery.emailFor(other)).thenReturn("other@example.com");
        var response = service.forgotPassword(" STUDENT@example.com ", " STU01 ", "ip");
        assertNotNull(response.resetToken());
        verify(otp).require("Student@Example.com", "PASSWORD_RESET");
        var token = org.mockito.ArgumentCaptor.forClass(PasswordResetToken.class);
        verify(tokens).save(token.capture());
        assertSame(target, token.getValue().getAccount());
    }

    @Test void ambiguousOrWrongEmailCannotIssueResetToken() {
        var first = new UserAccount();
        var second = new UserAccount();
        when(accounts.findAllByNormalizedLoginIdentifier("admin")).thenReturn(List.of(first, second));
        when(delivery.emailFor(first)).thenReturn("same@example.com");
        when(delivery.emailFor(second)).thenReturn("same@example.com");
        assertNull(service.forgotPassword("same@example.com", "admin", "ip").resetToken());
        assertNull(service.forgotPassword("wrong@example.com", "admin", "ip").resetToken());
        verifyNoInteractions(otp, tokens);
    }

    @Test void matchingAccountStillRequiresVerifiedEmail() {
        var target = new UserAccount();
        when(accounts.findAllByNormalizedLoginIdentifier("teacher01")).thenReturn(List.of(target));
        when(delivery.emailFor(target)).thenReturn("teacher@example.com");
        doThrow(new IllegalArgumentException("OTP required")).when(otp).require("teacher@example.com", "PASSWORD_RESET");
        assertThrows(IllegalArgumentException.class, () -> service.forgotPassword("teacher@example.com", "teacher01", "ip"));
        verifyNoInteractions(tokens);
    }
}
