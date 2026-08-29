package com.erp.backend.salary.dto;

import java.math.BigDecimal;
import java.util.List;

public record TeacherSalarySummaryResponse(
        Long teacherId,
        String teacherName,
        String employeeId,
        String specialization,
        String contractType,
        TeacherSalaryProfileResponse salaryProfile,
        TeacherPayrollPeriodResponse payrollPeriod,
        BigDecimal totalPaid,
        BigDecimal previousOutstanding,
        BigDecimal totalPayable,
        List<TeacherSalaryPaymentResponse> latestPayments
) {
}
