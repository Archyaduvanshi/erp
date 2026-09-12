package com.erp.backend.auth;

import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@Service
public class BrevoEmailService {
    private final ObjectMapper mapper;
    private final String apiKey;
    private final String sender;
    private final String senderName;
    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    public BrevoEmailService(ObjectMapper mapper, @Value("${BREVO_API_KEY:}") String apiKey,
            @Value("${BREVO_SENDER_EMAIL:}") String sender,
            @Value("${BREVO_SENDER_NAME:Vidyantra ERP}") String senderName) {
        this.mapper = mapper; this.apiKey = apiKey; this.sender = sender; this.senderName = senderName;
    }

    public void send(String to, String subject, String text) {
        if (apiKey.isBlank() || sender.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Email sending is not configured. Contact the administrator.");
        }
        try {
            String body = mapper.writeValueAsString(Map.of("sender", Map.of("email", sender, "name", senderName),
                    "to", List.of(Map.of("email", to)), "subject", subject, "textContent", text));
            HttpRequest request = HttpRequest.newBuilder(URI.create("https://api.brevo.com/v3/smtp/email"))
                    .timeout(Duration.ofSeconds(10)).header("api-key", apiKey)
                    .header("Content-Type", "application/json").header("Accept", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body)).build();
            int status = client.send(request, HttpResponse.BodyHandlers.discarding()).statusCode();
            if (status < 200 || status >= 300) throw new IllegalStateException("Email provider rejected request");
        } catch (Exception e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Unable to send email. Please try again later.");
        }
    }
}
