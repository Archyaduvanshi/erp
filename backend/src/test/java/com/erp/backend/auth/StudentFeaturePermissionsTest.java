package com.erp.backend.auth;

import com.erp.backend.auth.repository.*;
import com.erp.backend.institute.repository.InstituteRepository;
import com.erp.backend.student.repository.StudentRepository;
import com.erp.backend.teacher.repository.TeacherRepository;
import com.erp.backend.settings.repository.FeatureAccessRepository;
import com.erp.backend.settings.dto.FeatureAccessResponse;
import com.erp.backend.platform.service.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

class StudentFeaturePermissionsTest {
    @Test void studentSessionUsesEffectiveInstitutePermissions() {
        var entitlements = mock(EntitlementService.class);
        var permissions = List.of(
                new FeatureAccessResponse("fees", null, null, null, "read_write", true, false, null),
                new FeatureAccessResponse("library", null, null, null, "read_write", false, false, null));
        when(entitlements.effectivePermissions(4L)).thenReturn(permissions);
        var service = new AuthService(mock(UserAccountRepository.class), mock(AuthSessionRepository.class),
                mock(PasswordResetTokenRepository.class), mock(InstituteRepository.class), mock(TeacherRepository.class),
                mock(StudentRepository.class), mock(FeatureAccessRepository.class), mock(PasswordEncoder.class),
                mock(JwtTokenService.class), mock(RateLimiterService.class), mock(PasswordResetDeliveryService.class),
                entitlements, mock(PlanLimitService.class), 14L, false);
        var response = service.me(new AuthPrincipal(8L, 4L, "STUDENT", null, 2L, "student", false));
        assertEquals(permissions, response.permissions());
        verify(entitlements).effectivePermissions(4L);
    }
}
