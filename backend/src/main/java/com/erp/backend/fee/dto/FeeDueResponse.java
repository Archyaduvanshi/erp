package com.erp.backend.fee.dto;

import java.math.BigDecimal;

public record FeeDueResponse(
        Long studentId,
        String enrollmentNo,
        String studentName,
        String className,
        String section,
        BigDecimal totalDue,
        BigDecimal totalPaid,
        BigDecimal outstanding,
        String dueStatus
) {
}
