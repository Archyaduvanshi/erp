package com.erp.backend.fee.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record FeeStructurePayload(
        @NotBlank String courseId,
        @NotBlank String category,
        String feeType,
        String facilityKey,
        @NotBlank String feeComponent,
        @NotNull @PositiveOrZero Double amount,
        Integer cycleMonths,
        String billingType,
        String dueDate,
        String activeFromMonth,
        String joinMonth
) {
}
