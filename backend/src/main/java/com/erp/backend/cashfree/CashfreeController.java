package com.erp.backend.cashfree;

import java.util.Map;

import com.erp.backend.auth.AuthPrincipal;
import com.erp.backend.cashfree.dto.CashfreeDtos.AttemptResponse;
import com.erp.backend.cashfree.dto.CashfreeDtos.CreateOrderRequest;
import com.erp.backend.cashfree.dto.CashfreeDtos.MerchantResponse;
import com.erp.backend.cashfree.dto.CashfreeDtos.OrderResponse;
import com.erp.backend.cashfree.dto.CashfreeDtos.PaymentAvailabilityResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/cashfree")
public class CashfreeController {
    private final CashfreePaymentService cashfreePaymentService;

    public CashfreeController(CashfreePaymentService cashfreePaymentService) {
        this.cashfreePaymentService = cashfreePaymentService;
    }

    @PostMapping("/merchant")
    @PreAuthorize("hasRole('ADMIN')")
    public MerchantResponse createMerchant(@AuthenticationPrincipal AuthPrincipal principal) {
        return cashfreePaymentService.createMerchant(principal.instituteId());
    }

    @GetMapping("/merchant")
    @PreAuthorize("hasRole('ADMIN')")
    public MerchantResponse refreshMerchant(@AuthenticationPrincipal AuthPrincipal principal) {
        return cashfreePaymentService.refreshMerchant(principal.instituteId());
    }

    @PostMapping("/merchant/onboarding-link")
    @PreAuthorize("hasRole('ADMIN')")
    public MerchantResponse onboardingLink(@AuthenticationPrincipal AuthPrincipal principal) {
        return cashfreePaymentService.createOnboardingLink(principal.instituteId());
    }

    @GetMapping("/attempts")
    @PreAuthorize("hasRole('ADMIN')")
    public Page<AttemptResponse> attempts(
            @AuthenticationPrincipal AuthPrincipal principal,
            Pageable pageable
    ) {
        return cashfreePaymentService.getAttempts(principal.instituteId(), pageable);
    }

    @PostMapping("/student/me/orders")
    @PreAuthorize("hasRole('STUDENT')")
    public OrderResponse createOrder(
            @AuthenticationPrincipal AuthPrincipal principal,
            @Valid @RequestBody CreateOrderRequest request
    ) {
        return cashfreePaymentService.createOrder(principal.instituteId(), principal.studentId(), request);
    }

    @GetMapping("/student/me/availability")
    @PreAuthorize("hasRole('STUDENT')")
    public PaymentAvailabilityResponse paymentAvailability(
            @AuthenticationPrincipal AuthPrincipal principal
    ) {
        return cashfreePaymentService.getPaymentAvailability(principal.instituteId());
    }

    @GetMapping("/student/me/orders/{orderId}")
    @PreAuthorize("hasRole('STUDENT')")
    public AttemptResponse getOrder(
            @AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable String orderId
    ) {
        return cashfreePaymentService.refreshAttempt(principal.instituteId(), principal.studentId(), orderId);
    }

    @PostMapping("/webhook")
    public ResponseEntity<Map<String, String>> webhook(
            @RequestHeader(value = "x-webhook-signature", required = false) String signature,
            @RequestHeader(value = "x-webhook-timestamp", required = false) String timestamp,
            @RequestBody String rawBody
    ) {
        cashfreePaymentService.processWebhook(signature, timestamp, rawBody);
        return ResponseEntity.ok(Map.of("status", "ok"));
    }
}
