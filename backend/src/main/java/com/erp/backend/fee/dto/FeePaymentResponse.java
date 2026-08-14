package com.erp.backend.fee.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public record FeePaymentResponse(
        Long id,
        String structureId,
        Long studentId,
        String transactionId,
        String gatewayRef,
        String mode,
        String paymentStatus,
        String paymentTarget,
        Double paidAmount,
        String paymentDate,
        String coverageLabel,
        String activeFromMonth,
        Integer billedMonthsCount,
        String billingType,
        String receiptNumber,
        String taxBreakdown,
        Double balanceRemaining,
        String downloadLink,
        List<String> coveredMonths,
        List<String> resolvedMonths,
        List<Map<String, Object>> allocations,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
