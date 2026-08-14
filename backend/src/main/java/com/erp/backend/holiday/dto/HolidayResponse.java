package com.erp.backend.holiday.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record HolidayResponse(
        Long id,
        String title,
        LocalDate holidayDate,
        String holidayType,
        String audience,
        List<String> targetClasses,
        String notes,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
