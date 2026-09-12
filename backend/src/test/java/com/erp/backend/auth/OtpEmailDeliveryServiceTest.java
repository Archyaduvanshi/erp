package com.erp.backend.auth;

import jakarta.mail.internet.InternetAddress;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class OtpEmailDeliveryServiceTest {
    @Test
    void smtpUsesErpDisplayNameAndPreservesAuthenticatedAddress() throws Exception {
        for (String name : new String[] { "", "Vidyantra ERP", "School, ERP" }) {
            var service = new OtpEmailDeliveryService(mock(BrevoEmailService.class), "smtp",
                    "smtp.gmail.com", 587, "sender@example.com", "test-password", name);
            var smtp = mock(JavaMailSenderImpl.class);
            ReflectionTestUtils.setField(service, "smtp", smtp);
            service.send("student@example.com", "Verification", "Test message");
            var captured = ArgumentCaptor.forClass(SimpleMailMessage.class);
            verify(smtp).send(captured.capture());
            var message = captured.getValue();
            var from = new InternetAddress(message.getFrom());
            assertEquals(name.isBlank() ? "Vidyantra ERP" : name, from.getPersonal());
            assertEquals("sender@example.com", from.getAddress());
            assertArrayEquals(new String[] { "student@example.com" }, message.getTo());
            assertEquals("Test message", message.getText());
        }
    }
}
