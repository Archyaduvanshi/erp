package com.erp.backend.platform;

import com.erp.backend.auth.AuthPrincipal;
import com.erp.backend.cashfree.CashfreePaymentService;
import com.erp.backend.platform.controller.PlatformGatewayController;
import com.erp.backend.platform.service.PlatformAuditService;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

class PlatformGatewaySecurityTest {
    @Configuration
    @EnableMethodSecurity
    static class SecurityConfiguration {}

    @Test
    void onlyPlatformAdminCanManageAnExplicitInstituteGateway() {
        CashfreePaymentService payments = mock(CashfreePaymentService.class);
        PlatformAuditService audit = mock(PlatformAuditService.class);
        try (var context = new AnnotationConfigApplicationContext()) {
            context.register(SecurityConfiguration.class);
            context.registerBean(CashfreePaymentService.class, () -> payments);
            context.registerBean(PlatformAuditService.class, () -> audit);
            context.registerBean(PlatformGatewayController.class);
            context.refresh();
            var controller = context.getBean(PlatformGatewayController.class);
            for (String role : new String[]{"ADMIN", "STUDENT", "TEACHER"}) {
                authenticate(role);
                assertThrows(AccessDeniedException.class, () -> controller.create(42L, null, null));
                assertThrows(AccessDeniedException.class, () -> controller.link(42L, null, null, null));
                assertThrows(AccessDeniedException.class, () -> controller.current(42L));
                assertThrows(AccessDeniedException.class, () -> controller.reconcile(42L, "order", null, null));
                assertThrows(AccessDeniedException.class, () -> controller.refresh(42L, null, null));
                assertThrows(AccessDeniedException.class, () -> controller.onboarding(42L, null, null));
                assertThrows(AccessDeniedException.class, () -> controller.attempts(42L, 0, 25));
            }
            verifyNoInteractions(payments);
            authenticate("SUPER_ADMIN");
            controller.attempts(42L, 0, 25);
            verify(payments).getAttempts(eq(42L), any());
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    private void authenticate(String role) {
        var actor = new AuthPrincipal(1L, null, role, null, null, "test", false);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(actor, null, actor.getAuthorities()));
    }
}
