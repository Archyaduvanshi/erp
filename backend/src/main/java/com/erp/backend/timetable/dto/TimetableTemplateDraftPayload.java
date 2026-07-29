package com.erp.backend.timetable.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record TimetableTemplateDraftPayload(
        @NotBlank(message = "Class name is required.")
        String className,
        @NotNull(message = "Draft data is required.")
        Object draftData
) {
}
