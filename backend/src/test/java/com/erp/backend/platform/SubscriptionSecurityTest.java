package com.erp.backend.platform;

import com.erp.backend.auth.AuthPrincipal;
import com.erp.backend.exception.GlobalExceptionHandler;
import com.erp.backend.institute.service.InstituteService;
import com.erp.backend.platform.controller.PlatformController;
import com.erp.backend.platform.service.PlatformConsoleService;
import com.erp.backend.platform.service.PlatformAuditService;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

class SubscriptionSecurityTest {
    @Configuration @EnableMethodSecurity static class SecurityConfiguration {}
    @Test void allSubscriptionMutationsRequireSuperAdminAndHttpDenialsAre403() throws Exception {
        var service=mock(PlatformConsoleService.class);
        try(var context=new AnnotationConfigApplicationContext()) {
            context.register(SecurityConfiguration.class);
            context.registerBean(PlatformConsoleService.class,()->service);
            context.registerBean(PlatformAuditService.class,()->mock(PlatformAuditService.class));
            context.registerBean(InstituteService.class,()->mock(InstituteService.class));
            context.registerBean(PlatformController.class);
            context.refresh();
            var controller=context.getBean(PlatformController.class);
            var mvc=MockMvcBuilders.standaloneSetup(controller).setCustomArgumentResolvers(new org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver()).setControllerAdvice(new GlobalExceptionHandler()).build();
            String body="""
                {"code":"TEST","name":"Test","monthlyPrice":0,"yearlyPrice":0,"trialDays":15,"status":"ACTIVE","features":[]}
                """;
            for(String role:new String[]{"ADMIN","TEACHER","STUDENT"}) {
                authenticate(role);
                mvc.perform(post("/api/platform/plans").contentType("application/json").content(body)).andExpect(status().isForbidden());
                assertThrows(AccessDeniedException.class,()->controller.updatePlan(1L,null,null,null));
                assertThrows(AccessDeniedException.class,()->controller.planStatus(1L,null,null,null));
                assertThrows(AccessDeniedException.class,()->controller.changeSubscription(1L,null,null,null));
                assertThrows(AccessDeniedException.class,()->controller.extendTrial(1L,null,null,null));
                assertThrows(AccessDeniedException.class,()->controller.endTrial(1L,null,null,null));
            }
            verifyNoInteractions(service);
            authenticate("SUPER_ADMIN");
            mvc.perform(post("/api/platform/plans").contentType("application/json").content(body)).andExpect(status().isOk());
            verify(service).savePlan(any(),any(),any());
        } finally {SecurityContextHolder.clearContext();}
    }
    private void authenticate(String role) {
        var actor=new AuthPrincipal(1L,null,role,null,null,"test",false);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(actor,null,actor.getAuthorities()));
    }
}
