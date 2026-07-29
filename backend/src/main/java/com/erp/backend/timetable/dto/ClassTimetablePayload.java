package com.erp.backend.timetable.dto;

import jakarta.validation.constraints.NotBlank;

public record ClassTimetablePayload(
        @NotBlank(message = "Class name is required.")
        String className,
        String fileName,
        String fileData,
        String fileType,
        String uploadedAt,
        Object templateData,
        Object templateMeta
) {
}
