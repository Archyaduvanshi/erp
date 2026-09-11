package com.erp.backend.platform.controller;

import com.erp.backend.auth.AuthPrincipal;
import com.erp.backend.cashfree.CashfreePaymentService;
import com.erp.backend.cashfree.dto.CashfreeDtos.AttemptResponse;
import com.erp.backend.cashfree.dto.CashfreeDtos.MerchantResponse;
import com.erp.backend.cashfree.dto.CashfreeDtos.LinkMerchantRequest;
import com.erp.backend.platform.service.PlatformAuditService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/platform/institutes/{id}/gateway/cashfree")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class PlatformGatewayController {
    private final CashfreePaymentService payments;
    private final PlatformAuditService audit;

    public PlatformGatewayController(CashfreePaymentService payments, PlatformAuditService audit) {
        this.payments = payments;
        this.audit = audit;
    }

    @GetMapping("/merchant")
    public org.springframework.http.ResponseEntity<MerchantResponse> current(@PathVariable Long id) {
        MerchantResponse result=payments.currentMerchant(id);
        return result==null?org.springframework.http.ResponseEntity.noContent().build():org.springframework.http.ResponseEntity.ok(result);
    }

    @PutMapping("/merchant")
    @org.springframework.transaction.annotation.Transactional
    public MerchantResponse link(@PathVariable Long id,@jakarta.validation.Valid @RequestBody LinkMerchantRequest payload,
                                 @AuthenticationPrincipal AuthPrincipal actor,HttpServletRequest request) {
        payments.lockMerchantConfiguration(id);
        MerchantResponse old=payments.currentMerchant(id);
        MerchantResponse result=payments.linkMerchant(id,payload);
        audit.record(actor.accountId(),"GATEWAY_MERCHANT_LINKED","PAYMENT_GATEWAY","CASHFREE",id,
                old,result,payload.reason(),request.getRemoteAddr(),request.getHeader("User-Agent"));
        return result;
    }

    @PostMapping("/merchant")
    public MerchantResponse create(@PathVariable Long id, @AuthenticationPrincipal AuthPrincipal actor,
                                   HttpServletRequest request) {
        MerchantResponse result = payments.createMerchant(id);
        record(id, actor, request, "GATEWAY_MERCHANT_CREATED");
        return result;
    }

    @PostMapping("/refresh")
    public MerchantResponse refresh(@PathVariable Long id, @AuthenticationPrincipal AuthPrincipal actor,
                                    HttpServletRequest request) {
        MerchantResponse result = payments.refreshMerchant(id);
        record(id, actor, request, "GATEWAY_STATUS_REFRESHED");
        return result;
    }

    @PostMapping("/onboarding-link")
    public MerchantResponse onboarding(@PathVariable Long id, @AuthenticationPrincipal AuthPrincipal actor,
                                       HttpServletRequest request) {
        MerchantResponse result = payments.createOnboardingLink(id);
        record(id, actor, request, "GATEWAY_ONBOARDING_LINK_CREATED");
        return result;
    }

    @GetMapping("/attempts")
    public Page<AttemptResponse> attempts(@PathVariable Long id, @RequestParam(defaultValue = "0") int page,
                                         @RequestParam(defaultValue = "25") int size) {
        return payments.getAttempts(id, PageRequest.of(Math.max(0, page), Math.max(1, Math.min(100, size))));
    }

    @PostMapping("/attempts/{orderId}/reconcile")
    @org.springframework.transaction.annotation.Transactional
    public AttemptResponse reconcile(@PathVariable Long id, @PathVariable String orderId,
                                     @AuthenticationPrincipal AuthPrincipal actor, HttpServletRequest request) {
        AttemptResponse result = payments.reconcileAttempt(id, orderId);
        audit.record(actor.accountId(), "GATEWAY_PAYMENT_RECONCILED", "PAYMENT_GATEWAY", orderId, id,
                null, result, "Verify payment with Cashfree and sync fee receipt", request.getRemoteAddr(), request.getHeader("User-Agent"));
        return result;
    }

    private void record(Long id, AuthPrincipal actor, HttpServletRequest request, String action) {
        audit.record(actor.accountId(), action, "PAYMENT_GATEWAY", "CASHFREE", id,
                null, null, null, request.getRemoteAddr(), request.getHeader("User-Agent"));
    }
}
