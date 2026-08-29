package com.erp.backend.fee.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public record FeePaymentResponse(
        Long id,
        Long academicSessionId,
        String structureId,
        Long studentId,
        String transactionId,
        String gatewayRef,
        String mode,
        String paymentStatus,
        String paymentTarget,
        BigDecimal paidAmount,
        LocalDate paymentDate,
        String coverageLabel,
        String activeFromMonth,
        Integer billedMonthsCount,
        String billingType,
        String receiptNumber,
        String taxBreakdown,
        BigDecimal balanceRemaining,
        String downloadLink,
        String idempotencyKey,
        String notificationStatus,
        List<String> coveredMonths,
        List<String> resolvedMonths,
        List<Map<String, Object>> allocations,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        LocalDateTime voidedAt,
        Long voidedByAccountId,
        String voidReason
) {
}
