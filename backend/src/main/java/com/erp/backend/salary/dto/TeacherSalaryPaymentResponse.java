package com.erp.backend.salary.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record TeacherSalaryPaymentResponse(
        Long id,
        Long teacherId,
        String monthKey,
        BigDecimal baseSalary,
        BigDecimal previousPendingAmount,
        BigDecimal bonusAmount,
        BigDecimal leaveDeductionAmount,
        BigDecimal amount,
        BigDecimal totalAmount,
        Integer openSchoolDays,
        Integer presentDays,
        Integer absentDays,
        Integer allowedLeaves,
        Integer extraLeaveDays,
        BigDecimal perDaySalary,
        String paidOn,
        List<String> settledMonthKeys,
        String note,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
