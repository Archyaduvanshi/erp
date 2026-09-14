package com.erp.backend.publicsite;

import com.erp.backend.auth.*;
import com.erp.backend.platform.service.EntitlementService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.*;
import org.springframework.mock.web.MockServletContext;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class PublicSecurityTest {
    @Configuration @EnableWebMvc @Import(SecurityConfig.class)
    @org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
    static class TestConfiguration {
        @Bean PublicRateLimitService limiter() { return mock(PublicRateLimitService.class); }
        @Bean ClientIpResolver ipResolver() { return new ClientIpResolver(""); }
        @Bean AuthSecurityFilter authFilter() { return new AuthSecurityFilter(mock(JwtTokenService.class),mock(TeacherAuthorizationService.class),mock(EntitlementService.class)); }
        @Bean PublicCatalogService catalog() {
            var catalog=mock(PublicCatalogService.class);
            when(catalog.plans()).thenReturn(List.of());
            when(catalog.config()).thenReturn(new PublicDtos.Config("","",false));
            return catalog;
        }
        @Bean DemoRequestService demos() { return mock(DemoRequestService.class); }
        @Bean PublicController controller(PublicCatalogService catalog,DemoRequestService demos) { return new PublicController(catalog,demos); }
    }

    @Test void anonymousAccessIsLimitedToExactPublicMethodsAndDtos() throws Exception {
        try(var context=new AnnotationConfigWebApplicationContext()) {
            context.setServletContext(new MockServletContext());
            context.register(TestConfiguration.class); context.refresh();
            var mvc=MockMvcBuilders.webAppContextSetup(context).addFilters(context.getBean(FilterChainProxy.class)).build();
            mvc.perform(get("/api/public/plans").header("Authorization","Bearer stale-token")).andExpect(status().isOk()).andExpect(content().json("[]"));
            mvc.perform(get("/api/public/config")).andExpect(status().isOk()).andExpect(jsonPath("$.registrationEnabled").value(false)).andExpect(jsonPath("$.defaultPlan").doesNotExist());
            var demo=new PublicDtos.DemoRequest("Visitor","School","visitor@example.test","1234567890","School","",100,"Demo","",System.currentTimeMillis()-5000);
            mvc.perform(post("/api/public/demo-requests").header("Authorization","Bearer stale-token")
                    .contentType("application/json").content(new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(demo)))
                    .andExpect(status().isAccepted());
            verify(context.getBean(DemoRequestService.class)).submit(argThat(value->value.name().equals("Visitor")));
            for(String path:List.of("/api/platform/plans","/api/platform/settings","/api/students","/api/public/demo-requests","/api/public/private"))
                mvc.perform(get(path)).andExpect(status().isUnauthorized());
            mvc.perform(delete("/api/public/plans")).andExpect(status().isUnauthorized());
            mvc.perform(post("/api/public/plans")).andExpect(status().isUnauthorized());
        }
    }
}
