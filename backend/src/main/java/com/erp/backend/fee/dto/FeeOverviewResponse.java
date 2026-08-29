package com.erp.backend.fee.dto;

import java.math.BigDecimal;

public record FeeOverviewResponse(
        BigDecimal totalExpected,
        BigDecimal totalCollected,
        BigDecimal totalOutstanding,
        long studentsWithDues,
        BigDecimal collectionsToday,
        BigDecimal collectionsThisMonth
) {
}
