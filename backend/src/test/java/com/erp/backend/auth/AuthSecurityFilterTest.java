package com.erp.backend.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Method;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

class AuthSecurityFilterTest {

    @Test
    void loginDoesNotRejectAStaleBearerTokenBeforeAuthentication() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/settings/login");
        request.addHeader("Authorization", "Bearer expired-token");

        assertThat(shouldNotFilter(request)).isTrue();
    }

    @Test
    void protectedBusinessEndpointStillUsesJwtFilter() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/students");

        assertThat(shouldNotFilter(request)).isFalse();
    }

    private boolean shouldNotFilter(MockHttpServletRequest request) throws Exception {
        Class<?> filterType = Class.forName("com.erp.backend.auth.AuthSecurityFilter");
        Object filter = filterType.getConstructors()[0].newInstance(null, null);
        Method method = filterType.getDeclaredMethod("shouldNotFilter", jakarta.servlet.http.HttpServletRequest.class);
        method.setAccessible(true);
        return (boolean) method.invoke(filter, request);
    }
}
