package com.erp.backend.cashbook.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

public record CashbookEntryPayload(
        LocalDate date,
        @NotNull Long categoryId,
        @NotNull Long accountId,
        @NotNull @DecimalMin("0.01") BigDecimal amount,
        String paymentMode,
        String payerPayeeName,
        String referenceNumber,
        String description,
        String attachmentUrl,
        String attachmentName,
        String attachmentContentType,
        String idempotencyKey,
        Long academicSessionId
) {
}
