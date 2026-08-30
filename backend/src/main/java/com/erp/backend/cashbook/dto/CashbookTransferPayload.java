package com.erp.backend.cashbook.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

public record CashbookTransferPayload(
        LocalDate date,
        @NotNull Long fromAccountId,
        @NotNull Long toAccountId,
        @NotNull @DecimalMin("0.01") BigDecimal amount,
        String paymentMode,
        String referenceNumber,
        String description,
        String idempotencyKey,
        Long academicSessionId
) {
}
