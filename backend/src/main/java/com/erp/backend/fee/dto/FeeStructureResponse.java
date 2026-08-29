package com.erp.backend.fee.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record FeeStructureResponse(
        Long id,
        Long academicSessionId,
        String courseId,
        String category,
        String feeType,
        String facilityKey,
        String feeComponent,
        BigDecimal amount,
        Integer cycleMonths,
        String billingType,
        LocalDate dueDate,
        String activeFromMonth,
        String joinMonth,
        String status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
