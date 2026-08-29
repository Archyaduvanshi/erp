package com.erp.backend.salary.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record TeacherPayrollPeriodResponse(
        Long id,
        Long teacherId,
        Long academicSessionId,
        String teacherName,
        String employeeId,
        String monthKey,
        BigDecimal baseSalary,
        BigDecimal bonusAmount,
        BigDecimal leaveDeductionAmount,
        BigDecimal grossAmount,
        BigDecimal netPayableAmount,
        BigDecimal paidAmount,
        BigDecimal outstandingAmount,
        Integer openSchoolDays,
        Integer presentDays,
        Integer absentDays,
        Integer allowedLeaves,
        Integer extraLeaveDays,
        Integer paidLeaveDays,
        Integer unpaidLeaveDays,
        Integer halfDays,
        Integer missingAttendanceDays,
        BigDecimal perDaySalary,
        String status,
        String note,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
