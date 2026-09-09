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
            String onboardingLinkExpiresAt
    ) {
    }

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
