package com.erp.backend.timetable.dto;

import jakarta.validation.constraints.NotBlank;

public record ClassTimetablePayload(
        Long academicSessionId,
        Long classId,
        Long sectionId,
        Long attendanceTeacherId,
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
