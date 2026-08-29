package com.erp.backend.fee.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record FeeStudentSummaryResponse(
        StudentInfo student,
        BigDecimal totalDue,
        BigDecimal totalPaid,
        BigDecimal totalOutstanding,
        BigDecimal previousPending,
        BigDecimal currentDue,
        BigDecimal lateFine,
        BigDecimal discount,
        BigDecimal advanceBalance,
        List<Component> components
) {
    public record StudentInfo(
            Long id,
            String enrollmentNo,
            String name,
            String className,
            String section
    ) {
    }

    public record Component(
            Long feeStructureId,
            String feeComponent,
            BigDecimal dueAmount,
            BigDecimal paidAmount,
            BigDecimal outstandingAmount,
            LocalDate dueDate
    ) {
    }
}
