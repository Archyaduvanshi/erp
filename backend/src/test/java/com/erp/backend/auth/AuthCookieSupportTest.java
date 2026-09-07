package com.erp.backend.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Method;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletResponse;

class AuthCookieSupportTest {

    @Test
    void productionRefreshCookieSupportsCrossSiteFrontend() throws Exception {
        Object cookieSupport = cookieSupport(true, "None");
        MockHttpServletResponse response = new MockHttpServletResponse();

        setRefreshCookie(cookieSupport, response);

        assertThat(response.getHeader("Set-Cookie"))
                .contains("erp_refresh=refresh-token")
                .contains("Path=/api")
                .contains("HttpOnly")
                .contains("Secure")
                .contains("SameSite=None");
    }

    @Test
    void localRefreshCookieRemainsStrictWithoutSecureFlag() throws Exception {
        Object cookieSupport = cookieSupport(false, "Strict");
        MockHttpServletResponse response = new MockHttpServletResponse();

        setRefreshCookie(cookieSupport, response);

        assertThat(response.getHeader("Set-Cookie"))
                .contains("SameSite=Strict")
                .doesNotContain("Secure");
    }

    private Object cookieSupport(boolean secure, String sameSite) throws Exception {
        Class<?> cookieType = Class.forName("com.erp.backend.auth.AuthCookieSupport");
        return cookieType.getConstructor(boolean.class, long.class, String.class)
                .newInstance(secure, 14L, sameSite);
    }

    private void setRefreshCookie(Object cookieSupport, MockHttpServletResponse response) throws Exception {
        Method method = cookieSupport.getClass().getMethod(
                "setRefreshCookie",
                jakarta.servlet.http.HttpServletResponse.class,
                String.class
        );
        method.invoke(cookieSupport, response, "refresh-token");
    }
}
