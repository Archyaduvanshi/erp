package com.erp.backend.marks.dto;

import java.math.BigDecimal;
import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

public record StudentMarksExamPayload(
        @NotBlank String examTitle,
        String examDate,
        @NotNull @DecimalMin(value = "0.01") BigDecimal maxMarks,
        @Valid @NotEmpty List<StudentMarkEntryPayload> entries
) {
}
