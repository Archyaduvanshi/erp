package com.erp.backend.cashbook.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;

public record FinancialAccountPayload(
        @NotBlank String name,
        @NotBlank String type,
        String bankName,
        String accountNumberLast4,
        @DecimalMin(value = "-999999999999.99") BigDecimal openingBalance,
        LocalDate openingDate
) {
}
