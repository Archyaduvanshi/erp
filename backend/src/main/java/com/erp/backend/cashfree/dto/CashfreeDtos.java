package com.erp.backend.cashfree.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public final class CashfreeDtos {
    private CashfreeDtos() {
    }

    public record CreateOrderRequest(
            @NotNull @Positive BigDecimal amount,
            Long academicSessionId,
            @NotBlank String idempotencyKey
    ) {
    }

    public record OrderResponse(
            Long attemptId,
            String orderId,
            String paymentSessionId,
            BigDecimal amount,
            String currency,
            String status,
            String environment
    ) {
    }

    public record PaymentAvailabilityResponse(
            boolean configured,
            boolean merchantOnboarded,
            boolean paymentsEnabled,
            String onboardingStatus,
            String message
    ) {
    }

    public record MerchantResponse(
            String merchantId,
            String onboardingStatus,
            String productStatus,
            boolean paymentsEnabled,
            String onboardingLink,
            String onboardingLinkExpiresAt,
            Long accountId,
            long version
    ) {
    }

    public record LinkMerchantRequest(
            @NotBlank @jakarta.validation.constraints.Pattern(regexp="[A-Za-z0-9_-]{1,40}") String merchantId,
            Long expectedAccountId, Long expectedVersion,
            @NotBlank @jakarta.validation.constraints.Size(max=500) String reason,
            @jakarta.validation.constraints.AssertTrue boolean confirmSchoolOwnership
    ) {}

    public record AttemptResponse(
            Long attemptId,
            String orderId,
            String cfPaymentId,
            Long studentId,
            String studentName,
            BigDecimal amount,
            String currency,
            String status,
            String paymentMode,
            String bankReference,
            Long feePaymentId,
            LocalDateTime paidAt,
            LocalDateTime createdAt
    ) {
    }
}
