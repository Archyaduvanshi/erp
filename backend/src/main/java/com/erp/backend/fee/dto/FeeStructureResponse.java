package com.erp.backend.fee.dto;

import java.time.LocalDateTime;

public record FeeStructureResponse(
        Long id,
        String courseId,
        String category,
        String feeType,
        String facilityKey,
        String feeComponent,
        Double amount,
        Integer cycleMonths,
        String billingType,
        String dueDate,
        String activeFromMonth,
        String joinMonth,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
