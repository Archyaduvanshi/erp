package com.erp.backend.result.dto;

import java.math.BigDecimal;

public record ResultSummaryResponse(
        Long examId,
        String examKey,
        BigDecimal totalObtainedMarks,
        BigDecimal totalMarks,
        int percentage
) {
}
