package com.erp.backend.salary.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record TeacherSalaryPaymentPayload(
        @NotNull(message = "Teacher is required.") Long teacherId,
        @NotBlank(message = "Salary month is required.") String monthKey,
        String payrollMonth,
        BigDecimal baseSalary,
        BigDecimal previousPendingAmount,
        BigDecimal bonusAmount,
        BigDecimal leaveDeductionAmount,
        BigDecimal totalAmount,
        Boolean settlePreviousOutstanding,
        String paymentMode,
        String transactionReference,
        Integer openSchoolDays,
        Integer presentDays,
        Integer absentDays,
        Integer allowedLeaves,
        Integer extraLeaveDays,
        BigDecimal perDaySalary,
        LocalDate paidOn,
        String idempotencyKey,
        List<String> settledMonthKeys,
        String note
) {
}
