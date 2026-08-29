package com.erp.backend.curriculum.dto;

import java.time.LocalDate;

public record AcademicSessionResponse(
        Long id,
        String name,
        String status,
        boolean current,
        LocalDate startDate,
        LocalDate endDate
) {
}
