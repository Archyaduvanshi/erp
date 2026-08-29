package com.erp.backend.salary.dto;

import java.math.BigDecimal;

public record SalaryOverviewResponse(
        BigDecimal totalObligation,
        BigDecimal totalPaid,
        BigDecimal totalOutstanding,
        Long openPeriods,
        Long paidPeriods,
        BigDecimal currentMonthObligation,
        BigDecimal currentMonthPaid,
        Long paidTeachers,
        Long pendingTeachers,
        Long partiallyPaidTeachers,
        Long teachersMissingSalaryProfile
) {
}
