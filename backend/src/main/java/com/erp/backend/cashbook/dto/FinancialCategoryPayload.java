package com.erp.backend.cashbook.dto;

import jakarta.validation.constraints.NotBlank;

public record FinancialCategoryPayload(
        @NotBlank String type,
        @NotBlank String name
) {
}
