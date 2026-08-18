package com.erp.backend.result.dto;

import java.math.BigDecimal;

public record ResultSummaryResponse(
        String examKey,
        BigDecimal totalObtainedMarks,
        BigDecimal totalMarks,
        int percentage
) {
}
