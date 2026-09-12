package com.erp.backend.auth;

import jakarta.mail.internet.InternetAddress;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class OtpEmailDeliveryService {
    private final BrevoEmailService brevo;
    private final String provider;
    private final String username;
    private final String password;
    private final String senderName;
    private final JavaMailSenderImpl smtp = new JavaMailSenderImpl();

    public OtpEmailDeliveryService(BrevoEmailService brevo,
            @Value("${EMAIL_PROVIDER:smtp}") String provider,
            @Value("${MAIL_HOST:smtp.gmail.com}") String host,
            @Value("${MAIL_PORT:587}") int port,
            @Value("${MAIL_USERNAME:}") String username,
            @Value("${MAIL_PASSWORD:}") String password,
            @Value("${MAIL_SENDER_NAME:Vidyantra ERP}") String senderName) {
        this.brevo = brevo; this.provider = provider; this.username = username; this.password = password;
        this.senderName = senderName == null || senderName.isBlank() ? "Vidyantra ERP" : senderName.trim();
        smtp.setHost(host); smtp.setPort(port); smtp.setUsername(username); smtp.setPassword(password);
        smtp.setDefaultEncoding("UTF-8");
        var properties = smtp.getJavaMailProperties();
        properties.setProperty("mail.smtp.auth", "true");
        properties.setProperty("mail.smtp.starttls.enable", "true");
        properties.setProperty("mail.smtp.starttls.required", "true");
        properties.setProperty("mail.smtp.connectiontimeout", "5000");
        properties.setProperty("mail.smtp.timeout", "10000");
        properties.setProperty("mail.smtp.writetimeout", "10000");
    }

    public void send(String to, String subject, String text) {
        if ("brevo".equalsIgnoreCase(provider)) { brevo.send(to, subject, text); return; }
        if (!"smtp".equalsIgnoreCase(provider) || username.isBlank() || password.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Email sending is not configured. Contact the administrator.");
        }
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(to); message.setSubject(subject); message.setText(text);
        try {
            message.setFrom(new InternetAddress(username, senderName, "UTF-8").toString());
            smtp.send(message);
        }
        catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Unable to send email. Please try again later.");
        }
    }
}
