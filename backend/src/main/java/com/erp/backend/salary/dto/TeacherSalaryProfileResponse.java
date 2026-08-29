package com.erp.backend.salary.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record TeacherSalaryProfileResponse(
        Long id,
        BigDecimal baseSalary,
        LocalDate effectiveFrom,
        LocalDate effectiveTo,
        String status
) {
}
