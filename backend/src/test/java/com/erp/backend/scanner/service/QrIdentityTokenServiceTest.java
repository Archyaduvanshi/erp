package com.erp.backend.scanner.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;

import org.junit.jupiter.api.Test;

class QrIdentityTokenServiceTest {
    @Test
    void generatesOpaqueStableFormatWithoutPersonalData() throws Exception {
        Object service = service();
        Object studentType = entityType("STUDENT");
        String payload = (String) service.getClass().getMethod("generate", studentType.getClass())
                .invoke(service, studentType);

        assertThat(payload).matches("VIDYANTRA:STUDENT:[a-f0-9]{32}");
        Object parsed = service.getClass().getMethod("parse", String.class).invoke(service, payload);
        assertThat(parsed.getClass().getMethod("entityType").invoke(parsed).toString()).isEqualTo("STUDENT");
    }

    @Test
    void rejectsLegacyOrMalformedPayloads() throws Exception {
        Object service = service();
        Method parse = service.getClass().getMethod("parse", String.class);

        try {
            parse.invoke(service, "Student: Arch Yadav\nMobile: 9999999999");
            throw new AssertionError("Expected malformed QR to be rejected");
        } catch (InvocationTargetException exception) {
            assertThat(exception.getCause())
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessage("QR could not be verified.");
        }
    }

    private Object service() throws Exception {
        return Class.forName("com.erp.backend.scanner.service.QrIdentityTokenService")
                .getConstructor()
                .newInstance();
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private Object entityType(String value) throws Exception {
        Class<? extends Enum> type = Class.forName(
                "com.erp.backend.scanner.service.QrIdentityTokenService$EntityType"
        ).asSubclass(Enum.class);
        return Enum.valueOf(type, value);
    }
}
