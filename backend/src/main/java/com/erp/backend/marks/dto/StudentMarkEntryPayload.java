package com.erp.backend.marks.dto;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

public record StudentMarkEntryPayload(
        @NotNull Long studentId,
        String studentName,
        String rollNo,
        @NotNull @DecimalMin(value = "0.0") BigDecimal marksObtained
) {
}
