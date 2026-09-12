package com.erp.backend.auth.controller;

import java.util.Map;
import com.erp.backend.auth.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth/email")
public class EmailVerificationController {
    private final EmailVerificationService service;
    private final ClientIpResolver ipResolver;
    public EmailVerificationController(EmailVerificationService service, ClientIpResolver ipResolver) { this.service=service; this.ipResolver=ipResolver; }
    public record Send(@NotBlank @Email @Size(max=254) String email, @NotBlank String purpose) {}
    public record Verify(@NotBlank @Size(max=64) String challengeId, @NotBlank @Size(max=6) String otp) {}
    @PostMapping("/send")
    public Map<String,Object> send(@Valid @RequestBody Send body, HttpServletRequest request) { return service.send(body.email(), body.purpose(), ipResolver.resolve(request)); }
    @PostMapping("/verify")
    public Map<String,Object> verify(@Valid @RequestBody Verify body, HttpServletRequest request) { return service.verify(body.challengeId(), body.otp(), ipResolver.resolve(request)); }
}
