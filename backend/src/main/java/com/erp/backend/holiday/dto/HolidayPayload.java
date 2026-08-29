package com.erp.backend.holiday.dto;

import java.time.LocalDate;
import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record HolidayPayload(
        @NotBlank(message = "Holiday name is required.")
        String title,
        @NotNull(message = "Holiday date is required.")
        LocalDate holidayDate,
        @NotBlank(message = "Holiday type is required.")
        String holidayType,
        @NotBlank(message = "Audience is required.")
        String audience,
        List<Long> targetClassIds,
        List<String> targetClasses,
        String notes
) {
}
