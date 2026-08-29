package com.erp.backend.fee.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record FeePaymentPayload(
        String structureId,
        Long studentId,
        String transactionId,
        String gatewayRef,
        String mode,
        String paymentStatus,
        String paymentTarget,
        @NotNull @Positive BigDecimal paidAmount,
        LocalDate paymentDate,
        String coverageLabel,
        String activeFromMonth,
        Integer billedMonthsCount,
        String billingType,
        String idempotencyKey,
        Long academicSessionId
) {
}
