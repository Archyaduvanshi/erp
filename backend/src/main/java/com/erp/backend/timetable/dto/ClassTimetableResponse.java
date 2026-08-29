package com.erp.backend.timetable.dto;

import java.time.LocalDateTime;

public record ClassTimetableResponse(
        Long id,
        Long academicSessionId,
        Long classId,
        Long sectionId,
        String sectionName,
        Long attendanceTeacherId,
        String className,
        String fileName,
        String fileData,
        String fileType,
        LocalDateTime uploadedAt,
        Object templateData,
        Object templateMeta,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
