package com.erp.backend.auth;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

import com.erp.backend.auth.entity.UserAccount;
import com.erp.backend.student.repository.StudentRepository;
import com.erp.backend.teacher.repository.TeacherRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class PasswordResetDeliveryService {
    private static final Logger LOGGER = LoggerFactory.getLogger(PasswordResetDeliveryService.class);

    private final ObjectMapper objectMapper;
    private final TeacherRepository teacherRepository;
    private final StudentRepository studentRepository;
    private final HttpClient httpClient;
    private final String webhookUrl;
    private final String resetUrlBase;
    private final Duration requestTimeout;

    public PasswordResetDeliveryService(
            ObjectMapper objectMapper,
            TeacherRepository teacherRepository,
            StudentRepository studentRepository,
            @Value("${app.auth.password-reset.webhook-url:}") String webhookUrl,
            @Value("${app.auth.password-reset.url-base:http://localhost:5173/reset-password}") String resetUrlBase,
            @Value("${app.auth.password-reset.connect-timeout:PT3S}") Duration connectTimeout,
            @Value("${app.auth.password-reset.request-timeout:PT8S}") Duration requestTimeout
    ) {
        this.objectMapper = objectMapper;
        this.teacherRepository = teacherRepository;
        this.studentRepository = studentRepository;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(connectTimeout)
                .build();
        this.webhookUrl = webhookUrl;
        this.resetUrlBase = resetUrlBase;
        this.requestTimeout = requestTimeout;
    }

    public void deliver(UserAccount account, String resetToken) {
        if (!StringUtils.hasText(webhookUrl)) {
            LOGGER.warn("Password reset delivery skipped because APP_AUTH_PASSWORD_RESET_WEBHOOK_URL is not configured. accountId={}", account.getId());
            return;
        }
        try {
            String body = objectMapper.writeValueAsString(payload(account, resetToken));
            HttpRequest request = HttpRequest.newBuilder(URI.create(webhookUrl.trim()))
                    .timeout(requestTimeout)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                LOGGER.warn(
                        "Password reset delivery webhook returned non-success. accountId={} status={}",
                        account.getId(),
                        response.statusCode()
                );
                return;
            }
            LOGGER.info("Password reset delivery webhook accepted request. accountId={} status={}", account.getId(), response.statusCode());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            LOGGER.warn("Password reset delivery interrupted. accountId={}", account.getId(), exception);
        } catch (Exception exception) {
            LOGGER.warn("Password reset delivery failed. accountId={}", account.getId(), exception);
        }
    }

    private Map<String, Object> payload(UserAccount account, String resetToken) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("event", "PASSWORD_RESET_REQUESTED");
        payload.put("role", account.getRole());
        payload.put("instituteId", account.getInstitute().getId());
        payload.put("instituteName", account.getInstitute().getInstituteName());
        payload.put("loginIdentifier", account.getNormalizedLoginIdentifier());
        payload.put("email", emailFor(account));
        payload.put("phone", phoneFor(account));
        payload.put("resetUrl", resetUrlBase + "?token=" + resetToken);
        return payload;
    }

    public String emailFor(UserAccount account) {
        if ("TEACHER".equals(account.getRole()) && account.getTeacherId() != null) {
            return teacherRepository.findByInstituteIdAndId(account.getInstitute().getId(), account.getTeacherId())
                    .map(teacher -> teacher.getPersonalEmail())
                    .orElse(null);
        }
        if ("STUDENT".equals(account.getRole()) && account.getStudentId() != null) {
            return studentRepository.findByInstituteIdAndId(account.getInstitute().getId(), account.getStudentId())
                    .map(student -> student.getEmail())
                    .orElse(null);
        }
        return account.getInstitute().getEmail();
    }

    private String phoneFor(UserAccount account) {
        if ("TEACHER".equals(account.getRole()) && account.getTeacherId() != null) {
            return teacherRepository.findByInstituteIdAndId(account.getInstitute().getId(), account.getTeacherId())
                    .map(teacher -> teacher.getMobileNumber())
                    .orElse(null);
        }
        if ("STUDENT".equals(account.getRole()) && account.getStudentId() != null) {
            return studentRepository.findByInstituteIdAndId(account.getInstitute().getId(), account.getStudentId())
                    .map(student -> student.getGuardianPhone())
                    .orElse(null);
        }
        return account.getInstitute().getContact();
    }
}
