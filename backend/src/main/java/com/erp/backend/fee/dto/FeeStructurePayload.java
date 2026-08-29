package com.erp.backend.fee.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record FeeStructurePayload(
        @NotBlank String courseId,
        @NotBlank String category,
        String feeType,
        String facilityKey,
        @NotBlank String feeComponent,
        @NotNull @PositiveOrZero BigDecimal amount,
        Integer cycleMonths,
        String billingType,
        LocalDate dueDate,
        String activeFromMonth,
        String joinMonth,
        Long academicSessionId
) {
}
