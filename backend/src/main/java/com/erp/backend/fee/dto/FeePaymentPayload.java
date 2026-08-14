package com.erp.backend.fee.dto;

import java.util.List;
import java.util.Map;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record FeePaymentPayload(
        @NotBlank String structureId,
        @NotNull Long studentId,
        @NotBlank String transactionId,
        String gatewayRef,
        String mode,
        String paymentStatus,
        String paymentTarget,
        @NotNull @Positive Double paidAmount,
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
        List<Map<String, Object>> allocations
) {
}
